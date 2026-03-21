-- Migration: Fix workflow_nodes/connections RLS policies and add projects.notes column
--
-- Issues fixed:
-- 1. workflow_nodes has RLS enabled but only SELECT policy - INSERT/UPDATE/DELETE blocked
-- 2. workflow_connections has no RLS (add it with proper policies)
-- 3. projects table missing 'notes' column (API writes to it, causing schema cache error)

-- ============================================================
-- 1. Add missing INSERT/UPDATE/DELETE policies for workflow_nodes
-- ============================================================

-- INSERT: superadmin or users with manage_workflows permission
CREATE POLICY "workflow_nodes_insert"
  ON workflow_nodes FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_superadmin = true)
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
      AND (r.permissions->>'manage_workflows')::boolean = true
    )
  );

-- UPDATE: superadmin or users with manage_workflows permission
CREATE POLICY "workflow_nodes_update"
  ON workflow_nodes FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_superadmin = true)
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
      AND (r.permissions->>'manage_workflows')::boolean = true
    )
  );

-- DELETE: superadmin or users with manage_workflows permission
CREATE POLICY "workflow_nodes_delete"
  ON workflow_nodes FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_superadmin = true)
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
      AND (r.permissions->>'manage_workflows')::boolean = true
    )
  );

-- ============================================================
-- 2. Enable RLS on workflow_connections with proper policies
-- ============================================================

ALTER TABLE workflow_connections ENABLE ROW LEVEL SECURITY;

-- SELECT: same as workflow_nodes (non-client users)
CREATE POLICY "workflow_connections_select_non_client"
  ON workflow_connections FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_superadmin = true)
    OR NOT EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
      AND r.is_system_role = true AND lower(r.name) = 'client'
    )
  );

-- INSERT: superadmin or users with manage_workflows permission
CREATE POLICY "workflow_connections_insert"
  ON workflow_connections FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_superadmin = true)
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
      AND (r.permissions->>'manage_workflows')::boolean = true
    )
  );

-- UPDATE: superadmin or users with manage_workflows permission
CREATE POLICY "workflow_connections_update"
  ON workflow_connections FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_superadmin = true)
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
      AND (r.permissions->>'manage_workflows')::boolean = true
    )
  );

-- DELETE: superadmin or users with manage_workflows permission
CREATE POLICY "workflow_connections_delete"
  ON workflow_connections FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_superadmin = true)
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
      AND (r.permissions->>'manage_workflows')::boolean = true
    )
  );

-- ============================================================
-- 3. Add 'notes' column to projects table
-- ============================================================

ALTER TABLE projects ADD COLUMN IF NOT EXISTS notes TEXT;
