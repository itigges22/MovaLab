
import { notFound } from 'next/navigation';
import { getCurrentUserProfileServer } from '@/lib/auth-server';
import { accountService } from '@/lib/account-service';
import { AccountOverview } from '@/components/account-overview';
import { hasPermission } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';
import { createServerSupabase } from '@/lib/supabase-server';

interface AccountPageProps {
  params: Promise<{
    accountId: string;
  }>;
}

export default async function AccountPage({ params }: AccountPageProps) {
  const { accountId } = await params;

  // Get current user and check permissions
  const userProfile = await getCurrentUserProfileServer();
  if (!userProfile) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
          <p className="text-gray-600 mt-2">Please log in to view accounts.</p>
        </div>
      </div>
    );
  }

  // Create server-side Supabase client with auth
  const supabase = await createServerSupabase();
  if (!supabase) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Database Error</h1>
          <p className="text-gray-600 mt-2">Unable to connect to database.</p>
        </div>
      </div>
    );
  }

  // Check if user has access to this specific account using permission checks
  const hasAllAccountsPermission = await hasPermission(userProfile, Permission.VIEW_ALL_ACCOUNTS);
  const hasAccountPermission = await hasPermission(userProfile, Permission.VIEW_ACCOUNTS, { accountId });
  const hasAccountAccessViaService = await accountService.canUserAccessAccount((userProfile as any).id, accountId, supabase);
  
  const hasAccountAccess = hasAllAccountsPermission || hasAccountPermission || hasAccountAccessViaService;

  if (!hasAccountAccess) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
          <p className="text-gray-600 mt-2">You don&apos;t have permission to view this account.</p>
        </div>
      </div>
    );
  }

  // Check if user has FULL access (can edit) or READ-ONLY access (project stakeholder only)
  // Full access is granted if:
  // 1. User has MANAGE_ACCOUNTS permission for this account (consolidated from EDIT_ACCOUNT), OR
  // 2. User has VIEW_ALL_ACCOUNTS + MANAGE_ACCOUNTS permissions (override), OR
  // 3. User is account manager, OR
  // 4. User has MANAGE_ALL_PROJECTS permission (can manage all projects = full account access)
  const [canEditAccount, hasViewAllAccounts, hasManageAllProjects, hasFullAccessViaService] = await Promise.all([
    hasPermission(userProfile, Permission.MANAGE_ACCOUNTS, { accountId }),
    hasPermission(userProfile, Permission.VIEW_ALL_ACCOUNTS),
    hasPermission(userProfile, Permission.MANAGE_ALL_PROJECTS),
    accountService.hasFullAccountAccess((userProfile as any).id, accountId, supabase)
  ]);

  // If user has VIEW_ALL_ACCOUNTS, also check if they have base MANAGE_ACCOUNTS permission
  const hasBaseEditAccount = hasViewAllAccounts ? await hasPermission(userProfile, Permission.MANAGE_ACCOUNTS) : false;
  
  // Full access if user can edit this account OR has override permissions OR is account manager
  const hasFullAccess = canEditAccount ||
                       (hasViewAllAccounts && hasBaseEditAccount) ||
                       hasManageAllProjects ||
                       hasFullAccessViaService;

  // Fetch account data - pass supabase client for proper auth
  // Don't pass userMap - let the service query the database for ALL assigned users
   
  const [account, metrics, urgentItems] = await Promise.all([
    accountService.getAccountById(accountId, undefined, supabase as any),
    accountService.getAccountMetrics(accountId, supabase as any),
    accountService.getUrgentItems(accountId, supabase as any),
  ]);

  if (!account) {
    notFound();
  }

  return (
    <AccountOverview 
      account={account}
      metrics={metrics}
      urgentItems={urgentItems}
      userProfile={userProfile}
      hasFullAccess={hasFullAccess}
    />
  );
}
