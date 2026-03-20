import { NextResponse, NextRequest } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';
import { requireAuthAndPermission, handleGuardError } from '@/lib/server-guards';
import { Permission } from '@/lib/permissions';
import { logger } from '@/lib/debug-logger';
import { isValidUUID } from '@/lib/validation-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roleId: string }> }
) {
  try {
    const { roleId } = await params;

    if (!isValidUUID(roleId)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    // Check authentication and permission
    await requireAuthAndPermission(Permission.MANAGE_USER_ROLES, {}, request);
    
    const supabase = createApiSupabaseClient(request);
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    // Fetch users assigned to this role
    const { data, error } = await supabase
      .from('user_roles')
      .select(`
        user_id,
        user_profiles:user_id (
          id,
          name,
          email,
          image
        )
      `)
      .eq('role_id', roleId);

    if (error) {
      logger.error('Error fetching role users', {}, error as unknown as Error);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    // Extract user profiles from the join
    const users = data?.map((item: any) => item.user_profiles).filter(Boolean) || [];

    return NextResponse.json(users);
  } catch (error: unknown) {
    return handleGuardError(error);
  }
}

