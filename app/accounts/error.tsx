'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle } from 'lucide-react'

export default function AccountsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log to error reporting service in production
  }, [error])

  return (
    <div className="flex items-center justify-center min-h-[50vh] p-6">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Failed to load accounts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            An error occurred while loading accounts. Please try again.
          </p>
          {process.env.NODE_ENV === 'development' && (
            <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-32">
              {error.message}
            </pre>
          )}
          <div className="flex gap-2">
            <Button onClick={reset} variant="default">
              Try again
            </Button>
            <Button onClick={() => window.location.href = '/welcome'} variant="outline">
              Go to dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
