'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { SidebarNavigation } from '@/components/sidebar';
import { TopHeader } from '@/components/top-header';
import { SidebarMobileDrawer } from '@/components/sidebar/sidebar-mobile-drawer';

interface AppLayoutProps {
  children: React.ReactNode;
}

// Pages that should NOT show the sidebar (auth pages, etc.)
const noSidebarPages = ['/login', '/signup', '/auth', '/reset-password', '/update-password', '/onboarding', '/invite', '/client-portal', '/client-invite'];

export function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { userProfile, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Handle hydration
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Redirect client users to client portal when they access internal pages
  useEffect(() => {
    if (!loading && userProfile && (userProfile as any).is_client) {
      const isInternalPage = !noSidebarPages.some(page => pathname.startsWith(page));
      if (isInternalPage) {
        router.replace('/client-portal');
      }
    }
  }, [loading, userProfile, pathname, router]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Close mobile menu on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const handleMobileMenuToggle = useCallback(() => {
    setMobileMenuOpen((prev) => !prev);
  }, []);

  const handleMobileMenuClose = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  // Check if current page should show sidebar
  const shouldShowSidebar = !noSidebarPages.some(page => pathname.startsWith(page));

  // For auth pages, render without sidebar
  if (!shouldShowSidebar) {
    return (
      <div className="min-h-screen bg-[var(--background)]">
        {children}
      </div>
    );
  }

  // Show loading skeleton during hydration
  if (!isMounted) {
    return (
      <div className="flex h-screen bg-[var(--background)]">
        {/* Sidebar skeleton */}
        <aside className="hidden lg:flex w-60 flex-shrink-0 bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)] flex-col">
          <div className="p-4 border-b border-[var(--sidebar-border)]">
            <div className="h-10 w-32 bg-[var(--sidebar-active-bg)] rounded animate-pulse" />
          </div>
          <div className="flex-1 p-2 space-y-1">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-9 bg-[var(--sidebar-active-bg)] rounded animate-pulse" />
            ))}
          </div>
        </aside>

        {/* Content area skeleton */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="h-14 border-b bg-white flex items-center justify-between px-4">
            <div className="h-6 w-40 bg-gray-200 rounded animate-pulse" />
            <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
          </header>
          <main role="main" className="flex-1 overflow-auto p-6">
            <div className="max-w-[1400px] mx-auto space-y-4">
              <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
              <div className="h-40 bg-gray-100 rounded animate-pulse" />
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[var(--background)]">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <SidebarNavigation />
      </div>

      {/* Mobile Sidebar Drawer */}
      <SidebarMobileDrawer
        isOpen={mobileMenuOpen}
        onClose={handleMobileMenuClose}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <TopHeader
          onMobileMenuToggle={handleMobileMenuToggle}
          isMobileMenuOpen={mobileMenuOpen}
        />

        {/* Content */}
        <main role="main" className="flex-1 overflow-auto bg-white">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
