'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, FolderKanban, ExternalLink, ArrowRight, Activity } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import useSWR from 'swr';
import { SimpleCounter } from '@/components/ui/animated-counter';
import { fadeInUp, staggerContainer, listItemFadeUp } from '@/lib/animation-variants';

interface AccountData {
  id: string;
  name: string;
  status: string;
  projectCount: number;
  activeProjectCount: number;
  lastActivity?: string;
}

interface AccountsResponse {
  success: boolean;
  data: {
    accounts: AccountData[];
    totalAccounts: number;
  };
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

function getStatusColor(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-[#4A5D3A]/10 text-[#4A5D3A] dark:bg-[#4A5D3A]/20 dark:text-[#6B8B5A]';
    case 'inactive':
      return 'bg-[#647878]/10 text-[#647878] dark:bg-[#647878]/20 dark:text-[#787878]';
    case 'suspended':
      return 'bg-[#3D464D]/10 text-[#3D464D] dark:bg-[#3D464D]/20 dark:text-[#7B8994]';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

function getStatusDotColor(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-[#4A5D3A]';
    case 'inactive':
      return 'bg-[#787878]';
    case 'suspended':
      return 'bg-[#475250]';
    default:
      return 'bg-[#787878]';
  }
}

// Account list item component
function AccountItem({
  account,
  index,
}: {
  account: AccountData;
  index: number;
}) {
  const isActive = account.status === 'active';

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.08 }}
    >
      <Link
        href={`/accounts/${account.id}`}
        className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 transition-all duration-200 group border border-transparent hover:border-border"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {/* Status indicator dot */}
            <motion.div
              className={cn('w-2 h-2 rounded-full shrink-0', getStatusDotColor(account.status))}
              animate={isActive ? {
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
              {account.name}
            </p>
            <motion.span
              className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded capitalize', getStatusColor(account.status))}
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1 + index * 0.05 }}
            >
              {account.status}
            </motion.span>
          </div>
          <div className="flex items-center gap-3 mt-1 ml-4">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <FolderKanban className="h-3 w-3" />
              <span className="tabular-nums">{account.projectCount}</span> project{account.projectCount !== 1 ? 's' : ''}
            </span>
            {account.activeProjectCount > 0 && (
              <motion.span
                className="text-xs text-[#007EE5] flex items-center gap-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 + index * 0.05 }}
              >
                <Activity className="h-3 w-3" />
                <span className="tabular-nums">{account.activeProjectCount}</span> active
              </motion.span>
            )}
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </Link>
    </motion.div>
  );
}

export function MyAccountsWidget() {
  const { data, error, isLoading } = useSWR<AccountsResponse>(
    '/api/dashboard/my-accounts',
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
              <Building2 className="h-4 w-4 text-muted-foreground" />
              My Accounts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Failed to load account data</p>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  const accounts = data?.data?.accounts || [];
  const totalAccounts = data?.data?.totalAccounts || 0;
  const activeAccounts = accounts.filter(a => a.status === 'active').length;

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
              <Building2 className="h-4 w-4 text-muted-foreground" />
              My Accounts
              {totalAccounts > 0 && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-xs font-normal text-muted-foreground"
                >
                  (<SimpleCounter value={totalAccounts} duration={0.8} />)
                </motion.span>
              )}
            </div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <Link
                href="/accounts"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                View All <ExternalLink className="h-3 w-3" />
              </Link>
            </motion.div>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          {accounts.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-6 text-sm text-muted-foreground"
            >
              <Building2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              No accounts assigned
            </motion.div>
          ) : (
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="space-y-2"
            >
              {/* Quick stats bar */}
              {activeAccounts > 0 && (
                <motion.div
                  variants={listItemFadeUp}
                  className="flex items-center justify-between px-3 py-2 bg-muted/30 rounded-lg mb-3"
                >
                  <span className="text-xs text-muted-foreground">Active accounts</span>
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
                      <SimpleCounter value={activeAccounts} duration={1} />
                    </span>
                  </div>
                </motion.div>
              )}

              {/* Account list */}
              <AnimatePresence mode="popLayout">
                {accounts.slice(0, 5).map((account, index) => (
                  <AccountItem key={account.id} account={account} index={index} />
                ))}
              </AnimatePresence>

              {accounts.length > 5 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  <Link
                    href="/accounts"
                    className="block text-center text-xs text-muted-foreground hover:text-foreground py-2 transition-colors"
                  >
                    +{accounts.length - 5} more accounts
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

export default MyAccountsWidget;
