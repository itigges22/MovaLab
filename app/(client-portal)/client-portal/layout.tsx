import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import ClientPortalSidebar from '@/components/client-portal-sidebar';

export const metadata = {
  title: {
    default: 'Client Portal | MovaLab',
    template: '%s | Client Portal | MovaLab',
  },
  description: 'MovaLab Client Portal - View your projects and deliverables.',
};

export default async function ClientPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabase();
  if (!supabase) redirect('/login');

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect('/login');

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('is_client, client_account_id, name, email')
    .eq('id', user.id)
    .single();

  // If not a client user, redirect to internal dashboard
  if (!profile?.is_client) redirect('/dashboard');

  // Get account name for the sidebar
  let accountName = 'Unknown Account';
  if (profile.client_account_id) {
    const { data: account } = await supabase
      .from('accounts')
      .select('name')
      .eq('id', profile.client_account_id)
      .single();
    if (account?.name) {
      accountName = account.name;
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <ClientPortalSidebar
        userName={profile.name || 'Client User'}
        userEmail={profile.email || ''}
        accountName={accountName}
      />
      <main className="flex-1 overflow-auto">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
