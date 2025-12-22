import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';

/**
 * GET /api/workflows/steps/assignments
 * List all workflow nodes with their assignments for a workflow instance
 * Query params:
 *   - workflowInstanceId (required)
 *   - userId (optional) - if provided, includes eligibility info for this user
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

    const { searchParams } = new URL(request.url);
    const workflowInstanceId = searchParams.get('workflowInstanceId');
    const targetUserId = searchParams.get('userId'); // User we're checking eligibility for

    if (!workflowInstanceId) {
      return NextResponse.json({ error: 'workflowInstanceId is required' }, { status: 400 });
    }

    // Get the workflow instance to get its template_id
    const { data: instance, error: instanceError } = await supabase
      .from('workflow_instances')
      .select('workflow_template_id')
      .eq('id', workflowInstanceId)
      .single();

    if (instanceError || !instance) {
      return NextResponse.json({ error: 'Workflow instance not found' }, { status: 404 });
    }

    // Get all nodes for this workflow template (excluding start/end nodes)
    const { data: nodes, error: nodesError } = await supabase
      .from('workflow_nodes')
      .select('id, label, node_type, entity_id, position_y')
      .eq('workflow_template_id', instance.workflow_template_id)
      .not('node_type', 'in', '("start","end")')
      .order('position_y', { ascending: true });

    if (nodesError) {
      console.error('Error fetching workflow nodes:', nodesError);
      return NextResponse.json({ error: 'Failed to fetch workflow nodes' }, { status: 500 });
    }

    // Get role names for entity_ids (for role/approval/department nodes)
    const entityIds = (nodes || [])
      .map((n: any) => n.entity_id)
      .filter((id): id is string => id !== null);

    const roleNamesMap: Record<string, string> = {};
    const departmentNamesMap: Record<string, string> = {};

    if (entityIds.length > 0) {
      // Get role names
      const { data: roles } = await supabase
        .from('roles')
        .select('id, name')
        .in('id', entityIds);

      if (roles) {
        for (const role of roles) {
          roleNamesMap[role.id] = role.name;
        }
      }

      // Get department names (for department nodes)
      const { data: departments } = await supabase
        .from('departments')
        .select('id, name')
        .in('id', entityIds);

      if (departments) {
        for (const dept of departments) {
          departmentNamesMap[dept.id] = dept.name;
        }
      }
    }

    // If targetUserId is provided, get their roles for eligibility checking
    let targetUserRoleIds: string[] = [];
    let targetUserDepartmentIds: string[] = [];

    if (targetUserId) {
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role_id, roles(department_id)')
        .eq('user_id', targetUserId);

      if (userRoles) {
        targetUserRoleIds = userRoles.map((ur: any) => ur.role_id);
        targetUserDepartmentIds = userRoles
          .map((ur: any) => {
            const roles = ur.roles as Record<string, unknown> | Record<string, unknown>[];
            const role = Array.isArray(roles) ? roles[0] : roles;
            return role?.department_id;
          })
          .filter((id): id is string => id !== null);
      }
    }

    // Get all assignments for this workflow instance
    const { data: assignments, error: assignmentsError } = await supabase
      .from('workflow_node_assignments')
      .select(`
        id,
        node_id,
        user_id,
        assigned_at,
        assigned_by,
        user_profiles!workflow_node_assignments_user_id_fkey(
          id,
          name,
          email
        )
      `)
      .eq('workflow_instance_id', workflowInstanceId);

    if (assignmentsError) {
      console.error('Error fetching node assignments:', assignmentsError);
      return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 });
    }

    // Build a map of node_id -> assignments
    const assignmentsByNode: Record<string, Record<string, unknown>[]> = {};
    for (const assignment of assignments || []) {
      if (!assignmentsByNode[assignment.node_id]) {
        assignmentsByNode[assignment.node_id] = [];
      }
      assignmentsByNode[assignment.node_id].push(assignment);
    }

    // Enrich nodes with their assignments and eligibility info
    const nodesWithAssignments = (nodes || []).map((node: any) => {
      // Determine required entity name based on node type
      let requiredEntityName: string | null = null;
      let userEligible = true; // Default to eligible if no entity_id

      if (node.entity_id) {
        if (node.node_type === 'role' || node.node_type === 'approval') {
          requiredEntityName = roleNamesMap[node.entity_id] || null;
          // Check if target user has this role
          if (targetUserId) {
            userEligible = targetUserRoleIds.includes(node.entity_id);
          }
        } else if (node.node_type === 'department') {
          requiredEntityName = departmentNamesMap[node.entity_id] || null;
          // Check if target user is in this department
          if (targetUserId) {
            userEligible = targetUserDepartmentIds.includes(node.entity_id);
          }
        }
      }

      // Check if user is already assigned to this node
      const existingAssignments = assignmentsByNode[node.id] || [];
      const userAlreadyAssigned = targetUserId
        ? existingAssignments.some((a: any) => a.user_id === targetUserId)
        : false;

      return {
        ...node,
        assignments: existingAssignments,
        required_entity_name: requiredEntityName,
        user_eligible: userEligible,
        user_already_assigned: userAlreadyAssigned,
      };
    });

    return NextResponse.json({
      success: true,
      nodes: nodesWithAssignments,
    });
  } catch (error: unknown) {
    console.error('Error in GET /api/workflows/steps/assignments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/workflows/steps/assignments
 * Assign a user to a workflow node
 * Body: { workflowInstanceId, nodeId, userId }
 */
export async function POST(request: NextRequest) {
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

    const { workflowInstanceId, nodeId, userId } = await request.json();

    if (!workflowInstanceId || !nodeId || !userId) {
      return NextResponse.json(
        { error: 'workflowInstanceId, nodeId, and userId are required' },
        { status: 400 }
      );
    }

    // Check if user has permission to assign (must be project creator or superadmin)
    const { data: currentUserProfile } = await supabase
      .from('user_profiles')
      .select('is_superadmin')
      .eq('id', (user as any).id)
      .single();

    const isSuperadmin = currentUserProfile?.is_superadmin === true;

    if (!isSuperadmin) {
      // Get the workflow instance and check if user is project creator
      const { data: instance } = await supabase
        .from('workflow_instances')
        .select(`
          project_id,
          projects!inner(created_by)
        `)
        .eq('id', workflowInstanceId)
        .single();

      if (!instance) {
        return NextResponse.json({ error: 'Workflow instance not found' }, { status: 404 });
      }

      const projects = instance.projects as Record<string, unknown> | Record<string, unknown>[];
      const project = Array.isArray(projects) ? projects[0] : projects;
      const projectCreatedBy = project?.created_by;
      if (projectCreatedBy !== (user as any).id) {
        return NextResponse.json(
          { error: 'Only the project creator or superadmins can assign users to workflow nodes' },
          { status: 403 }
        );
      }
    }

    // Check if assignment already exists
    const { data: existingAssignment } = await supabase
      .from('workflow_node_assignments')
      .select('id')
      .eq('workflow_instance_id', workflowInstanceId)
      .eq('node_id', nodeId)
      .eq('user_id', userId)
      .single();

    if (existingAssignment) {
      return NextResponse.json(
        { error: 'User is already assigned to this node' },
        { status: 409 }
      );
    }

    // Create the assignment
    const { data: assignment, error } = await supabase
      .from('workflow_node_assignments')
      .insert({
        workflow_instance_id: workflowInstanceId,
        node_id: nodeId,
        user_id: userId,
        assigned_by: (user as any).id,
      })
      .select(`
        id,
        node_id,
        user_id,
        assigned_at,
        user_profiles!workflow_node_assignments_user_id_fkey(
          id,
          name,
          email
        )
      `)
      .single();

    if (error) {
      console.error('Error creating node assignment:', error);
      return NextResponse.json({ error: 'Failed to create assignment' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      assignment,
    });
  } catch (error: unknown) {
    console.error('Error in POST /api/workflows/steps/assignments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/workflows/steps/assignments
 * Remove a user from a workflow node
 * Query params: workflowInstanceId, nodeId, userId
 */
export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const workflowInstanceId = searchParams.get('workflowInstanceId');
    const nodeId = searchParams.get('nodeId');
    const userId = searchParams.get('userId');

    if (!workflowInstanceId || !nodeId || !userId) {
      return NextResponse.json(
        { error: 'workflowInstanceId, nodeId, and userId are required' },
        { status: 400 }
      );
    }

    // Check if user has permission to remove assignment
    const { data: currentUserProfile } = await supabase
      .from('user_profiles')
      .select('is_superadmin')
      .eq('id', (user as any).id)
      .single();

    const isSuperadmin = currentUserProfile?.is_superadmin === true;

    if (!isSuperadmin) {
      // Get the workflow instance and check if user is project creator
      const { data: instance } = await supabase
        .from('workflow_instances')
        .select(`
          project_id,
          projects!inner(created_by)
        `)
        .eq('id', workflowInstanceId)
        .single();

      if (!instance) {
        return NextResponse.json({ error: 'Workflow instance not found' }, { status: 404 });
      }

      const projects = instance.projects as Record<string, unknown> | Record<string, unknown>[];
      const project = Array.isArray(projects) ? projects[0] : projects;
      const projectCreatedBy = project?.created_by;
      if (projectCreatedBy !== (user as any).id) {
        return NextResponse.json(
          { error: 'Only the project creator or superadmins can remove users from workflow nodes' },
          { status: 403 }
        );
      }
    }

    // Delete the assignment
    const { error } = await supabase
      .from('workflow_node_assignments')
      .delete()
      .eq('workflow_instance_id', workflowInstanceId)
      .eq('node_id', nodeId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting node assignment:', error);
      return NextResponse.json({ error: 'Failed to delete assignment' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error: unknown) {
    console.error('Error in DELETE /api/workflows/steps/assignments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
