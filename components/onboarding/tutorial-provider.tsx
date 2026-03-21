'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { SUPERADMIN_TUTORIAL, generateUserTutorial, TutorialStep } from '@/lib/onboarding/tutorial-steps';
import { TutorialOverlay } from '@/components/onboarding/tutorial-overlay';

interface TutorialProviderProps {
  children: React.ReactNode;
}

/**
 * Extract permission keys (where value is truthy) from the user profile's roles.
 * The permissions field on each role is a JSONB object like { "view_projects": true, ... }.
 */
function extractUserPermissions(userProfile: Record<string, unknown>): string[] {
  const userRoles = userProfile.user_roles as
    | Array<{ roles: { permissions?: Record<string, unknown> } }>
    | undefined;

  if (!userRoles || !Array.isArray(userRoles)) return [];

  const permissionSet = new Set<string>();

  for (const ur of userRoles) {
    const perms = ur.roles?.permissions;
    if (perms && typeof perms === 'object') {
      for (const [key, value] of Object.entries(perms)) {
        if (value === true) {
          permissionSet.add(key);
        }
      }
    }
  }

  return Array.from(permissionSet);
}

/**
 * Wraps the app and shows the tutorial overlay when the authenticated user
 * has not yet completed onboarding (has_completed_onboarding === false).
 *
 * Supports two tutorial modes:
 * - Superadmin: Shows SUPERADMIN_TUTORIAL with required action validation
 * - Regular user: Shows dynamically generated tutorial based on role permissions
 */
// Pages where the tutorial should never render (public pages, onboarding itself)
const TUTORIAL_EXCLUDED_PATHS = ['/login', '/signup', '/onboarding', '/invite', '/auth', '/reset-password', '/forgot-password', '/setup', '/pending-approval'];

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

  // Determine user type.
  // has_completed_onboarding and is_superadmin are added by migration and not
  // present in the static UserWithRoles type, so we cast through `any`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profileAny = userProfile as any;

  const isSuperadminUser = !!(profileAny?.is_superadmin === true);

  const hasCompletedOnboarding = !!(profileAny?.has_completed_onboarding === true);

  // Skip tutorial on public/onboarding pages (no auth required there)
  const isExcludedPath = TUTORIAL_EXCLUDED_PATHS.some(p => pathname.startsWith(p));

  // Determine if the user needs the tutorial (superadmin OR regular user)
  const needsTutorial = !isExcludedPath && !!(
    userProfile &&
    profileAny?.has_completed_onboarding === false
  );

  // Compute the appropriate tutorial steps based on user type
  const tutorialSteps: TutorialStep[] = useMemo(() => {
    if (!needsTutorial || !userProfile) return [];

    if (isSuperadminUser) {
      return SUPERADMIN_TUTORIAL;
    }

    // Regular user: generate tutorial from their role permissions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const permissions = extractUserPermissions(userProfile as any);
    return generateUserTutorial(permissions);
  }, [needsTutorial, userProfile, isSuperadminUser]);

  // Fetch tutorial progress on mount when user needs tutorial
  useEffect(() => {
    if (authLoading || !needsTutorial || initialFetchDone || tutorialSteps.length === 0) return;

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
          // Clamp step to valid range for this tutorial
          const step = Math.min(data.step ?? 0, tutorialSteps.length - 1);
          setCurrentStep(step);
          setTutorialActive(true);
        }
      } catch {
        // Silently fail — don't block the app
      } finally {
        setInitialFetchDone(true);
      }
    }

    fetchProgress();
  }, [authLoading, needsTutorial, initialFetchDone, tutorialSteps.length]);

  // Navigate to the current step's target page when tutorial is active
  useEffect(() => {
    if (!tutorialActive || navigatingRef.current || tutorialSteps.length === 0) return;

    const step = tutorialSteps[currentStep];
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
  }, [tutorialActive, currentStep, pathname, router, tutorialSteps]);

  // Poll to check if the required action was completed
  // (e.g., user created a department via the normal UI)
  useEffect(() => {
    if (!tutorialActive || tutorialSteps.length === 0) return;

    const step = tutorialSteps[currentStep];
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
  }, [tutorialActive, currentStep, tutorialSteps]);

  const advanceStep = useCallback(
    async (nextStep: number, complete = false) => {
      setProgressLoading(true);
      try {
        const res = await fetch('/api/onboarding/tutorial-progress', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            step: nextStep,
            completed: complete,
            isSuperadmin: isSuperadminUser,
          }),
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
    [router, isSuperadminUser],
  );

  const handleNext = useCallback(() => {
    const nextStep = currentStep + 1;
    if (nextStep >= tutorialSteps.length) {
      advanceStep(currentStep, true);
    } else {
      advanceStep(nextStep);
    }
  }, [currentStep, advanceStep, tutorialSteps.length]);

  const handleSkip = useCallback(() => {
    // Skip advances to the next step without requiring action completion
    const nextStep = currentStep + 1;
    if (nextStep >= tutorialSteps.length) {
      advanceStep(currentStep, true);
    } else {
      advanceStep(nextStep);
    }
  }, [currentStep, advanceStep, tutorialSteps.length]);

  const handleComplete = useCallback(() => {
    advanceStep(currentStep, true);
  }, [currentStep, advanceStep]);

  return (
    <>
      {children}
      {tutorialActive && tutorialSteps.length > 0 && (
        <TutorialOverlay
          steps={tutorialSteps}
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
