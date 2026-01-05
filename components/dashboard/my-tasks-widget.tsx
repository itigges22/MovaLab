'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckSquare, AlertCircle, Clock, CheckCircle2, ExternalLink, ArrowRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { format, parseISO, isToday, isTomorrow, differenceInDays } from 'date-fns';
import { SimpleCounter } from '@/components/ui/animated-counter';
import { fadeInUp, staggerContainer, listItemFadeUp } from '@/lib/animation-variants';

interface UrgentTask {
  id: string;
  name: string;
  projectId: string;
  projectName: string;
  dueDate: string;
  status: string;
  isOverdue?: boolean;
}

interface TasksData {
  inProgress: number;
  dueThisWeek: number;
  overdue: number;
  completedThisWeek: number;
  urgent: UrgentTask[];
}

interface MyTasksWidgetProps {
  data: TasksData | null;
  isLoading: boolean;
}

function formatDueDate(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  const daysUntil = differenceInDays(date, new Date());
  if (daysUntil < 0) return `${Math.abs(daysUntil)}d overdue`;
  if (daysUntil <= 7) return `${daysUntil}d`;
  return format(date, 'MMM d');
}

function getDueDateColor(dateStr: string): string {
  const date = parseISO(dateStr);
  const daysUntil = differenceInDays(date, new Date());
  if (daysUntil < 0) return 'text-[#3D464D] bg-[#3D464D]/10 dark:bg-[#3D464D]/20';
  if (daysUntil === 0) return 'text-[#007EE5] bg-[#007EE5]/10 dark:bg-[#007EE5]/20';
  if (daysUntil <= 2) return 'text-[#647878] bg-[#647878]/10 dark:bg-[#647878]/20';
  return 'text-muted-foreground bg-muted';
}

// Stat card with animation
function StatCard({
  icon: Icon,
  iconColor,
  label,
  value,
  bgColor,
  isUrgent = false,
  delay = 0,
}: {
  icon: React.ElementType;
  iconColor: string;
  label: string;
  value: number;
  bgColor: string;
  isUrgent?: boolean;
  delay?: number;
}) {
  return (
    <motion.div
      variants={listItemFadeUp}
      className={cn('rounded-lg p-2.5 relative overflow-hidden', bgColor)}
    >
      <div className="flex items-center gap-1.5">
        <Icon className={cn('h-3.5 w-3.5', iconColor)} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className={cn(
        'text-xl font-bold mt-0.5 tabular-nums',
        isUrgent && value > 0 && 'text-[#3D464D] dark:text-[#7B8994]'
      )}>
        <SimpleCounter value={value} duration={1 + delay * 0.2} />
      </p>
      {/* Subtle pulse effect for urgent items */}
      {isUrgent && value > 0 && (
        <motion.div
          className="absolute inset-0 bg-[#3D464D]/10 rounded-lg"
          animate={{
            opacity: [0, 0.3, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}
    </motion.div>
  );
}

// Task list item with animation
function TaskItem({
  task,
  index,
}: {
  task: UrgentTask;
  index: number;
}) {
  const isOverdue = task.isOverdue ?? differenceInDays(parseISO(task.dueDate), new Date()) < 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.08 }}
    >
      <Link
        href={`/projects/${task.projectId}?tab=tasks`}
        className={cn(
          'flex items-center justify-between p-2.5 rounded-lg transition-all duration-200 group',
          isOverdue
            ? 'bg-[#3D464D]/5 dark:bg-[#3D464D]/10 hover:bg-[#3D464D]/10 dark:hover:bg-[#3D464D]/20 border border-[#3D464D]/20 dark:border-[#3D464D]/30'
            : 'hover:bg-muted/50 border border-transparent hover:border-muted'
        )}
      >
        <div className="min-w-0 flex-1">
          <p className={cn(
            'text-sm font-medium truncate transition-colors',
            isOverdue ? 'text-[#3D464D] dark:text-[#7B8994]' : 'group-hover:text-primary'
          )}>
            {task.name}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {task.projectName}
          </p>
        </div>
        <div className="flex items-center gap-2 ml-2">
          <motion.span
            className={cn('text-xs font-medium px-2 py-0.5 rounded', getDueDateColor(task.dueDate))}
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2 + index * 0.05 }}
          >
            {formatDueDate(task.dueDate)}
          </motion.span>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </Link>
    </motion.div>
  );
}

export function MyTasksWidget({ data, isLoading }: MyTasksWidgetProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Use default values when data is null (show widget with zeros)
  const displayData = data || {
    inProgress: 0,
    dueThisWeek: 0,
    overdue: 0,
    completedThisWeek: 0,
    urgent: [],
  };

  const hasNoTasks = displayData.inProgress === 0 && displayData.dueThisWeek === 0 &&
                     displayData.overdue === 0 && displayData.completedThisWeek === 0;

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
              <CheckSquare className="h-4 w-4 text-muted-foreground" />
              My Tasks
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
        <CardContent className="space-y-3 flex-1 flex flex-col">
          {hasNoTasks ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-6 text-sm text-muted-foreground"
            >
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              No tasks assigned
            </motion.div>
          ) : (
            <>
              {/* Stats Grid */}
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-2 gap-2"
              >
                <StatCard
                  icon={Clock}
                  iconColor="text-[#007EE5]"
                  label="In Progress"
                  value={displayData.inProgress}
                  bgColor="bg-[#007EE5]/10 dark:bg-[#007EE5]/20"
                  delay={0}
                />
                <StatCard
                  icon={AlertCircle}
                  iconColor={displayData.overdue > 0 ? 'text-[#475250]' : 'text-muted-foreground'}
                  label="Overdue"
                  value={displayData.overdue}
                  bgColor={displayData.overdue > 0 ? 'bg-[#3D464D]/10 dark:bg-[#3D464D]/20' : 'bg-muted/50'}
                  isUrgent={true}
                  delay={1}
                />
                <StatCard
                  icon={AlertCircle}
                  iconColor="text-[#647878]"
                  label="Due This Week"
                  value={displayData.dueThisWeek}
                  bgColor="bg-[#647878]/10 dark:bg-[#647878]/20"
                  delay={2}
                />
                <StatCard
                  icon={CheckCircle2}
                  iconColor="text-[#4A5D3A]"
                  label="Completed"
                  value={displayData.completedThisWeek}
                  bgColor="bg-[#4A5D3A]/10 dark:bg-[#4A5D3A]/20"
                  delay={3}
                />
              </motion.div>

              {/* Priority Tasks - Show overdue first, then upcoming */}
              <AnimatePresence mode="wait">
                {displayData.urgent.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: 0.3 }}
                    className="pt-2 border-t"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-muted-foreground">
                        {displayData.overdue > 0 ? 'Priority Tasks' : 'Upcoming Deadlines'}
                      </p>
                      {displayData.urgent.length > 5 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{displayData.urgent.length - 5} more
                        </span>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {displayData.urgent.slice(0, 5).map((task, index) => (
                        <TaskItem key={task.id} task={task} index={index} />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Show message if there are overdue tasks but none in the list */}
              <AnimatePresence>
                {displayData.overdue > 0 && displayData.urgent.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="pt-2 border-t"
                  >
                    <motion.div
                      className="bg-[#3D464D]/5 dark:bg-[#3D464D]/10 border border-[#3D464D]/20 dark:border-[#3D464D]/30 rounded-lg p-3"
                      animate={{
                        boxShadow: [
                          '0 0 0 0 rgba(61, 70, 77, 0)',
                          '0 0 0 4px rgba(61, 70, 77, 0.1)',
                          '0 0 0 0 rgba(61, 70, 77, 0)',
                        ],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                    >
                      <p className="text-sm text-[#3D464D] dark:text-[#7B8994]">
                        You have <span className="font-bold">{displayData.overdue}</span> overdue task{displayData.overdue > 1 ? 's' : ''}.
                        <Link href="/projects" className="underline ml-1 font-medium hover:text-foreground transition-colors">
                          View all projects
                        </Link>
                      </p>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default MyTasksWidget;
