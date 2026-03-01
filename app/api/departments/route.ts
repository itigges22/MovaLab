import { NextResponse, NextRequest } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';
import { requireAuthAndAnyPermission, requireAuthAndPermission, handleGuardError } from '@/lib/server-guards';
import { Permission } from '@/lib/permissions';
import { logger } from '@/lib/debug-logger';

export async function GET(request: NextRequest) {
  try {
    // Check authentication and permission
    await requireAuthAndAnyPermission([
      Permission.VIEW_DEPARTMENTS,
      Permission.VIEW_ALL_DEPARTMENTS
    ], undefined, request);

    const supabase = createApiSupabaseClient(request);
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    // Fetch all departments
    const { data: departments, error } = await supabase
      .from('departments')
      .select('id, name, description, created_at, updated_at')
      .order('name');

    if (error) {
      logger.error('Error fetching departments', {}, error as unknown as Error);
      return NextResponse.json({ error: 'Failed to fetch departments' }, { status: 500 });
    }

    return NextResponse.json(departments || []);
  } catch (error: unknown) {
    return handleGuardError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication and permission (consolidated from CREATE_DEPARTMENT)
    await requireAuthAndPermission(Permission.MANAGE_DEPARTMENTS, {}, request);

    const supabase = createApiSupabaseClient(request);
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    const { name, description } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Department name is required' }, { status: 400 });
    }

    if (name.trim().length > 100) {
      return NextResponse.json({ error: 'Department name must be 100 characters or less' }, { status: 400 });
    }

    if (description !== undefined && description !== null) {
      if (typeof description !== 'string') {
        return NextResponse.json({ error: 'Description must be a string' }, { status: 400 });
      }
      if (description.length > 500) {
        return NextResponse.json({ error: 'Description must be 500 characters or less' }, { status: 400 });
      }
    }

    const { data, error } = await supabase
      .from('departments')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating department', {}, error as unknown as Error);
      return NextResponse.json({ error: 'Failed to create department' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    return handleGuardError(error);
  }
}

