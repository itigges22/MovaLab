-- Fix missing UPDATE and DELETE RLS policies on workflow_templates
-- RLS was enabled but only INSERT and SELECT policies existed.
-- UPDATE and DELETE were denied by default, forcing the admin client workaround.

-- UPDATE: superadmin or users with manage_workflows permission
CREATE POLICY "workflow_templates_update"
  ON workflow_templates FOR UPDATE
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
CREATE POLICY "workflow_templates_delete"
  ON workflow_templates FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_superadmin = true)
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
      AND (r.permissions->>'manage_workflows')::boolean = true
    )
  );
