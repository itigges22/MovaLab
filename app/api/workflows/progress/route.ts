import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient, getUserProfileFromRequest } from '@/lib/supabase-server';
import { progressWorkflowStep } from '@/lib/workflow-execution-service';
import { hasPermission } from '@/lib/permission-checker';
import { Permission } from '@/lib/permissions';
import { verifyWorkflowInstanceAccess } from '@/lib/access-control-server';
import { logger } from '@/lib/debug-logger';

export async function POST(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient(request);
    if (!supabase) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    // Get current user with roles for permission checking
    const userProfile = await getUserProfileFromRequest(supabase);
    if (!userProfile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Permission check: user needs EXECUTE_WORKFLOWS permission
    const canExecute = await hasPermission(userProfile, Permission.EXECUTE_WORKFLOWS, undefined, supabase);
    if (!canExecute) {
      return NextResponse.json(
        { error: 'Insufficient permissions to progress workflows' },
        { status: 403 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const {
      workflowInstanceId,
      activeStepId, // NEW: for parallel workflow support
      decision,
      feedback,
      formResponseId,
      assignedUserId,
      assignedUsersPerNode, // NEW: map of nodeId -> userId for parallel branches
      formData
    } = body;

    if (!workflowInstanceId) {
      return NextResponse.json(
        { error: 'Missing required field: workflowInstanceId' },
        { status: 400 }
      );
    }

    // Verify user has access to this workflow's project (superadmins bypass)
    if (!(userProfile as any).is_superadmin) {
      const accessCheck = await verifyWorkflowInstanceAccess(supabase, userProfile.id, workflowInstanceId);
      if (!accessCheck.hasAccess) {
        return NextResponse.json({ error: 'You do not have access to this workflow instance' }, { status: 403 });
      }
    }

    // Use the new progressWorkflowStep function which supports parallel workflows
    // If activeStepId is provided, it progresses that specific step
    // If not provided, it falls back to legacy behavior using current_node_id
    const result = await progressWorkflowStep(
      supabase,
      workflowInstanceId,
      activeStepId || null, // Pass null for legacy behavior
      userProfile.id,
      decision,
      feedback,
      formResponseId,
      assignedUserId,
      formData,
      assignedUsersPerNode // NEW: map of nodeId -> userId for parallel branches
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      nextNode: result.nextNode,
      newActiveSteps: result.newActiveSteps || [], // Include new active steps for parallel workflows
    });
  } catch (error: unknown) {
    logger.error('Error in POST /api/workflows/progress', {}, error as Error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
