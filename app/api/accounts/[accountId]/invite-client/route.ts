import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';
import { hasPermission } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';
import { sendClientInvitation } from '@/lib/client-portal-service';
import { validateRequestBody, sendClientInvitationSchema } from '@/lib/validation-schemas';
import { hasAccountAccessServer } from '@/lib/access-control-server';

// POST /api/accounts/[id]/invite-client - Send client portal invitation
export async function POST(
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
      .eq('id', (user as any).id)
      .single();

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Check MANAGE_CLIENT_INVITES permission
    const canInvite = await hasPermission(userProfile, Permission.MANAGE_CLIENT_INVITES, undefined, supabase);
    if (!canInvite) {
      return NextResponse.json({ error: 'Insufficient permissions to send client invitations' }, { status: 403 });
    }

    // Verify user has access to this account
    const hasAccess = await hasAccountAccessServer(supabase, (user as any).id, accountId);
    if (!hasAccess) {
      return NextResponse.json({
        error: 'You do not have access to this account'
      }, { status: 403 });
    }

    // Validate request body
    const body = await request.json();
    const validation = validateRequestBody(sendClientInvitationSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Send invitation
    const invitation = await sendClientInvitation({
      accountId: accountId,
      email: validation.data.email,
      invitedBy: (user as any).id,
      expiresInDays: validation.data.expires_in_days
    });

    return NextResponse.json({ success: true, invitation }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error in POST /api/accounts/[id]/invite-client:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
