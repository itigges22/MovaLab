'use client';

import { Suspense } from 'react';
import { ClockWidget } from './clock-widget';
import { useClockWidgetState } from '@/lib/hooks/use-clock-widget-state';

/**
 * Manager component that handles the floating clock widget visibility
 * based on whether it's docked to the sidebar or popped out
 */
export function ClockWidgetManager() {
  const { isPopped, dock, isHydrated } = useClockWidgetState();

  // Don't render anything until hydrated to prevent flash
  if (!isHydrated) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <ClockWidget
        isVisible={isPopped}
        onDock={dock}
      />
    </Suspense>
  );
}
