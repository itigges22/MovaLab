'use client'

import { useAuth } from '@/lib/hooks/useAuth'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RoleGuard } from '@/components/role-guard'
import { createClientSupabase } from '@/lib/supabase'
import { Database } from '@/lib/supabase'
import { FolderOpen, Calendar, Clock, User, Building2, SortAsc, SortDesc, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { hasPermission, canViewProject } from '@/lib/rbac'
import { Permission } from '@/lib/permissions'

type Project = Database['public']['Tables']['projects']['Row']
type Account = Database['public']['Tables']['accounts']['Row']
type Department = Database['public']['Tables']['departments']['Row']

interface ProjectWithDetails extends Project {
  account: Account
  departments: Department[]
}

export default function ProjectsPage() {
  const { userProfile } = useAuth()
  const [projects, setProjects] = useState<ProjectWithDetails[]>([])
  const [visibleProjects, setVisibleProjects] = useState<ProjectWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'name' | 'status' | 'priority' | 'deadline'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  useEffect(() => {
    const loadProjects = async () => {
      if (!userProfile) return

      try {
        setLoading(true)
        const supabase = createClientSupabase()
        if (!supabase) {
          throw new Error('Failed to create Supabase client')
        }

        // Get user's departments
        const userDepartments = userProfile.user_roles
          ?.map(ur => ur.roles.departments?.id)
          .filter((id): id is string => id !== undefined && id !== null) || []

        // Query projects based on user's department access
        let query = supabase
          .from('projects')
          .select(`
            *,
            account:accounts(*),
            project_departments(
              department:departments(*)
            )
          `)

        // If user is not admin level, filter by their departments
        const isAdminLevel = userProfile.user_roles?.some(ur => 
          ['Executive', 'Director', 'Superadmin'].includes(ur.roles.name)
        )

        if (!isAdminLevel && userDepartments.length > 0) {
          // First get project IDs that the user has access to
          const { data: accessibleProjectIds } = await supabase
            .from('project_departments')
            .select('project_id')
            .in('department_id', userDepartments)
          
          if (accessibleProjectIds && accessibleProjectIds.length > 0) {
            const projectIds = accessibleProjectIds.map((p: any) => p.project_id)
            query = query.in('id', projectIds)
          } else {
            // No accessible projects - filter to empty result set using invalid UUID
            query = query.eq('id', '00000000-0000-0000-0000-000000000000')
          }
        }

        const { data, error: queryError } = await query

        if (queryError) {
          throw queryError
        }

        // Transform the data to include departments
        const projectsWithDetails: ProjectWithDetails[] = (data || []).map((project: any) => ({
          ...project,
          departments: project.project_departments?.map((pd: any) => pd.department).filter(Boolean) || []
        }))

        setProjects(projectsWithDetails)
      } catch (err) {
        console.error('Error loading projects:', err)
        setError(err instanceof Error ? err.message : 'Failed to load projects')
      } finally {
        setLoading(false)
      }
    }

    loadProjects()
  }, [userProfile])

  // Filter projects based on permissions
  useEffect(() => {
    if (!userProfile || projects.length === 0) {
      setVisibleProjects([])
      return
    }

    async function filterProjects() {
      const filtered: ProjectWithDetails[] = []
      const hasViewAllProjects = await hasPermission(userProfile, Permission.VIEW_ALL_PROJECTS)
      const hasViewProjects = await hasPermission(userProfile, Permission.VIEW_PROJECTS)
      
      for (const project of projects) {
        // If user has VIEW_ALL_PROJECTS, they can see all projects
        if (hasViewAllProjects) {
          filtered.push(project)
          continue
        }
        
        // If user has VIEW_PROJECTS, check if they can view this specific project
        if (hasViewProjects) {
          const canView = await canViewProject(userProfile, project.id)
          if (canView) {
            filtered.push(project)
          }
        }
      }
      
      setVisibleProjects(filtered)
    }

    filterProjects()
  }, [projects, userProfile])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planning':
        return { backgroundColor: '#dbeafe', color: '#1e40af', borderColor: '#93c5fd' }
      case 'in_progress':
        return { backgroundColor: '#fef3c7', color: '#d97706', borderColor: '#fbbf24' }
      case 'review':
        return { backgroundColor: '#e9d5ff', color: '#7c3aed', borderColor: '#c4b5fd' }
      case 'complete':
        return { backgroundColor: '#d1fae5', color: '#059669', borderColor: '#6ee7b7' }
      case 'on_hold':
        return { backgroundColor: '#fee2e2', color: '#dc2626', borderColor: '#fca5a5' }
      default:
        return { backgroundColor: '#f3f4f6', color: '#374151', borderColor: '#d1d5db' }
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return { backgroundColor: '#fee2e2', color: '#dc2626', borderColor: '#fca5a5' }
      case 'high':
        return { backgroundColor: '#fed7aa', color: '#ea580c', borderColor: '#fdba74' }
      case 'medium':
        return { backgroundColor: '#fef3c7', color: '#d97706', borderColor: '#fbbf24' }
      case 'low':
        return { backgroundColor: '#d1fae5', color: '#059669', borderColor: '#6ee7b7' }
      default:
        return { backgroundColor: '#f3f4f6', color: '#374151', borderColor: '#d1d5db' }
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not set'
    return new Date(dateString).toLocaleDateString()
  }

  // Filter and sort projects (use visibleProjects which are already permission-filtered)
  const filteredAndSortedProjects = visibleProjects
    .filter(project => {
      if (statusFilter !== 'all' && project.status !== statusFilter) return false
      if (priorityFilter !== 'all' && project.priority !== priorityFilter) return false
      return true
    })
    .sort((a, b) => {
      let aValue: any, bValue: any
      
      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
          break
        case 'status':
          aValue = a.status
          bValue = b.status
          break
        case 'priority':
          const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 }
          aValue = priorityOrder[a.priority as keyof typeof priorityOrder] || 0
          bValue = priorityOrder[b.priority as keyof typeof priorityOrder] || 0
          break
        case 'deadline':
          aValue = a.end_date ? new Date(a.end_date).getTime() : 0
          bValue = b.end_date ? new Date(b.end_date).getTime() : 0
          break
        default:
          return 0
      }
      
      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1
      return 0
    })
    .map(project => ({
      ...project,
      daysUntilDeadline: project.end_date 
        ? Math.ceil((new Date(project.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
        : null
    }))

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
              View and manage all projects you have access to
            </p>
          </div>
        </div>

        {visibleProjects.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <FolderOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Projects Found</h3>
              <p className="text-gray-600">
                You don't have access to any projects yet, or no projects have been created.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <div className="space-y-4">
                <CardTitle>Your Assigned Projects</CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="planning">Planning</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="review">Review</SelectItem>
                      <SelectItem value="complete">Complete</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priority</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={sortBy} onValueChange={(value: 'name' | 'status' | 'priority' | 'deadline') => setSortBy(value)}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name">Name</SelectItem>
                      <SelectItem value="status">Status</SelectItem>
                      <SelectItem value="priority">Priority</SelectItem>
                      <SelectItem value="deadline">Deadline</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="px-3"
                  >
                    {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Project</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Priority</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Account</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Deadline</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAndSortedProjects.map((project) => (
                      <tr key={project.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-gray-900">{project.name}</p>
                            {project.description && (
                              <p className="text-sm text-gray-600 truncate max-w-xs">
                                {project.description}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge 
                            className="text-xs whitespace-nowrap border"
                            style={getStatusColor(project.status)}
                          >
                            {project.status.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <Badge 
                            className="text-xs whitespace-nowrap border"
                            style={getPriorityColor(project.priority)}
                          >
                            {project.priority}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm text-gray-600">{project.account?.name || 'Unknown'}</span>
                        </td>
                        <td className="py-3 px-4">
                          {project.end_date ? (
                            <div>
                              <p className="text-sm text-gray-900">
                                {format(new Date(project.end_date), 'MMM dd, yyyy')}
                              </p>
                              {project.daysUntilDeadline !== null && (
                                <p className={`text-xs ${
                                  project.daysUntilDeadline < 0 
                                    ? 'text-red-600' 
                                    : project.daysUntilDeadline <= 7 
                                      ? 'text-yellow-600' 
                                      : 'text-gray-600'
                                }`}>
                                  {project.daysUntilDeadline < 0 
                                    ? `${Math.abs(project.daysUntilDeadline)} days overdue`
                                    : `${project.daysUntilDeadline} days left`
                                  }
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">No deadline</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            className="h-8 w-8 p-0"
                          >
                            <Link href={`/projects/${project.id}`}>
                              <ExternalLink className="h-4 w-4" />
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </RoleGuard>
  )
}
