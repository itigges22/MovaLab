'use client';

import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, CheckCircle2, Target } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import useSWR from 'swr';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { cn } from '@/lib/utils';
import { SimpleCounter } from '@/components/ui/animated-counter';
import { fadeInUp, staggerContainer, listItemFadeUp } from '@/lib/animation-variants';

interface WeeklyData {
  weekStart: string;
  weekLabel: string;
  completed: number;
  created: number;
}

interface TaskTrendResponse {
  success: boolean;
  data: {
    weeks: WeeklyData[];
    totalCompleted: number;
    totalCreated: number;
    completionRate: number;
  };
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-background border rounded-lg shadow-lg p-3 min-w-[120px]"
      >
        <p className="font-medium text-sm mb-2">{label}</p>
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-muted-foreground">{entry.name}</span>
              </div>
              <span className="font-medium tabular-nums">{entry.value}</span>
            </div>
          ))}
        </div>
      </motion.div>
    );
  }
  return null;
};

export function TaskCompletionTrendWidget() {
  const { data, error, isLoading } = useSWR<TaskTrendResponse>(
    '/api/dashboard/task-completion-trend',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
          <Skeleton className="h-36 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Task Completion Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Failed to load data</p>
        </CardContent>
      </Card>
    );
  }

  const weeks = data?.data?.weeks || [];
  const totalCompleted = data?.data?.totalCompleted || 0;
  const completionRate = data?.data?.completionRate || 0;

  // Calculate trend (comparing last week to previous week)
  const lastWeek = weeks[weeks.length - 1];
  const prevWeek = weeks[weeks.length - 2];
  const completedTrend = lastWeek && prevWeek ? lastWeek.completed - prevWeek.completed : 0;

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
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Task Completion Trend
            </div>
            <span className="text-xs font-normal text-muted-foreground">
              Last 4 Weeks
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          {weeks.every(w => w.completed === 0 && w.created === 0) ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No task activity in the past 4 weeks
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary Stats */}
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-2 gap-3"
              >
                <motion.div
                  variants={listItemFadeUp}
                  className="bg-gradient-to-br from-[#4A5D3A]/10 to-[#4A5D3A]/5 dark:from-[#4A5D3A]/20 dark:to-[#4A5D3A]/10 rounded-lg p-3"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#4A5D3A]" />
                    <span className="text-xs text-muted-foreground">Completed</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-[#4A5D3A] dark:text-[#6B8B5A] tabular-nums">
                      <SimpleCounter value={totalCompleted} duration={1.2} />
                    </span>
                    {completedTrend !== 0 && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.8 }}
                        className={cn(
                          'flex items-center text-xs font-medium',
                          completedTrend > 0 ? 'text-[#4A5D3A]' : 'text-[#647878]'
                        )}
                      >
                        {completedTrend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {completedTrend > 0 ? '+' : ''}{completedTrend}
                      </motion.span>
                    )}
                  </div>
                </motion.div>

                <motion.div
                  variants={listItemFadeUp}
                  className="bg-gradient-to-br from-[#007EE5]/10 to-[#007EE5]/5 dark:from-[#007EE5]/20 dark:to-[#007EE5]/10 rounded-lg p-3"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <Target className="h-3.5 w-3.5 text-[#007EE5]" />
                    <span className="text-xs text-muted-foreground">Completion Rate</span>
                  </div>
                  <span className="text-2xl font-bold text-[#007EE5] tabular-nums">
                    <SimpleCounter value={completionRate} duration={1.2} suffix="%" />
                  </span>
                </motion.div>
              </motion.div>

              {/* Line Chart */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="h-36"
                style={{ minHeight: 144, minWidth: 0 }}
              >
                <ResponsiveContainer width="100%" height={144} minWidth={0}>
                  <AreaChart data={weeks} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <defs>
                      <linearGradient id="gradientCompleted" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4A5D3A" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#4A5D3A" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="gradientCreated" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#007EE5" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#007EE5" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" vertical={false} />
                    <XAxis
                      dataKey="weekLabel"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="completed"
                      name="Completed"
                      stroke="#4A5D3A"
                      strokeWidth={2}
                      fill="url(#gradientCompleted)"
                      dot={false}
                      activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                      animationDuration={1500}
                      animationEasing="ease-out"
                    />
                    <Area
                      type="monotone"
                      dataKey="created"
                      name="Created"
                      stroke="#007EE5"
                      strokeWidth={2}
                      fill="url(#gradientCreated)"
                      dot={false}
                      activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                      animationDuration={1500}
                      animationEasing="ease-out"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </motion.div>

              {/* Legend */}
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="flex justify-center gap-4 text-xs"
              >
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#4A5D3A]" />
                  <span className="text-muted-foreground">Completed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#007EE5]" />
                  <span className="text-muted-foreground">Created</span>
                </div>
              </motion.div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default TaskCompletionTrendWidget;
