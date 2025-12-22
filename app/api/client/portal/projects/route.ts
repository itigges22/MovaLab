import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';
import { getClientProjects } from '@/lib/client-portal-service';

// GET /api/client/portal/projects - Get all projects for client's account
export async function GET(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient(request);
    if (!supabase) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', (user as any).id)
      .single();

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Verify user is a client (hardcoded check - client permissions are implicit)
    if (!userProfile.is_client) {
      return NextResponse.json({ error: 'Access denied. This endpoint is for client users only.' }, { status: 403 });
    }

    if (!userProfile.client_account_id) {
      return NextResponse.json({ error: 'Client user is not associated with an account' }, { status: 400 });
    }

    // Get client projects
    const projects = await getClientProjects((user as any).id);

    return NextResponse.json({ success: true, projects }, { status: 200 });
  } catch (error: unknown) {
    console.error('Error in GET /api/client/portal/projects:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
