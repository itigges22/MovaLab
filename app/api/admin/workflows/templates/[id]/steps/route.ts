import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';
import { hasPermission } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';

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

    // Check authentication
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
          role_id,
          roles (
            id,
            name,
            permissions,
            department_id,
            is_system_role
          )
        )
      `)
      .eq('id', user.id)
      .single();

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Check VIEW_WORKFLOWS permission
    const canView = await hasPermission(userProfile, Permission.VIEW_WORKFLOWS, undefined, supabase);
    if (!canView) {
      return NextResponse.json({ error: 'Insufficient permissions to view workflows' }, { status: 403 });
    }

    const templateId = id;

    // Get workflow nodes
    const { data: nodes, error: nodesError } = await supabase
      .from('workflow_nodes')
      .select('*')
      .eq('workflow_template_id', templateId);

    if (nodesError) {
      console.error('Error fetching workflow nodes:', nodesError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch workflow nodes' },
        { status: 500 }
      );
    }

    // Get workflow connections
    const { data: connections, error: connectionsError } = await supabase
      .from('workflow_connections')
      .select('*')
      .eq('workflow_template_id', templateId);

    if (connectionsError) {
      console.error('Error fetching workflow connections:', connectionsError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch workflow connections' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      nodes: nodes || [],
      connections: connections || [],
    });
  } catch (error) {
    console.error('Error in GET /api/admin/workflows/templates/[id]/steps:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const supabase = createApiSupabaseClient(request);
    if (!supabase) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    // Check authentication
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
          role_id,
          roles (
            id,
            name,
            permissions,
            department_id,
            is_system_role
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

    const templateId = id;
    const { nodes, edges } = await request.json();

    // Fetch existing node IDs from database BEFORE deleting
    // This allows us to distinguish between database UUIDs and new React Flow UUIDs
    const { data: existingNodes, error: fetchNodesError } = await supabase
      .from('workflow_nodes')
      .select('id')
      .eq('workflow_template_id', templateId);

    if (fetchNodesError) {
      console.error('Error fetching existing nodes:', fetchNodesError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch existing nodes' },
        { status: 500 }
      );
    }

    // Create a Set of existing database UUIDs for fast lookup
    const existingNodeIds = new Set((existingNodes || []).map(n => n.id));
    console.log('=== Existing node IDs from database:', Array.from(existingNodeIds));

    // First, check if there are any workflow instances using this template
    const { data: instances, error: instancesError } = await supabase
      .from('workflow_instances')
      .select('id, current_node_id')
      .eq('workflow_template_id', templateId);

    if (instancesError) {
      console.error('Error checking workflow instances:', instancesError);
      return NextResponse.json(
        { success: false, error: 'Failed to check workflow instances' },
        { status: 500 }
      );
    }

    // If there are instances with current_node_id set, update them to NULL
    // This prevents foreign key constraint errors when deleting nodes
    if (instances && instances.length > 0) {
      const instancesWithNodes = instances.filter(i => i.current_node_id !== null);
      if (instancesWithNodes.length > 0) {
        const { error: updateError } = await supabase
          .from('workflow_instances')
          .update({ current_node_id: null })
          .in('id', instancesWithNodes.map(i => i.id));

        if (updateError) {
          console.error('Error updating workflow instances:', updateError);
          return NextResponse.json(
            { success: false, error: 'Failed to prepare workflow instances for update' },
            { status: 500 }
          );
        }
      }

      // Delete workflow_history records that reference nodes from this template
      // We delete them entirely since the workflow structure is being rebuilt
      // This avoids violating the NOT NULL constraint on to_node_id
      const { error: deleteHistoryError } = await supabase
        .from('workflow_history')
        .delete()
        .in('workflow_instance_id', instances.map(i => i.id));

      if (deleteHistoryError) {
        console.error('Error deleting workflow history:', deleteHistoryError);
        return NextResponse.json(
          { success: false, error: 'Failed to prepare workflow history for update' },
          { status: 500 }
        );
      }
    }

    // Delete existing nodes and connections for this template
    const { error: deleteNodesError } = await supabase
      .from('workflow_nodes')
      .delete()
      .eq('workflow_template_id', templateId);

    if (deleteNodesError) {
      console.error('Error deleting existing nodes:', deleteNodesError);
      return NextResponse.json(
        { success: false, error: 'Failed to delete existing nodes' },
        { status: 500 }
      );
    }

    const { error: deleteConnectionsError } = await supabase
      .from('workflow_connections')
      .delete()
      .eq('workflow_template_id', templateId);

    if (deleteConnectionsError) {
      console.error('Error deleting existing connections:', deleteConnectionsError);
      return NextResponse.json(
        { success: false, error: 'Failed to delete existing connections' },
        { status: 500 }
      );
    }

    // Transform React Flow nodes to workflow_nodes
    const workflowNodes = nodes.map((node: any) => {
      // Always include id field:
      // - For existing nodes, preserve the database UUID
      // - For new nodes, generate a new UUID in JavaScript
      // This ensures all objects in the bulk insert have the same shape
      const workflowNode: any = {
        id: existingNodeIds.has(node.id) ? node.id : crypto.randomUUID(),
        workflow_template_id: templateId,
        node_type: node.data.type,
        position_x: node.position.x,
        position_y: node.position.y,
        label: node.data.label,
        settings: {},
      };

      // Log what we're doing
      if (existingNodeIds.has(node.id)) {
        console.log(`Preserving database UUID: ${node.id} (${node.data.label})`);
      } else {
        console.log(`New node - generated UUID: ${workflowNode.id} (${node.data.label})`);
      }

      // Add entity_id and settings based on node type
      if (node.data.config) {
        if (node.data.type === 'department') {
          workflowNode.settings = { department_id: node.data.config.departmentId };
        } else if (node.data.type === 'role') {
          workflowNode.entity_id = node.data.config.roleId || null;
        } else if (node.data.type === 'approval') {
          workflowNode.entity_id = node.data.config.approverRoleId || null;
          workflowNode.settings = {
            required_approvals: node.data.config.requiredApprovals || 1,
            allow_feedback: node.data.config.allowFeedback !== undefined ? node.data.config.allowFeedback : true,
            allow_send_back: node.data.config.allowSendBack !== undefined ? node.data.config.allowSendBack : true,
          };
        } else if (node.data.type === 'form') {
          workflowNode.settings = {
            formFields: node.data.config.formFields || [],
            formName: node.data.config.formName || '',
            formDescription: node.data.config.formDescription || '',
            isDraftForm: node.data.config.isDraftForm || false,
          };
        } else if (node.data.type === 'conditional') {
          workflowNode.settings = {
            condition_type: node.data.config.conditionType || 'approval_decision',
            conditions: node.data.config.conditions || [],
          };
        }
      }

      return workflowNode;
    });

    // Debug logging - log the nodes being inserted
    console.log('=== DEBUG: Attempting to insert workflow nodes ===');
    console.log('Number of nodes:', workflowNodes.length);
    console.log('Template ID:', templateId);
    workflowNodes.forEach((node: any, index: number) => {
      console.log(`Node ${index}:`, {
        id: node.id,
        id_type: typeof node.id,
        workflow_template_id: node.workflow_template_id,
        node_type: node.node_type,
        position_x: node.position_x,
        position_x_type: typeof node.position_x,
        position_y: node.position_y,
        position_y_type: typeof node.position_y,
        label: node.label,
        entity_id: node.entity_id,
        settings_keys: Object.keys(node.settings || {}),
      });
    });

    // Insert new nodes
    const { data: insertedNodes, error: insertNodesError } = await supabase
      .from('workflow_nodes')
      .insert(workflowNodes)
      .select();

    if (insertNodesError) {
      console.error('=== ERROR: Failed to insert workflow nodes ===');
      console.error('Error code:', insertNodesError.code);
      console.error('Error message:', insertNodesError.message);
      console.error('Error details:', insertNodesError.details);
      console.error('Error hint:', insertNodesError.hint);
      console.error('Full error object:', JSON.stringify(insertNodesError, null, 2));
      console.error('Failed nodes data:', JSON.stringify(workflowNodes, null, 2));

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to save workflow nodes',
          details: insertNodesError.message,
          hint: insertNodesError.hint,
        },
        { status: 500 }
      );
    }

    console.log('=== SUCCESS: Nodes inserted successfully ===');
    console.log('Inserted nodes count:', insertedNodes?.length || 0);

    // Create mapping from React Flow node IDs to database UUIDs
    // We need to match by position since the database doesn't store the React Flow ID
    const idMapping: Record<string, string> = {};
    nodes.forEach((reactFlowNode: any, index: number) => {
      if (insertedNodes && insertedNodes[index]) {
        idMapping[reactFlowNode.id] = insertedNodes[index].id;
        console.log(`Mapping: ${reactFlowNode.id} -> ${insertedNodes[index].id}`);
      }
    });

    // Transform React Flow edges to workflow_connections, mapping IDs
    const workflowConnections = edges.map((edge: any) => {
      const connection: any = {
        workflow_template_id: templateId,
        from_node_id: idMapping[edge.source] || edge.source,
        to_node_id: idMapping[edge.target] || edge.target,
      };

      // If edge has data (for decision-based routing), save it
      if (edge.data) {
        connection.condition = {
          label: edge.data.label,
          conditionValue: edge.data.conditionValue,
          conditionType: edge.data.conditionType,
          decision: edge.data.decision,  // For approval node routing
        };
      }

      console.log(`Connection: ${edge.source} -> ${edge.target} mapped to ${connection.from_node_id} -> ${connection.to_node_id}`);

      return connection;
    });

    // Insert new connections
    if (workflowConnections.length > 0) {
      const { error: insertConnectionsError } = await supabase
        .from('workflow_connections')
        .insert(workflowConnections);

      if (insertConnectionsError) {
        console.error('Error inserting workflow connections:', insertConnectionsError);
        return NextResponse.json(
          { success: false, error: 'Failed to save workflow connections' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      nodes: insertedNodes,
    });
  } catch (error) {
    console.error('Error in PUT /api/admin/workflows/templates/[id]/steps:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
