import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';
import { hasPermission } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';
import { getAllClientFeedback } from '@/lib/client-portal-service';

// GET /api/admin/client-feedback - Admin view of all client feedback
export async function GET(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient(request);
    if (!supabase) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile with roles
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select(`
        *,
        user_roles!user_roles_user_id_fkey (
          roles (
            id,
            name,
            permissions,
            department_id
          )
        )
      `)
      .eq('id', (user as any).id)
      .single();

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Phase 9: VIEW_CLIENT_FEEDBACK → MANAGE_CLIENT_INVITES (consolidated admin permission)
    const canView = await hasPermission(userProfile, Permission.MANAGE_CLIENT_INVITES, undefined, supabase);
    if (!canView) {
      return NextResponse.json({ error: 'Insufficient permissions to view client feedback' }, { status: 403 });
    }

    // Get all feedback
    const feedback = await getAllClientFeedback();

    return NextResponse.json({ success: true, feedback }, { status: 200 });
  } catch (error: unknown) {
    console.error('Error in GET /api/admin/client-feedback:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
