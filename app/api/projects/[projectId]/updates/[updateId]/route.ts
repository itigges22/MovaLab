import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';
import { userHasProjectAccess } from '@/lib/rbac';
import { logger } from '@/lib/debug-logger';
import { isValidUUID } from '@/lib/validation-helpers';

/**
 * PUT /api/projects/[projectId]/updates/[updateId]
 * Update a project update
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; updateId: string }> }
) {
  try {
    const { projectId, updateId } = await params;
    if (!isValidUUID(projectId) || !isValidUUID(updateId)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    const supabase = createApiSupabaseClient(request);
    if (!supabase) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select(`
        *,
        user_roles!user_roles_user_id_fkey (
          roles (
            id,
            name,
            permissions,
            department_id
          )
        )
      `)
      .eq('id', user.id)
      .single();

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Check project access - if user has access to the project, they can edit updates
    const hasAccess = await userHasProjectAccess(userProfile, projectId, supabase);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Insufficient permissions to edit updates' }, { status: 403 });
    }

    const body = await request.json();
    const { content } = body;

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Update content cannot be empty' }, { status: 400 });
    }

    // Only the creator can edit their update (or superadmin via RLS)
    const { data: update, error } = await supabase
      .from('project_updates')
      .update({
        content: content.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', updateId)
      .eq('project_id', projectId)
      .eq('created_by', user.id)
      .select(`
        *,
        user_profiles:user_profiles(id, name, email, image)
      `)
      .single();

    if (error) {
      logger.error('Error updating update:', {}, error as unknown as Error);
      return NextResponse.json({ error: 'Failed to update update' }, { status: 500 });
    }

    return NextResponse.json({ success: true, update });
  } catch (error: unknown) {
    logger.error('Error in PUT /api/projects/[projectId]/updates/[updateId]:', {}, error as Error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/projects/[projectId]/updates/[updateId]
 * Delete a project update
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; updateId: string }> }
) {
  try {
    const { projectId, updateId } = await params;
    if (!isValidUUID(projectId) || !isValidUUID(updateId)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    const supabase = createApiSupabaseClient(request);
    if (!supabase) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select(`
        *,
        user_roles!user_roles_user_id_fkey (
          roles (
            id,
            name,
            permissions,
            department_id
          )
        )
      `)
      .eq('id', user.id)
      .single();

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Check project access - if user has access to the project, they can delete updates
    const hasAccess = await userHasProjectAccess(userProfile, projectId, supabase);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Insufficient permissions to delete updates' }, { status: 403 });
    }

    // Only the creator can delete their update (or superadmin via RLS)
    const { error } = await supabase
      .from('project_updates')
      .delete()
      .eq('id', updateId)
      .eq('project_id', projectId)
      .eq('created_by', user.id);

    if (error) {
      logger.error('Error deleting update:', {}, error as unknown as Error);
      return NextResponse.json({ error: 'Failed to delete update' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error('Error in DELETE /api/projects/[projectId]/updates/[updateId]:', {}, error as Error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
