import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient, getUserProfileFromRequest } from '@/lib/supabase-server';
import { getActiveSteps, getAllActiveAndWaitingSteps, isWorkflowComplete } from '@/lib/workflow-execution-service';
import { checkPermissionHybrid } from '@/lib/permission-checker';
import { Permission } from '@/lib/permissions';
import { verifyWorkflowInstanceAccess } from '@/lib/access-control-server';
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

    // Auth check - require authenticated user with profile
    const userProfile = await getUserProfileFromRequest(supabase);
    if (!userProfile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = { id: (userProfile as any).id };
    const isSuperadmin = (userProfile as any).is_superadmin === true;

    // Permission check: user needs EXECUTE_WORKFLOWS permission
    const canView = await checkPermissionHybrid(userProfile, Permission.EXECUTE_WORKFLOWS, undefined, supabase);
    if (!canView) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Access check: verify user has access to this workflow's project (superadmins bypass)
    if (!isSuperadmin) {
      const accessCheck = await verifyWorkflowInstanceAccess(supabase, user.id, workflowInstanceId);
      if (!accessCheck.hasAccess) {
        return NextResponse.json({ error: 'You do not have access to this workflow instance' }, { status: 403 });
      }
    }

    // Get active steps
    const activeSteps = await getActiveSteps(supabase, workflowInstanceId);

    // Get all steps including waiting
    const allSteps = await getAllActiveAndWaitingSteps(supabase, workflowInstanceId);

    // Check completion status
    const complete = await isWorkflowComplete(supabase, workflowInstanceId);

    // Count unique completed branches
    const { data: completedSteps } = await supabase
      .from('workflow_active_steps')
      .select('branch_id')
      .eq('workflow_instance_id', workflowInstanceId)
      .eq('status', 'completed');

    const completedBranches = new Set(completedSteps?.map((s: { branch_id: string }) => s.branch_id) || []).size;

    // Count waiting branches
    const waitingBranches = allSteps.filter((s: any) => s.status === 'waiting').length;

    // Derive hasParallelPaths from unique branch_ids in active steps
    const allBranchIds = new Set(allSteps.map((s: any) => s.branch_id).filter(Boolean));
    const hasParallelPaths = allBranchIds.size > 1;

    // Enrich active steps with node information (bulk fetch to avoid N+1 queries)
    const allNodeIds = [...new Set(allSteps.map((s: any) => s.node_id).filter(Boolean))];
    const allUserIds = [...new Set(allSteps.map((s: any) => s.assigned_user_id).filter(Boolean))];

    const [nodesResult, usersResult] = await Promise.all([
      allNodeIds.length > 0
        ? supabase.from('workflow_nodes').select('id, label, node_type, entity_id, settings, form_template_id, position_x, position_y').in('id', allNodeIds)
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
      hasParallelPaths,
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
