'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, ExternalLink, ArrowRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import useSWR from 'swr';
import Link from 'next/link';
import { SimpleCounter } from '@/components/ui/animated-counter';
import { fadeInUp, staggerContainer, listItemFadeUp } from '@/lib/animation-variants';

interface ActivityItem {
  id: string;
  type: 'task_completed' | 'task_assigned' | 'time_logged' | 'project_update' | 'task_created';
  title: string;
  description: string;
  timestamp: string;
  timeAgo: string;
  projectName?: string;
  projectId?: string;
  metadata?: Record<string, any>;
}

interface ActivityResponse {
  success: boolean;
  data: {
    activities: ActivityItem[];
    totalCount: number;
  };
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

function getActivityDotColor(type: string): string {
  switch (type) {
    case 'task_completed':
      return 'bg-[#4A5D3A]';
    case 'time_logged':
      return 'bg-[#007EE5]';
    case 'project_update':
      return 'bg-[#647878]';
    case 'task_assigned':
    case 'task_created':
      return 'bg-[#475250]';
    default:
      return 'bg-[#787878]';
  }
}

function getActivityBadgeColor(type: string): string {
  switch (type) {
    case 'task_completed':
      return 'bg-[#4A5D3A]/10 text-[#4A5D3A] dark:bg-[#4A5D3A]/20 dark:text-[#6B8B5A]';
    case 'time_logged':
      return 'bg-[#007EE5]/10 text-[#007EE5] dark:bg-[#007EE5]/20';
    case 'project_update':
      return 'bg-[#647878]/10 text-[#647878] dark:bg-[#647878]/20 dark:text-[#787878]';
    case 'task_assigned':
    case 'task_created':
      return 'bg-[#475250]/10 text-[#475250] dark:bg-[#475250]/20 dark:text-[#7B8994]';
    default:
      return 'bg-[#787878]/10 text-[#787878]';
  }
}

function getActivityLabel(type: string): string {
  switch (type) {
    case 'task_completed':
      return 'Completed';
    case 'time_logged':
      return 'Time';
    case 'project_update':
      return 'Update';
    case 'task_assigned':
      return 'Assigned';
    case 'task_created':
      return 'Created';
    default:
      return 'Activity';
  }
}

// Activity item component - styled like AccountItem
function ActivityItemComponent({
  activity,
  index,
}: {
  activity: ActivityItem;
  index: number;
}) {
  const hasLink = activity.projectId;
  const isCompleted = activity.type === 'task_completed';

  const content = (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        {/* Status indicator dot */}
        <motion.div
          className={cn('w-2 h-2 rounded-full shrink-0', getActivityDotColor(activity.type))}
          animate={isCompleted ? {
            scale: [1, 1.2, 1],
            opacity: [1, 0.7, 1],
          } : {}}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
          {activity.title}
        </p>
        <motion.span
          className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', getActivityBadgeColor(activity.type))}
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1 + index * 0.05 }}
        >
          {getActivityLabel(activity.type)}
        </motion.span>
      </div>
      <div className="flex items-center gap-3 mt-1 ml-4">
        <span className="text-xs text-muted-foreground truncate flex-1">
          {activity.description}
        </span>
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 + index * 0.05 }}
          className="text-xs text-muted-foreground shrink-0"
        >
          {activity.timeAgo}
        </motion.span>
      </div>
      {activity.projectName && (
        <div className="flex items-center gap-1 mt-1 ml-4">
          <span className="text-[10px] text-primary">
            {activity.projectName}
          </span>
        </div>
      )}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.08 }}
    >
      {hasLink ? (
        <Link
          href={`/projects/${activity.projectId}`}
          className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 transition-all duration-200 group border border-transparent hover:border-border"
        >
          {content}
          <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </Link>
      ) : (
        <div className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 transition-all duration-200 group border border-transparent">
          {content}
        </div>
      )}
    </motion.div>
  );
}

export function RecentActivityWidget() {
  const { data, error, isLoading } = useSWR<ActivityResponse>(
    '/api/dashboard/recent-activity',
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
          <Skeleton className="h-5 w-36" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <motion.div variants={fadeInUp} initial="hidden" animate="visible">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Failed to load data</p>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  const activities = data?.data?.activities || [];
  const totalCount = data?.data?.totalCount || activities.length;
  const completedCount = activities.filter(a => a.type === 'task_completed').length;

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
              <Activity className="h-4 w-4 text-muted-foreground" />
              Recent Activity
              {totalCount > 0 && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-xs font-normal text-muted-foreground"
                >
                  (<SimpleCounter value={totalCount} duration={0.8} />)
                </motion.span>
              )}
            </div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <Link
                href="/projects"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                View All <ExternalLink className="h-3 w-3" />
              </Link>
            </motion.div>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          {activities.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-6 text-sm text-muted-foreground"
            >
              <Activity className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              No recent activity
            </motion.div>
          ) : (
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="space-y-2"
            >
              {/* Quick stats bar */}
              {completedCount > 0 && (
                <motion.div
                  variants={listItemFadeUp}
                  className="flex items-center justify-between px-3 py-2 bg-muted/30 rounded-lg mb-3"
                >
                  <span className="text-xs text-muted-foreground">Tasks completed</span>
                  <div className="flex items-center gap-1.5">
                    <motion.div
                      className="w-1.5 h-1.5 rounded-full bg-[#4A5D3A]"
                      animate={{
                        scale: [1, 1.3, 1],
                        opacity: [1, 0.6, 1],
                      }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                    />
                    <span className="text-xs font-medium tabular-nums">
                      <SimpleCounter value={completedCount} duration={1} />
                    </span>
                  </div>
                </motion.div>
              )}

              {/* Activity list */}
              <AnimatePresence mode="popLayout">
                {activities.slice(0, 6).map((activity, index) => (
                  <ActivityItemComponent
                    key={activity.id}
                    activity={activity}
                    index={index}
                  />
                ))}
              </AnimatePresence>

              {activities.length > 6 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  <Link
                    href="/projects"
                    className="block text-center text-xs text-muted-foreground hover:text-foreground py-2 transition-colors"
                  >
                    +{activities.length - 6} more activities
                  </Link>
                </motion.div>
              )}
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default RecentActivityWidget;
