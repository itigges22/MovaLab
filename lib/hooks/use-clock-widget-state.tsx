'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

const STORAGE_KEY = 'clockWidgetDocked';

interface ClockWidgetStateContextType {
  isDocked: boolean;
  isPopped: boolean;
  isHydrated: boolean;
  popOut: () => void;
  dock: () => void;
  toggle: () => void;
}

const ClockWidgetStateContext = createContext<ClockWidgetStateContextType | null>(null);

/**
 * Provider component for clock widget docked/popped state
 * Must wrap both the sidebar and the floating widget
 */
export function ClockWidgetStateProvider({ children }: { children: ReactNode }) {
  const [isDocked, setIsDocked] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load saved state from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      setIsDocked(saved === 'true');
    }
    setIsHydrated(true);
  }, []);

  // Save state to localStorage when it changes
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem(STORAGE_KEY, String(isDocked));
    }
  }, [isDocked, isHydrated]);

  const popOut = useCallback(() => {
    setIsDocked(false);
  }, []);

  const dock = useCallback(() => {
    setIsDocked(true);
    // Also clear the floating position when docking
    localStorage.removeItem('clockWidgetPosition');
  }, []);

  const toggle = useCallback(() => {
    setIsDocked(prev => {
      if (prev) {
        return false;
      } else {
        localStorage.removeItem('clockWidgetPosition');
        return true;
      }
    });
  }, []);

  return (
    <ClockWidgetStateContext.Provider
      value={{
        isDocked,
        isPopped: !isDocked,
        isHydrated,
        popOut,
        dock,
        toggle,
      }}
    >
      {children}
    </ClockWidgetStateContext.Provider>
  );
}

/**
 * Hook to access clock widget docked/popped state
 * Must be used within ClockWidgetStateProvider
 */
export function useClockWidgetState(): ClockWidgetStateContextType {
  const context = useContext(ClockWidgetStateContext);

  if (!context) {
    throw new Error('useClockWidgetState must be used within ClockWidgetStateProvider');
  }

  return context;
}
