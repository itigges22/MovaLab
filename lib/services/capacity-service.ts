/**
 * Capacity Service
 * Calculates and provides capacity metrics across users, departments, and organization
 */

import { createClientSupabase } from '../supabase';
import type { AppSupabaseClient } from '../supabase';
import { availabilityService } from './availability-service';
import { DEFAULT_WEEKLY_HOURS } from '../constants';
import { logger } from '../debug-logger';


export interface UserCapacityMetrics {
  userId: string;
  userName: string;
  userEmail: string;
  weekStartDate: string;
  availableHours: number;
  allocatedHours: number;
  actualHours: number;
  utilizationRate: number; // Percentage
  remainingCapacity: number;
}

export interface DepartmentCapacityMetrics {
  departmentId: string;
  departmentName: string;
  weekStartDate: string;
  teamSize: number;
  totalAvailableHours: number;
  totalAllocatedHours: number;
  totalActualHours: number;
  utilizationRate: number;
  remainingCapacity: number;
  userMetrics: UserCapacityMetrics[];
}

export interface ProjectCapacityMetrics {
  projectId: string;
  projectName: string;
  accountId: string;
  weekStartDate: string;
  assignedUsers: number;
  allocatedHours: number;
  actualHours: number;
  totalEstimatedHours: number | null;
  progressPercentage: number;
}

export interface OrgCapacityMetrics {
  weekStartDate: string;
  totalUsers: number;
  totalAvailableHours: number;
  totalAllocatedHours: number;
  totalActualHours: number;
  avgUtilizationRate: number;
  totalRemainingCapacity: number;
  departmentMetrics: DepartmentCapacityMetrics[];
}

class CapacityService {
  /**
   * Get capacity metrics for a single user for a specific week
   */
  async getUserCapacityMetrics(
    userId: string,
    weekStartDate: string,
    supabaseClient?: AppSupabaseClient | null
  ): Promise<UserCapacityMetrics | null> {
    const supabase = supabaseClient || createClientSupabase();
    if (!supabase) return null;

    // OPTIMIZATION: Calculate week end date once
    const weekEnd = new Date(weekStartDate);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekEndStr = weekEnd.toISOString().split('T')[0];

    // OPTIMIZATION: Parallelize all independent queries (Phase 1)
    const [
      { data: userProfile, error: userError },
      { data: availability },
      { data: allocations, error: allocError },
      { data: projectAssignments },
      { data: assignedTasks },
      { data: timeEntries }
    ] = await Promise.all([
      supabase
        .from('user_profiles')
        .select('id, name, email')
        .eq('id', userId)
        .single(),
      supabase
        .from('user_availability')
        .select('available_hours')
        .eq('user_id', userId)
        .eq('week_start_date', weekStartDate)
        .single(),
      supabase
        .from('task_week_allocations')
        .select('allocated_hours')
        .eq('assigned_user_id', userId)
        .eq('week_start_date', weekStartDate),
      supabase
        .from('project_assignments')
        .select('project_id')
        .eq('user_id', userId)
        .is('removed_at', null),
      supabase
        .from('tasks')
        .select('remaining_hours, estimated_hours, status')
        .eq('assigned_to', userId),
      supabase
        .from('time_entries')
        .select('hours_logged')
        .eq('user_id', userId)
        .gte('entry_date', weekStartDate)
        .lte('entry_date', weekEndStr)
    ]);

    if (userError || !userProfile) {
      logger.error('Error fetching user profile', {}, userError as Error);
      return null;
    }

    // Default to 40 hours/week if no availability is set
    // Note: Proportional capacity split (dividing by account count) is handled
    // at the account level in /api/capacity/account/route.ts. User-level metrics
    // correctly show full available hours.
    const availableHours = availability?.available_hours ?? DEFAULT_WEEKLY_HOURS;

    const weekAllocatedHours = allocError || !allocations
      ? 0
      : allocations.reduce((sum: number, a: any) => sum + (a.allocated_hours || 0), 0);

    let projectAllocatedHours = 0;

    // OPTIMIZATION: If project assignments exist, fetch projects and tasks in parallel (Phase 2)
    if (projectAssignments && projectAssignments.length > 0) {
      const projectIds = projectAssignments.map((pa: any) => pa.project_id);

      const [
        { data: projects },
        { data: projectTasks }
      ] = await Promise.all([
        supabase
          .from('projects')
          .select('id, estimated_hours, status')
          .in('id', projectIds)
          .not('status', 'eq', 'complete'),
        supabase
          .from('tasks')
          .select('project_id, remaining_hours, estimated_hours, status, assigned_to')
          .in('project_id', projectIds)
      ]);

      // Calculate hours per project — only count tasks assigned to THIS user
      if (projects) {
        for (const project of projects) {
          // Get tasks assigned to this user in this project
          const tasksForProject = projectTasks?.filter((t: any) =>
            t.project_id === project.id &&
            t.assigned_to === userId &&
            t.status !== 'done' &&
            t.status !== 'complete'
          ) || [];

          // Sum remaining hours from user's tasks in this project
          if (tasksForProject.length > 0) {
            const taskHours = tasksForProject.reduce((sum: number, t: any) => {
              const hours = t.remaining_hours ?? t.estimated_hours ?? 0;
              return sum + hours;
            }, 0);
            projectAllocatedHours += taskHours;
          }
        }
      }
    }

    const taskAllocatedHours = assignedTasks
      ? assignedTasks
          .filter((t: any) => t.status !== 'done' && t.status !== 'complete')
          .reduce((sum: number, t: any) => {
            const hours = t.remaining_hours ?? t.estimated_hours ?? 0;
            return sum + hours;
          }, 0)
      : 0;

    // Use weekly allocations if available (most accurate), otherwise fall back to task-level data
    const allocatedHours = weekAllocatedHours > 0
      ? weekAllocatedHours
      : taskAllocatedHours;

    const actualHours = timeEntries
      ? timeEntries.reduce((sum: number, e: any) => sum + (e.hours_logged || 0), 0)
      : 0;

    // Calculate metrics
    const utilizationRate = availableHours > 0
      ? Math.round((actualHours / availableHours) * 100)
      : 0;

    const remainingCapacity = availableHours - actualHours;

    return {
      userId: userProfile.id,
      userName: userProfile.name || 'Unknown',
      userEmail: userProfile.email || '',
      weekStartDate,
      availableHours,
      allocatedHours,
      actualHours,
      utilizationRate,
      remainingCapacity,
    };
  }

  /**
   * Get capacity metrics for a department for a specific week
   */
  async getDepartmentCapacityMetrics(
    departmentId: string,
    weekStartDate: string,
    supabaseClient?: AppSupabaseClient | null
  ): Promise<DepartmentCapacityMetrics | null> {
    const supabase = supabaseClient || createClientSupabase();
    if (!supabase) return null;

    // OPTIMIZATION: Parallelize department info and user roles queries
    const [
      { data: department, error: deptError },
      { data: userRoles, error: rolesError }
    ] = await Promise.all([
      supabase
        .from('departments')
        .select('id, name')
        .eq('id', departmentId)
        .single(),
      supabase
        .from('user_roles')
        .select('user_id, roles!inner(department_id)')
        .eq('roles.department_id', departmentId)
    ]);

    if (deptError || !department) {
      logger.error('Error fetching department', {}, deptError as Error);
      return null;
    }

    if (rolesError || !userRoles) {
      logger.error('Error fetching department users', {}, rolesError as Error);
      return null;
    }

    const userIds = Array.from(new Set<string>(userRoles.map((ur: any) => ur.user_id as string)));

    // Get metrics for each user
    const userMetricsPromises = userIds.map(userId =>
      this.getUserCapacityMetrics(userId, weekStartDate, supabase)
    );

    const userMetrics = (await Promise.all(userMetricsPromises)).filter(
      m => m !== null
    ) as UserCapacityMetrics[];

    // Aggregate department metrics
    const totalAvailableHours = userMetrics.reduce((sum, m) => sum + m.availableHours, 0);
    const totalAllocatedHours = userMetrics.reduce((sum, m) => sum + m.allocatedHours, 0);
    const totalActualHours = userMetrics.reduce((sum, m) => sum + m.actualHours, 0);

    const utilizationRate = totalAvailableHours > 0
      ? Math.round((totalActualHours / totalAvailableHours) * 100)
      : 0;

    const remainingCapacity = totalAvailableHours - totalActualHours;

    return {
      departmentId: department.id,
      departmentName: department.name || 'Unknown',
      weekStartDate,
      teamSize: userMetrics.length,
      totalAvailableHours,
      totalAllocatedHours,
      totalActualHours,
      utilizationRate,
      remainingCapacity,
      userMetrics,
    };
  }

  /**
   * Get capacity metrics for a project for a specific week
   */
  async getProjectCapacityMetrics(
    projectId: string,
    weekStartDate: string,
    supabaseClient?: AppSupabaseClient | null
  ): Promise<ProjectCapacityMetrics | null> {
    const supabase = supabaseClient || createClientSupabase();
    if (!supabase) return null;

    // OPTIMIZATION: Calculate week end date once
    const weekEnd = new Date(weekStartDate);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekEndStr = weekEnd.toISOString().split('T')[0];

    // OPTIMIZATION: Parallelize project info and tasks queries
    const [
      { data: project, error: projError },
      { data: tasks, error: tasksError }
    ] = await Promise.all([
      supabase
        .from('projects')
        .select('id, name, account_id, estimated_hours')
        .eq('id', projectId)
        .single(),
      supabase
        .from('tasks')
        .select('id')
        .eq('project_id', projectId)
    ]);

    if (projError || !project) {
      logger.error('Error fetching project', {}, projError as Error);
      return null;
    }

    if (tasksError || !tasks) {
      return {
        projectId: project.id,
        projectName: project.name || 'Unknown',
        accountId: project.account_id,
        weekStartDate,
        assignedUsers: 0,
        allocatedHours: 0,
        actualHours: 0,
        totalEstimatedHours: project.estimated_hours,
        progressPercentage: 0,
      };
    }

    const taskIds = tasks.map((t: any) => t.id);

    // OPTIMIZATION: Parallelize allocations and time entries queries
    const [
      { data: allocations, error: allocError },
      { data: timeEntries }
    ] = await Promise.all([
      supabase
        .from('task_week_allocations')
        .select('allocated_hours, assigned_user_id')
        .in('task_id', taskIds)
        .eq('week_start_date', weekStartDate),
      supabase
        .from('time_entries')
        .select('hours_logged')
        .eq('project_id', projectId)
        .gte('entry_date', weekStartDate)
        .lte('entry_date', weekEndStr)
    ]);

    const allocatedHours = allocError || !allocations
      ? 0
      : allocations.reduce((sum: number, a: any) => sum + (a.allocated_hours || 0), 0);

    const assignedUsers = allocations
      ? new Set(allocations.map((a: any) => a.assigned_user_id).filter(Boolean)).size
      : 0;

    const actualHours = timeEntries
      ? timeEntries.reduce((sum: number, e: any) => sum + (e.hours_logged || 0), 0)
      : 0;

    // Calculate progress
    const totalEstimatedHours = project.estimated_hours;
    const progressPercentage = totalEstimatedHours && totalEstimatedHours > 0
      ? Math.round((actualHours / totalEstimatedHours) * 100)
      : 0;

    return {
      projectId: project.id,
      projectName: project.name || 'Unknown',
      accountId: project.account_id,
      weekStartDate,
      assignedUsers,
      allocatedHours,
      actualHours,
      totalEstimatedHours,
      progressPercentage,
    };
  }

  /**
   * Get organization-wide capacity metrics for a specific week
   */
  async getOrgCapacityMetrics(weekStartDate: string, supabaseClient?: AppSupabaseClient | null): Promise<OrgCapacityMetrics | null> {
    const supabase = supabaseClient || createClientSupabase();
    if (!supabase) return null;

    // Get all departments
    const { data: departments, error: deptsError } = await supabase
      .from('departments')
      .select('id');

    if (deptsError || !departments) {
      logger.error('Error fetching departments', {}, deptsError as Error);
      return null;
    }

    // Get metrics for each department
    const departmentMetricsPromises = departments.map((dept: any) =>
      this.getDepartmentCapacityMetrics(dept.id, weekStartDate, supabase)
    );

    const departmentMetrics = (await Promise.all(departmentMetricsPromises)).filter(
      m => m !== null
    ) as DepartmentCapacityMetrics[];

    // Aggregate org metrics
    const totalUsers = departmentMetrics.reduce((sum, d) => sum + d.teamSize, 0);
    const totalAvailableHours = departmentMetrics.reduce((sum, d) => sum + d.totalAvailableHours, 0);
    const totalAllocatedHours = departmentMetrics.reduce((sum, d) => sum + d.totalAllocatedHours, 0);
    const totalActualHours = departmentMetrics.reduce((sum, d) => sum + d.totalActualHours, 0);

    const avgUtilizationRate = totalAvailableHours > 0
      ? Math.round((totalActualHours / totalAvailableHours) * 100)
      : 0;

    const totalRemainingCapacity = totalAvailableHours - totalActualHours;

    return {
      weekStartDate,
      totalUsers,
      totalAvailableHours,
      totalAllocatedHours,
      totalActualHours,
      avgUtilizationRate,
      totalRemainingCapacity,
      departmentMetrics,
    };
  }

  /**
   * Get capacity trend for a user over multiple weeks
   */
  async getUserCapacityTrend(
    userId: string,
    numberOfWeeks: number = 8
  ): Promise<UserCapacityMetrics[]> {
    const weeks: string[] = [];
    const today = new Date();

    for (let i = numberOfWeeks - 1; i >= 0; i--) {
      const weekDate = new Date(today);
      weekDate.setDate(weekDate.getDate() - (i * 7));
      weeks.push(availabilityService.getWeekStartDate(weekDate));
    }

    const metricsPromises = weeks.map((week: any) =>
      this.getUserCapacityMetrics(userId, week)
    );

    const metrics = await Promise.all(metricsPromises);
    return metrics.filter((m: any) => m !== null) as UserCapacityMetrics[];
  }

  /**
   * Get capacity trend for a department over multiple weeks
   */
  async getDepartmentCapacityTrend(
    departmentId: string,
    numberOfWeeks: number = 8
  ): Promise<DepartmentCapacityMetrics[]> {
    const weeks: string[] = [];
    const today = new Date();

    for (let i = numberOfWeeks - 1; i >= 0; i--) {
      const weekDate = new Date(today);
      weekDate.setDate(weekDate.getDate() - (i * 7));
      weeks.push(availabilityService.getWeekStartDate(weekDate));
    }

    const metricsPromises = weeks.map((week: any) =>
      this.getDepartmentCapacityMetrics(departmentId, week)
    );

    const metrics = await Promise.all(metricsPromises);
    return metrics.filter((m: any) => m !== null) as DepartmentCapacityMetrics[];
  }
}

// Export singleton instance
export const capacityService = new CapacityService();

