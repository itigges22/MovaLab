'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart as PieChartIcon, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import useSWR from 'swr';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Sector } from 'recharts';
import { cn } from '@/lib/utils';
import { SimpleCounter } from '@/components/ui/animated-counter';
import { fadeInUp, staggerContainer, listItemFadeUp } from '@/lib/animation-variants';

interface ProjectTime {
  projectId: string;
  projectName: string;
  accountName: string;
  hours: number;
  color: string;
  [key: string]: string | number; // Allow index signature for Recharts
}

interface TimeByProjectResponse {
  success: boolean;
  data: {
    projects: ProjectTime[];
    totalHours: number;
    weekStart: string;
    weekEnd: string;
  };
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-background border rounded-lg shadow-lg p-3 min-w-[140px]"
      >
        <p className="font-medium text-sm">{data.projectName}</p>
        <p className="text-xs text-muted-foreground">{data.accountName}</p>
        <div className="flex items-center gap-1 mt-1.5">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className="text-sm font-bold">{data.hours}h</span>
        </div>
      </motion.div>
    );
  }
  return null;
};

// Custom active shape for animated pie
const renderActiveShape = (props: any) => {
  const {
    cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill
  } = props;

  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 2}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}
      />
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={innerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        opacity={0.3}
      />
    </g>
  );
};

export function TimeByProjectWidget() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const { data, error, isLoading } = useSWR<TimeByProjectResponse>(
    '/api/dashboard/time-by-project',
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
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-48 w-full rounded-full mx-auto max-w-[192px]" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <PieChartIcon className="h-4 w-4 text-muted-foreground" />
            Time by Project
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Failed to load data</p>
        </CardContent>
      </Card>
    );
  }

  const projects = data?.data?.projects || [];
  const totalHours = data?.data?.totalHours || 0;

  const onPieEnter = (_: any, index: number) => {
    setActiveIndex(index);
  };

  const onPieLeave = () => {
    setActiveIndex(null);
  };

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
              <PieChartIcon className="h-4 w-4 text-muted-foreground" />
              Time by Project
            </div>
            <span className="text-xs font-normal text-muted-foreground">
              This Week
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          {projects.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No time logged this week
            </div>
          ) : (
            <div className="space-y-4">
              {/* Pie Chart with center total */}
              <div className="relative h-48" style={{ minHeight: 192, minWidth: 0 }}>
                {/* Center total display */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5, duration: 0.4 }}
                    className="text-center"
                  >
                    <span className="text-2xl font-bold tabular-nums">
                      <SimpleCounter value={totalHours} duration={1.5} suffix="h" />
                    </span>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </motion.div>
                </div>

                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <PieChart>
                    <Pie
                      data={projects}
                      dataKey="hours"
                      nameKey="projectName"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={2}
                      // @ts-expect-error activeIndex is valid but not in types
                      activeIndex={activeIndex !== null ? activeIndex : undefined}
                      activeShape={renderActiveShape}
                      onMouseEnter={onPieEnter}
                      onMouseLeave={onPieLeave}
                      animationBegin={0}
                      animationDuration={1200}
                      animationEasing="ease-out"
                    >
                      {projects.map((project) => (
                        <Cell
                          key={project.projectId}
                          fill={project.color}
                          style={{ cursor: 'pointer' }}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legend with animated bars */}
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                className="space-y-2"
              >
                {projects.slice(0, 4).map((project, index) => {
                  const percentage = totalHours > 0 ? (project.hours / totalHours) * 100 : 0;
                  return (
                    <motion.div
                      key={project.projectId}
                      variants={listItemFadeUp}
                      className={cn(
                        'group flex items-center gap-3 p-1.5 -mx-1.5 rounded-md transition-colors',
                        activeIndex === index && 'bg-muted/50'
                      )}
                      onMouseEnter={() => setActiveIndex(index)}
                      onMouseLeave={() => setActiveIndex(null)}
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: project.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm truncate">{project.projectName}</span>
                          <span className="text-sm font-medium tabular-nums ml-2">{project.hours}h</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ backgroundColor: project.color }}
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ duration: 0.8, delay: index * 0.1, ease: 'easeOut' }}
                          />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
                {projects.length > 4 && (
                  <motion.p
                    variants={listItemFadeUp}
                    className="text-xs text-muted-foreground text-center pt-1"
                  >
                    +{projects.length - 4} more projects
                  </motion.p>
                )}
              </motion.div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default TimeByProjectWidget;
