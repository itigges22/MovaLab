'use client'

/**
 * Capacity Dashboard Widget
 * Displays capacity metrics and utilization for users, teams, or organization
 */

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Users, 
  ChevronLeft, 
  ChevronRight,
  AlertCircle 
} from 'lucide-react'
import { hasPermission } from '@/lib/permission-checker'
import { Permission } from '@/lib/permissions'
import { UserWithRoles } from '@/lib/rbac-types'

interface UserCapacityMetrics {
  userId: string
  userName: string
  userEmail: string
  weekStartDate: string
  availableHours: number
  allocatedHours: number
  actualHours: number
  utilizationRate: number
  remainingCapacity: number
}

interface CapacityDashboardProps {
  userProfile: UserWithRoles
  defaultView?: 'user' | 'team' | 'org'
  showViewSelector?: boolean // New prop to control view selector visibility
}

export default function CapacityDashboard({ userProfile, defaultView = 'user', showViewSelector = true }: CapacityDashboardProps) {
  const [loading, setLoading] = useState(true)
  const [viewType, setViewType] = useState<'user' | 'team' | 'org'>(defaultView)
  const [currentWeekStart, setCurrentWeekStart] = useState<string>('')
  const [metrics, setMetrics] = useState<any>(null)
  const [canViewTeam, setCanViewTeam] = useState(false)
  const [canViewOrg, setCanViewOrg] = useState(false)

  // Get Monday of current week
  const getWeekStartDate = (date: Date = new Date()): string => {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(d.setDate(diff))
    return monday.toISOString().split('T')[0]
  }

  // Format date for display
  const formatWeekDisplay = (weekStart: string): string => {
    const start = new Date(weekStart)
    const end = new Date(start)
    end.setDate(end.getDate() + 6)

    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
    return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`
  }

  // Navigate weeks
  const navigateWeek = (direction: 'prev' | 'next') => {
    const current = new Date(currentWeekStart)
    const daysToAdd = direction === 'next' ? 7 : -7
    current.setDate(current.getDate() + daysToAdd)
    setCurrentWeekStart(getWeekStartDate(current))
  }

  // Go to current week
  const goToCurrentWeek = () => {
    setCurrentWeekStart(getWeekStartDate())
  }

  // Check permissions
  useEffect(() => {
    async function checkPermissions() {
      const teamPerm = await hasPermission(userProfile, Permission.VIEW_TEAM_CAPACITY)
      const orgPerm = await hasPermission(userProfile, Permission.VIEW_ALL_CAPACITY)
      setCanViewTeam(teamPerm)
      setCanViewOrg(orgPerm)
    }
    checkPermissions()
  }, [userProfile])

  // Initialize week
  useEffect(() => {
    setCurrentWeekStart(getWeekStartDate())
  }, [])

  // Load capacity metrics
  useEffect(() => {
    if (!currentWeekStart) return

    async function loadMetrics() {
      setLoading(true)
      try {
        // Determine the appropriate endpoint based on view type
        let url = `/api/capacity?type=${viewType}&weekStartDate=${currentWeekStart}`
        
        if (viewType === 'user') {
          url += `&id=${userProfile.id}`
        } else if (viewType === 'team' && userProfile.user_roles?.[0]?.roles?.department_id) {
          url += `&id=${userProfile.user_roles[0].roles.department_id}`
        }

        const response = await fetch(url)
        const data = await response.json()

        if (data.success) {
          setMetrics(data.metrics)
        } else {
          console.error('Failed to load metrics:', data.error)
          setMetrics(null)
        }
      } catch (error) {
        console.error('Error loading capacity metrics:', error)
        setMetrics(null)
      } finally {
        setLoading(false)
      }
    }

    loadMetrics()
  }, [currentWeekStart, viewType, userProfile])

  // Render user capacity card
  const renderUserCapacity = (m: UserCapacityMetrics) => {
    const utilizationColor = 
      m.utilizationRate >= 90 ? 'text-red-600' :
      m.utilizationRate >= 75 ? 'text-yellow-600' :
      'text-green-600'

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-sm text-blue-600 font-medium">Available</div>
            <div className="text-2xl font-bold text-blue-900">{m.availableHours}h</div>
          </div>
          
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="text-sm text-purple-600 font-medium">Allocated</div>
            <div className="text-2xl font-bold text-purple-900">{m.allocatedHours}h</div>
          </div>
          
          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-sm text-green-600 font-medium">Actual</div>
            <div className="text-2xl font-bold text-green-900">{m.actualHours}h</div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Utilization Rate</span>
            <span className={`text-lg font-bold ${utilizationColor}`}>{m.utilizationRate}%</span>
          </div>
          <Progress value={m.utilizationRate} className="h-2" />
          
          {m.utilizationRate >= 90 && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg p-2">
              <AlertCircle className="w-4 h-4" />
              <span>High utilization - consider workload adjustment</span>
            </div>
          )}
        </div>

        <div className="pt-4 border-t">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Remaining Capacity</span>
            <span className="text-lg font-semibold text-gray-900">{m.remainingCapacity.toFixed(1)}h</span>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Capacity Overview
            </CardTitle>
            <CardDescription>Work capacity and utilization metrics</CardDescription>
          </div>
          
          {/* View Type Selector - only show if prop is true */}
          {showViewSelector && (
            <Select value={viewType} onValueChange={(value: any) => setViewType(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">My Capacity</SelectItem>
                {canViewTeam && <SelectItem value="team">Team Capacity</SelectItem>}
                {canViewOrg && <SelectItem value="org">Org Capacity</SelectItem>}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Week Navigation */}
        <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateWeek('prev')}
            className="gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </Button>
          
          <div className="flex items-center gap-2">
            <span className="font-semibold">{formatWeekDisplay(currentWeekStart)}</span>
            <Button variant="ghost" size="sm" onClick={goToCurrentWeek}>
              Today
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateWeek('next')}
            className="gap-1"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Capacity Metrics */}
        {metrics && viewType === 'user' && renderUserCapacity(metrics)}

        {!metrics && (
          <div className="text-center py-8 text-gray-500">
            <Clock className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p>No capacity data available for this week</p>
            <p className="text-sm mt-1">Set your availability to start tracking capacity</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

