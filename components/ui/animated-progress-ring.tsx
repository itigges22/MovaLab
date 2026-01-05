'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { SimpleCounter } from './animated-counter';

interface AnimatedProgressRingProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  trackColor?: string;
  progressColor?: string;
  showLabel?: boolean;
  label?: string;
  suffix?: string;
  duration?: number;
}

export function AnimatedProgressRing({
  value,
  max = 100,
  size = 80,
  strokeWidth = 8,
  className,
  trackColor = 'stroke-muted',
  progressColor = 'stroke-primary',
  showLabel = true,
  label,
  suffix = '%',
  duration = 1.5,
}: AnimatedProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percentage = Math.min((value / max) * 100, 100);
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className={trackColor}
        />
        {/* Progress arc */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className={progressColor}
          initial={{ strokeDasharray: circumference, strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration, ease: 'easeOut' }}
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold tabular-nums">
            <SimpleCounter value={Math.round(percentage)} duration={duration} suffix={suffix} />
          </span>
          {label && (
            <span className="text-[10px] text-muted-foreground">{label}</span>
          )}
        </div>
      )}
    </div>
  );
}

// Mini version for inline use
interface MiniProgressRingProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  color?: string;
}

export function MiniProgressRing({
  value,
  max = 100,
  size = 32,
  strokeWidth = 4,
  className,
  color = 'stroke-primary',
}: MiniProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percentage = Math.min((value / max) * 100, 100);
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <svg width={size} height={size} className={cn('-rotate-90', className)}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        className="stroke-muted"
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        className={color}
        initial={{ strokeDasharray: circumference, strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1, ease: 'easeOut' }}
      />
    </svg>
  );
}

// Multi-segment ring for showing multiple values
interface MultiProgressRingProps {
  segments: {
    value: number;
    color: string;
    label?: string;
  }[];
  max?: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  showCenter?: boolean;
  centerLabel?: string;
  centerValue?: string;
}

export function MultiProgressRing({
  segments,
  max = 100,
  size = 100,
  strokeWidth = 10,
  className,
  showCenter = true,
  centerLabel,
  centerValue,
}: MultiProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;

  // Calculate cumulative offsets
  let cumulativeOffset = 0;

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-muted"
        />
        {/* Segments */}
        {segments.map((segment, index) => {
          const percentage = (segment.value / max) * 100;
          const dashArray = (percentage / 100) * circumference;
          const dashOffset = -(cumulativeOffset / 100) * circumference;
          cumulativeOffset += percentage;

          return (
            <motion.circle
              key={index}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              stroke={segment.color}
              initial={{
                strokeDasharray: `0 ${circumference}`,
                strokeDashoffset: 0
              }}
              animate={{
                strokeDasharray: `${dashArray} ${circumference - dashArray}`,
                strokeDashoffset: dashOffset
              }}
              transition={{
                duration: 1.5,
                delay: index * 0.2,
                ease: 'easeOut'
              }}
            />
          );
        })}
      </svg>
      {showCenter && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {centerValue && (
            <span className="text-xl font-bold tabular-nums">{centerValue}</span>
          )}
          {centerLabel && (
            <span className="text-xs text-muted-foreground">{centerLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}

export default AnimatedProgressRing;
