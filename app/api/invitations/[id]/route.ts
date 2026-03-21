import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server';
import { requireAuthentication, requirePermission, handleGuardError } from '@/lib/server-guards';
import { Permission } from '@/lib/permissions';
import { logger } from '@/lib/debug-logger';

// DELETE - Revoke a pending invitation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Auth + permission check
    const user = await requireAuthentication(request);
    const supabase = createApiSupabaseClient(request);
    await requirePermission(user, Permission.MANAGE_USER_ROLES, {}, supabase);

    // Use admin client to bypass RLS for invitation management
    const adminSupabase = createAdminSupabaseClient();
    if (!adminSupabase) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Verify invitation exists and is pending
    const { data: invitation, error: fetchError } = await adminSupabase
      .from('user_invitations')
      .select('id, status')
      .eq('id', id)
      .single();

    if (fetchError || !invitation) {
      logger.error('Invitation not found for revoke', { invitationId: id, error: fetchError?.message });
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    if (invitation.status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot revoke an invitation with status "${invitation.status}". Only pending invitations can be revoked.` },
        { status: 400 }
      );
    }

    // Update status to revoked (soft delete)
    const { data: updated, error: updateError } = await adminSupabase
      .from('user_invitations')
      .update({ status: 'revoked' })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      logger.error('Failed to revoke invitation', { error: updateError.message, invitationId: id });
      return NextResponse.json({ error: 'Failed to revoke invitation' }, { status: 500 });
    }

    return NextResponse.json({ invitation: updated });

  } catch (error: unknown) {
    return handleGuardError(error);
  }
}
