# Database Scout - Table Inventory
**Generated**: 2025-11-27
**Database**: PRISM PSA Supabase PostgreSQL

## Table Count Summary
- **Auth schema**: 16 tables (Supabase managed authentication)
- **Public schema**: 42 tables (application data)

## Tables Grouped by Domain

### 1. Users & Authentication
- `auth.users` (4 rows, RLS enabled)
- `user_profiles` (0 rows, RLS enabled) - Links to auth.users
- `user_roles` (2 rows, RLS enabled) - Junction table for role assignment
- `user_availability` (4 rows, RLS enabled) - Capacity/availability tracking

### 2. Roles & Permissions (RBAC Core)
- `roles` (1 row, RLS enabled) - Role definitions with permissions JSONB
- `departments` (1 row, RLS enabled) - Department structure
- `role_hierarchy_audit` (0 rows, RLS enabled) - Audit trail for role changes

### 3. Client Accounts & Members
- `accounts` (0 rows, RLS enabled) - Client organizations
- `account_members` (2 rows, RLS enabled) - User-to-account assignments
- `account_kanban_configs` (0 rows, RLS enabled) - Kanban customization per account

### 4. Projects & Tasks
- `projects` (0 rows, RLS enabled) - Projects under accounts
- `project_assignments` (0 rows, RLS enabled) - User assignment to projects
- `project_stakeholders` (0 rows, RLS enabled) - Stakeholder tracking
- `project_updates` (0 rows, RLS enabled) - Journal-style updates
- `project_issues` (0 rows, RLS enabled) - Issue tracking
- `tasks` (0 rows, RLS enabled) - Task management
- `task_assignments` (0 rows, RLS enabled) - Task-to-user assignments
- `task_dependencies` (0 rows, RLS enabled) - Task dependency graph
- `task_week_allocations` (0 rows, RLS enabled) - Weekly capacity allocation

### 5. Time Tracking & Capacity
- `time_entries` (0 rows, RLS enabled) - Logged time on tasks
- `clock_sessions` (5 rows, RLS enabled) - Clock in/out tracking
- `user_availability` (4 rows, RLS enabled) - Weekly availability

### 6. Workflow Automation (Phase 1)
- `workflow_templates` (8 rows, RLS enabled) - Workflow definitions
- `workflow_nodes` (31 rows, RLS enabled) - Nodes in workflow graph
- `workflow_connections` (28 rows, RLS enabled) - Edges between nodes
- `workflow_instances` (0 rows, RLS enabled) - Active workflow executions
- `workflow_history` (0 rows, RLS enabled) - Audit trail for handoffs
- `workflow_approvals` (0 rows, RLS enabled) - Approval decisions

### 7. Dynamic Forms
- `form_templates` (3 rows, RLS enabled) - Form definitions
- `form_responses` (0 rows, RLS enabled) - Submitted form data

### 8. Client Portal
- `client_portal_invitations` (1 row, RLS enabled) - Client invite tokens
- `client_feedback` (0 rows, RLS enabled) - Client satisfaction feedback

### 9. Deliverables & Communication
- `deliverables` (0 rows, RLS enabled) - Project deliverables
- `newsletters` (0 rows, RLS enabled) - Newsletter management
- `notifications` (0 rows, RLS enabled) - User notifications

### 10. Support Tables
- `milestones` (0 rows, RLS enabled)
- `groups` (3 rows, RLS enabled) - Task grouping
- `statuses` (4 rows, RLS enabled) - Task status definitions
- `project_departments_backup` (18 rows, RLS enabled) - Deprecated backup table

## Key Observations

### RLS Status
- **All public schema tables have RLS enabled** ✓
- Auth schema tables managed by Supabase (RLS enabled where needed)

### Data Population Status
- **Production users**: 4 auth.users exist
- **Roles configured**: Only 1 role exists (likely incomplete setup)
- **User role assignments**: 2 user_roles entries
- **Workflow templates**: 8 templates with 31 nodes and 28 connections
- **Most application tables are empty** (0 rows) - suggests fresh/testing environment

### Foreign Key Relationships
Heavy interconnection between:
- `user_profiles` → referenced by 27 tables (central to all user activity)
- `workflow_history` → circular references with `project_updates`, `project_issues`, `form_responses`
- `workflow_nodes` → circular with `workflow_instances`, `workflow_history`, `workflow_approvals`

### Potential RLS Issues to Investigate
1. **Circular policy dependencies**: `workflow_history` ↔ `project_updates/issues`
2. **Nested RLS queries**: Many policies likely reference other RLS-protected tables
3. **Permission checking**: Only 1 role in database vs 136+ permissions in code
4. **Founder bypass**: Need to verify superadmin policies work correctly

## Next Steps
1. Examine RLS policies on `roles` and `user_roles` tables
2. Check `user_profiles` RLS policies (central to all access)
3. Investigate workflow table RLS policies for circular dependencies
4. Test Founder access as superadmin
