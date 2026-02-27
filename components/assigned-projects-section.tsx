'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  FolderOpen,
  AlertCircle,
  ArrowRight
} from 'lucide-react'
import { ProjectDataTable, ProjectTableData, ProjectStatus, ProjectPriority } from '@/components/project-data-table'
import { hasPermission, canViewProject, UserWithRoles } from '@/lib/rbac'
import { Permission } from '@/lib/permissions'
import { useProjects } from '@/lib/hooks/use-data'
import { createClientSupabase } from '@/lib/supabase'

interface ProjectWithDetails {
  id: string;
  name: string;
  description: string | null;
  account_id: string;
  status: string;
  priority: string;
  start_date: string | null;
  end_date: string | null;
  estimated_hours: number | null;
  actual_hours: number;
  remaining_hours?: number | null; // Added for capacity tracking
  task_hours_sum?: number; // Sum of task estimated hours
  created_by: string;
  assigned_user_id: string | null;
  created_at: string;
  updated_at: string;
  account?: {
    id: string;
    name: string;
  } | null;
  departments: Record<string, unknown>[];
  workflow_step?: string | null;
  daysUntilDeadline?: number | null;
}

interface AssignedProjectsSectionProps {
  userProfile: UserWithRoles;
}

export function AssignedProjectsSection({ userProfile }: AssignedProjectsSectionProps) {
  // Use SWR hook for automatic caching and deduplication
  const { projects: assignedProjects, isLoading: projectsLoading, error: projectsError } = useProjects((userProfile as any)?.id as string | undefined, 10)
  const [visibleProjects, setVisibleProjects] = useState<ProjectWithDetails[]>([])
  const [permissionsChecked, setPermissionsChecked] = useState(false)
  const [workflowSteps, setWorkflowSteps] = useState<{ [key: string]: string | null }>({})
  const router = useRouter()

  // Stabilize project IDs to prevent infinite loops from SWR array reference changes
  const projectIds = useMemo(
    () => assignedProjects.map((p: ProjectWithDetails) => p.id).join(','),
    [assignedProjects]
  )

  // Filter projects based on permissions - OPTIMIZED: Batch permission checks
  useEffect(() => {
    if (!userProfile || assignedProjects.length === 0) {
      setVisibleProjects([])
      setPermissionsChecked(true)
      return
    }

    let isMounted = true
    setPermissionsChecked(false)

    async function filterProjects() {
      // Batch all permission checks upfront instead of checking per project
      const [hasViewAllProjects, hasViewProjects] = await Promise.all([
        hasPermission(userProfile, Permission.VIEW_ALL_PROJECTS),
        hasPermission(userProfile, Permission.VIEW_PROJECTS)
      ])

      if (!isMounted) return

      // If user has VIEW_ALL_PROJECTS, they can see all projects - no need to check individual projects
      if (hasViewAllProjects) {
        setVisibleProjects([...assignedProjects])
        setPermissionsChecked(true)
        return
      }

      // If user doesn't have VIEW_PROJECTS, they can't see any projects
      if (!hasViewProjects) {
        setVisibleProjects([])
        setPermissionsChecked(true)
        return
      }

      // Batch check all project permissions in parallel instead of sequentially
      const projectPermissionChecks = await Promise.all(
        assignedProjects.map((project: ProjectWithDetails) =>
          canViewProject(userProfile, project.id).catch(() => false)
        )
      )

      if (!isMounted) return

      // Filter projects based on permission results
      const filtered = assignedProjects.filter((_: ProjectWithDetails, index: number) => projectPermissionChecks[index])
      setVisibleProjects(filtered)
      setPermissionsChecked(true)
    }

    filterProjects()

    return () => {
      isMounted = false
    }
  }, [projectIds, userProfile, assignedProjects])

  // Fetch workflow steps for visible projects
  useEffect(() => {
    if (visibleProjects.length === 0) {
      setWorkflowSteps({})
      return
    }

    async function fetchWorkflowSteps() {
      const supabase = createClientSupabase()!
      if (!supabase) return

      const projectIds = visibleProjects.map((p: any) => p.id)
      const { data: workflowData, error } = await supabase
        .from('workflow_instances')
        .select(`
          project_id,
          current_node_id,
          workflow_nodes!workflow_instances_current_node_id_fkey (
            label
          )
        `)
        .in('project_id', projectIds)
        .eq('status', 'active')

      if (!error && workflowData) {
        const steps: { [key: string]: string | null } = {}
        workflowData.forEach((instance: any) => {
          const projectId = instance.project_id as string
          const workflowNodes = instance.workflow_nodes as Record<string, unknown> | null | undefined
          const label = workflowNodes?.label as string | null | undefined
          if (projectId && label) {
            steps[projectId] = label
          }
        })
        setWorkflowSteps(steps)
      }
    }

    fetchWorkflowSteps()
  }, [visibleProjects])

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
        estimated: project.estimated_hours || undefined,
        actual: project.actual_hours || 0,
        remaining: project.estimated_hours
          ? Math.max(0, project.estimated_hours - (project.actual_hours || 0))
          : undefined
      },
      deadline: project.end_date || undefined,
      assignedUsers: [], // This section doesn't have assigned users data
      status: (project.status || 'planning') as ProjectStatus
    }))
  }

  // Add workflow steps to visible projects
  const projectsWithWorkflowSteps = visibleProjects.map((project: any) => ({
    ...project,
    workflow_step: workflowSteps[project.id] || null
  }))

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center space-x-2">
          <FolderOpen className="w-6 h-6 text-blue-600" />
          <div>
            <CardTitle>Your Assigned Projects</CardTitle>
            <CardDescription>Projects you have been assigned to work on</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {projectsLoading || !permissionsChecked ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">Loading your projects...</p>
          </div>
        ) : projectsError ? (
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Projects</h3>
            <p className="text-gray-600">
              {projectsError.message || 'Failed to load projects. Please try again.'}
            </p>
          </div>
        ) : assignedProjects.length === 0 ? (
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Projects Assigned</h3>
            <p className="text-gray-600">
              You don&apos;t have any projects assigned yet. Check back later or contact your manager.
            </p>
          </div>
        ) : (
          <ProjectDataTable
            projects={transformToTableData(projectsWithWorkflowSteps)}
            defaultVisibleColumns={['name', 'workflowStep', 'priority', 'account', 'hours', 'deadline', 'status']}
            onRowClick={(project) => router.push(`/projects/${project.id}`)}
          />
        )}
        
        {assignedProjects.length > 0 && (
          <div className="mt-4 text-center">
            <Button 
              variant="outline" 
              onClick={() => router.push('/projects')}
              className="inline-flex items-center space-x-2"
            >
              <span>View All Projects</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
