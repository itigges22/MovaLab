import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';
import { hasPermission } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';
import { submitClientFeedback } from '@/lib/client-portal-service';
import { validateRequestBody, submitClientFeedbackSchema } from '@/lib/validation-schemas';

// POST /api/client/portal/projects/[id]/feedback - Submit client feedback
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    const supabase = createApiSupabaseClient(request);
    if (!supabase) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile with roles
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select(`
        *,
        user_roles!user_roles_user_id_fkey (
          roles (
            id,
            name,
            permissions,
            department_id
          )
        )
      `)
      .eq('id', user.id)
      .single();

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Check CLIENT_PROVIDE_FEEDBACK permission
    const canProvideFeedback = await hasPermission(userProfile, Permission.CLIENT_PROVIDE_FEEDBACK, undefined, supabase);
    if (!canProvideFeedback) {
      return NextResponse.json({ error: 'Insufficient permissions to provide feedback' }, { status: 403 });
    }

    // Verify user is a client
    if (!userProfile.is_client) {
      return NextResponse.json({ error: 'Access denied. This endpoint is for client users only.' }, { status: 403 });
    }

    // Validate request body
    const body = await request.json();
    const validation = validateRequestBody(submitClientFeedbackSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Submit feedback
    const feedback = await submitClientFeedback({
      projectId: id,
      clientUserId: user.id,
      satisfactionScore: validation.data.satisfaction_score || undefined,
      whatWentWell: validation.data.what_went_well || undefined,
      whatNeedsImprovement: validation.data.what_needs_improvement || undefined,
      workflowHistoryId: validation.data.workflow_history_id || undefined
    });

    return NextResponse.json({
      success: true,
      message: 'Thank you for your feedback!',
      feedback
    }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/client/portal/projects/[id]/feedback:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
