'use client'

/**
 * Weekly Availability Editor
 * Simple per-day hours input for setting work availability
 */

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Calendar, Save, ChevronLeft, ChevronRight, Clock, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { hasPermission } from '@/lib/permission-checker'
import { Permission } from '@/lib/permissions'
import { UserWithRoles } from '@/lib/rbac-types'

interface DragAvailabilityCalendarProps {
  userProfile: UserWithRoles
  userId?: string
  onSave?: () => void
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function DragAvailabilityCalendar({ userProfile, userId, onSave }: DragAvailabilityCalendarProps) {
  const targetUserId = userId ?? (userProfile as any).id
  const isOwnData = targetUserId === (userProfile as any).id

  const [canEdit, setCanEdit] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [currentWeekStart, setCurrentWeekStart] = useState<string>('')
  const [hoursPerDay, setHoursPerDay] = useState<Record<string, number>>({
    monday: 0, tuesday: 0, wednesday: 0, thursday: 0,
    friday: 0, saturday: 0, sunday: 0,
  })

  const totalHours = Object.values(hoursPerDay).reduce((sum, h) => sum + h, 0)

  // Get Monday of current week
  const getWeekStartDate = (date: Date = new Date()): string => {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(d.setDate(diff))
    const year = monday.getFullYear()
    const month = String(monday.getMonth() + 1).padStart(2, '0')
    const dayOfMonth = String(monday.getDate()).padStart(2, '0')
    return `${year}-${month}-${dayOfMonth}`
  }

  // Get dates for each day of the week
  const getWeekDates = (): Date[] => {
    if (!currentWeekStart) return []
    const [year, month, day] = currentWeekStart.split('-').map(Number)
    const startDate = new Date(year, month - 1, day)
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(startDate)
      date.setDate(startDate.getDate() + i)
      return date
    })
  }

  const weekDates = getWeekDates()

  const formatWeekDisplay = (weekStart: string): string => {
    const [year, month, day] = weekStart.split('-').map(Number)
    const start = new Date(year, month - 1, day)
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
    return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}, ${start.getFullYear()}`
  }

  const navigateWeek = (direction: 'prev' | 'next') => {
    const [year, month, day] = currentWeekStart.split('-').map(Number)
    const current = new Date(year, month - 1, day)
    current.setDate(current.getDate() + (direction === 'next' ? 7 : -7))
    setCurrentWeekStart(getWeekStartDate(current))
  }

  const setDayHours = (day: string, value: string) => {
    const num = parseFloat(value)
    if (isNaN(num)) {
      setHoursPerDay(prev => ({ ...prev, [day]: 0 }))
    } else {
      setHoursPerDay(prev => ({ ...prev, [day]: Math.min(24, Math.max(0, num)) }))
    }
  }

  // Quick-set presets
  const setPreset = (preset: 'clear' | '9to5' | '8h' | '6h') => {
    const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
    const newHours: Record<string, number> = { monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0, sunday: 0 }

    if (preset === '9to5' || preset === '8h') {
      weekdays.forEach(d => { newHours[d] = 8 })
    } else if (preset === '6h') {
      weekdays.forEach(d => { newHours[d] = 6 })
    }

    setHoursPerDay(newHours)
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
    void checkPermissions()
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

        if (data.success && data.availability?.schedule_data) {
          const scheduleData = data.availability.schedule_data

          if (scheduleData.hoursPerDay) {
            setHoursPerDay({
              monday: Number(scheduleData.hoursPerDay.monday) || 0,
              tuesday: Number(scheduleData.hoursPerDay.tuesday) || 0,
              wednesday: Number(scheduleData.hoursPerDay.wednesday) || 0,
              thursday: Number(scheduleData.hoursPerDay.thursday) || 0,
              friday: Number(scheduleData.hoursPerDay.friday) || 0,
              saturday: Number(scheduleData.hoursPerDay.saturday) || 0,
              sunday: Number(scheduleData.hoursPerDay.sunday) || 0,
            })
          } else {
            // Legacy format: day names directly on schedule_data
            setHoursPerDay({
              monday: Number(scheduleData.monday) || 0,
              tuesday: Number(scheduleData.tuesday) || 0,
              wednesday: Number(scheduleData.wednesday) || 0,
              thursday: Number(scheduleData.thursday) || 0,
              friday: Number(scheduleData.friday) || 0,
              saturday: Number(scheduleData.saturday) || 0,
              sunday: Number(scheduleData.sunday) || 0,
            })
          }
        } else {
          // No record — default to 0 hours
          setHoursPerDay({
            monday: 0, tuesday: 0, wednesday: 0, thursday: 0,
            friday: 0, saturday: 0, sunday: 0,
          })
        }
      } catch {
        toast.error('Failed to load availability')
      } finally {
        setLoading(false)
      }
    }

    void loadAvailability()
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
          scheduleData: {
            hoursPerDay: hoursPerDay,
          },
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
    } catch {
      toast.error('Failed to save availability')
    } finally {
      setSaving(false)
    }
  }

  // Copy current week to next week
  const copyToNextWeek = async () => {
    const [year, month, day] = currentWeekStart.split('-').map(Number)
    const nextWeek = new Date(year, month - 1, day)
    nextWeek.setDate(nextWeek.getDate() + 7)
    const nextWeekStr = getWeekStartDate(nextWeek)

    setSaving(true)
    try {
      const response = await fetch('/api/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: targetUserId,
          weekStartDate: nextWeekStr,
          availableHours: totalHours,
          scheduleData: { hoursPerDay },
          notes: '',
        }),
      })
      const data = await response.json()
      if (data.success) {
        toast.success(`Copied to week of ${formatWeekDisplay(nextWeekStr)}`)
      } else {
        toast.error(data.error || 'Failed to copy')
      }
    } catch {
      toast.error('Failed to copy availability')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <div className="h-6 w-40 bg-muted rounded animate-pulse" />
              <div className="h-4 w-64 bg-muted/60 rounded animate-pulse mt-2" />
            </div>
            <div className="h-5 w-20 bg-muted rounded animate-pulse" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between bg-muted/30 rounded-lg p-4">
            <div className="h-8 w-24 bg-muted rounded animate-pulse" />
            <div className="h-5 w-40 bg-muted rounded animate-pulse" />
            <div className="h-8 w-24 bg-muted rounded animate-pulse" />
          </div>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-20 bg-muted/40 rounded animate-pulse" />
            ))}
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
              Set your available hours for each day
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="font-semibold text-primary">{totalHours}h</span>
            <span className="text-muted-foreground">/ week</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Week Navigation */}
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => navigateWeek('prev')} className="gap-1">
            <ChevronLeft className="w-4 h-4" /> Prev
          </Button>
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{formatWeekDisplay(currentWeekStart)}</span>
            <Button variant="ghost" size="sm" onClick={() => setCurrentWeekStart(getWeekStartDate())}>
              Today
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigateWeek('next')} className="gap-1">
            Next <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Day inputs */}
        <div className="grid grid-cols-7 gap-2">
          {DAYS.map((day, idx) => {
            const isWeekend = day === 'saturday' || day === 'sunday'
            const dateNum = weekDates[idx]?.getDate()
            return (
              <div
                key={day}
                className={`rounded-lg border p-3 text-center space-y-2 ${
                  isWeekend ? 'bg-muted/30' : 'bg-background'
                } ${hoursPerDay[day] > 0 ? 'border-primary/40' : 'border-border'}`}
              >
                <div className="text-xs font-medium text-muted-foreground">{DAY_LABELS[idx]}</div>
                {dateNum && (
                  <div className="text-sm font-semibold">{dateNum}</div>
                )}
                <Input
                  type="number"
                  min={0}
                  max={24}
                  step={0.5}
                  value={hoursPerDay[day] || ''}
                  onChange={(e) => setDayHours(day, e.target.value)}
                  onFocus={(e) => e.target.select()}
                  disabled={!canEdit}
                  className="text-center h-9 text-sm font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="0"
                />
                <div className="text-xs text-muted-foreground">hrs</div>
              </div>
            )
          })}
        </div>

        {/* Presets */}
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground mr-1">Quick set:</span>
            <Button variant="outline" size="sm" onClick={() => setPreset('9to5')} className="text-xs h-7">
              8h weekdays
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPreset('6h')} className="text-xs h-7">
              6h weekdays
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPreset('clear')} className="text-xs h-7">
              Clear all
            </Button>
          </div>
        )}

        {/* Actions */}
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button variant="outline" onClick={copyToNextWeek} disabled={saving} className="gap-2">
              <Copy className="w-4 h-4" />
              Copy to next week
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
