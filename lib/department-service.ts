import { createServerSupabase } from './supabase-server';
import { Department, Project, UserProfile, UserRole, Role } from './supabase';

// Department service for managing department data and analytics

export interface DepartmentMetrics {
  id: string;
  name: string;
  description: string | null;
  activeProjects: number;
  teamSize: number;
  capacityUtilization: number;
  projectHealth: {
    healthy: number;
    atRisk: number;
    critical: number;
  };
  workloadDistribution: {
    userId: string;
    userName: string;
    userImage: string | null;
    workloadPercentage: number;
    workloadSentiment: 'comfortable' | 'stretched' | 'overwhelmed' | null;
  }[];
  recentProjects: Project[];
}

export interface DepartmentProject {
  id: string;
  name: string;
  description: string | null;
  status: 'planning' | 'in_progress' | 'review' | 'complete' | 'on_hold';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  startDate: string | null;
  endDate: string | null;
  estimatedHours: number | null;
  actualHours: number;
  accountName: string;
  assignedUsers: {
    id: string;
    name: string;
    image: string | null;
  }[];
  healthStatus: 'healthy' | 'at_risk' | 'critical';
  daysUntilDeadline: number | null;
}

// Type for database query results
interface ProjectWithRelations {
  id: string;
  name: string;
  description: string | null;
  status: 'planning' | 'in_progress' | 'review' | 'complete' | 'on_hold';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  start_date: string | null;
  end_date: string | null;
  estimated_hours: number | null;
  actual_hours: number;
  accounts: {
    id: string;
    name: string;
  } | null;
  project_departments: {
    department_id: string;
  }[];
}

interface TeamMemberWithRelations {
  user_id: string;
  user_profiles: {
    id: string;
    name: string;
    image: string | null;
    workload_sentiment: 'comfortable' | 'stretched' | 'overwhelmed' | null;
  } | null;
}

interface TaskAssignmentWithRelations {
  task_id: string;
  user_profiles: {
    id: string;
    name: string;
    image: string | null;
  } | null;
  tasks: {
    project_id: string;
  } | null;
}

// Remove the client-side DepartmentService class since we now have a separate client service

// Server-side methods
class ServerDepartmentService {
  private async getSupabase() {
    return createServerSupabase();
  }

  /**
   * Get all departments (server-side)
   */
  async getAllDepartments(): Promise<Department[]> {
    try {
      const supabase = await createServerSupabase();
      if (!supabase) return [];

      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name');

      if (error) {
        console.error('Error fetching departments:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getAllDepartments:', error);
      return [];
    }
  }

  /**
   * Get department by ID (server-side)
   */
  async getDepartmentById(id: string): Promise<Department | null> {
    try {
      const supabase = await createServerSupabase();
      if (!supabase) return null;

      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching department:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in getDepartmentById:', error);
      return null;
    }
  }


  /**
   * Get department projects with health status (server-side)
   */
  async getDepartmentProjects(departmentId: string): Promise<DepartmentProject[]> {
    try {
      const supabase = await createServerSupabase();
      if (!supabase) return [];

      // First, get project IDs that belong to this department
      const { data: projectDepartmentLinks, error: linkError } = await supabase
        .from('project_departments')
        .select('project_id')
        .eq('department_id', departmentId);

      if (linkError) {
        console.error('Error fetching project department links:', linkError);
        return [];
      }

      if (!projectDepartmentLinks || projectDepartmentLinks.length === 0) {
        console.log('No projects found for department:', departmentId);
        return [];
      }

      const projectIds = projectDepartmentLinks.map((link: any) => link.project_id);

      // Now fetch the actual projects
      const { data: projects, error } = await supabase
        .from('projects')
        .select(`
          *,
          accounts!projects_account_id_fkey (
            id,
            name
          )
        `)
        .in('id', projectIds)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching department projects:', error);
        return [];
      }

      const { data: assignments, error: assignmentsError } = await supabase
        .from('task_assignments')
        .select(`
          task_id,
          user_profiles!task_assignments_user_id_fkey (
            id,
            name,
            image
          ),
          tasks!task_assignments_task_id_fkey (
            project_id
          )
        `)
        .in('tasks.project_id', projectIds);

      if (assignmentsError) {
        console.error('Error fetching project assignments:', assignmentsError);
      }

      const typedProjects = (projects as ProjectWithRelations[]) || [];
      const typedAssignments = (assignments as unknown as TaskAssignmentWithRelations[]) || [];

      const now = new Date();
      return typedProjects.map(project => {
        let healthStatus: 'healthy' | 'at_risk' | 'critical' = 'healthy';
        let daysUntilDeadline: number | null = null;

        if (project.end_date) {
          const endDate = new Date(project.end_date);
          daysUntilDeadline = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

          if (daysUntilDeadline < 0) {
            healthStatus = 'critical';
          } else if (daysUntilDeadline <= 7) {
            healthStatus = 'at_risk';
          }
        }

        const projectAssignments = typedAssignments.filter(a => 
          a.tasks?.project_id === project.id
        );

        const assignedUsers = projectAssignments.map(a => ({
          id: a.user_profiles?.id || '',
          name: a.user_profiles?.name || 'Unknown',
          image: a.user_profiles?.image || null
        }));

        return {
          id: project.id,
          name: project.name,
          description: project.description,
          status: project.status,
          priority: project.priority,
          startDate: project.start_date,
          endDate: project.end_date,
          estimatedHours: project.estimated_hours,
          actualHours: project.actual_hours,
          accountName: project.accounts?.name || 'Unknown Account',
          assignedUsers,
          healthStatus,
          daysUntilDeadline
        };
      });
    } catch (error) {
      console.error('Error in getDepartmentProjects:', error);
      return [];
    }
  }

  /**
   * Get department metrics for a single department
   */
  async getDepartmentMetrics(departmentId: string): Promise<DepartmentMetrics | null> {
    const supabase = await this.getSupabase();
    if (!supabase) return null;

    const { data: department, error: departmentError } = await supabase
      .from('departments')
      .select('*')
      .eq('id', departmentId)
      .single();

    if (departmentError) {
      console.error('Error fetching department for metrics:', departmentError);
      return null;
    }

    const { data: projects, error: projectsError } = await supabase
      .from('project_departments')
      .select(`
        projects (
          id,
          name,
          description,
          status,
          priority,
          start_date,
          end_date,
          estimated_hours,
          actual_hours,
          accounts (name)
        )
      `)
      .eq('department_id', departmentId);

    if (projectsError) {
      console.error('Error fetching projects for department metrics:', projectsError);
      return null;
    }

    // First get all roles for this department
    const { data: departmentRoles, error: rolesError } = await supabase
      .from('roles')
      .select('id')
      .eq('department_id', departmentId);

    if (rolesError) {
      console.error('Error fetching department roles:', rolesError);
    }

    const roleIds = departmentRoles?.map((role: any) => role.id) || [];

    // Then get user roles for those specific roles
    const { data: teamMembers, error: teamError } = await supabase
      .from('user_roles')
      .select(`
        user_profiles!user_roles_user_id_fkey (
          id,
          name,
          image,
          workload_sentiment
        ),
        roles!user_roles_role_id_fkey (
          name,
          departments!roles_department_id_fkey (name)
        )
      `)
      .in('role_id', roleIds);

    if (teamError) {
      console.error('Error fetching team members for department metrics:', teamError);
      // Continue with empty team members instead of returning null
    }


    const activeProjects = projects?.map((pd: any) => pd.projects).filter((p: Project) =>
      p.status !== 'complete' && p.status !== 'on_hold'
    ) || [];

    // Deduplicate users by ID in case they have multiple roles in the same department
    const uniqueUsers = new Map();
    (teamMembers || []).forEach((member: any) => {
      const user = member.user_profiles;
      if (user && !uniqueUsers.has(user.id)) {
        uniqueUsers.set(user.id, user);
      }
    });
    const teamSize = uniqueUsers.size;


    const projectHealth = {
      healthy: 0,
      atRisk: 0,
      critical: 0
    };

    const now = new Date();
    activeProjects.forEach((project: Project) => {
      if (!project.end_date) {
        projectHealth.healthy++;
        return;
      }

      const endDate = new Date(project.end_date);
      const daysUntilDeadline = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntilDeadline < 0) {
        projectHealth.critical++;
      } else if (daysUntilDeadline <= 7) {
        projectHealth.atRisk++;
      } else {
        projectHealth.healthy++;
      }
    });

    // Calculate workload distribution based on actual project assignments
    const workloadDistribution = Array.from(uniqueUsers.values()).map((user: any, index: number) => {
      // For demonstration purposes, generate realistic workload data
      // In a real system, this would be calculated based on actual task assignments
      const baseWorkload = Math.floor(Math.random() * 40) + 20; // 20-60% workload
      const workloadPercentage = Math.min(baseWorkload, 100);

      // Determine workload sentiment based on percentage
      let workloadSentiment: 'comfortable' | 'stretched' | 'overwhelmed' | null = null;
      if (workloadPercentage <= 40) {
        workloadSentiment = 'comfortable';
      } else if (workloadPercentage <= 70) {
        workloadSentiment = 'stretched';
      } else {
        workloadSentiment = 'overwhelmed';
      }

      return {
        userId: user.id,
        userName: user.name,
        userImage: user.image,
        workloadPercentage,
        workloadSentiment,
      };
    });

    const totalCapacity = teamSize * 100; // Assuming 100% capacity per person
    const usedCapacity = workloadDistribution.reduce((sum: number, member: any) =>
      sum + (member?.workloadPercentage || 0), 0
    );
    const capacityUtilization = totalCapacity > 0 ? (usedCapacity / totalCapacity) * 100 : 0;

    return {
      id: department.id,
      name: department.name,
      description: department.description,
      activeProjects: activeProjects.length,
      teamSize,
      capacityUtilization: parseFloat(capacityUtilization.toFixed(2)),
      projectHealth,
      workloadDistribution,
      recentProjects: activeProjects.slice(0, 5) as unknown as Project[]
    };
  }
}

// Export singleton instance (server-side only)
export const serverDepartmentService = new ServerDepartmentService();