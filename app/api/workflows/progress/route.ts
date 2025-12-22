import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';
import { progressWorkflowStep } from '@/lib/workflow-execution-service';

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

    const {
      workflowInstanceId,
      activeStepId, // NEW: for parallel workflow support
      decision,
      feedback,
      formResponseId,
      assignedUserId,
      assignedUsersPerNode, // NEW: map of nodeId -> userId for parallel branches
      formData
    } = await request.json();

    if (!workflowInstanceId) {
      return NextResponse.json(
        { error: 'Missing required field: workflowInstanceId' },
        { status: 400 }
      );
    }

    // Use the new progressWorkflowStep function which supports parallel workflows
    // If activeStepId is provided, it progresses that specific step
    // If not provided, it falls back to legacy behavior using current_node_id
    const result = await progressWorkflowStep(
      supabase,
      workflowInstanceId,
      activeStepId || null, // Pass null for legacy behavior
      (user as any).id,
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
    console.error('Error in POST /api/workflows/progress:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
