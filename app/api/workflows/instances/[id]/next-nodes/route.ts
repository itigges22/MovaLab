import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';
import { hasPermission } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';
import { getNextAvailableNodes } from '@/lib/workflow-service';
import { verifyWorkflowInstanceAccess } from '@/lib/access-control-server';

// GET /api/workflows/instances/[id]/next-nodes - Get available next nodes
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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

    // Check VIEW_WORKFLOWS permission
    const canView = await hasPermission(userProfile, Permission.MANAGE_WORKFLOWS, undefined, supabase);
    if (!canView) {
      return NextResponse.json({ error: 'Insufficient permissions to view workflows' }, { status: 403 });
    }

    // Verify user has access to the workflow instance's project
    const accessCheck = await verifyWorkflowInstanceAccess(supabase, (user as any).id, id);
    if (!accessCheck.hasAccess) {
      return NextResponse.json({
        error: accessCheck.error || 'You do not have access to this workflow instance'
      }, { status: 403 });
    }

    // Get next available nodes
    const nextNodes = await getNextAvailableNodes(id);

    return NextResponse.json({ success: true, next_nodes: nextNodes }, { status: 200 });
  } catch (error: unknown) {
    console.error('Error in GET /api/workflows/instances/[id]/next-nodes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
