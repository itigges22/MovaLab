import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabaseClient } from '@/lib/supabase-server'
import { hasPermission, isSuperadmin } from '@/lib/rbac'
import { Permission } from '@/lib/permissions'

/**
 * GET /api/projects/[projectId]/assignments
 * Get all active project assignments (team members)
 */
export async function GET(
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

    // Get active assignments with user details
    const { data: assignments, error } = await supabase
      .from('project_assignments')
      .select(`
        id,
        user_id,
        role_in_project,
        assigned_at,
        assigned_by,
        user_profiles:user_id (
          id,
          name,
          email,
          image
        )
      `)
      .eq('project_id', projectId)
      .is('removed_at', null)
      .order('assigned_at', { ascending: false })

    if (error) {
      console.error('Error fetching project assignments:', error)
      return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 })
    }

    return NextResponse.json({ assignments: assignments || [] })

  } catch (error) {
    console.error('Error in GET /api/projects/[projectId]/assignments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/projects/[projectId]/assignments
 * Add a new team member to the project
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const body = await request.json()
    const { userId, roleInProject } = body

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

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

    // Get project details
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, status, created_by')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Can't add members to completed projects
    if (project.status === 'complete') {
      return NextResponse.json({ error: 'Cannot add members to a completed project' }, { status: 400 })
    }

    // Check permissions
    const userIsSuperadmin = isSuperadmin(userProfile)
    const hasEditAllProjects = await hasPermission(userProfile, Permission.EDIT_ALL_PROJECTS, undefined, supabase)
    const isProjectCreator = project.created_by === user.id

    if (!userIsSuperadmin && !hasEditAllProjects && !isProjectCreator) {
      return NextResponse.json({
        error: 'Only project creators or administrators can add team members'
      }, { status: 403 })
    }

    // Check if user is already assigned (including soft-deleted)
    const { data: existingAssignment } = await supabase
      .from('project_assignments')
      .select('id, removed_at')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .single()

    if (existingAssignment) {
      if (existingAssignment.removed_at === null) {
        return NextResponse.json({ error: 'User is already assigned to this project' }, { status: 400 })
      }

      // Reactivate the existing assignment
      const { error: updateError } = await supabase
        .from('project_assignments')
        .update({
          removed_at: null,
          role_in_project: roleInProject || 'member'
        })
        .eq('id', existingAssignment.id)

      if (updateError) {
        console.error('Error reactivating assignment:', updateError)
        return NextResponse.json({ error: 'Failed to add team member' }, { status: 500 })
      }
    } else {
      // Create new assignment
      const { error: insertError } = await supabase
        .from('project_assignments')
        .insert({
          project_id: projectId,
          user_id: userId,
          role_in_project: roleInProject || 'member',
          assigned_by: user.id
        })

      if (insertError) {
        console.error('Error creating assignment:', insertError)
        return NextResponse.json({ error: 'Failed to add team member' }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, message: 'Team member added successfully' })

  } catch (error) {
    console.error('Error in POST /api/projects/[projectId]/assignments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/projects/[projectId]/assignments
 * Remove a team member from the project (soft delete)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

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

    // Get project details
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, status, created_by')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Can't remove members from completed projects
    if (project.status === 'complete') {
      return NextResponse.json({ error: 'Cannot remove members from a completed project' }, { status: 400 })
    }

    // Check permissions
    const userIsSuperadmin = isSuperadmin(userProfile)
    const hasEditAllProjects = await hasPermission(userProfile, Permission.EDIT_ALL_PROJECTS, undefined, supabase)
    const isProjectCreator = project.created_by === user.id

    if (!userIsSuperadmin && !hasEditAllProjects && !isProjectCreator) {
      return NextResponse.json({
        error: 'Only project creators or administrators can remove team members'
      }, { status: 403 })
    }

    // Soft delete the assignment
    const { error: updateError } = await supabase
      .from('project_assignments')
      .update({ removed_at: new Date().toISOString() })
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .is('removed_at', null)

    if (updateError) {
      console.error('Error removing assignment:', updateError)
      return NextResponse.json({ error: 'Failed to remove team member' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Team member removed successfully' })

  } catch (error) {
    console.error('Error in DELETE /api/projects/[projectId]/assignments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
