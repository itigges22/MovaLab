'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Database, Shield, Users, BarChart3 } from 'lucide-react'
import { RoleGuard } from '@/components/role-guard'
import { Permission } from '@/lib/permissions'
import { useRouter } from 'next/navigation'

export default function AdminPage() {
  const router = useRouter()

  return (
    <RoleGuard requireAnyPermission={[
      Permission.MANAGE_USERS,
      Permission.CREATE_ROLE,
      Permission.CREATE_DEPARTMENT,
      Permission.CREATE_ACCOUNT,
    ]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Administration</h1>
          <p className="text-gray-600 mt-2">Manage your PRISM PSA system settings and configurations</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Database Status Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Database className="w-5 h-5" />
                <span>Database Status</span>
              </CardTitle>
              <CardDescription>Monitor database health and performance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Connection Status</span>
                  <span className="text-sm font-medium text-green-600">Connected</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Response Time</span>
                  <span className="text-sm font-medium">~50ms</span>
                </div>
              </div>
              <Button 
                className="w-full mt-4" 
                onClick={() => router.push('/admin/database')}
              >
                View Details
              </Button>
            </CardContent>
          </Card>

          {/* Role Management Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="w-5 h-5" />
                <span>Role Management</span>
              </CardTitle>
              <CardDescription>Manage user roles and permissions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total Roles</span>
                  <span className="text-sm font-medium">8</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Active Users</span>
                  <span className="text-sm font-medium">1</span>
                </div>
              </div>
              <Button 
                className="w-full mt-4" 
                onClick={() => router.push('/admin/roles')}
              >
                Manage Roles
              </Button>
            </CardContent>
          </Card>

          {/* Superadmin Management Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="w-5 h-5" />
                <span>Superadmin Management</span>
              </CardTitle>
              <CardDescription>Manage superadmin roles and permissions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Superadmin Users</span>
                  <span className="text-sm font-medium">1</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Role Assignments</span>
                  <span className="text-sm font-medium">Active</span>
                </div>
              </div>
              <Button 
                className="w-full mt-4" 
                onClick={() => router.push('/admin/superadmin-setup')}
              >
                Manage Superadmins
              </Button>
            </CardContent>
          </Card>

          {/* User Management Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="w-5 h-5" />
                <span>User Management</span>
              </CardTitle>
              <CardDescription>Manage system users and access</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total Users</span>
                  <span className="text-sm font-medium">1</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Active Sessions</span>
                  <span className="text-sm font-medium">1</span>
                </div>
              </div>
              <Button 
                className="w-full mt-4" 
                variant="outline"
                disabled
              >
                Manage Users (Coming Soon)
              </Button>
            </CardContent>
          </Card>

          {/* Analytics Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="w-5 h-5" />
                <span>System Analytics</span>
              </CardTitle>
              <CardDescription>View system usage and performance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Page Views</span>
                  <span className="text-sm font-medium">1,234</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">API Calls</span>
                  <span className="text-sm font-medium">5,678</span>
                </div>
              </div>
              <Button 
                className="w-full mt-4" 
                variant="outline"
                disabled
              >
                View Analytics (Coming Soon)
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </RoleGuard>
  )
}
