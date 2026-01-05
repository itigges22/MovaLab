'use client';

import CountUp from 'react-countup';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface AnimatedCounterProps {
  value: number;
  previousValue?: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  showTrend?: boolean;
  trendClassName?: string;
}

export function AnimatedCounter({
  value,
  previousValue,
  duration = 1.5,
  decimals = 0,
  prefix = '',
  suffix = '',
  className,
  showTrend = false,
  trendClassName,
}: AnimatedCounterProps) {
  // Calculate trend
  const trend = previousValue !== undefined ? value - previousValue : 0;
  const trendPercentage = previousValue && previousValue !== 0
    ? ((value - previousValue) / previousValue) * 100
    : 0;

  const getTrendIcon = () => {
    if (trend > 0) return <TrendingUp className="h-3.5 w-3.5" />;
    if (trend < 0) return <TrendingDown className="h-3.5 w-3.5" />;
    return <Minus className="h-3.5 w-3.5" />;
  };

  const getTrendColor = () => {
    if (trend > 0) return 'text-green-500';
    if (trend < 0) return 'text-red-500';
    return 'text-muted-foreground';
  };

  return (
    <div className="flex items-center gap-2">
      <motion.span
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={cn('tabular-nums', className)}
      >
        <CountUp
          start={0}
          end={value}
          duration={duration}
          decimals={decimals}
          prefix={prefix}
          suffix={suffix}
          useEasing={true}
          preserveValue={true}
        />
      </motion.span>

      {showTrend && previousValue !== undefined && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: duration * 0.8 }}
          className={cn(
            'flex items-center gap-0.5 text-xs font-medium',
            getTrendColor(),
            trendClassName
          )}
        >
          {getTrendIcon()}
          <span>
            {trendPercentage > 0 ? '+' : ''}
            {trendPercentage.toFixed(1)}%
          </span>
        </motion.div>
      )}
    </div>
  );
}

// Simplified version for inline use
interface SimpleCounterProps {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export function SimpleCounter({
  value,
  duration = 1,
  decimals = 0,
  prefix = '',
  suffix = '',
  className,
}: SimpleCounterProps) {
  return (
    <span className={cn('tabular-nums', className)}>
      <CountUp
        start={0}
        end={value}
        duration={duration}
        decimals={decimals}
        prefix={prefix}
        suffix={suffix}
        useEasing={true}
        preserveValue={true}
      />
    </span>
  );
}

// Large headline counter with trend indicator
interface HeadlineCounterProps {
  value: number;
  previousValue?: number;
  label?: string;
  prefix?: string;
  suffix?: string;
  duration?: number;
  decimals?: number;
  className?: string;
}

export function HeadlineCounter({
  value,
  previousValue,
  label,
  prefix = '',
  suffix = '',
  duration = 1.5,
  decimals = 0,
  className,
}: HeadlineCounterProps) {
  const trend = previousValue !== undefined ? value - previousValue : 0;
  const trendPercentage = previousValue && previousValue !== 0
    ? ((value - previousValue) / previousValue) * 100
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn('space-y-1', className)}
    >
      {label && (
        <p className="text-sm text-muted-foreground">{label}</p>
      )}
      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-bold tabular-nums tracking-tight">
          <CountUp
            start={0}
            end={value}
            duration={duration}
            decimals={decimals}
            prefix={prefix}
            suffix={suffix}
            useEasing={true}
            preserveValue={true}
          />
        </span>

        {previousValue !== undefined && trend !== 0 && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: duration * 0.6 }}
            className={cn(
              'flex items-center gap-1 text-sm font-medium',
              trend > 0 ? 'text-green-500' : 'text-red-500'
            )}
          >
            {trend > 0 ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            <span>
              {trendPercentage > 0 ? '+' : ''}
              {trendPercentage.toFixed(1)}%
            </span>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

export default AnimatedCounter;
