'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger,
  DropdownMenuGroup
} from './ui/dropdown-menu'
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  User, 
  Menu, 
  X,
  LogOut,
  BarChart3,
  ChevronDown
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { isSuperadmin, isUnassigned } from '@/lib/rbac'

interface NavigationItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  roles?: string[]
  departments?: string[]
}

const navigationItems: NavigationItem[] = [
  {
    name: 'Welcome',
    href: '/welcome',
    icon: User,
  },
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    name: 'Department',
    href: '/departments',
    icon: Building2,
    // All users with roles can access departments
  },
  {
    name: 'Accounts',
    href: '/accounts',
    icon: Users,
    // All users can access accounts, but will only see accounts they're assigned to
  },
  // Profile removed from main nav - accessible via dropdown menu
]

export function ClientNavigation() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const { userProfile, signOut, loading } = useAuth()
  const pathname = usePathname()

  // Handle hydration
  useEffect(() => {
    setIsMounted(true)
  }, [])

  const handleSignOut = async () => {
    try {
      await signOut()
      // Redirect to home page after logout
      window.location.href = '/'
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const getUserInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getUserDepartments = () => {
    if (!userProfile?.user_roles) return []
    try {
      return userProfile.user_roles
        .map(ur => {
          const dept = ur.roles?.departments;
          if (!dept) return null;
          return {
            id: dept.id,
            name: dept.name
          };
        })
        .filter((dept): dept is { id: string; name: string } => dept !== null);
    } catch (error) {
      console.error('Error getting user departments:', error)
      return []
    }
  }

  const canAccessItem = (item: NavigationItem) => {
    // During SSR or while loading, show a minimal set of items to prevent hydration mismatch
    if (!isMounted || loading) {
      return item.href === '/welcome'
    }
    
    // Safety check: if userProfile is being cleared (during logout), only show welcome
    if (!userProfile) {
      return item.href === '/welcome'
    }
    
    // IMPORTANT: Check if user is unassigned FIRST
    // Add try-catch to prevent errors during rapid state changes
    let userIsUnassigned = false
    try {
      userIsUnassigned = isUnassigned(userProfile)
    } catch (error) {
      console.error('Error checking unassigned status:', error)
      // On error, default to safe behavior - only show welcome
      return item.href === '/welcome'
    }
    
    // Unassigned users can ONLY see Welcome page
    if (userIsUnassigned) {
      return item.href === '/welcome'
    }
    
    // Superadmin has access to everything
    try {
      if (isSuperadmin(userProfile)) {
        return true
      }
    } catch (error) {
      console.error('Error checking superadmin status:', error)
      // On error, continue with normal checks
    }
    
    // Check if user has any roles at all
    const hasRoles = userProfile?.user_roles && userProfile.user_roles.length > 0
    
    // If user has no roles, only allow access to Welcome page
    if (!hasRoles) {
      return item.href === '/welcome'
    }
    
    // If user has roles, check specific role restrictions
    if (!item.roles || item.roles.length === 0) {
      return true // No role restrictions
    }
    
    if (!userProfile?.user_roles) {
      return false
    }

    try {
      const userRoles = userProfile.user_roles.map(ur => ur.roles?.name).filter(Boolean)
      return item.roles.some(role => userRoles.includes(role))
    } catch (error) {
      console.error('Error checking role access:', error)
      return false
    }
  }

  const visibleItems = navigationItems.filter(canAccessItem)

  // Show loading state during hydration
  if (!isMounted) {
    return (
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link href="/welcome" className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">P</span>
                </div>
                <span className="text-xl font-semibold text-gray-900">PRISM PSA</span>
              </Link>
            </div>
            {/* Loading placeholder */}
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>
      </nav>
    )
  }

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link 
              href={userProfile?.user_roles && userProfile.user_roles.length > 0 ? "/dashboard" : "/welcome"} 
              className="flex items-center space-x-2"
            >
              <div className="w-8 h-8 relative">
                <Image
                  src="/prism-logo.png"
                  alt="PRISM PSA Logo"
                  width={32}
                  height={32}
                  className="object-contain"
                  priority
                />
              </div>
            </Link>
          </div>

              {/* Desktop Navigation */}
              <div className="hidden lg:flex items-center space-x-4">
                {visibleItems.slice(0, 6).map((item) => {
                  const Icon = item.icon
                  const isActive = pathname === item.href ||
                    (item.href !== '/dashboard' && pathname.startsWith(item.href))

                  // Special handling for Department dropdown
                  if (item.name === 'Department') {
                    const userDepartments = getUserDepartments()
                    return (
                      <DropdownMenu key={item.name}>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            className={cn(
                              'flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                              isActive
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                            )}
                          >
                            <Icon className="w-4 h-4" />
                            <span>{item.name}</span>
                            <ChevronDown className="w-3 h-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-56">
                          <DropdownMenuLabel>Your Departments</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {userDepartments.length > 0 ? (
                            userDepartments.map((dept) => (
                              <DropdownMenuItem key={dept.id} asChild>
                                <Link href={`/departments/${dept.id}`} className="flex items-center">
                                  <Building2 className="mr-2 h-4 w-4" />
                                  <span>{dept.name}</span>
                                </Link>
                              </DropdownMenuItem>
                            ))
                          ) : (
                            <DropdownMenuItem disabled>
                              <span className="text-gray-500">No departments assigned</span>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem asChild>
                            <Link href="/departments" className="flex items-center">
                              <Building2 className="mr-2 h-4 w-4" />
                              <span>View All Departments</span>
                            </Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )
                  }

                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={cn(
                        'flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.name}</span>
                    </Link>
                  )
                })}
                
                {/* Admin dropdown for superadmin - removed for now due to redirect issues */}
                {/* {isSuperadmin(userProfile) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="flex items-center space-x-2 px-3 py-2 text-sm font-medium">
                        <Settings className="w-4 h-4" />
                        <span>Admin</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href="/admin" className="flex items-center">
                          <Settings className="mr-2 h-4 w-4" />
                          <span>System Admin</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/admin/database" className="flex items-center">
                          <Database className="mr-2 h-4 w-4" />
                          <span>Database Status</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/admin/roles" className="flex items-center">
                          <Shield className="mr-2 h-4 w-4" />
                          <span>Role Management</span>
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )} */}
              </div>

              {/* Medium screen navigation (shows fewer items) */}
              <div className="hidden md:flex lg:hidden items-center space-x-3">
                {visibleItems.slice(0, 4).map((item) => {
                  const Icon = item.icon
                  const isActive = pathname === item.href ||
                    (item.href !== '/dashboard' && pathname.startsWith(item.href))

                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={cn(
                        'flex items-center space-x-1 px-2 py-2 rounded-md text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="hidden sm:inline">{item.name}</span>
                    </Link>
                  )
                })}
                
                {/* More items dropdown for medium screens - only show if there are items */}
                {visibleItems.length > 4 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="flex items-center space-x-1 px-2 py-2 text-sm font-medium">
                        <Menu className="w-4 h-4" />
                        <span className="hidden sm:inline">More</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {visibleItems.slice(4).map((item) => {
                        const Icon = item.icon
                        return (
                          <DropdownMenuItem key={item.name} asChild>
                            <Link href={item.href} className="flex items-center">
                              <Icon className="mr-2 h-4 w-4" />
                              <span>{item.name}</span>
                            </Link>
                          </DropdownMenuItem>
                        )
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            {userProfile && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={userProfile.image || ''} alt={userProfile.name} />
                      <AvatarFallback className="bg-blue-100 text-blue-700">
                        {getUserInitials(userProfile.name)}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{userProfile.name}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {userProfile.email}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {userProfile.user_roles?.map(ur => ur.roles.name).join(', ') || 'No roles'}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="flex items-center">
                      <User className="mr-2 h-4 w-4" />
                      <span>Profile & Settings</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sign out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>

            {/* Mobile Navigation */}
            {isMobileMenuOpen && (
              <div className="md:hidden">
                <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 border-t">
                  <div className="grid grid-cols-2 gap-2">
                    {visibleItems.slice(0, 6).map((item) => {
                      const Icon = item.icon
                      const isActive = pathname === item.href ||
                        (item.href !== '/dashboard' && pathname.startsWith(item.href))

                      // Special handling for Department dropdown in mobile
                      if (item.name === 'Department') {
                        const userDepartments = getUserDepartments()
                        return (
                          <div key={item.name} className="col-span-2 space-y-1">
                            <Link
                              href={item.href}
                              className={cn(
                                'flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                                isActive
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                              )}
                              onClick={() => setIsMobileMenuOpen(false)}
                            >
                              <Icon className="w-4 h-4" />
                              <span>{item.name}</span>
                            </Link>
                            {userDepartments.length > 0 && (
                              <div className="ml-4 space-y-1">
                                {userDepartments.map((dept) => (
                                  <Link
                                    key={dept.id}
                                    href={`/departments/${dept.id}`}
                                    className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                  >
                                    <Building2 className="w-4 h-4" />
                                    <span>{dept.name}</span>
                                  </Link>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      }

                      return (
                        <Link
                          key={item.name}
                          href={item.href}
                          className={cn(
                            'flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                            isActive
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                          )}
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          <Icon className="w-4 h-4" />
                          <span>{item.name}</span>
                        </Link>
                      )
                    })}
                  </div>
                  
                  {/* Additional items for mobile */}
                  {visibleItems.length > 6 && (
                    <div className="pt-2 border-t">
                      <p className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">More</p>
                      {visibleItems.slice(6).map((item) => {
                        const Icon = item.icon
                        const isActive = pathname === item.href ||
                          (item.href !== '/dashboard' && pathname.startsWith(item.href))

                        return (
                          <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                              'flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                              isActive
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                            )}
                            onClick={() => setIsMobileMenuOpen(false)}
                          >
                            <Icon className="w-4 h-4" />
                            <span>{item.name}</span>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
      </div>
    </nav>
  )
}
