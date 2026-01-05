'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface BarData {
  label: string;
  value: number;
  color?: string;
}

interface MiniBarChartProps {
  data: BarData[];
  maxValue?: number;
  height?: number;
  barWidth?: number;
  gap?: number;
  className?: string;
  showLabels?: boolean;
  showTooltip?: boolean;
  activeColor?: string;
  inactiveColor?: string;
  labelClassName?: string;
}

export function MiniBarChart({
  data,
  maxValue,
  height = 80,
  barWidth = 20,
  gap = 8,
  className,
  showLabels = true,
  showTooltip = true,
  activeColor = 'bg-foreground',
  inactiveColor = 'bg-muted-foreground/30',
  labelClassName,
}: MiniBarChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const max = maxValue || Math.max(...data.map(d => d.value), 1);
  const totalWidth = data.length * barWidth + (data.length - 1) * gap;

  return (
    <div className={cn('relative', className)} style={{ width: totalWidth }}>
      {/* Tooltip */}
      <AnimatePresence>
        {showTooltip && hoveredIndex !== null && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.15 }}
            className="absolute -top-8 left-1/2 -translate-x-1/2 bg-foreground text-background text-xs font-medium px-2 py-1 rounded-md whitespace-nowrap z-10"
            style={{
              left: hoveredIndex * (barWidth + gap) + barWidth / 2,
              transform: 'translateX(-50%)'
            }}
          >
            {data[hoveredIndex].value}%
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bars */}
      <div className="flex items-end" style={{ height, gap }}>
        {data.map((item, index) => {
          const barHeight = (item.value / max) * height;
          const isHovered = hoveredIndex === index;
          const isActive = item.value > 0;

          return (
            <motion.div
              key={index}
              className={cn(
                'rounded-full cursor-pointer transition-colors',
                isActive
                  ? isHovered ? activeColor : 'bg-muted-foreground/50'
                  : inactiveColor
              )}
              style={{ width: barWidth }}
              initial={{ height: 0 }}
              animate={{ height: Math.max(barHeight, 8) }}
              transition={{
                duration: 0.5,
                delay: index * 0.05,
                ease: [0.4, 0, 0.2, 1]
              }}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              whileHover={{ scale: 1.05 }}
            />
          );
        })}
      </div>

      {/* Labels */}
      {showLabels && (
        <div className="flex mt-2" style={{ gap }}>
          {data.map((item, index) => (
            <span
              key={index}
              className={cn(
                'text-[10px] text-center text-muted-foreground',
                hoveredIndex === index && 'text-foreground font-medium',
                labelClassName
              )}
              style={{ width: barWidth }}
            >
              {item.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Activity-style bar chart (like ChartsExample2)
interface ActivityBarChartProps {
  data: { day: string; value: number }[];
  className?: string;
  showTotal?: boolean;
  totalLabel?: string;
}

export function ActivityBarChart({
  data,
  className,
  showTotal = true,
  totalLabel = 'ACTIVITY',
}: ActivityBarChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const maxValue = Math.max(...data.map(d => d.value), 1);
  const totalValue = Math.round(data.reduce((sum, d) => sum + d.value, 0) / data.length);

  return (
    <div className={cn('relative', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-xs font-medium text-muted-foreground tracking-wide">
            {totalLabel}
          </span>
        </div>
        {showTotal && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-2xl font-bold tabular-nums"
          >
            {totalValue}
            <span className="text-base font-normal text-muted-foreground">%</span>
          </motion.span>
        )}
      </div>

      {/* Tooltip */}
      <AnimatePresence>
        {hoveredIndex !== null && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bg-foreground text-background text-xs font-medium px-2.5 py-1 rounded-md whitespace-nowrap z-10"
            style={{
              left: hoveredIndex * 28 + 14,
              top: 40,
              transform: 'translateX(-50%)'
            }}
          >
            {data[hoveredIndex].value}%
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bars */}
      <div className="flex items-end gap-2" style={{ height: 60 }}>
        {data.map((item, index) => {
          const barHeight = (item.value / maxValue) * 60;
          const isHovered = hoveredIndex === index;
          const isToday = index === Math.floor(data.length / 2); // Middle bar is "today"

          return (
            <motion.div
              key={index}
              className={cn(
                'w-5 rounded-full cursor-pointer transition-colors',
                isToday
                  ? isHovered ? 'bg-foreground' : 'bg-foreground/80'
                  : isHovered ? 'bg-muted-foreground/60' : 'bg-muted-foreground/30'
              )}
              initial={{ height: 8 }}
              animate={{ height: Math.max(barHeight, 8) }}
              transition={{
                duration: 0.5,
                delay: index * 0.05,
                ease: [0.4, 0, 0.2, 1]
              }}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              whileHover={{ scale: 1.08 }}
            />
          );
        })}
      </div>

      {/* Day labels */}
      <div className="flex gap-2 mt-2">
        {data.map((item, index) => (
          <span
            key={index}
            className={cn(
              'w-5 text-[10px] text-center',
              hoveredIndex === index ? 'text-foreground font-medium' : 'text-muted-foreground'
            )}
          >
            {item.day}
          </span>
        ))}
      </div>
    </div>
  );
}

// Horizontal bar for comparisons
interface HorizontalBarProps {
  value: number;
  max?: number;
  label?: string;
  color?: string;
  showValue?: boolean;
  className?: string;
}

export function HorizontalBar({
  value,
  max = 100,
  label,
  color = 'bg-primary',
  showValue = true,
  className,
}: HorizontalBarProps) {
  const percentage = Math.min((value / max) * 100, 100);

  return (
    <div className={cn('space-y-1', className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between text-sm">
          {label && <span className="text-muted-foreground">{label}</span>}
          {showValue && <span className="font-medium">{value}</span>}
        </div>
      )}
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', color)}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

// Sparkline-style mini chart
interface SparklineData {
  value: number;
}

interface SparklineProps {
  data: SparklineData[];
  width?: number;
  height?: number;
  color?: string;
  showDot?: boolean;
  className?: string;
}

export function Sparkline({
  data,
  width = 80,
  height = 24,
  color = '#3b82f6',
  showDot = true,
  className,
}: SparklineProps) {
  if (data.length < 2) return null;

  const max = Math.max(...data.map(d => d.value));
  const min = Math.min(...data.map(d => d.value));
  const range = max - min || 1;

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((d.value - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  const lastPoint = data[data.length - 1];
  const lastX = width;
  const lastY = height - ((lastPoint.value - min) / range) * (height - 4) - 2;

  return (
    <svg width={width} height={height} className={className}>
      <motion.polyline
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1, ease: 'easeOut' }}
      />
      {showDot && (
        <motion.circle
          cx={lastX}
          cy={lastY}
          r={3}
          fill={color}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.8, duration: 0.3 }}
        />
      )}
    </svg>
  );
}

export default MiniBarChart;
