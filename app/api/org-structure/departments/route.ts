import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient, getUserProfileFromRequest } from '@/lib/supabase-server';
import { hasPermission } from '@/lib/permission-checker';
import { Permission } from '@/lib/permissions';
import { logger } from '@/lib/debug-logger';

// GET /api/org-structure/departments - Get all departments
export async function GET(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient(request);
    if (!supabase) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    const userProfile = await getUserProfileFromRequest(supabase);
    if (!userProfile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Permission check: requires VIEW_DEPARTMENTS or VIEW_ALL_DEPARTMENTS
    const canView = await hasPermission(userProfile, Permission.VIEW_DEPARTMENTS, undefined, supabase);
    const canViewAll = await hasPermission(userProfile, Permission.VIEW_ALL_DEPARTMENTS, undefined, supabase);

    if (!canView && !canViewAll) {
      return NextResponse.json(
        { error: 'Insufficient permissions to view departments' },
        { status: 403 }
      );
    }

    // Get all departments
    const { data: departments, error } = await supabase
      .from('departments')
      .select('id, name')
      .order('name');

    if (error) {
      logger.error('Error fetching departments', {}, error as unknown as Error);
      return NextResponse.json({ error: 'Failed to fetch departments' }, { status: 500 });
    }

    return NextResponse.json({ success: true, departments: departments || [] }, { status: 200 });
  } catch (error: unknown) {
    logger.error('Error in GET /api/org-structure/departments', {}, error as Error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
