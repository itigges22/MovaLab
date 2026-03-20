'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  LayoutDashboard,
  Building2,
  Shield,
  UserPlus,
  Users,
  FolderOpen,
  CheckCircle,
  ChevronRight,
  SkipForward,
  Minimize2,
  Maximize2,
  Loader2,
  PartyPopper,
} from 'lucide-react';
import type { TutorialStep } from '@/lib/onboarding/tutorial-steps';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Building2,
  Shield,
  UserPlus,
  Users,
  FolderOpen,
  CheckCircle,
};

interface TutorialOverlayProps {
  steps: TutorialStep[];
  currentStep: number;
  onNext: () => void;
  onSkip: () => void;
  onComplete: () => void;
  loading?: boolean;
  actionCompleted?: boolean;
}

export function TutorialOverlay({
  steps,
  currentStep,
  onNext,
  onSkip,
  onComplete,
  loading = false,
  actionCompleted = false,
}: TutorialOverlayProps) {
  const [minimized, setMinimized] = useState(false);

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const progressPercent = ((currentStep) / (steps.length - 1)) * 100;

  const StepIcon = step ? ICON_MAP[step.icon] || CheckCircle : CheckCircle;

  // Highlight the target element when the step has a targetSelector
  const highlightTarget = useCallback(() => {
    // Remove all existing tutorial highlights
    document.querySelectorAll('.tutorial-highlight').forEach((el) => {
      el.classList.remove('tutorial-highlight');
    });

    if (!step?.targetSelector || minimized) return;

    // Small delay to let the page render after navigation
    const timer = setTimeout(() => {
      const target = document.querySelector(step.targetSelector!);
      if (target) {
        target.classList.add('tutorial-highlight');
        // Scroll the target into view if needed
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [step, minimized]);

  useEffect(() => {
    const cleanup = highlightTarget();
    return () => {
      cleanup?.();
      // Clean up highlights on unmount
      document.querySelectorAll('.tutorial-highlight').forEach((el) => {
        el.classList.remove('tutorial-highlight');
      });
    };
  }, [highlightTarget]);

  if (!step) return null;

  // Determine if the Next button should be disabled
  const nextDisabled = loading || (step.isRequired && !!step.requiredAction && !actionCompleted);

  if (minimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-2">
        <Button
          onClick={() => setMinimized(false)}
          className="flex items-center gap-2 rounded-full px-4 py-2 shadow-lg bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <StepIcon className="h-4 w-4" />
          <span className="text-sm font-medium">
            Tutorial ({currentStep + 1}/{steps.length})
          </span>
          <Maximize2 className="h-3 w-3 ml-1" />
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* Global CSS for tutorial highlight effect */}
      <style jsx global>{`
        .tutorial-highlight {
          position: relative;
          z-index: 40;
          animation: tutorial-pulse 2s ease-in-out infinite;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.5);
          border-radius: 8px;
        }
        @keyframes tutorial-pulse {
          0%, 100% {
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.5);
          }
          50% {
            box-shadow: 0 0 0 8px rgba(59, 130, 246, 0.2);
          }
        }
      `}</style>

      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4 animate-in slide-in-from-bottom-4">
        <Card className="shadow-2xl border-2 border-primary/20 bg-background/95 backdrop-blur-sm">
          <CardContent className="p-4 space-y-3">
            {/* Header row: icon, title, step indicator, minimize */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <StepIcon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm leading-tight truncate">
                      {step.title}
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Step {currentStep + 1} of {steps.length}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 flex-shrink-0"
                onClick={() => setMinimized(true)}
                title="Minimize tutorial"
              >
                <Minimize2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Progress bar */}
            <Progress value={progressPercent} className="h-1.5" />

            {/* Description */}
            <p className="text-sm text-muted-foreground leading-relaxed">
              {step.description}
            </p>

            {/* Required action hint */}
            {step.isRequired && step.requiredAction && !actionCompleted && (
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                Complete the action above to continue
              </p>
            )}

            {/* Buttons */}
            <div className="flex items-center justify-between pt-1">
              <div>
                {!step.isRequired && !isLastStep && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onSkip}
                    disabled={loading}
                    className="text-muted-foreground"
                  >
                    <SkipForward className="h-3.5 w-3.5 mr-1.5" />
                    Skip
                  </Button>
                )}
              </div>

              <div>
                {isLastStep ? (
                  <Button size="sm" onClick={onComplete} disabled={loading}>
                    {loading ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <PartyPopper className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Finish Tutorial
                  </Button>
                ) : (
                  <Button size="sm" onClick={onNext} disabled={nextDisabled}>
                    {loading ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <>
                        Next Step
                        <ChevronRight className="h-3.5 w-3.5 ml-1" />
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
