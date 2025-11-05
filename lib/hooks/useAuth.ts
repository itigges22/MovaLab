'use client'

import { useState, useEffect } from 'react'
import { User } from '@supabase/supabase-js'
import { createClientSupabase } from '../supabase'
import { getCurrentUserProfile, signOut } from '../auth'
import { UserWithRoles } from '../rbac'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserWithRoles | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClientSupabase()
    if (!supabase) {
      setLoading(false)
      return
    }

    // Track in-flight profile requests to prevent race conditions
    let currentProfileRequest: Promise<UserWithRoles | null> | null = null
    let isMounted = true

    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (!isMounted) return
        
        if (error) {
          console.error('Error getting session:', error)
          setError(error.message)
          setLoading(false)
          return
        }

        if (session?.user) {
          setUser(session.user)
          
          // Load profile with request tracking
          const initialProfileRequest = getCurrentUserProfile()
          currentProfileRequest = initialProfileRequest
          initialProfileRequest
            .then(profile => {
              // Only update if this is still the current request and component is mounted
              if (isMounted && currentProfileRequest === initialProfileRequest) {
                console.log('Initial user profile loaded:', profile ? 'Success' : 'Failed')
                setUserProfile(profile)
              }
            })
            .catch(error => {
              if (isMounted) {
                console.error('Error loading initial user profile:', error)
                setUserProfile(null)
              }
            })
        } else {
          // No session, user is not authenticated
          setUser(null)
          setUserProfile(null)
        }
      } catch (error) {
        if (isMounted) {
          console.error('Error in getInitialSession:', error)
          setError('Failed to load user session')
          setUser(null)
          setUserProfile(null)
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: string, session: any) => {
        console.log('Auth state changed:', event, session?.user?.id)
        
        // Cancel any in-flight profile request
        currentProfileRequest = null
        
        if (!isMounted) return
        
        if (session?.user) {
          setUser(session.user)
          setLoading(true)
          
          // Load profile with request tracking
          const profileRequest = getCurrentUserProfile()
          currentProfileRequest = profileRequest
          
          profileRequest
            .then(profile => {
              // Only update if this is still the current request and component is mounted
              if (isMounted && currentProfileRequest === profileRequest) {
                console.log('User profile loaded:', profile ? 'Success' : 'Failed')
                setUserProfile(profile)
                setLoading(false)
              }
            })
            .catch(error => {
              if (isMounted && currentProfileRequest === profileRequest) {
                console.error('Error loading user profile:', error)
                setUserProfile(null)
                setLoading(false)
              }
            })
        } else {
          // Sign out or no session
          setUser(null)
          setUserProfile(null)
          setLoading(false)
        }
      }
    )

    return () => {
      isMounted = false
      currentProfileRequest = null
      subscription.unsubscribe()
    }
  }, [])

  const handleSignOut = async () => {
    try {
      setLoading(true)
      await signOut()
      setUser(null)
      setUserProfile(null)
    } catch (error) {
      console.error('Error signing out:', error)
      setError('Failed to sign out')
    } finally {
      setLoading(false)
    }
  }

  const refreshProfile = async () => {
    try {
      setLoading(true)
      const profile = await getCurrentUserProfile()
      setUserProfile(profile)
    } catch (error) {
      console.error('Error refreshing profile:', error)
      setError('Failed to refresh profile')
    } finally {
      setLoading(false)
    }
  }

  return {
    user,
    userProfile,
    loading,
    error,
    signOut: handleSignOut,
    refreshProfile,
    isAuthenticated: !!user,
  }
}

export function useSession() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClientSupabase()
    if (!supabase) {
      setLoading(false)
      return
    }

    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Error getting session:', error)
          return
        }

        setSession(session)
      } catch (error) {
        console.error('Error in getInitialSession:', error)
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: string, session: any) => {
        setSession(session)
        setLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return {
    session,
    loading,
    isAuthenticated: !!session?.user,
  }
}
