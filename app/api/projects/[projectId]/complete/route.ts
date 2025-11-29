import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabaseClient } from '@/lib/supabase-server'
import { hasPermission, isSuperadmin } from '@/lib/rbac'
import { Permission } from '@/lib/permissions'

/**
 * POST /api/projects/[projectId]/complete
 * Manually complete a project that doesn't have an active workflow
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params

    const supabase = createApiSupabaseClient(request)
    if (!supabase) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile with roles
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

    // Check if project exists
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, status, account_id, created_by, workflow_instance_id')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Verify project is not already complete
    if (project.status === 'complete') {
      return NextResponse.json({ error: 'Project is already completed' }, { status: 400 })
    }

    // Check if project has an active workflow - only allow manual completion for non-workflow projects
    if (project.workflow_instance_id) {
      // Verify the workflow is not active
      const { data: workflowInstance } = await supabase
        .from('workflow_instances')
        .select('id, status')
        .eq('id', project.workflow_instance_id)
        .single()

      if (workflowInstance && workflowInstance.status === 'active') {
        return NextResponse.json({
          error: 'Cannot manually complete a project with an active workflow. Use the workflow progression instead.'
        }, { status: 400 })
      }
    }

    // Check permissions - must be superadmin, have EDIT_ALL_PROJECTS, or be the project creator
    const userIsSuperadmin = isSuperadmin(userProfile)
    const hasEditAllProjects = await hasPermission(userProfile, Permission.EDIT_ALL_PROJECTS, undefined, supabase)
    const isProjectCreator = project.created_by === user.id

    if (!userIsSuperadmin && !hasEditAllProjects && !isProjectCreator) {
      return NextResponse.json({
        error: 'Only project creators or administrators can complete projects'
      }, { status: 403 })
    }

    // Complete the project:
    // 1. Set status to 'complete'
    // 2. Set completed_at timestamp
    // 3. Clear reopened_at (removes "re-opened" badge)
    const { error: updateError } = await supabase
      .from('projects')
      .update({
        status: 'complete',
        completed_at: new Date().toISOString(),
        reopened_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId)

    if (updateError) {
      console.error('Error completing project:', updateError)
      return NextResponse.json({ error: 'Failed to complete project' }, { status: 500 })
    }

    // Soft-delete all project assignments (set removed_at)
    const { error: assignmentError } = await supabase
      .from('project_assignments')
      .update({ removed_at: new Date().toISOString() })
      .eq('project_id', projectId)
      .is('removed_at', null)

    if (assignmentError) {
      console.error('Error updating project assignments:', assignmentError)
      // Don't fail the request, just log the error
    }

    return NextResponse.json({
      success: true,
      message: 'Project completed successfully'
    })

  } catch (error) {
    console.error('Error in POST /api/projects/[projectId]/complete:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
