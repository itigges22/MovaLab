import { Metadata } from 'next';
import { getCurrentUserProfileServer } from '@/lib/auth-server';
import { accountService } from '@/lib/account-service';
import { AccountsClientWrapper } from '@/components/accounts-client-wrapper';
import { isSuperadmin, canManageAccounts, canViewAccounts } from '@/lib/rbac';
import { createServerSupabase, createAdminSupabaseClient } from '@/lib/supabase-server';

export const metadata: Metadata = {
  title: 'Accounts',
};

export const dynamic = 'force-dynamic';

export default async function AccountsPage() {
  // Create server-side Supabase client with auth first (needed for permission checks)
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

  // Check if user can view accounts (VIEW_ACCOUNTS, MANAGE_ACCOUNTS, or is account manager)
  const hasAccess = await canViewAccounts(userProfile, supabase);
  if (!hasAccess) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
          <p className="text-gray-600 mt-2">You don&apos;t have permission to view accounts.</p>
        </div>
      </div>
    );
  }

  // Check if user has admin-level access (can manage all accounts)
  const isAdminLevel = isSuperadmin(userProfile) || await canManageAccounts(userProfile, supabase);

  // Use admin client for reads — server component auth doesn't carry through RLS properly
  // Permission checks are done above via canViewAccounts/canManageAccounts
  const adminClient = createAdminSupabaseClient();
  console.warn('[Accounts Page] userId:', (userProfile as any).id, 'isAdminLevel:', isAdminLevel, 'adminClient:', !!adminClient);
  const accounts = isAdminLevel
    ? await accountService.getAllAccounts(adminClient)
    : await accountService.getUserAccounts((userProfile as any).id, adminClient);
  console.warn('[Accounts Page] accounts fetched:', accounts.length);

  return (
    <div className="min-h-screen bg-background">
      <div className="space-y-4 sm:space-y-6">
        <AccountsClientWrapper 
          initialAccounts={accounts}
          userProfile={userProfile}
          isAdminLevel={isAdminLevel}
        />
      </div>
    </div>
  );
}

