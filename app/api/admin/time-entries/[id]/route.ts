import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient, getUserProfileFromRequest } from '@/lib/supabase-server';
import { hasPermission } from '@/lib/permission-checker';
import { Permission } from '@/lib/permissions';
import { checkDemoModeForDestructiveAction } from '@/lib/api-demo-guard';
import { logger } from '@/lib/debug-logger';
import { isValidUUID } from '@/lib/validation-helpers';

// Type definitions
interface ErrorWithMessage extends Error {
  message: string;
}

/**
 * PATCH /api/admin/time-entries/[id]
 * Update a time entry (hours, project, description)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!isValidUUID(id)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    const supabase = createApiSupabaseClient(request);

    if (!supabase) {
      return NextResponse.json(
        { success: false, error: 'Database connection not available' },
        { status: 500 }
      );
    }

    // Check authentication and permissions
    const userProfile = await getUserProfileFromRequest(supabase);
    if (!userProfile) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Admin edit requires VIEW_ALL_TIME_ENTRIES + MANAGE_TIME (view alone shouldn't grant write access)
    const canViewAll = await hasPermission(userProfile, Permission.VIEW_ALL_TIME_ENTRIES, undefined, supabase);
    const canManageTime = await hasPermission(userProfile, Permission.MANAGE_TIME, undefined, supabase);
    if (!canViewAll || !canManageTime) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    const { hours_logged, project_id, description } = body;

    // Validate hours
    if (hours_logged !== undefined) {
      const hours = parseFloat(hours_logged);
      if (isNaN(hours) || hours < 0) {
        return NextResponse.json(
          { success: false, error: 'Invalid hours value' },
          { status: 400 }
        );
      }
    }

    // Build update object
    const updateData: Record<string, unknown> = {};
    if (hours_logged !== undefined) updateData.hours_logged = parseFloat(hours_logged);
    if (project_id !== undefined) updateData.project_id = project_id || null;
    if (description !== undefined) updateData.description = description || null;

    // Update the time entry
    const { data, error } = await supabase
      .from('time_entries')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Error updating time entry', {}, error as unknown as Error);
      return NextResponse.json(
        { success: false, error: 'Failed to update time entry' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      timeEntry: data,
    });
  } catch (error: unknown) {
    const err = error as ErrorWithMessage;
    logger.error('Error in PATCH /api/admin/time-entries/[id]', {}, error as Error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/time-entries/[id]
 * Delete a time entry
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Block in demo mode
    const blocked = checkDemoModeForDestructiveAction('delete_time_entry');
    if (blocked) return blocked;

    const { id } = await params;
    if (!isValidUUID(id)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    const supabase = createApiSupabaseClient(request);

    if (!supabase) {
      return NextResponse.json(
        { success: false, error: 'Database connection not available' },
        { status: 500 }
      );
    }

    // Check authentication and permissions
    const userProfile = await getUserProfileFromRequest(supabase);
    if (!userProfile) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Admin delete requires VIEW_ALL_TIME_ENTRIES + MANAGE_TIME (view alone shouldn't grant delete access)
    const canViewAll = await hasPermission(userProfile, Permission.VIEW_ALL_TIME_ENTRIES, undefined, supabase);
    const canManageTime = await hasPermission(userProfile, Permission.MANAGE_TIME, undefined, supabase);
    if (!canViewAll || !canManageTime) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Delete the time entry
    const { error } = await supabase
      .from('time_entries')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Error deleting time entry', {}, error as unknown as Error);
      return NextResponse.json(
        { success: false, error: 'Failed to delete time entry' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Time entry deleted successfully',
    });
  } catch (error: unknown) {
    const err = error as ErrorWithMessage;
    logger.error('Error in DELETE /api/admin/time-entries/[id]', {}, error as Error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
