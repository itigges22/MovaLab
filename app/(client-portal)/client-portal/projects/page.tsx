'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FolderOpen,
  ArrowRight,
  AlertCircle,
  CalendarDays,
  Timer,
  AlertTriangle,
  CheckCircle2,
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
// Badge color helpers (same as dashboard)
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

function ProjectsListSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-80" />
      </div>

      {/* Table skeleton */}
      <Card>
        <div className="p-1">
          <div className="space-y-0">
            {/* Table header skeleton */}
            <div className="grid grid-cols-6 gap-4 px-4 py-3 border-b">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
            {/* Table rows skeleton */}
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="grid grid-cols-6 gap-4 px-4 py-4 border-b last:border-0">
                <div className="col-span-1 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function ClientPortalProjectsPage() {
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

  if (loading) {
    return <ProjectsListSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="rounded-full bg-destructive/10 p-4 mb-4">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Unable to load projects</h2>
        <p className="text-muted-foreground mb-6 max-w-md">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
        <p className="text-muted-foreground mt-1">
          All projects associated with your account.
        </p>
      </div>

      {/* Content */}
      {projects.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
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
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Project</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Workflow Step</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead className="text-right">Est. Hours</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => (
                <ProjectRow key={project.id} project={project} />
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table row component
// ---------------------------------------------------------------------------

function ProjectRow({ project }: { project: ClientProject }) {
  const deadline = deadlineInfo(project.end_date);
  const workflowStep = project.workflow_instance?.current_node?.label || null;
  const isApproval =
    project.workflow_instance?.current_node?.node_type === 'approval';

  return (
    <TableRow className="group cursor-pointer">
      <TableCell>
        <Link
          href={`/client-portal/projects/${project.id}`}
          className="block -m-4 p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                {project.name}
              </p>
              {project.description && (
                <p className="text-xs text-muted-foreground truncate mt-0.5 max-w-[300px]">
                  {project.description}
                </p>
              )}
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </div>
        </Link>
      </TableCell>
      <TableCell>
        <Link
          href={`/client-portal/projects/${project.id}`}
          className="block -m-4 p-4"
        >
          <Badge
            variant="outline"
            className={`text-[10px] gap-1 ${statusVariant(project.status)}`}
          >
            {statusIcon(project.status)}
            {statusLabel(project.status)}
          </Badge>
        </Link>
      </TableCell>
      <TableCell>
        <Link
          href={`/client-portal/projects/${project.id}`}
          className="block -m-4 p-4"
        >
          <Badge
            variant="outline"
            className={`text-[10px] ${priorityVariant(project.priority)}`}
          >
            {priorityLabel(project.priority)}
          </Badge>
        </Link>
      </TableCell>
      <TableCell>
        <Link
          href={`/client-portal/projects/${project.id}`}
          className="block -m-4 p-4"
        >
          {workflowStep ? (
            <span
              className={`text-xs font-medium flex items-center gap-1 ${
                isApproval ? 'text-amber-400' : 'text-muted-foreground'
              }`}
            >
              {isApproval && <AlertTriangle className="h-3 w-3 flex-shrink-0" />}
              {workflowStep}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground/60">
              No active workflow
            </span>
          )}
        </Link>
      </TableCell>
      <TableCell>
        <Link
          href={`/client-portal/projects/${project.id}`}
          className="block -m-4 p-4"
        >
          <span
            className={`text-xs flex items-center gap-1 ${
              deadline.isOverdue
                ? 'text-red-400 font-medium'
                : deadline.isSoon
                ? 'text-amber-400 font-medium'
                : 'text-muted-foreground'
            }`}
          >
            <CalendarDays className="h-3 w-3 flex-shrink-0" />
            {deadline.text}
            {deadline.isOverdue && (
              <span className="text-[10px]">(overdue)</span>
            )}
          </span>
        </Link>
      </TableCell>
      <TableCell className="text-right">
        <Link
          href={`/client-portal/projects/${project.id}`}
          className="block -m-4 p-4 text-right"
        >
          {project.estimated_hours != null ? (
            <span className="text-xs text-muted-foreground flex items-center justify-end gap-1">
              <Timer className="h-3 w-3" />
              {project.estimated_hours}h
            </span>
          ) : (
            <span className="text-xs text-muted-foreground/60">&mdash;</span>
          )}
        </Link>
      </TableCell>
    </TableRow>
  );
}
