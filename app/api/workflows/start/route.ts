import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';
import { startWorkflowForProject } from '@/lib/workflow-execution-service';

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

    const { projectId, workflowTemplateId } = await request.json();

    if (!projectId || !workflowTemplateId) {
      return NextResponse.json(
        { error: 'Missing required fields: projectId and workflowTemplateId' },
        { status: 400 }
      );
    }

    // Start the workflow
    const result = await startWorkflowForProject(supabase, projectId, workflowTemplateId, user.id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      workflowInstanceId: result.workflowInstanceId,
    });
  } catch (error) {
    console.error('Error in POST /api/workflows/start:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
