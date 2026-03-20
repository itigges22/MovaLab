'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { SUPERADMIN_TUTORIAL } from '@/lib/onboarding/tutorial-steps';
import { TutorialOverlay } from '@/components/onboarding/tutorial-overlay';

interface TutorialProviderProps {
  children: React.ReactNode;
}

/**
 * Wraps the app and shows the tutorial overlay when the authenticated user
 * has not yet completed onboarding (has_completed_onboarding === false).
 *
 * Reads tutorial state from the API, manages step progression, and navigates
 * the user to the correct page for each step.
 */
export function TutorialProvider({ children }: TutorialProviderProps) {
  const { userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [tutorialActive, setTutorialActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [actionCompleted, setActionCompleted] = useState(false);
  const [progressLoading, setProgressLoading] = useState(false);
  const [initialFetchDone, setInitialFetchDone] = useState(false);

  // Prevent double navigation
  const navigatingRef = useRef(false);

  // Track polling interval
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Determine if the user needs the tutorial
  const needsTutorial = !!(
    userProfile &&
    'has_completed_onboarding' in userProfile &&
    (userProfile as Record<string, unknown>).has_completed_onboarding === false &&
    'is_superadmin' in userProfile &&
    (userProfile as Record<string, unknown>).is_superadmin === true
  );

  // Fetch tutorial progress on mount when user needs tutorial
  useEffect(() => {
    if (authLoading || !needsTutorial || initialFetchDone) return;

    async function fetchProgress() {
      try {
        const res = await fetch('/api/onboarding/tutorial-progress', {
          credentials: 'include',
        });
        if (!res.ok) return;

        const data = await res.json();

        if (data.completed) {
          setTutorialActive(false);
        } else {
          setCurrentStep(data.step ?? 0);
          setTutorialActive(true);
        }
      } catch {
        // Silently fail — don't block the app
      } finally {
        setInitialFetchDone(true);
      }
    }

    fetchProgress();
  }, [authLoading, needsTutorial, initialFetchDone]);

  // Navigate to the current step's target page when tutorial is active
  useEffect(() => {
    if (!tutorialActive || navigatingRef.current) return;

    const step = SUPERADMIN_TUTORIAL[currentStep];
    if (!step) return;

    // Only navigate if we're not already on the target page
    if (pathname !== step.targetPage) {
      navigatingRef.current = true;
      router.push(step.targetPage);
      // Reset after a short delay to allow navigation to complete
      setTimeout(() => {
        navigatingRef.current = false;
      }, 1000);
    }
  }, [tutorialActive, currentStep, pathname, router]);

  // Poll to check if the required action was completed
  // (e.g., user created a department via the normal UI)
  useEffect(() => {
    if (!tutorialActive) return;

    const step = SUPERADMIN_TUTORIAL[currentStep];
    if (!step?.requiredAction) {
      setActionCompleted(true);
      return;
    }

    // Reset action completed when step changes
    setActionCompleted(false);

    async function checkAction() {
      try {
        const res = await fetch(
          `/api/onboarding/tutorial-progress/check-action?action=${step.requiredAction}`,
          { credentials: 'include' },
        );
        // If the endpoint doesn't exist, fall back to trying to advance
        if (!res.ok) {
          // Try advancing to see if the server accepts it
          const advanceRes = await fetch('/api/onboarding/tutorial-progress', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ step: currentStep + 1 }),
          });
          if (advanceRes.ok) {
            setActionCompleted(true);
          }
          return;
        }
        const data = await res.json();
        if (data.completed) {
          setActionCompleted(true);
        }
      } catch {
        // Ignore errors from polling
      }
    }

    // Check immediately and then poll every 3 seconds
    checkAction();
    pollingRef.current = setInterval(checkAction, 3000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [tutorialActive, currentStep]);

  const advanceStep = useCallback(
    async (nextStep: number, complete = false) => {
      setProgressLoading(true);
      try {
        const res = await fetch('/api/onboarding/tutorial-progress', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ step: nextStep, completed: complete }),
        });

        if (!res.ok) {
          const data = await res.json();
          console.error('Tutorial advance failed:', data.error);
          return;
        }

        if (complete) {
          setTutorialActive(false);
          // Clean up any highlights
          document.querySelectorAll('.tutorial-highlight').forEach((el) => {
            el.classList.remove('tutorial-highlight');
          });
          router.push('/dashboard');
        } else {
          setCurrentStep(nextStep);
          setActionCompleted(false);
        }
      } catch (err) {
        console.error('Tutorial advance error:', err);
      } finally {
        setProgressLoading(false);
      }
    },
    [router],
  );

  const handleNext = useCallback(() => {
    const nextStep = currentStep + 1;
    if (nextStep >= SUPERADMIN_TUTORIAL.length) {
      advanceStep(currentStep, true);
    } else {
      advanceStep(nextStep);
    }
  }, [currentStep, advanceStep]);

  const handleSkip = useCallback(() => {
    // Skip advances to the next step without requiring action completion
    const nextStep = currentStep + 1;
    if (nextStep >= SUPERADMIN_TUTORIAL.length) {
      advanceStep(currentStep, true);
    } else {
      advanceStep(nextStep);
    }
  }, [currentStep, advanceStep]);

  const handleComplete = useCallback(() => {
    advanceStep(currentStep, true);
  }, [currentStep, advanceStep]);

  return (
    <>
      {children}
      {tutorialActive && (
        <TutorialOverlay
          steps={SUPERADMIN_TUTORIAL}
          currentStep={currentStep}
          onNext={handleNext}
          onSkip={handleSkip}
          onComplete={handleComplete}
          loading={progressLoading}
          actionCompleted={actionCompleted}
        />
      )}
    </>
  );
}
