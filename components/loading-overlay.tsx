'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Image from 'next/image';

interface LoadingContextType {
  isLoading: boolean;
  progress: number;
  startLoading: () => void;
  stopLoading: () => void;
  // Content-ready signaling for widgets/components
  registerPendingContent: () => void;
  markContentReady: () => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export function useLoading() {
  const context = useContext(LoadingContext);
  if (!context) {
    // Return no-op functions for SSR or when context is not available
    return {
      isLoading: false,
      progress: 0,
      startLoading: () => {},
      stopLoading: () => {},
      registerPendingContent: () => {},
      markContentReady: () => {},
    };
  }
  return context;
}

// Minimum time to show loading overlay (ms)
const MIN_LOADING_TIME = 800;
// Maximum wait time for content to be ready (ms)
const MAX_CONTENT_WAIT_TIME = 5000;

export function LoadingProvider({ children }: { children: ReactNode }) {
  // Start with loading true for initial page load
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const loadingStartTime = useRef<number>(Date.now());
  const pendingStop = useRef<boolean>(false);
  const pendingContentCount = useRef<number>(0);
  const contentReadyTimeout = useRef<NodeJS.Timeout | null>(null);
  const isTabVisible = useRef<boolean>(true);

  const startLoading = useCallback(() => {
    loadingStartTime.current = Date.now();
    pendingStop.current = false;
    pendingContentCount.current = 0;
    setIsLoading(true);
    setProgress(0);
  }, []);

  const stopLoading = useCallback(() => {
    const elapsed = Date.now() - loadingStartTime.current;
    const remainingTime = Math.max(0, MIN_LOADING_TIME - elapsed);

    // Set progress to 100 immediately
    setProgress(100);

    // Delay hiding to ensure minimum display time
    setTimeout(() => {
      if (!pendingStop.current) {
        setIsLoading(false);
        setProgress(0);
        pendingContentCount.current = 0;
      }
    }, remainingTime + 300);
  }, []);

  // Register pending content - widgets call this when they start loading
  const registerPendingContent = useCallback(() => {
    pendingContentCount.current += 1;
    // Clear any existing timeout since we have new pending content
    if (contentReadyTimeout.current) {
      clearTimeout(contentReadyTimeout.current);
      contentReadyTimeout.current = null;
    }
  }, []);

  // Mark content as ready - widgets call this when they finish loading
  const markContentReady = useCallback(() => {
    pendingContentCount.current = Math.max(0, pendingContentCount.current - 1);

    // If all content is ready, stop loading
    if (pendingContentCount.current === 0 && isLoading) {
      stopLoading();
    }
  }, [isLoading, stopLoading]);

  // Simulate progress when loading
  useEffect(() => {
    if (!isLoading) return;

    const intervals = [
      { delay: 100, target: 20 },
      { delay: 250, target: 40 },
      { delay: 400, target: 60 },
      { delay: 600, target: 75 },
      { delay: 900, target: 85 },
      { delay: 1200, target: 90 },
      { delay: 2000, target: 95 },
    ];

    const timeouts: NodeJS.Timeout[] = [];

    intervals.forEach(({ delay, target }) => {
      const timeout = setTimeout(() => {
        setProgress(prev => Math.max(prev, target));
      }, delay);
      timeouts.push(timeout);
    });

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, [isLoading]);

  // Handle initial page load
  useEffect(() => {
    if (isInitialLoad) {
      // Wait for the page to be interactive before stopping
      const handleLoad = () => {
        // Set a timeout to wait for content, but have a max wait time
        contentReadyTimeout.current = setTimeout(() => {
          // If we still have pending content after max wait, stop anyway
          if (pendingContentCount.current > 0) {
            console.warn(`Loading overlay timeout: ${pendingContentCount.current} pending content items`);
          }
          setIsInitialLoad(false);
          stopLoading();
        }, MAX_CONTENT_WAIT_TIME);

        // Also check if no pending content, stop immediately
        setTimeout(() => {
          if (pendingContentCount.current === 0) {
            if (contentReadyTimeout.current) {
              clearTimeout(contentReadyTimeout.current);
            }
            setIsInitialLoad(false);
            stopLoading();
          }
        }, MIN_LOADING_TIME);
      };

      if (document.readyState === 'complete') {
        handleLoad();
      } else {
        window.addEventListener('load', handleLoad);
        // Fallback timeout in case load event never fires
        const fallback = setTimeout(handleLoad, 3000);
        return () => {
          window.removeEventListener('load', handleLoad);
          clearTimeout(fallback);
        };
      }
    }
  }, [isInitialLoad, stopLoading]);

  // Track route changes (but not on initial load)
  useEffect(() => {
    if (!isInitialLoad) {
      // When route changes, check if we should stop loading
      // Give a small delay for any pending content to register
      setTimeout(() => {
        if (pendingContentCount.current === 0) {
          stopLoading();
        }
      }, 500);
    }
  }, [pathname, searchParams, stopLoading, isInitialLoad]);

  // Intercept navigation (anchor clicks)
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');

      if (anchor) {
        const href = anchor.getAttribute('href');
        // Only show loading for internal navigation
        if (href && href.startsWith('/') && !href.startsWith('/api')) {
          // Don't trigger for same page or hash links
          if (href !== pathname && !href.startsWith('#')) {
            startLoading();
          }
        }
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [pathname, startLoading]);

  // Handle beforeunload (page refresh/close)
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Show loading screen on page unload (refresh)
      startLoading();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [startLoading]);

  // Handle tab visibility changes (prevent reload on tab switch)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Tab became visible - if we were loading due to unload, cancel it
        isTabVisible.current = true;
        // Don't restart loading, just resume normal state
        if (pendingStop.current) {
          pendingStop.current = false;
        }
      } else {
        isTabVisible.current = false;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return (
    <LoadingContext.Provider value={{
      isLoading,
      progress,
      startLoading,
      stopLoading,
      registerPendingContent,
      markContentReady
    }}>
      {children}
      <LoadingOverlay isVisible={isLoading} progress={progress} />
    </LoadingContext.Provider>
  );
}

interface LoadingOverlayProps {
  isVisible: boolean;
  progress: number;
}

function LoadingOverlay({ isVisible, progress }: LoadingOverlayProps) {
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
    } else {
      const timeout = setTimeout(() => setShouldRender(false), 400);
      return () => clearTimeout(timeout);
    }
  }, [isVisible]);

  if (!shouldRender) return null;

  return (
    <div
      data-testid="loading-overlay"
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Logo */}
      <div className="mb-8 animate-pulse-slow">
        <Image
          src="/logo.svg"
          alt="MovaLab"
          width={180}
          height={180}
          priority
          className="object-contain"
        />
      </div>

      {/* Progress bar container */}
      <div className="w-64 space-y-3">
        {/* Progress bar */}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Percentage text */}
        <div className="text-center">
          <span className="text-sm font-medium text-gray-600 tabular-nums">
            {Math.round(progress)}%
          </span>
        </div>
      </div>

      {/* Loading text */}
      <p className="mt-4 text-sm text-gray-500 animate-pulse">
        Loading...
      </p>
    </div>
  );
}

export default LoadingOverlay;
