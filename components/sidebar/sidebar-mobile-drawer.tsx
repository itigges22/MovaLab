'use client';

import { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SidebarNavigation } from './sidebar-navigation';

interface SidebarMobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SidebarMobileDrawer({ isOpen, onClose }: SidebarMobileDrawerProps) {
  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <>
      {/* Overlay */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 lg:hidden',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-60 transform transition-transform duration-300 ease-in-out lg:hidden',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'absolute top-3 right-3 z-50 h-8 w-8 rounded-full',
            'bg-white/90 hover:bg-white shadow-sm',
            'transition-opacity duration-200',
            isOpen ? 'opacity-100' : 'opacity-0'
          )}
          onClick={onClose}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close menu</span>
        </Button>

        {/* Sidebar content */}
        <div className="h-full">
          <SidebarNavigation />
        </div>
      </div>
    </>
  );
}
