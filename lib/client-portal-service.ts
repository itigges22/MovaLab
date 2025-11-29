/**
 * CLIENT PORTAL SERVICE
 * Service layer for client portal operations (Phase 1 Feature 3)
 * Handles client invitations, client project access, and client feedback
 */

import { createServerSupabase } from './supabase-server';
import { logger } from './debug-logger';
import { randomBytes } from 'crypto';

// Helper to get supabase client with null check
async function getSupabase() {
  const supabase = await createServerSupabase();
  if (!supabase) {
    throw new Error('Unable to connect to the database');
  }
  return supabase;
}

// =====================================================
// TYPES & INTERFACES
// =====================================================

export interface ClientInvitation {
  id: string;
  account_id: string;
  email: string;
  invited_by: string | null;
  invited_at: string;
  token: string;
  accepted_at: string | null;
  expires_at: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
}

export interface ClientFeedback {
  id: string;
  project_id: string;
  workflow_history_id: string | null;
  client_user_id: string;
  satisfaction_score: number | null;
  what_went_well: string | null;
  what_needs_improvement: string | null;
  performance_metrics: Record<string, any> | null;
  submitted_at: string;
  visibility: 'private' | 'public';
}

export interface ClientUser {
  id: string;
  email: string;
  name: string | null;
  is_client: boolean;
  client_account_id: string | null;
  client_contact_name: string | null;
  client_company_position: string | null;
}

export interface ClientProject {
  id: string;
  name: string;
  description: string | null;
  status: string;
  account_id: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  workflow_instance_id: string | null;
}

// =====================================================
// CLIENT INVITATION MANAGEMENT
// =====================================================

/**
 * Generate secure invitation token
 */
function generateInvitationToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Send client invitation
 */
export async function sendClientInvitation(params: {
  accountId: string;
  email: string;
  invitedBy: string;
  expiresInDays?: number;
}): Promise<ClientInvitation> {
  const supabase = await getSupabase();
  const { accountId, email, invitedBy, expiresInDays = 7 } = params;

  // Check if user already exists
  const { data: existingUser } = await supabase
    .from('user_profiles')
    .select('id, email, is_client')
    .eq('email', email.toLowerCase())
    .single();

  if (existingUser) {
    if (existingUser.is_client) {
      throw new Error('User is already a client');
    }
    throw new Error('User already exists as an internal user and cannot be converted to a client');
  }

  // Check for existing pending invitation
  const { data: existingInvitation } = await supabase
    .from('client_portal_invitations')
    .select('id, status')
    .eq('account_id', accountId)
    .eq('email', email.toLowerCase())
    .eq('status', 'pending')
    .single();

  if (existingInvitation) {
    throw new Error('A pending invitation already exists for this email');
  }

  // Generate token and expiration
  const token = generateInvitationToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const { data, error } = await supabase
    .from('client_portal_invitations')
    .insert({
      account_id: accountId,
      email: email.toLowerCase(),
      invited_by: invitedBy,
      token,
      expires_at: expiresAt.toISOString(),
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    logger.error('Error sending client invitation', { action: 'sendClientInvitation', accountId, email }, error);
    throw error;
  }

  logger.info('Client invitation sent', {
    invitationId: data.id,
    accountId,
    email,
    invitedBy
  });

  return data;
}

/**
 * Get client invitation by token
 */
export async function getClientInvitationByToken(token: string): Promise<ClientInvitation | null> {
  const supabase = await getSupabase();

  const { data, error } = await supabase
    .from('client_portal_invitations')
    .select('*')
    .eq('token', token)
    .single();

  if (error && error.code !== 'PGRST116') {
    logger.error('Error fetching client invitation', { action: 'getClientInvitationByToken' }, error);
    throw error;
  }

  return data || null;
}

/**
 * Accept client invitation and create client user
 */
export async function acceptClientInvitation(params: {
  token: string;
  userId: string;
  name: string;
  companyPosition?: string;
}): Promise<void> {
  const supabase = await getSupabase();
  const { token, userId, name, companyPosition } = params;

  // Get invitation
  const invitation = await getClientInvitationByToken(token);
  if (!invitation) {
    throw new Error('Invitation not found');
  }

  if (invitation.status !== 'pending') {
    throw new Error('Invitation has already been used or cancelled');
  }

  if (new Date(invitation.expires_at) < new Date()) {
    // Update status to expired
    await supabase
      .from('client_portal_invitations')
      .update({ status: 'expired' })
      .eq('id', invitation.id);

    throw new Error('Invitation has expired');
  }

  // Update user profile to be a client
  const { error: profileError } = await supabase
    .from('user_profiles')
    .update({
      is_client: true,
      client_account_id: invitation.account_id,
      client_contact_name: name,
      client_company_position: companyPosition || null,
    })
    .eq('id', userId);

  if (profileError) {
    logger.error('Error updating user profile to client', { action: 'acceptClientInvitation', userId }, profileError);
    throw profileError;
  }

  // Get Client system role
  const { data: clientRole } = await supabase
    .from('roles')
    .select('id')
    .eq('is_system_role', true)
    .ilike('name', 'client')
    .single();

  if (clientRole) {
    // Assign user to Client role
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: userId,
        role_id: clientRole.id,
      });

    if (roleError) {
      logger.error('Error assigning Client role', { action: 'acceptClientInvitation', userId }, roleError);
      // Don't throw - user is already marked as client
    }
  }

  // Mark invitation as accepted
  const { error: invitationError } = await supabase
    .from('client_portal_invitations')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    })
    .eq('id', invitation.id);

  if (invitationError) {
    logger.error('Error updating invitation status', { action: 'acceptClientInvitation' }, invitationError);
    // Don't throw - user is already set up as client
  }

  logger.info('Client invitation accepted', {
    invitationId: invitation.id,
    userId,
    accountId: invitation.account_id
  });
}

/**
 * Cancel client invitation
 */
export async function cancelClientInvitation(invitationId: string): Promise<void> {
  const supabase = await getSupabase();

  const { error } = await supabase
    .from('client_portal_invitations')
    .update({ status: 'cancelled' })
    .eq('id', invitationId);

  if (error) {
    logger.error('Error cancelling client invitation', { action: 'cancelClientInvitation', invitationId }, error);
    throw error;
  }

  logger.info('Client invitation cancelled', { invitationId });
}

/**
 * Get invitations for an account
 */
export async function getAccountInvitations(accountId: string): Promise<ClientInvitation[]> {
  const supabase = await getSupabase();

  const { data, error } = await supabase
    .from('client_portal_invitations')
    .select('*')
    .eq('account_id', accountId)
    .order('invited_at', { ascending: false });

  if (error) {
    logger.error('Error fetching account invitations', { action: 'getAccountInvitations', accountId }, error);
    throw error;
  }

  return data || [];
}

// =====================================================
// CLIENT PROJECT ACCESS
// =====================================================

/**
 * Get projects for a client user
 */
export async function getClientProjects(clientUserId: string): Promise<ClientProject[]> {
  const supabase = await getSupabase();

  // Get client's account
  const { data: userProfile } = await supabase
    .from('user_profiles')
    .select('client_account_id')
    .eq('id', clientUserId)
    .single();

  if (!userProfile?.client_account_id) {
    throw new Error('User is not a client or has no associated account');
  }

  const { data, error } = await supabase
    .from('projects')
    .select('id, name, description, status, account_id, start_date, end_date, created_at, workflow_instance_id')
    .eq('account_id', userProfile.client_account_id)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('Error fetching client projects', { action: 'getClientProjects', clientUserId }, error);
    throw error;
  }

  return data || [];
}

/**
 * Get project details for client
 */
export async function getClientProjectById(clientUserId: string, projectId: string): Promise<ClientProject | null> {
  const supabase = await getSupabase();

  // Verify client has access to this project
  const { data: userProfile } = await supabase
    .from('user_profiles')
    .select('client_account_id')
    .eq('id', clientUserId)
    .single();

  if (!userProfile?.client_account_id) {
    throw new Error('User is not a client or has no associated account');
  }

  const { data, error } = await supabase
    .from('projects')
    .select('id, name, description, status, account_id, start_date, end_date, created_at, workflow_instance_id')
    .eq('id', projectId)
    .eq('account_id', userProfile.client_account_id)
    .single();

  if (error && error.code !== 'PGRST116') {
    logger.error('Error fetching client project', { action: 'getClientProjectById', clientUserId, projectId }, error);
    throw error;
  }

  return data || null;
}

// =====================================================
// CLIENT FEEDBACK MANAGEMENT
// =====================================================

/**
 * Submit client feedback
 */
export async function submitClientFeedback(params: {
  projectId: string;
  clientUserId: string;
  satisfactionScore?: number;
  whatWentWell?: string;
  whatNeedsImprovement?: string;
  performanceMetrics?: Record<string, any>;
  workflowHistoryId?: string | null;
}): Promise<ClientFeedback> {
  const supabase = await getSupabase();

  const {
    projectId,
    clientUserId,
    satisfactionScore,
    whatWentWell,
    whatNeedsImprovement,
    performanceMetrics,
    workflowHistoryId
  } = params;

  // Verify client has access to this project
  const project = await getClientProjectById(clientUserId, projectId);
  if (!project) {
    throw new Error('Project not found or client does not have access');
  }

  // Validate satisfaction score
  if (satisfactionScore !== undefined && (satisfactionScore < 1 || satisfactionScore > 10)) {
    throw new Error('Satisfaction score must be between 1 and 10');
  }

  const { data, error } = await supabase
    .from('client_feedback')
    .insert({
      project_id: projectId,
      client_user_id: clientUserId,
      satisfaction_score: satisfactionScore || null,
      what_went_well: whatWentWell || null,
      what_needs_improvement: whatNeedsImprovement || null,
      performance_metrics: performanceMetrics || null,
      workflow_history_id: workflowHistoryId || null,
      visibility: 'private', // Always private
    })
    .select()
    .single();

  if (error) {
    logger.error('Error submitting client feedback', { action: 'submitClientFeedback', projectId, clientUserId }, error);
    throw error;
  }

  logger.info('Client feedback submitted', {
    feedbackId: data.id,
    projectId,
    clientUserId,
    satisfactionScore
  });

  return data;
}

/**
 * Get feedback for a project
 */
export async function getProjectFeedback(projectId: string): Promise<ClientFeedback[]> {
  const supabase = await getSupabase();

  const { data, error } = await supabase
    .from('client_feedback')
    .select('*')
    .eq('project_id', projectId)
    .order('submitted_at', { ascending: false });

  if (error) {
    logger.error('Error fetching project feedback', { action: 'getProjectFeedback', projectId }, error);
    throw error;
  }

  return data || [];
}

/**
 * Get feedback for an account
 */
export async function getAccountFeedback(accountId: string): Promise<ClientFeedback[]> {
  const supabase = await getSupabase();

  const { data, error } = await supabase
    .from('client_feedback')
    .select(`
      *,
      projects!inner (
        account_id
      )
    `)
    .eq('projects.account_id', accountId)
    .order('submitted_at', { ascending: false });

  if (error) {
    logger.error('Error fetching account feedback', { action: 'getAccountFeedback', accountId }, error);
    throw error;
  }

  return data || [];
}

/**
 * Get all client feedback (admin view)
 */
export async function getAllClientFeedback(): Promise<ClientFeedback[]> {
  const supabase = await getSupabase();

  const { data, error } = await supabase
    .from('client_feedback')
    .select('*')
    .order('submitted_at', { ascending: false });

  if (error) {
    logger.error('Error fetching all client feedback', { action: 'getAllClientFeedback' }, error);
    throw error;
  }

  return data || [];
}

/**
 * Get feedback statistics for an account
 */
export async function getAccountFeedbackStats(accountId: string): Promise<{
  totalFeedback: number;
  averageSatisfaction: number;
  feedbackByScore: Record<number, number>;
}> {
  const supabase = await getSupabase();

  const { data, error } = await supabase
    .from('client_feedback')
    .select(`
      satisfaction_score,
      projects!inner (
        account_id
      )
    `)
    .eq('projects.account_id', accountId)
    .not('satisfaction_score', 'is', null);

  if (error) {
    logger.error('Error fetching account feedback stats', { action: 'getAccountFeedbackStats', accountId }, error);
    throw error;
  }

  const feedback = data || [];
  const totalFeedback = feedback.length;

  if (totalFeedback === 0) {
    return {
      totalFeedback: 0,
      averageSatisfaction: 0,
      feedbackByScore: {},
    };
  }

  const scores = feedback.map(f => f.satisfaction_score as number);
  const averageSatisfaction = scores.reduce((sum, score) => sum + score, 0) / totalFeedback;

  const feedbackByScore: Record<number, number> = {};
  for (const score of scores) {
    feedbackByScore[score] = (feedbackByScore[score] || 0) + 1;
  }

  return {
    totalFeedback,
    averageSatisfaction: Math.round(averageSatisfaction * 10) / 10, // Round to 1 decimal
    feedbackByScore,
  };
}

// Export aliases for API route compatibility
export const getClientInvitationsByAccount = getAccountInvitations;
export const getClientFeedbackByAccount = getAccountFeedback;

// =====================================================
// CLIENT APPROVAL/REJECTION WORKFLOW
// =====================================================

/**
 * Client approves project at workflow approval node
 */
export async function clientApproveProject(params: {
  projectId: string;
  workflowInstanceId: string;
  clientUserId: string;
  notes?: string | null;
}): Promise<{ success: boolean; message: string; nextNodes?: any[] }> {
  const supabase = await getSupabase();
  const { projectId, workflowInstanceId, clientUserId, notes } = params;

  // 1. Verify client has access to this project
  const project = await getClientProjectById(clientUserId, projectId);
  if (!project) {
    throw new Error('Project not found or client does not have access');
  }

  // 2. Get workflow instance and verify it exists
  const { data: instance, error: instanceError } = await supabase
    .from('workflow_instances')
    .select('*, current_node_id')
    .eq('id', workflowInstanceId)
    .eq('project_id', projectId)
    .single();

  if (instanceError || !instance) {
    throw new Error('Workflow instance not found for this project');
  }

  if (instance.status !== 'active') {
    throw new Error('Workflow is not active');
  }

  // 3. Verify current node is an approval node
  const { data: currentNode, error: nodeError } = await supabase
    .from('workflow_nodes')
    .select('*')
    .eq('id', instance.current_node_id)
    .single();

  if (nodeError || !currentNode) {
    throw new Error('Current workflow node not found');
  }

  if (currentNode.node_type !== 'approval') {
    throw new Error('Current workflow node is not an approval node. Cannot approve at this stage.');
  }

  // 4. Get next available nodes
  const { data: connections, error: connectionsError } = await supabase
    .from('workflow_connections')
    .select('to_node_id, workflow_nodes!workflow_connections_to_node_id_fkey(*)')
    .eq('from_node_id', instance.current_node_id);

  if (connectionsError) {
    logger.error('Error fetching next nodes', { action: 'clientApproveProject', workflowInstanceId }, connectionsError);
    throw new Error('Failed to determine next workflow step');
  }

  if (!connections || connections.length === 0) {
    // No next nodes - complete the workflow
    await supabase
      .from('workflow_instances')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', workflowInstanceId);

    logger.info('Client approved project - workflow completed', { projectId, workflowInstanceId, clientUserId });

    // Log approval in project updates
    await supabase.from('project_updates').insert({
      project_id: projectId,
      content: `✅ Client approved the project${notes ? `: "${notes}"` : ''}. Workflow completed successfully.`,
      created_by: clientUserId,
    });

    return {
      success: true,
      message: 'Project approved successfully. Workflow is now complete.',
    };
  }

  // 5. If multiple next nodes, return them for client to choose
  if (connections.length > 1) {
    return {
      success: false,
      message: 'Multiple workflow paths available. Please specify which path to take.',
      nextNodes: connections.map(c => c.workflow_nodes),
    };
  }

  // 6. Single next node - automatically hand off
  const nextNodeId = connections[0].to_node_id;

  // Update workflow instance to next node
  const { error: updateError } = await supabase
    .from('workflow_instances')
    .update({ current_node_id: nextNodeId })
    .eq('id', workflowInstanceId);

  if (updateError) {
    logger.error('Error updating workflow instance', { action: 'clientApproveProject', workflowInstanceId }, updateError);
    throw new Error('Failed to advance workflow');
  }

  // Create workflow history entry
  await supabase.from('workflow_history').insert({
    workflow_instance_id: workflowInstanceId,
    from_node_id: instance.current_node_id,
    to_node_id: nextNodeId,
    handed_off_by: clientUserId,
    notes: notes || `Client approved project${notes ? `: ${notes}` : ''}`,
    out_of_order: false,
  });

  // 7. Log approval in project updates
  await supabase.from('project_updates').insert({
    project_id: projectId,
    content: `✅ Client approved the project${notes ? `: "${notes}"` : ''}. Moving to next workflow stage.`,
    created_by: clientUserId,
  });

  logger.info('Client approved project', { projectId, workflowInstanceId, clientUserId, nextNodeId });

  return {
    success: true,
    message: 'Project approved successfully. Workflow advanced to next stage.',
  };
}

/**
 * Client rejects project at workflow approval node
 */
export async function clientRejectProject(params: {
  projectId: string;
  workflowInstanceId: string;
  clientUserId: string;
  notes: string;
  issues?: string[];
}): Promise<{ success: boolean; message: string }> {
  const supabase = await getSupabase();
  const { projectId, workflowInstanceId, clientUserId, notes, issues = [] } = params;

  // 1. Verify client has access to this project
  const project = await getClientProjectById(clientUserId, projectId);
  if (!project) {
    throw new Error('Project not found or client does not have access');
  }

  // 2. Get workflow instance and verify it exists
  const { data: instance, error: instanceError } = await supabase
    .from('workflow_instances')
    .select('*, current_node_id')
    .eq('id', workflowInstanceId)
    .eq('project_id', projectId)
    .single();

  if (instanceError || !instance) {
    throw new Error('Workflow instance not found for this project');
  }

  if (instance.status !== 'active') {
    throw new Error('Workflow is not active');
  }

  // 3. Verify current node is an approval node
  const { data: currentNode, error: nodeError } = await supabase
    .from('workflow_nodes')
    .select('*')
    .eq('id', instance.current_node_id)
    .single();

  if (nodeError || !currentNode) {
    throw new Error('Current workflow node not found');
  }

  if (currentNode.node_type !== 'approval') {
    throw new Error('Current workflow node is not an approval node. Cannot reject at this stage.');
  }

  // 4. Create workflow history entry for rejection
  const { data: historyEntry } = await supabase
    .from('workflow_history')
    .insert({
      workflow_instance_id: workflowInstanceId,
      from_node_id: instance.current_node_id,
      to_node_id: instance.current_node_id, // Stay at current node
      handed_off_by: clientUserId,
      notes: `❌ Client rejected: ${notes}`,
      out_of_order: false,
    })
    .select()
    .single();

  // 5. Create project issues for each concern raised
  if (issues.length > 0) {
    const issueInserts = issues.map(issue => ({
      project_id: projectId,
      content: issue,
      status: 'open',
      created_by: clientUserId,
      workflow_history_id: historyEntry?.id || null,
    }));

    await supabase.from('project_issues').insert(issueInserts);
  }

  // Also create a general rejection issue with the notes
  await supabase.from('project_issues').insert({
    project_id: projectId,
    content: notes,
    status: 'open',
    created_by: clientUserId,
    workflow_history_id: historyEntry?.id || null,
  });

  // 6. Log rejection in project updates
  const issuesText = issues.length > 0 ? ` Issues raised: ${issues.length}` : '';
  await supabase.from('project_updates').insert({
    project_id: projectId,
    content: `❌ Client rejected the project: "${notes}"${issuesText}. Workflow paused for revisions.`,
    created_by: clientUserId,
  });

  logger.info('Client rejected project', {
    projectId,
    workflowInstanceId,
    clientUserId,
    issueCount: issues.length + 1
  });

  return {
    success: true,
    message: `Project rejected. ${issues.length + 1} issue(s) created. The team has been notified and will address your concerns.`,
  };
}
