/**
 * SERVER-SIDE ACCESS CONTROL HELPERS
 *
 * This module provides server-side compatible access control functions for API routes.
 * Unlike permission-checker.ts which uses client-side Supabase, these functions
 * work with server-side Supabase clients passed as parameters.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from './debug-logger';

/**
 * Check if user is assigned to a specific project
 * Server-side version that accepts supabase client as parameter
 */
export async function isAssignedToProjectServer(
  supabase: SupabaseClient,
  userId: string,
  projectId: string
): Promise<boolean> {
  // Check if user created the project or is assigned to it
  const { data: project } = await supabase
    .from('projects')
    .select('created_by, assigned_user_id')
    .eq('id', projectId)
    .single();

  if (project) {
    if (project.created_by === userId || project.assigned_user_id === userId) {
      return true;
    }
  }

  // Check project assignments
  const { data: projectAssignment } = await supabase
    .from('project_assignments')
    .select('id')
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .is('removed_at', null)
    .single();

  if (projectAssignment) {
    return true;
  }

  // Check task assignments
  const { data: taskAssignment } = await supabase
    .from('tasks')
    .select('id')
    .eq('assigned_to', userId)
    .eq('project_id', projectId)
    .limit(1);

  return (taskAssignment?.length || 0) > 0;
}

/**
 * Get project ID from workflow instance
 */
export async function getProjectIdFromWorkflowInstance(
  supabase: SupabaseClient,
  workflowInstanceId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('workflow_instances')
    .select('project_id')
    .eq('id', workflowInstanceId)
    .single();

  if (error || !data) {
    logger.error('Error fetching workflow instance for access check', { workflowInstanceId }, error);
    return null;
  }

  return data.project_id;
}

/**
 * Get project ID from workflow history entry
 */
export async function getProjectIdFromWorkflowHistory(
  supabase: SupabaseClient,
  historyId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('workflow_history')
    .select('workflow_instances(project_id)')
    .eq('id', historyId)
    .single();

  if (error || !data) {
    logger.error('Error fetching workflow history for access check', { historyId }, error);
    return null;
  }

  return (data.workflow_instances as any)?.project_id || null;
}

/**
 * Check if user has access to account (via project assignments or task assignments)
 */
export async function hasAccountAccessServer(
  supabase: SupabaseClient,
  userId: string,
  accountId: string
): Promise<boolean> {
  // Get all projects in the account
  const { data: projects } = await supabase
    .from('projects')
    .select('id')
    .eq('account_id', accountId);

  if (!projects || projects.length === 0) {
    return false;
  }

  const projectIds = projects.map(p => p.id);

  // Check project assignments
  const { data: projectAssignments } = await supabase
    .from('project_assignments')
    .select('id')
    .eq('user_id', userId)
    .in('project_id', projectIds)
    .is('removed_at', null)
    .limit(1);

  if (projectAssignments && projectAssignments.length > 0) {
    return true;
  }

  // Check task assignments
  const { data: taskAssignments } = await supabase
    .from('tasks')
    .select('id')
    .eq('assigned_to', userId)
    .in('project_id', projectIds)
    .limit(1);

  return (taskAssignments?.length || 0) > 0;
}

/**
 * Verify user has workflow instance access (via project access)
 */
export async function verifyWorkflowInstanceAccess(
  supabase: SupabaseClient,
  userId: string,
  workflowInstanceId: string
): Promise<{ hasAccess: boolean; projectId?: string; error?: string }> {
  const projectId = await getProjectIdFromWorkflowInstance(supabase, workflowInstanceId);

  if (!projectId) {
    return { hasAccess: false, error: 'Workflow instance not found or not associated with a project' };
  }

  const hasAccess = await isAssignedToProjectServer(supabase, userId, projectId);

  return { hasAccess, projectId };
}

/**
 * Verify user has workflow history access (via project access)
 */
export async function verifyWorkflowHistoryAccess(
  supabase: SupabaseClient,
  userId: string,
  historyId: string
): Promise<{ hasAccess: boolean; projectId?: string; error?: string }> {
  const projectId = await getProjectIdFromWorkflowHistory(supabase, historyId);

  if (!projectId) {
    return { hasAccess: false, error: 'Workflow history not found or not associated with a project' };
  }

  const hasAccess = await isAssignedToProjectServer(supabase, userId, projectId);

  return { hasAccess, projectId };
}

/**
 * Verify user has form response access (via workflow access if linked)
 */
export async function verifyFormResponseAccess(
  supabase: SupabaseClient,
  userId: string,
  formResponseId: string
): Promise<{ hasAccess: boolean; error?: string }> {
  // Get form response to check if it's linked to a workflow
  const { data: formResponse, error } = await supabase
    .from('form_responses')
    .select('workflow_history_id')
    .eq('id', formResponseId)
    .single();

  if (error || !formResponse) {
    return { hasAccess: false, error: 'Form response not found' };
  }

  // If not linked to workflow, user just needs VIEW_FORMS permission (already checked)
  if (!formResponse.workflow_history_id) {
    return { hasAccess: true };
  }

  // If linked to workflow, verify workflow access
  const accessCheck = await verifyWorkflowHistoryAccess(supabase, userId, formResponse.workflow_history_id);
  return { hasAccess: accessCheck.hasAccess, error: accessCheck.error };
}
