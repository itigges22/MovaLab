'use client'

import { SWRConfig } from 'swr'
import { ReactNode } from 'react'

// Global fetcher with error handling
const fetcher = async (url: string) => {
  const res = await fetch(url)

  // Handle non-OK responses
  if (!res.ok) {
    const error = new Error('An error occurred while fetching the data.')
    // Attach extra info to the error object
    const info = await res.json().catch(() => ({ error: res.statusText }))
    Object.assign(error, { info, status: res.status })
    throw error
  }

  return res.json()
}

export function SWRProvider({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        // Dedupe requests within 2 seconds
        dedupingInterval: 2000,
        // Throttle focus revalidation to once per 60 seconds
        focusThrottleInterval: 60000,
        // DISABLED: revalidateOnFocus causes jarring refreshes when filling out forms
        // Data will still update via explicit mutations and periodic refetches
        revalidateOnFocus: false,
        // Revalidate on reconnect (after losing network connection)
        revalidateOnReconnect: true,
        // Don't revalidate stale data automatically
        revalidateIfStale: false,
        // Error retry configuration
        errorRetryCount: 2,
        errorRetryInterval: 5000,
        // Performance: Use cache immediately while revalidating in background
        suspense: false,
        // KEEP THIS TRUE: Required for initial data loading on component mount
        revalidateOnMount: true,
      }}
    >
      {children}
    </SWRConfig>
  )
}
