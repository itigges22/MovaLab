'use client'

import { toast } from 'sonner';
import { useAuth } from '@/lib/hooks/useAuth'
import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RoleGuard } from '@/components/role-guard'
import { createClientSupabase } from '@/lib/supabase'
import { FolderOpen, Plus } from 'lucide-react'
import ProjectCreationDialog from '@/components/project-creation-dialog'
import { ProjectDataTable, ProjectTableData, ProjectStatus, ProjectPriority } from '@/components/project-data-table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useRouter } from 'next/navigation'
import { hasPermission, canViewProject, isSuperadmin } from '@/lib/rbac'
import { Permission } from '@/lib/permissions'

type Project = any
type Account = any
type Department = any

interface AssignedUserData {
  id: string
  name: string
  email?: string
  image?: string
}

interface ProjectWithDetails extends Project {
  account: Account
  departments: Department[]
  workflow_step?: string | null  // Current workflow step name
  assigned_users?: AssignedUserData[]  // Users assigned to this project
}


export default function ProjectsPage() {
  const { userProfile } = useAuth()
  const router = useRouter()
  const [projects, setProjects] = useState<ProjectWithDetails[]>([])
  const [visibleProjects, setVisibleProjects] = useState<ProjectWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [departmentFilter, setDepartmentFilter] = useState<string>('all')
  const [allDepartments, setAllDepartments] = useState<Department[]>([])
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<ProjectWithDetails | null>(null)
  const [deletingProject, setDeletingProject] = useState(false)
  const [canCreateProject, setCanCreateProject] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  // Handle project creation - simple optimistic update
  const handleProjectCreated = useCallback((newProject: any) => {
    if (newProject) {
      const projectWithDetails = {
        ...newProject,
        account: (newProject.account || {
          id: newProject.account_id as string,
          name: 'Loading...',
          description: null,
          primary_contact_email: null,
          primary_contact_name: null,
          account_manager_id: null,
          service_tier: null,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }) as Account,
        departments: [],
        workflow_step: null,
      } as unknown as ProjectWithDetails
      // Add directly to visibleProjects for immediate visibility
      setVisibleProjects(prev => [projectWithDetails, ...prev])
    }
    // Trigger background refresh after 500ms to get complete data
    setTimeout(() => {
      setRefreshKey(prev => prev + 1)
    }, 500)
  }, [])

  // Check create project permission (using consolidated MANAGE_PROJECTS)
  useEffect(() => {
    if (!userProfile) return;
    hasPermission(userProfile, Permission.MANAGE_PROJECTS).then(setCanCreateProject);
  }, [userProfile]);

  useEffect(() => {
    const loadProjects = async () => {
      if (!userProfile) return

      try {
        setLoading(true)
        const supabase = createClientSupabase()!
        if (!supabase) {
          throw new Error('Failed to create Supabase client')
        }

        // Get projects where user has access:
        // 1. Superadmins see all projects
        // 2. Projects they created
        // 3. Projects they're directly assigned to (assigned_user_id)
        // 4. Projects they're in via project_assignments
        // 5. Projects where they have tasks assigned

        // Check if user is superadmin (bypasses all permission checks)
        const userIsSuperadmin = isSuperadmin(userProfile)

        // Check if user has VIEW_ALL_PROJECTS permission using proper permission check
        const hasViewAllProjects = userIsSuperadmin || await hasPermission(userProfile, Permission.VIEW_ALL_PROJECTS)

        // First, get projects the user created or is directly assigned to
        let projectIds: string[] = []

        // Only need to gather project IDs if user doesn't have VIEW_ALL_PROJECTS
        if (!hasViewAllProjects) {
          // Get projects created by user or assigned to user
          const { data: directProjects } = await supabase
            .from('projects')
            .select('id')
            .or(`created_by.eq.${(userProfile as any).id},assigned_user_id.eq.${(userProfile as any).id}`)

          if (directProjects) {
            projectIds.push(...directProjects.map((p: { id: string }) => p.id))
          }

          // Get projects via project_assignments
          const { data: assignedProjects } = await supabase
            .from('project_assignments')
            .select('project_id')
            .eq('user_id', (userProfile as any).id)
            .is('removed_at', null)

          if (assignedProjects) {
            projectIds.push(...assignedProjects.map((p: { project_id: string }) => p.project_id))
          }

          // Get projects where user has tasks
          const { data: taskProjects } = await supabase
            .from('tasks')
            .select('project_id')
            .eq('assigned_to', (userProfile as any).id)

          if (taskProjects) {
            projectIds.push(...taskProjects.map((t: { project_id: string }) => t.project_id))
          }

          // Remove duplicates
          projectIds = Array.from(new Set(projectIds))
        }

        // Build query
        let query = supabase
          .from('projects')
          .select(`
            *,
            account:accounts(*)
          `)

        // Filter by accessible projects unless user has VIEW_ALL_PROJECTS or is superadmin
        if (!hasViewAllProjects && projectIds.length > 0) {
          query = query.in('id', projectIds)
        } else if (!hasViewAllProjects && projectIds.length === 0) {
          // No accessible projects
          query = query.eq('id', '00000000-0000-0000-0000-000000000000')
        }

        // Exclude completed projects - they go to "Finished Projects" on account page
        query = query.neq('status', 'complete')

        const { data, error: queryError } = await query

        if (queryError) {
          throw queryError
        }

        // Get departments for each project via project_assignments
        const fetchedProjectIds = (data || []).map((p: any) => p.id)
        const departmentsByProject: { [key: string]: Record<string, unknown>[] } = {}

        if (fetchedProjectIds.length > 0) {
          // First, get all project assignments to get user_ids
          const { data: assignments } = await supabase
            .from('project_assignments')
            .select('project_id, user_id')
            .in('project_id', fetchedProjectIds)
            .is('removed_at', null)

          if (assignments && assignments.length > 0) {
            // Get unique user IDs
            const userIds = Array.from(new Set(assignments.map((a: any) => a.user_id)))

            // Get user roles with department info for these users
            const { data: userRoles } = await supabase
              .from('user_roles')
              .select(`
                user_id,
                roles!user_roles_role_id_fkey (
                  department_id,
                  departments!roles_department_id_fkey (
                    id,
                    name
                  )
                )
              `)
              .in('user_id', userIds)

            // Build a map of user_id to departments
            const userDepartments: { [key: string]: Record<string, unknown>[] } = {}
            if (userRoles) {
              userRoles.forEach((ur: any) => {
                const userId = ur.user_id as string
                if (!userDepartments[userId]) {
                  userDepartments[userId] = []
                }
                const role = ur.roles as Record<string, unknown> | undefined
                if (role && role.departments) {
                  const dept = role.departments as Record<string, unknown>
                  const exists = userDepartments[userId].some((d: any) => d.id === dept.id)
                  if (!exists) {
                    userDepartments[userId].push(dept)
                  }
                }
              })
            }

            // Map departments to projects based on assigned users
            assignments.forEach((assignment: any) => {
              const projectId = assignment.project_id as string
              const userId = assignment.user_id as string

              if (!departmentsByProject[projectId]) {
                departmentsByProject[projectId] = []
              }

              const depts = userDepartments[userId] || []
              depts.forEach((dept: any) => {
                const exists = departmentsByProject[projectId].some((d: any) => d.id === dept.id)
                if (!exists) {
                  departmentsByProject[projectId].push(dept)
                }
              })
            })
          }
        }

        // Get workflow step info for each project
        const workflowSteps: { [key: string]: string | null } = {}
        if (fetchedProjectIds.length > 0) {
          const { data: workflowData } = await supabase
            .from('workflow_instances')
            .select(`
              project_id,
              current_node_id,
              workflow_nodes!workflow_instances_current_node_id_fkey (
                label
              )
            `)
            .in('project_id', fetchedProjectIds)
            .eq('status', 'active')

          if (workflowData) {
            workflowData.forEach((wi: any) => {
              const projectId = wi.project_id as string
              if (projectId) {
                const workflowNode = wi.workflow_nodes as Record<string, unknown> | undefined
                workflowSteps[projectId] = (workflowNode?.label as string) || null
              }
            })
          }
        }

        // Get assigned users for each project
        const assignedUsersByProject: { [key: string]: AssignedUserData[] } = {}
        if (fetchedProjectIds.length > 0) {
          const { data: projectAssignments } = await supabase
            .from('project_assignments')
            .select(`
              project_id,
              user_profiles!project_assignments_user_id_fkey (
                id,
                name,
                email,
                image
              )
            `)
            .in('project_id', fetchedProjectIds)
            .is('removed_at', null)

          if (projectAssignments) {
            projectAssignments.forEach((pa: any) => {
              const projectId = pa.project_id as string
              if (!assignedUsersByProject[projectId]) {
                assignedUsersByProject[projectId] = []
              }
              if (pa.user_profiles) {
                const user = pa.user_profiles as any
                // Avoid duplicates
                if (!assignedUsersByProject[projectId].some(u => u.id === user.id)) {
                  assignedUsersByProject[projectId].push({
                    id: user.id,
                    name: user.name || 'Unknown',
                    email: user.email,
                    image: user.image
                  })
                }
              }
            })
          }
        }

        // Transform the data to include departments, workflow step, and assigned users
        const projectsWithDetails: ProjectWithDetails[] = (data || []).map((project: any) => {
          const projectId = project.id as string
          return {
            ...project,
            departments: departmentsByProject[projectId] || [],
            workflow_step: workflowSteps[projectId] || null,
            assigned_users: assignedUsersByProject[projectId] || []
          } as unknown as ProjectWithDetails
        })

        setProjects(projectsWithDetails)

        // Extract unique departments from all projects for the filter dropdown
        const departmentsMap = new Map<string, Department>()
        projectsWithDetails.forEach((project: any) => {
          project.departments.forEach((dept: any) => {
            if (!departmentsMap.has(dept.id)) {
              departmentsMap.set(dept.id, dept)
            }
          })
        })
        setAllDepartments(Array.from(departmentsMap.values()).sort((a, b) => a.name.localeCompare(b.name)))
      } catch (err: unknown) {
        console.error('Error loading projects:', err)
        setError(err instanceof Error ? err.message : 'Failed to load projects')
      } finally {
        setLoading(false)
      }
    }

    loadProjects()
  }, [userProfile, refreshKey])

  // Filter projects based on permissions - ONLY runs on login or explicit refresh
  // This prevents race conditions with optimistic updates
  const filterProjects = useCallback(async () => {
    const filtered: ProjectWithDetails[] = []
    const hasViewAllProjects = await hasPermission(userProfile, Permission.VIEW_ALL_PROJECTS)
    const hasViewProjects = await hasPermission(userProfile, Permission.VIEW_PROJECTS)

    for (const project of projects) {
      if (hasViewAllProjects) {
        filtered.push(project)
        continue
      }

      if (hasViewProjects) {
        const canView = await canViewProject(userProfile, project.id)
        if (canView) {
          filtered.push(project)
        }
      }
    }

    setVisibleProjects(filtered)
  }, [userProfile, projects])

  useEffect(() => {
    if (!userProfile || loading) return

    if (projects.length === 0) {
      setVisibleProjects([])
      return
    }

    filterProjects()
  }, [userProfile, refreshKey, loading, projects, filterProjects])

  // Status colors removed - projects now use workflow steps

  // Transform projects to ProjectTableData format for the new table component
  const transformToTableData = (projects: ProjectWithDetails[]): ProjectTableData[] => {
    return projects.map((project) => ({
      id: project.id,
      name: project.name,
      workflowStep: project.workflow_step || undefined,
      priority: (project.priority || 'medium') as ProjectPriority,
      account: project.account?.name,
      accountId: project.account_id,
      hours: {
        estimated: project.estimated_hours,
        actual: project.actual_hours,
        remaining: project.remaining_hours
      },
      deadline: project.end_date,
      assignedUsers: (project.assigned_users || []).map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image
      })),
      status: (project.status || 'planning') as ProjectStatus
    }))
  }

  // Check if user can delete a project
  const canDeleteProject = async (project: ProjectWithDetails): Promise<boolean> => {
    if (!userProfile) return false

    // Check if user has DELETE_ALL_PROJECTS or MANAGE_ALL_PROJECTS permission (overrides)
    const hasDeleteAll = await hasPermission(userProfile, Permission.MANAGE_ALL_PROJECTS) ||
                         await hasPermission(userProfile, Permission.MANAGE_ALL_PROJECTS)
    if (hasDeleteAll) return true

    // Check if user has MANAGE_PROJECTS permission (consolidated from DELETE_PROJECT)
    const hasManage = await hasPermission(userProfile, Permission.MANAGE_PROJECTS)
    if (!hasManage) return false

    // If user has MANAGE_PROJECTS, check if they have access to this project
    // (they should, since it's in their visible projects list)
    return visibleProjects.some((p: any) => p.id === project.id)
  }

  // Handle project deletion
  const handleDeleteProject = async () => {
    if (!projectToDelete || !userProfile) return

    try {
      setDeletingProject(true)

      // Double-check permissions
      const canDelete = await canDeleteProject(projectToDelete)
      if (!canDelete) {
        toast.error('You do not have permission to delete this project')
        return
      }

      const supabase = createClientSupabase()!
      if (!supabase) {
        throw new Error('Failed to create Supabase client')
      }

      // Delete the project
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectToDelete.id)

      if (error) {
        throw error
      }

      // Update local state to remove the deleted project
      setProjects(projects.filter((p: any) => p.id !== projectToDelete.id))
      setVisibleProjects(visibleProjects.filter((p: any) => p.id !== projectToDelete.id))

      // Close dialog and reset state
      setDeleteDialogOpen(false)
      setProjectToDelete(null)
    } catch (error: unknown) {
      console.error('Error deleting project:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      toast.error(`Failed to delete project: ${errorMessage}`)
    } finally {
      setDeletingProject(false)
    }
  }

  // Filter projects by department (use visibleProjects which are already permission-filtered)
  const filteredProjects = visibleProjects
    .filter((project: any) => {
      if (departmentFilter !== 'all' && !project.departments.some((dept: any) => dept.id === departmentFilter)) return false
      return true
    })

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading projects...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Error</h1>
          <p className="text-gray-600 mt-2">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <RoleGuard>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
            <p className="text-gray-600 mt-1">
              View and manage all projects
            </p>
          </div>
          {canCreateProject && (
            <ProjectCreationDialog
              onProjectCreated={handleProjectCreated}
            >
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Project
              </Button>
            </ProjectCreationDialog>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5" />
              Project Management
            </CardTitle>
            <CardDescription>
              All projects you have access to
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
                {visibleProjects.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <FolderOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Projects Found</h3>
                    <p className="text-sm">You don&apos;t have access to any projects yet, or no projects have been created.</p>
                  </div>
                ) : (
                  <>
                    {/* Department Filter */}
                    {allDepartments.length > 0 && (
                      <div className="mb-4">
                        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Filter by Department" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Departments</SelectItem>
                            {allDepartments.map((dept: any) => (
                              <SelectItem key={dept.id} value={dept.id}>
                                {dept.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Projects Table */}
                    <ProjectDataTable
                      projects={transformToTableData(filteredProjects)}
                      defaultVisibleColumns={['name', 'workflowStep', 'priority', 'account', 'hours', 'deadline', 'assignedUsers', 'status']}
                      onRowClick={(project) => router.push(`/projects/${project.id}`)}
                    />
                  </>
                )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the project &quot;{projectToDelete?.name}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false)
                setProjectToDelete(null)
              }}
              disabled={deletingProject}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteProject}
              disabled={deletingProject}
            >
              {deletingProject ? 'Deleting...' : 'Delete Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleGuard>
  )
}
