'use client';

import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

export interface SidebarSectionProps {
  title?: string;
  children: ReactNode;
  className?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

export function SidebarSection({
  title,
  children,
  className,
}: SidebarSectionProps) {
  return (
    <div className={cn('py-2', className)}>
      {title && (
        <div className="px-3 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--sidebar-section-header)]">
            {title}
          </span>
        </div>
      )}
      <div className="space-y-0.5">
        {children}
      </div>
    </div>
  );
}
