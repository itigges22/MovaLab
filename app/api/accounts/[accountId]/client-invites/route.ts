import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';
import { hasPermission } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';
import { hasAccountAccessServer } from '@/lib/access-control-server';
import { logger } from '@/lib/debug-logger';
import { isValidUUID } from '@/lib/validation-helpers';

// GET /api/accounts/[id]/client-invites - List client invitations for an account
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const { accountId } = await params;

    if (!isValidUUID(accountId)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

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

    // Check MANAGE_CLIENT_INVITES permission
    const canManageInvites = await hasPermission(userProfile, Permission.MANAGE_CLIENT_INVITES, undefined, supabase);
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

    // Query invitations directly using the API supabase client (with proper auth context)
    // instead of delegating to a service that creates its own server-side client.
    // The client_portal_invitations table has: id, account_id, email, invited_by, status, created_at, expires_at
    const { data: invitationsRaw, error: invitationsError } = await supabase
      .from('client_portal_invitations')
      .select(`
        *,
        invited_by_user:user_profiles!client_portal_invitations_invited_by_fkey (
          name,
          email
        )
      `)
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });

    if (invitationsError) {
      logger.error('Error fetching invitations', {}, invitationsError as unknown as Error);

      // If the table doesn't exist, return empty array gracefully
      if (invitationsError.code === 'PGRST116' || invitationsError.code === '42P01' || invitationsError.message?.includes('does not exist')) {
        return NextResponse.json({ success: true, invitations: [] }, { status: 200 });
      }

      return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 });
    }

    // Map the data to match the frontend's expected format
    // DB columns: id, account_id, email, invited_by, status, created_at, expires_at
    // Frontend expects: id, email, status, created_at, expires_at, accepted_at, invited_by_user
    const invitations = (invitationsRaw || []).map((inv: any) => ({
      id: inv.id,
      email: inv.email,
      status: inv.status,
      created_at: inv.created_at,
      expires_at: inv.expires_at,
      accepted_at: inv.accepted_at || null,
      invited_by_user: inv.invited_by_user || null,
    }));

    return NextResponse.json({ success: true, invitations }, { status: 200 });
  } catch (error: unknown) {
    logger.error('Error in GET /api/accounts/[id]/client-invites', {}, error as Error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
