-- MovaLab Clean Seed
-- Platform starts empty. First user creates superadmin via /onboarding.

BEGIN;

-- ============================================================================
-- CLEANUP: Truncate all tables (preserves structure, clean slate)
-- ============================================================================

TRUNCATE
  setup_tokens,
  onboarding_state,
  user_invitations,
  workflow_active_steps,
  workflow_node_assignments,
  client_feedback,
  client_portal_invitations,
  form_responses,
  workflow_history,
  workflow_instances,
  workflow_connections,
  workflow_nodes,
  workflow_templates,
  form_templates,
  clock_sessions,
  task_week_allocations,
  time_entries,
  user_availability,
  user_dashboard_preferences,
  account_members,
  project_assignments,
  role_hierarchy_audit,
  newsletters,
  project_issues,
  project_updates,
  project_stakeholders,
  account_kanban_configs,
  notifications,
  deliverables,
  task_dependencies,
  tasks,
  projects,
  accounts,
  user_roles,
  user_profiles,
  roles,
  departments,
  milestones
CASCADE;

-- ============================================================================
-- SYSTEM ROLES ONLY (required for RBAC bootstrap)
-- ============================================================================

INSERT INTO roles (id, name, permissions, is_system_role, hierarchy_level, description)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Superadmin', '{}'::jsonb, TRUE, 100, 'System administrator with full access'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Client', '{}'::jsonb, TRUE, 0, 'Client portal user'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'No Assigned Role', '{}'::jsonb, TRUE, 0, 'Default unassigned role')
ON CONFLICT (id) DO NOTHING;

COMMIT;
