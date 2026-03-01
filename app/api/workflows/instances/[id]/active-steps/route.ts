import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';
import { getActiveSteps, getAllActiveAndWaitingSteps, isWorkflowComplete } from '@/lib/workflow-execution-service';
import { logger } from '@/lib/debug-logger';

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

    // Auth check - require authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
    const waitingBranches = allSteps.filter((s: any) => s.status === 'waiting').length;

    // Enrich active steps with node information (bulk fetch to avoid N+1 queries)
    const allNodeIds = [...new Set(allSteps.map((s: any) => s.node_id).filter(Boolean))];
    const allUserIds = [...new Set(allSteps.map((s: any) => s.assigned_user_id).filter(Boolean))];

    const [nodesResult, usersResult] = await Promise.all([
      allNodeIds.length > 0
        ? supabase.from('workflow_nodes').select('*').in('id', allNodeIds)
        : { data: [] },
      allUserIds.length > 0
        ? supabase.from('user_profiles').select('id, name, email').in('id', allUserIds)
        : { data: [] },
    ]);

    const nodesMap = new Map((nodesResult.data || []).map((n: any) => [n.id, n]));
    const usersMap = new Map((usersResult.data || []).map((u: any) => [u.id, u]));

    const enrichedSteps = allSteps.map((step: any) => ({
      ...step,
      node: nodesMap.get(step.node_id) || null,
      assignedUser: step.assigned_user_id ? usersMap.get(step.assigned_user_id) || null : null,
    }));

    return NextResponse.json({
      activeSteps: enrichedSteps.filter((s: any) => s.status === 'active'),
      waitingSteps: enrichedSteps.filter((s: any) => s.status === 'waiting'),
      allSteps: enrichedSteps,
      isComplete: complete,
      hasParallelPaths: instance?.has_parallel_paths || false,
      completedBranches,
      waitingBranches,
      activeBranches: activeSteps.length
    });
  } catch (error: unknown) {
    logger.error('Error fetching active steps', {}, error as Error);
    return NextResponse.json(
      { error: 'Failed to fetch active steps' },
      { status: 500 }
    );
  }
}
