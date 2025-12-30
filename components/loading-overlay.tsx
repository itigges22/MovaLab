'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Image from 'next/image';

interface LoadingContextType {
  isLoading: boolean;
  progress: number;
  startLoading: () => void;
  stopLoading: () => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export function useLoading() {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
}

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const startLoading = useCallback(() => {
    setIsLoading(true);
    setProgress(0);
  }, []);

  const stopLoading = useCallback(() => {
    setProgress(100);
    setTimeout(() => {
      setIsLoading(false);
      setProgress(0);
    }, 300);
  }, []);

  // Simulate progress when loading
  useEffect(() => {
    if (!isLoading) return;

    const intervals = [
      { delay: 50, target: 15 },
      { delay: 100, target: 30 },
      { delay: 200, target: 50 },
      { delay: 400, target: 70 },
      { delay: 800, target: 85 },
      { delay: 1500, target: 95 },
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

  // Track route changes
  useEffect(() => {
    stopLoading();
  }, [pathname, searchParams, stopLoading]);

  // Intercept navigation
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

  return (
    <LoadingContext.Provider value={{ isLoading, progress, startLoading, stopLoading }}>
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
