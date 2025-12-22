'use client';


import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Inbox, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { createClientSupabase } from '@/lib/supabase';

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

export function UserInbox() {
  const [loading, setLoading] = useState(true);
  const [myProjects, setMyProjects] = useState<WorkflowProject[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([]);
  const [activeTab, setActiveTab] = useState('projects');
  const [workflowSteps, setWorkflowSteps] = useState<{ [key: string]: string | null }>({});

  useEffect(() => {
    void loadInboxData();
  }, []);

  // Fetch workflow steps when myProjects changes
  useEffect(() => {
    if (myProjects.length === 0) {
      setWorkflowSteps({});
      return;
    }

    async function fetchWorkflowSteps() {
      const supabase = createClientSupabase() as any;
      if (!supabase) return;

      const projectIds = myProjects.map((p: any) => p.id);
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
          const projectId = instance.project_id;
          const workflowNodes = instance.workflow_nodes as { label?: string } | null | undefined;
          if (typeof projectId === 'string' && workflowNodes && typeof workflowNodes.label === 'string') {
            steps[projectId] = workflowNodes.label;
          }
        });
        setWorkflowSteps(steps);
      }
    }

    void fetchWorkflowSteps();
  }, [myProjects]);

  const loadInboxData = async () => {
    try {
      setLoading(true);

      // Load my active projects
      const projectsRes = await fetch('/api/workflows/my-projects');
      const projectsData = await projectsRes.json();
      if (projectsData.success) {
        setMyProjects(projectsData.projects || []);
      }

      // Load pending approvals
      const approvalsRes = await fetch('/api/workflows/my-approvals');
      const approvalsData = await approvalsRes.json();
      if (approvalsData.success) {
        setPendingApprovals(approvalsData.approvals || []);
      }
    } catch (error: unknown) {
      console.error('Error loading inbox data:', error);
    } finally {
      setLoading(false);
    }
  };

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

  if (loading) {
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
          <Inbox className="w-5 h-5" />
          My Workflow Inbox
        </CardTitle>
        <CardDescription>
          Projects and approvals assigned to you
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="projects" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              My Projects
              {myProjects.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {myProjects.length}
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
            {myProjects.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">No active projects assigned to you</p>
              </div>
            ) : (
              <div className="space-y-3">
                {myProjects.map((project:any) => {
                  const projectData = project as WorkflowProject & {
                    projects?: WorkflowProject;
                  };
                  const displayProject = projectData.projects || projectData;
                  const projectId = displayProject.id;

                  return (
                    <Card key={projectId} className="border-l-4 hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Link
                                href={`/projects/${projectId}`}
                                className="font-semibold text-lg hover:text-blue-600 transition-colors"
                              >
                                {displayProject.name}
                              </Link>
                              <Badge className={getPriorityColor(displayProject.priority)}>
                                {displayProject.priority}
                              </Badge>
                              {workflowSteps[projectId] ? (
                                <Badge className="border bg-blue-100 text-blue-800 border-blue-300">
                                  {workflowSteps[projectId]}
                                </Badge>
                              ) : (
                                <span className="text-xs text-gray-400">No workflow</span>
                              )}
                            </div>
                            {displayProject.description && (
                              <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                                {displayProject.description}
                              </p>
                            )}
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              {displayProject.account && (
                                <span className="flex items-center gap-1">
                                  <span className="font-medium">Account:</span>
                                  {displayProject.account.name}
                                </span>
                              )}
                              {projectData.role_in_project && (
                                <span className="flex items-center gap-1">
                                  <span className="font-medium">Role:</span>
                                  {projectData.role_in_project}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <span className="font-medium">Updated:</span>
                                {formatDistanceToNow(new Date(displayProject.updated_at), {
                                  addSuffix: true,
                                })}
                              </span>
                            </div>
                          </div>
                          <Button size="sm" asChild>
                            <Link href={`/projects/${projectId}`}>
                              View Project
                            </Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
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
                {pendingApprovals.map((approval:any) => {
                  const approvalData = approval as ApprovalRequest;
                  const displayProject = approvalData.projects;

                  return (
                    <Card key={approvalData.id} className="border-l-4 border-l-yellow-400 hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Link
                                href={`/projects/${approvalData.project_id}`}
                                className="font-semibold text-lg hover:text-blue-600 transition-colors"
                              >
                                {displayProject?.name || 'Unnamed Project'}
                              </Link>
                              <Badge className="bg-yellow-100 text-yellow-800">
                                Awaiting Approval
                              </Badge>
                              {displayProject?.priority && (
                                <Badge className={getPriorityColor(displayProject.priority)}>
                                  {displayProject.priority}
                                </Badge>
                              )}
                            </div>
                            {displayProject?.description && (
                              <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                                {displayProject.description}
                              </p>
                            )}
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              {approvalData.workflow_nodes?.label && (
                                <span className="flex items-center gap-1">
                                  <span className="font-medium">Step:</span>
                                  {approvalData.workflow_nodes.label}
                                </span>
                              )}
                              {displayProject?.account && (
                                <span className="flex items-center gap-1">
                                  <span className="font-medium">Account:</span>
                                  {displayProject.account.name}
                                </span>
                              )}
                            </div>
                          </div>
                          <Button size="sm" asChild>
                            <Link href={`/projects/${approvalData.project_id}`}>
                              Review & Approve
                            </Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
