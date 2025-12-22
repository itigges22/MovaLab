'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, List, BarChart3 } from 'lucide-react';
import { TimeEntriesList } from '@/components/time-entries-list';
import { TimeEntriesSummary } from '@/components/time-entries-summary';
import { TimeEntriesChart } from '@/components/time-entries-chart';
import { RoleGuard } from '@/components/role-guard';

export default function TimeEntriesPage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('list');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !userProfile) {
    return null; // Will redirect to login
  }

  return (
    <RoleGuard allowUnassigned={true}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Time Entries</h1>
          <p className="text-gray-600 mt-2">
            View and manage your logged work hours across all projects
          </p>
        </div>

        {/* Summary Statistics Card */}
        <TimeEntriesSummary userProfile={userProfile} />

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="list" className="flex items-center gap-2">
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">List View</span>
            </TabsTrigger>
            <TabsTrigger value="chart" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Charts</span>
            </TabsTrigger>
          </TabsList>

          {/* List View Tab */}
          <TabsContent value="list" className="space-y-6">
            <TimeEntriesList userProfile={userProfile} />
          </TabsContent>

          {/* Charts Tab */}
          <TabsContent value="chart" className="space-y-6">
            <TimeEntriesChart userProfile={userProfile} />
          </TabsContent>
        </Tabs>

        {/* Quick Stats Footer */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Quick Tips
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-gray-600">
              <p>• You can edit or delete time entries within 14 days of logging them</p>
              <p>• Time entries are automatically associated with projects and tasks</p>
              <p>• Use the clock widget to easily log time as you work</p>
              <p>• Filter and export your time data using the controls above</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </RoleGuard>
  );
}
