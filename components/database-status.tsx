'use client'

import { useState, useEffect } from 'react'
import { checkDatabaseSchema, testUserProfileCreation } from '@/lib/database-check'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function DatabaseStatus() {
  const [status, setStatus] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null)

  const checkDatabase = async () => {
    setLoading(true)
    try {
      const result = await checkDatabaseSchema()
      setStatus(result)
    } catch (_error: unknown) {
      setStatus({
        success: false,
        error: 'Failed to check database',
        details: []
      })
    } finally {
      setLoading(false)
    }
  }

  const testProfileCreation = async () => {
    setLoading(true)
    try {
      const result = await testUserProfileCreation(
        'test-user-' + Date.now(),
        'test@example.com',
        'Test User'
      )
      setTestResult(result)
    } catch (_error: unknown) {
      setTestResult({
        success: false,
        error: 'Test failed'
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void checkDatabase()
  }, [])

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Database Status</CardTitle>
          <CardDescription>
            Check if the database schema is properly set up
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button onClick={checkDatabase} disabled={loading}>
              {loading ? 'Checking...' : 'Check Database'}
            </Button>

            {status && (
              <div className="space-y-2">
                <div className={`p-3 rounded-md ${
                  status.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                }`}>
                  <strong>Status:</strong> {status.success ? '✅ All Good' : '❌ Issues Found'}
                </div>

                {(status.error as string | undefined) && (
                  <div className="p-3 bg-red-50 text-red-800 rounded-md">
                    <strong>Error:</strong> {String(status.error)}
                  </div>
                )}

                {(status.details as Array<Record<string, unknown>> | undefined) && (status.details as Array<Record<string, unknown>>).length > 0 && (
                  <div className="space-y-2">
                    <strong>Table Status:</strong>
                    {(status.details as Array<Record<string, unknown>>).map((detail: Record<string, unknown>, index: number) => (
                      <div key={index} className="p-2 border rounded-md">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            detail.exists ? 'bg-green-500' : 'bg-red-500'
                          }`}></span>
                          <span className="font-medium">{String(detail.table)}</span>
                          <span className={detail.exists ? 'text-green-600' : 'text-red-600'}>
                            {detail.exists ? 'Exists' : 'Missing'}
                          </span>
                        </div>
                        {(detail.error as string | undefined) && (
                          <div className="text-sm text-red-600 mt-1">
                            Error: {String(detail.error)}
                          </div>
                        )}
                        {(detail.suggestion as string | undefined) && (
                          <div className="text-sm text-blue-600 mt-1">
                            💡 {String(detail.suggestion)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="pt-4 border-t">
              <Button onClick={testProfileCreation} disabled={loading} variant="outline">
                {loading ? 'Testing...' : 'Test Profile Creation'}
              </Button>

              {testResult && (
                <div className="mt-4 p-3 rounded-md bg-gray-50">
                  <strong>Test Result:</strong>
                  <div className={`mt-2 ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                    {testResult.success ? '✅ Profile creation works' : '❌ Profile creation failed'}
                  </div>
                  {(testResult.error as string | undefined) && (
                    <div className="text-sm text-red-600 mt-1">
                      Error: {String(testResult.error)}
                    </div>
                  )}
                  {(testResult.suggestion as string | undefined) && (
                    <div className="text-sm text-blue-600 mt-1">
                      💡 {String(testResult.suggestion)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}