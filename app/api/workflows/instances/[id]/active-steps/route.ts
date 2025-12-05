import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';
import { getActiveSteps, getAllActiveAndWaitingSteps, isWorkflowComplete, WorkflowActiveStep } from '@/lib/workflow-execution-service';

/**
 * GET /api/workflows/instances/[id]/active-steps
 * Returns all active and waiting steps for a workflow instance
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const workflowInstanceId = resolvedParams.id;
    const supabase = createApiSupabaseClient(request);

    if (!supabase) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    // Get active steps
    const activeSteps = await getActiveSteps(supabase, workflowInstanceId);

    // Get all steps including waiting
    const allSteps = await getAllActiveAndWaitingSteps(supabase, workflowInstanceId);

    // Check completion status
    const complete = await isWorkflowComplete(supabase, workflowInstanceId);

    // Get workflow instance to count branches
    const { data: instance } = await supabase
      .from('workflow_instances')
      .select('has_parallel_paths')
      .eq('id', workflowInstanceId)
      .single();

    // Count unique completed branches
    const { data: completedSteps } = await supabase
      .from('workflow_active_steps')
      .select('branch_id')
      .eq('workflow_instance_id', workflowInstanceId)
      .eq('status', 'completed');

    const completedBranches = new Set(completedSteps?.map((s: { branch_id: string }) => s.branch_id) || []).size;

    // Count waiting branches
    const waitingBranches = allSteps.filter(s => s.status === 'waiting').length;

    // Enrich active steps with node information
    const enrichedSteps = await Promise.all(
      allSteps.map(async (step) => {
        const { data: node } = await supabase
          .from('workflow_nodes')
          .select('*')
          .eq('id', step.node_id)
          .single();

        const { data: assignedUser } = step.assigned_user_id
          ? await supabase
              .from('user_profiles')
              .select('id, full_name, avatar_url')
              .eq('id', step.assigned_user_id)
              .single()
          : { data: null };

        return {
          ...step,
          node,
          assignedUser: assignedUser || null
        };
      })
    );

    return NextResponse.json({
      activeSteps: enrichedSteps.filter(s => s.status === 'active'),
      waitingSteps: enrichedSteps.filter(s => s.status === 'waiting'),
      allSteps: enrichedSteps,
      isComplete: complete,
      hasParallelPaths: instance?.has_parallel_paths || false,
      completedBranches,
      waitingBranches,
      activeBranches: activeSteps.length
    });
  } catch (error) {
    console.error('Error fetching active steps:', error);
    return NextResponse.json(
      { error: 'Failed to fetch active steps' },
      { status: 500 }
    );
  }
}
