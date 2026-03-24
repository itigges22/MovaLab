'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquarePlus, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClientFeedbackFormProps {
  projectId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ClientFeedbackForm({ projectId }: ClientFeedbackFormProps) {
  const [satisfactionScore, setSatisfactionScore] = useState<number | null>(null);
  const [whatWentWell, setWhatWentWell] = useState('');
  const [whatNeedsImprovement, setWhatNeedsImprovement] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!satisfactionScore && !whatWentWell.trim() && !whatNeedsImprovement.trim()) {
      toast.error('Please provide at least a satisfaction score or written feedback.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/client/portal/projects/${projectId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          satisfaction_score: satisfactionScore,
          what_went_well: whatWentWell.trim() || null,
          what_needs_improvement: whatNeedsImprovement.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit feedback');
      }

      toast.success('Thank you for your feedback!', {
        description: 'Your feedback has been recorded and will help us improve.',
      });
      setSubmitted(true);
    } catch (err: unknown) {
      toast.error('Failed to submit feedback', {
        description: err instanceof Error ? err.message : 'An unexpected error occurred.',
      });
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
          <div className="rounded-full bg-emerald-500/15 p-3 mb-3">
            <MessageSquarePlus className="h-6 w-6 text-emerald-400" />
          </div>
          <p className="text-sm font-semibold">Thank you for your feedback!</p>
          <p className="text-xs text-muted-foreground mt-1">
            Your input helps us improve our service.
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-4"
            onClick={() => {
              setSubmitted(false);
              setSatisfactionScore(null);
              setWhatWentWell('');
              setWhatNeedsImprovement('');
            }}
          >
            Submit another
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <MessageSquarePlus className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">Share Your Feedback</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          Help us improve by sharing your experience with this project.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Satisfaction score */}
          <div>
            <label className="text-sm font-medium block mb-2">
              Satisfaction Score
            </label>
            <p className="text-xs text-muted-foreground mb-3">
              Rate your experience from 1 (poor) to 10 (excellent).
            </p>
            <div className="flex items-center gap-1.5">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((score) => (
                <button
                  key={score}
                  type="button"
                  onClick={() => setSatisfactionScore(score === satisfactionScore ? null : score)}
                  disabled={loading}
                  className={cn(
                    'w-9 h-9 rounded-md text-sm font-medium transition-all border',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    satisfactionScore === score
                      ? score <= 3
                        ? 'bg-red-500/20 border-red-500/50 text-red-400'
                        : score <= 6
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                        : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                      : 'bg-muted/30 border-muted-foreground/15 text-muted-foreground hover:bg-muted/60 hover:border-muted-foreground/30',
                    loading && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {score}
                </button>
              ))}
            </div>
            {satisfactionScore && (
              <p className="text-xs text-muted-foreground mt-2">
                {satisfactionScore <= 3
                  ? 'We appreciate your honesty. Please let us know how we can improve.'
                  : satisfactionScore <= 6
                  ? 'Thanks for the feedback. We will work to do better.'
                  : satisfactionScore <= 8
                  ? 'Great to hear! Any suggestions for improvement?'
                  : 'Wonderful! We are glad you had a great experience.'}
              </p>
            )}
          </div>

          {/* What went well */}
          <div>
            <label htmlFor="went-well" className="text-sm font-medium block mb-1.5">
              What went well?
            </label>
            <Textarea
              id="went-well"
              placeholder="Tell us what you liked about this project..."
              value={whatWentWell}
              onChange={(e) => setWhatWentWell(e.target.value)}
              disabled={loading}
              className="min-h-[70px] resize-y"
              maxLength={2000}
            />
          </div>

          {/* What needs improvement */}
          <div>
            <label htmlFor="needs-improvement" className="text-sm font-medium block mb-1.5">
              What needs improvement?
            </label>
            <Textarea
              id="needs-improvement"
              placeholder="Let us know what we could do better..."
              value={whatNeedsImprovement}
              onChange={(e) => setWhatNeedsImprovement(e.target.value)}
              disabled={loading}
              className="min-h-[70px] resize-y"
              maxLength={2000}
            />
          </div>

          {/* Submit */}
          <Button type="submit" disabled={loading} className="gap-2">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Submit Feedback
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
