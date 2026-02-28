'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

export interface SidebarItemProps {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number | string;
  disabled?: boolean;
  exactMatch?: boolean;
}

export function SidebarItem({
  href,
  label,
  icon: Icon,
  badge,
  disabled = false,
  exactMatch = false,
}: SidebarItemProps) {
  const pathname = usePathname();

  // Check if this route is active
  const isActive = exactMatch
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);

  if (disabled) {
    return (
      <div
        className={cn(
          'flex items-center gap-3 px-3 py-2 text-[13px] font-medium rounded-md',
          'text-[var(--sidebar-text-muted)] opacity-50 cursor-not-allowed'
        )}
      >
        <Icon className="h-4 w-4 flex-shrink-0" />
        <span className="truncate">{label}</span>
      </div>
    );
  }

  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 px-3 py-2 text-[13px] font-medium rounded-md transition-colors',
        'relative',
        isActive
          ? 'bg-[var(--sidebar-active-bg)] text-[var(--sidebar-text-active)]'
          : 'text-[var(--sidebar-text-muted)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--sidebar-text)]'
      )}
    >
      {/* Active indicator border */}
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[var(--sidebar-active-border)] rounded-r-full" />
      )}

      <Icon className={cn(
        'h-4 w-4 flex-shrink-0',
        isActive ? 'text-[var(--sidebar-active-border)]' : ''
      )} />

      <span className="truncate flex-1">{label}</span>

      {badge !== undefined && (
        <span className={cn(
          'px-1.5 py-0.5 text-[10px] font-semibold rounded-full',
          isActive
            ? 'bg-[var(--sidebar-active-border)] text-white'
            : 'bg-[var(--sidebar-active-bg)] text-[var(--sidebar-text-muted)]'
        )}>
          {badge}
        </span>
      )}
    </Link>
  );
}
