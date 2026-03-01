'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronUp, LogOut, User } from 'lucide-react';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  user_roles?: Array<{
    roles: {
      name: string;
      departments?: {
        name: string;
      } | null;
    };
  }>;
}

export interface SidebarUserProfileProps {
  userProfile: UserProfile | null;
  isLoading?: boolean;
}

export function SidebarUserProfile({
  userProfile,
  isLoading = false,
}: SidebarUserProfileProps) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Get initials for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Get primary role name
  const getPrimaryRole = () => {
    if (!userProfile?.user_roles?.length) return 'No Role';
    const role = userProfile.user_roles[0]?.roles;
    return role?.name || 'No Role';
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      router.push('/login');
      router.refresh();
    } catch (error) {
    } finally {
      setIsSigningOut(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-3 border-t border-[var(--sidebar-border)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[var(--sidebar-active-bg)] animate-pulse" />
          <div className="flex-1 min-w-0">
            <div className="h-3 w-20 bg-[var(--sidebar-active-bg)] rounded animate-pulse mb-1" />
            <div className="h-2.5 w-14 bg-[var(--sidebar-active-bg)] rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!userProfile) {
    return null;
  }

  return (
    <div className="border-t border-[var(--sidebar-border)]">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              'w-full flex items-center gap-3 p-3',
              'hover:bg-[var(--sidebar-hover-bg)] transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-active-border)] focus-visible:ring-inset'
            )}
          >
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarImage src={userProfile.image || undefined} alt={userProfile.name} />
              <AvatarFallback className="bg-[var(--sidebar-active-border)] text-white text-[11px] font-semibold">
                {getInitials(userProfile.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[13px] font-semibold text-[var(--sidebar-text-active)] truncate">
                {userProfile.name}
              </p>
              <p className="text-[11px] text-[var(--sidebar-text-muted)] truncate">
                {getPrimaryRole()}
              </p>
            </div>
            <ChevronUp className="h-4 w-4 text-[var(--sidebar-text-muted)] flex-shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          side="top"
          className="w-56 mb-1"
          sideOffset={4}
        >
          <div className="px-2 py-1.5 border-b">
            <p className="text-[13px] font-semibold truncate">{userProfile.name}</p>
            <p className="text-[11px] text-muted-foreground truncate">{userProfile.email}</p>
          </div>
          <DropdownMenuItem asChild>
            <Link href="/profile" className="flex items-center gap-2 cursor-pointer">
              <User className="h-4 w-4" />
              <span>Profile</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="text-destructive focus:text-destructive cursor-pointer"
          >
            <LogOut className="h-4 w-4 mr-2" />
            <span>{isSigningOut ? 'Signing out...' : 'Sign out'}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
