'use client';


import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserWithRoles } from '@/lib/rbac';
import { createClientSupabase } from '@/lib/supabase';
import { format, subDays, parseISO } from 'date-fns';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface TimeEntriesChartProps {
  userProfile: UserWithRoles;
}

interface DailyData {
  date: string;
  hours: number;
}

interface ProjectData {
  name: string;
  hours: number;
  color: string;
  [key: string]: string | number;
}

const COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
];

export function TimeEntriesChart({ userProfile }: TimeEntriesChartProps) {
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [projectData, setProjectData] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChartData = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClientSupabase() as any;
      if (!supabase) return;

      const thirtyDaysAgo = subDays(new Date(), 30);
      const startDate = format(thirtyDaysAgo, 'yyyy-MM-dd');
      const endDate = format(new Date(), 'yyyy-MM-dd');

      // Fetch time entries for last 30 days
      const { data: entries } = await supabase
        .from('time_entries')
        .select('entry_date, hours_logged, project_id, projects(id, name)')
        .eq('user_id', (userProfile as any).id)
        .gte('entry_date', startDate)
        .lte('entry_date', endDate)
        .order('entry_date', { ascending: true });

      if (!entries) return;

      // Process daily data
      const dailyMap = new Map<string, number>();

      // Initialize all days with 0 hours
      for (let i = 0; i <= 30; i++) {
        const date = subDays(new Date(), 30 - i);
        const dateStr = format(date, 'yyyy-MM-dd');
        dailyMap.set(dateStr, 0);
      }

      // Aggregate hours by day
      entries.forEach((entry: { entry_date: string; hours_logged: number }) => {
        const currentHours = dailyMap.get(entry.entry_date) || 0;
        dailyMap.set(entry.entry_date, currentHours + (entry.hours_logged || 0));
      });

      // Convert to array for chart
      const dailyArray: DailyData[] = Array.from(dailyMap.entries()).map(([date, hours]) => ({
        date: format(parseISO(date), 'MMM dd'),
        hours: parseFloat(hours.toFixed(1)),
      }));

      setDailyData(dailyArray);

      // Process project data
      const projectMap = new Map<string, { name: string; hours: number }>();

      entries.forEach((entry: { project_id?: string; hours_logged: number; projects?: { name: string } }) => {
        const projectId = entry.project_id || 'unknown';
        const projectName = entry.projects?.name || 'No Project';

        const existing = projectMap.get(projectId);
        if (existing) {
          existing.hours += entry.hours_logged || 0;
        } else {
          projectMap.set(projectId, {
            name: projectName,
            hours: entry.hours_logged || 0,
          });
        }
      });

      // Convert to array and sort by hours (descending)
      const projectArray: ProjectData[] = Array.from(projectMap.values())
        .map((project:any, index:any) => ({
          name: project.name,
          hours: parseFloat(project.hours.toFixed(1)),
          color: COLORS[index % COLORS.length],
        }))
        .sort((a, b) => b.hours - a.hours);

      setProjectData(projectArray);

    } catch (error: unknown) {
      console.error('Error fetching chart data:', error);
    } finally {
      setLoading(false);
    }
  }, [userProfile]);

  useEffect(() => {
    fetchChartData();
  }, [fetchChartData]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-sm text-gray-500 mt-2">Loading charts...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalHours = projectData.reduce((sum, project) => sum + project.hours, 0);

  return (
    <div className="space-y-6">
      {/* Daily Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Time Trend</CardTitle>
          <CardDescription>Hours logged per day (last 30 days)</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                interval="preserveStartEnd"
              />
              <YAxis
                label={{ value: 'Hours', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                }}
              />
              <Line
                type="monotone"
                dataKey="hours"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: '#3b82f6', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Project Hours Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Hours by Project</CardTitle>
            <CardDescription>Total hours per project (last 30 days)</CardDescription>
          </CardHeader>
          <CardContent>
            {projectData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={projectData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                    height={100}
                  />
                  <YAxis
                    label={{ value: 'Hours', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                    }}
                  />
                  <Bar dataKey="hours" radius={[8, 8, 0, 0]}>
                    {projectData.map((entry:any, index:any) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-12 text-gray-500">
                No project data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Project Distribution Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Project Distribution</CardTitle>
            <CardDescription>
              Percentage breakdown ({totalHours.toFixed(1)} total hours)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {projectData.length > 0 ? (
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={projectData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) =>
                        `${name}: ${((percent || 0) * 100).toFixed(0)}%`
                      }
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="hours"
                    >
                      {projectData.map((entry:any, index:any) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                      }}
                      formatter={(value: number) => `${value.toFixed(1)} hours`}
                    />
                  </PieChart>
                </ResponsiveContainer>

                {/* Legend */}
                <div className="mt-4 grid grid-cols-2 gap-2 w-full">
                  {projectData.map((project:any, index:any) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: project.color }}
                      />
                      <span className="truncate">{project.name}</span>
                      <span className="text-gray-500 ml-auto">
                        {project.hours}h
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                No project data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Summary Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm font-medium text-blue-900">Most Active Project</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                {projectData.length > 0 ? projectData[0].name : 'N/A'}
              </p>
              <p className="text-xs text-blue-700 mt-1">
                {projectData.length > 0 ? `${projectData[0].hours} hours` : ''}
              </p>
            </div>

            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm font-medium text-green-900">Total Projects</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {projectData.length}
              </p>
              <p className="text-xs text-green-700 mt-1">Last 30 days</p>
            </div>

            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-sm font-medium text-purple-900">Average Daily Hours</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">
                {dailyData.length > 0
                  ? (totalHours / 30).toFixed(1)
                  : '0.0'}
              </p>
              <p className="text-xs text-purple-700 mt-1">Per day (30-day average)</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
