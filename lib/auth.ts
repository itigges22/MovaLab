
import { createClientSupabase } from './supabase';
import { UserProfile, UserRole, Role, Department } from './supabase';

// Authentication helper functions

/**
 * Get the current authenticated user (client-side only)
 * Automatically refreshes session if expired
 * @returns The current user or null if not authenticated
 */
export async function getCurrentUser() {
  try {
    const supabase = createClientSupabase() as any;
    if (!supabase) return null;

    // Try to get user - this will automatically refresh if needed
    const { data: { user }, error } = await supabase.auth.getUser();

    // If error indicates expired session, try to refresh
    if (error && (error.message?.includes('session') || error.message?.includes('token') || error.message?.includes('expired'))) {
      console.log('Session expired, attempting refresh...');
      try {
        const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();
        if (!refreshError && session?.user) {
          // Refresh succeeded, return the user
          return session.user;
        }
      } catch (refreshErr) {
        console.error('Error refreshing session:', refreshErr);
      }
    }

    if (error || !user) {
      if (error) console.error('Error getting current user:', error);
      return null;
    }

    return user;
  } catch (error: unknown) {
    console.error('Error in getCurrentUser:', error);
    return null;
  }
}

/**
 * OPTIMIZED: Get user profile with roles in a SINGLE query
 * This combines what was previously 2-3 separate queries into one
 */
async function fetchUserProfileOptimized(supabase: any, userId: string) {
  // Single query to get profile with all role data
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select(`
      *,
      user_roles!user_roles_user_id_fkey (
        id,
        role_id,
        assigned_at,
        assigned_by,
        roles!user_roles_role_id_fkey (
          id,
          name,
          department_id,
          permissions,
          is_system_role,
          departments!roles_department_id_fkey (
            id,
            name,
            description
          )
        )
      )
    `)
    .eq('id', userId)
    .single();

  if (error) {
    // Handle relationship ambiguity by falling back to separate queries
    if (error.code === 'PGRST201') {
      return await fetchUserProfileFallback(supabase, userId);
    }
    // Handle no profile found
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching user profile:', error);
    return null;
  }

  return profile;
}

/**
 * Fallback: Fetch profile and roles separately if join fails
 */
async function fetchUserProfileFallback(supabase: any, userId: string) {
  // Get profile first
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    return null;
  }

  // Get roles separately
  const { data: userRoles, error: rolesError } = await supabase
    .from('user_roles')
    .select(`
      id,
      role_id,
      assigned_at,
      assigned_by,
      roles!user_roles_role_id_fkey (
        id,
        name,
        department_id,
        permissions,
        is_system_role,
        departments!roles_department_id_fkey (
          id,
          name,
          description
        )
      )
    `)
    .eq('user_id', userId);

  if (rolesError) {
    console.error('Error fetching user roles:', rolesError);
    return { ...profile, user_roles: [] };
  }

  return { ...profile, user_roles: userRoles || [] };
}

/**
 * Get the current user's profile with roles (client-side only)
 * OPTIMIZED: Uses a single query to fetch profile + roles + permissions
 * This reduces load time from 10+ seconds to ~1 second
 *
 * @returns The user profile with roles or null if not found
 */
export async function getCurrentUserProfile() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return null;
    }

    const supabase = createClientSupabase() as any;
    if (!supabase) {
      return null;
    }

    // Use optimized single query - fetches profile + roles + permissions in ONE call
    const profile = await fetchUserProfileOptimized(supabase, (user as any).id);

    if (!profile) {
      return null;
    }

    // Type the return properly
    return profile as UserProfile & {
      user_roles: (UserRole & {
        roles: Role & {
          departments: Department;
        };
      })[];
    };
  } catch (error: unknown) {
    console.error('Error in getCurrentUserProfile:', error);
    return null;
  }
}

/**
 * Sign in with email and password
 * @param email - User's email
 * @param password - User's password
 * @returns Auth response with user and session
 */
export async function signInWithEmail(email: string, password: string) {
  try {
    const supabase = createClientSupabase() as any;
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Sign in error:', error);
      throw error;
    }

    return data;
  } catch (error: unknown) {
    console.error('Error in signInWithEmail:', error);
    throw error;
  }
}

/**
 * Sign up with email and password
 * @param email - User's email
 * @param password - User's password
 * @param name - User's name
 * @returns Auth response with user and session
 */
export async function signUpWithEmail(email: string, password: string, name: string) {
  try {
    const supabase = createClientSupabase() as any;
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        },
        // Use auth callback route for proper token exchange
        emailRedirectTo: `${window.location.origin}/auth/callback?type=signup`,
      },
    });

    if (error) {
      console.error('Sign up error:', {
        message: error.message,
        details: (error as unknown as Record<string, unknown>).details,
        hint: (error as unknown as Record<string, unknown>).hint,
        code: error.code,
        fullError: error
      });
      
      // Handle specific Supabase auth errors
      if (error.message?.includes('User already registered') || error.message?.includes('already been registered')) {
        throw new Error('User already registered');
      } else if (error.message?.includes('Password should be at least')) {
        throw new Error('Password should be at least 6 characters long');
      } else if (error.message?.includes('Invalid email')) {
        throw new Error('Please enter a valid email address');
      }
      
      throw new Error(`Sign up failed: ${error.message || 'Unknown error'}`);
    }

    // Check if user was actually created (Supabase doesn't throw error for existing emails)
    if (!data.user) {
      // This is expected behavior for existing emails, not an error
      throw new Error('User already registered');
    }

    // Check if email confirmation is pending
    // When email confirmation is enabled in Supabase, data.user exists but data.session is null
    // This is a SUCCESS case - the user was created but needs to confirm their email
    if (data.user && !data.session) {
      // Return with a flag indicating email confirmation is needed
      return {
        ...data,
        needsEmailConfirmation: true
      };
    }

    // Note: User profile is automatically created by database trigger
    // See scripts/FIX-SIGNUP-RLS.sql for trigger setup
    if (process.env.NODE_ENV === 'development') {
      console.log('User created successfully. Profile will be created by database trigger.');
    }

    return data;
  } catch (error: unknown) {
    // Only log actual errors, not expected "User already registered" cases
    if (error instanceof Error && error.message === 'User already registered') {
      // This is expected behavior, not an error - just re-throw without logging
      throw error;
    }
    
    // Log actual unexpected errors
    console.error('Unexpected error in signUpWithEmail:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      fullError: error
    });
    throw error;
  }
}

/**
 * Create user profile in the database
 * @param userId - User's ID from Supabase Auth
 * @param email - User's email
 * @param name - User's name
 * @returns Created user profile
 */
export async function createUserProfile(userId: string, email: string, name: string) {
  try {
    const supabase = createClientSupabase() as any;
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('Creating user profile for:', { userId, email, name });
      console.log('Current auth user:', await supabase.auth.getUser());
    }

    const { data, error } = await (supabase as any)
      .from('user_profiles')
      .insert([{
        id: userId,
        email,
        name,
        image: null,
        bio: null,
        skills: [],
        workload_sentiment: null,
      }])
      .select()
      .single();

    if (error) {
      console.error('=== DETAILED ERROR CREATING USER PROFILE ===');
      console.error('Error message:', error.message);
      console.error('Error details:', error.details);
      console.error('Error hint:', error.hint);
      console.error('Error code:', error.code);
      console.error('Full error object:', JSON.stringify(error, null, 2));
      console.error('==========================================');
      
      // Check if it's an RLS policy error
      if (error.message?.includes('row-level security policy')) {
        throw new Error(`Failed to create user profile: Row Level Security policy is blocking user creation. Please run the RLS setup script in Supabase SQL Editor.`);
      }
      
      // Check if it's a permission error
      if (error.message?.includes('permission denied')) {
        throw new Error(`Failed to create user profile: Permission denied. Please check RLS policies.`);
      }
      
      // Check if it's a constraint error
      if (error.message?.includes('duplicate key')) {
        throw new Error(`Failed to create user profile: User profile already exists.`);
      }
      
      throw new Error(`Failed to create user profile: ${error.message || 'Unknown error'}`);
    }

    return data;
  } catch (error: unknown) {
    console.error('Error in createUserProfile:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      fullError: error
    });
    throw error;
  }
}

/**
 * Sign out the current user
 * @returns Promise that resolves when sign out is complete
 */
export async function signOut() {
  try {
    const supabase = createClientSupabase() as any;
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  } catch (error: unknown) {
    console.error('Error in signOut:', error);
    throw error;
  }
}

/**
 * Reset password for a user
 * @param email - User's email
 * @returns Promise that resolves when reset email is sent
 */
export async function resetPassword(email: string) {
  try {
    const supabase = createClientSupabase() as any;
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      // Use auth callback route for proper token exchange
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    });

    if (error) {
      console.error('Password reset error:', error);
      throw error;
    }
  } catch (error: unknown) {
    console.error('Error in resetPassword:', error);
    throw error;
  }
}

/**
 * Update user password
 * @param newPassword - New password
 * @returns Promise that resolves when password is updated
 */
export async function updatePassword(newPassword: string) {
  try {
    const supabase = createClientSupabase() as any;
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      console.error('Password update error:', error);
      throw error;
    }
  } catch (error: unknown) {
    console.error('Error in updatePassword:', error);
    throw error;
  }
}

/**
 * Check if user is authenticated (client-side only)
 * @returns True if user is authenticated, false otherwise
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    return !!user;
  } catch (error: unknown) {
    console.error('Error in isAuthenticated:', error);
    return false;
  }
}

/**
 * Update user profile information
 * @param profileData - Profile data to update
 * @returns Promise that resolves when profile is updated
 */
export async function updateUserProfile(profileData: {
  name?: string;
  bio?: string;
  skills?: string[];
}) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('Updating user profile via API:', profileData);
    }

    // Call the API endpoint which enforces permission checks
    const response = await fetch('/api/profile', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(profileData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to update profile' }));
      throw new Error(errorData.error || `Failed to update profile: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (process.env.NODE_ENV === 'development') {
      console.log('User profile updated successfully');
    }
    return data.profile;
  } catch (error: unknown) {
    console.error('Error in updateUserProfile:', error);
    throw error;
  }
}

/**
 * Get the current session (client-side only)
 * @returns Current session or null
 */
export async function getCurrentSession() {
  try {
    const supabase = createClientSupabase() as any;
    if (!supabase) return null;

    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Error getting session:', error);
      return null;
    }

    return session;
  } catch (error: unknown) {
    console.error('Error in getCurrentSession:', error);
    return null;
  }
}
