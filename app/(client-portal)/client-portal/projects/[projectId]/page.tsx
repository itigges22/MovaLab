'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Timer,
  Users,
  FileText,
  MessageSquare,
  Workflow,
  CheckCircle2,
  CircleDot,
  PauseCircle,
  PlayCircle,
  Search,
  User,
} from 'lucide-react';
import { format } from 'date-fns';
import ClientWorkflowProgress from '@/components/client-workflow-progress';
import ClientApproveReject from '@/components/client-approve-reject';
import ClientFeedbackForm from '@/components/client-feedback-form';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkflowNode {
  id: string;
  node_type: string;
  label: string;
  position_x?: number;
  position_y?: number;
}

interface WorkflowInstance {
  id: string;
  project_id: string;
  current_node_id: string | null;
  status: string;
  workflow_templates: { id: string; name: string } | null;
  current_node: { id: string; node_type: string; label: string } | null;
}

interface ClientProject {
  id: string;
  name: string;
  description: string | null;
  status: string;
  priority: string;
  account_id: string;
  estimated_hours: number | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  workflow_instance: WorkflowInstance | null;
}

interface TeamMember {
  id: string;
  role_in_project: string | null;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  } | null;
}

interface ProjectUpdate {
  id: string;
  content: string;
  created_at: string;
  author: {
    id: string;
    name: string | null;
  } | null;
}

interface ProjectDetailData {
  project: ClientProject;
  team: TeamMember[];
  updates: ProjectUpdate[];
  workflow_nodes: WorkflowNode[];
  completed_node_ids: string[];
}

// ---------------------------------------------------------------------------
// Badge helpers (consistent with projects list page)
// ---------------------------------------------------------------------------

function statusVariant(status: string): string {
  switch (status) {
    case 'planning':
      return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    case 'in_progress':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'review':
      return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
    case 'complete':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'on_hold':
      return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30';
    default:
      return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30';
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'planning':
      return 'Planning';
    case 'in_progress':
      return 'In Progress';
    case 'review':
      return 'Review';
    case 'complete':
      return 'Complete';
    case 'on_hold':
      return 'On Hold';
    default:
      return status;
  }
}

function statusIcon(status: string) {
  switch (status) {
    case 'planning':
      return <Search className="h-3 w-3" />;
    case 'in_progress':
      return <PlayCircle className="h-3 w-3" />;
    case 'review':
      return <CircleDot className="h-3 w-3" />;
    case 'complete':
      return <CheckCircle2 className="h-3 w-3" />;
    case 'on_hold':
      return <PauseCircle className="h-3 w-3" />;
    default:
      return null;
  }
}

function priorityVariant(priority: string): string {
  switch (priority) {
    case 'low':
      return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30';
    case 'medium':
      return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    case 'high':
      return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
    case 'urgent':
      return 'bg-red-500/15 text-red-400 border-red-500/30';
    default:
      return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30';
  }
}

function priorityLabel(priority: string): string {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Back button */}
      <Skeleton className="h-9 w-32" />

      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-80" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-16" />
        </div>
        <Skeleton className="h-5 w-full max-w-lg" />
      </div>

      {/* Workflow */}
      <Skeleton className="h-24 rounded-lg" />

      {/* Info cards */}
      <div className="grid md:grid-cols-2 gap-4">
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>

      {/* Updates */}
      <Skeleton className="h-64 rounded-lg" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ClientProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const [data, setData] = useState<ProjectDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/client/portal/projects/${projectId}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 404) {
          setError('Project not found or you do not have access.');
          return;
        }
        throw new Error(body.error || 'Failed to load project');
      }
      const json = await res.json();
      setData({
        project: json.project,
        team: json.team || [],
        updates: json.updates || [],
        workflow_nodes: json.workflow_nodes || [],
        completed_node_ids: json.completed_node_ids || [],
      });
      setError('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load project');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  // Callback for when approve/reject completes to refresh data
  function handleWorkflowAction() {
    setLoading(true);
    fetchProject();
  }

  // -----------------------------------------------------------------------
  // States
  // -----------------------------------------------------------------------

  if (loading) {
    return <DetailSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" asChild className="gap-1.5">
          <Link href="/client-portal/projects">
            <ArrowLeft className="h-4 w-4" />
            Back to Projects
          </Link>
        </Button>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="rounded-full bg-destructive/10 p-4 mb-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold mb-2">
            {error || 'Unable to load project'}
          </h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            The project may not exist or you may not have permission to view it.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => router.push('/client-portal/projects')}>
              Go to Projects
            </Button>
            <Button variant="outline" onClick={() => { setLoading(true); setError(''); fetchProject(); }}>
              Try again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const { project, team, updates, workflow_nodes, completed_node_ids } = data;
  const isApprovalNode = project.workflow_instance?.current_node?.node_type === 'approval';
  const workflowName = project.workflow_instance?.workflow_templates?.name || null;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Back navigation */}
      <Button variant="ghost" size="sm" asChild className="gap-1.5 -ml-2">
        <Link href="/client-portal/projects">
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </Link>
      </Button>

      {/* ----------------------------------------------------------------- */}
      {/* Header */}
      {/* ----------------------------------------------------------------- */}
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
          <Badge
            variant="outline"
            className={`text-xs gap-1 ${statusVariant(project.status)}`}
          >
            {statusIcon(project.status)}
            {statusLabel(project.status)}
          </Badge>
          <Badge
            variant="outline"
            className={`text-xs ${priorityVariant(project.priority)}`}
          >
            {priorityLabel(project.priority)}
          </Badge>
        </div>
        {project.description && (
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
            {project.description}
          </p>
        )}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Workflow Progress */}
      {/* ----------------------------------------------------------------- */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Workflow className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Workflow Progress</h2>
          {workflowName && (
            <span className="text-sm text-muted-foreground">({workflowName})</span>
          )}
        </div>
        <Card>
          <CardContent className="pt-2 pb-2">
            <ClientWorkflowProgress
              nodes={workflow_nodes}
              currentNodeId={project.workflow_instance?.current_node_id || null}
              completedNodeIds={completed_node_ids}
            />
          </CardContent>
        </Card>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* Approve / Reject (conditional) */}
      {/* ----------------------------------------------------------------- */}
      {isApprovalNode && project.workflow_instance && (
        <section>
          <ClientApproveReject
            projectId={project.id}
            workflowInstanceId={project.workflow_instance.id}
            currentStepName={project.workflow_instance.current_node?.label || 'Approval'}
            onAction={handleWorkflowAction}
          />
        </section>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Project Info + Team (side by side on desktop) */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Project Info */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Project Details</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow
              label="Status"
              value={
                <Badge variant="outline" className={`text-xs gap-1 ${statusVariant(project.status)}`}>
                  {statusIcon(project.status)}
                  {statusLabel(project.status)}
                </Badge>
              }
            />
            <InfoRow
              label="Priority"
              value={
                <Badge variant="outline" className={`text-xs ${priorityVariant(project.priority)}`}>
                  {priorityLabel(project.priority)}
                </Badge>
              }
            />
            {project.start_date && (
              <InfoRow
                label="Start Date"
                value={
                  <span className="flex items-center gap-1.5 text-sm">
                    <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                    {format(new Date(project.start_date), 'MMM d, yyyy')}
                  </span>
                }
              />
            )}
            {project.end_date && (
              <InfoRow
                label="Deadline"
                value={
                  <span className="flex items-center gap-1.5 text-sm">
                    <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                    {format(new Date(project.end_date), 'MMM d, yyyy')}
                  </span>
                }
              />
            )}
            {project.estimated_hours != null && (
              <InfoRow
                label="Estimated Hours"
                value={
                  <span className="flex items-center gap-1.5 text-sm">
                    <Timer className="h-3.5 w-3.5 text-muted-foreground" />
                    {project.estimated_hours}h
                  </span>
                }
              />
            )}
            {workflowName && (
              <InfoRow
                label="Workflow"
                value={
                  <span className="flex items-center gap-1.5 text-sm">
                    <Workflow className="h-3.5 w-3.5 text-muted-foreground" />
                    {workflowName}
                  </span>
                }
              />
            )}
            <InfoRow
              label="Created"
              value={
                <span className="text-sm text-muted-foreground">
                  {format(new Date(project.created_at), 'MMM d, yyyy')}
                </span>
              }
            />
          </CardContent>
        </Card>

        {/* Team */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Your Team</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {team.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="rounded-full bg-muted p-3 mb-2">
                  <Users className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  No team members assigned yet.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {team.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-2 rounded-md bg-muted/30"
                  >
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      {member.user?.image ? (
                        <img
                          src={member.user.image}
                          alt={member.user.name || 'Team member'}
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    {/* Info */}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {member.user?.name || 'Unknown'}
                      </p>
                      {member.role_in_project && (
                        <p className="text-xs text-muted-foreground truncate">
                          {member.role_in_project}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* ----------------------------------------------------------------- */}
      {/* Project Updates Timeline */}
      {/* ----------------------------------------------------------------- */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Project Updates</h2>
          {updates.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {updates.length}
            </Badge>
          )}
        </div>

        {updates.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
              <div className="rounded-full bg-muted p-3 mb-3">
                <MessageSquare className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                No updates yet
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Project updates from your team will appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-0">
            {updates.map((update, index) => (
              <div key={update.id} className="relative flex gap-4 pb-6">
                {/* Timeline line */}
                {index < updates.length - 1 && (
                  <div className="absolute left-[15px] top-8 bottom-0 w-px bg-border" />
                )}
                {/* Timeline dot */}
                <div className="flex-shrink-0 mt-1">
                  <div className="h-[30px] w-[30px] rounded-full bg-muted flex items-center justify-center border border-border">
                    <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">
                      {update.author?.name || 'System'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(update.created_at), 'MMM d, yyyy h:mm a')}
                    </span>
                  </div>
                  <Card className="bg-muted/30">
                    <CardContent className="py-3 px-4">
                      <p className="text-sm whitespace-pre-wrap">{update.content}</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <Separator />

      {/* ----------------------------------------------------------------- */}
      {/* Feedback Form */}
      {/* ----------------------------------------------------------------- */}
      <section>
        <ClientFeedbackForm projectId={project.id} />
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-muted-foreground flex-shrink-0">{label}</span>
      <div className="text-right">{value}</div>
    </div>
  );
}
