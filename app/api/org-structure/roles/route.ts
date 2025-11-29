import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';

// GET /api/org-structure/roles - Get all roles
export async function GET(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient(request);
    if (!supabase) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all roles with department info
    const { data: roles, error } = await supabase
      .from('roles')
      .select('id, name, department_id')
      .order('name');

    if (error) {
      console.error('Error fetching roles:', error);
      return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 });
    }

    return NextResponse.json({ success: true, roles: roles || [] }, { status: 200 });
  } catch (error) {
    console.error('Error in GET /api/org-structure/roles:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
