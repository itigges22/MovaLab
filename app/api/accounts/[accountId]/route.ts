import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';
import { requireAuthAndPermission, handleGuardError } from '@/lib/server-guards';
import { Permission } from '@/lib/permissions';
import { updateAccountSchema } from '@/lib/validation-schemas';
import { logger } from '@/lib/debug-logger';
import { isValidUUID } from '@/lib/validation-helpers';

/**
 * PATCH /api/accounts/[accountId]
 * Update account details (admin only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const { accountId } = await params;

    if (!isValidUUID(accountId)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    // Require MANAGE_ACCOUNTS permission (consolidated from EDIT_ACCOUNT)
    await requireAuthAndPermission(
      Permission.MANAGE_ACCOUNTS,
      { accountId },
      request
    );

    const supabase = createApiSupabaseClient(request);
    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase client not available' },
        { status: 500 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    // Validate input with Zod schema
    const validation = updateAccountSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed. Please check your input.' },
        { status: 400 }
      );
    }

    // Build update object from validated data
    const allowedUpdates: Record<string, unknown> = {};
    const validatedData = validation.data;

    if (validatedData.name !== undefined) {
      allowedUpdates.name = validatedData.name;
    }
    if (validatedData.description !== undefined) {
      allowedUpdates.description = validatedData.description;
    }
    if (validatedData.primary_contact_name !== undefined) {
      allowedUpdates.primary_contact_name = validatedData.primary_contact_name;
    }
    if (validatedData.primary_contact_email !== undefined) {
      allowedUpdates.primary_contact_email = validatedData.primary_contact_email;
    }
    if (validatedData.status !== undefined) {
      allowedUpdates.status = validatedData.status;
    }
    if (validatedData.account_manager_id !== undefined) {
      allowedUpdates.account_manager_id = validatedData.account_manager_id;
    }

    if (Object.keys(allowedUpdates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('accounts')
      .update(allowedUpdates)
      .eq('id', accountId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating account', {}, error as unknown as Error);
      return NextResponse.json(
        { error: 'Failed to update account' },
        { status: 500 }
      );
    }

    return NextResponse.json({ account: data });
  } catch (error: unknown) {
    logger.error('Error in PATCH /api/accounts/[accountId]', {}, error as Error);
    return handleGuardError(error);
  }
}
