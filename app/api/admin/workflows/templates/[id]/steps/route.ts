import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';
import { hasPermission } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';

// PUT /api/admin/workflows/templates/[id]/steps - Save all nodes and edges for a workflow
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: templateId } = await params;

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

    // Check MANAGE_WORKFLOWS permission
    const canManage = await hasPermission(userProfile, Permission.MANAGE_WORKFLOWS, undefined, supabase);
    if (!canManage) {
      return NextResponse.json({ error: 'Insufficient permissions to manage workflows' }, { status: 403 });
    }

    // Parse request body
    const { nodes, edges } = await request.json();

    if (!nodes || !Array.isArray(nodes)) {
      return NextResponse.json({ error: 'Invalid nodes data' }, { status: 400 });
    }

    // Delete existing nodes and connections for this template
    // Connections will be cascade deleted due to foreign key constraint
    await supabase
      .from('workflow_nodes')
      .delete()
      .eq('workflow_template_id', templateId);

    // Insert new nodes
    const nodeInserts = nodes.map((node: any, index: number) => ({
      id: node.id,
      workflow_template_id: templateId,
      node_type: node.data.type,
      label: node.data.label,
      position_x: node.position.x,
      position_y: node.position.y,
      step_order: index,
      entity_id: node.data.config?.roleId || node.data.config?.approverRoleId || null,
      form_template_id: node.data.config?.formTemplateId || null,
      settings: {
        department_id: node.data.config?.departmentId,
        required_approvals: node.data.config?.requiredApprovals,
        allow_feedback: node.data.config?.allowFeedback,
        allow_send_back: node.data.config?.allowSendBack,
        allow_attachments: node.data.config?.allowAttachments,
        formFields: node.data.config?.formFields,
        formName: node.data.config?.formName,
        formDescription: node.data.config?.formDescription,
        isDraftForm: node.data.config?.isDraftForm,
        condition_type: node.data.config?.conditionType,
        conditions: node.data.config?.conditions,
      },
    }));

    const { error: nodesError } = await supabase
      .from('workflow_nodes')
      .insert(nodeInserts);

    if (nodesError) {
      console.error('Error inserting nodes:', nodesError);
      return NextResponse.json({ error: 'Failed to save workflow nodes' }, { status: 500 });
    }

    // Insert new connections/edges
    if (edges && Array.isArray(edges) && edges.length > 0) {
      const connectionInserts = edges.map((edge: any) => ({
        workflow_template_id: templateId,
        from_node_id: edge.source,
        to_node_id: edge.target,
        condition: edge.data ? {
          label: edge.data.label,
          conditionValue: edge.data.conditionValue,
          conditionType: edge.data.conditionType,
          decision: edge.data.decision,
        } : null,
      }));

      const { error: connectionsError } = await supabase
        .from('workflow_connections')
        .insert(connectionInserts);

      if (connectionsError) {
        console.error('Error inserting connections:', connectionsError);
        return NextResponse.json({ error: 'Failed to save workflow connections' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, message: 'Workflow saved successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error in PUT /api/admin/workflows/templates/[id]/steps:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
