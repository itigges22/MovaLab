'use client';

import { ClockWidgetStateProvider } from '@/lib/hooks/use-clock-widget-state';
import { AppLayout } from '@/components/app-layout';
import { ClockWidgetManager } from '@/components/clock-widget-manager';

interface AppWithClockProviderProps {
  children: React.ReactNode;
}

/**
 * Wrapper component that provides the clock widget state context
 * to both the sidebar (in AppLayout) and the floating widget (ClockWidgetManager)
 */
export function AppWithClockProvider({ children }: AppWithClockProviderProps) {
  return (
    <ClockWidgetStateProvider>
      <AppLayout>
        {children}
      </AppLayout>
      <ClockWidgetManager />
    </ClockWidgetStateProvider>
  );
}
