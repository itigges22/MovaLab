'use client'

import { useState, useEffect } from 'react'
import { createClientSupabase } from '../supabase'
import { logger } from '../debug-logger'

// Re-export the optimized useAuth from AuthContext
// This prevents duplicate auth calls by sharing state across all components
export { useAuth, AuthProvider } from '../contexts/AuthContext'

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
          logger.error('Error getting session', {}, error as Error)
          return
        }

        setSession(session)
      } catch (error: unknown) {
        logger.error('Error in getInitialSession', {}, error as Error)
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
