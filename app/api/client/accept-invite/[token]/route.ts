import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase-server';
import { logger } from '@/lib/debug-logger';
import { sendEmail } from '@/lib/email/mailer';
import { welcomeEmailTemplate } from '@/lib/email/templates/welcome';

// GET /api/client/accept-invite/[token] - Get invitation details (public, no auth required)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Invalid invitation link' }, { status: 400 });
    }

    const adminSupabase = createAdminSupabaseClient();
    if (!adminSupabase) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Look up invitation by token with joined data
    const { data: invitation, error } = await adminSupabase
      .from('client_portal_invitations')
      .select(`
        id,
        email,
        status,
        expires_at,
        account_id,
        accounts:account_id(id, name),
        inviter:invited_by(id, name, email)
      `)
      .eq('token', token)
      .single();

    if (error || !invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    // Check if invitation is still pending
    if (invitation.status !== 'pending') {
      return NextResponse.json(
        { error: `This invitation has already been ${invitation.status}` },
        { status: 410 }
      );
    }

    // Check if invitation has expired
    if (new Date(invitation.expires_at) < new Date()) {
      await adminSupabase
        .from('client_portal_invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id);

      return NextResponse.json({ error: 'This invitation has expired' }, { status: 410 });
    }

    // Return safe invitation details
    return NextResponse.json({
      invitation: {
        email: invitation.email,
        accountName: (invitation.accounts as any)?.name || 'Unknown Account',
        inviterName: (invitation.inviter as any)?.name || (invitation.inviter as any)?.email || 'An administrator',
      },
    });

  } catch (error: unknown) {
    logger.error('Error fetching client invitation details', {}, error as Error);
    return NextResponse.json({ error: 'Failed to load invitation' }, { status: 500 });
  }
}

// POST /api/client/accept-invite/[token] - Accept client invitation and create account
// No authentication required - this creates the user server-side using admin client
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Invalid invitation link' }, { status: 400 });
    }

    const body = await request.json();
    const { name, password, company_position } = body;

    // Validate inputs
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (name.length > 100) {
      return NextResponse.json({ error: 'Name is too long (max 100 characters)' }, { status: 400 });
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    if (company_position && typeof company_position === 'string' && company_position.length > 100) {
      return NextResponse.json({ error: 'Company position is too long (max 100 characters)' }, { status: 400 });
    }

    const adminSupabase = createAdminSupabaseClient();
    if (!adminSupabase) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Look up invitation
    const { data: invitation, error: inviteError } = await adminSupabase
      .from('client_portal_invitations')
      .select(`
        *,
        accounts:account_id(id, name)
      `)
      .eq('token', token)
      .single();

    if (inviteError || !invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    // Check status
    if (invitation.status !== 'pending') {
      return NextResponse.json(
        { error: `This invitation has already been ${invitation.status}` },
        { status: 410 }
      );
    }

    // Check expiration
    if (new Date(invitation.expires_at) < new Date()) {
      await adminSupabase
        .from('client_portal_invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id);

      return NextResponse.json({ error: 'This invitation has expired' }, { status: 410 });
    }

    // 1. Create auth user via admin API (no email confirmation needed)
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email: invitation.email,
      password,
      email_confirm: true,
      user_metadata: {
        name: name.trim(),
        is_client: true,
      },
    });

    if (authError) {
      logger.error('Failed to create client auth user', { error: authError.message });
      if (authError.message?.includes('already been registered') || authError.message?.includes('already exists')) {
        return NextResponse.json(
          { error: 'An account with this email already exists. Please contact your account manager.' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
    }

    const userId = authData.user.id;

    // 2. Create user profile with client fields
    const { error: profileError } = await adminSupabase
      .from('user_profiles')
      .upsert({
        id: userId,
        email: invitation.email,
        name: name.trim(),
        is_client: true,
        client_account_id: invitation.account_id,
        client_contact_name: name.trim(),
        client_company_position: company_position || null,
        has_completed_onboarding: true, // Clients skip internal onboarding
      }, { onConflict: 'id' });

    if (profileError) {
      logger.error('Failed to create client user profile', { error: profileError.message, userId });
      // Attempt cleanup of auth user on failure
      await adminSupabase.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: 'Failed to create user profile' }, { status: 500 });
    }

    // 3. Assign Client system role
    const { data: clientRole } = await adminSupabase
      .from('roles')
      .select('id')
      .eq('is_system_role', true)
      .ilike('name', 'client')
      .single();

    if (clientRole) {
      const { error: roleError } = await adminSupabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role_id: clientRole.id,
          assigned_by: invitation.invited_by,
        });

      if (roleError) {
        logger.error('Failed to assign Client role', { error: roleError.message, userId, roleId: clientRole.id });
        // Non-fatal: user is already marked as client
      }
    } else {
      logger.error('Client system role not found in roles table', { userId });
    }

    // 4. Mark invitation as accepted
    const { error: invitationError } = await adminSupabase
      .from('client_portal_invitations')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', invitation.id);

    if (invitationError) {
      logger.error('Failed to update client invitation status', { error: invitationError.message, invitationId: invitation.id });
    }

    // 5. Send welcome email
    const proto = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    const appUrl = `${proto}://${host}`;
    const accountName = (invitation.accounts as any)?.name || 'your account';

    const emailContent = welcomeEmailTemplate({
      userName: name.trim(),
      roleName: `Client (${accountName})`,
      loginUrl: `${appUrl}/login`,
    });

    const emailResult = await sendEmail({
      to: invitation.email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    if (!emailResult.success) {
      logger.error('Failed to send client welcome email', { error: emailResult.error });
    }

    logger.info('Client invitation accepted, user created', {
      invitationId: invitation.id,
      userId,
      accountId: invitation.account_id,
      email: invitation.email,
    });

    return NextResponse.json({
      success: true,
      message: 'Account created successfully. You can now log in to access the client portal.',
    }, { status: 201 });

  } catch (error: unknown) {
    logger.error('Error accepting client invitation', {}, error as Error);
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}
