import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';
import { getUserActiveProjects } from '@/lib/workflow-execution-service';

/**
 * GET /api/workflows/my-projects
 * Returns active projects for the user
 * Superadmins see ALL active projects across all users
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient(request);
    if (!supabase) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is superadmin
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('is_superadmin')
      .eq('id', user.id)
      .single();

    const isSuperadmin = userProfile?.is_superadmin === true;

    let projects: any[] = [];

    if (isSuperadmin) {
      // Superadmins see ALL active projects with their assigned users
      const { data: allAssignments } = await supabase
        .from('project_assignments')
        .select(`
          *,
          projects!inner(
            id,
            name,
            description,
            status,
            priority,
            created_at,
            account_id,
            accounts(id, name)
          ),
          user_profiles!project_assignments_user_id_fkey(
            id,
            name,
            email
          )
        `)
        .is('removed_at', null);

      // Filter out completed projects and add assigned_user info
      projects = (allAssignments || [])
        .filter((p: any) => p.projects && p.projects.status !== 'complete')
        .map((p: any) => ({
          ...p,
          assigned_user: p.user_profiles ? {
            id: p.user_profiles.id,
            name: p.user_profiles.name,
            email: p.user_profiles.email
          } : undefined
        }));
    } else {
      // Regular users see only their assigned active projects
      projects = await getUserActiveProjects(supabase, user.id);
    }

    return NextResponse.json({
      success: true,
      projects,
    });
  } catch (error) {
    console.error('Error in GET /api/workflows/my-projects:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
