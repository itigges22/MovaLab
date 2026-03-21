'use client';

import { useEffect, useState, useCallback } from 'react';
import { Bug, ChevronDown, ChevronUp, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/contexts/AuthContext';
import {
  initConsoleCapture,
  collectTelemetry,
  type BugReportTelemetry,
} from '@/lib/bug-report-telemetry';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

const CATEGORIES = [
  'UI/Layout',
  'Data/Loading',
  'Permissions',
  'Navigation',
  'Performance',
  'Other',
] as const;

const SEVERITIES = ['Minor', 'Major', 'Blocker'] as const;

export function BugReporter() {
  const { userProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('');
  const [severity, setSeverity] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [telemetry, setTelemetry] = useState<BugReportTelemetry | null>(null);

  // Start capturing console errors on mount
  useEffect(() => {
    const cleanup = initConsoleCapture();
    return cleanup;
  }, []);

  // Keyboard shortcut: Cmd+Shift+B / Ctrl+Shift+B
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'b') {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Collect telemetry when dialog opens
  useEffect(() => {
    if (open) {
      setTelemetry(collectTelemetry(userProfile));
    }
  }, [open, userProfile]);

  const resetForm = useCallback(() => {
    setDescription('');
    setCategory('');
    setSeverity('');
    setDebugOpen(false);
    setTelemetry(null);
  }, []);

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast.error('Please describe the bug');
      return;
    }

    setSubmitting(true);
    const currentTelemetry = telemetry || collectTelemetry(userProfile);

    try {
      const response = await fetch('/api/bug-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description.trim(),
          category: category || null,
          severity: severity || null,
          url: currentTelemetry.url,
          userAgent: currentTelemetry.userAgent,
          viewport: currentTelemetry.viewport,
          user: currentTelemetry.user,
          consoleErrors: currentTelemetry.consoleErrors,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit');
      }

      toast.success('Bug report submitted — thank you!');
      resetForm();
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to submit bug report'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Fixed bug button — bottom-left, above where clock widget sits */}
      <button
        onClick={() => setOpen(true)}
        className="fixed z-50 flex items-center justify-center w-10 h-10 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-lg transition-colors"
        style={{ bottom: '4rem', left: '1rem' }}
        title="Report a bug (Ctrl+Shift+B)"
        aria-label="Report a bug"
      >
        <Bug className="w-5 h-5" />
      </button>

      <Dialog
        open={open}
        onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (!isOpen) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bug className="w-5 h-5 text-red-500" />
              Report a Bug
            </DialogTitle>
            <DialogDescription>
              Describe what went wrong. Debug info is captured automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="bug-description">
                What happened? <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="bug-description"
                placeholder="What went wrong? What did you expect to happen?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={5000}
                rows={4}
                autoFocus
              />
              <p className="text-xs text-muted-foreground text-right">
                {description.length}/5000
              </p>
            </div>

            {/* Category & Severity row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Severity</Label>
                <Select value={severity} onValueChange={setSeverity}>
                  <SelectTrigger>
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    {SEVERITIES.map((sev) => (
                      <SelectItem key={sev} value={sev}>
                        {sev}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Debug Info (collapsible) */}
            {telemetry && (
              <Collapsible open={debugOpen} onOpenChange={setDebugOpen}>
                <CollapsibleTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  {debugOpen ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                  Debug info (auto-captured)
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 rounded-md bg-muted p-3 text-xs font-mono space-y-1 max-h-48 overflow-y-auto">
                    <div>
                      <span className="text-muted-foreground">URL:</span>{' '}
                      {telemetry.url}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Viewport:</span>{' '}
                      {telemetry.viewport.width}x{telemetry.viewport.height}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Browser:</span>{' '}
                      {telemetry.userAgent.slice(0, 100)}
                      {telemetry.userAgent.length > 100 ? '...' : ''}
                    </div>
                    <div>
                      <span className="text-muted-foreground">User:</span>{' '}
                      {telemetry.user
                        ? `${telemetry.user.name} (${telemetry.user.email})`
                        : 'Not logged in'}
                    </div>
                    {telemetry.consoleErrors.length > 0 && (
                      <div>
                        <span className="text-muted-foreground">
                          Console errors ({telemetry.consoleErrors.length}):
                        </span>
                        <ul className="mt-1 space-y-1 list-none">
                          {telemetry.consoleErrors.map((err, i) => (
                            <li
                              key={i}
                              className="text-red-400 break-all pl-2 border-l-2 border-red-400/30"
                            >
                              {err.message.slice(0, 200)}
                              {err.message.length > 200 ? '...' : ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {telemetry.consoleErrors.length === 0 && (
                      <div>
                        <span className="text-muted-foreground">
                          Console errors:
                        </span>{' '}
                        None captured
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false);
                resetForm();
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !description.trim()}
              className="gap-2"
            >
              <Send className="w-4 h-4" />
              {submitting ? 'Submitting...' : 'Submit Report'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
