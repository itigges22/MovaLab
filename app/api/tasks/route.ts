import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabaseClient } from '@/lib/supabase-server'
import { userHasProjectAccess } from '@/lib/rbac'
import { logger } from '@/lib/debug-logger'

// POST /api/tasks - Create a new task
// NOTE: Task permissions are now inherited from project access
// If user has access to the project, they can create/edit/delete tasks within it
export async function POST(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient(request)
    if (!supabase) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })
    }

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
      .single()

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    const body = await request.json()

    // Require project_id — tasks must belong to a project
    if (!body.project_id) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 })
    }

    // Require task name
    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return NextResponse.json({ error: 'Task name is required' }, { status: 400 })
    }

    // Task permissions are inherited from project access
    {
      const hasAccess = await userHasProjectAccess(userProfile, body.project_id, supabase)
      if (!hasAccess) {
        return NextResponse.json({ error: 'You do not have access to this project' }, { status: 403 })
      }

      // Check if project is completed (read-only mode)
      const { data: project } = await supabase
        .from('projects')
        .select('status')
        .eq('id', body.project_id)
        .single()

      if (project?.status === 'complete') {
        return NextResponse.json({
          error: 'Cannot create tasks in a completed project. The project is in read-only mode.'
        }, { status: 400 })
      }
    }

    // Create task directly using the server-side Supabase client (not the client-side taskServiceDB)
    const taskInsert = {
      name: body.name,
      description: body.description || null,
      project_id: body.project_id,
      status: body.status || 'backlog',
      priority: body.priority || 'medium',
      start_date: body.start_date || null,
      due_date: body.due_date || null,
      estimated_hours: body.estimated_hours !== undefined ? body.estimated_hours : null,
      remaining_hours: body.estimated_hours !== undefined ? body.estimated_hours : null,
      actual_hours: 0,
      created_by: user.id,
      assigned_to: body.assigned_to || null
    }

    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .insert(taskInsert)
      .select(`
        *,
        created_by_user:user_profiles!created_by(id, name, email),
        assigned_to_user:user_profiles!assigned_to(id, name, email),
        project:projects(id, name)
      `)
      .single()

    if (taskError) {
      logger.error('Error creating task:', {}, taskError as unknown as Error)
      return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
    }

    // Add user as project collaborator if not already assigned
    if (body.project_id) {
      const { data: existingAssignment } = await supabase
        .from('project_assignments')
        .select('id, removed_at')
        .eq('project_id', body.project_id)
        .eq('user_id', user.id)
        .single()

      if (!existingAssignment) {
        // Insert new assignment
        await supabase.from('project_assignments').insert({
          project_id: body.project_id,
          user_id: user.id,
          role_in_project: 'collaborator',
          assigned_by: user.id
        })
      } else if (existingAssignment.removed_at) {
        // Reactivate removed assignment
        await supabase
          .from('project_assignments')
          .update({ removed_at: null, role_in_project: 'collaborator' })
          .eq('id', existingAssignment.id)
      }
    }

    return NextResponse.json({ success: true, task }, { status: 201 })
  } catch (error: unknown) {
    logger.error('Error in POST /api/tasks:', {}, error as Error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
