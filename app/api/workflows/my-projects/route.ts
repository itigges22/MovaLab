import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient, getUserProfileFromRequest } from '@/lib/supabase-server';
import { getUserActiveProjects } from '@/lib/workflow-execution-service';
import { checkPermissionHybrid } from '@/lib/permission-checker';
import { Permission } from '@/lib/permissions';
import { logger } from '@/lib/debug-logger';

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

    // Get current user with profile
    const userProfile = await getUserProfileFromRequest(supabase);
    if (!userProfile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check EXECUTE_WORKFLOWS permission
    const canExecute = await checkPermissionHybrid(userProfile, Permission.EXECUTE_WORKFLOWS, undefined, supabase);
    if (!canExecute) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const isSuperadmin = (userProfile as any).is_superadmin === true;
    const user = { id: (userProfile as any).id };

    let projects: Record<string, unknown>[] = [];

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
            estimated_hours,
            actual_hours,
            end_date,
            start_date,
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
        .filter((p: any) => {
          const projects = p.projects as Record<string, unknown> | Record<string, unknown>[];
          const project = Array.isArray(projects) ? projects[0] : projects;
          return project && (project.status as string) !== 'complete';
        })
        .map((p: any) => {
          const userProfiles = p.user_profiles as Record<string, unknown> | undefined;
          return {
            ...p,
            assigned_user: userProfiles ? {
              id: userProfiles.id,
              name: userProfiles.name,
              email: userProfiles.email
            } : undefined
          };
        });
    } else {
      // Regular users see only their assigned active projects
      projects = await getUserActiveProjects(supabase, user.id);
    }

    return NextResponse.json({
      success: true,
      projects,
    });
  } catch (error: unknown) {
    logger.error('Error in GET /api/workflows/my-projects', {}, error as Error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
