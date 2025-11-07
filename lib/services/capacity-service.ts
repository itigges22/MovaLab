/**
 * Capacity Service
 * Calculates and provides capacity metrics across users, departments, and organization
 */

import { createClientSupabase } from '../supabase';
import { availabilityService } from './availability-service';
import { timeEntryService } from './time-entry-service';

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
    weekStartDate: string
  ): Promise<UserCapacityMetrics | null> {
    const supabase = createClientSupabase();
    if (!supabase) return null;

    // Get user profile
    const { data: userProfile, error: userError } = await supabase
      .from('user_profiles')
      .select('id, name, email')
      .eq('id', userId)
      .single();

    if (userError || !userProfile) {
      console.error('Error fetching user profile:', userError);
      return null;
    }

    // Get availability
    const availability = await availabilityService.getUserAvailability(userId, weekStartDate);
    const availableHours = availability?.available_hours || 0;

    // Get allocated hours from task_week_allocations
    const { data: allocations, error: allocError } = await supabase
      .from('task_week_allocations')
      .select('allocated_hours')
      .eq('assigned_user_id', userId)
      .eq('week_start_date', weekStartDate);

    const allocatedHours = allocError || !allocations
      ? 0
      : allocations.reduce((sum: number, a: any) => sum + (a.allocated_hours || 0), 0);

    // Get actual hours from time_entries
    const { totalHours: actualHours } = await timeEntryService.getUserWeeklySummary(
      userId,
      weekStartDate
    );

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
    weekStartDate: string
  ): Promise<DepartmentCapacityMetrics | null> {
    const supabase = createClientSupabase();
    if (!supabase) return null;

    // Get department info
    const { data: department, error: deptError } = await supabase
      .from('departments')
      .select('id, name')
      .eq('id', departmentId)
      .single();

    if (deptError || !department) {
      console.error('Error fetching department:', deptError);
      return null;
    }

    // Get all users in the department
    const { data: userRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id, roles!inner(department_id)')
      .eq('roles.department_id', departmentId);

    if (rolesError || !userRoles) {
      console.error('Error fetching department users:', rolesError);
      return null;
    }

    const userIds = [...new Set(userRoles.map((ur: any) => ur.user_id as string))];

    // Get metrics for each user
    const userMetricsPromises = userIds.map(userId =>
      this.getUserCapacityMetrics(userId, weekStartDate)
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
    weekStartDate: string
  ): Promise<ProjectCapacityMetrics | null> {
    const supabase = createClientSupabase();
    if (!supabase) return null;

    // Get project info
    const { data: project, error: projError } = await supabase
      .from('projects')
      .select('id, name, account_id, estimated_hours')
      .eq('id', projectId)
      .single();

    if (projError || !project) {
      console.error('Error fetching project:', projError);
      return null;
    }

    // Get allocated hours from task_week_allocations
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id')
      .eq('project_id', projectId);

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

    const { data: allocations, error: allocError } = await supabase
      .from('task_week_allocations')
      .select('allocated_hours, assigned_user_id')
      .in('task_id', taskIds)
      .eq('week_start_date', weekStartDate);

    const allocatedHours = allocError || !allocations
      ? 0
      : allocations.reduce((sum: number, a: any) => sum + (a.allocated_hours || 0), 0);

    const assignedUsers = allocations
      ? new Set(allocations.map(a => a.assigned_user_id).filter(Boolean)).size
      : 0;

    // Get actual hours from time_entries
    const timeEntries = await timeEntryService.getProjectTimeEntries(projectId, weekStartDate);
    const actualHours = timeEntries.reduce((sum, e) => sum + (e.hours_logged || 0), 0);

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
  async getOrgCapacityMetrics(weekStartDate: string): Promise<OrgCapacityMetrics | null> {
    const supabase = createClientSupabase();
    if (!supabase) return null;

    // Get all departments
    const { data: departments, error: deptsError } = await supabase
      .from('departments')
      .select('id');

    if (deptsError || !departments) {
      console.error('Error fetching departments:', deptsError);
      return null;
    }

    // Get metrics for each department
    const departmentMetricsPromises = departments.map(dept =>
      this.getDepartmentCapacityMetrics(dept.id, weekStartDate)
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

    const metricsPromises = weeks.map(week =>
      this.getUserCapacityMetrics(userId, week)
    );

    const metrics = await Promise.all(metricsPromises);
    return metrics.filter(m => m !== null) as UserCapacityMetrics[];
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

    const metricsPromises = weeks.map(week =>
      this.getDepartmentCapacityMetrics(departmentId, week)
    );

    const metrics = await Promise.all(metricsPromises);
    return metrics.filter(m => m !== null) as DepartmentCapacityMetrics[];
  }
}

// Export singleton instance
export const capacityService = new CapacityService();

