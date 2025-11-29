import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';
import { getClientInvitationsByAccount } from '@/lib/client-portal-service';
import { hasPermission } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';
import { hasAccountAccessServer } from '@/lib/access-control-server';

// GET /api/accounts/[id]/client-invites - List client invitations for an account
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const { accountId } = await params;
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

    // Check SEND_CLIENT_INVITES permission
    const canManageInvites = await hasPermission(userProfile, Permission.SEND_CLIENT_INVITES, undefined, supabase);
    if (!canManageInvites) {
      return NextResponse.json({ error: 'Insufficient permissions to view client invitations' }, { status: 403 });
    }

    // Verify user has access to this account
    const hasAccess = await hasAccountAccessServer(supabase, user.id, accountId);
    if (!hasAccess) {
      return NextResponse.json({
        error: 'You do not have access to this account'
      }, { status: 403 });
    }

    // Get invitations
    const invitations = await getClientInvitationsByAccount(accountId);

    return NextResponse.json({ success: true, invitations }, { status: 200 });
  } catch (error) {
    console.error('Error in GET /api/accounts/[id]/client-invites:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
