import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createApiSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server';
import { requireAuthentication, requirePermission, handleGuardError } from '@/lib/server-guards';
import { Permission } from '@/lib/permissions';
import { sendEmail } from '@/lib/email/mailer';
import { invitationEmailTemplate } from '@/lib/email/templates/invitation';
import { logger } from '@/lib/debug-logger';

// POST - Resend an invitation email with a fresh token
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Auth + permission check
    const user = await requireAuthentication(request);
    const supabase = createApiSupabaseClient(request);
    await requirePermission(user, Permission.MANAGE_USER_ROLES, {}, supabase);

    // Use admin client to bypass RLS
    const adminSupabase = createAdminSupabaseClient();
    if (!adminSupabase) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Fetch the invitation
    const { data: invitation, error: fetchError } = await adminSupabase
      .from('user_invitations')
      .select('*, roles:role_id(id, name, department_id, departments:department_id(id, name))')
      .eq('id', id)
      .single();

    if (fetchError || !invitation) {
      logger.error('Invitation not found for resend', { invitationId: id, error: fetchError?.message });
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    if (invitation.status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot resend an invitation with status "${invitation.status}". Only pending invitations can be resent.` },
        { status: 400 }
      );
    }

    // Generate a new token and extend expiration
    const newToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Update the invitation with new token and expiration
    const { error: updateError } = await adminSupabase
      .from('user_invitations')
      .update({
        token: newToken,
        expires_at: expiresAt.toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      logger.error('Failed to update invitation for resend', { error: updateError.message, invitationId: id });
      return NextResponse.json({ error: 'Failed to update invitation' }, { status: 500 });
    }

    // Build accept URL from the incoming request
    const proto = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    const appUrl = `${proto}://${host}`;
    const acceptUrl = `${appUrl}/invite/${newToken}`;

    // Get role and department names
    const role = invitation.roles as { id: string; name: string; departments?: { id: string; name: string } | null } | null;
    const roleName = role?.name || 'Team Member';
    const deptName = role?.departments?.name || undefined;

    // Send the invitation email
    const emailContent = invitationEmailTemplate({
      recipientName: invitation.name,
      inviterName: user.name || user.email || 'An administrator',
      roleName,
      departmentName: deptName,
      acceptUrl,
      expiresIn: '7 days',
    });

    const emailResult = await sendEmail({
      to: invitation.email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    if (!emailResult.success) {
      logger.error('Failed to resend invitation email', { error: emailResult.error, invitationId: id });
      return NextResponse.json(
        { error: 'Invitation updated but email failed to send' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      emailSent: true,
    });

  } catch (error: unknown) {
    return handleGuardError(error);
  }
}
