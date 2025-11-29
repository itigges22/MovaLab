'use client';

import { useState, useEffect, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Inbox,
  CheckCircle2,
  Clock,
  Loader2,
  FolderOpen,
  SortAsc,
  SortDesc,
  ExternalLink,
  AlertCircle,
  Trash2
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { createClientSupabase } from '@/lib/supabase';
import Link from 'next/link';
import { formatDistanceToNow, format } from 'date-fns';
import { useProjects } from '@/lib/hooks/use-data';
import { hasPermission, canViewProject, isSuperadmin } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';

interface WorkflowProject {
  id: string;
  name: string;
  description: string | null;
  account_id: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  workflow_instance_id: string | null;
  account?: {
    id: string;
    name: string;
  };
  assigned_by?: string;
  role_in_project?: string;
}

interface ApprovalRequest {
  id: string;
  workflow_instance_id: string;
  current_node_id: string;
  project_id: string;
  projects?: WorkflowProject;
  workflow_nodes?: {
    id: string;
    label: string;
    node_type: string;
  };
}

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
  remaining_hours?: number | null;
  task_hours_sum?: number;
  created_by: string;
  assigned_user_id: string | null;
  created_at: string;
  updated_at: string;
  account?: {
    id: string;
    name: string;
  } | null;
  departments: any[];
  daysUntilDeadline?: number | null;
  workflow_step?: string | null;
  reopened_at?: string | null;
}

interface UnifiedProjectsSectionProps {
  userProfile: any;
}

export function UnifiedProjectsSection({ userProfile }: UnifiedProjectsSectionProps) {
  const [loading, setLoading] = useState(true);
  const [workflowProjects, setWorkflowProjects] = useState<WorkflowProject[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([]);
  const [activeTab, setActiveTab] = useState('projects');

  // Fetch all assigned projects using SWR hook
  const { projects: assignedProjects, isLoading: projectsLoading, error: projectsError } = useProjects(userProfile?.id, 100);
  const [visibleProjects, setVisibleProjects] = useState<ProjectWithDetails[]>([]);

  // Filters and sorting for My Projects tab
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'priority' | 'deadline'>('priority');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Workflow steps for projects
  const [workflowSteps, setWorkflowSteps] = useState<{ [key: string]: string | null }>({});

  // Delete project state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<ProjectWithDetails | null>(null);
  const [deletingProject, setDeletingProject] = useState(false);
  const [canDeleteProjects, setCanDeleteProjects] = useState(false);

  // Check delete permission
  useEffect(() => {
    if (!userProfile) {
      setCanDeleteProjects(false);
      return;
    }

    async function checkDeletePermission() {
      // Superadmins can delete all projects
      if (isSuperadmin(userProfile)) {
        setCanDeleteProjects(true);
        return;
      }

      // Check if user has DELETE_ALL_PROJECTS or DELETE_PROJECT permission
      const [hasDeleteAll, hasDelete] = await Promise.all([
        hasPermission(userProfile, Permission.DELETE_ALL_PROJECTS),
        hasPermission(userProfile, Permission.DELETE_PROJECT)
      ]);

      setCanDeleteProjects(hasDeleteAll || hasDelete);
    }

    checkDeletePermission();
  }, [userProfile]);

  // Load workflow inbox data
  useEffect(() => {
    loadInboxData();
  }, []);

  const loadInboxData = async () => {
    try {
      setLoading(true);

      // OPTIMIZED: Fetch both API calls in parallel instead of sequential
      // This reduces the critical path time by ~50% (no waterfall effect)
      const [projectsRes, approvalsRes] = await Promise.all([
        fetch('/api/workflows/my-projects'),
        fetch('/api/workflows/my-approvals')
      ]);

      const [projectsData, approvalsData] = await Promise.all([
        projectsRes.json(),
        approvalsRes.json()
      ]);

      if (projectsData.success) {
        setWorkflowProjects(projectsData.projects || []);
      }

      if (approvalsData.success) {
        setPendingApprovals(approvalsData.approvals || []);
      }
    } catch (error) {
      console.error('Error loading inbox data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle project deletion
  const handleDeleteProject = async () => {
    if (!projectToDelete || !userProfile) return;

    try {
      setDeletingProject(true);

      const supabase = createClientSupabase();
      if (!supabase) {
        throw new Error('Failed to create Supabase client');
      }

      // Delete the project
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectToDelete.id);

      if (error) {
        throw error;
      }

      // Update local state to remove the deleted project
      setVisibleProjects(prev => prev.filter(p => p.id !== projectToDelete.id));

      // Close dialog and reset state
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
    } catch (error: any) {
      console.error('Error deleting project:', error);
      alert(`Failed to delete project: ${error.message}`);
    } finally {
      setDeletingProject(false);
    }
  };

  // Open delete confirmation dialog
  const openDeleteDialog = (project: ProjectWithDetails) => {
    setProjectToDelete(project);
    setDeleteDialogOpen(true);
  };

  // Stabilize project IDs to prevent infinite loops
  const projectIds = useMemo(
    () => assignedProjects.map((p: ProjectWithDetails) => p.id).join(','),
    [assignedProjects]
  );

  // Filter projects based on permissions
  useEffect(() => {
    if (!userProfile || assignedProjects.length === 0) {
      setVisibleProjects([]);
      return;
    }

    let isMounted = true;

    async function filterProjects() {
      const [hasViewAllProjects, hasViewProjects] = await Promise.all([
        hasPermission(userProfile, Permission.VIEW_ALL_PROJECTS),
        hasPermission(userProfile, Permission.VIEW_PROJECTS)
      ]);

      if (!isMounted) return;

      if (hasViewAllProjects) {
        setVisibleProjects([...assignedProjects]);
        return;
      }

      if (!hasViewProjects) {
        setVisibleProjects([]);
        return;
      }

      const projectPermissionChecks = await Promise.all(
        assignedProjects.map((project: ProjectWithDetails) =>
          canViewProject(userProfile, project.id).catch(() => false)
        )
      );

      if (!isMounted) return;

      const filtered = assignedProjects.filter((_: ProjectWithDetails, index: number) => projectPermissionChecks[index]);
      setVisibleProjects(filtered);
    }

    filterProjects();

    return () => {
      isMounted = false;
    };
  }, [projectIds, userProfile]);

  // Fetch workflow steps for visible projects
  useEffect(() => {
    if (visibleProjects.length === 0) {
      setWorkflowSteps({});
      return;
    }

    async function fetchWorkflowSteps() {
      const supabase = createClientSupabase();
      if (!supabase) return;

      const projectIds = visibleProjects.map(p => p.id);
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
        .eq('status', 'active');

      if (!error && workflowData) {
        const steps: { [key: string]: string | null } = {};
        workflowData.forEach((instance: any) => {
          if (instance.project_id && instance.workflow_nodes?.label) {
            steps[instance.project_id] = instance.workflow_nodes.label;
          }
        });
        setWorkflowSteps(steps);
      }
    }

    fetchWorkflowSteps();
  }, [visibleProjects]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'low':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Filter and sort projects
  const filteredAndSortedProjects = visibleProjects
    .filter(project => {
      if (priorityFilter !== 'all' && project.priority !== priorityFilter) return false;
      return true;
    })
    .sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'priority':
          const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
          aValue = priorityOrder[a.priority as keyof typeof priorityOrder] || 0;
          bValue = priorityOrder[b.priority as keyof typeof priorityOrder] || 0;
          break;
        case 'deadline':
          aValue = a.end_date ? new Date(a.end_date).getTime() : 0;
          bValue = b.end_date ? new Date(b.end_date).getTime() : 0;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    })
    .map(project => ({
      ...project,
      daysUntilDeadline: project.end_date
        ? Math.ceil((new Date(project.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
        : null,
      workflow_step: workflowSteps[project.id] || null
    }));

  if (loading || projectsLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderOpen className="w-5 h-5" />
          My Projects
        </CardTitle>
        <CardDescription>
          All projects assigned to you and pending approvals
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="projects" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              My Projects
              {visibleProjects.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {visibleProjects.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="approvals" className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Pending Approvals
              {pendingApprovals.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {pendingApprovals.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* My Projects Tab */}
          <TabsContent value="projects" className="space-y-4 mt-4">
            {/* Filters and Sorting */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="grid grid-cols-2 sm:flex gap-2 w-full sm:w-auto">
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-full min-w-0">
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

                <Select value={sortBy} onValueChange={(value: 'name' | 'priority' | 'deadline') => setSortBy(value)}>
                  <SelectTrigger className="w-full min-w-0">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="priority">Priority</SelectItem>
                    <SelectItem value="deadline">Deadline</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="w-full sm:w-auto"
                >
                  {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Projects Table */}
            {projectsError ? (
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Projects</h3>
                <p className="text-gray-600">
                  {projectsError.message || 'Failed to load projects. Please try again.'}
                </p>
              </div>
            ) : filteredAndSortedProjects.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">No projects found matching your filters</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Project</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Workflow Step</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Priority</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Account</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Hours Left</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Deadline</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAndSortedProjects.map((project) => (
                      <tr key={project.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-gray-900">{project.name}</p>
                              {project.reopened_at && (
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 text-xs">
                                  Re-opened
                                </Badge>
                              )}
                            </div>
                            {project.description && (
                              <p className="text-sm text-gray-600 truncate max-w-xs">
                                {project.description}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {project.workflow_step ? (
                            <Badge className="text-xs whitespace-nowrap border bg-blue-100 text-blue-800 border-blue-300">
                              {project.workflow_step}
                            </Badge>
                          ) : (
                            <span className="text-sm text-gray-400">No workflow</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className={`${getPriorityColor(project.priority)} text-xs whitespace-nowrap`}>
                            {project.priority}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm text-gray-600">{project.account?.name || 'Unknown'}</span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4 text-blue-500" />
                            <span className="text-sm font-semibold text-blue-600">
                              {project.estimated_hours !== null && project.estimated_hours !== undefined
                                ? `${Math.max(0, project.estimated_hours - (project.actual_hours || 0)).toFixed(1)}h`
                                : '-'}
                            </span>
                          </div>
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
                          <div className="flex items-center gap-2">
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
                            {canDeleteProjects && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => openDeleteDialog(project)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* Pending Approvals Tab */}
          <TabsContent value="approvals" className="space-y-4 mt-4">
            {pendingApprovals.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">No pending approval requests</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingApprovals.map((approval: any) => (
                  <Card key={approval.id} className="border-l-4 border-l-yellow-400 hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Link
                              href={`/projects/${approval.project_id}`}
                              className="font-semibold text-lg hover:text-blue-600 transition-colors"
                            >
                              {approval.projects?.name || 'Unnamed Project'}
                            </Link>
                            <Badge className="bg-yellow-100 text-yellow-800">
                              Awaiting Approval
                            </Badge>
                            {approval.projects?.priority && (
                              <Badge className={getPriorityColor(approval.projects.priority)}>
                                {approval.projects.priority}
                              </Badge>
                            )}
                          </div>
                          {approval.projects?.description && (
                            <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                              {approval.projects.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            {approval.workflow_nodes?.label && (
                              <span className="flex items-center gap-1">
                                <span className="font-medium">Step:</span>
                                {approval.workflow_nodes.label}
                              </span>
                            )}
                            {approval.projects?.account && (
                              <span className="flex items-center gap-1">
                                <span className="font-medium">Account:</span>
                                {approval.projects.account.name}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button size="sm" asChild>
                          <Link href={`/projects/${approval.project_id}`}>
                            Review & Approve
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the project "{projectToDelete?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setProjectToDelete(null);
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
    </Card>
  );
}
