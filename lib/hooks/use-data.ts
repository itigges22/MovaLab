'use client'

import useSWR from 'swr'
import { TimePeriod } from '@/components/capacity-trend-chart'

/**
 * Optimized data fetching hooks using SWR
 * - Automatic request deduplication
 * - Smart caching with revalidation
 * - Parallel fetching
 */

// Capacity history hook
export function useCapacityHistory(userId: string | undefined, period: TimePeriod) {
  const { data, error, isLoading, mutate } = useSWR(
    userId ? `/api/capacity/history?userId=${userId}&period=${period}` : null
  )

  return {
    data: data?.data || [],
    error,
    isLoading,
    mutate,
    success: data?.success ?? false
  }
}

// Organization capacity hook
export function useOrganizationCapacity(period: TimePeriod) {
  const { data, error, isLoading, mutate } = useSWR(
    `/api/capacity/organization?period=${period}`
  )

  return {
    data: data?.data || [],
    error,
    isLoading,
    mutate,
    success: data?.success ?? false
  }
}

// Department capacity hook
export function useDepartmentCapacity(departmentId: string | undefined, period: TimePeriod) {
  const { data, error, isLoading, mutate } = useSWR(
    departmentId ? `/api/capacity/department?departmentId=${departmentId}&period=${period}` : null
  )

  return {
    data: data?.data || [],
    error,
    isLoading,
    mutate,
    success: data?.success ?? false
  }
}

// Account capacity hook
export function useAccountCapacity(accountId: string | undefined, period: TimePeriod) {
  const { data, error, isLoading, mutate } = useSWR(
    accountId ? `/api/capacity/account?accountId=${accountId}&period=${period}` : null
  )

  return {
    data: data?.data || [],
    error,
    isLoading,
    mutate,
    success: data?.success ?? false
  }
}

// Clock status hook
// Pass enabled=false to disable fetching (e.g., when not authenticated)
export function useClockStatus(enabled: boolean = true) {
  const { data, error, isLoading, mutate } = useSWR(
    enabled ? '/api/clock' : null,
    {
      // Refresh every 30 seconds
      refreshInterval: 30000
    }
  )

  return {
    // API returns isClockedIn and session, map to clockedIn and currentSession
    clockedIn: data?.isClockedIn ?? false,
    currentSession: data?.session ?? null,
    error,
    isLoading: enabled ? isLoading : false,
    mutate
  }
}

// Projects hook
export function useProjects(userId: string | undefined, limit: number = 10) {
  const { data, error, isLoading, mutate } = useSWR(
    userId ? `/api/projects?userId=${userId}&limit=${limit}` : null
  )

  return {
    projects: data?.projects || [],
    error,
    isLoading,
    mutate
  }
}
