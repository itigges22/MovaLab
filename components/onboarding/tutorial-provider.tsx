'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
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

// Pages where the tutorial should never render (public pages, onboarding itself)
const TUTORIAL_EXCLUDED_PATHS = ['/login', '/signup', '/onboarding', '/invite', '/auth', '/reset-password', '/forgot-password', '/setup', '/pending-approval'];

/**
 * Passive tutorial overlay provider.
 *
 * Shows a floating card at the bottom of the screen with informational tips
 * about what the user can do. Does NOT navigate or redirect the user.
 * User can click "Next" to see the next tip or "Skip Tutorial" to dismiss.
 */
export function TutorialProvider({ children }: TutorialProviderProps) {
  const { userProfile, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const [tutorialActive, setTutorialActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [progressLoading, setProgressLoading] = useState(false);
  const [initialFetchDone, setInitialFetchDone] = useState(false);

  // Determine user type.
  // has_completed_onboarding and is_superadmin are added by migration and not
  // present in the static UserWithRoles type, so we cast through `any`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profileAny = userProfile as any;

  const isSuperadminUser = !!(profileAny?.is_superadmin === true);

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
          // Navigate to the current step's page if not already there
          const targetPage = tutorialSteps[step]?.targetPage;
          if (targetPage && !pathname.startsWith(targetPage)) {
            router.push(targetPage);
          }
        }
      } catch {
        // Silently fail -- don't block the app
      } finally {
        setInitialFetchDone(true);
      }
    }

    fetchProgress();
  }, [authLoading, needsTutorial, initialFetchDone, tutorialSteps.length]);

  const markComplete = useCallback(async () => {
    setProgressLoading(true);
    try {
      const res = await fetch('/api/onboarding/tutorial-progress', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          step: currentStep,
          completed: true,
          isSuperadmin: isSuperadminUser,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        console.warn('Tutorial completion failed:', data.error);
        return;
      }

      setTutorialActive(false);
      // Clean up any highlights
      document.querySelectorAll('.tutorial-highlight').forEach((el) => {
        el.classList.remove('tutorial-highlight');
      });
    } catch (err) {
      console.warn('Tutorial completion error:', err);
    } finally {
      setProgressLoading(false);
    }
  }, [currentStep, isSuperadminUser]);

  const handleNext = useCallback(() => {
    const nextStep = currentStep + 1;
    if (nextStep >= tutorialSteps.length) {
      markComplete();
    } else {
      setCurrentStep(nextStep);
      // Navigate to the next step's target page if we're not already there
      const nextPage = tutorialSteps[nextStep]?.targetPage;
      if (nextPage && !pathname.startsWith(nextPage)) {
        router.push(nextPage);
      }
    }
  }, [currentStep, tutorialSteps, pathname, router, markComplete]);

  const handleSkip = useCallback(() => {
    markComplete();
  }, [markComplete]);

  const handleComplete = useCallback(() => {
    markComplete();
  }, [markComplete]);

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
          actionCompleted={true}
        />
      )}
    </>
  );
}
