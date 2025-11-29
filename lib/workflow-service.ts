/**
 * WORKFLOW SERVICE
 * Service layer for workflow operations (Phase 1 Feature 1 & 4)
 * Handles workflow template management, workflow execution, and history tracking
 *
 * IMPORTANT: Functions are being migrated to accept Supabase client as parameter
 * to maintain proper authentication context from API routes
 */

import { createServerSupabase } from './supabase-server';
import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from './debug-logger';

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

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkflowNode {
  id: string;
  workflow_template_id: string;
  node_type: 'department' | 'role' | 'client' | 'conditional';
  entity_id: string | null;
  position_x: number;
  position_y: number;
  label: string;
  requires_form: boolean;
  form_template_id: string | null;
  settings: Record<string, any>;
  created_at: string;
}

export interface WorkflowConnection {
  id: string;
  workflow_template_id: string;
  from_node_id: string;
  to_node_id: string;
  condition: Record<string, any> | null;
  created_at: string;
}

export interface WorkflowInstance {
  id: string;
  workflow_template_id: string;
  project_id: string | null;
  task_id: string | null;
  current_node_id: string | null;
  status: 'active' | 'completed' | 'cancelled';
  started_at: string;
  completed_at: string | null;
}

export interface WorkflowHistory {
  id: string;
  workflow_instance_id: string;
  from_node_id: string | null;
  to_node_id: string;
  handed_off_by: string | null;
  handed_off_to: string | null;
  handed_off_at: string;
  out_of_order: boolean;
  form_response_id: string | null;
  notes: string | null;
  project_update_id: string | null;
  project_issue_id: string | null;
}

export interface WorkflowTemplateWithDetails extends WorkflowTemplate {
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
}

// =====================================================
// WORKFLOW TEMPLATE MANAGEMENT
// =====================================================

/**
 * Get all active workflow templates
 */
export async function getWorkflowTemplates(): Promise<WorkflowTemplate[]> {
  const supabase = await getSupabase();

  const { data, error } = await supabase
    .from('workflow_templates')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (error) {
    logger.error('Error fetching workflow templates', { action: 'getWorkflowTemplates' }, error);
    throw error;
  }

  return data || [];
}

/**
 * Get workflow template by ID with nodes and connections
 */
export async function getWorkflowTemplateById(templateId: string): Promise<WorkflowTemplateWithDetails | null> {
  const supabase = await getSupabase();

  // Fetch template
  const { data: template, error: templateError } = await supabase
    .from('workflow_templates')
    .select('*')
    .eq('id', templateId)
    .single();

  if (templateError) {
    logger.error('Error fetching workflow template', { action: 'getWorkflowTemplateById', templateId }, templateError);
    throw templateError;
  }

  if (!template) return null;

  // Fetch nodes
  const { data: nodes, error: nodesError } = await supabase
    .from('workflow_nodes')
    .select('*')
    .eq('workflow_template_id', templateId)
    .order('created_at');

  if (nodesError) {
    logger.error('Error fetching workflow nodes', { action: 'getWorkflowTemplateById', templateId }, nodesError);
    throw nodesError;
  }

  // Fetch connections
  const { data: connections, error: connectionsError } = await supabase
    .from('workflow_connections')
    .select('*')
    .eq('workflow_template_id', templateId)
    .order('created_at');

  if (connectionsError) {
    logger.error('Error fetching workflow connections', { action: 'getWorkflowTemplateById', templateId }, connectionsError);
    throw connectionsError;
  }

  return {
    ...template,
    nodes: nodes || [],
    connections: connections || [],
  };
}

/**
 * Create workflow template
 */
export async function createWorkflowTemplate(
  name: string,
  description: string | null,
  createdBy: string
): Promise<WorkflowTemplate> {
  const supabase = await getSupabase();

  const { data, error } = await supabase
    .from('workflow_templates')
    .insert({
      name,
      description,
      created_by: createdBy,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    logger.error('Error creating workflow template', { action: 'createWorkflowTemplate', name }, error);
    throw error;
  }

  logger.info('Workflow template created', { templateId: data.id, name });
  return data;
}

/**
 * Update workflow template
 */
export async function updateWorkflowTemplate(
  templateId: string,
  updates: { name?: string; description?: string; is_active?: boolean }
): Promise<WorkflowTemplate> {
  const supabase = await getSupabase();

  const { data, error } = await supabase
    .from('workflow_templates')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', templateId)
    .select()
    .single();

  if (error) {
    logger.error('Error updating workflow template', { action: 'updateWorkflowTemplate', templateId }, error);
    throw error;
  }

  logger.info('Workflow template updated', { templateId });
  return data;
}

/**
 * Delete workflow template (soft delete by setting is_active = false)
 */
export async function deleteWorkflowTemplate(templateId: string): Promise<void> {
  const supabase = await getSupabase();

  const { error } = await supabase
    .from('workflow_templates')
    .update({ is_active: false })
    .eq('id', templateId);

  if (error) {
    logger.error('Error deleting workflow template', { action: 'deleteWorkflowTemplate', templateId }, error);
    throw error;
  }

  logger.info('Workflow template deleted', { templateId });
}

// =====================================================
// WORKFLOW NODE MANAGEMENT
// =====================================================

/**
 * Create workflow node
 */
export async function createWorkflowNode(
  templateId: string,
  nodeData: {
    node_type: 'department' | 'role' | 'client' | 'conditional';
    entity_id?: string | null;
    position_x: number;
    position_y: number;
    label: string;
    requires_form?: boolean;
    form_template_id?: string | null;
    settings?: Record<string, any>;
  }
): Promise<WorkflowNode> {
  const supabase = await getSupabase();

  const { data, error } = await supabase
    .from('workflow_nodes')
    .insert({
      workflow_template_id: templateId,
      ...nodeData,
    })
    .select()
    .single();

  if (error) {
    logger.error('Error creating workflow node', { action: 'createWorkflowNode', templateId }, error);
    throw error;
  }

  logger.info('Workflow node created', { nodeId: data.id, templateId });
  return data;
}

/**
 * Update workflow node
 */
export async function updateWorkflowNode(
  nodeId: string,
  updates: Partial<Omit<WorkflowNode, 'id' | 'workflow_template_id' | 'created_at'>>
): Promise<WorkflowNode> {
  const supabase = await getSupabase();

  const { data, error } = await supabase
    .from('workflow_nodes')
    .update(updates)
    .eq('id', nodeId)
    .select()
    .single();

  if (error) {
    logger.error('Error updating workflow node', { action: 'updateWorkflowNode', nodeId }, error);
    throw error;
  }

  logger.info('Workflow node updated', { nodeId });
  return data;
}

/**
 * Delete workflow node
 */
export async function deleteWorkflowNode(nodeId: string): Promise<void> {
  const supabase = await getSupabase();

  const { error } = await supabase
    .from('workflow_nodes')
    .delete()
    .eq('id', nodeId);

  if (error) {
    logger.error('Error deleting workflow node', { action: 'deleteWorkflowNode', nodeId }, error);
    throw error;
  }

  logger.info('Workflow node deleted', { nodeId });
}

// =====================================================
// WORKFLOW CONNECTION MANAGEMENT
// =====================================================

/**
 * Create workflow connection
 */
export async function createWorkflowConnection(
  templateId: string,
  fromNodeId: string,
  toNodeId: string,
  condition?: Record<string, any> | null
): Promise<WorkflowConnection> {
  const supabase = await getSupabase();

  const { data, error } = await supabase
    .from('workflow_connections')
    .insert({
      workflow_template_id: templateId,
      from_node_id: fromNodeId,
      to_node_id: toNodeId,
      condition: condition || null,
    })
    .select()
    .single();

  if (error) {
    logger.error('Error creating workflow connection', { action: 'createWorkflowConnection', templateId }, error);
    throw error;
  }

  logger.info('Workflow connection created', { connectionId: data.id, templateId });
  return data;
}

/**
 * Delete workflow connection
 */
export async function deleteWorkflowConnection(connectionId: string): Promise<void> {
  const supabase = await getSupabase();

  const { error } = await supabase
    .from('workflow_connections')
    .delete()
    .eq('id', connectionId);

  if (error) {
    logger.error('Error deleting workflow connection', { action: 'deleteWorkflowConnection', connectionId }, error);
    throw error;
  }

  logger.info('Workflow connection deleted', { connectionId });
}

// =====================================================
// WORKFLOW INSTANCE MANAGEMENT
// =====================================================

/**
 * Start workflow instance on a project or task
 */
export async function startWorkflowInstance(params: {
  workflowTemplateId: string;
  projectId?: string | null;
  taskId?: string | null;
  startNodeId: string;
}): Promise<WorkflowInstance> {
  const { workflowTemplateId, projectId, taskId, startNodeId } = params;
  const supabase = await getSupabase();

  // Validate that exactly one of projectId or taskId is provided
  if ((projectId && taskId) || (!projectId && !taskId)) {
    throw new Error('Must provide either projectId or taskId, but not both');
  }

  const { data, error } = await supabase
    .from('workflow_instances')
    .insert({
      workflow_template_id: workflowTemplateId,
      project_id: projectId || null,
      task_id: taskId || null,
      current_node_id: startNodeId,
      status: 'active',
    })
    .select()
    .single();

  if (error) {
    logger.error('Error starting workflow instance', { action: 'startWorkflowInstance', workflowTemplateId }, error);
    throw error;
  }

  logger.info('Workflow instance started', {
    instanceId: data.id,
    workflowTemplateId,
    projectId,
    taskId
  });

  return data;
}

/**
 * Get workflow instance by ID
 */
export async function getWorkflowInstance(instanceId: string): Promise<WorkflowInstance | null> {
  const supabase = await getSupabase();

  const { data, error } = await supabase
    .from('workflow_instances')
    .select('*')
    .eq('id', instanceId)
    .single();

  if (error) {
    logger.error('Error fetching workflow instance', { action: 'getWorkflowInstance', instanceId }, error);
    throw error;
  }

  return data;
}

/**
 * Get workflow instance for a project or task
 */
export async function getWorkflowInstanceForEntity(
  projectId?: string,
  taskId?: string
): Promise<WorkflowInstance | null> {
  const supabase = await getSupabase();

  let query = supabase
    .from('workflow_instances')
    .select('*')
    .eq('status', 'active');

  if (projectId) {
    query = query.eq('project_id', projectId);
  } else if (taskId) {
    query = query.eq('task_id', taskId);
  } else {
    throw new Error('Must provide either projectId or taskId');
  }

  const { data, error } = await query.single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    logger.error('Error fetching workflow instance', { action: 'getWorkflowInstanceForEntity', projectId, taskId }, error);
    throw error;
  }

  return data || null;
}

/**
 * Get next available nodes in workflow
 */
export async function getNextAvailableNodes(instanceId: string): Promise<WorkflowNode[]> {
  const supabase = await getSupabase();

  // Get current node
  const { data: instance, error: instanceError } = await supabase
    .from('workflow_instances')
    .select('current_node_id')
    .eq('id', instanceId)
    .single();

  if (instanceError || !instance?.current_node_id) {
    logger.error('Error fetching workflow instance for next nodes', { action: 'getNextAvailableNodes', instanceId }, instanceError ? new Error(instanceError.message) : undefined);
    throw instanceError || new Error('No current node found');
  }

  // Get connected nodes
  const { data: connections, error: connectionsError } = await supabase
    .from('workflow_connections')
    .select('to_node_id')
    .eq('from_node_id', instance.current_node_id);

  if (connectionsError) {
    logger.error('Error fetching workflow connections', { action: 'getNextAvailableNodes', instanceId }, new Error(connectionsError.message));
    throw connectionsError;
  }

  if (!connections || connections.length === 0) {
    return []; // No next nodes (end of workflow)
  }

  const nodeIds = connections.map(c => c.to_node_id);

  // Fetch node details
  const { data: nodes, error: nodesError } = await supabase
    .from('workflow_nodes')
    .select('*')
    .in('id', nodeIds);

  if (nodesError) {
    logger.error('Error fetching workflow nodes', { action: 'getNextAvailableNodes', instanceId }, nodesError);
    throw nodesError;
  }

  return nodes || [];
}

/**
 * Hand off workflow to next node
 */
export async function handoffWorkflow(
  supabase: SupabaseClient,
  params: {
    instanceId: string;
    toNodeId: string;
    handedOffBy: string;
    handedOffTo?: string | null;
    formResponseId?: string | null;
    notes?: string | null;
    outOfOrder?: boolean;
  }
): Promise<WorkflowHistory> {
  if (!supabase) {
    throw new Error('Supabase client is required');
  }

  const { instanceId, toNodeId, handedOffBy, handedOffTo, formResponseId, notes, outOfOrder = false } = params;

  // Get current node
  const { data: instance, error: instanceError } = await supabase
    .from('workflow_instances')
    .select('current_node_id')
    .eq('id', instanceId)
    .single();

  if (instanceError) {
    logger.error('Error fetching workflow instance for handoff', { action: 'handoffWorkflow', instanceId }, instanceError);
    throw instanceError;
  }

  const fromNodeId = instance.current_node_id;

  // Create history entry
  const { data: history, error: historyError } = await supabase
    .from('workflow_history')
    .insert({
      workflow_instance_id: instanceId,
      from_node_id: fromNodeId,
      to_node_id: toNodeId,
      handed_off_by: handedOffBy,
      handed_off_to: handedOffTo || null,
      out_of_order: outOfOrder,
      form_response_id: formResponseId || null,
      notes: notes || null,
    })
    .select()
    .single();

  if (historyError) {
    logger.error('Error creating workflow history', { action: 'handoffWorkflow', instanceId }, historyError);
    throw historyError;
  }

  // Update workflow instance current node
  const { error: updateError } = await supabase
    .from('workflow_instances')
    .update({ current_node_id: toNodeId })
    .eq('id', instanceId);

  if (updateError) {
    logger.error('Error updating workflow instance', { action: 'handoffWorkflow', instanceId }, updateError);
    throw updateError;
  }

  logger.info('Workflow handed off', {
    instanceId,
    fromNodeId,
    toNodeId,
    handedOffBy,
    outOfOrder
  });

  return history;
}

/**
 * Complete workflow instance
 */
export async function completeWorkflow(instanceId: string): Promise<void> {
  const supabase = await getSupabase();

  const { error } = await supabase
    .from('workflow_instances')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', instanceId);

  if (error) {
    logger.error('Error completing workflow instance', { action: 'completeWorkflow', instanceId }, error);
    throw error;
  }

  logger.info('Workflow completed', { instanceId });
}

/**
 * Cancel workflow instance
 */
export async function cancelWorkflow(instanceId: string): Promise<void> {
  const supabase = await getSupabase();

  const { error } = await supabase
    .from('workflow_instances')
    .update({ status: 'cancelled' })
    .eq('id', instanceId);

  if (error) {
    logger.error('Error cancelling workflow instance', { action: 'cancelWorkflow', instanceId }, error);
    throw error;
  }

  logger.info('Workflow cancelled', { instanceId });
}

/**
 * Get workflow history for an instance
 */
export async function getWorkflowHistory(instanceId: string): Promise<WorkflowHistory[]> {
  const supabase = await getSupabase();

  const { data, error } = await supabase
    .from('workflow_history')
    .select('*')
    .eq('workflow_instance_id', instanceId)
    .order('handed_off_at', { ascending: false });

  if (error) {
    logger.error('Error fetching workflow history', { action: 'getWorkflowHistory', instanceId }, error);
    throw error;
  }

  return data || [];
}

// Export aliases for API route compatibility
export const getWorkflowInstanceById = getWorkflowInstance;
