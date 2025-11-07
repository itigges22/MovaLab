'use client'

/**
 * Drag-to-Set Availability Calendar
 * Motion/Akiflow-style calendar for setting work availability
 */

import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar, Save, Copy, ChevronLeft, ChevronRight, Clock, Info } from 'lucide-react'
import { toast } from 'sonner'
import { hasPermission } from '@/lib/permission-checker'
import { Permission } from '@/lib/permissions'
import { UserWithRoles } from '@/lib/rbac-types'

interface TimeBlock {
  day: string
  startHour: number
  endHour: number
}

interface DragAvailabilityCalendarProps {
  userProfile: UserWithRoles
  userId?: string
  onSave?: () => void
}

export default function DragAvailabilityCalendar({ userProfile, userId, onSave }: DragAvailabilityCalendarProps) {
  const targetUserId = userId || userProfile.id
  const isOwnData = targetUserId === userProfile.id

  const [canEdit, setCanEdit] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Week navigation
  const [currentWeekStart, setCurrentWeekStart] = useState<string>('')

  // Availability blocks (unavailable time = user can't work)
  const [unavailableBlocks, setUnavailableBlocks] = useState<TimeBlock[]>([])
  
  // Dragging state
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<{ day: string; hour: number } | null>(null)
  const [dragEnd, setDragEnd] = useState<{ day: string; hour: number } | null>(null)

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const hours = Array.from({ length: 24 }, (_, i) => i) // 0-23

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
    return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}, ${start.getFullYear()}`
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

  // Check if a time slot is unavailable
  const isSlotUnavailable = (day: string, hour: number): boolean => {
    return unavailableBlocks.some(block => 
      block.day === day && hour >= block.startHour && hour < block.endHour
    )
  }

  // Calculate available hours
  const calculateAvailableHours = (): Record<string, number> => {
    const hoursPerDay: Record<string, number> = {}
    days.forEach(day => {
      const unavailableHours = unavailableBlocks
        .filter(block => block.day === day)
        .reduce((sum, block) => sum + (block.endHour - block.startHour), 0)
      hoursPerDay[day] = 24 - unavailableHours
    })
    return hoursPerDay
  }

  const availableHours = calculateAvailableHours()
  const totalHours = Object.values(availableHours).reduce((sum, h) => sum + h, 0)

  // Mouse down - start dragging
  const handleMouseDown = (day: string, hour: number) => {
    if (!canEdit) return
    setIsDragging(true)
    setDragStart({ day, hour })
    setDragEnd({ day, hour })
  }

  // Mouse move - update drag end
  const handleMouseMove = (day: string, hour: number) => {
    if (!isDragging || !dragStart) return
    // Only allow dragging within the same day
    if (day === dragStart.day) {
      setDragEnd({ day, hour })
    }
  }

  // Mouse up - finalize block
  const handleMouseUp = () => {
    if (!isDragging || !dragStart || !dragEnd) {
      setIsDragging(false)
      return
    }

    const day = dragStart.day
    const startHour = Math.min(dragStart.hour, dragEnd.hour)
    const endHour = Math.max(dragStart.hour, dragEnd.hour) + 1

    // Toggle: If the block is already unavailable, make it available
    const existingBlock = unavailableBlocks.find(
      block => block.day === day && 
      ((startHour >= block.startHour && startHour < block.endHour) ||
       (endHour > block.startHour && endHour <= block.endHour))
    )

    if (existingBlock) {
      // Remove overlapping blocks
      setUnavailableBlocks(prev => 
        prev.filter(block => 
          !(block.day === day && 
            ((startHour >= block.startHour && startHour < block.endHour) ||
             (endHour > block.startHour && endHour <= block.endHour) ||
             (startHour <= block.startHour && endHour >= block.endHour)))
        )
      )
    } else {
      // Add new unavailable block
      setUnavailableBlocks(prev => [...prev, { day, startHour, endHour }])
    }

    setIsDragging(false)
    setDragStart(null)
    setDragEnd(null)
  }

  // Check permissions
  useEffect(() => {
    async function checkPermissions() {
      if (!isOwnData) {
        setCanEdit(false)
      } else {
        const canEditAvailability = await hasPermission(userProfile, Permission.EDIT_OWN_AVAILABILITY)
        setCanEdit(canEditAvailability)
      }
    }
    checkPermissions()
  }, [userProfile, isOwnData])

  // Initialize week
  useEffect(() => {
    setCurrentWeekStart(getWeekStartDate())
  }, [])

  // Load availability data
  useEffect(() => {
    if (!currentWeekStart) return

    async function loadAvailability() {
      setLoading(true)
      try {
        const response = await fetch(
          `/api/availability?userId=${targetUserId}&weekStartDate=${currentWeekStart}`
        )
        const data = await response.json()

        if (data.success && data.availability && data.availability.schedule_data) {
          // Convert schedule_data to unavailable blocks
          const scheduleData = data.availability.schedule_data
          const blocks: TimeBlock[] = []
          
          days.forEach(day => {
            const availableHours = scheduleData[day] || 0
            const unavailableHours = 24 - availableHours
            
            // Assume unavailable time is at beginning and end of day
            // (This is a simplification - user can adjust by dragging)
            if (unavailableHours > 0) {
              // Split unavailable time: before 9am and after 5pm
              if (unavailableHours <= 15) {
                blocks.push({ day, startHour: 0, endHour: 9 })
                blocks.push({ day, startHour: 17, endHour: 24 })
              } else {
                blocks.push({ day, startHour: 0, endHour: unavailableHours })
              }
            }
          })
          
          setUnavailableBlocks(blocks)
        } else {
          // Default: 9am-5pm workday (8 hours)
          const defaultBlocks: TimeBlock[] = []
          days.forEach(day => {
            if (day === 'saturday' || day === 'sunday') {
              defaultBlocks.push({ day, startHour: 0, endHour: 24 })
            } else {
              defaultBlocks.push({ day, startHour: 0, endHour: 9 })
              defaultBlocks.push({ day, startHour: 17, endHour: 24 })
            }
          })
          setUnavailableBlocks(defaultBlocks)
        }
      } catch (error) {
        console.error('Error loading availability:', error)
        toast.error('Failed to load availability')
      } finally {
        setLoading(false)
      }
    }

    loadAvailability()
  }, [currentWeekStart, targetUserId])

  // Save availability
  const handleSave = async () => {
    if (!canEdit) {
      toast.error('You do not have permission to edit availability')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: targetUserId,
          weekStartDate: currentWeekStart,
          availableHours: totalHours,
          scheduleData: availableHours,
          notes: '',
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success(`Availability saved for week of ${formatWeekDisplay(currentWeekStart)}`)
        if (onSave) onSave()
      } else {
        toast.error(data.error || 'Failed to save availability')
      }
    } catch (error) {
      console.error('Error saving availability:', error)
      toast.error('Failed to save availability')
    } finally {
      setSaving(false)
    }
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
              <Calendar className="w-5 h-5" />
              Work Availability
            </CardTitle>
            <CardDescription>
              Drag to mark unavailable times (gray = can't work)
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-gray-500" />
            <span className="font-semibold text-blue-600">{totalHours}h</span>
            <span className="text-gray-500">available</span>
          </div>
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

        {/* Instructions */}
        <div className="flex items-start gap-2 text-sm text-blue-600 bg-blue-50 rounded-lg p-3">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <strong>How to use:</strong> Drag across time slots to mark them as unavailable. 
            Gray blocks = times you can't work. White blocks = times you're available.
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="border rounded-lg overflow-hidden">
          <div className="grid grid-cols-8 border-b bg-gray-50">
            <div className="p-2 text-xs font-medium text-gray-600 border-r">Time</div>
            {dayLabels.map((label, idx) => (
              <div key={label} className="p-2 text-center text-xs font-medium text-gray-600 border-r last:border-r-0">
                <div>{label}</div>
                <div className="text-blue-600 font-semibold">{availableHours[days[idx]]}h</div>
              </div>
            ))}
          </div>

          {/* Hour rows - show only 6am-10pm for better UX */}
          <div className="max-h-96 overflow-y-auto">
            {hours.filter(h => h >= 6 && h <= 22).map(hour => (
              <div key={hour} className="grid grid-cols-8 border-b last:border-b-0">
                <div className="p-2 text-xs text-gray-600 border-r bg-gray-50">
                  {hour.toString().padStart(2, '0')}:00
                </div>
                {days.map(day => {
                  const isUnavailable = isSlotUnavailable(day, hour)
                  const isInDragSelection = isDragging && dragStart && dragEnd &&
                    day === dragStart.day &&
                    hour >= Math.min(dragStart.hour, dragEnd.hour) &&
                    hour <= Math.max(dragStart.hour, dragEnd.hour)

                  return (
                    <div
                      key={`${day}-${hour}`}
                      className={`
                        h-8 border-r last:border-r-0 cursor-pointer transition-colors
                        ${isUnavailable ? 'bg-gray-300' : 'bg-white hover:bg-blue-50'}
                        ${isInDragSelection ? 'bg-blue-200' : ''}
                        ${!canEdit ? 'cursor-not-allowed opacity-60' : ''}
                      `}
                      onMouseDown={() => handleMouseDown(day, hour)}
                      onMouseMove={() => handleMouseMove(day, hour)}
                      onMouseUp={handleMouseUp}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        {canEdit && (
          <div className="flex items-center gap-3 pt-4 border-t">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Availability'}
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                // Clear all blocks (make all time available)
                setUnavailableBlocks([])
              }}
              disabled={saving}
            >
              Clear All
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                // Set default: weekdays 9-5
                const defaultBlocks: TimeBlock[] = []
                days.forEach(day => {
                  if (day === 'saturday' || day === 'sunday') {
                    defaultBlocks.push({ day, startHour: 0, endHour: 24 })
                  } else {
                    defaultBlocks.push({ day, startHour: 0, endHour: 9 })
                    defaultBlocks.push({ day, startHour: 17, endHour: 24 })
                  }
                })
                setUnavailableBlocks(defaultBlocks)
              }}
              disabled={saving}
            >
              Reset to 9-5
            </Button>
          </div>
        )}

        {!canEdit && isOwnData && (
          <div className="text-sm text-amber-600 bg-amber-50 rounded-lg p-3">
            You do not have permission to edit your availability. Contact your administrator.
          </div>
        )}
      </CardContent>
    </Card>
  )
}

