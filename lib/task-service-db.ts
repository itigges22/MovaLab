

import { createClientSupabase } from './supabase';

type _TaskRow = any;
type TaskInsert = any;
type TaskUpdate = any;

// Task interface matching the database schema
export interface Task {
  id: string;
  name: string;
  description: string | null;
  project_id: string;
  status: 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  start_date: string | null;
  due_date: string | null;
  estimated_hours: number | null;
  remaining_hours: number | null;
  actual_hours: number;
  created_by: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  created_by_user?: {
    id: string;
    name: string;
    email: string;
  };
  assigned_to_user?: {
    id: string;
    name: string;
    email: string;
  };
  project?: {
    id: string;
    name: string;
  };
}

export interface CreateTaskData {
  name: string;
  description?: string | null;
  project_id: string;
  status?: 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'blocked';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  start_date?: string | null;
  due_date?: string | null;
  estimated_hours?: number | null;
  created_by: string;
  assigned_to?: string | null;
}

export interface UpdateTaskData {
  id: string;
  name?: string;
  description?: string | null;
  status?: 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'blocked';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  start_date?: string | null;
  due_date?: string | null;
  estimated_hours?: number | null;
  actual_hours?: number;
  assigned_to?: string | null;
}

class TaskServiceDB {
  private getSupabase() {
    const supabase = createClientSupabase() as any;
    if (!supabase) {
      throw new Error('Supabase client not available');
    }
    return supabase;
  }

  /**
   * Get all tasks for a specific project
   * Calculates actual_hours from time_entries instead of using stored value
   */
  async getTasksByProject(projectId: string): Promise<Task[]> {
    // Guard against invalid projectId
    if (!projectId || typeof projectId !== 'string') {
      console.warn('getTasksByProject called with invalid projectId:', projectId);
      return [];
    }

    try {
      const supabase = this.getSupabase();

      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          created_by_user:user_profiles!created_by(id, name, email),
          assigned_to_user:user_profiles!assigned_to(id, name, email),
          project:projects(id, name)
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching tasks:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          projectId
        });
        throw error;
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Get task IDs to fetch time entries
      const taskIds = data.map((t: { id: string }) => t.id);

      // Fetch time entries for all tasks in this project
      const { data: timeEntries, error: timeError } = await supabase
        .from('time_entries')
        .select('task_id, hours_logged')
        .in('task_id', taskIds);

      if (timeError) {
        console.error('Error fetching time entries:', {
          message: timeError.message,
          code: timeError.code,
          details: timeError.details,
          hint: timeError.hint,
          taskCount: taskIds.length
        });
        // Continue without time entries - use stored actual_hours
        return data.map(this.mapTaskRowToTask);
      }

      // Calculate sum of hours per task
      const hoursPerTask = new Map<string, number>();
      if (timeEntries) {
        for (const entry of timeEntries) {
          const typedEntry = entry as { task_id: string | null; hours_logged: number | null };
          if (typedEntry.task_id) {
            const current = hoursPerTask.get(typedEntry.task_id) || 0;
            hoursPerTask.set(typedEntry.task_id, current + (typedEntry.hours_logged || 0));
          }
        }
      }

      // Map tasks and override actual_hours with calculated value
      return data.map((row: any) => {
        const task = this.mapTaskRowToTask(row);
        // Use calculated hours from time entries
        task.actual_hours = hoursPerTask.get(task.id) || 0;
        return task;
      });
    } catch (error: unknown) {
      const err = error as { message?: string; code?: string; stack?: string };
      console.error('Error in getTasksByProject:', {
        message: err?.message || 'Unknown error',
        code: err?.code,
        projectId,
        stack: err?.stack?.slice(0, 500)
      });
      return [];
    }
  }

  /**
   * Get a single task by ID
   */
  async getTaskById(taskId: string): Promise<Task | null> {
    try {
      const supabase = this.getSupabase();
      
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          created_by_user:user_profiles!created_by(id, name, email),
          assigned_to_user:user_profiles!assigned_to(id, name, email),
          project:projects(id, name)
        `)
        .eq('id', taskId)
        .single();

      if (error) {
        console.error('Error fetching task:', error);
        return null;
      }

      return data ? this.mapTaskRowToTask(data) : null;
    } catch (error: unknown) {
      console.error('Error in getTaskById:', error);
      return null;
    }
  }

  /**
   * Create a new task
   */
  async createTask(data: CreateTaskData): Promise<Task | null> {
    try {
      const supabase = this.getSupabase();
      
      // Verify user session
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.error('Auth check failed in createTask:', {
          authError,
          hasUser: !!user
        });
        throw new Error('User not authenticated');
      }
      
      console.log('Creating task with user:', (user as any).id);
      console.log('Task creation data input:', data);
      
      const taskData: TaskInsert = {
        name: data.name,
        description: data.description || null,
        project_id: data.project_id,
        status: data.status || 'backlog',
        priority: data.priority || 'medium',
        start_date: data.start_date || null,
        due_date: data.due_date || null,
        estimated_hours: data.estimated_hours !== undefined ? data.estimated_hours : null,
        remaining_hours: data.estimated_hours !== undefined ? data.estimated_hours : null, // Initialize remaining_hours to estimated_hours
        actual_hours: 0,
        created_by: data.created_by,
        assigned_to: data.assigned_to || null,
      };

      console.log('Task data being inserted:', taskData);

      // Type assertion needed due to complex joined query
      const result = await (supabase as any)
        .from('tasks')
        .insert([taskData])
        .select(`
          *,
          created_by_user:user_profiles!created_by(id, name, email),
          assigned_to_user:user_profiles!assigned_to(id, name, email),
          project:projects(id, name)
        `)
        .single();

      const { data: newTask, error } = result as { data: Record<string, unknown> | null; error: any };

      if (error) {
        console.error('Error creating task:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          full: error
        });
        throw error;
      }

      console.log('New task from database:', newTask);
      const mappedTask = newTask ? this.mapTaskRowToTask(newTask as Record<string, unknown>) : null;
      console.log('Mapped new task:', mappedTask);

      return mappedTask;
    } catch (error: unknown) {
      const err = error as { message?: string; details?: string; hint?: string; code?: string; name?: string; stack?: string };
      console.error('Error in createTask:', {
        message: err?.message,
        details: err?.details,
        hint: err?.hint,
        code: err?.code,
        name: err?.name,
        stack: err?.stack
      });
      return null;
    }
  }

  /**
   * Update an existing task
   */
  async updateTask(data: UpdateTaskData): Promise<Task | null> {
    try {
      const supabase = this.getSupabase();

      const updateData: TaskUpdate = {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.status && { status: data.status }),
        ...(data.priority && { priority: data.priority }),
        ...(data.start_date !== undefined && { start_date: data.start_date }),
        ...(data.due_date !== undefined && { due_date: data.due_date }),
        ...(data.estimated_hours !== undefined && { estimated_hours: data.estimated_hours }),
        ...(data.actual_hours !== undefined && { actual_hours: data.actual_hours }),
        ...(data.assigned_to !== undefined && { assigned_to: data.assigned_to }),
        updated_at: new Date().toISOString(),
      };

      // If status is being set to 'done', calculate and set actual_hours
      if (data.status === 'done') {
        // First fetch current task to get estimated and remaining hours
        const { data: currentTask } = await supabase
          .from('tasks')
          .select('estimated_hours, remaining_hours')
          .eq('id', data.id)
          .single();

        if (currentTask) {
          const typedTask = currentTask as { estimated_hours: number | null; remaining_hours: number | null };
          const estimated = typedTask.estimated_hours || 0;
          const remaining = typedTask.remaining_hours ?? estimated;
          // actual_hours = estimated - remaining (how much work was done)
          updateData.actual_hours = Math.max(0, estimated - remaining);
          // Also set remaining to 0 since task is complete
          updateData.remaining_hours = 0;
          console.log(`Task ${data.id} marked done: actual_hours=${updateData.actual_hours} (estimated=${estimated}, remaining=${remaining})`);
        }
      }

      // Type assertion needed due to complex joined query
      const result = await (supabase as any)
        .from('tasks')
        .update(updateData)
        .eq('id', data.id)
        .select(`
          *,
          created_by_user:user_profiles!created_by(id, name, email),
          assigned_to_user:user_profiles!assigned_to(id, name, email),
          project:projects(id, name)
        `)
        .single();

      const { data: updatedTask, error } = result as { data: Record<string, unknown> | null; error: any };

      if (error) {
        console.error('Error updating task:', error);
        throw error;
      }

      return updatedTask ? this.mapTaskRowToTask(updatedTask) : null;
    } catch (error: unknown) {
      console.error('Error in updateTask:', error);
      return null;
    }
  }

  /**
   * Update remaining hours for a task
   * Automatically sets status to 'done' if remaining_hours is 0
   */
  async updateRemainingHours(taskId: string, remainingHours: number, estimatedHours: number | null): Promise<Task | null> {
    try {
      const supabase = this.getSupabase();
      
      console.log('updateRemainingHours called with:', {
        taskId,
        remainingHours,
        estimatedHours
      });
      
      // Validate remaining hours doesn't exceed estimated hours
      if (estimatedHours !== null && remainingHours > estimatedHours) {
        throw new Error(`Remaining hours (${remainingHours}) cannot exceed estimated hours (${estimatedHours})`);
      }
      
      // Prepare update data
      const updateData: TaskUpdate = {
        remaining_hours: remainingHours,
      };

      // If remaining hours is 0, automatically set status to 'done' and log actual hours
      if (remainingHours === 0) {
        updateData.status = 'done';
        // actual_hours = estimated - remaining (since remaining is 0, actual = estimated)
        updateData.actual_hours = estimatedHours || 0;
        console.log(`Task ${taskId} auto-completed: actual_hours=${updateData.actual_hours}`);
      }
      
      console.log('Updating task with data:', updateData);

      // Type assertion needed due to complex joined query
      const result = await (supabase as any)
        .from('tasks')
        .update(updateData)
        .eq('id', taskId)
        .select(`
          *,
          created_by_user:user_profiles!created_by(id, name, email),
          assigned_to_user:user_profiles!assigned_to(id, name, email),
          project:projects(id, name)
        `)
        .single();

      const { data: updatedTask, error } = result as { data: Record<string, unknown> | null; error: any };

      if (error) {
        console.error('Error updating remaining hours:', error);
        throw error;
      }

      console.log('Updated task from database:', updatedTask);
      const mappedTask = updatedTask ? this.mapTaskRowToTask(updatedTask) : null;
      console.log('Mapped task result:', mappedTask);
      
      return mappedTask;
    } catch (error: unknown) {
      console.error('Error in updateRemainingHours:', error);
      throw error;
    }
  }

  /**
   * Delete a task
   */
  async deleteTask(taskId: string): Promise<boolean> {
    try {
      const supabase = this.getSupabase();
      
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) {
        console.error('Error deleting task:', error);
        throw error;
      }

      return true;
    } catch (error: unknown) {
      console.error('Error in deleteTask:', error);
      return false;
    }
  }

  /**
   * Map database row to Task interface
   */
  private mapTaskRowToTask(row: any): Task {
    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string | null,
      project_id: row.project_id as string,
      status: row.status as 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'blocked',
      priority: row.priority as 'low' | 'medium' | 'high' | 'urgent',
      start_date: row.start_date as string | null,
      due_date: row.due_date as string | null,
      estimated_hours: row.estimated_hours as number | null,
      remaining_hours: row.remaining_hours as number | null,
      actual_hours: row.actual_hours as number,
      created_by: row.created_by as string,
      assigned_to: (row.assigned_to as string | null) || null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      created_by_user: row.created_by_user as { id: string; name: string; email: string } | undefined,
      assigned_to_user: row.assigned_to_user as { id: string; name: string; email: string } | undefined,
      project: row.project as { id: string; name: string } | undefined,
    };
  }
}

// Export singleton instance
export const taskServiceDB = new TaskServiceDB();

