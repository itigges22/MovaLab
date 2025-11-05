'use client'

import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RoleGuard } from "@/components/role-guard"
import { isAdminLevel, hasPermission } from '@/lib/rbac'
import { Permission } from '@/lib/permissions'
import { AssignedProjectsSection } from '@/components/assigned-projects-section'

export default function DashboardPage() {
  const { userProfile } = useAuth()
  const router = useRouter()
  const [canAccessAdmin, setCanAccessAdmin] = useState(false)
  const [canAccessAnalytics, setCanAccessAnalytics] = useState(false)

  useEffect(() => {
    if (!userProfile) return;

    async function checkPermissions() {
      const isAdmin = await isAdminLevel(userProfile);
      const canViewAnalytics = await hasPermission(userProfile, Permission.VIEW_ANALYTICS);
      
      setCanAccessAdmin(isAdmin);
      setCanAccessAnalytics(canViewAnalytics);
    }

    checkPermissions();
  }, [userProfile])

  return (
    <RoleGuard>
      <div>
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
            <p className="text-gray-600">Welcome to your PRISM PSA dashboard</p>
          </div>

        {/* Assigned Projects Section */}
        <AssignedProjectsSection userProfile={userProfile} />

        {/* User Info and Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Your account details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p><strong>Name:</strong> {userProfile?.name || 'N/A'}</p>
                <p><strong>Email:</strong> {userProfile?.email || 'N/A'}</p>
                <p><strong>Roles:</strong> {userProfile?.user_roles?.map(ur => ur.roles.name).join(', ') || 'None assigned'}</p>
                <p><strong>Departments:</strong> {userProfile?.user_roles?.map(ur => ur.roles.departments?.name).filter((name): name is string => Boolean(name)).join(', ') || 'None assigned'}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button className="w-full" variant="outline" onClick={() => router.push('/accounts')}>
                  View My Accounts
                </Button>
                {userProfile?.user_roles && userProfile.user_roles.length > 0 && (
                  <Button className="w-full" variant="outline" onClick={() => router.push('/departments')}>
                    View My Departments
                  </Button>
                )}
                {canAccessAdmin && (
                  <Button className="w-full" variant="outline" onClick={() => router.push('/admin')}>
                    View Admin Page
                  </Button>
                )}
                {canAccessAnalytics && (
                  <Button className="w-full" variant="outline" onClick={() => router.push('/analytics')}>
                    View Org Analytics
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </RoleGuard>
  )
}
