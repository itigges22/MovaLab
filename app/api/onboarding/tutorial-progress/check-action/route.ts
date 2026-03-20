import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server';

/**
 * GET /api/onboarding/tutorial-progress/check-action?action=create_department
 * Checks if a required tutorial action has been completed.
 * Used by the tutorial provider to poll for action completion.
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

  const action = request.nextUrl.searchParams.get('action');
  if (!action) {
    return NextResponse.json({ error: 'Missing "action" query parameter' }, { status: 400 });
  }

  const adminSupabase = createAdminSupabaseClient();
  if (!adminSupabase) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const completed = await checkActionCompleted(adminSupabase, action);

  return NextResponse.json({ action, completed });
}

async function checkActionCompleted(
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
      return true;
  }
}
