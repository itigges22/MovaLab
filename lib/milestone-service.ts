import { createClientSupabase } from '@/lib/supabase';
import { logger } from '@/lib/debug-logger';

export type Milestone = {
  id: string;
  name: string;
  description?: string | null;
  date: string; // ISO timestamp
  color?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type MilestoneInput = {
  name: string;
  description?: string;
  date: Date;
  color?: string;
};

/**
 * Fetch all milestones from the database
 */
export async function getMilestones(): Promise<Milestone[]> {
  const supabase = createClientSupabase();
  
  const { data, error } = await supabase
    .from('milestones')
    .select('*')
    .order('date', { ascending: true });

  if (error) {
    logger.error('Error fetching milestones', {}, error as Error);
    throw new Error('Failed to fetch milestones');
  }

  return data || [];
}

/**
 * Create a new milestone
 */
export async function createMilestone(input: MilestoneInput): Promise<Milestone> {
  const supabase = createClientSupabase();

  const { data, error } = await supabase
    .from('milestones')
    .insert({
      name: input.name,
      description: input.description,
      date: input.date.toISOString(),
      color: input.color || '#3b82f6',
    })
    .select()
    .single();

  if (error) {
    logger.error('Error creating milestone', {}, error as Error);
    throw new Error('Failed to create milestone');
  }

  return data;
}

/**
 * Update an existing milestone
 */
export async function updateMilestone(
  id: string,
  input: Partial<MilestoneInput>
): Promise<Milestone> {
  const supabase = createClientSupabase();

  const updateData: Record<string, unknown> = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.date !== undefined) updateData.date = input.date.toISOString();
  if (input.color !== undefined) updateData.color = input.color;

  const { data, error } = await supabase
    .from('milestones')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    logger.error('Error updating milestone', {}, error as Error);
    throw new Error('Failed to update milestone');
  }

  return data;
}

/**
 * Delete a milestone
 */
export async function deleteMilestone(id: string): Promise<void> {
  const supabase = createClientSupabase();

  const { error } = await supabase
    .from('milestones')
    .delete()
    .eq('id', id);

  if (error) {
    logger.error('Error deleting milestone', {}, error as Error);
    throw new Error('Failed to delete milestone');
  }
}

