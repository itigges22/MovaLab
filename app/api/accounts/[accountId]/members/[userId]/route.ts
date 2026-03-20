import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';
import { requireAuthAndPermission, handleGuardError } from '@/lib/server-guards';
import { Permission } from '@/lib/permissions';
import { checkDemoModeForDestructiveAction } from '@/lib/api-demo-guard';
import { logger } from '@/lib/debug-logger';
import { isValidUUID } from '@/lib/validation-helpers';

/**
 * DELETE /api/accounts/[accountId]/members/[userId]
 * Remove a user from an account
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string; userId: string }> }
) {
  try {
    // Block in demo mode
    const blocked = checkDemoModeForDestructiveAction('remove_account_member');
    if (blocked) return blocked;

    const { accountId, userId } = await params;

    if (!isValidUUID(accountId) || !isValidUUID(userId)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    // Require permission to remove users from accounts (with account context)
    await requireAuthAndPermission(Permission.MANAGE_USERS_IN_ACCOUNTS, { accountId }, request);
    
    const supabase = createApiSupabaseClient(request);
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase client not available' }, { status: 500 });
    }
    
    // Remove user from account
    const { error } = await supabase
      .from('account_members')
      .delete()
      .eq('account_id', accountId)
      .eq('user_id', userId);
    
    if (error) {
      logger.error('Error removing user from account', {}, error as unknown as Error);
      return NextResponse.json({ error: 'Failed to remove user from account' }, { status: 500 });
    }
    
    return NextResponse.json({ message: 'User removed from account successfully' });
  } catch (error: unknown) {
    logger.error('Error in DELETE /api/accounts/[accountId]/members/[userId]', {}, error as Error);
    return handleGuardError(error);
  }
}

