-- Create workflow_approvals table (required by workflow-execution-service.ts)
-- This table records approval/rejection decisions at approval nodes
CREATE TABLE IF NOT EXISTS public.workflow_approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_instance_id UUID NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
  node_id UUID NOT NULL REFERENCES workflow_nodes(id) ON DELETE CASCADE,
  approver_user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_instance
  ON workflow_approvals(workflow_instance_id);
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_node
  ON workflow_approvals(node_id);
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_user
  ON workflow_approvals(approver_user_id);

-- Enable RLS
ALTER TABLE workflow_approvals ENABLE ROW LEVEL SECURITY;

-- RLS policies: same pattern as other workflow tables
CREATE POLICY "workflow_approvals_select" ON workflow_approvals
  FOR SELECT USING (
    user_is_superadmin()
    OR user_has_permission('execute_workflows')
    OR user_has_permission('manage_all_workflows')
    OR approver_user_id = auth.uid()
  );

CREATE POLICY "workflow_approvals_insert" ON workflow_approvals
  FOR INSERT WITH CHECK (
    user_is_superadmin()
    OR user_has_permission('execute_workflows')
    OR user_has_permission('manage_all_workflows')
  );

-- Fix workflow_nodes node_type constraint to include 'department'
-- This enables department-level handoff nodes in the workflow builder
ALTER TABLE workflow_nodes DROP CONSTRAINT IF EXISTS workflow_nodes_node_type_check;
ALTER TABLE workflow_nodes ADD CONSTRAINT workflow_nodes_node_type_check
  CHECK (node_type = ANY (ARRAY[
    'start'::text,
    'department'::text,
    'role'::text,
    'approval'::text,
    'form'::text,
    'conditional'::text,
    'end'::text
  ]));
