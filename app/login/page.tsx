'use client'

import { Suspense, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/hooks/useAuth"
import { LoginForm } from "@/components/login-form"
import { DemoLoginForm } from "@/components/demo-login-form"
import { isDemoMode } from "@/lib/demo-mode"
import { isSupabaseConfigured } from "@/lib/supabase"

export default function Page() {
  const { user, userProfile, loading } = useAuth()
  const router = useRouter()
  const supabaseReady = isSupabaseConfigured()

  // Check for first-run (no users) and redirect to onboarding
  useEffect(() => {
    if (!supabaseReady) return
    fetch('/api/onboarding/check-first-run')
      .then(res => res.json())
      .then(data => {
        if (data.firstRun) {
          router.replace('/onboarding')
        }
      })
      .catch(() => {})
  }, [router, supabaseReady])

  useEffect(() => {
    // Wait for auth to finish loading before checking
    if (loading) return

    // If user is already authenticated, redirect appropriately
    if (user) {
      // Client users go to client portal
      if (userProfile && (userProfile as any).is_client) {
        router.replace('/client-portal')
      } else {
        router.replace('/welcome')
      }
    }
  }, [user, userProfile, loading, router])

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Checking authentication...</p>
        </div>
      </div>
    )
  }

  // If user is authenticated, show loading while redirecting
  if (user) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Redirecting...</p>
        </div>
      </div>
    )
  }

  // User is not authenticated, show login form
  const demoMode = isDemoMode()

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className={demoMode ? "w-full max-w-2xl" : "w-full max-w-sm"}>
        {/* Show setup instructions when database is not configured */}
        {!supabaseReady && (
          <div className="mb-6 p-4 border border-amber-300 bg-amber-50 rounded-lg">
            <h2 className="text-sm font-semibold text-amber-800 mb-2">Database Not Connected</h2>
            <p className="text-sm text-amber-700 mb-3">
              Supabase is not configured. To get started:
            </p>
            <ol className="text-sm text-amber-700 space-y-1 list-decimal list-inside">
              <li>Copy <code className="bg-amber-100 px-1 rounded text-xs">.env.local.template</code> to <code className="bg-amber-100 px-1 rounded text-xs">.env.local</code></li>
              <li>Install and start Docker Desktop</li>
              <li>Run <code className="bg-amber-100 px-1 rounded text-xs">npm run dev:demo</code> to start with demo data</li>
            </ol>
            <p className="text-xs text-amber-600 mt-3">
              See the README for detailed setup instructions.
            </p>
          </div>
        )}

        <Suspense fallback={<div>Loading...</div>}>
          {demoMode ? <DemoLoginForm /> : <LoginForm />}
        </Suspense>
      </div>
    </div>
  )
}
