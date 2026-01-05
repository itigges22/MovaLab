'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Workflow, AlertCircle, Clock, CheckCircle2, ExternalLink, ArrowRight, Zap } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import useSWR from 'swr';
import { SimpleCounter } from '@/components/ui/animated-counter';
import { fadeInUp, staggerContainer, listItemFadeUp } from '@/lib/animation-variants';

interface WorkflowDetail {
  instanceId: string;
  projectId: string;
  projectName: string;
  accountName: string;
  activatedAt?: string;
  stepName?: string;
}

interface WorkflowsData {
  awaitingAction: number;
  activeWorkflows: number;
  inPipeline: number;
  completedRecently: number;
  awaitingDetails: WorkflowDetail[];
  pipelineDetails: WorkflowDetail[];
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

// Stat card component
function StatCard({
  icon: Icon,
  iconColor,
  label,
  value,
  bgColor,
  valueColor,
  showPulse = false,
  delay = 0,
}: {
  icon: React.ElementType;
  iconColor: string;
  label: string;
  value: number;
  bgColor: string;
  valueColor?: string;
  showPulse?: boolean;
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
      <p className={cn('text-xl font-bold mt-0.5 tabular-nums', valueColor)}>
        <SimpleCounter value={value} duration={1 + delay * 0.15} />
      </p>
      {/* Pulse animation for awaiting items */}
      {showPulse && value > 0 && (
        <motion.div
          className="absolute inset-0 bg-[#007EE5]/10 rounded-lg"
          animate={{
            opacity: [0, 0.4, 0],
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

// Workflow list item
function WorkflowItem({
  workflow,
  index,
  type,
}: {
  workflow: WorkflowDetail;
  index: number;
  type: 'awaiting' | 'pipeline';
}) {
  const isAwaiting = type === 'awaiting';

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.08 }}
    >
      <Link
        href={`/projects/${workflow.projectId}`}
        className={cn(
          'flex items-center justify-between p-2.5 rounded-lg transition-all duration-200 group',
          isAwaiting
            ? 'bg-[#007EE5]/5 dark:bg-[#007EE5]/10 hover:bg-[#007EE5]/10 dark:hover:bg-[#007EE5]/20 border border-[#007EE5]/20 dark:border-[#007EE5]/30'
            : 'hover:bg-muted/50 border border-transparent hover:border-muted'
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
            {workflow.projectName}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {type === 'pipeline' && workflow.stepName ? workflow.stepName : workflow.accountName}
          </p>
        </div>
        <div className="flex items-center gap-2 ml-2">
          <motion.span
            className={cn(
              'text-xs font-medium px-2 py-0.5 rounded',
              isAwaiting
                ? 'bg-[#007EE5]/10 dark:bg-[#007EE5]/20 text-[#007EE5]'
                : 'bg-[#647878]/10 dark:bg-[#647878]/20 text-[#647878]'
            )}
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2 + index * 0.05 }}
          >
            {isAwaiting ? 'Pending' : 'Pipeline'}
          </motion.span>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </Link>
    </motion.div>
  );
}

export function MyWorkflowsWidget() {
  const { data, error, isLoading } = useSWR<{ success: boolean; data: WorkflowsData }>(
    '/api/dashboard/my-workflows',
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
          <Skeleton className="h-5 w-28" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
          <Skeleton className="h-16 w-full" />
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
              <Workflow className="h-4 w-4 text-muted-foreground" />
              My Workflows
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Failed to load workflow data</p>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // Use default values when data is null (show widget with zeros)
  const workflowData = data?.data || {
    awaitingAction: 0,
    activeWorkflows: 0,
    inPipeline: 0,
    completedRecently: 0,
    awaitingDetails: [],
    pipelineDetails: [],
  };

  const hasNoWorkflows = workflowData.awaitingAction === 0 &&
                         workflowData.activeWorkflows === 0 &&
                         workflowData.inPipeline === 0 &&
                         workflowData.completedRecently === 0;

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
              <Workflow className="h-4 w-4 text-muted-foreground" />
              My Workflows
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
                View Projects <ExternalLink className="h-3 w-3" />
              </Link>
            </motion.div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 flex-1 flex flex-col">
          {hasNoWorkflows ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-6 text-sm text-muted-foreground"
            >
              <Workflow className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              No workflows assigned
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
                  icon={AlertCircle}
                  iconColor={workflowData.awaitingAction > 0 ? 'text-[#007EE5]' : 'text-muted-foreground'}
                  label="Awaiting Me"
                  value={workflowData.awaitingAction}
                  bgColor={workflowData.awaitingAction > 0 ? 'bg-[#007EE5]/10 dark:bg-[#007EE5]/20' : 'bg-muted/50'}
                  valueColor={workflowData.awaitingAction > 0 ? 'text-[#007EE5]' : undefined}
                  showPulse={true}
                  delay={0}
                />
                <StatCard
                  icon={Clock}
                  iconColor="text-[#647878]"
                  label="In Pipeline"
                  value={workflowData.inPipeline}
                  bgColor="bg-[#647878]/10 dark:bg-[#647878]/20"
                  delay={1}
                />
                <StatCard
                  icon={Zap}
                  iconColor="text-[#475250]"
                  label="Active"
                  value={workflowData.activeWorkflows}
                  bgColor="bg-[#475250]/10 dark:bg-[#475250]/20"
                  delay={2}
                />
                <StatCard
                  icon={CheckCircle2}
                  iconColor="text-[#4A5D3A]"
                  label="Completed"
                  value={workflowData.completedRecently}
                  bgColor="bg-[#4A5D3A]/10 dark:bg-[#4A5D3A]/20"
                  delay={3}
                />
              </motion.div>

              {/* Awaiting Action List */}
              <AnimatePresence mode="wait">
                {workflowData.awaitingDetails.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: 0.3 }}
                    className="pt-2 border-t"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <motion.div
                          className="w-1.5 h-1.5 rounded-full bg-[#007EE5]"
                          animate={{
                            scale: [1, 1.2, 1],
                            opacity: [1, 0.7, 1],
                          }}
                          transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            ease: 'easeInOut',
                          }}
                        />
                        <p className="text-xs text-muted-foreground">Needs Your Action</p>
                      </div>
                      {workflowData.awaitingDetails.length > 3 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{workflowData.awaitingDetails.length - 3} more
                        </span>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {workflowData.awaitingDetails.slice(0, 3).map((workflow, index) => (
                        <WorkflowItem
                          key={workflow.instanceId}
                          workflow={workflow}
                          index={index}
                          type="awaiting"
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* In Pipeline List */}
              <AnimatePresence mode="wait">
                {workflowData.awaitingDetails.length === 0 && workflowData.pipelineDetails.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: 0.3 }}
                    className="pt-2 border-t"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <motion.div
                          className="w-1.5 h-1.5 rounded-full bg-[#647878]"
                          animate={{
                            x: [0, 3, 0],
                          }}
                          transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            ease: 'easeInOut',
                          }}
                        />
                        <p className="text-xs text-muted-foreground">Coming to You</p>
                      </div>
                      {workflowData.pipelineDetails.length > 3 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{workflowData.pipelineDetails.length - 3} more
                        </span>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {workflowData.pipelineDetails.slice(0, 3).map((workflow, index) => (
                        <WorkflowItem
                          key={workflow.instanceId}
                          workflow={workflow}
                          index={index}
                          type="pipeline"
                        />
                      ))}
                    </div>
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

export default MyWorkflowsWidget;
