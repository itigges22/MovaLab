import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';

/**
 * GET /api/workflows/my-pipeline
 * Returns projects where the user is pre-assigned to a workflow step,
 * but the workflow hasn't reached their step yet (In the Pipeline)
 * Superadmins see ALL pipeline projects across all users
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
      .eq('id', (user as any).id)
      .single();

    const isSuperadmin = userProfile?.is_superadmin === true;

    // Get workflow node assignments - all for superadmin, user-specific otherwise
    // Use explicit foreign key hints for PostgREST
    let query = supabase
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
      query = query.eq('user_id', (user as any).id);
    }

    const { data: nodeAssignments, error: assignmentError } = await query;

    if (assignmentError) {
      console.error('Error fetching node assignments:', assignmentError);
      return NextResponse.json({ error: 'Failed to fetch pipeline projects' }, { status: 500 });
    }

    // Get currently active steps for these workflow instances
    const instanceIds = [...new Set(nodeAssignments?.map((na: any) => na.workflow_instance_id) || [])];

    const activeStepsMap: Record<string, string[]> = {};

    if (instanceIds.length > 0) {
      const { data: activeSteps } = await supabase
        .from('workflow_active_steps')
        .select('workflow_instance_id, node_id')
        .in('workflow_instance_id', instanceIds)
        .eq('status', 'active');

      // Build a map of workflow_instance_id -> array of active node_ids
      if (activeSteps) {
        for (const step of activeSteps) {
          if (!activeStepsMap[step.workflow_instance_id]) {
            activeStepsMap[step.workflow_instance_id] = [];
          }
          activeStepsMap[step.workflow_instance_id].push(step.node_id);
        }
      }
    }

    // Filter to only include assignments where the user's node is NOT currently active
    // These are "pipeline" projects - assigned but not yet reached
    const pipelineProjects = [];
    const processedProjectIds = new Set<string>();

    for (const assignment of nodeAssignments || []) {
      const instanceId = assignment.workflow_instance_id;
      const nodeId = assignment.node_id;
      const instances = assignment.workflow_instances as Record<string, unknown> | Record<string, unknown>[];
      const instance = Array.isArray(instances) ? instances[0] : instances;
      const projects = instance?.projects as Record<string, unknown> | Record<string, unknown>[] | undefined;
      const project = projects ? (Array.isArray(projects) ? projects[0] : projects) : undefined;

      // Skip if workflow is not active or project is complete
      if ((instance?.status as string) !== 'active' || (project?.status as string) === 'complete') {
        continue;
      }

      // Check if this node is currently active
      const activeNodeIds = activeStepsMap[instanceId] || [];
      const isCurrentlyActive = activeNodeIds.includes(nodeId);

      // If the node is NOT currently active, it's in the pipeline
      // For superadmins, we allow multiple entries per project (one per assigned user)
      // For regular users, we dedupe by project
      const projectKey = project && isSuperadmin
        ? `${project.id}-${assignment.user_id}`
        : (project?.id as string);

      if (!isCurrentlyActive && project && !processedProjectIds.has(projectKey as string)) {
        processedProjectIds.add(projectKey);
        const assignedUser = (assignment as Record<string, unknown>).user_profiles;
        pipelineProjects.push({
          id: project.id,
          name: project.name,
          description: project.description,
          status: project.status,
          priority: project.priority,
          created_at: project.created_at,
          account: project.accounts,
          assigned_step: {
            nodeId: assignment.node_id,
            nodeName: (() => {
              const workflowNodes = assignment.workflow_nodes as Record<string, unknown> | Record<string, unknown>[];
              const node = Array.isArray(workflowNodes) ? workflowNodes[0] : workflowNodes;
              return (node?.label as string) || 'Unknown Step';
            })(),
            nodeType: (() => {
              const workflowNodes = assignment.workflow_nodes as Record<string, unknown> | Record<string, unknown>[];
              const node = Array.isArray(workflowNodes) ? workflowNodes[0] : workflowNodes;
              return (node?.node_type as string) || 'role';
            })()
          },
          assigned_at: assignment.assigned_at,
          workflow_instance_id: instanceId,
          // Include assigned user info for superadmins
          assigned_user: isSuperadmin && assignedUser ? {
            id: (assignedUser as Record<string, unknown>).id,
            name: (assignedUser as Record<string, unknown>).name,
            email: (assignedUser as Record<string, unknown>).email
          } : undefined
        });
      }
    }

    return NextResponse.json({
      success: true,
      projects: pipelineProjects
    });
  } catch (error: unknown) {
    console.error('Error in GET /api/workflows/my-pipeline:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
