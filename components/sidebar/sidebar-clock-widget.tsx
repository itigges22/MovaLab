'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  Clock,
  Play,
  Square,
  ExternalLink,
  List,
  Calendar
} from 'lucide-react';
import { ClockOutDialog } from '@/components/clock-out-dialog';
import { toast } from 'sonner';
import { useAuth } from '@/lib/hooks/useAuth';
import { isUnassigned } from '@/lib/rbac';
import { useClockStatus } from '@/lib/hooks/use-data';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// Lazy load the availability calendar
const DragAvailabilityCalendar = dynamic(() => import('@/components/drag-availability-calendar'), {
  loading: () => (
    <div className="space-y-3">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  ),
  ssr: false
});

interface SidebarClockWidgetProps {
  onPopOut?: () => void;
}

export function SidebarClockWidget({ onPopOut }: SidebarClockWidgetProps) {
  const { userProfile, loading: authLoading } = useAuth();
  const isAuthenticated = !authLoading && !!userProfile;
  const { clockedIn, currentSession, isLoading, mutate } = useClockStatus(isAuthenticated);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [clockingIn, setClockingIn] = useState(false);
  const [showClockOutDialog, setShowClockOutDialog] = useState(false);
  const [showAvailabilityDialog, setShowAvailabilityDialog] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Format elapsed time as HH:MM:SS
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Format elapsed time as hours with decimals
  const formatHours = (seconds: number) => {
    const hours = seconds / 3600;
    return hours.toFixed(2);
  };

  // Calculate elapsed time when clock status loads
  useEffect(() => {
    if (currentSession && clockedIn) {
      const clockInTime = new Date(currentSession.clock_in_time);
      const elapsed = Math.floor((Date.now() - clockInTime.getTime()) / 1000);
      setElapsedTime(elapsed);
    }
  }, [currentSession, clockedIn]);

  // Update timer every second when clocked in
  useEffect(() => {
    if (!clockedIn) return;
    if (showClockOutDialog) return;

    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);

    return () => { clearInterval(interval); };
  }, [clockedIn, showClockOutDialog]);

  // Handle clock in
  const handleClockIn = async () => {
    setClockingIn(true);
    try {
      const response = await fetch('/api/clock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) {
        toast.error('Failed to clock in');
        return;
      }
      const data = await response.json();

      if (data.success) {
        mutate();
        setElapsedTime(0);
        toast.success('Clocked in successfully');
      } else {
        toast.error(data.error || 'Failed to clock in');
      }
    } catch (error: unknown) {
      toast.error('Failed to clock in');
    } finally {
      setClockingIn(false);
    }
  };

  // Handle clock out dialog close
  const handleClockOutComplete = () => {
    setShowClockOutDialog(false);
    setElapsedTime(0);
    mutate();
  };

  // Don't render if not authenticated, still loading, or user is unassigned
  if (authLoading || !userProfile || isLoading || isUnassigned(userProfile)) {
    return null;
  }

  return (
    <>
      <div className="border-t border-[var(--sidebar-border)]">
        {/* Compact view (always visible) */}
        <div
          className={cn(
            'flex items-center gap-3 px-3 py-2.5',
            'hover:bg-[var(--sidebar-hover-bg)] transition-colors',
            clockedIn && 'bg-green-50'
          )}
        >
          <div
            role="button"
            tabIndex={0}
            aria-expanded={isExpanded}
            aria-label={clockedIn ? `Time clock, clocked in for ${formatTime(elapsedTime)}` : 'Time clock, not clocked in'}
            onClick={() => setIsExpanded(!isExpanded)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setIsExpanded(!isExpanded); }}
            className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
          >
            <div className={cn(
              'flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0',
              clockedIn
                ? 'bg-green-500 text-white'
                : 'bg-[var(--sidebar-active-bg)] text-[var(--sidebar-text-muted)]'
            )}>
              <Clock className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn(
                'text-[13px] font-medium truncate',
                clockedIn ? 'text-green-700' : 'text-[var(--sidebar-text)]'
              )}>
                {clockedIn ? 'Clocked In' : 'Time Clock'}
              </p>
              {clockedIn && (
                <p className="text-[12px] font-mono font-semibold text-green-600">
                  {formatTime(elapsedTime)}
                </p>
              )}
            </div>
          </div>
          {onPopOut && (
            <button
              onClick={onPopOut}
              className="p-1 rounded hover:bg-[var(--sidebar-active-bg)] text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text)]"
              title="Pop out to floating widget"
              aria-label="Pop out to floating widget"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Expanded view */}
        {isExpanded && (
          <div className="px-3 pb-3 space-y-2">
            {clockedIn ? (
              <>
                <div className="text-center py-2">
                  <div className="text-xl font-mono font-bold text-green-600">
                    {formatTime(elapsedTime)}
                  </div>
                  <div className="text-[11px] text-[var(--sidebar-text-muted)]">
                    {formatHours(elapsedTime)} hours
                  </div>
                </div>
                <Button
                  onClick={() => setShowClockOutDialog(true)}
                  className="w-full bg-red-500 hover:bg-red-600 h-8 text-[12px]"
                  size="sm"
                >
                  <Square className="w-3.5 h-3.5 mr-1.5" />
                  Clock Out
                </Button>
              </>
            ) : (
              <>
                <p className="text-[11px] text-[var(--sidebar-text-muted)] text-center py-1">
                  Start tracking your time
                </p>
                <Button
                  onClick={handleClockIn}
                  className="w-full bg-green-500 hover:bg-green-600 h-8 text-[12px]"
                  size="sm"
                  disabled={clockingIn}
                >
                  {clockingIn ? (
                    <>
                      <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white mr-1.5" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 mr-1.5" />
                      Clock In
                    </>
                  )}
                </Button>
              </>
            )}

            {/* Quick links */}
            <div className="grid grid-cols-2 gap-1.5">
              <Link href="/time-entries">
                <Button
                  variant="outline"
                  className="w-full text-[11px] h-7"
                  size="sm"
                >
                  <List className="w-3 h-3 mr-1" />
                  Entries
                </Button>
              </Link>
              <Button
                variant="outline"
                className="w-full text-[11px] h-7"
                size="sm"
                onClick={() => setShowAvailabilityDialog(true)}
              >
                <Calendar className="w-3 h-3 mr-1" />
                Availability
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Clock Out Dialog */}
      <ClockOutDialog
        open={showClockOutDialog}
        onOpenChange={setShowClockOutDialog}
        session={currentSession}
        elapsedSeconds={elapsedTime}
        onComplete={handleClockOutComplete}
      />

      {/* Work Availability Dialog */}
      <Dialog open={showAvailabilityDialog} onOpenChange={setShowAvailabilityDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Set Work Availability</DialogTitle>
            <DialogDescription>
              Drag to mark unavailable times. Gray blocks indicate times you cannot work.
            </DialogDescription>
          </DialogHeader>
          {userProfile && (
            <Suspense fallback={<Skeleton className="h-32 w-full" />}>
              <DragAvailabilityCalendar
                userProfile={userProfile}
                onSave={() => {
                  toast.success('Availability saved');
                }}
              />
            </Suspense>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
