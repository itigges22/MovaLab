import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';
import { hasPermission } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';
import { getFormResponseByHistoryId } from '@/lib/form-service';
import { verifyWorkflowHistoryAccess } from '@/lib/access-control-server';

// GET /api/workflows/history/[historyId]/form - Get form response for workflow history entry
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ historyId: string }> }
) {
  const { historyId } = await params;

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
      .eq('id', user.id)
      .single();

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Check VIEW_FORMS permission
    const canView = await hasPermission(userProfile, Permission.VIEW_FORMS, undefined, supabase);
    if (!canView) {
      return NextResponse.json({ error: 'Insufficient permissions to view forms' }, { status: 403 });
    }

    // Verify user has access to the workflow history's project
    const accessCheck = await verifyWorkflowHistoryAccess(supabase, user.id, historyId);
    if (!accessCheck.hasAccess) {
      return NextResponse.json({
        error: accessCheck.error || 'You do not have access to this workflow history'
      }, { status: 403 });
    }

    // Get form response
    const response = await getFormResponseByHistoryId(historyId);

    if (!response) {
      return NextResponse.json({ error: 'Form response not found for this workflow history entry' }, { status: 404 });
    }

    return NextResponse.json({ success: true, response }, { status: 200 });
  } catch (error) {
    console.error('Error in GET /api/workflows/history/[historyId]/form:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
