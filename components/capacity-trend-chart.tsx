'use client';

import { motion } from 'framer-motion';
import {
  useCapacityHistory,
  useOrganizationCapacity,
  useDepartmentCapacity,
  useAccountCapacity
} from '@/lib/hooks/use-data';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Calendar, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SimpleCounter } from '@/components/ui/animated-counter';
import { fadeInUp, staggerContainer, listItemFadeUp } from '@/lib/animation-variants';

export type TimePeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly';

interface CapacityDataPoint {
  label: string;
  available: number;
  allocated: number;
  actual: number;
  utilization: number;
}

interface CapacityTrendChartProps {
  userId: string;
  timePeriod: TimePeriod;
  onPeriodChange: (period: TimePeriod) => void;
  onOpenAvailability?: () => void;
  mode?: 'user' | 'organization' | 'department' | 'account';
  departmentId?: string;
  accountId?: string;
}

export default function CapacityTrendChart({
  userId,
  timePeriod,
  onPeriodChange,
  onOpenAvailability,
  mode = 'user',
  departmentId,
  accountId,
}: CapacityTrendChartProps) {
  // Use optimized SWR hooks based on mode - automatic caching & deduplication
  const userCapacity = useCapacityHistory(mode === 'user' ? userId : undefined, timePeriod);
  const orgCapacity = useOrganizationCapacity(timePeriod, mode === 'organization');
  const deptCapacity = useDepartmentCapacity(mode === 'department' ? departmentId : undefined, timePeriod);
  const acctCapacity = useAccountCapacity(mode === 'account' ? accountId : undefined, timePeriod);

  // Select the appropriate data based on mode
  const { data: rawData, error, isLoading } =
    mode === 'organization' ? orgCapacity :
    mode === 'department' ? deptCapacity :
    mode === 'account' ? acctCapacity :
    userCapacity;

  // Sanitize data to ensure all numeric values are valid numbers (not null/undefined/NaN)
  const data: CapacityDataPoint[] = (rawData || []).map((point: any) => ({
    label: point.label || '',
    available: typeof point.available === 'number' && !isNaN(point.available) ? point.available : 0,
    allocated: typeof point.allocated === 'number' && !isNaN(point.allocated) ? point.allocated : 0,
    actual: typeof point.actual === 'number' && !isNaN(point.actual) ? point.actual : 0,
    utilization: typeof point.utilization === 'number' && !isNaN(point.utilization) ? point.utilization : 0,
  }));

  const loading = isLoading;

  // Calculate summary stats from data
  const latestData = data.length > 0 ? data[data.length - 1] : null;
  const previousData = data.length > 1 ? data[data.length - 2] : null;
  const currentUtilization = latestData?.utilization || 0;
  const previousUtilization = previousData?.utilization || 0;
  const utilizationTrend = currentUtilization - previousUtilization;

  // Calculate totals
  const totalAvailable = data.reduce((sum, d) => sum + (d.available || 0), 0);
  const totalActual = data.reduce((sum, d) => sum + (d.actual || 0), 0);
  const totalAllocated = data.reduce((sum, d) => sum + (d.allocated || 0), 0);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="h-9 w-64" />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex gap-6">
            <Skeleton className="h-16 w-32" />
            <Skeleton className="h-16 w-32" />
            <Skeleton className="h-16 w-32" />
          </div>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Capacity Trend</CardTitle>
          <CardDescription className="text-red-500">
            {error?.message || 'Failed to load capacity data'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            Unable to load capacity data
          </div>
        </CardContent>
      </Card>
    );
  }

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-background border rounded-lg shadow-lg p-3 min-w-[160px]"
        >
          <p className="font-medium text-sm mb-2">{label}</p>
          <div className="space-y-1">
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-muted-foreground">{entry.name}</span>
                </div>
                <span className="font-medium tabular-nums">
                  {entry.name === 'Utilization' ? `${entry.value}%` : `${entry.value}h`}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      );
    }
    return null;
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={fadeInUp}
    >
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-lg">Capacity Trend</CardTitle>
              <CardDescription>
                Track available, allocated, and actual hours over time
              </CardDescription>
            </div>
            <div className="flex rounded-lg border overflow-hidden">
              {(['daily', 'weekly', 'monthly', 'quarterly'] as TimePeriod[]).map((period) => (
                <motion.button
                  key={period}
                  onClick={() => { onPeriodChange(period); }}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium transition-all duration-200',
                    timePeriod === period
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background hover:bg-muted'
                  )}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {period.charAt(0).toUpperCase() + period.slice(1)}
                </motion.button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Headline Stats Row */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-2 sm:grid-cols-4 gap-4"
          >
            {/* Current Utilization - Headline */}
            <motion.div
              variants={listItemFadeUp}
              className="col-span-2 sm:col-span-1 bg-gradient-to-br from-[#007EE5]/10 to-[#007EE5]/5 dark:from-[#007EE5]/20 dark:to-[#007EE5]/10 rounded-lg p-4"
            >
              <p className="text-xs text-muted-foreground mb-1">Current Utilization</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-[#007EE5] tabular-nums">
                  <SimpleCounter value={Math.round(currentUtilization)} duration={1.5} suffix="%" />
                </span>
                {utilizationTrend !== 0 && (
                  <motion.span
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1 }}
                    className={cn(
                      'flex items-center text-xs font-medium',
                      utilizationTrend > 0 ? 'text-[#4A5D3A]' : 'text-[#647878]'
                    )}
                  >
                    {utilizationTrend > 0 ? (
                      <TrendingUp className="h-3 w-3 mr-0.5" />
                    ) : (
                      <TrendingDown className="h-3 w-3 mr-0.5" />
                    )}
                    {utilizationTrend > 0 ? '+' : ''}{utilizationTrend.toFixed(0)}%
                  </motion.span>
                )}
              </div>
            </motion.div>

            {/* Available Hours */}
            <motion.div variants={listItemFadeUp} className="bg-[#4A5D3A]/10 dark:bg-[#4A5D3A]/20 rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-1">Available</p>
              <span className="text-xl font-bold text-[#4A5D3A] dark:text-[#6B8B5A] tabular-nums">
                <SimpleCounter value={Math.round(totalAvailable)} duration={1.2} suffix="h" />
              </span>
            </motion.div>

            {/* Allocated Hours */}
            <motion.div variants={listItemFadeUp} className="bg-[#007EE5]/10 dark:bg-[#007EE5]/20 rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-1">Allocated</p>
              <span className="text-xl font-bold text-[#007EE5] tabular-nums">
                <SimpleCounter value={Math.round(totalAllocated)} duration={1.2} suffix="h" />
              </span>
            </motion.div>

            {/* Actual Hours */}
            <motion.div variants={listItemFadeUp} className="bg-[#E74C3C]/10 dark:bg-[#E74C3C]/20 rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-1">Actual</p>
              <span className="text-xl font-bold text-[#E74C3C] tabular-nums">
                <SimpleCounter value={Math.round(totalActual)} duration={1.2} suffix="h" />
              </span>
            </motion.div>
          </motion.div>

          {/* Chart */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <ResponsiveContainer width="100%" height={256}>
              <LineChart
                data={data}
                margin={{ top: 10, right: 50, left: 10, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="gradientAvailable" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4A5D3A" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#4A5D3A" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gradientActual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E74C3C" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#E74C3C" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  className="text-muted-foreground"
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) => `${value}h`}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 'auto']}
                  className="text-muted-foreground"
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) => `${value}%`}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 100]}
                  className="text-muted-foreground"
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="available"
                  stroke="#4A5D3A"
                  strokeWidth={3}
                  dot={{ fill: '#4A5D3A', r: 3 }}
                  activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                  name="Available"
                  yAxisId="left"
                  connectNulls
                  animationDuration={1500}
                  animationEasing="ease-out"
                />
                <Line
                  type="monotone"
                  dataKey="allocated"
                  stroke="#007EE5"
                  strokeWidth={2}
                  strokeDasharray="8 4"
                  dot={false}
                  activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                  name="Allocated"
                  yAxisId="left"
                  connectNulls
                  animationDuration={1500}
                  animationEasing="ease-out"
                />
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="#E74C3C"
                  strokeWidth={2.5}
                  dot={{ fill: '#E74C3C', r: 2 }}
                  activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                  name="Actual"
                  yAxisId="left"
                  connectNulls
                  animationDuration={1500}
                  animationEasing="ease-out"
                />
                <Line
                  type="monotone"
                  dataKey="utilization"
                  stroke="#787878"
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                  name="Utilization"
                  yAxisId="right"
                  strokeDasharray="3 3"
                  connectNulls
                  animationDuration={1500}
                  animationEasing="ease-out"
                />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Legend */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex items-center justify-center gap-6 text-xs flex-wrap"
          >
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-0.5 bg-[#4A5D3A] rounded-full" />
              <span className="text-muted-foreground">Available</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-0.5 bg-[#007EE5]" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #007EE5 0, #007EE5 4px, transparent 4px, transparent 6px)' }} />
              <span className="text-muted-foreground">Allocated</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-0.5 bg-[#E74C3C] rounded-full" />
              <span className="text-muted-foreground">Actual</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-0.5 bg-[#787878]" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #787878 0, #787878 2px, transparent 2px, transparent 4px)' }} />
              <span className="text-muted-foreground">Utilization %</span>
            </div>
          </motion.div>

          {onOpenAvailability && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="pt-4 border-t"
            >
              <Button
                onClick={onOpenAvailability}
                variant="outline"
                className="w-full hover:bg-muted/50 transition-colors"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Set Work Availability
              </Button>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
