'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertCircle,
  Clock,
  FolderOpen,
  CheckCircle2,
  ArrowRight,
  Loader2,
  CalendarDays,
  Timer,
  AlertTriangle,
  Inbox,
  BarChart3,
  CircleDot,
  PauseCircle,
  PlayCircle,
  Search,
} from 'lucide-react';
import { format, isPast, differenceInDays } from 'date-fns';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkflowNode {
  id: string;
  node_type: string;
  label: string;
}

interface WorkflowInstance {
  id: string;
  project_id: string;
  current_node_id: string | null;
  status: string;
  workflow_templates: { id: string; name: string } | null;
  current_node: WorkflowNode | null;
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

// ---------------------------------------------------------------------------
// Badge color helpers
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
// Deadline helper
// ---------------------------------------------------------------------------

function deadlineInfo(endDate: string | null): {
  text: string;
  isOverdue: boolean;
  isSoon: boolean;
} {
  if (!endDate) return { text: 'No deadline', isOverdue: false, isSoon: false };

  const date = new Date(endDate);
  const isOverdue = isPast(date) && differenceInDays(new Date(), date) > 0;
  const daysLeft = differenceInDays(date, new Date());
  const isSoon = !isOverdue && daysLeft <= 7 && daysLeft >= 0;

  return {
    text: format(date, 'MMM d, yyyy'),
    isOverdue,
    isSoon,
  };
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      {/* Header skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-5 w-96" />
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>

      {/* Pending actions skeleton */}
      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-32 rounded-lg" />
      </div>

      {/* Projects skeleton */}
      <div className="space-y-3">
        <Skeleton className="h-6 w-32" />
        <div className="grid md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main dashboard component
// ---------------------------------------------------------------------------

export default function ClientPortalDashboard() {
  const [projects, setProjects] = useState<ClientProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/client/portal/projects');
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Failed to load projects');
        }
        const data = await res.json();
        setProjects(data.projects || []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load projects');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Derived data
  const pendingActions = useMemo(
    () =>
      projects.filter(
        (p) =>
          p.workflow_instance &&
          p.workflow_instance.status === 'active' &&
          p.workflow_instance.current_node?.node_type === 'approval'
      ),
    [projects]
  );

  const activeProjects = useMemo(
    () => projects.filter((p) => p.status !== 'complete'),
    [projects]
  );

  const completedProjects = useMemo(
    () => projects.filter((p) => p.status === 'complete'),
    [projects]
  );

  // Stats
  const stats = useMemo(() => {
    const total = projects.length;
    const active = activeProjects.length;
    const completed = completedProjects.length;
    const pending = pendingActions.length;
    return { total, active, completed, pending };
  }, [projects, activeProjects, completedProjects, pendingActions]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="rounded-full bg-destructive/10 p-4 mb-4">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Unable to load dashboard</h2>
        <p className="text-muted-foreground mb-6 max-w-md">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Overview of your projects and pending actions.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Projects"
          value={stats.total}
          icon={<FolderOpen className="h-4 w-4" />}
          variant="default"
        />
        <StatCard
          label="Active"
          value={stats.active}
          icon={<PlayCircle className="h-4 w-4" />}
          variant="blue"
        />
        <StatCard
          label="Completed"
          value={stats.completed}
          icon={<CheckCircle2 className="h-4 w-4" />}
          variant="green"
        />
        <StatCard
          label="Needs Review"
          value={stats.pending}
          icon={<AlertTriangle className="h-4 w-4" />}
          variant="amber"
        />
      </div>

      {/* Pending Actions */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-amber-400" />
          <h2 className="text-lg font-semibold">Pending Actions</h2>
          {pendingActions.length > 0 && (
            <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 ml-1">
              {pendingActions.length}
            </Badge>
          )}
        </div>

        {pendingActions.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
              <div className="rounded-full bg-muted p-3 mb-3">
                <Inbox className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                No items requiring your attention
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                You will be notified when a project needs your review.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {pendingActions.map((project) => (
              <PendingActionCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </section>

      <Separator />

      {/* My Projects */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">My Projects</h2>
          </div>
          {projects.length > 0 && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/client-portal/projects" className="gap-1.5">
                View all
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
        </div>

        {projects.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-14 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <FolderOpen className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-semibold mb-1">No projects yet</h3>
              <p className="text-xs text-muted-foreground max-w-sm">
                Projects assigned to your account will appear here. Contact your
                project manager for more information.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </section>

      <Separator />

      {/* Project Status Summary */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Status Summary</h2>
        </div>

        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">No project data available.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {(['planning', 'in_progress', 'review', 'on_hold', 'complete'] as const).map(
              (status) => {
                const count = projects.filter((p) => p.status === status).length;
                return (
                  <Card key={status} className="text-center">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center justify-center gap-1.5 mb-1.5">
                        {statusIcon(status)}
                        <span className="text-xs font-medium text-muted-foreground">
                          {statusLabel(status)}
                        </span>
                      </div>
                      <p className="text-2xl font-bold tabular-nums">{count}</p>
                    </CardContent>
                  </Card>
                );
              }
            )}
          </div>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  icon,
  variant,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  variant: 'default' | 'blue' | 'green' | 'amber';
}) {
  const bgMap = {
    default: 'bg-muted/50',
    blue: 'bg-blue-500/10',
    green: 'bg-emerald-500/10',
    amber: 'bg-amber-500/10',
  };

  const iconColorMap = {
    default: 'text-muted-foreground',
    blue: 'text-blue-400',
    green: 'text-emerald-400',
    amber: 'text-amber-400',
  };

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold tabular-nums mt-1">{value}</p>
          </div>
          <div className={`rounded-lg p-2.5 ${bgMap[variant]}`}>
            <span className={iconColorMap[variant]}>{icon}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PendingActionCard({ project }: { project: ClientProject }) {
  const workflowStep =
    project.workflow_instance?.current_node?.label || 'Approval Required';
  const workflowName =
    project.workflow_instance?.workflow_templates?.name || 'Workflow';

  return (
    <Link href={`/client-portal/projects/${project.id}`}>
      <Card className="border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 transition-colors cursor-pointer">
        <CardContent className="py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="rounded-full bg-amber-500/15 p-2 flex-shrink-0">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{project.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {workflowName} &mdash; <span className="text-amber-400 font-medium">{workflowStep}</span>
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="flex-shrink-0 gap-1.5 border-amber-500/30 text-amber-400 hover:bg-amber-500/15 hover:text-amber-300"
            >
              Review
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function ProjectCard({ project }: { project: ClientProject }) {
  const deadline = deadlineInfo(project.end_date);
  const workflowStep =
    project.workflow_instance?.current_node?.label || null;
  const workflowName =
    project.workflow_instance?.workflow_templates?.name || null;
  const isApproval =
    project.workflow_instance?.current_node?.node_type === 'approval';

  return (
    <Link href={`/client-portal/projects/${project.id}`}>
      <Card className="hover:border-muted-foreground/30 transition-colors cursor-pointer h-full">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-sm font-semibold leading-snug line-clamp-2">
              {project.name}
            </CardTitle>
            <Badge
              variant="outline"
              className={`flex-shrink-0 text-[10px] gap-1 ${statusVariant(project.status)}`}
            >
              {statusIcon(project.status)}
              {statusLabel(project.status)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {/* Priority + workflow step */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={`text-[10px] ${priorityVariant(project.priority)}`}
            >
              {priorityLabel(project.priority)}
            </Badge>
            {workflowStep ? (
              <span
                className={`text-xs font-medium ${
                  isApproval ? 'text-amber-400' : 'text-muted-foreground'
                }`}
              >
                {isApproval && <AlertTriangle className="h-3 w-3 inline mr-1 -mt-0.5" />}
                {workflowStep}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground/60">
                No active workflow
              </span>
            )}
          </div>

          {/* Description */}
          {project.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {project.description}
            </p>
          )}

          {/* Meta info */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground pt-1 border-t border-border/50">
            {/* Deadline */}
            <span
              className={`flex items-center gap-1 ${
                deadline.isOverdue
                  ? 'text-red-400'
                  : deadline.isSoon
                  ? 'text-amber-400'
                  : ''
              }`}
            >
              <CalendarDays className="h-3 w-3" />
              {deadline.text}
              {deadline.isOverdue && (
                <span className="text-[10px] font-medium">(overdue)</span>
              )}
            </span>

            {/* Estimated hours */}
            {project.estimated_hours != null && (
              <span className="flex items-center gap-1">
                <Timer className="h-3 w-3" />
                {project.estimated_hours}h estimated
              </span>
            )}

            {/* Workflow template */}
            {workflowName && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {workflowName}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
