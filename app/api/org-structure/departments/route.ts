import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';

// GET /api/org-structure/departments - Get all departments
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

    // Get all departments
    const { data: departments, error } = await supabase
      .from('departments')
      .select('id, name')
      .order('name');

    if (error) {
      console.error('Error fetching departments:', error);
      return NextResponse.json({ error: 'Failed to fetch departments' }, { status: 500 });
    }

    return NextResponse.json({ success: true, departments: departments || [] }, { status: 200 });
  } catch (error: unknown) {
    console.error('Error in GET /api/org-structure/departments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
