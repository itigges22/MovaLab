-- Fix CRITICAL: Prevent privilege escalation via is_superadmin self-update
-- Problem: Any user could PATCH their own user_profiles and set is_superadmin=true

-- Step 1: Drop ALL existing UPDATE policies on user_profiles
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'user_profiles' AND cmd = 'UPDATE'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON user_profiles', pol.policyname);
  END LOOP;
END $$;

-- Step 2: Create secure UPDATE policy that prevents is_superadmin modification
-- Users can update their own row BUT cannot change is_superadmin unless they're already superadmin
CREATE POLICY "secure_user_profiles_update"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_superadmin = true))
  WITH CHECK (
    -- Superadmins can update anything
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_superadmin = true)
    OR
    -- Non-superadmins can only update their own row AND cannot change is_superadmin
    (auth.uid() = id AND is_superadmin = false)
  );

-- Step 3: Fix workflow_templates - drop all INSERT policies and create restrictive one
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'workflow_templates' AND cmd = 'INSERT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON workflow_templates', pol.policyname);
  END LOOP;
END $$;

-- Enable RLS on workflow_templates if not already
ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workflow_templates_insert_restricted"
  ON workflow_templates FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_superadmin = true)
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
      AND (r.permissions->>'manage_workflows')::boolean = true
    )
  );

-- Step 4: Fix workflow_templates SELECT - hide from client users
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'workflow_templates' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON workflow_templates', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "workflow_templates_select_non_client"
  ON workflow_templates FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_superadmin = true)
    OR NOT EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
      AND r.is_system_role = true AND lower(r.name) = 'client'
    )
  );

-- Step 5: Fix workflow_nodes SELECT
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'workflow_nodes' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON workflow_nodes', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE workflow_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workflow_nodes_select_non_client"
  ON workflow_nodes FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_superadmin = true)
    OR NOT EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
      AND r.is_system_role = true AND lower(r.name) = 'client'
    )
  );
