import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabaseClient } from '@/lib/supabase-server'
import { userHasProjectAccess } from '@/lib/rbac'
import { taskServiceDB, UpdateTaskData } from '@/lib/task-service-db'
import { checkDemoModeForDestructiveAction } from '@/lib/api-demo-guard'
import { logger } from '@/lib/debug-logger'

// Helper function to get task's project info
async function getTaskProject(supabase: any, taskId: string): Promise<{ project_id: string; status: string } | null> {
  const { data: task } = await supabase
    .from('tasks')
    .select('project_id, projects!inner(status)')
    .eq('id', taskId)
    .single()

  if (!task?.project_id) return null
  const projects = task.projects as Record<string, unknown> | Record<string, unknown>[];
  const projectData = Array.isArray(projects) ? projects[0] : projects;
  return {
    project_id: task.project_id as string,
    status: (projectData?.status as string) || 'unknown'
  }
}

// PUT /api/tasks/[taskId] - Update a task
// NOTE: Task permissions are now inherited from project access
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;

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

    // Get the task's project to check access
    const taskProject = await getTaskProject(supabase, taskId)
    if (!taskProject) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const hasAccess = await userHasProjectAccess(userProfile, taskProject.project_id, supabase)
    if (!hasAccess) {
      return NextResponse.json({ error: 'You do not have access to this project' }, { status: 403 })
    }

    // Check if project is completed (read-only mode)
    if (taskProject.status === 'complete') {
      return NextResponse.json({
        error: 'Cannot modify tasks in a completed project. The project is in read-only mode.'
      }, { status: 400 })
    }

    const body = await request.json()

    const updateData: UpdateTaskData = {
      id: taskId,
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.priority !== undefined && { priority: body.priority }),
      ...(body.start_date !== undefined && { start_date: body.start_date }),
      ...(body.due_date !== undefined && { due_date: body.due_date }),
      ...(body.estimated_hours !== undefined && { estimated_hours: body.estimated_hours }),
      ...(body.actual_hours !== undefined && { actual_hours: body.actual_hours }),
      ...(body.remaining_hours !== undefined && { remaining_hours: body.remaining_hours }),
      ...(body.assigned_to !== undefined && { assigned_to: body.assigned_to })
    }

    const task = await taskServiceDB.updateTask(updateData)

    if (!task) {
      // Check if task exists
      const { data: existingTask } = await supabase
        .from('tasks')
        .select('id')
        .eq('id', taskId)
        .single()

      if (!existingTask) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 })
      }

      logger.error('Failed to update task - possible permission issue:', { taskId, userId: user.id })
      return NextResponse.json({
        error: 'Failed to update task. You may not have permission to modify this task.'
      }, { status: 403 })
    }

    return NextResponse.json({ success: true, task })
  } catch (error: unknown) {
    const err = error as Error
    logger.error('Error in PUT /api/tasks/[taskId]:', {}, err)
    return NextResponse.json({
      error: 'Failed to update task'
    }, { status: 500 })
  }
}

// PATCH /api/tasks/[taskId] - Partially update a task (e.g., status change from Kanban)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;

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

    // Get the task's project to check access
    const taskProject = await getTaskProject(supabase, taskId)
    if (!taskProject) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const hasAccess = await userHasProjectAccess(userProfile, taskProject.project_id, supabase)
    if (!hasAccess) {
      return NextResponse.json({ error: 'You do not have access to this project' }, { status: 403 })
    }

    // Check if project is completed (read-only mode)
    if (taskProject.status === 'complete') {
      return NextResponse.json({
        error: 'Cannot modify tasks in a completed project. The project is in read-only mode.'
      }, { status: 400 })
    }

    const body = await request.json()

    // Build update object with only provided fields
    const updateFields: Record<string, unknown> = {}
    if (body.status !== undefined) updateFields.status = body.status
    if (body.name !== undefined) updateFields.name = body.name
    if (body.description !== undefined) updateFields.description = body.description
    if (body.priority !== undefined) updateFields.priority = body.priority
    if (body.start_date !== undefined) updateFields.start_date = body.start_date
    if (body.due_date !== undefined) updateFields.due_date = body.due_date
    if (body.estimated_hours !== undefined) updateFields.estimated_hours = body.estimated_hours
    if (body.actual_hours !== undefined) updateFields.actual_hours = body.actual_hours
    if (body.remaining_hours !== undefined) updateFields.remaining_hours = body.remaining_hours
    if (body.assigned_to !== undefined) updateFields.assigned_to = body.assigned_to
    if (body.display_order !== undefined) updateFields.display_order = body.display_order

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    // Update the task directly with Supabase
    const { data: task, error: updateError } = await supabase
      .from('tasks')
      .update(updateFields)
      .eq('id', taskId)
      .select(`
        *,
        created_by_user:user_profiles!created_by(id, name, email),
        assigned_to_user:user_profiles!assigned_to(id, name, email),
        project:projects(id, name)
      `)
      .single()

    if (updateError) {
      logger.error('Error updating task:', {}, updateError as unknown as Error)

      // Check for specific error types
      if (updateError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 })
      }

      if (updateError.code === '42501' || updateError.message?.includes('permission')) {
        return NextResponse.json({
          error: 'You do not have permission to update this task'
        }, { status: 403 })
      }

      // Check for foreign key violation (e.g., invalid assignee ID)
      if (updateError.code === '23503') {
        return NextResponse.json({
          error: 'Invalid assignee. The selected user does not exist.'
        }, { status: 400 })
      }

      return NextResponse.json({
        error: 'Failed to update task'
      }, { status: 500 })
    }

    return NextResponse.json({ success: true, task })
  } catch (error: unknown) {
    const err = error as Error
    logger.error('Error in PATCH /api/tasks/[taskId]:', {}, err)
    return NextResponse.json({
      error: 'Failed to update task'
    }, { status: 500 })
  }
}

// DELETE /api/tasks/[taskId] - Delete a task
// NOTE: Task permissions are now inherited from project access
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;

  try {
    // Block in demo mode
    const blocked = checkDemoModeForDestructiveAction('delete_task');
    if (blocked) return blocked;

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

    // Get the task's project to check access
    const taskProject = await getTaskProject(supabase, taskId)
    if (!taskProject) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const hasAccess = await userHasProjectAccess(userProfile, taskProject.project_id, supabase)
    if (!hasAccess) {
      return NextResponse.json({ error: 'You do not have access to this project' }, { status: 403 })
    }

    // Check if project is completed (read-only mode)
    if (taskProject.status === 'complete') {
      return NextResponse.json({
        error: 'Cannot delete tasks in a completed project. The project is in read-only mode.'
      }, { status: 400 })
    }

    const success = await taskServiceDB.deleteTask(taskId)

    if (!success) {
      return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    logger.error('Error in DELETE /api/tasks/[taskId]:', {}, error as Error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
