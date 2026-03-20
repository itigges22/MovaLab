'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { signOut } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Breadcrumb } from '@/components/breadcrumb';
import { Menu, User, LogOut, Clock } from 'lucide-react';

interface TopHeaderProps {
  onMobileMenuToggle?: () => void;
  isMobileMenuOpen?: boolean; // Reserved for future use (e.g., icon change)
}

export function TopHeader({ onMobileMenuToggle, isMobileMenuOpen: _isMobileMenuOpen }: TopHeaderProps) {
  const router = useRouter();
  const { userProfile, loading } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getPrimaryRole = () => {
    if (!userProfile?.user_roles?.length) return 'No Role';
    const role = (userProfile.user_roles as any)[0]?.roles;
    return role?.name || 'No Role';
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      router.push('/login');
      router.refresh();
    } catch (_error) {
      // Sign-out errors are non-critical - user is redirected to login regardless
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <header className="h-14 flex-shrink-0 border-b border-[var(--border)] bg-white flex items-center justify-between px-4 lg:px-6">
      {/* Left side: Mobile menu + Breadcrumb */}
      <div className="flex items-center gap-3">
        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden h-8 w-8"
          onClick={onMobileMenuToggle}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>

        {/* Breadcrumb */}
        <div className="hidden sm:block">
          <Breadcrumb />
        </div>
      </div>

      {/* Right side: User avatar dropdown */}
      <div className="flex items-center gap-3">
        {/* Time entries quick link */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          asChild
        >
          <Link href="/time-entries">
            <Clock className="h-4 w-4" />
            <span className="sr-only">Time Entries</span>
          </Link>
        </Button>

        {/* User dropdown */}
        {loading ? (
          <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
        ) : userProfile ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full p-0">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={(userProfile as any).image || undefined} alt={(userProfile as any).name} />
                  <AvatarFallback className="bg-[var(--primary)] text-white text-[11px] font-semibold">
                    {getInitials((userProfile as any).name)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-[13px] font-semibold leading-none">{(userProfile as any).name}</p>
                  <p className="text-[11px] leading-none text-muted-foreground">{(userProfile as any).email}</p>
                  <p className="text-[11px] leading-none text-muted-foreground">{getPrimaryRole()}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile" className="flex items-center cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/time-entries" className="flex items-center cursor-pointer">
                  <Clock className="mr-2 h-4 w-4" />
                  <span>Time Entries</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>{isSigningOut ? 'Signing out...' : 'Sign out'}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
        )}
      </div>
    </header>
  );
}
