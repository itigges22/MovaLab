import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';
import { userHasProjectAccess } from '@/lib/rbac';
import { logger } from '@/lib/debug-logger';
import { isValidUUID } from '@/lib/validation-helpers';

/**
 * GET /api/projects/[projectId]/issues
 * Get all issues for a project
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    if (!isValidUUID(projectId)) {
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

    // Check project access - if user has access to the project, they can view issues
    const hasAccess = await userHasProjectAccess(userProfile, projectId, supabase);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Insufficient permissions to view issues' }, { status: 403 });
    }

    // Get issues with user info
    // Simplified query - workflow_history relationship is optional
    const { data: issues, error } = await supabase
      .from('project_issues')
      .select(`
        id,
        project_id,
        content,
        status,
        created_by,
        resolved_by,
        workflow_history_id,
        created_at,
        resolved_at,
        user_profiles:created_by(id, name, email, image),
        resolver_profiles:resolved_by(id, name, email, image)
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Error fetching issues:', {}, error as unknown as Error);
      return NextResponse.json({ error: 'Failed to fetch issues' }, { status: 500 });
    }

    return NextResponse.json({ issues: issues || [] });
  } catch (error: unknown) {
    logger.error('Error in GET /api/projects/[projectId]/issues:', {}, error as Error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/projects/[projectId]/issues
 * Create a new issue for a project
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    if (!isValidUUID(projectId)) {
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

    // Check project access - if user has access to the project, they can create issues
    const hasAccess = await userHasProjectAccess(userProfile, projectId, supabase);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Insufficient permissions to create issues' }, { status: 403 });
    }

    // Check if project is completed (read-only mode)
    const { data: project } = await supabase
      .from('projects')
      .select('status')
      .eq('id', projectId)
      .single();

    if (project?.status === 'complete') {
      return NextResponse.json({
        error: 'Cannot add issues to a completed project. The project is in read-only mode.'
      }, { status: 400 });
    }

    const body = await request.json();
    const { content } = body;

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Issue content is required' }, { status: 400 });
    }

    if (content.length > 5000) {
      return NextResponse.json({ error: 'Issue content must be 5000 characters or less' }, { status: 400 });
    }

    // Create issue
    const { data: issue, error } = await supabase
      .from('project_issues')
      .insert({
        project_id: projectId,
        content: content.trim(),
        created_by: user.id,
        status: 'open'
      })
      .select(`
        *,
        user_profiles:created_by(id, name, email, image)
      `)
      .single();

    if (error) {
      logger.error('Error creating issue:', {}, error as unknown as Error);
      return NextResponse.json({ error: 'Failed to create issue' }, { status: 500 });
    }

    // Add user as project collaborator if not already assigned
    const { data: existingAssignment } = await supabase
      .from('project_assignments')
      .select('id, removed_at')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single();

    if (!existingAssignment) {
      // Insert new assignment
      await supabase.from('project_assignments').insert({
        project_id: projectId,
        user_id: user.id,
        role_in_project: 'collaborator',
        assigned_by: user.id,
        source_type: 'manual'
      });
    } else if (existingAssignment.removed_at) {
      // Reactivate removed assignment
      await supabase
        .from('project_assignments')
        .update({ removed_at: null, role_in_project: 'collaborator', source_type: 'manual' })
        .eq('id', existingAssignment.id);
    }

    return NextResponse.json({ success: true, issue }, { status: 201 });
  } catch (error: unknown) {
    logger.error('Error in POST /api/projects/[projectId]/issues:', {}, error as Error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
