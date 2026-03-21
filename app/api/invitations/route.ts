import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createApiSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server';
import { requireAuthentication, requirePermission, handleGuardError } from '@/lib/server-guards';
import { Permission } from '@/lib/permissions';
import { sendEmail } from '@/lib/email/mailer';
import { invitationEmailTemplate } from '@/lib/email/templates/invitation';
import { logger } from '@/lib/debug-logger';

// POST - Create a new invitation and send email
export async function POST(request: NextRequest) {
  try {
    // Auth + permission check
    const user = await requireAuthentication(request);
    const supabase = createApiSupabaseClient(request);
    await requirePermission(user, Permission.MANAGE_USER_ROLES, {}, supabase);

    const body = await request.json();
    const { email, name, roleId, departmentId } = body;

    // Validate inputs
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 });
    }

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (!roleId || typeof roleId !== 'string') {
      return NextResponse.json({ error: 'Role ID is required' }, { status: 400 });
    }

    // Verify role exists
    const adminSupabase = createAdminSupabaseClient();
    if (!adminSupabase) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const { data: role, error: roleError } = await adminSupabase
      .from('roles')
      .select('id, name, department_id, departments(id, name)')
      .eq('id', roleId)
      .single();

    if (roleError || !role) {
      return NextResponse.json({ error: 'Invalid role ID' }, { status: 400 });
    }

    // Check for existing pending invitation for this email
    const { data: existingInvite } = await adminSupabase
      .from('user_invitations')
      .select('id, status')
      .eq('email', email.trim().toLowerCase())
      .eq('status', 'pending')
      .single();

    if (existingInvite) {
      return NextResponse.json(
        { error: 'A pending invitation already exists for this email address' },
        { status: 409 }
      );
    }

    // Check if user already exists
    const { data: existingUser } = await adminSupabase
      .from('user_profiles')
      .select('id')
      .eq('email', email.trim().toLowerCase())
      .single();

    if (existingUser) {
      return NextResponse.json(
        { error: 'A user with this email address already exists' },
        { status: 409 }
      );
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');

    // Set expiration to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Insert invitation using admin client (service role bypasses RLS)
    const { data: invitation, error: insertError } = await adminSupabase
      .from('user_invitations')
      .insert({
        email: email.trim().toLowerCase(),
        name: name.trim(),
        role_id: roleId,
        department_id: departmentId || null,
        invited_by: user.id,
        token,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      logger.error('Failed to create invitation', { error: insertError.message });
      return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 });
    }

    // Build accept URL from the incoming request (auto-detects domain)
    const proto = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    const appUrl = `${proto}://${host}`;
    const acceptUrl = `${appUrl}/invite/${token}`;

    // Determine department name
    const deptName = departmentId
      ? ((role as any).departments?.name || undefined)
      : undefined;

    // Send invitation email
    const emailContent = invitationEmailTemplate({
      recipientName: name.trim(),
      inviterName: user.name || user.email || 'An administrator',
      roleName: role.name,
      departmentName: deptName,
      acceptUrl,
      expiresIn: '7 days',
    });

    const emailResult = await sendEmail({
      to: email.trim().toLowerCase(),
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    if (!emailResult.success) {
      logger.error('Failed to send invitation email', { error: emailResult.error });
      // Don't fail the request - invitation was created, email can be resent
    }

    return NextResponse.json({
      invitation,
      emailSent: emailResult.success,
    }, { status: 201 });

  } catch (error: unknown) {
    return handleGuardError(error);
  }
}

// GET - List all invitations
export async function GET(request: NextRequest) {
  try {
    // Auth + permission check
    const user = await requireAuthentication(request);
    const supabase = createApiSupabaseClient(request);
    await requirePermission(user, Permission.MANAGE_USER_ROLES, {}, supabase);

    if (!supabase) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    const { data: invitations, error } = await supabase
      .from('user_invitations')
      .select(`
        *,
        roles:role_id(id, name),
        departments:department_id(id, name),
        inviter:invited_by(id, name, email)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to fetch invitations', { error: error.message });
      return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 });
    }

    return NextResponse.json({ invitations: invitations || [] });

  } catch (error: unknown) {
    return handleGuardError(error);
  }
}
