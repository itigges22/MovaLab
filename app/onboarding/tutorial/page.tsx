'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { Loader2 } from 'lucide-react';

/**
 * /onboarding/tutorial
 *
 * This page redirects the user into the main app where the TutorialProvider
 * will pick up and show the floating tutorial overlay. The tutorial is NOT
 * rendered on this page — it is a global overlay managed by the TutorialProvider
 * inside AppWithClockProvider.
 *
 * This page exists as an entry point that the setup wizard can redirect to
 * after the superadmin account is created.
 */
export default function TutorialEntryPage() {
  const { userProfile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!userProfile) {
      // Not logged in — redirect to login
      router.replace('/login');
      return;
    }

    // Redirect to dashboard — the TutorialProvider will handle the rest
    router.replace('/dashboard');
  }, [userProfile, loading, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-muted-foreground text-sm">Starting tutorial...</p>
    </div>
  );
}
