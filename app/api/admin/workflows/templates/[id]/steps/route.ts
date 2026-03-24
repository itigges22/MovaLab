import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';
import { hasPermission } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';
import { logger } from '@/lib/debug-logger';

// Node types that are allowed to have multiple outgoing edges
const BRANCHING_NODE_TYPES = ['approval', 'conditional'];

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
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      logger.error('Error parsing request body', {}, parseError as Error);
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const { nodes, edges } = body;

    // Debug logging
    logger.debug('[Workflow Save] Starting save for template', { templateId });
    logger.debug('[Workflow Save] Received nodes', { count: nodes?.length || 0 });
    logger.debug('[Workflow Save] Received edges', { count: edges?.length || 0 });

    if (!nodes || !Array.isArray(nodes)) {
      return NextResponse.json({ error: 'Invalid nodes data - must be an array' }, { status: 400 });
    }

    // Validate node IDs are valid UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const node of nodes) {
      if (!node.id || !uuidRegex.test(node.id)) {
        logger.error('[Workflow Save] Invalid node ID format', { nodeId: node.id });
        return NextResponse.json({
          error: `Invalid node ID format: "${node.id}"`,
          details: 'Node IDs must be valid UUIDs. Please try deleting and re-creating the workflow nodes.'
        }, { status: 400 });
      }
    }

    // Server-side validation: Check for sync nodes (parallel workflows disabled)
    const syncNodes = nodes.filter((n: any) => {
      const data = n.data as Record<string, unknown> | undefined;
      return data?.type === 'sync';
    });
    if (syncNodes.length > 0) {
      return NextResponse.json({
        error: 'Sync nodes are not allowed. Parallel workflows have been disabled.',
        details: `Found ${syncNodes.length} sync node(s). Please remove them and use a single pathway.`
      }, { status: 400 });
    }

    // Server-side validation: Check for parallel paths (non-branching nodes with multiple outgoing edges)
    if (edges && Array.isArray(edges)) {
      const edgesBySource = new Map<string, Record<string, unknown>[]>();
      edges.forEach((edge: any) => {
        const source = edge.source as string;
        const existing = edgesBySource.get(source) || [];
        existing.push(edge);
        edgesBySource.set(source, existing);
      });

      for (const node of nodes) {
        const nodeType = node.data?.type;
        if (nodeType === 'end') continue; // End nodes have no outgoing edges
        if (BRANCHING_NODE_TYPES.includes(nodeType)) continue; // These can branch

        const outgoingEdges = edgesBySource.get(node.id) || [];
        if (outgoingEdges.length > 1) {
          return NextResponse.json({
            error: `Parallel workflows are not allowed. Node "${node.data?.label || node.id}" has ${outgoingEdges.length} outgoing connections.`,
            details: 'Each node (except Approval and Conditional) can only have ONE outgoing connection.'
          }, { status: 400 });
        }
      }
    }

    // Validate entity references (roles/departments still exist in the database)
    const entityIds: string[] = [];
    for (const node of nodes) {
      const config = node.data?.config as Record<string, unknown> | undefined;
      const entityId = config?.roleId || config?.approverRoleId || config?.departmentId;
      if (entityId && typeof entityId === 'string') {
        entityIds.push(entityId);
      }
    }

    if (entityIds.length > 0) {
      const uniqueEntityIds = [...new Set(entityIds)];

      // Check roles
      const roleIds = nodes
        .filter((n: any) => {
          const config = n.data?.config as Record<string, unknown> | undefined;
          return config?.roleId || config?.approverRoleId;
        })
        .map((n: any) => {
          const config = n.data?.config as Record<string, unknown>;
          return (config?.roleId || config?.approverRoleId) as string;
        })
        .filter(Boolean);

      if (roleIds.length > 0) {
        const uniqueRoleIds = [...new Set(roleIds)];
        const { data: existingRoles } = await supabase
          .from('roles')
          .select('id')
          .in('id', uniqueRoleIds);

        const existingRoleIds = new Set((existingRoles || []).map((r: any) => r.id));
        const missingRoles = uniqueRoleIds.filter(id => !existingRoleIds.has(id));

        if (missingRoles.length > 0) {
          const affectedNodes = nodes
            .filter((n: any) => {
              const config = n.data?.config as Record<string, unknown> | undefined;
              return missingRoles.includes((config?.roleId || config?.approverRoleId) as string);
            })
            .map((n: any) => n.data?.label || n.id);

          return NextResponse.json({
            error: `Referenced role(s) no longer exist. Please reconfigure: ${affectedNodes.join(', ')}`,
            details: `${missingRoles.length} role(s) have been deleted. Update the affected node configurations.`
          }, { status: 400 });
        }
      }

      // Check departments
      const departmentIds = nodes
        .filter((n: any) => (n.data?.config as Record<string, unknown> | undefined)?.departmentId)
        .map((n: any) => (n.data?.config as Record<string, unknown>)?.departmentId as string)
        .filter(Boolean);

      if (departmentIds.length > 0) {
        const uniqueDeptIds = [...new Set(departmentIds)];
        const { data: existingDepts } = await supabase
          .from('departments')
          .select('id')
          .in('id', uniqueDeptIds);

        const existingDeptIds = new Set((existingDepts || []).map((d: any) => d.id));
        const missingDepts = uniqueDeptIds.filter(id => !existingDeptIds.has(id));

        if (missingDepts.length > 0) {
          const affectedNodes = nodes
            .filter((n: any) => {
              const config = n.data?.config as Record<string, unknown> | undefined;
              return missingDepts.includes(config?.departmentId as string);
            })
            .map((n: any) => n.data?.label || n.id);

          return NextResponse.json({
            error: `Referenced department(s) no longer exist. Please reconfigure: ${affectedNodes.join(', ')}`,
            details: `${missingDepts.length} department(s) have been deleted. Update the affected node configurations.`
          }, { status: 400 });
        }
      }
    }

    // Verify the template exists
    logger.debug('[Workflow Save] Verifying template exists', { templateId });
    const { data: template, error: templateError } = await supabase
      .from('workflow_templates')
      .select('id')
      .eq('id', templateId)
      .single();

    if (templateError || !template) {
      logger.error('[Workflow Save] Template not found', {}, templateError as Error);
      return NextResponse.json({ error: 'Workflow template not found' }, { status: 404 });
    }
    logger.debug('[Workflow Save] Template verified');

    // First, get the node IDs that belong to this template
    logger.debug('[Workflow Save] Getting existing node IDs');
    const { data: existingNodes } = await supabase
      .from('workflow_nodes')
      .select('id')
      .eq('workflow_template_id', templateId);

    const existingNodeIds = existingNodes?.map(n => n.id) || [];
    logger.debug('[Workflow Save] Found existing nodes', { count: existingNodeIds.length });

    // Clear FK references to these nodes before deleting them
    if (existingNodeIds.length > 0) {
      logger.debug('[Workflow Save] Clearing FK references for node deletion');

      // Nullify current_node_id on workflow_instances
      await supabase
        .from('workflow_instances')
        .update({ current_node_id: null })
        .in('current_node_id', existingNodeIds);

      // Delete workflow_active_steps referencing these nodes
      await supabase
        .from('workflow_active_steps')
        .delete()
        .in('node_id', existingNodeIds);
    }

    // Delete existing nodes and connections for this template
    // Connections will be cascade deleted due to foreign key constraint
    logger.debug('[Workflow Save] Deleting existing nodes');
    const { error: deleteError } = await supabase
      .from('workflow_nodes')
      .delete()
      .eq('workflow_template_id', templateId);

    if (deleteError) {
      logger.error('[Workflow Save] Error deleting existing nodes', {}, deleteError as Error);
      return NextResponse.json({
        error: 'Failed to clear existing workflow nodes'
      }, { status: 500 });
    }
    logger.debug('[Workflow Save] Existing nodes deleted successfully');

    // Insert new nodes
    const nodeInserts = nodes.map((node: Record<string, unknown>, index: number) => {
      const data = node.data as Record<string, unknown>;
      const position = node.position as Record<string, unknown>;
      const config = data.config as Record<string, unknown> | undefined;

      return {
        id: node.id,
        workflow_template_id: templateId,
        node_type: data.type,
        label: data.label,
        position_x: position.x,
        position_y: position.y,
        step_order: index,
        entity_id: config?.roleId || config?.approverRoleId || null,
        form_template_id: config?.formTemplateId || null,
        settings: {
          department_id: config?.departmentId,
          required_approvals: config?.requiredApprovals,
          allow_feedback: config?.allowFeedback,
          allow_send_back: config?.allowSendBack,
          allow_attachments: config?.allowAttachments,
          formFields: config?.formFields,
          formName: config?.formName,
          formDescription: config?.formDescription,
          isDraftForm: config?.isDraftForm,
          condition_type: config?.conditionType,
          conditions: config?.conditions,
          sourceFormFieldId: config?.sourceFormFieldId,
        },
      };
    });

    logger.debug('[Workflow Save] Inserting nodes', { count: nodeInserts.length });
    logger.debug('[Workflow Save] First node sample', { node: nodeInserts[0] });

    const { error: nodesError } = await supabase
      .from('workflow_nodes')
      .insert(nodeInserts);

    if (nodesError) {
      logger.error('[Workflow Save] Error inserting nodes', {}, nodesError as Error);
      logger.error('[Workflow Save] Node insert data', { nodeInserts });
      return NextResponse.json({
        error: 'Failed to save workflow nodes'
      }, { status: 500 });
    }
    logger.debug('[Workflow Save] Nodes inserted successfully');

    // Insert new connections/edges
    if (edges && Array.isArray(edges) && edges.length > 0) {
      const connectionInserts = edges.map((edge: any) => {
        const data = edge.data as Record<string, unknown> | undefined;

        return {
          workflow_template_id: templateId,
          from_node_id: edge.source,
          to_node_id: edge.target,
          condition: data || edge.sourceHandle ? {
            label: data?.label,
            conditionValue: data?.conditionValue,
            conditionType: data?.conditionType,
            decision: data?.decision,
            // Critical fields for form-based conditional routing
            sourceFormFieldId: data?.sourceFormFieldId,
            value: data?.value,
            value2: data?.value2,
            // Store sourceHandle for conditional branch edges
            sourceHandle: edge.sourceHandle,
          } : null,
        };
      });

      logger.debug('[Workflow Save] Inserting connections', { count: connectionInserts.length });
      logger.debug('[Workflow Save] First connection sample', { connection: connectionInserts[0] });

      const { error: connectionsError } = await supabase
        .from('workflow_connections')
        .insert(connectionInserts);

      if (connectionsError) {
        logger.error('[Workflow Save] Error inserting connections', {}, connectionsError as Error);
        logger.error('[Workflow Save] Connection insert data', { connectionInserts });
        return NextResponse.json({
          error: 'Failed to save workflow connections'
        }, { status: 500 });
      }
      logger.debug('[Workflow Save] Connections inserted successfully');
    }

    // Auto-deactivate workflow if it has no nodes (or only has nodes but no valid start/end)
    let isActive: boolean | undefined;
    if (nodes.length === 0) {
      logger.debug('[Workflow Save] No nodes - auto-deactivating workflow');
      const { error: deactivateError } = await supabase
        .from('workflow_templates')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', templateId);

      if (deactivateError) {
        logger.error('[Workflow Save] Error auto-deactivating workflow', {}, deactivateError as Error);
      } else {
        isActive = false;
      }
    }

    return NextResponse.json({
      success: true,
      message: nodes.length === 0
        ? 'Workflow saved (deactivated - no nodes)'
        : 'Workflow saved successfully',
      nodeCount: nodes.length,
      edgeCount: edges?.length || 0,
      is_active: isActive, // Include if it was auto-deactivated
    }, { status: 200 });
  } catch (error: unknown) {
logger.error('Error in PUT /api/admin/workflows/templates/[id]/steps', {}, error as Error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}
