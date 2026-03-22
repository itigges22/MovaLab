'use client';

import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { SimpleCounter } from '@/components/ui/animated-counter';
import { fadeInUp, listItemFadeUp } from '@/lib/animation-variants';

interface TimeData {
  hoursToday: number;
  hoursThisWeek: number;
  hoursThisMonth: number;
  weeklyTarget: number;
  dailyAverage: number;
  // Optional: daily breakdown for the week
  dailyBreakdown?: { day: string; hours: number }[];
}

interface MyTimeWidgetProps {
  data: TimeData | null;
  isLoading: boolean;
}

function getProgressColor(percentage: number): string {
  if (percentage >= 100) return 'stroke-[#4A5D3A]';
  if (percentage >= 75) return 'stroke-[#007EE5]';
  if (percentage >= 50) return 'stroke-[#647878]';
  return 'stroke-[#787878]';
}

function getProgressGradient(percentage: number): string {
  if (percentage >= 100) return 'from-[#4A5D3A]/10 to-[#4A5D3A]/5 dark:from-[#4A5D3A]/20 dark:to-[#4A5D3A]/10';
  if (percentage >= 75) return 'from-[#007EE5]/10 to-[#007EE5]/5 dark:from-[#007EE5]/20 dark:to-[#007EE5]/10';
  if (percentage >= 50) return 'from-[#647878]/10 to-[#647878]/5 dark:from-[#647878]/20 dark:to-[#647878]/10';
  return 'from-gray-50 to-gray-100/50 dark:from-gray-950/30 dark:to-gray-900/20';
}

// Daily activity bars component - LARGE and prominent
function DailyActivityBars({
  data,
  maxHours = 10
}: {
  data: { day: string; hours: number }[];
  maxHours?: number;
}) {
  return (
    <div className="flex items-end justify-between gap-3 h-28">
      {data.map((item, index) => {
        const heightPercentage = Math.min((item.hours / maxHours) * 100, 100);
        // Map day labels to day-of-week: M=1, T=2, W=3, T=4, F=5, S=6, S=0
        const dayMap: Record<string, number> = { 'M': 1, 'T': 2, 'W': 3 };
        const todayDow = new Date().getDay(); // 0=Sun, 1=Mon, ...
        const isToday = index === (todayDow === 0 ? 6 : todayDow - 1);

        return (
          <div key={index} className="flex flex-col items-center gap-2 flex-1">
            <span className={cn(
              'text-xs font-semibold tabular-nums',
              isToday ? 'text-[#007EE5]' : 'text-foreground',
              item.hours > 0 ? 'opacity-100' : 'opacity-40'
            )}>
              {item.hours > 0 ? `${item.hours.toFixed(1)}` : '-'}
            </span>
            <motion.div
              className={cn(
                'w-full rounded-lg transition-colors min-h-[8px]',
                isToday
                  ? 'bg-[#007EE5]'
                  : item.hours > 0
                    ? 'bg-[#4A5D3A]'
                    : 'bg-muted'
              )}
              initial={{ height: 8 }}
              animate={{ height: Math.max(heightPercentage * 0.8, 8) }}
              transition={{
                duration: 0.6,
                delay: index * 0.08,
                ease: [0.4, 0, 0.2, 1]
              }}
            />
            <span className={cn(
              'text-xs font-medium',
              isToday ? 'text-[#007EE5]' : 'text-muted-foreground'
            )}>
              {item.day}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function MyTimeWidget({ data, isLoading }: MyTimeWidgetProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center">
            <Skeleton className="h-24 w-24 rounded-full" />
          </div>
          <Skeleton className="h-12 w-full" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Use default values when data is null (show widget with zeros)
  const displayData = data || {
    hoursToday: 0,
    hoursThisWeek: 0,
    hoursThisMonth: 0,
    weeklyTarget: 40,
    dailyAverage: 0,
    dailyBreakdown: [
      { day: 'M', hours: 0 },
      { day: 'T', hours: 0 },
      { day: 'W', hours: 0 },
      { day: 'T', hours: 0 },
      { day: 'F', hours: 0 },
      { day: 'S', hours: 0 },
      { day: 'S', hours: 0 },
    ]
  };

  // Use daily breakdown from API (real data)
  const dailyBreakdown = displayData.dailyBreakdown || [
    { day: 'M', hours: 0 },
    { day: 'T', hours: 0 },
    { day: 'W', hours: 0 },
    { day: 'T', hours: 0 },
    { day: 'F', hours: 0 },
    { day: 'S', hours: 0 },
    { day: 'S', hours: 0 },
  ];

  const weeklyProgress = displayData.weeklyTarget > 0
    ? Math.round((displayData.hoursThisWeek / displayData.weeklyTarget) * 100)
    : 0;

  const remainingHours = Math.max(0, displayData.weeklyTarget - displayData.hoursThisWeek);
  const progressColor = getProgressColor(weeklyProgress);
  const progressGradient = getProgressGradient(weeklyProgress);

  // Calculate trend (compare to daily average)
  const expectedHoursToday = displayData.dailyAverage;
  const todayTrend = displayData.hoursToday - expectedHoursToday;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={fadeInUp}
      className="h-full"
    >
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-2 flex-shrink-0">
          <CardTitle className="text-sm font-medium flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              My Time This Week
            </div>
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="text-xs font-normal text-muted-foreground"
            >
              Target: {displayData.weeklyTarget}h
            </motion.span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 flex-1 flex flex-col">
          {/* Weekly Summary Bar - replaces progress ring */}
          <motion.div
            variants={listItemFadeUp}
            initial="hidden"
            animate="visible"
            className="flex items-center justify-between bg-muted/30 rounded-lg p-3"
          >
            <div className="flex items-center gap-3">
              <div className="flex flex-col">
                <span className="text-2xl font-bold tabular-nums text-[#007EE5]">
                  <SimpleCounter value={displayData.hoursThisWeek} duration={1.5} suffix="h" />
                </span>
                <span className="text-[10px] text-muted-foreground">this week</span>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-1.5">
                <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className={cn('h-full rounded-full', progressColor.replace('stroke-', 'bg-'))}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(weeklyProgress, 100)}%` }}
                    transition={{ duration: 1.2, ease: 'easeOut' }}
                  />
                </div>
                <span className="text-xs font-medium tabular-nums">{weeklyProgress}%</span>
              </div>
              <span className="text-[10px] text-muted-foreground">{remainingHours}h left</span>
            </div>
          </motion.div>

          {/* Daily Activity Bars - EXPANDED */}
          <motion.div
            variants={listItemFadeUp}
            initial="hidden"
            animate="visible"
            className={cn(
              'bg-gradient-to-br rounded-lg p-4',
              progressGradient
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">This Week</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xs text-muted-foreground">Today:</span>
                <span className="text-sm font-bold tabular-nums">
                  <SimpleCounter value={displayData.hoursToday} duration={1} decimals={1} suffix="h" />
                </span>
                {todayTrend !== 0 && expectedHoursToday > 0 && (
                  <motion.span
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1 }}
                    className={cn(
                      'flex items-center text-[10px] font-medium',
                      todayTrend > 0 ? 'text-[#4A5D3A]' : 'text-[#647878]'
                    )}
                  >
                    {todayTrend > 0 ? (
                      <TrendingUp className="h-2.5 w-2.5" />
                    ) : (
                      <TrendingDown className="h-2.5 w-2.5" />
                    )}
                  </motion.span>
                )}
              </div>
            </div>

            {/* Daily Activity Bars - Now with more height */}
            <DailyActivityBars data={dailyBreakdown} maxHours={10} />
          </motion.div>

          {/* Bottom Stats Row - Simplified */}
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>Month: <span className="font-medium text-foreground">{displayData.hoursThisMonth}h</span></span>
            <span>Daily avg: <span className="font-medium text-foreground">{displayData.dailyAverage.toFixed(1)}h</span></span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default MyTimeWidget;
