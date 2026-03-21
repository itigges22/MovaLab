'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { LoginForm } from "@/components/login-form"
import { DemoLoginForm } from "@/components/demo-login-form"
import { isDemoMode } from "@/lib/demo-mode"
import { isSupabaseConfigured } from "@/lib/supabase"

export default function Home() {
  const { user, userProfile, loading } = useAuth()
  const router = useRouter()
  const supabaseReady = isSupabaseConfigured()

  // First-run check: redirect to onboarding if no users exist
  const [firstRunChecked, setFirstRunChecked] = useState(false)
  const [isFirstRun, setIsFirstRun] = useState(false)

  useEffect(() => {
    if (!supabaseReady) {
      setFirstRunChecked(true)
      return
    }
    fetch('/api/onboarding/check-first-run')
      .then(res => res.json())
      .then(data => {
        if (data.firstRun) {
          setIsFirstRun(true)
          router.replace('/onboarding')
        }
        setFirstRunChecked(true)
      })
      .catch(() => setFirstRunChecked(true))
  }, [router, supabaseReady])

  useEffect(() => {
    if (!firstRunChecked || isFirstRun) return
    if (!loading && user && userProfile) {
      // User is authenticated AND profile is loaded — safe to redirect
      const hasRoles = userProfile.user_roles && userProfile.user_roles.length > 0
      if (hasRoles) {
        router.push('/dashboard')
      } else {
        router.push('/welcome')
      }
    }
  }, [user, userProfile, loading, router, firstRunChecked, isFirstRun])

  // Show spinner while checking first-run or redirecting to onboarding
  if (!firstRunChecked || isFirstRun) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (user && userProfile) {
    // User is authenticated, show loading while redirecting
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Redirecting...</p>
        </div>
      </div>
    )
  }

  // User is not authenticated, show login form
  const demoMode = isDemoMode()

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className={demoMode ? "w-full max-w-2xl" : "max-w-md w-full"}>
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

        {!demoMode && (
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Welcome to MovaLab
            </h1>
            <p className="text-gray-600">
              Professional Service Automation Platform
            </p>
          </div>
        )}

        <Suspense fallback={<div className="text-center">Loading...</div>}>
          {demoMode ? <DemoLoginForm /> : <LoginForm />}
        </Suspense>
      </div>
    </div>
  )
}
