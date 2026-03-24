-- ============================================================
-- Client Portal Schema Fixes
-- ============================================================

-- 1. Fix client_portal_invitations
ALTER TABLE client_portal_invitations
  ADD COLUMN IF NOT EXISTS token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ DEFAULT NOW();

UPDATE client_portal_invitations SET invited_at = created_at WHERE invited_at IS NULL;

ALTER TABLE client_portal_invitations
  DROP CONSTRAINT IF EXISTS client_portal_invitations_status_check;
ALTER TABLE client_portal_invitations
  ADD CONSTRAINT client_portal_invitations_status_check
  CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled'));

ALTER TABLE client_portal_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage client invitations"
  ON client_portal_invitations FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_superadmin = true)
    OR EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN user_roles ur ON ur.user_id = up.id
      JOIN roles r ON r.id = ur.role_id
      WHERE up.id = auth.uid()
      AND (r.permissions->>'manage_client_invites')::boolean = true
    )
  );

CREATE POLICY "Clients can view own invitations"
  ON client_portal_invitations FOR SELECT
  USING (email = (SELECT email FROM user_profiles WHERE id = auth.uid()));

-- 2. Fix client_feedback
ALTER TABLE client_feedback
  DROP COLUMN IF EXISTS submitted_by,
  DROP COLUMN IF EXISTS rating,
  DROP COLUMN IF EXISTS feedback_text;

ALTER TABLE client_feedback
  ADD COLUMN IF NOT EXISTS client_user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS satisfaction_score INTEGER CHECK (satisfaction_score >= 1 AND satisfaction_score <= 10),
  ADD COLUMN IF NOT EXISTS what_went_well TEXT,
  ADD COLUMN IF NOT EXISTS what_needs_improvement TEXT,
  ADD COLUMN IF NOT EXISTS performance_metrics JSONB,
  ADD COLUMN IF NOT EXISTS workflow_history_id UUID REFERENCES workflow_history(id),
  ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'private' CHECK (visibility IN ('account', 'project', 'private'));

ALTER TABLE client_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can insert own feedback"
  ON client_feedback FOR INSERT
  WITH CHECK (client_user_id = auth.uid());

CREATE POLICY "Clients can view own feedback"
  ON client_feedback FOR SELECT
  USING (client_user_id = auth.uid());

CREATE POLICY "Admins can view all feedback"
  ON client_feedback FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_superadmin = true)
    OR EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN user_roles ur ON ur.user_id = up.id
      JOIN roles r ON r.id = ur.role_id
      WHERE up.id = auth.uid()
      AND (r.permissions->>'manage_client_invites')::boolean = true
    )
  );

-- 3. RLS policies for client write operations

CREATE POLICY "Client users can insert workflow history"
  ON workflow_history FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND is_client = true
    )
    AND EXISTS (
      SELECT 1 FROM workflow_instances wi
      JOIN projects p ON p.id = wi.project_id
      JOIN user_profiles up ON up.client_account_id = p.account_id
      WHERE wi.id = workflow_instance_id AND up.id = auth.uid()
    )
  );

CREATE POLICY "Client users can insert project updates"
  ON project_updates FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND is_client = true
    )
    AND EXISTS (
      SELECT 1 FROM projects p
      JOIN user_profiles up ON up.client_account_id = p.account_id
      WHERE p.id = project_id AND up.id = auth.uid()
    )
  );

CREATE POLICY "Client users can insert project issues"
  ON project_issues FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND is_client = true
    )
    AND EXISTS (
      SELECT 1 FROM projects p
      JOIN user_profiles up ON up.client_account_id = p.account_id
      WHERE p.id = project_id AND up.id = auth.uid()
    )
  );

-- ============================================================
-- 4. SECURITY DEFINER helper functions for client RLS (avoids recursion)
-- ============================================================

CREATE OR REPLACE FUNCTION user_is_client_for_account(check_account_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
    AND is_client = true
    AND client_account_id = check_account_id
  );
$$;

CREATE OR REPLACE FUNCTION user_is_client_for_project(check_project_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.user_profiles up ON up.client_account_id = p.account_id
    WHERE p.id = check_project_id
    AND up.id = auth.uid()
    AND up.is_client = true
  );
$$;

-- 5. Client SELECT policies (using SECURITY DEFINER to avoid recursion)

CREATE POLICY client_portal_projects_select ON projects FOR SELECT
  USING (user_is_client_for_account(account_id));

CREATE POLICY client_portal_updates_select ON project_updates FOR SELECT
  USING (user_is_client_for_project(project_id));

CREATE POLICY client_portal_assignments_select ON project_assignments FOR SELECT
  USING (user_is_client_for_project(project_id));

CREATE POLICY client_portal_workflow_instances_select ON workflow_instances FOR SELECT
  USING (user_is_client_for_project(project_id));

CREATE POLICY client_portal_workflow_history_select ON workflow_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workflow_instances wi
      WHERE wi.id = workflow_history.workflow_instance_id
      AND user_is_client_for_project(wi.project_id)
    )
  );

-- 6. Additional client SELECT policies for workflow nodes, templates, accounts

CREATE POLICY client_portal_workflow_nodes_select ON workflow_nodes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workflow_instances wi
      WHERE wi.workflow_template_id = workflow_nodes.workflow_template_id
      AND user_is_client_for_project(wi.project_id)
    )
  );

CREATE POLICY client_portal_workflow_templates_select ON workflow_templates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workflow_instances wi
      WHERE wi.workflow_template_id = workflow_templates.id
      AND user_is_client_for_project(wi.project_id)
    )
  );

CREATE POLICY client_portal_accounts_select ON accounts FOR SELECT
  USING (user_is_client_for_account(id));
