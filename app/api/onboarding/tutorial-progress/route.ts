import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server';
import { SUPERADMIN_TUTORIAL } from '@/lib/onboarding/tutorial-steps';

/**
 * GET /api/onboarding/tutorial-progress
 * Returns the current tutorial state for the authenticated user.
 */
export async function GET(request: NextRequest) {
  const supabase = createApiSupabaseClient(request);
  if (!supabase) {
    return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: state, error } = await supabase
    .from('onboarding_state')
    .select('tutorial_step, tutorial_completed, tutorial_data')
    .eq('user_id', user.id)
    .single();

  if (error || !state) {
    // No onboarding state found — user may not need tutorial
    return NextResponse.json({ step: 0, completed: true, data: {} });
  }

  return NextResponse.json({
    step: state.tutorial_step ?? 0,
    completed: state.tutorial_completed ?? false,
    data: state.tutorial_data ?? {},
  });
}

/**
 * PATCH /api/onboarding/tutorial-progress
 * Advance or complete the tutorial.
 * Body: { step: number, completed?: boolean }
 */
export async function PATCH(request: NextRequest) {
  const supabase = createApiSupabaseClient(request);
  if (!supabase) {
    return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.step !== 'number') {
    return NextResponse.json({ error: 'Invalid request body. "step" (number) is required.' }, { status: 400 });
  }

  const { step, completed, isSuperadmin: isSuperadminTutorial } = body as {
    step: number;
    completed?: boolean;
    isSuperadmin?: boolean;
  };

  // For non-superadmin users, the tutorial steps are dynamically generated on the client.
  // We use a generous upper bound for step validation since we don't know the exact count server-side.
  // Superadmin tutorials use the known SUPERADMIN_TUTORIAL length.
  const maxStep = isSuperadminTutorial ? SUPERADMIN_TUTORIAL.length - 1 : 20;

  if (step < 0 || step > maxStep) {
    return NextResponse.json(
      { error: `Invalid step. Must be between 0 and ${maxStep}.` },
      { status: 400 },
    );
  }

  // For superadmin tutorials, validate that required actions were completed.
  // Non-superadmin tutorials are informational guides — no action validation needed.
  if (isSuperadminTutorial) {
    const adminSupabase = createAdminSupabaseClient();

    // We validate the PREVIOUS step's required action, not the step being set.
    // E.g., to advance FROM step 1 to step 2, we validate step 1's action.
    if (step > 0 && adminSupabase) {
      const previousStep = SUPERADMIN_TUTORIAL[step - 1];

      if (previousStep?.isRequired && previousStep?.requiredAction) {
        const valid = await validateStepAction(adminSupabase, previousStep.requiredAction);
        if (!valid) {
          return NextResponse.json(
            {
              error: `You must complete "${previousStep.title}" before advancing.`,
              requiredAction: previousStep.requiredAction,
            },
            { status: 400 },
          );
        }
      }
    }
  }

  // Build the update payload
  const updatePayload: Record<string, unknown> = {
    tutorial_step: step,
    updated_at: new Date().toISOString(),
  };

  if (completed) {
    updatePayload.tutorial_completed = true;
    updatePayload.setup_completed_at = new Date().toISOString();
  }

  const { error: updateError } = await supabase
    .from('onboarding_state')
    .update(updatePayload)
    .eq('user_id', user.id);

  if (updateError) {
    console.error('Failed to update onboarding state:', updateError);
    return NextResponse.json({ error: 'Failed to update tutorial progress' }, { status: 500 });
  }

  // If marking as completed, also set has_completed_onboarding on user_profiles
  if (completed) {
    const { error: profileError } = await supabase
      .from('user_profiles')
      .update({ has_completed_onboarding: true })
      .eq('id', user.id);

    if (profileError) {
      console.error('Failed to update user profile onboarding flag:', profileError);
      // Non-fatal — the onboarding_state was already updated
    }
  }

  return NextResponse.json({
    step,
    completed: !!completed,
    message: completed ? 'Tutorial completed!' : `Advanced to step ${step}`,
  });
}

/**
 * Validates that the required action for a step has been performed.
 * Uses the admin client to bypass RLS and get accurate counts.
 */
async function validateStepAction(
  adminSupabase: NonNullable<ReturnType<typeof createAdminSupabaseClient>>,
  action: string,
): Promise<boolean> {
  switch (action) {
    case 'create_department': {
      const { count } = await adminSupabase
        .from('departments')
        .select('*', { count: 'exact', head: true });
      return (count ?? 0) > 0;
    }
    case 'create_role': {
      const { count } = await adminSupabase
        .from('roles')
        .select('*', { count: 'exact', head: true })
        .eq('is_system_role', false);
      return (count ?? 0) > 0;
    }
    case 'send_invitation': {
      const { count } = await adminSupabase
        .from('user_invitations')
        .select('*', { count: 'exact', head: true });
      return (count ?? 0) > 0;
    }
    default:
      // Unknown action or optional step — always passes
      return true;
  }
}
