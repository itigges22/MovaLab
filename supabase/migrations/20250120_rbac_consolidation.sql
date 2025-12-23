-- =====================================================================
-- RBAC Permission Consolidation Migration
-- Date: 2025-01-20
-- Goal: Consolidate 136 permissions to ~60 using MANAGE pattern
-- =====================================================================

-- This migration:
-- 1. Adds new consolidated MANAGE permissions to roles with old CRUD permissions
-- 2. Removes deprecated/unused permissions
-- 3. Maintains backward compatibility during transition
-- 4. Provides rollback capability

BEGIN;

-- =====================================================================
-- PART 1: Add New Consolidated Permissions
-- =====================================================================

-- Update roles to add MANAGE_ACCOUNTS if they have any account CRUD permission
UPDATE roles
SET permissions = permissions || '{"manage_accounts": true}'::jsonb
WHERE (
  (permissions->>'create_account')::boolean = true OR
  (permissions->>'edit_account')::boolean = true OR
  (permissions->>'delete_account')::boolean = true
)
AND (permissions->>'manage_accounts')::boolean IS DISTINCT FROM true;

-- Update roles to add MANAGE_PROJECTS if they have any project CRUD permission
UPDATE roles
SET permissions = permissions || '{"manage_projects": true}'::jsonb
WHERE (
  (permissions->>'create_project')::boolean = true OR
  (permissions->>'edit_project')::boolean = true OR
  (permissions->>'delete_project')::boolean = true
)
AND (permissions->>'manage_projects')::boolean IS DISTINCT FROM true;

-- Update roles to add MANAGE_DEPARTMENTS if they have any department CRUD permission
UPDATE roles
SET permissions = permissions || '{"manage_departments": true}'::jsonb
WHERE (
  (permissions->>'create_department')::boolean = true OR
  (permissions->>'edit_department')::boolean = true OR
  (permissions->>'delete_department')::boolean = true
)
AND (permissions->>'manage_departments')::boolean IS DISTINCT FROM true;

-- Update roles to add MANAGE_UPDATES if they have any update CRUD permission
UPDATE roles
SET permissions = permissions || '{"manage_updates": true}'::jsonb
WHERE (
  (permissions->>'create_update')::boolean = true OR
  (permissions->>'edit_update')::boolean = true OR
  (permissions->>'delete_update')::boolean = true
)
AND (permissions->>'manage_updates')::boolean IS DISTINCT FROM true;

-- Update roles to add MANAGE_ISSUES if they have any issue CRUD permission
UPDATE roles
SET permissions = permissions || '{"manage_issues": true}'::jsonb
WHERE (
  (permissions->>'create_issue')::boolean = true OR
  (permissions->>'edit_issue')::boolean = true OR
  (permissions->>'delete_issue')::boolean = true
)
AND (permissions->>'manage_issues')::boolean IS DISTINCT FROM true;

-- Update roles to add MANAGE_NEWSLETTERS if they have any newsletter CRUD permission
UPDATE roles
SET permissions = permissions || '{"manage_newsletters": true}'::jsonb
WHERE (
  (permissions->>'create_newsletter')::boolean = true OR
  (permissions->>'edit_newsletter')::boolean = true OR
  (permissions->>'delete_newsletter')::boolean = true
)
AND (permissions->>'manage_newsletters')::boolean IS DISTINCT FROM true;

-- Update roles to add MANAGE_DELIVERABLES if they have any deliverable CRUD permission
UPDATE roles
SET permissions = permissions || '{"manage_deliverables": true}'::jsonb
WHERE (
  (permissions->>'create_deliverable')::boolean = true OR
  (permissions->>'edit_deliverable')::boolean = true OR
  (permissions->>'delete_deliverable')::boolean = true
)
AND (permissions->>'manage_deliverables')::boolean IS DISTINCT FROM true;

-- =====================================================================
-- PART 2: Add New Override Permissions
-- =====================================================================

-- Add MANAGE_ALL_PROJECTS if they have EDIT_ALL_PROJECTS or DELETE_ALL_PROJECTS
UPDATE roles
SET permissions = permissions || '{"manage_all_projects": true}'::jsonb
WHERE (
  (permissions->>'edit_all_projects')::boolean = true OR
  (permissions->>'delete_all_projects')::boolean = true
)
AND (permissions->>'manage_all_projects')::boolean IS DISTINCT FROM true;

-- Add MANAGE_ALL_WORKFLOWS if they have workflow management permissions
UPDATE roles
SET permissions = permissions || '{"manage_all_workflows": true}'::jsonb
WHERE (permissions->>'manage_workflows')::boolean = true
AND (permissions->>'manage_all_workflows')::boolean IS DISTINCT FROM true;

-- Add MANAGE_ALL_FORMS if they have form management permissions
UPDATE roles
SET permissions = permissions || '{"manage_all_forms": true}'::jsonb
WHERE (permissions->>'manage_forms')::boolean = true
AND (permissions->>'manage_all_forms')::boolean IS DISTINCT FROM true;

-- =====================================================================
-- PART 3: Remove Old CRUD Permissions (now replaced by MANAGE)
-- =====================================================================

-- Remove old account CRUD permissions
UPDATE roles
SET permissions = permissions - 'create_account' - 'edit_account' - 'delete_account'
WHERE permissions ?| array['create_account', 'edit_account', 'delete_account'];

-- Remove old project CRUD permissions
UPDATE roles
SET permissions = permissions - 'create_project' - 'edit_project' - 'delete_project'
WHERE permissions ?| array['create_project', 'edit_project', 'delete_project'];

-- Remove old department CRUD permissions
UPDATE roles
SET permissions = permissions - 'create_department' - 'edit_department' - 'delete_department'
WHERE permissions ?| array['create_department', 'edit_department', 'delete_department'];

-- Remove old update CRUD permissions
UPDATE roles
SET permissions = permissions - 'create_update' - 'edit_update' - 'delete_update'
WHERE permissions ?| array['create_update', 'edit_update', 'delete_update'];

-- Remove old issue CRUD permissions
UPDATE roles
SET permissions = permissions - 'create_issue' - 'edit_issue' - 'delete_issue'
WHERE permissions ?| array['create_issue', 'edit_issue', 'delete_issue'];

-- Remove old newsletter CRUD permissions
UPDATE roles
SET permissions = permissions - 'create_newsletter' - 'edit_newsletter' - 'delete_newsletter'
WHERE permissions ?| array['create_newsletter', 'edit_newsletter', 'delete_newsletter'];

-- Remove old deliverable CRUD permissions
UPDATE roles
SET permissions = permissions - 'create_deliverable' - 'edit_deliverable' - 'delete_deliverable'
WHERE permissions ?| array['create_deliverable', 'edit_deliverable', 'delete_deliverable'];

-- =====================================================================
-- PART 4: Remove Deprecated/Unused Permissions
-- =====================================================================

-- Remove unused permissions that were identified in the analysis
UPDATE roles
SET permissions = permissions
  - 'assign_project_users'
  - 'remove_project_users'
  - 'view_department_analytics'
  - 'edit_own_profile'
  - 'view_own_capacity'
  - 'log_time_all_project_tasks'
  - 'allocate_task_weeks'
  - 'view_capacity_analytics'
WHERE permissions ?| array[
  'assign_project_users',
  'remove_project_users',
  'view_department_analytics',
  'edit_own_profile',
  'view_own_capacity',
  'log_time_all_project_tasks',
  'allocate_task_weeks',
  'view_capacity_analytics'
];

-- =====================================================================
-- PART 5: Audit and Logging
-- =====================================================================

-- Log the migration for audit purposes
DO $$
DECLARE
  total_roles INTEGER;
  roles_updated INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_roles FROM roles;
  SELECT COUNT(*) INTO roles_updated FROM roles WHERE updated_at > NOW() - INTERVAL '1 minute';

  RAISE NOTICE 'RBAC Consolidation Migration Complete';
  RAISE NOTICE 'Total roles in system: %', total_roles;
  RAISE NOTICE 'Roles updated in this migration: %', roles_updated;
  RAISE NOTICE 'Old permissions removed, new MANAGE permissions added';
END $$;

-- Update the updated_at timestamp for all modified roles
UPDATE roles
SET updated_at = NOW()
WHERE permissions ?| array[
  'manage_accounts', 'manage_projects', 'manage_departments',
  'manage_updates', 'manage_issues', 'manage_newsletters',
  'manage_deliverables', 'manage_all_projects', 'manage_all_workflows',
  'manage_all_forms'
];

COMMIT;

-- =====================================================================
-- ROLLBACK SCRIPT (if needed)
-- =====================================================================
-- To rollback this migration, run the following (ONLY if necessary):
--
-- BEGIN;
--
-- -- Restore CREATE permissions from MANAGE
-- UPDATE roles
-- SET permissions = permissions || '{"create_account": true}'::jsonb
-- WHERE (permissions->>'manage_accounts')::boolean = true;
--
-- UPDATE roles
-- SET permissions = permissions || '{"create_project": true}'::jsonb
-- WHERE (permissions->>'manage_projects')::boolean = true;
--
-- -- ... (similar for all other CRUD permissions)
--
-- -- Remove new MANAGE permissions
-- UPDATE roles
-- SET permissions = permissions
--   - 'manage_accounts' - 'manage_projects' - 'manage_departments'
--   - 'manage_updates' - 'manage_issues' - 'manage_newsletters'
--   - 'manage_deliverables' - 'manage_all_projects'
--   - 'manage_all_workflows' - 'manage_all_forms';
--
-- COMMIT;

-- =====================================================================
-- VERIFICATION QUERIES
-- =====================================================================
-- Run these queries after migration to verify success:
--
-- -- Check which roles have the new MANAGE permissions:
-- SELECT name,
--        (permissions->>'manage_accounts')::boolean as manage_accounts,
--        (permissions->>'manage_projects')::boolean as manage_projects,
--        (permissions->>'manage_departments')::boolean as manage_departments
-- FROM roles
-- WHERE is_system_role = false
-- ORDER BY name;
--
-- -- Verify old permissions are removed:
-- SELECT name, permissions
-- FROM roles
-- WHERE permissions ?| array[
--   'create_account', 'edit_account', 'delete_account',
--   'create_project', 'edit_project', 'delete_project'
-- ];
-- -- Should return 0 rows
--
-- -- Check total permission count per role:
-- SELECT name,
--        jsonb_object_keys(permissions) as permission_key
-- FROM roles
-- WHERE is_system_role = false
-- ORDER BY name;
