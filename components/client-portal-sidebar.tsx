'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  LayoutDashboard,
  FolderOpen,
  User,
  LogOut,
  Building2,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ClientPortalSidebarProps {
  userName: string;
  userEmail: string;
  accountName: string;
}

const navItems = [
  { name: 'Dashboard', href: '/client-portal', icon: LayoutDashboard, exactMatch: true },
  { name: 'Projects', href: '/client-portal/projects', icon: FolderOpen, exactMatch: false },
  { name: 'Profile', href: '/client-portal/profile', icon: User, exactMatch: true },
];

export default function ClientPortalSidebar({
  userName,
  userEmail,
  accountName,
}: ClientPortalSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      await signOut();
      router.push('/login');
      router.refresh();
    } catch {
      // Sign-out errors are non-critical
    } finally {
      setIsSigningOut(false);
    }
  }

  function getInitials(name: string) {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  function isActive(href: string, exactMatch: boolean) {
    if (exactMatch) {
      return pathname === href;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)]">
      {/* Logo + Portal Label */}
      <div className="p-4 border-b border-[var(--sidebar-border)]">
        <Link href="/client-portal" className="flex items-center gap-2">
          <Image
            src="/logo-optimized.svg"
            alt="MovaLab Logo"
            width={120}
            height={40}
            className="object-contain h-8 w-auto"
            priority
          />
        </Link>
        <Badge
          variant="secondary"
          className="mt-2 text-[10px] font-medium"
        >
          Client Portal
        </Badge>
      </div>

      {/* Account Name */}
      <div className="px-4 py-3 border-b border-[var(--sidebar-border)]">
        <div className="flex items-center gap-2 text-[var(--sidebar-text-muted)]">
          <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="text-[12px] font-medium truncate">{accountName}</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href, item.exactMatch);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2 text-[13px] font-medium rounded-md transition-colors relative',
                active
                  ? 'bg-[var(--sidebar-active-bg)] text-[var(--sidebar-text-active)]'
                  : 'text-[var(--sidebar-text-muted)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--sidebar-text)]'
              )}
            >
              {active && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[var(--sidebar-active-border)] rounded-r-full" />
              )}
              <Icon
                className={cn(
                  'h-4 w-4 flex-shrink-0',
                  active ? 'text-[var(--sidebar-active-border)]' : ''
                )}
              />
              <span className="truncate">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Profile + Sign Out */}
      <div className="border-t border-[var(--sidebar-border)] p-3">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-8 w-8 rounded-full bg-[var(--sidebar-active-border)] text-white flex items-center justify-center text-[11px] font-semibold flex-shrink-0">
            {getInitials(userName)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-[var(--sidebar-text-active)] truncate">
              {userName}
            </p>
            <p className="text-[11px] text-[var(--sidebar-text-muted)] truncate">
              {userEmail}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="w-full justify-start gap-2 text-[13px] text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <LogOut className="h-4 w-4" />
          {isSigningOut ? 'Signing out...' : 'Sign out'}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar -- always visible */}
      <aside className="hidden lg:flex w-60 flex-shrink-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile toggle button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-3 left-3 z-50 bg-background/80 backdrop-blur-sm border shadow-sm"
        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile sidebar drawer */}
      <aside
        className={cn(
          'lg:hidden fixed inset-y-0 left-0 z-40 w-60 transform transition-transform duration-200 ease-in-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
