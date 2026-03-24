'use client';

import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkflowNode {
  id: string;
  label: string;
  node_type: string;
}

interface ClientWorkflowProgressProps {
  nodes: WorkflowNode[];
  currentNodeId: string | null;
  completedNodeIds: string[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ClientWorkflowProgress({
  nodes,
  currentNodeId,
  completedNodeIds,
}: ClientWorkflowProgressProps) {
  if (!nodes || nodes.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        No active workflow for this project.
      </div>
    );
  }

  const completedSet = new Set(completedNodeIds);

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-center gap-0 min-w-max px-2 py-4">
        {nodes.map((node, index) => {
          const isCompleted = completedSet.has(node.id);
          const isCurrent = node.id === currentNodeId;
          const isUpcoming = !isCompleted && !isCurrent;

          return (
            <div key={node.id} className="flex items-center">
              {/* Step */}
              <div className="flex flex-col items-center gap-1.5">
                {/* Icon */}
                <div
                  className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all',
                    isCompleted &&
                      'bg-emerald-500/15 border-emerald-500/50 text-emerald-400',
                    isCurrent &&
                      'bg-blue-500/15 border-blue-500/50 text-blue-400 ring-4 ring-blue-500/10',
                    isUpcoming &&
                      'bg-muted/50 border-muted-foreground/20 text-muted-foreground/50'
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : isCurrent ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Circle className="h-3.5 w-3.5" />
                  )}
                </div>

                {/* Label */}
                <span
                  className={cn(
                    'text-[11px] font-medium text-center max-w-[90px] leading-tight',
                    isCompleted && 'text-emerald-400',
                    isCurrent && 'text-blue-400',
                    isUpcoming && 'text-muted-foreground/50'
                  )}
                >
                  {node.label}
                </span>
              </div>

              {/* Connector line */}
              {index < nodes.length - 1 && (
                <div
                  className={cn(
                    'h-0.5 w-10 mx-1 mt-[-18px] rounded-full transition-all',
                    isCompleted
                      ? 'bg-emerald-500/40'
                      : isCurrent
                      ? 'bg-blue-500/30'
                      : 'bg-muted-foreground/15'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
