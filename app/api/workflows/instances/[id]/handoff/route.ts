import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';
import { hasPermission } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';
import { handoffWorkflow } from '@/lib/workflow-service';
import { validateRequestBody, workflowHandoffSchema } from '@/lib/validation-schemas';
import { verifyWorkflowInstanceAccess } from '@/lib/access-control-server';

// POST /api/workflows/instances/[id]/handoff - Hand off work to next node
export async function POST(
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
      .eq('id', user.id)
      .single();

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Check EXECUTE_WORKFLOWS permission
    const canExecute = await hasPermission(userProfile, Permission.EXECUTE_WORKFLOWS, undefined, supabase);
    if (!canExecute) {
      return NextResponse.json({ error: 'Insufficient permissions to execute workflows' }, { status: 403 });
    }

    // Validate request body
    const body = await request.json();
    const validation = validateRequestBody(workflowHandoffSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Verify user has access to the workflow instance's project
    const accessCheck = await verifyWorkflowInstanceAccess(supabase, user.id, id);
    if (!accessCheck.hasAccess) {
      return NextResponse.json({
        error: accessCheck.error || 'You do not have access to this workflow instance'
      }, { status: 403 });
    }

    // Check if out-of-order handoff requires special permission
    if (validation.data.out_of_order) {
      const canSkip = await hasPermission(userProfile, Permission.SKIP_WORKFLOW_NODES, undefined, supabase);
      if (!canSkip) {
        return NextResponse.json({
          error: 'Insufficient permissions for out-of-order handoffs. Requires SKIP_WORKFLOW_NODES permission.'
        }, { status: 403 });
      }
    }

    // Execute handoff
    const historyEntry = await handoffWorkflow(supabase, {
      instanceId: id,
      toNodeId: validation.data.to_node_id,
      handedOffBy: user.id,
      handedOffTo: validation.data.handed_off_to || null,
      formResponseId: validation.data.form_response_id || null,
      notes: validation.data.notes || null,
      outOfOrder: validation.data.out_of_order || false
    });

    return NextResponse.json({ success: true, history_entry: historyEntry }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/workflows/instances/[id]/handoff:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
