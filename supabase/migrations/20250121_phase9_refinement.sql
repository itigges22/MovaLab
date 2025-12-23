-- Phase 9: RBAC Refinement Migration
-- Date: 2025-12-21
-- Description: Further permission consolidation from 58 to 40 permissions
--              - Consolidate role management permissions
--              - Remove implicit permissions
--              - Remove deprecated table view and form permissions
--              - Remove hardcoded client permissions
--              - Add granular analytics overrides
--              - Add workflow context enforcement permission

BEGIN;

-- ============================================================================
-- STEP 1: Add new consolidated permissions to existing roles
-- ============================================================================

-- Add MANAGE_USER_ROLES to roles that had any of the old role management permissions
UPDATE roles
SET permissions = permissions || '{"manage_user_roles": true}'::jsonb
WHERE (
  (permissions->>'create_role')::boolean = true OR
  (permissions->>'edit_role')::boolean = true OR
  (permissions->>'delete_role')::boolean = true OR
  (permissions->>'view_roles')::boolean = true OR
  (permissions->>'assign_users_to_roles')::boolean = true OR
  (permissions->>'remove_users_from_roles')::boolean = true
);

-- Add MANAGE_USERS_IN_ACCOUNTS to roles that had account user management permissions
UPDATE roles
SET permissions = permissions || '{"manage_users_in_accounts": true}'::jsonb
WHERE (
  (permissions->>'view_accounts_tab')::boolean = true OR
  (permissions->>'assign_account_users')::boolean = true OR
  (permissions->>'remove_account_users')::boolean = true
);

-- Add MANAGE_USERS_IN_DEPARTMENTS (new permission for department user management)
-- Initially grant to roles that have MANAGE_DEPARTMENTS or MANAGE_USERS
UPDATE roles
SET permissions = permissions || '{"manage_users_in_departments": true}'::jsonb
WHERE (
  (permissions->>'manage_departments')::boolean = true OR
  (permissions->>'manage_users')::boolean = true
);

-- Add VIEW_ALL_DEPARTMENT_ANALYTICS to roles with VIEW_ALL_ANALYTICS
UPDATE roles
SET permissions = permissions || '{"view_all_department_analytics": true}'::jsonb
WHERE (permissions->>'view_all_analytics')::boolean = true;

-- Add VIEW_ALL_ACCOUNT_ANALYTICS to roles with VIEW_ALL_ANALYTICS
UPDATE roles
SET permissions = permissions || '{"view_all_account_analytics": true}'::jsonb
WHERE (permissions->>'view_all_analytics')::boolean = true;

-- Add EXECUTE_ANY_WORKFLOW to roles with SKIP_WORKFLOW_NODES (admin override)
UPDATE roles
SET permissions = permissions || '{"execute_any_workflow": true}'::jsonb
WHERE (permissions->>'skip_workflow_nodes')::boolean = true;

-- ============================================================================
-- STEP 2: Remove deprecated and consolidated permissions
-- ============================================================================

-- Remove old role management permissions (replaced by MANAGE_USER_ROLES)
UPDATE roles
SET permissions = permissions
  - 'create_role'
  - 'edit_role'
  - 'delete_role'
  - 'view_roles'
  - 'assign_users_to_roles'
  - 'remove_users_from_roles';

-- Remove old account user management permissions (replaced by MANAGE_USERS_IN_ACCOUNTS)
UPDATE roles
SET permissions = permissions
  - 'view_accounts_tab'
  - 'assign_account_users'
  - 'remove_account_users';

-- Remove implicit permissions (access is inherent)
UPDATE roles
SET permissions = permissions
  - 'view_own_profile'
  - 'view_analytics'
  - 'view_own_capacity'
  - 'view_capacity_dashboard';

-- Remove deprecated table view permissions
UPDATE roles
SET permissions = permissions
  - 'view_table'
  - 'edit_table';

-- Remove form permissions (forms now inline-only in workflows)
UPDATE roles
SET permissions = permissions
  - 'manage_forms'
  - 'view_forms'
  - 'submit_forms'
  - 'manage_all_forms';

-- Remove client permissions (now hardcoded for client role)
UPDATE roles
SET permissions = permissions
  - 'client_access'
  - 'client_approve';

-- ============================================================================
-- STEP 3: Audit logging
-- ============================================================================

-- Log this migration in a comment for tracking
COMMENT ON TABLE roles IS 'Phase 9 RBAC refinement applied on 2025-12-21: Consolidated 58 permissions to 40 (-31% reduction)';

-- ============================================================================
-- STEP 4: Verification queries (for manual checking)
-- ============================================================================

-- Uncomment to verify the migration:
-- SELECT name, permissions FROM roles WHERE is_system_role = false ORDER BY name;
--
-- Count permissions per role:
-- SELECT name, jsonb_object_keys(permissions) as permission FROM roles ORDER BY name;
--
-- Check for any remaining deprecated permissions:
-- SELECT name FROM roles WHERE
--   permissions ? 'create_role' OR
--   permissions ? 'view_own_profile' OR
--   permissions ? 'view_table' OR
--   permissions ? 'manage_forms' OR
--   permissions ? 'client_access';

COMMIT;

-- ============================================================================
-- ROLLBACK SCRIPT (save separately if needed)
-- ============================================================================

-- BEGIN;
--
-- -- Restore old role management permissions
-- UPDATE roles
-- SET permissions = permissions
--   || '{"create_role": true}'::jsonb
--   || '{"edit_role": true}'::jsonb
--   || '{"delete_role": true}'::jsonb
--   || '{"view_roles": true}'::jsonb
--   || '{"assign_users_to_roles": true}'::jsonb
--   || '{"remove_users_from_roles": true}'::jsonb
-- WHERE (permissions->>'manage_user_roles')::boolean = true;
--
-- -- Restore account user management permissions
-- UPDATE roles
-- SET permissions = permissions
--   || '{"view_accounts_tab": true}'::jsonb
--   || '{"assign_account_users": true}'::jsonb
--   || '{"remove_account_users": true}'::jsonb
-- WHERE (permissions->>'manage_users_in_accounts')::boolean = true;
--
-- -- Remove new consolidated permissions
-- UPDATE roles
-- SET permissions = permissions
--   - 'manage_user_roles'
--   - 'manage_users_in_accounts'
--   - 'manage_users_in_departments'
--   - 'view_all_department_analytics'
--   - 'view_all_account_analytics'
--   - 'execute_any_workflow';
--
-- COMMIT;
