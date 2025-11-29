import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';
import { progressWorkflow } from '@/lib/workflow-execution-service';

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

    const { workflowInstanceId, decision, feedback, formResponseId, assignedUserId, formData } = await request.json();

    if (!workflowInstanceId) {
      return NextResponse.json(
        { error: 'Missing required field: workflowInstanceId' },
        { status: 400 }
      );
    }

    // Progress the workflow
    const result = await progressWorkflow(
      supabase,
      workflowInstanceId,
      user.id,
      decision,
      feedback,
      formResponseId,
      assignedUserId,
      formData // Pass inline form data
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      nextNode: result.nextNode,
    });
  } catch (error) {
    console.error('Error in POST /api/workflows/progress:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
