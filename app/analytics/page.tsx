'use client'

import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3, TrendingUp, AlertCircle } from 'lucide-react'
import { RoleGuard } from '@/components/role-guard'
import { Permission } from '@/lib/permissions'

export default function AnalyticsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

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

  return (
    <RoleGuard requireAnyPermission={[Permission.VIEW_ANALYTICS, Permission.VIEW_DEPARTMENT_ANALYTICS, Permission.VIEW_ALL_ANALYTICS]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
            <p className="text-gray-600 mt-2">View insights and performance metrics</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5" />
              <span>Analytics Dashboard</span>
            </CardTitle>
            <CardDescription>This feature is coming soon</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Analytics Dashboard</h3>
              <p className="text-gray-600 mb-6">
                The analytics dashboard is currently under development. 
                This will provide comprehensive insights into your system usage, performance metrics, and business intelligence.
              </p>
              <div className="space-y-2 text-sm text-gray-500">
                <p>• Real-time performance metrics</p>
                <p>• User activity analytics</p>
                <p>• Project progress tracking</p>
                <p>• Custom report generation</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </RoleGuard>
  )
}
