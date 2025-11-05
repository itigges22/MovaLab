import { createClientSupabase } from './supabase';
import { Database } from './supabase';

type TaskRow = Database['public']['Tables']['tasks']['Row'];
type TaskInsert = Database['public']['Tables']['tasks']['Insert'];
type TaskUpdate = Database['public']['Tables']['tasks']['Update'];

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
    const supabase = createClientSupabase();
    if (!supabase) {
      throw new Error('Supabase client not available');
    }
    return supabase;
  }

  /**
   * Get all tasks for a specific project
   */
  async getTasksByProject(projectId: string): Promise<Task[]> {
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
        console.error('Error fetching tasks:', error);
        throw error;
      }

      return (data || []).map(this.mapTaskRowToTask);
    } catch (error) {
      console.error('Error in getTasksByProject:', error);
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
    } catch (error) {
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
      
      const taskData: TaskInsert = {
        name: data.name,
        description: data.description || null,
        project_id: data.project_id,
        status: data.status || 'backlog',
        priority: data.priority || 'medium',
        start_date: data.start_date || null,
        due_date: data.due_date || null,
        estimated_hours: data.estimated_hours || null,
        actual_hours: 0,
        created_by: data.created_by,
        assigned_to: data.assigned_to || null,
      };

      const { data: newTask, error } = await supabase
        .from('tasks')
        .insert(taskData)
        .select(`
          *,
          created_by_user:user_profiles!created_by(id, name, email),
          assigned_to_user:user_profiles!assigned_to(id, name, email),
          project:projects(id, name)
        `)
        .single();

      if (error) {
        console.error('Error creating task:', error);
        throw error;
      }

      return newTask ? this.mapTaskRowToTask(newTask) : null;
    } catch (error) {
      console.error('Error in createTask:', error);
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

      const { data: updatedTask, error } = await supabase
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

      if (error) {
        console.error('Error updating task:', error);
        throw error;
      }

      return updatedTask ? this.mapTaskRowToTask(updatedTask) : null;
    } catch (error) {
      console.error('Error in updateTask:', error);
      return null;
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
    } catch (error) {
      console.error('Error in deleteTask:', error);
      return false;
    }
  }

  /**
   * Map database row to Task interface
   */
  private mapTaskRowToTask(row: any): Task {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      project_id: row.project_id,
      status: row.status,
      priority: row.priority,
      start_date: row.start_date,
      due_date: row.due_date,
      estimated_hours: row.estimated_hours,
      actual_hours: row.actual_hours,
      created_by: row.created_by,
      assigned_to: row.assigned_to || null,
      created_at: row.created_at,
      updated_at: row.updated_at,
      created_by_user: row.created_by_user,
      assigned_to_user: row.assigned_to_user,
      project: row.project,
    };
  }
}

// Export singleton instance
export const taskServiceDB = new TaskServiceDB();

