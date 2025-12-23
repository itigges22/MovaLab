-- Migration: Fix missing consolidated permissions from Phase 9
-- Date: 2025-12-21
-- Issue: Previous migration removed old permissions but failed to add new ones
-- This migration explicitly grants new consolidated permissions to appropriate roles

BEGIN;

-- =============================================================================
-- STEP 1: Grant ALL new permissions to Superadmin (should have everything)
-- =============================================================================

UPDATE roles
SET permissions = permissions
  || '{"manage_user_roles": true}'::jsonb
  || '{"manage_users_in_accounts": true}'::jsonb
  || '{"manage_users_in_departments": true}'::jsonb
  || '{"view_all_department_analytics": true}'::jsonb
  || '{"view_all_account_analytics": true}'::jsonb
  || '{"execute_any_workflow": true}'::jsonb
  || '{"manage_projects": true}'::jsonb
  || '{"manage_accounts": true}'::jsonb
  || '{"manage_departments": true}'::jsonb
  || '{"manage_updates": true}'::jsonb
  || '{"manage_issues": true}'::jsonb
  || '{"manage_newsletters": true}'::jsonb
  || '{"manage_time": true}'::jsonb
  || '{"manage_deliverables": true}'::jsonb
  || '{"manage_workflows": true}'::jsonb
  || '{"manage_client_invites": true}'::jsonb
WHERE name = 'Superadmin' OR is_superadmin = true;

-- =============================================================================
-- STEP 2: Grant role management permissions to roles that had any old role permissions
-- =============================================================================

-- Find roles that should have MANAGE_USER_ROLES
-- (Roles that had any of: manage_users, or any combination suggesting admin access)
UPDATE roles
SET permissions = permissions || '{"manage_user_roles": true}'::jsonb
WHERE (
  (permissions->>'manage_users')::boolean = true
) AND name != 'Superadmin' AND name != 'No Assigned Role' AND name != 'Unassigned';

-- =============================================================================
-- STEP 3: Grant account user management to roles that manage accounts
-- =============================================================================

UPDATE roles
SET permissions = permissions || '{"manage_users_in_accounts": true}'::jsonb
WHERE (
  (permissions->>'manage_accounts')::boolean = true OR
  (permissions->>'view_accounts')::boolean = true
) AND name != 'Superadmin' AND name != 'No Assigned Role' AND name != 'Unassigned';

-- =============================================================================
-- STEP 4: Grant department user management to roles that manage departments
-- =============================================================================

UPDATE roles
SET permissions = permissions || '{"manage_users_in_departments": true}'::jsonb
WHERE (
  (permissions->>'manage_departments')::boolean = true OR
  (permissions->>'view_departments')::boolean = true
) AND name != 'Superadmin' AND name != 'No Assigned Role' AND name != 'Unassigned';

-- =============================================================================
-- STEP 5: Grant analytics overrides to roles with all analytics access
-- =============================================================================

UPDATE roles
SET permissions = permissions
  || '{"view_all_department_analytics": true}'::jsonb
  || '{"view_all_account_analytics": true}'::jsonb
WHERE (
  (permissions->>'view_all_analytics')::boolean = true
) AND name != 'Superadmin' AND name != 'No Assigned Role' AND name != 'Unassigned';

-- =============================================================================
-- STEP 6: Grant workflow override to roles that can skip workflow nodes
-- =============================================================================

UPDATE roles
SET permissions = permissions || '{"execute_any_workflow": true}'::jsonb
WHERE (
  (permissions->>'skip_workflow_nodes')::boolean = true OR
  (permissions->>'manage_workflows')::boolean = true
) AND name != 'Superadmin' AND name != 'No Assigned Role' AND name != 'Unassigned';

-- =============================================================================
-- STEP 7: Grant MANAGE_PROJECTS to roles that had any project CRUD permissions
-- =============================================================================

UPDATE roles
SET permissions = permissions || '{"manage_projects": true}'::jsonb
WHERE (
  (permissions->>'edit_project')::boolean = true OR
  (permissions->>'manage_all_projects')::boolean = true OR
  (permissions->>'edit_all_projects')::boolean = true
) AND name != 'Superadmin' AND name != 'No Assigned Role' AND name != 'Unassigned';

-- =============================================================================
-- STEP 8: Grant MANAGE_ACCOUNTS to roles that had account CRUD permissions
-- =============================================================================

UPDATE roles
SET permissions = permissions || '{"manage_accounts": true}'::jsonb
WHERE (
  (permissions->>'edit_account')::boolean = true OR
  (permissions->>'view_all_accounts')::boolean = true
) AND name != 'Superadmin' AND name != 'No Assigned Role' AND name != 'Unassigned';

-- =============================================================================
-- STEP 9: Grant MANAGE_DEPARTMENTS to roles that had department CRUD permissions
-- =============================================================================

UPDATE roles
SET permissions = permissions || '{"manage_departments": true}'::jsonb
WHERE (
  (permissions->>'edit_department')::boolean = true OR
  (permissions->>'view_all_departments')::boolean = true
) AND name != 'Superadmin' AND name != 'No Assigned Role' AND name != 'Unassigned';

-- =============================================================================
-- STEP 10: Grant MANAGE_UPDATES to roles that had update CRUD permissions
-- =============================================================================

UPDATE roles
SET permissions = permissions || '{"manage_updates": true}'::jsonb
WHERE (
  (permissions->>'create_update')::boolean = true OR
  (permissions->>'edit_update')::boolean = true OR
  (permissions->>'delete_update')::boolean = true
) AND name != 'Superadmin' AND name != 'No Assigned Role' AND name != 'Unassigned';

-- =============================================================================
-- STEP 11: Grant MANAGE_ISSUES to roles that had issue CRUD permissions
-- =============================================================================

UPDATE roles
SET permissions = permissions || '{"manage_issues": true}'::jsonb
WHERE (
  (permissions->>'create_issue')::boolean = true OR
  (permissions->>'edit_issue')::boolean = true OR
  (permissions->>'delete_issue')::boolean = true
) AND name != 'Superadmin' AND name != 'No Assigned Role' AND name != 'Unassigned';

-- =============================================================================
-- STEP 12: Grant MANAGE_NEWSLETTERS to roles that had newsletter CRUD permissions
-- =============================================================================

UPDATE roles
SET permissions = permissions || '{"manage_newsletters": true}'::jsonb
WHERE (
  (permissions->>'create_newsletter')::boolean = true OR
  (permissions->>'edit_newsletter')::boolean = true OR
  (permissions->>'delete_newsletter')::boolean = true
) AND name != 'Superadmin' AND name != 'No Assigned Role' AND name != 'Unassigned';

-- =============================================================================
-- STEP 13: Grant MANAGE_TIME to roles that had time logging permissions
-- =============================================================================

UPDATE roles
SET permissions = permissions || '{"manage_time": true}'::jsonb
WHERE (
  (permissions->>'log_time')::boolean = true OR
  (permissions->>'edit_time_entries')::boolean = true
) AND name != 'Superadmin' AND name != 'No Assigned Role' AND name != 'Unassigned';

-- =============================================================================
-- STEP 14: Grant MANAGE_DELIVERABLES to roles that had deliverable CRUD permissions
-- =============================================================================

UPDATE roles
SET permissions = permissions || '{"manage_deliverables": true}'::jsonb
WHERE (
  (permissions->>'create_deliverable')::boolean = true OR
  (permissions->>'edit_deliverable')::boolean = true OR
  (permissions->>'delete_deliverable')::boolean = true
) AND name != 'Superadmin' AND name != 'No Assigned Role' AND name != 'Unassigned';

-- =============================================================================
-- STEP 15: Grant MANAGE_WORKFLOWS to roles that had workflow template permissions
-- =============================================================================

UPDATE roles
SET permissions = permissions || '{"manage_workflows": true}'::jsonb
WHERE (
  (permissions->>'create_workflow_template')::boolean = true OR
  (permissions->>'edit_workflow_template')::boolean = true OR
  (permissions->>'delete_workflow_template')::boolean = true
) AND name != 'Superadmin' AND name != 'No Assigned Role' AND name != 'Unassigned';

-- =============================================================================
-- STEP 16: Grant MANAGE_CLIENT_INVITES to roles that managed client invitations
-- =============================================================================

UPDATE roles
SET permissions = permissions || '{"manage_client_invites": true}'::jsonb
WHERE (
  (permissions->>'manage_accounts')::boolean = true
) AND name != 'Superadmin' AND name != 'No Assigned Role' AND name != 'Unassigned';

-- =============================================================================
-- VERIFICATION QUERIES (commented out - uncomment to check results)
-- =============================================================================

-- Check Superadmin has all new permissions:
-- SELECT name,
--   (permissions ? 'manage_user_roles') as has_manage_user_roles,
--   (permissions ? 'manage_users_in_accounts') as has_manage_users_in_accounts,
--   (permissions ? 'manage_users_in_departments') as has_manage_users_in_departments,
--   (permissions ? 'view_all_department_analytics') as has_dept_analytics,
--   (permissions ? 'view_all_account_analytics') as has_acct_analytics,
--   (permissions ? 'execute_any_workflow') as has_execute_any_workflow
-- FROM roles WHERE name = 'Superadmin';

-- Check all roles with new permissions:
-- SELECT name,
--   (permissions ? 'manage_user_roles') as manage_user_roles,
--   (permissions ? 'manage_projects') as manage_projects,
--   (permissions ? 'manage_accounts') as manage_accounts,
--   (permissions ? 'manage_time') as manage_time
-- FROM roles
-- WHERE name != 'No Assigned Role' AND name != 'Unassigned'
-- ORDER BY name;

COMMIT;
