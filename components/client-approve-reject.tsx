'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClientApproveRejectProps {
  projectId: string;
  workflowInstanceId: string;
  currentStepName: string;
  onAction: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ClientApproveReject({
  projectId,
  workflowInstanceId,
  currentStepName,
  onAction,
}: ClientApproveRejectProps) {
  const [notes, setNotes] = useState('');
  const [approveLoading, setApproveLoading] = useState(false);
  const [rejectLoading, setRejectLoading] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);

  const isLoading = approveLoading || rejectLoading;

  // -----------------------------------------------------------------------
  // Approve handler
  // -----------------------------------------------------------------------
  async function handleApprove() {
    setApproveLoading(true);
    try {
      const res = await fetch(`/api/client/portal/projects/${projectId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow_instance_id: workflowInstanceId,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to approve project');
      }

      toast.success('Project approved', {
        description: data.message || 'The project has been approved and the workflow has advanced.',
      });
      setApproveDialogOpen(false);
      setNotes('');
      onAction();
    } catch (err: unknown) {
      toast.error('Approval failed', {
        description: err instanceof Error ? err.message : 'An unexpected error occurred.',
      });
    } finally {
      setApproveLoading(false);
    }
  }

  // -----------------------------------------------------------------------
  // Reject handler
  // -----------------------------------------------------------------------
  async function handleReject() {
    if (!notes.trim()) {
      toast.error('Reason required', {
        description: 'Please provide a reason for rejecting the project.',
      });
      return;
    }

    setRejectLoading(true);
    try {
      const res = await fetch(`/api/client/portal/projects/${projectId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow_instance_id: workflowInstanceId,
          notes: notes.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to reject project');
      }

      toast.success('Feedback submitted', {
        description: data.message || 'Your concerns have been logged and the team will address them.',
      });
      setRejectDialogOpen(false);
      setNotes('');
      onAction();
    } catch (err: unknown) {
      toast.error('Rejection failed', {
        description: err instanceof Error ? err.message : 'An unexpected error occurred.',
      });
    } finally {
      setRejectLoading(false);
    }
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-amber-500/15 p-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          </div>
          <div>
            <CardTitle className="text-base">This project is awaiting your approval</CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">
              Current step: <span className="font-medium text-amber-400">{currentStepName}</span>
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Notes textarea */}
        <div>
          <label htmlFor="approval-notes" className="text-sm font-medium text-muted-foreground block mb-1.5">
            Notes / Feedback (optional for approval, required for rejection)
          </label>
          <Textarea
            id="approval-notes"
            placeholder="Add your comments or feedback here..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isLoading}
            className="min-h-[80px] resize-y"
            maxLength={2000}
          />
          {notes.length > 0 && (
            <p className="text-[11px] text-muted-foreground/60 mt-1 text-right">
              {notes.length}/2000
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3">
          {/* Approve with confirmation dialog */}
          <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
            <DialogTrigger asChild>
              <Button
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={isLoading}
              >
                <CheckCircle2 className="h-4 w-4" />
                Approve
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Approve this project?</DialogTitle>
                <DialogDescription>
                  This will advance the workflow to the next stage. This action cannot be undone.
                  {notes.trim() && (
                    <span className="block mt-2 text-foreground/80">
                      Your notes: &ldquo;{notes.trim()}&rdquo;
                    </span>
                  )}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setApproveDialogOpen(false)}
                  disabled={approveLoading}
                >
                  Cancel
                </Button>
                <Button
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleApprove}
                  disabled={approveLoading}
                >
                  {approveLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Confirm Approval
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Reject with confirmation dialog */}
          <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="gap-2 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                disabled={isLoading}
              >
                <XCircle className="h-4 w-4" />
                Reject
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reject this project?</DialogTitle>
                <DialogDescription>
                  {notes.trim() ? (
                    <>
                      Your feedback will be logged and the team will be notified to address your concerns.
                      <span className="block mt-2 text-foreground/80">
                        Your reason: &ldquo;{notes.trim()}&rdquo;
                      </span>
                    </>
                  ) : (
                    <span className="text-red-400">
                      Please provide a reason for rejection in the notes field above before rejecting.
                    </span>
                  )}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setRejectDialogOpen(false)}
                  disabled={rejectLoading}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="gap-2"
                  onClick={handleReject}
                  disabled={rejectLoading || !notes.trim()}
                >
                  {rejectLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  Confirm Rejection
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}
