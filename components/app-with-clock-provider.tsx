'use client';

import { ClockWidgetStateProvider } from '@/lib/hooks/use-clock-widget-state';
import { AppLayout } from '@/components/app-layout';
import { ClockWidgetManager } from '@/components/clock-widget-manager';
import { BugReporter } from '@/components/bug-reporter';
import { TutorialProvider } from '@/components/onboarding/tutorial-provider';

interface AppWithClockProviderProps {
  children: React.ReactNode;
}

/**
 * Wrapper component that provides the clock widget state context
 * to both the sidebar (in AppLayout) and the floating widget (ClockWidgetManager).
 * Also wraps with TutorialProvider to show the onboarding tutorial overlay
 * when the authenticated user has not yet completed onboarding.
 */
export function AppWithClockProvider({ children }: AppWithClockProviderProps) {
  return (
    <ClockWidgetStateProvider>
      <AppLayout>
        <TutorialProvider>
          {children}
        </TutorialProvider>
      </AppLayout>
      <ClockWidgetManager />
      <BugReporter />
    </ClockWidgetStateProvider>
  );
}
