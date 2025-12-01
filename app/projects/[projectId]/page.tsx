'use client'

import { useAuth } from '@/lib/hooks/useAuth'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, notFound, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { RoleGuard } from '@/components/role-guard'
import { createClientSupabase } from '@/lib/supabase'
import { Database } from '@/lib/supabase'
import { ArrowLeft, Calendar, Clock, User, Building2, FolderOpen, Users, AlertCircle, FileText, AlertTriangle, Edit, Plus as PlusIcon, XCircle, CheckCircle2, List, LayoutGrid, GanttChart, RotateCcw, UserPlus, Trash2, Loader2, StickyNote, Pencil } from 'lucide-react'
import Link from 'next/link'
import TaskCreationDialog from '@/components/task-creation-dialog'
import TaskCreateEditDialog from '@/components/task-create-edit-dialog'
import { projectUpdatesService, ProjectUpdate } from '@/lib/project-updates-service'
import { projectIssuesService, ProjectIssue } from '@/lib/project-issues-service'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDistance } from 'date-fns'
import { accountService } from '@/lib/account-service'
import { taskServiceDB, Task } from '@/lib/task-service-db'
import { Permission } from '@/lib/permissions'
import { hasPermission } from '@/lib/rbac'
import { toast } from 'sonner'
import { WorkflowProgressButton } from '@/components/workflow-progress-button'
import { WorkflowTimeline } from '@/components/workflow-timeline'

type Project = Database['public']['Tables']['projects']['Row']
type Account = Database['public']['Tables']['accounts']['Row']
type Department = Database['public']['Tables']['departments']['Row']
type UserProfile = Database['public']['Tables']['user_profiles']['Row']

interface Stakeholder {
  id: string
  user_id: string
  role: string | null
  user_profiles: {
    id: string
    name: string
    email: string
    image: string | null
  } | null
}

interface ProjectWithDetails extends Project {
  account: Account
  departments: Department[]
  assigned_user: UserProfile | null
  stakeholders: Stakeholder[]
  updates?: string | null
  issues_roadblocks?: string | null
  workflow_instance_id?: string | null
  completed_at?: string | null
  reopened_at?: string | null
  notes?: string | null
}

// Task item component - shows task details and progress
interface TaskItemProps {
  task: Task
  canEditTasks: boolean
  onEdit: (task: Task) => void
  onDelete: (taskId: string) => void
}

function TaskItem({
  task,
  canEditTasks,
  onEdit,
  onDelete
}: TaskItemProps) {
  // Calculate progress based on actual hours logged
  const actualHours = task.actual_hours || 0
  const estimatedHours = task.estimated_hours || 0
  const progressPercent = estimatedHours > 0 ? Math.min(100, Math.round((actualHours / estimatedHours) * 100)) : 0

  return (
    <div className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-gray-900">{task.name}</h4>
            <Badge className={`text-xs ${
              task.priority === 'urgent' ? 'bg-red-100 text-red-800' :
              task.priority === 'high' ? 'bg-orange-100 text-orange-800' :
              task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
              'bg-green-100 text-green-800'
            }`}>
              {task.priority}
            </Badge>
            <Badge className={`text-xs ${
              task.status === 'done' ? 'bg-green-100 text-green-800' :
              task.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
              task.status === 'review' ? 'bg-purple-100 text-purple-800' :
              task.status === 'blocked' ? 'bg-red-100 text-red-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {task.status.replace('_', ' ')}
            </Badge>
          </div>
          {task.description && (
            <p className="text-sm text-gray-600 mb-2">{task.description}</p>
          )}
          <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
            {task.created_by_user && (
              <span>Created by: {task.created_by_user.name}</span>
            )}
            {task.start_date && task.due_date && (
              <span>
                {new Date(task.start_date).toLocaleDateString()} - {new Date(task.due_date).toLocaleDateString()}
              </span>
            )}
            {task.estimated_hours && (
              <span>Est: {task.estimated_hours}h</span>
            )}
            {task.actual_hours > 0 && (
              <span>Actual: {task.actual_hours}h</span>
            )}
          </div>
          {task.estimated_hours !== null && task.estimated_hours > 0 && (
            <div className="flex flex-col gap-2 mt-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-gray-700">
                  Time Logged
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-blue-600">
                    {actualHours.toFixed(1)}h
                  </span>
                  <span className="text-xs text-gray-500">
                    / {estimatedHours}h
                  </span>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    progressPercent >= 100 ? 'bg-green-500' :
                    progressPercent >= 75 ? 'bg-blue-500' :
                    progressPercent >= 50 ? 'bg-yellow-500' :
                    'bg-gray-400'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>0h</span>
                <span className="font-medium">
                  {progressPercent}% complete
                </span>
                <span>{estimatedHours}h</span>
              </div>
            </div>
          )}
        </div>
        {canEditTasks && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(task)}
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(task.id)}
              className="text-red-600 hover:text-red-700"
            >
              <XCircle className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ProjectDetailPage() {
  const { userProfile } = useAuth()
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string
  const [project, setProject] = useState<ProjectWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [canEditProject, setCanEditProject] = useState(false)
  
  // Project Updates State
  const [projectUpdates, setProjectUpdates] = useState<ProjectUpdate[]>([])
  const [loadingUpdates, setLoadingUpdates] = useState(false)
  const [showNewUpdateForm, setShowNewUpdateForm] = useState(false)
  const [newUpdateContent, setNewUpdateContent] = useState('')
  const [submittingUpdate, setSubmittingUpdate] = useState(false)

  // Project Issues State
  const [projectIssues, setProjectIssues] = useState<ProjectIssue[]>([])
  const [loadingIssues, setLoadingIssues] = useState(false)
  const [showNewIssueForm, setShowNewIssueForm] = useState(false)
  const [newIssueContent, setNewIssueContent] = useState('')
  const [submittingIssue, setSubmittingIssue] = useState(false)

  // Project Notes State
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesContent, setNotesContent] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  // Task State
  const [tasks, setTasks] = useState<Task[]>([])
  const tasksRef = useRef<Task[]>([])

  // Project ref to avoid stale closures in intervals
  const projectRef = useRef<ProjectWithDetails | null>(null)

  // Helper to update tasks and ref atomically (prevents stale closure issues)
  const updateTasks = (updater: Task[] | ((prev: Task[]) => Task[])) => {
    setTasks(prev => {
      const newTasks = typeof updater === 'function' ? updater(prev) : updater
      tasksRef.current = newTasks
      return newTasks
    })
  }

  const [loadingTasks, setLoadingTasks] = useState(false)
  const [canViewTasks, setCanViewTasks] = useState(false)
  const [canCreateTasks, setCanCreateTasks] = useState(false)
  const [canEditTasks, setCanEditTasks] = useState(false)
  const [editTaskDialogOpen, setEditTaskDialogOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [taskViewMode, setTaskViewMode] = useState<'list' | 'kanban' | 'gantt'>('list')
  const [kanbanDialogOpen, setKanbanDialogOpen] = useState(false)
  const [ganttDialogOpen, setGanttDialogOpen] = useState(false)
  const [ganttViewMode, setGanttViewMode] = useState<'daily' | 'weekly' | 'monthly' | 'quarterly'>('weekly')
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [calculatedEstimatedHours, setCalculatedEstimatedHours] = useState<number | null>(null)
  const [calculatedRemainingHours, setCalculatedRemainingHours] = useState<number | null>(null)
  const [projectLevelHours, setProjectLevelHours] = useState<number>(0) // Hours logged directly to project (no task)

  // Project estimated hours state
  const [projectEstimatedHours, setProjectEstimatedHours] = useState<string>('')
  const [savingProjectHours, setSavingProjectHours] = useState(false)

  // Workflow refresh key - increment to force reload of workflow components
  const [workflowRefreshKey, setWorkflowRefreshKey] = useState(0)

  // Workflow step name to display as status
  const [workflowStepName, setWorkflowStepName] = useState<string | null>(null)

  // Update and Issue permissions (separate from canEditProject)
  const [canCreateUpdate, setCanCreateUpdate] = useState(false)
  const [canCreateIssue, setCanCreateIssue] = useState(false)
  const [canEditIssue, setCanEditIssue] = useState(false)

  // Reopen project state
  const [reopeningProject, setReopeningProject] = useState(false)

  // Complete project state (for non-workflow projects)
  const [completingProject, setCompletingProject] = useState(false)

  // Team Members management state
  const [teamMembers, setTeamMembers] = useState<Array<{
    id: string
    user_id: string
    role_in_project: string | null
    user_profiles: { id: string; name: string; email: string; image: string | null } | null
  }>>([])
  const [loadingTeamMembers, setLoadingTeamMembers] = useState(false)
  const [addingMember, setAddingMember] = useState(false)
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null)
  const [showAddMemberDropdown, setShowAddMemberDropdown] = useState(false)
  const [availableUsers, setAvailableUsers] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [loadingAvailableUsers, setLoadingAvailableUsers] = useState(false)

  // Status options removed - status is now managed by workflows

  // Task permissions are now inherited from project access
  // If user can access this project page, they can manage tasks within it
  useEffect(() => {
    if (!userProfile) return

    // Since user has access to view this project page, they can manage tasks
    // Task permissions are inherited from project access
    setCanViewTasks(true)
    setCanCreateTasks(true)
    setCanEditTasks(true)
    loadTasks()
  }, [userProfile, projectId])

  // Keep projectRef in sync with project state (for use in intervals to avoid stale closures)
  useEffect(() => {
    projectRef.current = project
  }, [project])

  // Auto-refresh tasks every 30 seconds for live progress bar updates
  // Note: Uses projectRef.current to avoid restarting the interval when project state changes
  useEffect(() => {
    if (!projectId || !userProfile) return

    const intervalId = setInterval(async () => {
      try {
        // Silently refresh tasks without showing loading state
        const projectTasks = await taskServiceDB.getTasksByProject(projectId)
        updateTasks(projectTasks)
        // Use projectRef.current to get latest project value without adding to dependencies
        const calculatedHours = calculateEstimatedHours(projectTasks, projectRef.current)
        const remainingHours = calculateRemainingHours(projectTasks)
        setCalculatedEstimatedHours(calculatedHours)
        setCalculatedRemainingHours(remainingHours)

        // Also refresh project-level time entries
        const supabase = createClientSupabase()
        if (supabase) {
          const { data: projectTimeEntries } = await supabase
            .from('time_entries')
            .select('hours_logged')
            .eq('project_id', projectId)
            .is('task_id', null)

          const projectHours = projectTimeEntries?.reduce((sum: number, entry: { hours_logged: number | null }) => sum + (entry.hours_logged || 0), 0) || 0
          setProjectLevelHours(projectHours)
        }
      } catch (err) {
        console.error('Error auto-refreshing tasks:', err)
      }
    }, 30000) // 30 seconds

    return () => clearInterval(intervalId)
  }, [projectId, userProfile])

  // Check update and issue permissions (separate from edit project permission)
  // Uses async hasPermission() for proper superadmin bypass, caching, and permission evaluation
  useEffect(() => {
    if (!userProfile) return

    const checkPermissions = async () => {
      const [canCreateUpdate, canCreateIssue, canEditIssue] = await Promise.all([
        hasPermission(userProfile, Permission.CREATE_UPDATE),
        hasPermission(userProfile, Permission.CREATE_ISSUE),
        hasPermission(userProfile, Permission.EDIT_ISSUE)
      ])

      setCanCreateUpdate(canCreateUpdate)
      setCanCreateIssue(canCreateIssue)
      setCanEditIssue(canEditIssue)
    }

    checkPermissions()
  }, [userProfile])

  // Calculate estimated hours based on tasks
  const calculateEstimatedHours = (projectTasks: Task[], projectData?: ProjectWithDetails | null) => {
    if (projectTasks.length === 0) {
      // If no tasks, use project-level estimated_hours
      return projectData?.estimated_hours || project?.estimated_hours || null
    } else {
      // Sum up all task estimated_hours
      const total = projectTasks.reduce((sum, task) => {
        return sum + (task.estimated_hours || 0)
      }, 0)
      return total > 0 ? total : null
    }
  }

  // Calculate remaining hours based on tasks
  const calculateRemainingHours = (projectTasks: Task[]) => {
    if (projectTasks.length === 0) {
      return null
    }
    // Sum up all task remaining_hours
    const total = projectTasks.reduce((sum, task) => {
      return sum + (task.remaining_hours || 0)
    }, 0)
    return total
  }

  // Load tasks and project-level time entries
  const loadTasks = async () => {
    if (!projectId) return

    setLoadingTasks(true)
    try {
      // Get tasks for this specific project
      const projectTasks = await taskServiceDB.getTasksByProject(projectId)
      updateTasks(projectTasks)

      // Calculate estimated and remaining hours based on tasks
      const calculatedHours = calculateEstimatedHours(projectTasks, project)
      const remainingHours = calculateRemainingHours(projectTasks)
      setCalculatedEstimatedHours(calculatedHours)
      setCalculatedRemainingHours(remainingHours)

      // Also fetch project-level time entries (logged to project without a specific task)
      const supabase = createClientSupabase()
      if (supabase) {
        const { data: projectTimeEntries } = await supabase
          .from('time_entries')
          .select('hours_logged')
          .eq('project_id', projectId)
          .is('task_id', null)

        const projectHours = projectTimeEntries?.reduce((sum: number, entry: { hours_logged: number | null }) => sum + (entry.hours_logged || 0), 0) || 0
        setProjectLevelHours(projectHours)
      }
    } catch (error) {
      console.error('Error loading tasks:', error)
    } finally {
      setLoadingTasks(false)
    }
  }

  useEffect(() => {
    const loadProject = async () => {
      if (!userProfile || !projectId) return

      try {
        setLoading(true)
        // ⚠️ Force create a FRESH Supabase client (not singleton) to ensure auth token is present
        const { createBrowserClient } = await import('@supabase/ssr')
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )

        // Verify auth session
        const { data: sessionData } = await supabase.auth.getSession()
        console.log('🔐 Auth check in loadProject:', {
          hasSession: !!sessionData.session,
          userId: sessionData.session?.user?.id,
          email: sessionData.session?.user?.email
        })

        // Fetch project with all related data
        const { data, error: queryError } = await supabase
          .from('projects')
          .select(`
            *,
            account:accounts(*)
          `)
          .eq('id', projectId)
          .single()

        if (queryError) {
          throw queryError
        }

        if (!data) {
          throw new Error('Project not found')
        }

        // Fetch assigned user details
        let assignedUser = null
        if (data.assigned_user_id) {
          const { data: userData } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', data.assigned_user_id)
            .single()
          assignedUser = userData
        }

        // Fetch stakeholders using SQL function (bypasses RLS - this is the reliable method)
        console.log('🔍 Fetching stakeholders for project via SQL function:', projectId)
        const { data: stakeholdersRawData, error: stakeholdersError } = await supabase
          .rpc('get_project_stakeholders', { project_uuid: projectId })

        console.log('📊 Stakeholders query result:', {
          dataLength: stakeholdersRawData?.length,
          error: stakeholdersError,
          errorDetails: stakeholdersError ? JSON.stringify(stakeholdersError) : null,
          data: stakeholdersRawData
        })

        // Transform SQL function output to match expected format
        const stakeholdersData = stakeholdersRawData?.map((row: any) => ({
          id: row.id,
          user_id: row.user_id,
          role: row.role,
          user_profiles: {
            id: row.user_id,
            name: row.user_name,
            email: row.user_email,
            image: row.user_image
          }
        })) || []

        // Get departments for this project via project_assignments (stakeholders)
        const { data: assignments } = await supabase
          .from('project_assignments')
          .select('user_id')
          .eq('project_id', projectId)
          .is('removed_at', null)

        const departments: any[] = []

        // Add departments from assigned_user's roles (if they have an assigned user)
        if (data.assigned_user_id) {
          const { data: assignedUserRoles } = await supabase
            .from('user_roles')
            .select(`
              role_id,
              roles!user_roles_role_id_fkey (
                department_id,
                departments!roles_department_id_fkey (
                  id,
                  name
                )
              )
            `)
            .eq('user_id', data.assigned_user_id)

          if (assignedUserRoles) {
            assignedUserRoles.forEach((userRole: any) => {
              const role = userRole.roles
              if (role && role.departments) {
                const dept = role.departments
                const exists = departments.some((d: any) => d.id === dept.id)
                if (!exists) {
                  departments.push(dept)
                }
              }
            })
          }
        }

        // Add departments from stakeholders (project_assignments)
        if (assignments && assignments.length > 0) {
          // Get unique user IDs from stakeholders
          const stakeholderUserIds = assignments.map((a: any) => a.user_id).filter(Boolean)

          if (stakeholderUserIds.length > 0) {
            // Fetch user roles for all stakeholders
            const { data: stakeholderRoles } = await supabase
              .from('user_roles')
              .select(`
                user_id,
                role_id,
                roles!user_roles_role_id_fkey (
                  department_id,
                  departments!roles_department_id_fkey (
                    id,
                    name
                  )
                )
              `)
              .in('user_id', stakeholderUserIds)

            if (stakeholderRoles) {
              stakeholderRoles.forEach((userRole: any) => {
                const role = userRole.roles
                if (role && role.departments) {
                  const dept = role.departments
                  const exists = departments.some((d: any) => d.id === dept.id)
                  if (!exists) {
                    departments.push(dept)
                  }
                }
              })
            }
          }
        }

        // Fallback: If workflow_instance_id is null, check workflow_instances table
        let workflowInstanceId = data.workflow_instance_id
        if (!workflowInstanceId) {
          const { data: workflowInstances, error: wiError } = await supabase
            .from('workflow_instances')
            .select('id')
            .eq('project_id', projectId)
            .eq('status', 'active')
            .order('started_at', { ascending: false })
            .limit(1)

          console.log('Workflow fallback query:', {
            projectId,
            found: workflowInstances?.length || 0,
            error: wiError?.message
          })

          if (workflowInstances && workflowInstances.length > 0) {
            workflowInstanceId = workflowInstances[0].id
            console.log('Found workflow instance via fallback query:', workflowInstanceId)
          }
        }

        // Fetch current workflow step name if workflow exists
        if (workflowInstanceId) {
          const { data: workflowData, error: wfError } = await supabase
            .from('workflow_instances')
            .select(`
              current_node_id,
              workflow_nodes!workflow_instances_current_node_id_fkey (
                label,
                node_type
              )
            `)
            .eq('id', workflowInstanceId)
            .single()

          if (!wfError && workflowData?.workflow_nodes) {
            const nodeData = workflowData.workflow_nodes as any
            setWorkflowStepName(nodeData.label || null)
            console.log('Workflow step:', nodeData.label)
          }
        }

        // Transform the data to include all details
        const projectWithDetails: ProjectWithDetails = {
          ...data,
          workflow_instance_id: workflowInstanceId,
          departments: departments,
          assigned_user: assignedUser,
          stakeholders: stakeholdersData || []
        }

        // Debug logging
        console.log('Project loaded:', {
          id: projectWithDetails.id,
          name: projectWithDetails.name,
          description: projectWithDetails.description,
          estimated_hours: projectWithDetails.estimated_hours,
          actual_hours: projectWithDetails.actual_hours,
          stakeholders_count: projectWithDetails.stakeholders.length,
          departments_count: projectWithDetails.departments.length,
          updates: projectWithDetails.updates,
          issues_roadblocks: projectWithDetails.issues_roadblocks,
          workflow_instance_id: projectWithDetails.workflow_instance_id
        })

        setProject(projectWithDetails)

        // Initialize notes content
        setNotesContent(projectWithDetails.notes || '')

        // Check if user can edit this project
        if (userProfile?.id) {
          const canEdit = await accountService.canUserEditProject(userProfile.id, projectId)
          setCanEditProject(canEdit)
        }

        // Initialize estimated hours calculation (will be updated when tasks load)
        // If tasks haven't loaded yet, use project-level estimated_hours
        if (tasks.length === 0) {
          setCalculatedEstimatedHours(projectWithDetails.estimated_hours || null)
        }
      } catch (err) {
        console.error('Error loading project:', err)
        setError(err instanceof Error ? err.message : 'Failed to load project')
      } finally {
        setLoading(false)
      }
    }

    loadProject()
  }, [userProfile, projectId])

  // Handle task delete
  const handleDeleteTask = useCallback(async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) {
      return
    }

    try {
      const success = await taskServiceDB.deleteTask(taskId)
      if (success) {
        // Reload tasks
        await loadTasks()
      } else {
        alert('Failed to delete task')
      }
    } catch (error) {
      console.error('Error deleting task:', error)
      alert('Error deleting task')
    }
  }, [loadTasks])

  // Handle task edit
  const handleEditTask = useCallback((task: Task) => {
    setSelectedTask(task)
    setEditTaskDialogOpen(true)
  }, [])

  // Handle task updated
  const handleTaskUpdated = async () => {
    setEditTaskDialogOpen(false)
    setSelectedTask(null)
    await loadTasks()
  }

  // Handle task status update (for Kanban drag-drop)
  const handleTaskStatusUpdate = useCallback(async (taskId: string, newStatus: string) => {
    // Optimistically update local state first
    setTasks(prev => prev.map(task =>
      task.id === taskId ? { ...task, status: newStatus as Task['status'] } : task
    ))

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })

      if (!response.ok) {
        // Try to parse error, but handle non-JSON responses
        let errorMessage = 'Failed to update task status'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch {
          errorMessage = `Server error: ${response.status}`
        }
        throw new Error(errorMessage)
      }

      toast.success('Task status updated')
    } catch (error) {
      console.error('Error updating task status:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update task status')
      // Reload tasks to restore correct state on error
      await loadTasks()
    }
  }, [loadTasks])

  // Kanban drag handlers
  const handleDragStart = useCallback((e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId)
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, newStatus: string) => {
    e.preventDefault()
    if (draggedTaskId) {
      handleTaskStatusUpdate(draggedTaskId, newStatus)
      setDraggedTaskId(null)
    }
  }, [draggedTaskId, handleTaskStatusUpdate])

  const handleDragEnd = useCallback(() => {
    setDraggedTaskId(null)
  }, [])

  // Handle workflow progress - refresh workflow components, step name, project data, issues, AND updates
  const handleWorkflowProgress = useCallback(async () => {
    // Increment the refresh key to force WorkflowTimeline to remount and refetch data
    setWorkflowRefreshKey(prev => prev + 1)

    try {
      const supabase = createClientSupabase()
      if (!supabase) return

      // Refresh workflow step name AND check if workflow is completed
      if (project?.workflow_instance_id) {
        const { data: workflowData, error } = await supabase
          .from('workflow_instances')
          .select(`
            current_node_id,
            status,
            workflow_nodes!workflow_instances_current_node_id_fkey (
              label,
              node_type
            )
          `)
          .eq('id', project.workflow_instance_id)
          .single()

        if (!error && workflowData) {
          const nodeData = workflowData.workflow_nodes as any
          setWorkflowStepName(nodeData?.label || null)

          // If workflow is completed, refresh project data to update UI
          if (workflowData.status === 'completed') {
            console.log('Workflow completed, refreshing project data...')
          }
        }
      }

      // Always refresh project data to catch status changes (including completion)
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('status, completed_at, workflow_instance_id')
        .eq('id', projectId)
        .single()

      if (!projectError && projectData) {
        // Update project state with fresh data
        setProject(prev => prev ? {
          ...prev,
          status: projectData.status,
          completed_at: projectData.completed_at,
          workflow_instance_id: projectData.workflow_instance_id
        } : null)

        console.log('Project data refreshed:', {
          status: projectData.status,
          completed_at: projectData.completed_at
        })
      }

      // Refresh issues (in case a rejection created a new issue)
      try {
        const issuesResponse = await fetch(`/api/projects/${projectId}/issues`)
        const issuesResult = await issuesResponse.json()
        if (issuesResponse.ok) {
          setProjectIssues(issuesResult.issues)
        }
      } catch (issuesErr) {
        console.error('Error refreshing issues:', issuesErr)
      }

      // Refresh updates (in case workflow added any updates)
      try {
        const updatesResponse = await fetch(`/api/projects/${projectId}/updates`)
        const updatesResult = await updatesResponse.json()
        if (updatesResponse.ok) {
          setProjectUpdates(updatesResult.updates)
        }
      } catch (updatesErr) {
        console.error('Error refreshing updates:', updatesErr)
      }

    } catch (err) {
      console.error('Error refreshing workflow/project data:', err)
    }
  }, [project?.workflow_instance_id, projectId])

  // Reopen a completed project
  const handleReopenProject = async () => {
    if (!projectId || project?.status !== 'complete') return

    setReopeningProject(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/reopen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || 'Failed to reopen project')
        return
      }

      toast.success('Project reopened! It now operates without a workflow.')

      // Refresh project data to update UI
      const supabase = createClientSupabase()
      if (supabase) {
        const { data: projectData } = await supabase
          .from('projects')
          .select('status, completed_at, workflow_instance_id')
          .eq('id', projectId)
          .single()

        if (projectData) {
          setProject(prev => prev ? {
            ...prev,
            status: projectData.status,
            completed_at: projectData.completed_at,
            workflow_instance_id: projectData.workflow_instance_id
          } : null)
        }
      }
    } catch (error) {
      console.error('Error reopening project:', error)
      toast.error('Failed to reopen project')
    } finally {
      setReopeningProject(false)
    }
  }

  // Manually complete a non-workflow project
  const handleCompleteProject = async () => {
    if (!projectId || project?.status === 'complete') return

    // Confirm with user
    if (!confirm('Are you sure you want to complete this project? This will mark the project as finished and remove all team assignments.')) {
      return
    }

    setCompletingProject(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || 'Failed to complete project')
        return
      }

      toast.success('Project completed successfully!')

      // Refresh project data to update UI
      const supabase = createClientSupabase()
      if (supabase) {
        const { data: projectData } = await supabase
          .from('projects')
          .select('status, completed_at, workflow_instance_id')
          .eq('id', projectId)
          .single()

        if (projectData) {
          setProject(prev => prev ? {
            ...prev,
            status: projectData.status,
            completed_at: projectData.completed_at,
            workflow_instance_id: projectData.workflow_instance_id
          } : null)
        }
      }
    } catch (error) {
      console.error('Error completing project:', error)
      toast.error('Failed to complete project')
    } finally {
      setCompletingProject(false)
    }
  }

  // Save project estimated hours
  const handleSaveProjectEstimatedHours = async () => {
    if (!projectId || !projectEstimatedHours) return

    const hours = parseFloat(projectEstimatedHours)
    if (isNaN(hours) || hours <= 0) {
      toast.error('Please enter a valid number of hours')
      return
    }

    setSavingProjectHours(true)
    try {
      const supabase = createClientSupabase()
      if (!supabase) throw new Error('Failed to create Supabase client')

      // Calculate task sum
      const taskSum = tasks.reduce((sum, task) => sum + (task.estimated_hours || 0), 0)

      // Use the higher of entered hours or task sum
      const finalHours = taskSum > hours ? taskSum : hours

      const { error } = await supabase
        .from('projects')
        .update({
          estimated_hours: finalHours,
          updated_at: new Date().toISOString()
        })
        .eq('id', projectId)

      if (error) throw error

      // Update local state
      setProject(prev => prev ? { ...prev, estimated_hours: finalHours } : null)
      setCalculatedEstimatedHours(finalHours)
      setProjectEstimatedHours('')

      if (finalHours !== hours) {
        toast.success(`Estimated hours set to ${finalHours}h (adjusted to match task sum)`)
      } else {
        toast.success(`Estimated hours set to ${finalHours}h`)
      }
    } catch (error) {
      console.error('Error saving project hours:', error)
      toast.error('Failed to save estimated hours')
    } finally {
      setSavingProjectHours(false)
    }
  }

  // Load team members (project assignments)
  const loadTeamMembers = useCallback(async () => {
    if (!projectId) return

    setLoadingTeamMembers(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/assignments`)
      const data = await response.json()

      if (response.ok) {
        setTeamMembers(data.assignments || [])
      } else {
        console.error('Error loading team members:', data.error)
      }
    } catch (error) {
      console.error('Error loading team members:', error)
    } finally {
      setLoadingTeamMembers(false)
    }
  }, [projectId])

  // Load available users for adding
  const loadAvailableUsers = useCallback(async () => {
    if (!projectId) return

    setLoadingAvailableUsers(true)
    try {
      const supabase = createClientSupabase()
      if (!supabase) return

      // Get all users (excluding already assigned ones)
      const { data: users, error } = await supabase
        .from('user_profiles')
        .select('id, name, email')
        .order('name')

      if (error) {
        console.error('Error loading users:', error)
        return
      }

      // Filter out users who are already team members
      const assignedUserIds = new Set(teamMembers.map(m => m.user_id))
      const available = (users || []).filter((u: any) => !assignedUserIds.has(u.id))
      setAvailableUsers(available)
    } catch (error) {
      console.error('Error loading available users:', error)
    } finally {
      setLoadingAvailableUsers(false)
    }
  }, [projectId, teamMembers])

  // Add a team member
  const handleAddTeamMember = async (userId: string) => {
    if (!projectId || addingMember) return

    setAddingMember(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, roleInProject: 'member' })
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Team member added successfully')
        setShowAddMemberDropdown(false)
        await loadTeamMembers()
      } else {
        toast.error(data.error || 'Failed to add team member')
      }
    } catch (error) {
      console.error('Error adding team member:', error)
      toast.error('Failed to add team member')
    } finally {
      setAddingMember(false)
    }
  }

  // Remove a team member
  const handleRemoveTeamMember = async (userId: string) => {
    if (!projectId || removingMemberId) return

    if (!confirm('Are you sure you want to remove this team member from the project?')) {
      return
    }

    setRemovingMemberId(userId)
    try {
      const response = await fetch(`/api/projects/${projectId}/assignments?userId=${userId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Team member removed')
        await loadTeamMembers()
      } else {
        toast.error(data.error || 'Failed to remove team member')
      }
    } catch (error) {
      console.error('Error removing team member:', error)
      toast.error('Failed to remove team member')
    } finally {
      setRemovingMemberId(null)
    }
  }

  // Load team members when project loads
  useEffect(() => {
    if (projectId) {
      loadTeamMembers()
    }
  }, [projectId, loadTeamMembers])

  // Load available users when dropdown opens
  useEffect(() => {
    if (showAddMemberDropdown) {
      loadAvailableUsers()
    }
  }, [showAddMemberDropdown, loadAvailableUsers])

  const handleProjectUpdated = async () => {
    setEditDialogOpen(false)
    
    console.log('[PAGE RELOAD] Project updated - reloading data (dialog has already verified data is synced)...')
    
    // The dialog has already polled and verified the data is in the database
    // So we can just fetch it immediately using the same method as initial page load
    const loadProject = async () => {
      if (!userProfile || !projectId) return

      try {
        setLoading(true)
        // Create a fresh Supabase client with auth
        const { createBrowserClient } = await import('@supabase/ssr')
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )

        // Fetch stakeholders using SQL function (same as initial load)
        console.log('[PAGE RELOAD] Fetching stakeholders via SQL function...')
        const { data: stakeholdersRawData, error: stakeholdersError } = await supabase
          .rpc('get_project_stakeholders', { project_uuid: projectId })

        console.log('[PAGE RELOAD] Stakeholders result:', {
          count: stakeholdersRawData?.length || 0,
          error: stakeholdersError
        })

        // Transform SQL function output
        const stakeholdersData = stakeholdersRawData?.map((row: any) => ({
          id: row.id,
          user_id: row.user_id,
          role: row.role,
          user_profiles: {
            id: row.user_id,
            name: row.user_name,
            email: row.user_email,
            image: row.user_image
          }
        })) || []

        // Fetch project with all related data
        const { data, error: queryError } = await supabase
          .from('projects')
          .select(`
            *,
            account:accounts(*)
          `)
          .eq('id', projectId)
          .single()

        if (queryError) {
          throw queryError
        }

        if (!data) {
          throw new Error('Project not found')
        }

        // Fetch assigned user details
        let assignedUser = null
        if (data.assigned_user_id) {
          const { data: userData } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', data.assigned_user_id)
            .single()
          assignedUser = userData
        }

        // Get departments for this project via project_assignments (stakeholders)
        const { data: reloadAssignments } = await supabase
          .from('project_assignments')
          .select('user_id')
          .eq('project_id', projectId)
          .is('removed_at', null)

        const reloadDepartments: any[] = []

        // Add departments from assigned_user's roles (if they have an assigned user)
        if (data.assigned_user_id) {
          const { data: reloadAssignedUserRoles } = await supabase
            .from('user_roles')
            .select(`
              role_id,
              roles!user_roles_role_id_fkey (
                department_id,
                departments!roles_department_id_fkey (
                  id,
                  name
                )
              )
            `)
            .eq('user_id', data.assigned_user_id)

          if (reloadAssignedUserRoles) {
            reloadAssignedUserRoles.forEach((userRole: any) => {
              const role = userRole.roles
              if (role && role.departments) {
                const dept = role.departments
                const exists = reloadDepartments.some((d: any) => d.id === dept.id)
                if (!exists) {
                  reloadDepartments.push(dept)
                }
              }
            })
          }
        }

        // Add departments from stakeholders (project_assignments)
        if (reloadAssignments && reloadAssignments.length > 0) {
          // Get unique user IDs from stakeholders
          const reloadStakeholderUserIds = reloadAssignments.map((a: any) => a.user_id).filter(Boolean)

          if (reloadStakeholderUserIds.length > 0) {
            // Fetch user roles for all stakeholders
            const { data: reloadStakeholderRoles } = await supabase
              .from('user_roles')
              .select(`
                user_id,
                role_id,
                roles!user_roles_role_id_fkey (
                  department_id,
                  departments!roles_department_id_fkey (
                    id,
                    name
                  )
                )
              `)
              .in('user_id', reloadStakeholderUserIds)

            if (reloadStakeholderRoles) {
              reloadStakeholderRoles.forEach((userRole: any) => {
                const role = userRole.roles
                if (role && role.departments) {
                  const dept = role.departments
                  const exists = reloadDepartments.some((d: any) => d.id === dept.id)
                  if (!exists) {
                    reloadDepartments.push(dept)
                  }
                }
              })
            }
          }
        }

        // Transform the data to include all details
        const projectWithDetails: ProjectWithDetails = {
          ...data,
          departments: reloadDepartments,
          assigned_user: assignedUser,
          stakeholders: stakeholdersData || []
        }

        console.log('[PAGE RELOAD] Project reloaded after update:', {
          id: projectWithDetails.id,
          name: projectWithDetails.name,
          stakeholders_count: projectWithDetails.stakeholders.length,
          departments_count: projectWithDetails.departments.length,
          stakeholders: projectWithDetails.stakeholders
        })

        setProject(projectWithDetails)
      } catch (err) {
        console.error('[PAGE RELOAD] Error loading project:', err)
        setError(err instanceof Error ? err.message : 'Failed to load project')
      } finally {
        setLoading(false)
      }
    }
    
    await loadProject()
  }

  // Load project updates
  const loadProjectUpdates = async () => {
    if (!projectId) return

    setLoadingUpdates(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/updates`)
      const result = await response.json()

      if (response.ok) {
        setProjectUpdates(result.updates)
      } else {
        console.error('Error loading updates:', result.error)
      }
    } catch (error) {
      console.error('Error loading project updates:', error)
    } finally {
      setLoadingUpdates(false)
    }
  }

  // Load updates when project is loaded (only re-run when project ID changes, not on every property update)
  useEffect(() => {
    if (project?.id) {
      loadProjectUpdates()
    }
  }, [project?.id])

  // Submit new update
  const handleSubmitUpdate = async () => {
    if (!newUpdateContent.trim() || !projectId) return

    setSubmittingUpdate(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newUpdateContent.trim()
        })
      })

      const result = await response.json()

      if (response.ok) {
        // Reload updates
        await loadProjectUpdates()

        // Reset form
        setNewUpdateContent('')
        setShowNewUpdateForm(false)
      } else {
        alert(result.error || 'Failed to create update. Please try again.')
      }
    } catch (error) {
      console.error('Error creating update:', error)
      alert('Failed to create update. Please try again.')
    } finally {
      setSubmittingUpdate(false)
    }
  }

  // Load project issues
  const loadProjectIssues = async () => {
    if (!projectId) return

    setLoadingIssues(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/issues`)
      const result = await response.json()

      if (response.ok) {
        setProjectIssues(result.issues)
      } else {
        console.error('Error loading issues:', result.error)
      }
    } catch (error) {
      console.error('Error loading project issues:', error)
    } finally {
      setLoadingIssues(false)
    }
  }

  // Load issues when project is loaded (only re-run when project ID changes, not on every property update)
  useEffect(() => {
    if (project?.id) {
      loadProjectIssues()
    }
  }, [project?.id])

  // Submit new issue
  const handleSubmitIssue = async () => {
    if (!newIssueContent.trim() || !projectId) return

    setSubmittingIssue(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newIssueContent.trim()
        })
      })

      const result = await response.json()

      if (response.ok) {
        // Reload issues
        await loadProjectIssues()

        // Reset form
        setNewIssueContent('')
        setShowNewIssueForm(false)
      } else {
        alert(result.error || 'Failed to create issue. Please try again.')
      }
    } catch (error) {
      console.error('Error creating issue:', error)
      alert('Failed to create issue. Please try again.')
    } finally {
      setSubmittingIssue(false)
    }
  }

  // Update issue status
  const handleUpdateIssueStatus = async (issueId: string, newStatus: 'open' | 'in_progress' | 'resolved') => {
    // Optimistically update UI immediately for better UX
    const previousIssues = [...projectIssues]
    setProjectIssues(prev => prev.map(issue =>
      issue.id === issueId ? { ...issue, status: newStatus } : issue
    ))

    try {
      const response = await fetch(`/api/projects/${projectId}/issues/${issueId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })

      const result = await response.json()

      if (response.ok) {
        // Refresh to get full updated data (including resolver info)
        await loadProjectIssues()
        toast.success(`Issue ${newStatus === 'resolved' ? 'resolved' : 'status updated'}`)
      } else {
        // Revert optimistic update on error
        setProjectIssues(previousIssues)
        toast.error(result.error || 'Failed to update issue status')
        console.error('Error response:', result)
      }
    } catch (error) {
      // Revert optimistic update on error
      setProjectIssues(previousIssues)
      console.error('Error updating issue status:', error)
      toast.error('Failed to update issue status. Please try again.')
    }
  }

  // Save project notes
  const handleSaveNotes = async () => {
    setSavingNotes(true)
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notesContent })
      })

      if (response.ok) {
        setProject(prev => prev ? { ...prev, notes: notesContent } : null)
        setEditingNotes(false)
        toast.success('Notes saved')
      } else {
        const result = await response.json()
        toast.error(result.error || 'Failed to save notes')
      }
    } catch (error) {
      console.error('Error saving notes:', error)
      toast.error('Failed to save notes')
    } finally {
      setSavingNotes(false)
    }
  }

  // Project status colors removed - projects now use workflow steps instead of static status

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800'
      case 'high':
        return 'bg-orange-100 text-orange-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800'
      case 'low':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not set'
    return new Date(dateString).toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading project...</p>
        </div>
      </div>
    )
  }

  if (error || !project) {
    notFound()
  }

  return (
    <RoleGuard>
      <div className="container mx-auto p-6 space-y-6">
        {/* Back Button */}
        <div className="mb-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="/projects">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Projects
            </Link>
          </Button>
        </div>

        {/* Completed Project Banner */}
        {project.status === 'complete' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
              <div>
                <p className="font-semibold text-green-800">This project has been completed</p>
                <p className="text-sm text-green-600">
                  {project.completed_at
                    ? `Completed on ${formatDate(project.completed_at)}`
                    : 'This is a read-only view of the finished project.'}
                </p>
              </div>
            </div>
            {canEditProject && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleReopenProject}
                disabled={reopeningProject}
                className="bg-white hover:bg-gray-50"
              >
                {reopeningProject ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2" />
                    Reopening...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reopen Project
                  </>
                )}
              </Button>
            )}
          </div>
        )}

        {/* Page Header */}
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
              {project.reopened_at && (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                  Re-opened
                </Badge>
              )}
            </div>
            <p className="text-gray-600 mt-1">Project Details</p>
          </div>
        </div>

        {/* Action Buttons - Hidden for completed projects */}
        {project.status !== 'complete' && (
          <div className="mb-4 flex items-center gap-3">
            {/* Edit Project Button - Only show if user can edit */}
            {canEditProject && (
              <Button onClick={() => setEditDialogOpen(true)}>
                <Edit className="w-4 h-4 mr-2" />
                Edit Project
              </Button>
            )}

            {/* Workflow Progress Button - Show if project has active workflow */}
            <WorkflowProgressButton
              key={`workflow-button-${workflowRefreshKey}`}
              projectId={projectId}
              workflowInstanceId={project.workflow_instance_id || null}
              onProgress={handleWorkflowProgress}
            />

            {/* Complete Project Button - Show for non-workflow projects only */}
            {canEditProject && !project.workflow_instance_id && (
              <Button
                variant="outline"
                onClick={handleCompleteProject}
                disabled={completingProject}
                className="bg-green-50 hover:bg-green-100 border-green-200 text-green-700"
              >
                {completingProject ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600 mr-2" />
                    Completing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Complete Project
                  </>
                )}
              </Button>
            )}
          </div>
        )}

        {/* Workflow Timeline - Show workflow progress if project has active workflow */}
        <WorkflowTimeline
          key={`workflow-timeline-${workflowRefreshKey}`}
          workflowInstanceId={project.workflow_instance_id || null}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tasks - Only show if user has VIEW_TASKS permission */}
            {canViewTasks && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <FolderOpen className="w-5 h-5 text-blue-600" />
                        Tasks
                      </CardTitle>
                      <CardDescription>Manage project tasks and assignments</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* View Mode Toggle */}
                      <div className="flex items-center border rounded-md">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-r-none"
                          title="List View (default)"
                          disabled
                        >
                          <List className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-none border-x"
                          onClick={() => setKanbanDialogOpen(true)}
                          title="Open Kanban View"
                        >
                          <LayoutGrid className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-l-none"
                          onClick={() => setGanttDialogOpen(true)}
                          title="Open Gantt View"
                        >
                          <GanttChart className="w-4 h-4" />
                        </Button>
                      </div>
                      {canCreateTasks && project.status !== 'complete' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedTask(null)
                            setEditTaskDialogOpen(true)
                          }}
                        >
                          <PlusIcon className="w-4 h-4 mr-2" />
                          New Task
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingTasks ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="text-sm text-gray-500 mt-2">Loading tasks...</p>
                    </div>
                  ) : tasks.length > 0 ? (
                    <div className="space-y-3">
                      {tasks.map((task) => (
                        <TaskItem
                          key={task.id}
                          task={task}
                          canEditTasks={canEditTasks}
                          onEdit={handleEditTask}
                          onDelete={handleDeleteTask}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <FolderOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No tasks yet. {canCreateTasks && 'Click "New Task" to create one.'}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Project Notes - Collaborative notes section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <StickyNote className="w-5 h-5 text-yellow-600" />
                      Project Notes
                    </CardTitle>
                    <CardDescription>Shared notes and context for the team</CardDescription>
                  </div>
                  {canEditProject && project.status !== 'complete' && !editingNotes && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingNotes(true)}
                    >
                      <Pencil className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {editingNotes ? (
                  <div className="space-y-3">
                    <Textarea
                      value={notesContent}
                      onChange={(e) => setNotesContent(e.target.value)}
                      placeholder="Add project context, important information, or notes for the team..."
                      rows={6}
                      className="resize-none"
                    />
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingNotes(false)
                          setNotesContent(project.notes || '')
                        }}
                        disabled={savingNotes}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveNotes}
                        disabled={savingNotes}
                      >
                        {savingNotes ? 'Saving...' : 'Save Notes'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="prose prose-sm max-w-none">
                    {project.notes ? (
                      <p className="text-gray-700 whitespace-pre-wrap">{project.notes}</p>
                    ) : (
                      <p className="text-gray-400 italic">
                        No notes yet. {canEditProject && project.status !== 'complete' && 'Click "Edit" to add project context.'}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Project Updates - Journal Style */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-blue-600" />
                      Project Updates
                    </CardTitle>
                    <CardDescription>Track progress and milestones</CardDescription>
                  </div>
                  {canCreateUpdate && project.status !== 'complete' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowNewUpdateForm(!showNewUpdateForm)}
                      disabled={submittingUpdate}
                    >
                      <PlusIcon className="w-4 h-4 mr-2" />
                      New Update
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* New Update Form - Only show if user has create_update permission and project is not complete */}
                  {showNewUpdateForm && canCreateUpdate && project.status !== 'complete' && (
                    <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm font-medium text-gray-700 mb-1 block">
                            What's the latest update?
                          </label>
                          <Textarea
                            value={newUpdateContent}
                            onChange={(e) => setNewUpdateContent(e.target.value)}
                            placeholder="Share progress, milestones, changes, or any relevant information..."
                            rows={4}
                            className="resize-none"
                          />
                        </div>
                        <div className="flex items-center gap-2 justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setShowNewUpdateForm(false)
                              setNewUpdateContent('')
                            }}
                            disabled={submittingUpdate}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleSubmitUpdate}
                            disabled={!newUpdateContent.trim() || submittingUpdate}
                          >
                            {submittingUpdate ? 'Posting...' : 'Post Update'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Updates List */}
                  {loadingUpdates ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="text-sm text-gray-500 mt-2">Loading updates...</p>
                    </div>
                  ) : projectUpdates.length > 0 ? (
                    <div className="space-y-4 relative">
                      {/* Timeline line */}
                      <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200" />
                      
                      {projectUpdates.map((update, index) => (
                        <div key={update.id} className="relative flex gap-4">
                          {/* Avatar */}
                          <div className="flex-shrink-0 relative z-10">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                              <span className="text-white font-semibold text-sm">
                                {update.user_profiles?.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                              </span>
                            </div>
                          </div>

                          {/* Content */}
                          <div className="flex-1 bg-white border rounded-lg p-4 shadow-sm">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <p className="font-medium text-gray-900">
                                  {update.user_profiles?.name || 'Unknown User'}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {formatDistance(new Date(update.created_at), new Date(), { addSuffix: true })}
                                </p>
                              </div>
                            </div>
                            <p className="text-gray-700 whitespace-pre-wrap text-sm">
                              {update.content}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No updates yet. Click "New Update" to add your first progress note.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Issues & Roadblocks - Journal Style */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-orange-600" />
                      Issues & Roadblocks
                    </CardTitle>
                    <CardDescription>Track and resolve project blockers</CardDescription>
                  </div>
                  {canCreateIssue && project.status !== 'complete' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowNewIssueForm(!showNewIssueForm)}
                      disabled={submittingIssue}
                    >
                      <PlusIcon className="w-4 h-4 mr-2" />
                      Report Issue
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* New Issue Form - Only show if user has create_issue permission and project is not complete */}
                  {showNewIssueForm && canCreateIssue && project.status !== 'complete' && (
                    <div className="border-2 border-orange-200 rounded-lg p-4 bg-orange-50">
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm font-medium text-gray-700 mb-1 block">
                            What's blocking the project?
                          </label>
                          <Textarea
                            value={newIssueContent}
                            onChange={(e) => setNewIssueContent(e.target.value)}
                            placeholder="Describe the issue, roadblock, or challenge affecting the project..."
                            rows={4}
                            className="resize-none"
                          />
                        </div>
                        <div className="flex items-center gap-2 justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setShowNewIssueForm(false)
                              setNewIssueContent('')
                            }}
                            disabled={submittingIssue}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleSubmitIssue}
                            disabled={!newIssueContent.trim() || submittingIssue}
                          >
                            {submittingIssue ? 'Reporting...' : 'Report Issue'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Issues List */}
                  {loadingIssues ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
                      <p className="text-sm text-gray-500 mt-2">Loading issues...</p>
                    </div>
                  ) : projectIssues.length > 0 ? (
                    <div className="space-y-4 relative">
                      {/* Timeline line */}
                      <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200" />
                      
                      {projectIssues.map((issue) => (
                        <div key={issue.id} className="relative flex gap-4">
                          {/* Status Icon */}
                          <div className="flex-shrink-0 relative z-10">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              issue.status === 'resolved' 
                                ? 'bg-green-100' 
                                : issue.status === 'in_progress'
                                ? 'bg-yellow-100'
                                : 'bg-orange-100'
                            }`}>
                              {issue.status === 'resolved' ? (
                                <CheckCircle2 className="w-5 h-5 text-green-600" />
                              ) : (
                                <AlertTriangle className={`w-5 h-5 ${
                                  issue.status === 'in_progress' ? 'text-yellow-600' : 'text-orange-600'
                                }`} />
                              )}
                            </div>
                          </div>

                          {/* Content */}
                          <div className={`flex-1 border rounded-lg p-4 shadow-sm ${
                            issue.status === 'resolved' ? 'bg-green-50 border-green-200' : 'bg-white'
                          }`}>
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="font-medium text-gray-900">
                                    {issue.user_profiles?.name || 'Unknown User'}
                                  </p>
                                  <span className="text-xs text-gray-500">
                                    {formatDistance(new Date(issue.created_at), new Date(), { addSuffix: true })}
                                  </span>
                                </div>
                                <p className="text-gray-700 whitespace-pre-wrap text-sm mb-3">
                                  {issue.content}
                                </p>
                              </div>
                            </div>

                            {/* Status Selector - Only show if user can edit issues and project is not complete */}
                            {canEditIssue && project.status !== 'complete' ? (
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-gray-500">Status:</span>
                                <Select
                                  value={issue.status}
                                  onValueChange={(value) => handleUpdateIssueStatus(issue.id, value as 'open' | 'in_progress' | 'resolved')}
                                >
                                  <SelectTrigger className="w-[150px] h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="open">Open</SelectItem>
                                    <SelectItem value="in_progress">In Progress</SelectItem>
                                    <SelectItem value="resolved">Resolved</SelectItem>
                                  </SelectContent>
                                </Select>
                                {issue.status === 'resolved' && issue.resolver_profiles && (
                                  <span className="text-xs text-green-600 ml-2">
                                    ✓ Resolved by {issue.resolver_profiles.name}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-gray-500">Status:</span>
                                <span className={`text-xs px-2 py-1 rounded-full ${
                                  issue.status === 'resolved' 
                                    ? 'bg-green-100 text-green-800' 
                                    : issue.status === 'in_progress'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-orange-100 text-orange-800'
                                }`}>
                                  {issue.status.replace('_', ' ').toUpperCase()}
                                </span>
                                {issue.status === 'resolved' && issue.resolver_profiles && (
                                  <span className="text-xs text-green-600 ml-2">
                                    ✓ Resolved by {issue.resolver_profiles.name}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <AlertTriangle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No issues reported yet. This is great!</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Metadata */}
          <div className="space-y-6">
            {/* Project Information */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Project Information</CardTitle>
                    <CardDescription>Key details and timeline</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-gray-500 uppercase">Workflow Step</p>
                    {workflowStepName ? (
                      <Badge className="bg-indigo-100 text-indigo-800 text-xs whitespace-nowrap">
                        {workflowStepName}
                      </Badge>
                    ) : (
                      <span className="text-sm text-gray-400">No active workflow</span>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-gray-500 uppercase">Priority</p>
                    <Badge className={`${getPriorityColor(project.priority)} text-xs whitespace-nowrap`}>
                      {project.priority.toUpperCase()}
                    </Badge>
                  </div>
                </div>
                
                <div className="border-t pt-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-gray-500">Start Date</p>
                      <p className="text-sm font-semibold">{formatDate(project.start_date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-gray-500">End Date / Deadline</p>
                      <p className="text-sm font-semibold">{formatDate(project.end_date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-gray-500">Estimated Hours</p>
                      {(() => {
                        // Calculate task sum
                        const taskSum = tasks.reduce((sum, task) => sum + (task.estimated_hours || 0), 0)
                        const projectHours = project?.estimated_hours || 0
                        // Show the higher of project hours or task sum
                        const displayHours = taskSum > projectHours ? taskSum : projectHours

                        if (displayHours > 0) {
                          return (
                            <p className="text-sm font-semibold">
                              {displayHours.toFixed(1)}h
                              {taskSum > projectHours && projectHours > 0 && (
                                <span className="text-xs text-orange-600 ml-2">
                                  (task sum exceeds project estimate of {projectHours}h)
                                </span>
                              )}
                              {taskSum > 0 && taskSum <= projectHours && (
                                <span className="text-xs text-gray-500 ml-2">
                                  (lead time: {(projectHours - taskSum).toFixed(1)}h)
                                </span>
                              )}
                            </p>
                          )
                        } else if (canEditProject) {
                          return (
                            <div className="flex items-center gap-2 mt-1">
                              <Input
                                type="number"
                                value={projectEstimatedHours}
                                onChange={(e) => setProjectEstimatedHours(e.target.value)}
                                placeholder="Enter hours"
                                min="1"
                                className="w-24 h-7 text-sm"
                              />
                              <Button
                                size="sm"
                                onClick={handleSaveProjectEstimatedHours}
                                disabled={savingProjectHours || !projectEstimatedHours}
                                className="h-7 text-xs"
                              >
                                {savingProjectHours ? 'Saving...' : 'Save'}
                              </Button>
                            </div>
                          )
                        } else {
                          return <p className="text-sm text-gray-500 italic">Not specified</p>
                        }
                      })()}
                    </div>
                  </div>
                  {/* Progress - Calculated from actual time logged vs estimated */}
                  {(() => {
                    // Show progress if there are tasks with estimates OR project-level hours logged
                    const taskEstimatedSum = tasks.reduce((sum, task) => sum + (task.estimated_hours || 0), 0)
                    // Use actual_hours from tasks + project-level hours (logged without a task)
                    const taskActualHours = tasks.reduce((sum, task) => sum + (task.actual_hours || 0), 0)
                    const totalActualHours = taskActualHours + projectLevelHours
                    const remainingHours = Math.max(0, taskEstimatedSum - totalActualHours)
                    const progressPercent = taskEstimatedSum > 0 ? Math.round((totalActualHours / taskEstimatedSum) * 100) : 0

                    if (taskEstimatedSum > 0 || totalActualHours > 0) {
                      return (
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-blue-500" />
                          <div className="flex-1">
                            <p className="text-xs font-medium text-gray-500">Time Progress</p>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-blue-600">
                                {totalActualHours.toFixed(1)}h logged
                              </p>
                              <span className="text-xs text-gray-500">
                                / {taskEstimatedSum.toFixed(1)}h estimated
                              </span>
                              {remainingHours > 0 && (
                                <span className="text-xs text-orange-600">
                                  ({remainingHours.toFixed(1)}h remaining)
                                </span>
                              )}
                            </div>
                            {/* Progress bar */}
                            <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all duration-500 ${
                                  progressPercent >= 100 ? 'bg-green-500' :
                                  progressPercent >= 75 ? 'bg-blue-500' :
                                  progressPercent >= 50 ? 'bg-yellow-500' : 'bg-gray-400'
                                }`}
                                style={{ width: `${Math.min(progressPercent, 100)}%` }}
                              />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              {Math.min(progressPercent, 100)}% complete
                              {projectLevelHours > 0 && (
                                <span className="ml-2 text-purple-600">
                                  (incl. {projectLevelHours.toFixed(1)}h project-level)
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      )
                    }
                    return null
                  })()}
                </div>

                <div className="border-t pt-4 space-y-2">
                  <div>
                    <p className="text-xs font-medium text-gray-500">Created</p>
                    <p className="text-sm">{formatDate(project.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Last Updated</p>
                    <p className="text-sm">{formatDate(project.updated_at)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Team Members (with Add/Remove functionality) */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Users className="w-5 h-5" />
                      Team Members
                    </CardTitle>
                    <CardDescription>
                      {teamMembers.length > 0
                        ? `${teamMembers.length} ${teamMembers.length === 1 ? 'person' : 'people'} on this project`
                        : 'No team members assigned yet'
                      }
                    </CardDescription>
                  </div>
                  {/* Add Member Button - Only show for non-complete projects with edit permission */}
                  {canEditProject && project.status !== 'complete' && (
                    <div className="relative">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAddMemberDropdown(!showAddMemberDropdown)}
                        disabled={addingMember}
                        className="flex items-center gap-1"
                      >
                        {addingMember ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <UserPlus className="w-4 h-4" />
                        )}
                        <span className="hidden sm:inline">Add</span>
                      </Button>

                      {/* Add Member Dropdown */}
                      {showAddMemberDropdown && (
                        <div className="absolute right-0 top-full mt-1 w-64 bg-white border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                          <div className="p-2 border-b">
                            <p className="text-xs font-medium text-gray-500">Select user to add</p>
                          </div>
                          {loadingAvailableUsers ? (
                            <div className="p-4 text-center">
                              <Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" />
                              <p className="text-xs text-gray-500 mt-1">Loading users...</p>
                            </div>
                          ) : availableUsers.length > 0 ? (
                            <div className="py-1">
                              {availableUsers.map((user) => (
                                <button
                                  key={user.id}
                                  onClick={() => handleAddTeamMember(user.id)}
                                  className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2"
                                  disabled={addingMember}
                                >
                                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center flex-shrink-0">
                                    <span className="text-white font-semibold text-xs">
                                      {user.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??'}
                                    </span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="p-4 text-center">
                              <p className="text-xs text-gray-500">No more users available</p>
                            </div>
                          )}
                          <div className="border-t p-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowAddMemberDropdown(false)}
                              className="w-full text-xs"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {loadingTeamMembers ? (
                    <div className="text-center py-4">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                      <p className="text-xs text-gray-500 mt-1">Loading team members...</p>
                    </div>
                  ) : teamMembers.length > 0 ? (
                    <div className="space-y-2">
                      {teamMembers.map((member) => (
                        <div key={member.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50 transition-colors group">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center flex-shrink-0">
                            <span className="text-white font-semibold text-xs">
                              {member.user_profiles?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '??'}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">{member.user_profiles?.name || 'Unknown User'}</p>
                            {member.role_in_project && (
                              <p className="text-xs text-gray-500 capitalize">
                                {member.role_in_project.replace('_', ' ')}
                              </p>
                            )}
                          </div>
                          {/* Remove Button - Only show for non-complete projects with edit permission */}
                          {canEditProject && project.status !== 'complete' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveTeamMember(member.user_id)}
                              disabled={removingMemberId === member.user_id}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 h-auto text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              {removingMemberId === member.user_id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <AlertCircle className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                      <p className="text-sm text-gray-500">No team members assigned</p>
                      {canEditProject && project.status !== 'complete' && (
                        <p className="text-xs text-gray-400 mt-1">Click "Add" to assign team members</p>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Account & Departments (Merged) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Building2 className="w-5 h-5" />
                  Account & Departments
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-2">Account</p>
                  <p className="text-base font-semibold">{project.account?.name || 'Unknown'}</p>
                </div>
                
                {project.departments.length > 0 ? (
                  <div className="border-t pt-4">
                    <p className="text-xs font-medium text-gray-500 uppercase mb-2">
                      Departments ({project.departments.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {project.departments.map((dept) => (
                        <Badge key={dept.id} variant="secondary" className="px-3 py-1">
                          {dept.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="border-t pt-4">
                    <div className="flex items-center gap-2 text-gray-400 italic text-sm">
                      <AlertCircle className="w-4 h-4" />
                      <p>No departments assigned</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Edit Project Dialog - Status is managed by workflows */}
        <TaskCreationDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onTaskCreated={handleProjectUpdated}
          accountId={project.account_id}
          account={project.account}
          userProfile={userProfile}
          editMode={true}
          existingProject={project}
        />

        {/* Task Create/Edit Dialog */}
        {project && (
          <TaskCreateEditDialog
            open={editTaskDialogOpen}
            onOpenChange={setEditTaskDialogOpen}
            projectId={project.id}
            task={selectedTask}
            onTaskSaved={handleTaskUpdated}
          />
        )}

        {/* Fullscreen Kanban Dialog */}
        <Dialog open={kanbanDialogOpen} onOpenChange={setKanbanDialogOpen}>
          <DialogContent className="max-w-[95vw] w-[95vw] max-h-[90vh] h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle className="flex items-center gap-2">
                <LayoutGrid className="w-5 h-5" />
                Task Kanban Board - {project.name}
              </DialogTitle>
              <p className="text-sm text-gray-500">Drag and drop tasks between columns to update their status</p>
            </DialogHeader>
            <div className="flex-1 overflow-x-auto overflow-y-auto pb-4">
              <div className="flex gap-4 min-w-max h-full">
                {['backlog', 'todo', 'in_progress', 'review', 'done', 'blocked'].map((status) => {
                  const statusTasks = tasks.filter(t => t.status === status)
                  const statusLabels: Record<string, { label: string; color: string; dropColor: string }> = {
                    backlog: { label: 'Backlog', color: 'bg-gray-100', dropColor: 'bg-gray-200' },
                    todo: { label: 'To Do', color: 'bg-blue-100', dropColor: 'bg-blue-200' },
                    in_progress: { label: 'In Progress', color: 'bg-yellow-100', dropColor: 'bg-yellow-200' },
                    review: { label: 'Review', color: 'bg-purple-100', dropColor: 'bg-purple-200' },
                    done: { label: 'Done', color: 'bg-green-100', dropColor: 'bg-green-200' },
                    blocked: { label: 'Blocked', color: 'bg-red-100', dropColor: 'bg-red-200' }
                  }
                  const statusInfo = statusLabels[status] || { label: status, color: 'bg-gray-100', dropColor: 'bg-gray-200' }

                  return (
                    <div key={status} className="flex-shrink-0 w-80 flex flex-col">
                      <div className={`rounded-t-lg p-3 ${statusInfo.color}`}>
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium text-sm">{statusInfo.label}</h3>
                          <Badge variant="secondary" className="text-xs">
                            {statusTasks.length}
                          </Badge>
                        </div>
                      </div>
                      <div
                        className={`rounded-b-lg p-2 flex-1 overflow-y-auto space-y-2 min-h-[200px] transition-colors ${
                          draggedTaskId ? 'border-2 border-dashed border-gray-300' : ''
                        } ${draggedTaskId && tasks.find(t => t.id === draggedTaskId)?.status !== status ? statusInfo.dropColor : 'bg-gray-50'}`}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, status)}
                      >
                        {statusTasks.map((task) => (
                          <div
                            key={task.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, task.id)}
                            onDragEnd={handleDragEnd}
                            className={`bg-white border rounded-lg p-3 shadow-sm hover:shadow-md transition-all group ${
                              draggedTaskId === task.id ? 'opacity-50 scale-95 cursor-grabbing' : 'cursor-grab'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="font-medium text-sm text-gray-900 line-clamp-2 flex-1">{task.name}</h4>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <Badge className={`text-xs ${
                                  task.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                                  task.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                                  task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-green-100 text-green-800'
                                }`}>
                                  {task.priority}
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setKanbanDialogOpen(false)
                                    handleEditTask(task)
                                  }}
                                  title="Edit task"
                                >
                                  <Edit className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                            {task.description && (
                              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{task.description}</p>
                            )}
                            <div className="flex items-center justify-between mt-2">
                              <div className="flex items-center gap-2 text-xs text-gray-400">
                                {task.due_date && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {new Date(task.due_date).toLocaleDateString()}
                                  </span>
                                )}
                                {task.estimated_hours && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {task.estimated_hours}h
                                  </span>
                                )}
                              </div>
                              {task.assigned_to_user && (
                                <span className="text-xs text-gray-500 truncate max-w-[80px]" title={task.assigned_to_user.name}>
                                  {task.assigned_to_user.name?.split(' ')[0]}
                                </span>
                              )}
                            </div>
                            {/* Quick Actions */}
                            <div className="flex items-center gap-1 mt-2 pt-2 border-t opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-xs flex-1"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setKanbanDialogOpen(false)
                                  handleEditTask(task)
                                }}
                              >
                                Edit Details
                              </Button>
                            </div>
                          </div>
                        ))}
                        {statusTasks.length === 0 && (
                          <div className={`text-center py-8 text-gray-400 ${draggedTaskId ? 'border-2 border-dashed border-gray-300 rounded-lg' : ''}`}>
                            <p className="text-xs">{draggedTaskId ? 'Drop here' : 'No tasks'}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Fullscreen Gantt Dialog */}
        <Dialog open={ganttDialogOpen} onOpenChange={setGanttDialogOpen}>
          <DialogContent className="max-w-[98vw] w-[98vw] max-h-[95vh] h-[95vh] overflow-hidden flex flex-col p-0">
            {/* Header */}
            <div className="flex-shrink-0 px-6 py-4 border-b bg-white">
              <div className="flex items-center justify-between">
                <DialogTitle className="flex items-center gap-2">
                  <GanttChart className="w-5 h-5" />
                  Task Gantt Chart - {project.name}
                </DialogTitle>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">View:</span>
                    <div className="flex border rounded-md">
                      {(['daily', 'weekly', 'monthly', 'quarterly'] as const).map((mode) => (
                        <Button
                          key={mode}
                          size="sm"
                          variant={ganttViewMode === mode ? 'secondary' : 'ghost'}
                          className={`text-xs px-3 ${mode === 'daily' ? 'rounded-r-none' : mode === 'quarterly' ? 'rounded-l-none' : 'rounded-none'}`}
                          onClick={() => setGanttViewMode(mode)}
                        >
                          {mode.charAt(0).toUpperCase() + mode.slice(1)}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-100 border border-red-300 rounded"></span> Weekend</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-500 rounded"></span> Today</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500 mt-2">
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-gray-400 rounded"></span> Backlog</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-400 rounded"></span> To Do</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-yellow-400 rounded"></span> In Progress</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-purple-400 rounded"></span> Review</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-400 rounded"></span> Done</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-400 rounded"></span> Blocked</span>
              </div>
            </div>

            {/* Gantt Content - Full Height */}
            <div className="flex-1 flex overflow-hidden">
              {(() => {
                const today = new Date()
                today.setHours(0, 0, 0, 0)

                // Calculate date range centered on today
                let minDate: Date, maxDate: Date
                const daysToShow = ganttViewMode === 'daily' ? 60 : ganttViewMode === 'weekly' ? 84 : ganttViewMode === 'monthly' ? 180 : 365

                // Center on today
                minDate = new Date(today)
                minDate.setDate(minDate.getDate() - Math.floor(daysToShow / 2))
                maxDate = new Date(today)
                maxDate.setDate(maxDate.getDate() + Math.floor(daysToShow / 2))

                // Extend to include all tasks
                const tasksWithDates = tasks.filter(t => t.start_date && t.due_date)
                if (tasksWithDates.length > 0) {
                  const dates = tasksWithDates.flatMap(t => [new Date(t.start_date!), new Date(t.due_date!)])
                  const taskMin = new Date(Math.min(...dates.map(d => d.getTime())))
                  const taskMax = new Date(Math.max(...dates.map(d => d.getTime())))
                  if (taskMin < minDate) minDate = new Date(taskMin.getTime() - 7 * 24 * 60 * 60 * 1000)
                  if (taskMax > maxDate) maxDate = new Date(taskMax.getTime() + 7 * 24 * 60 * 60 * 1000)
                }

                // Generate all days in range
                const allDays: Date[] = []
                const d = new Date(minDate)
                while (d <= maxDate) {
                  allDays.push(new Date(d))
                  d.setDate(d.getDate() + 1)
                }

                // Column width based on view mode
                const dayWidth = ganttViewMode === 'daily' ? 40 : ganttViewMode === 'weekly' ? 24 : ganttViewMode === 'monthly' ? 10 : 4
                const totalDays = allDays.length
                const timelineWidth = totalDays * dayWidth
                const taskListWidth = 250

                // Calculate today's position for centering
                const todayIndex = allDays.findIndex(d => d.toDateString() === today.toDateString())
                const todayPosition = todayIndex * dayWidth

                // Calculate row height to fill viewport - but cap at a reasonable max
                const headerHeight = 60 // Two rows for month + day headers
                const availableHeight = typeof window !== 'undefined' ? window.innerHeight * 0.95 - 160 - headerHeight : 500
                const minRowHeight = 48
                const maxRowHeight = 80
                const calculatedRowHeight = tasks.length > 0 ? Math.floor(availableHeight / Math.max(tasks.length, 5)) : minRowHeight
                const rowHeight = Math.max(minRowHeight, Math.min(maxRowHeight, calculatedRowHeight))
                const totalRowsHeight = tasks.length * rowHeight

                const statusColors: Record<string, string> = {
                  backlog: 'bg-gray-400',
                  todo: 'bg-blue-400',
                  in_progress: 'bg-yellow-500',
                  review: 'bg-purple-500',
                  done: 'bg-green-500',
                  blocked: 'bg-red-500'
                }

                // Group days by month for header
                const months: { month: string; startIndex: number; count: number }[] = []
                let currentMonth = ''
                allDays.forEach((day, i) => {
                  const monthKey = day.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                  if (monthKey !== currentMonth) {
                    months.push({ month: monthKey, startIndex: i, count: 1 })
                    currentMonth = monthKey
                  } else {
                    months[months.length - 1].count++
                  }
                })

                // Get task position in pixels
                const getTaskPixelPosition = (task: Task) => {
                  if (!task.start_date || !task.due_date) return null
                  const start = new Date(task.start_date)
                  const end = new Date(task.due_date)
                  start.setHours(0, 0, 0, 0)
                  end.setHours(0, 0, 0, 0)

                  const startIndex = allDays.findIndex(d => d.toDateString() === start.toDateString())
                  const endIndex = allDays.findIndex(d => d.toDateString() === end.toDateString())

                  if (startIndex === -1 || endIndex === -1) {
                    // Task is outside visible range, calculate relative position
                    const minTime = minDate.getTime()
                    const startDays = Math.floor((start.getTime() - minTime) / (24 * 60 * 60 * 1000))
                    const endDays = Math.floor((end.getTime() - minTime) / (24 * 60 * 60 * 1000))
                    return {
                      left: startDays * dayWidth,
                      width: Math.max(dayWidth, (endDays - startDays + 1) * dayWidth)
                    }
                  }

                  return {
                    left: startIndex * dayWidth,
                    width: Math.max(dayWidth, (endIndex - startIndex + 1) * dayWidth)
                  }
                }

                // Refs for synchronized scrolling
                let taskListRef: HTMLDivElement | null = null
                let timelineRef: HTMLDivElement | null = null
                let isSyncing = false

                const handleTaskListScroll = () => {
                  if (!taskListRef || !timelineRef || isSyncing) return
                  isSyncing = true
                  timelineRef.scrollTop = taskListRef.scrollTop
                  requestAnimationFrame(() => { isSyncing = false })
                }

                const handleTimelineScroll = () => {
                  if (!taskListRef || !timelineRef || isSyncing) return
                  isSyncing = true
                  taskListRef.scrollTop = timelineRef.scrollTop
                  requestAnimationFrame(() => { isSyncing = false })
                }

                return (
                  <div className="flex flex-1 overflow-hidden">
                    {/* Task List - Fixed Width, Scrolls Vertically */}
                    <div className="flex-shrink-0 border-r bg-white z-20 flex flex-col" style={{ width: `${taskListWidth}px` }}>
                      {/* Task List Header */}
                      <div className="border-b bg-gray-50 flex-shrink-0" style={{ height: `${headerHeight}px` }}>
                        <div className="flex items-center justify-center h-full font-semibold text-sm text-gray-700">
                          Tasks ({tasks.length})
                        </div>
                      </div>
                      {/* Task List Body - Synced scroll with timeline */}
                      <div
                        className="flex-1 overflow-y-auto overflow-x-hidden"
                        ref={(el) => { taskListRef = el }}
                        onScroll={handleTaskListScroll}
                      >
                        <div style={{ minHeight: tasks.length > 0 ? `${totalRowsHeight}px` : '200px' }}>
                          {tasks.map((task, i) => (
                            <div
                              key={task.id}
                              className="border-b border-gray-200 px-3 flex items-center cursor-pointer hover:bg-blue-50 transition-colors"
                              style={{ height: `${rowHeight}px` }}
                              onClick={() => {
                                setGanttDialogOpen(false)
                                handleEditTask(task)
                              }}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate text-gray-900">{task.name}</div>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className={`w-2.5 h-2.5 rounded-full ${statusColors[task.status]}`}></span>
                                  <span className="text-xs text-gray-500 truncate">
                                    {task.start_date && task.due_date
                                      ? `${new Date(task.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                                      : 'No dates set'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                          {tasks.length === 0 && (
                            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
                              No tasks to display
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Timeline - Scrollable Both Ways */}
                    <div
                      className="flex-1 overflow-auto"
                      ref={(el) => {
                        timelineRef = el
                        // Auto-scroll to center on today when dialog opens
                        if (el && todayPosition > 0) {
                          const scrollLeft = todayPosition - el.clientWidth / 2
                          el.scrollLeft = Math.max(0, scrollLeft)
                        }
                      }}
                      onScroll={handleTimelineScroll}
                    >
                      <div style={{ width: `${timelineWidth}px`, minHeight: '100%' }}>
                        {/* Timeline Header - Sticky */}
                        <div className="sticky top-0 bg-white z-10 border-b" style={{ height: `${headerHeight}px` }}>
                          {/* Month Row */}
                          <div className="flex border-b" style={{ height: '30px' }}>
                            {months.map((m, i) => (
                              <div
                                key={i}
                                className="border-r border-gray-300 text-xs font-semibold text-gray-700 flex items-center justify-center bg-gray-100"
                                style={{ width: `${m.count * dayWidth}px` }}
                              >
                                {m.month}
                              </div>
                            ))}
                          </div>
                          {/* Day Row */}
                          <div className="flex" style={{ height: '30px' }}>
                            {allDays.map((day, i) => {
                              const isWeekend = day.getDay() === 0 || day.getDay() === 6
                              const isToday = day.toDateString() === today.toDateString()
                              const isFirstOfMonth = day.getDate() === 1
                              const showLabel = ganttViewMode === 'daily' ||
                                (ganttViewMode === 'weekly' && (day.getDay() === 1 || isFirstOfMonth)) ||
                                (ganttViewMode === 'monthly' && (day.getDate() === 1 || day.getDate() === 15)) ||
                                (ganttViewMode === 'quarterly' && day.getDate() === 1)

                              return (
                                <div
                                  key={i}
                                  className={`border-r text-xs flex items-center justify-center ${
                                    isWeekend ? 'bg-red-100 border-red-200' : 'bg-gray-50'
                                  } ${isToday ? 'bg-blue-200 font-bold border-blue-400' : ''} ${
                                    isFirstOfMonth ? 'border-l-2 border-l-gray-400' : 'border-gray-200'
                                  }`}
                                  style={{ width: `${dayWidth}px` }}
                                >
                                  {showLabel && (
                                    <span className={`${isToday ? 'text-blue-700' : isWeekend ? 'text-red-600' : 'text-gray-600'}`}>
                                      {day.getDate()}
                                    </span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        {/* Timeline Body with Gridlines */}
                        <div className="relative" style={{ minHeight: tasks.length > 0 ? `${totalRowsHeight}px` : '200px' }}>
                          {/* Vertical Gridlines - Full Height */}
                          <div className="absolute inset-0 flex pointer-events-none" style={{ height: `${Math.max(totalRowsHeight, 200)}px` }}>
                            {allDays.map((day, i) => {
                              const isWeekend = day.getDay() === 0 || day.getDay() === 6
                              const isToday = day.toDateString() === today.toDateString()
                              const isFirstOfMonth = day.getDate() === 1

                              return (
                                <div
                                  key={i}
                                  className={`relative ${
                                    isWeekend ? 'bg-red-50' : 'bg-white'
                                  } ${isFirstOfMonth ? 'border-l-2 border-l-gray-300' : 'border-r border-gray-100'}`}
                                  style={{ width: `${dayWidth}px`, height: '100%' }}
                                >
                                  {isToday && (
                                    <div
                                      className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 bg-blue-500 z-10"
                                      style={{ height: '100%' }}
                                    />
                                  )}
                                </div>
                              )
                            })}
                          </div>

                          {/* Horizontal Row Lines */}
                          {tasks.map((_, i) => (
                            <div
                              key={`row-line-${i}`}
                              className="absolute w-full border-b border-gray-200"
                              style={{ top: `${(i + 1) * rowHeight}px` }}
                            />
                          ))}

                          {/* Task Bars */}
                          {tasks.map((task, i) => {
                            const position = getTaskPixelPosition(task)
                            if (!position) return null

                            return (
                              <div
                                key={task.id}
                                className={`absolute rounded-md shadow-md cursor-pointer hover:shadow-lg transition-all ${statusColors[task.status]} text-white text-xs font-medium flex items-center px-2 overflow-hidden hover:scale-[1.02]`}
                                style={{
                                  left: `${position.left}px`,
                                  top: `${i * rowHeight + 6}px`,
                                  width: `${position.width}px`,
                                  height: `${rowHeight - 12}px`,
                                  zIndex: 5
                                }}
                                title={`${task.name}\n${task.start_date ? new Date(task.start_date).toLocaleDateString() : 'No start'} - ${task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No end'}\nStatus: ${task.status.replace('_', ' ')}`}
                                onClick={() => {
                                  setGanttDialogOpen(false)
                                  handleEditTask(task)
                                }}
                              >
                                <span className="truncate drop-shadow-sm">{task.name}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </RoleGuard>
  )
}
