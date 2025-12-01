/**
 * Workflow Execution Service
 * Handles starting, progressing, and managing workflow instances
 *
 * IMPORTANT: All functions now accept a Supabase client as a parameter
 * to maintain authentication context from API routes
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface WorkflowNode {
  id: string;
  workflow_template_id: string;
  node_type: 'start' | 'department' | 'role' | 'approval' | 'form' | 'conditional' | 'end';
  entity_id: string | null;
  label: string;
  settings: any;
  form_template_id: string | null;
}

export interface WorkflowConnection {
  id: string;
  from_node_id: string;
  to_node_id: string;
  condition: any;
}

export interface WorkflowInstance {
  id: string;
  workflow_template_id: string;
  project_id: string | null;
  task_id: string | null;
  current_node_id: string | null;
  status: 'active' | 'completed' | 'cancelled';
  started_at: string;
  completed_at: string | null;
}

/**
 * Start a new workflow instance for a project
 */
export async function startWorkflowForProject(
  supabase: SupabaseClient,
  projectId: string,
  workflowTemplateId: string,
  startedBy: string
): Promise<{ success: boolean; workflowInstanceId?: string; error?: string }> {
  if (!supabase) {
    return { success: false, error: 'Database connection failed' };
  }

  try {
    // Validate workflowTemplateId
    if (!workflowTemplateId || workflowTemplateId === '' || workflowTemplateId === 'undefined') {
      console.error('Invalid workflow template ID:', workflowTemplateId);
      return { success: false, error: 'Invalid workflow template ID' };
    }

    // Get workflow nodes and find the start node
    const { data: nodes, error: nodesError } = await supabase
      .from('workflow_nodes')
      .select('*')
      .eq('workflow_template_id', workflowTemplateId)
      .order('position_y');

    console.log('Workflow nodes query result:', {
      templateId: workflowTemplateId,
      nodesCount: nodes?.length || 0,
      error: nodesError?.message || null
    });

    if (nodesError) {
      console.error('Error loading workflow nodes:', nodesError);
      return { success: false, error: `Failed to load workflow nodes: ${nodesError.message}` };
    }

    if (!nodes || nodes.length === 0) {
      console.error('No workflow nodes found for template:', workflowTemplateId);
      return { success: false, error: 'No workflow nodes found for this template' };
    }

    // Find start node or first node
    const startNode = nodes.find((n: any) => n.node_type === 'start') || nodes[0];

    // Get connections to find next node after start
    const { data: connections } = await supabase
      .from('workflow_connections')
      .select('*')
      .eq('workflow_template_id', workflowTemplateId);

    const nextNode = findNextNode(startNode.id, connections, nodes);

    // Create workflow instance
    const { data: instance, error: instanceError } = await supabase
      .from('workflow_instances')
      .insert({
        workflow_template_id: workflowTemplateId,
        project_id: projectId,
        current_node_id: nextNode?.id || startNode.id,
        status: 'active',
      })
      .select()
      .single();

    if (instanceError || !instance) {
      return { success: false, error: 'Failed to create workflow instance' };
    }

    // Update project with workflow instance
    const { error: projectUpdateError } = await supabase
      .from('projects')
      .update({ workflow_instance_id: instance.id })
      .eq('id', projectId);

    if (projectUpdateError) {
      console.error('Failed to link workflow to project:', projectUpdateError);
      // Don't fail the whole operation - workflow instance was created successfully
      // The link can be established via workflow_instances.project_id
    } else {
      console.log('Successfully linked workflow instance to project:', {
        projectId,
        workflowInstanceId: instance.id
      });
    }

    // Create initial workflow history entry
    await supabase.from('workflow_history').insert({
      workflow_instance_id: instance.id,
      from_node_id: startNode.id,
      to_node_id: nextNode?.id || startNode.id,
      handed_off_by: startedBy,
      notes: 'Workflow started',
    });

    // Assign project to appropriate user based on node type
    if (nextNode) {
      await assignProjectToNode(supabase, projectId, nextNode, startedBy);
    }

    return { success: true, workflowInstanceId: instance.id };
  } catch (error) {
    console.error('Error starting workflow:', error);
    return { success: false, error: 'Internal server error' };
  }
}

/**
 * Check if a user has a specific role
 */
async function userHasRole(supabase: SupabaseClient, userId: string, roleId: string): Promise<boolean> {
  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('role_id')
    .eq('user_id', userId)
    .eq('role_id', roleId);

  return (userRoles?.length || 0) > 0;
}

/**
 * Check if a user is assigned to a project via project_assignments
 * NOTE: created_by and assigned_user_id on the project do NOT grant workflow progression rights
 * Only explicit project_assignments (created by workflow progression) count
 */
async function isUserAssignedToProject(supabase: SupabaseClient, userId: string, projectId: string): Promise<boolean> {
  // Only check project_assignments table - this is populated by workflow progression
  const { data: assignments } = await supabase
    .from('project_assignments')
    .select('id')
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .is('removed_at', null);

  return (assignments?.length || 0) > 0;
}

/**
 * Check if user is superadmin (bypasses role checks)
 */
async function isUserSuperadmin(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data: user } = await supabase
    .from('users')
    .select('is_superadmin')
    .eq('id', userId)
    .single();

  if (user?.is_superadmin) return true;

  // Also check if user has a Superadmin role
  const { data: superadminRole } = await supabase
    .from('roles')
    .select('id')
    .ilike('name', 'superadmin')
    .single();

  if (superadminRole) {
    return await userHasRole(supabase, userId, superadminRole.id);
  }

  return false;
}

/**
 * Progress workflow to next step
 */
export async function progressWorkflow(
  supabase: SupabaseClient,
  workflowInstanceId: string,
  currentUserId: string,
  decision?: 'approved' | 'rejected',
  feedback?: string,
  formResponseId?: string,
  assignedUserId?: string,
  inlineFormData?: Record<string, any>
): Promise<{ success: boolean; nextNode?: any; error?: string }> {
  if (!supabase) {
    return { success: false, error: 'Database connection failed' };
  }

  try {
    // Get current workflow instance
    const { data: instance, error: instanceError } = await supabase
      .from('workflow_instances')
      .select('*, workflow_templates(*)')
      .eq('id', workflowInstanceId)
      .single();

    if (instanceError || !instance) {
      return { success: false, error: 'Workflow instance not found' };
    }

    // Get all nodes and connections
    const { data: nodes } = await supabase
      .from('workflow_nodes')
      .select('*')
      .eq('workflow_template_id', instance.workflow_template_id);

    const { data: connections } = await supabase
      .from('workflow_connections')
      .select('*')
      .eq('workflow_template_id', instance.workflow_template_id);

    const currentNode = nodes?.find((n: any) => n.id === instance.current_node_id);
    if (!currentNode) {
      return { success: false, error: 'Current node not found' };
    }

    // AUTHORIZATION: Check if user can progress this workflow step
    // Superadmins bypass all checks
    const isSuperadmin = await isUserSuperadmin(supabase, currentUserId);

    if (!isSuperadmin) {
      // 1. PROJECT ASSIGNMENT CHECK: User must be assigned to the project
      if (instance.project_id) {
        const isAssigned = await isUserAssignedToProject(supabase, currentUserId, instance.project_id);
        if (!isAssigned) {
          return {
            success: false,
            error: 'You must be assigned to this project to advance the workflow'
          };
        }
      }

      // 2. ENTITY VALIDATION: Check based on node type
      if (currentNode.entity_id) {
        if (currentNode.node_type === 'role' || currentNode.node_type === 'approval') {
          // For role and approval nodes, entity_id is a role_id
          const hasRequiredRole = await userHasRole(supabase, currentUserId, currentNode.entity_id);

          if (!hasRequiredRole) {
            // Get the role name for a better error message
            const { data: requiredRole } = await supabase
              .from('roles')
              .select('name')
              .eq('id', currentNode.entity_id)
              .single();

            const roleName = requiredRole?.name || 'the required role';
            return {
              success: false,
              error: `Only users with the "${roleName}" role can advance this workflow step`
            };
          }
        } else if (currentNode.node_type === 'department') {
          // For department nodes, entity_id is a department_id
          // Check if user has any role in this department
          const { data: userDeptRoles } = await supabase
            .from('user_roles')
            .select('roles!inner(department_id)')
            .eq('user_id', currentUserId)
            .eq('roles.department_id', currentNode.entity_id);

          if (!userDeptRoles || userDeptRoles.length === 0) {
            // Get department name for error message
            const { data: dept } = await supabase
              .from('departments')
              .select('name')
              .eq('id', currentNode.entity_id)
              .single();

            const deptName = dept?.name || 'the required department';
            return {
              success: false,
              error: `Only users in the "${deptName}" department can advance this workflow step`
            };
          }
        }
        // For form, conditional, start, end nodes - no entity validation needed
      }
    }

    // Determine next node based on node type and decision
    let nextNode;
    if (currentNode.node_type === 'conditional') {
      // Legacy support for existing workflows with conditional nodes
      nextNode = findConditionalNextNode(currentNode, decision, connections, nodes);
    } else if (currentNode.node_type === 'approval' && decision) {
      // Approval nodes can have multiple outgoing paths based on decision
      nextNode = findDecisionBasedNextNode(currentNode, decision, connections, nodes);
    } else {
      nextNode = findNextNode(currentNode.id, connections, nodes);
    }

    // If approval node, record the approval
    if (currentNode.node_type === 'approval' && decision) {
      await supabase.from('workflow_approvals').insert({
        workflow_instance_id: workflowInstanceId,
        node_id: currentNode.id,
        approver_user_id: currentUserId,
        decision,
        feedback,
      });
    }

    // Update workflow instance
    let isComplete = !nextNode || nextNode.node_type === 'end';
    await supabase
      .from('workflow_instances')
      .update({
        current_node_id: nextNode?.id || null,
        status: isComplete ? 'completed' : 'active',
        completed_at: isComplete ? new Date().toISOString() : null,
      })
      .eq('id', workflowInstanceId);

    // AUTO-ADVANCE: If we landed on a conditional node, immediately route through it
    // This makes conditional nodes invisible to users - they just see the destination
    if (nextNode?.node_type === 'conditional' && decision) {
      const conditionalNode = nextNode; // Save reference to conditional node
      const finalNode = findConditionalNextNode(conditionalNode, decision, connections, nodes);

      if (finalNode) {
        // Update to final destination, skipping the conditional
        isComplete = finalNode.node_type === 'end';
        await supabase
          .from('workflow_instances')
          .update({
            current_node_id: finalNode.id,
            status: isComplete ? 'completed' : 'active',
            completed_at: isComplete ? new Date().toISOString() : null,
          })
          .eq('id', workflowInstanceId);

        // Add history entry for conditional auto-advance
        await supabase.from('workflow_history').insert({
          workflow_instance_id: workflowInstanceId,
          from_node_id: conditionalNode.id,
          to_node_id: finalNode.id,
          handed_off_by: currentUserId,
          notes: `Auto-routed based on decision: ${decision}`,
        });

        // Update nextNode for subsequent processing (assignments, completion)
        nextNode = finalNode;
      }
    }

    // Add current user to project_contributors (they participated in this workflow step)
    if (instance.project_id) {
      await supabase
        .from('project_contributors')
        .upsert({
          project_id: instance.project_id,
          user_id: currentUserId,
          contribution_type: 'workflow',
          last_contributed_at: new Date().toISOString(),
        }, { onConflict: 'project_id,user_id' });
    }

    // Create workflow history entry
    // If inline form data is provided (from workflow builder forms), store it in the notes field as JSON
    const notesContent = inlineFormData
      ? JSON.stringify({ type: 'inline_form', data: inlineFormData })
      : null;

    await supabase.from('workflow_history').insert({
      workflow_instance_id: workflowInstanceId,
      from_node_id: currentNode.id,
      to_node_id: nextNode?.id || null,
      handed_off_by: currentUserId,
      approval_decision: decision,
      approval_feedback: feedback,
      form_response_id: formResponseId,
      notes: notesContent,
    });

    // AUTO-CREATE PROJECT ISSUE ON REJECTION
    // When a workflow step is rejected, automatically create a project issue
    // to track the rejection reason and ensure it's visible in the project's Issues tab
    if (decision === 'rejected' && instance.project_id) {
      const issueContent = `**Workflow Rejected**: ${currentNode.label}\n\n` +
        `Workflow: ${instance.workflow_templates?.name || 'Unknown'}\n` +
        `Reason: ${feedback || 'No reason provided'}`;

      await supabase.from('project_issues').insert({
        project_id: instance.project_id,
        content: issueContent,
        status: 'open',
        created_by: currentUserId,
      });
    }

    // AUTO-CREATE PROJECT UPDATE ON ALL PROGRESSIONS
    // Document every workflow step transition in the project's Updates tab
    // This provides a visible timeline of project progress
    if (instance.project_id) {
      let updateContent = '';

      if (decision === 'approved') {
        updateContent = `**Approved**: ${currentNode.label} → ${nextNode?.label || 'Complete'}` +
          (feedback ? `\nNotes: ${feedback}` : '');
      } else if (decision === 'rejected') {
        updateContent = `**Rejected**: ${currentNode.label}\n` +
          `Reason: ${feedback || 'No reason provided'}`;
      } else {
        updateContent = `**Progressed**: ${currentNode.label} → ${nextNode?.label || 'Complete'}`;
      }

      await supabase.from('project_updates').insert({
        project_id: instance.project_id,
        content: updateContent,
        created_by: currentUserId,
      });
    }

    // Handle workflow completion or progression
    if (isComplete && instance.project_id) {
      // Workflow reached end - mark project as completed
      await completeProject(supabase, instance.project_id);
    } else if (nextNode && instance.project_id) {
      // Assign to next node's user (use assignedUserId if provided, otherwise assign to all users in role)
      await assignProjectToNode(supabase, instance.project_id, nextNode, currentUserId, assignedUserId);
    }

    return { success: true, nextNode };
  } catch (error) {
    console.error('Error progressing workflow:', error);
    return { success: false, error: 'Internal server error' };
  }
}

/**
 * Find next node in workflow
 */
function findNextNode(
  currentNodeId: string,
  connections: any[] | null,
  nodes: any[] | null
): any | null {
  if (!connections || !nodes) return null;

  const connection = connections.find((c) => c.from_node_id === currentNodeId);
  if (!connection) return null;

  return nodes.find((n) => n.id === connection.to_node_id);
}

/**
 * Find next node for conditional routing (legacy support)
 */
function findConditionalNextNode(
  conditionalNode: any,
  decision: string | undefined,
  connections: any[] | null,
  nodes: any[] | null
): any | null {
  if (!connections || !nodes || !decision) {
    return findNextNode(conditionalNode.id, connections, nodes);
  }

  // Find connection that matches the decision
  // Check both condition.decision AND condition.conditionValue for compatibility
  // (database stores conditionValue, but some code may use decision)
  const matchingConnection = connections.find(
    (c) =>
      c.from_node_id === conditionalNode.id &&
      (c.condition?.decision === decision || c.condition?.conditionValue === decision)
  );

  if (!matchingConnection) {
    // Fall back to default path
    return findNextNode(conditionalNode.id, connections, nodes);
  }

  return nodes.find((n) => n.id === matchingConnection.to_node_id);
}

/**
 * Find next node for approval nodes with decision-based routing
 * This is the new pattern where approval nodes directly have multiple outgoing edges
 */
function findDecisionBasedNextNode(
  approvalNode: any,
  decision: string,
  connections: any[] | null,
  nodes: any[] | null
): any | null {
  if (!connections || !nodes) {
    return null;
  }

  // Find connection from this approval node with matching decision
  // Check both condition.decision and condition.conditionValue for compatibility
  const matchingConnection = connections.find(
    (c) =>
      c.from_node_id === approvalNode.id &&
      (c.condition?.decision === decision || c.condition?.conditionValue === decision)
  );

  if (matchingConnection) {
    return nodes.find((n) => n.id === matchingConnection.to_node_id) || null;
  }

  // Fall back to default path (connection without decision label)
  const defaultConnection = connections.find(
    (c) =>
      c.from_node_id === approvalNode.id &&
      !c.condition?.decision &&
      !c.condition?.conditionValue
  );

  if (defaultConnection) {
    return nodes.find((n) => n.id === defaultConnection.to_node_id) || null;
  }

  // If no matching or default path, just follow the first connection
  return findNextNode(approvalNode.id, connections, nodes);
}

/**
 * Assign project to user(s) based on workflow node
 * Also handles removing previous assignments (except project creator)
 */
async function assignProjectToNode(
  supabase: SupabaseClient,
  projectId: string,
  node: any,
  assignedBy: string,
  specificUserId?: string
): Promise<void> {
  if (!supabase) return;

  try {
    // Get project creator to preserve their access
    const { data: project } = await supabase
      .from('projects')
      .select('account_id, created_by')
      .eq('id', projectId)
      .single();

    const creatorId = project?.created_by;

    // Mark all current assignments as removed (except for the project creator)
    // This ensures previous workflow step users lose active access
    await supabase
      .from('project_assignments')
      .update({ removed_at: new Date().toISOString() })
      .eq('project_id', projectId)
      .is('removed_at', null)
      .neq('user_id', creatorId || '00000000-0000-0000-0000-000000000000');

    // Get users for the role/entity
    let userIds: string[] = [];

    // If a specific user was assigned, use only that user
    if (specificUserId) {
      userIds = [specificUserId];
    } else if (node.entity_id) {
      // Otherwise, get all users with this role
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role_id', node.entity_id);

      userIds = userRoles?.map((ur: any) => ur.user_id) || [];
    }

    // Create project assignments for each user (including re-adding creator if needed)
    if (userIds.length > 0) {
      // Also ensure creator keeps active assignment
      if (creatorId && !userIds.includes(creatorId)) {
        userIds.push(creatorId);
      }

      for (const userId of userIds) {
        // Try to update existing removed assignment first, otherwise insert new
        const { data: existing } = await supabase
          .from('project_assignments')
          .select('id')
          .eq('project_id', projectId)
          .eq('user_id', userId)
          .single();

        if (existing) {
          // Reactivate existing assignment
          await supabase
            .from('project_assignments')
            .update({
              removed_at: null,
              role_in_project: userId === creatorId ? 'creator' : node.node_type,
              assigned_by: assignedBy
            })
            .eq('id', existing.id);
        } else {
          // Insert new assignment
          await supabase.from('project_assignments').insert({
            project_id: projectId,
            user_id: userId,
            role_in_project: userId === creatorId ? 'creator' : node.node_type,
            assigned_by: assignedBy,
          });
        }

        // Add to project_contributors for time tracking history
        await supabase
          .from('project_contributors')
          .upsert({
            project_id: projectId,
            user_id: userId,
            contribution_type: 'workflow',
            last_contributed_at: new Date().toISOString(),
          }, { onConflict: 'project_id,user_id' });
      }

      // Grant account access if needed
      if (project) {
        const accountMembers = userIds.map((userId) => ({
          user_id: userId,
          account_id: project.account_id,
        }));

        // Insert account members (ignore duplicates)
        await supabase
          .from('account_members')
          .upsert(accountMembers, { onConflict: 'user_id,account_id', ignoreDuplicates: true });
      }
    }
  } catch (error) {
    console.error('Error assigning project to node:', error);
  }
}

/**
 * Mark project as completed - removes from all active dashboards
 */
async function completeProject(
  supabase: SupabaseClient,
  projectId: string
): Promise<void> {
  if (!supabase) return;

  try {
    // Update project status and completion timestamp
    await supabase
      .from('projects')
      .update({
        status: 'complete',
        completed_at: new Date().toISOString()
      })
      .eq('id', projectId);

    // Mark all project assignments as removed
    // Everyone loses active access when project is complete
    await supabase
      .from('project_assignments')
      .update({ removed_at: new Date().toISOString() })
      .eq('project_id', projectId)
      .is('removed_at', null);

    console.log('Project completed and removed from all active dashboards:', projectId);
  } catch (error) {
    console.error('Error completing project:', error);
  }
}

/**
 * Get user's pending workflow tasks (approvals and forms)
 * Note: Function name kept as "getUserPendingApprovals" for backwards compatibility,
 * but now returns both approval nodes AND form nodes
 */
export async function getUserPendingApprovals(supabase: SupabaseClient, userId: string): Promise<any[]> {
  if (!supabase) return [];

  try {
    // Get user's roles
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role_id')
      .eq('user_id', userId);

    const roleIds = userRoles?.map((ur) => ur.role_id) || [];
    if (roleIds.length === 0) return [];

    // Get active workflow instances with their current nodes
    // Note: PostgREST doesn't support nested filtering well, so we fetch all and filter in JS
    // Use explicit relationship hint to resolve ambiguity between the two FK relationships
    const { data: instances, error } = await supabase
      .from('workflow_instances')
      .select(`
        *,
        workflow_nodes!workflow_instances_current_node_id_fkey(*),
        projects!workflow_instances_project_id_fkey(*)
      `)
      .eq('status', 'active');

    if (error) {
      console.error('Error querying workflow instances:', error);
      return [];
    }

    // Filter to only approval/form nodes where the user has the required role
    const filteredInstances = (instances || []).filter((instance: any) => {
      const node = instance.workflow_nodes;
      if (!node) return false;

      // Check if node is approval or form type
      if (!['approval', 'form'].includes(node.node_type)) return false;

      // Check if user has the required role for this node
      if (!node.entity_id) return false;
      return roleIds.includes(node.entity_id);
    });

    console.log('Pending approvals query:', {
      userId,
      roleIds,
      totalInstances: instances?.length || 0,
      filteredCount: filteredInstances.length
    });

    return filteredInstances;
  } catch (error) {
    console.error('Error fetching pending workflow tasks:', error);
    return [];
  }
}

/**
 * Get user's active projects (where they're working, not approving)
 * @param supabase - Authenticated Supabase client
 * @param userId - User ID to get projects for
 */
export async function getUserActiveProjects(supabase: SupabaseClient, userId: string): Promise<any[]> {
  if (!supabase) return [];

  try {
    const { data: projects } = await supabase
      .from('project_assignments')
      .select(`
        *,
        projects(*),
        workflow_instances:projects(workflow_instance_id, workflow_instances(*))
      `)
      .eq('user_id', userId)
      .is('removed_at', null);

    // Filter out completed projects - they should only appear in "Finished Projects" section
    const activeProjects = (projects || []).filter((p: any) =>
      p.projects && p.projects.status !== 'complete'
    );

    return activeProjects;
  } catch (error) {
    console.error('Error fetching active projects:', error);
    return [];
  }
}
