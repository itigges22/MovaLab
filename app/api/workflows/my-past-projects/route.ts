import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';

/**
 * GET /api/workflows/my-past-projects
 * Returns projects where:
 * 1. The project is completed (status = 'complete'), OR
 * 2. The user was assigned to a workflow step that has already been completed
 *    (the workflow moved past their step)
 * Superadmins see ALL past projects across all users
 */
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

    // Check if user is superadmin
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('is_superadmin')
      .eq('id', user.id)
      .single();

    const isSuperadmin = userProfile?.is_superadmin === true;

    const pastProjects: any[] = [];
    const processedProjectIds = new Set<string>();

    // 1. Get completed projects (via project_assignments)
    // NOTE: We intentionally do NOT filter by removed_at here because
    // when projects are completed, their assignments are soft-deleted (removed_at is set).
    // We need to include these to show completed projects in the past projects section.
    let completedQuery = supabase
      .from('project_assignments')
      .select(`
        project_id,
        user_id,
        role_in_project,
        assigned_at,
        projects!inner(
          id,
          name,
          description,
          status,
          priority,
          created_at,
          updated_at,
          completed_at,
          account_id,
          accounts(id, name)
        ),
        user_profiles!project_assignments_user_id_fkey(
          id,
          name,
          email
        )
      `);

    // Only filter by user if not superadmin
    if (!isSuperadmin) {
      completedQuery = completedQuery.eq('user_id', user.id);
    }

    const { data: completedAssignments, error: completedError } = await completedQuery;

    if (!completedError && completedAssignments) {
      for (const assignment of completedAssignments) {
        const project = assignment.projects as any;
        const assignedUser = (assignment as any).user_profiles;

        // For superadmins, use project+user combo as key to show all users' past projects
        const projectKey = isSuperadmin
          ? `${project.id}-${assignment.user_id}`
          : project.id;

        if (project?.status === 'complete' && !processedProjectIds.has(projectKey)) {
          processedProjectIds.add(projectKey);
          pastProjects.push({
            id: project.id,
            name: project.name,
            description: project.description,
            status: project.status,
            priority: project.priority,
            created_at: project.created_at,
            completed_at: project.completed_at || project.updated_at,
            account: project.accounts,
            completion_reason: 'project_completed',
            role_in_project: assignment.role_in_project,
            // Include assigned user info for superadmins
            assigned_user: isSuperadmin && assignedUser ? {
              id: assignedUser.id,
              name: assignedUser.name,
              email: assignedUser.email
            } : undefined
          });
        }
      }
    }

    // 2. Get projects where the user's workflow step was completed (moved past them)
    // Use explicit foreign key hints for PostgREST
    let nodeQuery = supabase
      .from('workflow_node_assignments')
      .select(`
        id,
        node_id,
        user_id,
        workflow_instance_id,
        assigned_at,
        workflow_nodes:workflow_node_assignments_node_id_fkey!inner(
          id,
          label,
          node_type
        ),
        workflow_instances:workflow_node_assignments_workflow_instance_id_fkey!inner(
          id,
          status,
          project_id,
          projects:workflow_instances_project_id_fkey!inner(
            id,
            name,
            description,
            status,
            priority,
            created_at,
            updated_at,
            account_id,
            accounts(id, name)
          )
        ),
        user_profiles:workflow_node_assignments_user_id_fkey(
          id,
          name,
          email
        )
      `);

    // Only filter by user if not superadmin
    if (!isSuperadmin) {
      nodeQuery = nodeQuery.eq('user_id', user.id);
    }

    const { data: nodeAssignments, error: nodeError } = await nodeQuery;

    if (!nodeError && nodeAssignments) {
      // Get completed steps for these workflow instances
      const instanceIds = [...new Set(nodeAssignments.map(na => na.workflow_instance_id))];

      let completedStepsMap: Record<string, Set<string>> = {};
      let activeStepsMap: Record<string, Set<string>> = {};

      if (instanceIds.length > 0) {
        // Get completed steps
        const { data: completedSteps } = await supabase
          .from('workflow_active_steps')
          .select('workflow_instance_id, node_id')
          .in('workflow_instance_id', instanceIds)
          .eq('status', 'completed');

        if (completedSteps) {
          for (const step of completedSteps) {
            if (!completedStepsMap[step.workflow_instance_id]) {
              completedStepsMap[step.workflow_instance_id] = new Set();
            }
            completedStepsMap[step.workflow_instance_id].add(step.node_id);
          }
        }

        // Get active steps
        const { data: activeSteps } = await supabase
          .from('workflow_active_steps')
          .select('workflow_instance_id, node_id')
          .in('workflow_instance_id', instanceIds)
          .eq('status', 'active');

        if (activeSteps) {
          for (const step of activeSteps) {
            if (!activeStepsMap[step.workflow_instance_id]) {
              activeStepsMap[step.workflow_instance_id] = new Set();
            }
            activeStepsMap[step.workflow_instance_id].add(step.node_id);
          }
        }
      }

      // Find assignments where the user's node has been completed (not active anymore)
      for (const assignment of nodeAssignments) {
        const instanceId = assignment.workflow_instance_id;
        const nodeId = assignment.node_id;
        const instance = assignment.workflow_instances as any;
        const project = instance?.projects;
        const assignedUser = (assignment as any).user_profiles;

        // For superadmins, use project+user combo as key to show all users' past projects
        const projectKey = isSuperadmin
          ? `${project?.id}-${assignment.user_id}`
          : project?.id;

        // Skip if already processed or project is in a non-relevant state
        if (!project || processedProjectIds.has(projectKey)) {
          continue;
        }

        // Check if this node has been completed
        const completedNodes = completedStepsMap[instanceId] || new Set();
        const activeNodes = activeStepsMap[instanceId] || new Set();
        const wasCompleted = completedNodes.has(nodeId);
        const isActive = activeNodes.has(nodeId);

        // If the node was completed and is no longer active, the user's part is done
        if (wasCompleted && !isActive) {
          processedProjectIds.add(projectKey);
          pastProjects.push({
            id: project.id,
            name: project.name,
            description: project.description,
            status: project.status,
            priority: project.priority,
            created_at: project.created_at,
            completed_at: project.updated_at,
            account: project.accounts,
            completion_reason: 'step_completed',
            completed_step: {
              nodeId: assignment.node_id,
              nodeName: (assignment.workflow_nodes as any)?.label || 'Unknown Step',
              nodeType: (assignment.workflow_nodes as any)?.node_type || 'role'
            },
            // Include assigned user info for superadmins
            assigned_user: isSuperadmin && assignedUser ? {
              id: assignedUser.id,
              name: assignedUser.name,
              email: assignedUser.email
            } : undefined
          });
        }
      }
    }

    // Sort by completion date (most recent first)
    pastProjects.sort((a, b) => {
      const dateA = new Date(a.completed_at || a.created_at).getTime();
      const dateB = new Date(b.completed_at || b.created_at).getTime();
      return dateB - dateA;
    });

    return NextResponse.json({
      success: true,
      projects: pastProjects
    });
  } catch (error) {
    console.error('Error in GET /api/workflows/my-past-projects:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
