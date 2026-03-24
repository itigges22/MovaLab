import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient, getUserProfileFromRequest } from '@/lib/supabase-server';
import { startWorkflowForProject } from '@/lib/workflow-execution-service';
import { hasPermission } from '@/lib/permission-checker';
import { Permission } from '@/lib/permissions';
import { userHasProjectAccess } from '@/lib/rbac';
import { logger } from '@/lib/debug-logger';

export async function POST(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient(request);
    if (!supabase) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    // Get current user
    const userProfile = await getUserProfileFromRequest(supabase);
    if (!userProfile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { projectId, workflowTemplateId } = body;

    if (!projectId || !workflowTemplateId) {
      return NextResponse.json(
        { error: 'Missing required fields: projectId and workflowTemplateId' },
        { status: 400 }
      );
    }

    // Permission check: user needs EXECUTE_WORKFLOWS permission
    const canExecute = await hasPermission(userProfile, Permission.EXECUTE_WORKFLOWS, undefined, supabase);
    if (!canExecute) {
      return NextResponse.json(
        { error: 'Insufficient permissions to start workflows' },
        { status: 403 }
      );
    }

    // Access check: user must have access to the project
    const hasAccess = await userHasProjectAccess(userProfile, projectId, supabase);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'You do not have access to this project' },
        { status: 403 }
      );
    }

    // Start the workflow
    const result = await startWorkflowForProject(supabase, projectId, workflowTemplateId, userProfile.id);

    if (!result.success) {
      const notFoundErrors = ['Workflow template not found', 'Project not found'];
      const conflictErrors = ['already has an active workflow', 'already has a workflow'];
      const errorMsg = result.error || 'Failed to start workflow';

      if (notFoundErrors.some(e => errorMsg.includes(e))) {
        return NextResponse.json({ error: errorMsg }, { status: 404 });
      }
      if (conflictErrors.some(e => errorMsg.includes(e))) {
        return NextResponse.json({ error: errorMsg }, { status: 409 });
      }
      return NextResponse.json({ error: errorMsg }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      workflowInstanceId: result.workflowInstanceId,
    });
  } catch (error: unknown) {
    logger.error('Error in POST /api/workflows/start', {}, error as Error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
