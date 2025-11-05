import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware - Authentication & Basic Route Protection
 * 
 * This middleware handles:
 * 1. Authentication state (redirects to login if not authenticated)
 * 2. Unassigned user flow (redirects to welcome page)
 * 
 * NOTE: Permission checks are done in pages/components for performance
 * to avoid blocking middleware with database queries.
 */

// Public routes that don't require authentication
const publicRoutes = [
  '/',
  '/login',
  '/signup',
  '/pending-approval',
  '/welcome',
];

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const pathname = req.nextUrl.pathname;

  // Allow public routes and all API routes (API routes handle their own auth)
  if (publicRoutes.includes(pathname) || pathname.startsWith('/_next') || pathname.startsWith('/api')) {
    return res;
  }

  try {
    // Check if Supabase is configured
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Supabase environment variables not configured');
      // Allow request through - pages will handle errors
      return res;
    }

    // Create Supabase client
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          get(name: string) {
            return req.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            req.cookies.set({ name, value, ...options });
            res.cookies.set({ name, value, ...options });
          },
          remove(name: string, options: any) {
            req.cookies.set({ name, value: '', ...options });
            res.cookies.set({ name, value: '', ...options });
          },
        },
      }
    );

    // Get authenticated user
    const { data: { user }, error } = await supabase.auth.getUser();

    // If no user and route is protected, redirect to login
    if (error || !user) {
      if (pathname !== '/login' && pathname !== '/signup') {
        const redirectUrl = new URL('/login', req.url);
        redirectUrl.searchParams.set('redirectTo', pathname);
        return NextResponse.redirect(redirectUrl);
      }
      return res;
    }

    // If authenticated user tries to access login/signup, redirect home
    if (pathname === '/login' || pathname === '/signup') {
      return NextResponse.redirect(new URL('/welcome', req.url));
    }

    // Basic unassigned user check (lightweight - check if they have proper roles)
    // Full permission checks happen in pages/components for performance
    const { data: userRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select(`
        id,
        roles (
          id,
          name,
          is_system_role
        )
      `)
      .eq('user_id', user.id);

    // Check if user is unassigned (no roles or only "No Assigned Role")
    const hasNoRoles = !userRoles || userRoles.length === 0;
    const firstRole = userRoles && userRoles.length > 0 ? (userRoles[0] as { roles?: { is_system_role?: boolean; name?: string } | null }) : null;
    const hasOnlyUnassignedRole = firstRole && userRoles && userRoles.length === 1 && 
      firstRole.roles?.is_system_role === true &&
      (firstRole.roles?.name?.toLowerCase() === 'unassigned' ||
       firstRole.roles?.name?.toLowerCase() === 'no assigned role' ||
       firstRole.roles?.name?.toLowerCase().includes('unassigned'));
    
    const isUnassigned = hasNoRoles || hasOnlyUnassignedRole;

    // If user is unassigned and isn't on welcome/profile, redirect to welcome
    if (isUnassigned && pathname !== '/welcome' && pathname !== '/profile') {
      return NextResponse.redirect(new URL('/welcome', req.url));
    }

    // Allow the request to proceed
    // Permission checks will happen in the actual page components
    return res;

  } catch (error) {
    console.error('Middleware error:', error);
    // On error, allow request through (pages will handle auth/permissions)
    return res;
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
