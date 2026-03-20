# MovaLab Full E2E Audit - Master Instruction Set

---

## SECTION 6 - EXECUTION RULES

1. Before doing anything read FULLAUDIT.md to see what has been completed
2. Pick the next NOT STARTED item from the test plan
3. Actually navigate to or invoke the feature. Do not just read code and assume it works. Use the test steps.
4. For frontend tests use Playwright via the MCP browser tools (browser_navigate, browser_snapshot, browser_click, browser_take_screenshot). If that is not available, do manual code review plus runtime verification by reading source files.
5. For backend tests use curl or fetch to hit API routes with different auth tokens per persona.
6. If something is broken fix it immediately then retest.
7. After each item update FULLAUDIT.md with the result.
8. Never skip an item. If blocked document why and move to the next item then come back.
9. Track cumulative stats at the top of FULLAUDIT.md showing total items, passed, failed, fixed, and remaining.
10. If you encounter a feature not in the test plan add it to both auditprompt.md and the test plan then test it.

---

## SECTION 1 - CODEBASE MAP

### 1.1 Page Routes (31 pages)

| Route | File | Auth Required | Description |
|-------|------|---------------|-------------|
| `/` | `app/page.tsx` | No | Landing/login redirect |
| `/login` | `app/login/page.tsx` | No | Login form (or demo login) |
| `/signup` | `app/signup/page.tsx` | No | Signup form |
| `/forgot-password` | `app/forgot-password/page.tsx` | No | Password reset request |
| `/reset-password` | `app/reset-password/page.tsx` | No | Password reset form |
| `/setup` | `app/setup/page.tsx` | Yes | First-time superadmin setup |
| `/pending-approval` | `app/pending-approval/page.tsx` | Yes | Waiting for role approval |
| `/welcome` | `app/welcome/page.tsx` | Yes | Welcome dashboard with updates |
| `/dashboard` | `app/dashboard/page.tsx` | Yes | Main dashboard with widgets |
| `/projects` | `app/projects/page.tsx` | Yes | Projects list (permission-filtered) |
| `/projects/[projectId]` | `app/projects/[projectId]/page.tsx` | Yes | Project detail with tasks, updates, issues |
| `/accounts` | `app/accounts/page.tsx` | Yes | Accounts list |
| `/accounts/[accountId]` | `app/accounts/[accountId]/page.tsx` | Yes | Account detail with projects |
| `/departments` | `app/departments/page.tsx` | Yes | Departments list with metrics |
| `/departments/[departmentId]` | `app/departments/[departmentId]/page.tsx` | Yes | Department detail |
| `/departments/[departmentId]/admin` | `app/departments/[departmentId]/admin/page.tsx` | Yes (Admin) | Department admin tabs |
| `/capacity` | `app/capacity/page.tsx` | Yes | Capacity management |
| `/time-entries` | `app/time-entries/page.tsx` | Yes | Time entries list and charts |
| `/analytics` | `app/analytics/page.tsx` | Yes | Analytics dashboard |
| `/profile` | `app/profile/page.tsx` | Yes | User profile editing |
| `/admin` | `app/(main)/admin/page.tsx` | Yes (Admin) | Admin hub |
| `/admin/roles` | `app/admin/roles/page.tsx` | Yes (Admin) | Role management + hierarchy |
| `/admin/workflows` | `app/(main)/admin/workflows/page.tsx` | Yes (Admin) | Workflow template list |
| `/admin/workflows/[id]/edit` | `app/(main)/admin/workflows/[id]/edit/page.tsx` | Yes (Admin) | Visual workflow editor |
| `/admin/time-tracking` | `app/admin/time-tracking/page.tsx` | Yes (Admin) | Admin time entry management |
| `/admin/client-portal` | `app/(main)/admin/client-portal/page.tsx` | Yes (Admin) | Client invitation management |
| `/admin/client-feedback` | `app/(main)/admin/client-feedback/page.tsx` | Yes (Admin) | Client feedback viewer |
| `/admin/database` | `app/admin/database/page.tsx` | Yes (Superadmin) | Database status (placeholder) |
| `/admin/rbac-diagnostics` | `app/admin/rbac-diagnostics/page.tsx` | Yes (Superadmin) | RBAC diagnostics tool |
| `/admin/superadmin-setup` | `app/admin/superadmin-setup/page.tsx` | Yes (Superadmin) | Superadmin role assignment |
| `/admin/users/pending` | `app/admin/users/pending/page.tsx` | Yes (Admin) | Pending user approvals |

### 1.2 API Routes (100 routes)

#### Accounts
| Method | Route | Permission |
|--------|-------|------------|
| GET | `/api/accounts` | VIEW_ACCOUNTS or VIEW_ALL_ACCOUNTS |
| POST | `/api/accounts` | MANAGE_ACCOUNTS |
| PATCH | `/api/accounts/[accountId]` | MANAGE_ACCOUNTS + context |
| GET | `/api/accounts/members` | VIEW_ALL_ACCOUNTS |
| GET | `/api/accounts/[accountId]/members` | VIEW_ACCOUNTS/VIEW_ALL_ACCOUNTS + context |
| POST | `/api/accounts/[accountId]/members` | MANAGE_USERS_IN_ACCOUNTS + context |
| DELETE | `/api/accounts/[accountId]/members/[userId]` | MANAGE_USERS_IN_ACCOUNTS + context |
| GET | `/api/accounts/[accountId]/kanban-config` | VIEW_PROJECTS + context |
| PUT | `/api/accounts/[accountId]/kanban-config` | MANAGE_PROJECTS + context |
| POST | `/api/accounts/[accountId]/invite-client` | MANAGE_CLIENT_INVITES |
| GET | `/api/accounts/[accountId]/client-invites` | MANAGE_CLIENT_INVITES |
| GET | `/api/accounts/[accountId]/client-feedback` | MANAGE_CLIENT_INVITES |

#### Projects
| Method | Route | Permission |
|--------|-------|------------|
| GET | `/api/projects` | VIEW_PROJECTS or VIEW_ALL_PROJECTS |
| POST | `/api/projects` | MANAGE_PROJECTS + accountId context |
| GET | `/api/projects/[projectId]` | userHasProjectAccess |
| PATCH | `/api/projects/[projectId]` | MANAGE_PROJECTS or MANAGE_ALL_PROJECTS |
| DELETE | `/api/projects/[projectId]` | MANAGE_PROJECTS or MANAGE_ALL_PROJECTS |
| GET/POST | `/api/projects/[projectId]/assignments` | userHasProjectAccess |
| DELETE | `/api/projects/[projectId]/assignments` | MANAGE_ALL_PROJECTS or isSuperadmin |
| POST | `/api/projects/[projectId]/complete` | MANAGE_PROJECTS or MANAGE_ALL_PROJECTS |
| POST | `/api/projects/[projectId]/reopen` | MANAGE_ALL_PROJECTS or isSuperadmin |
| GET/POST | `/api/projects/[projectId]/issues` | userHasProjectAccess |
| PUT/DELETE | `/api/projects/[projectId]/issues/[issueId]` | userHasProjectAccess + creator |
| GET/POST | `/api/projects/[projectId]/updates` | userHasProjectAccess |
| PUT/DELETE | `/api/projects/[projectId]/updates/[updateId]` | userHasProjectAccess + creator |
| GET | `/api/projects/[projectId]/stakeholders` | userHasProjectAccess |
| GET | `/api/project-updates` | Auth required (filtered by access) |

#### Tasks
| Method | Route | Permission |
|--------|-------|------------|
| GET/POST | `/api/tasks` | Auth + project access |
| PUT/PATCH/DELETE | `/api/tasks/[taskId]` | Auth + project access |

#### Roles
| Method | Route | Permission |
|--------|-------|------------|
| GET | `/api/roles` | Auth required |
| POST | `/api/roles` | MANAGE_USER_ROLES |
| PATCH/DELETE | `/api/roles/[roleId]` | MANAGE_USER_ROLES |
| POST | `/api/roles/[roleId]/assign-user` | MANAGE_USER_ROLES |
| POST | `/api/roles/[roleId]/unassign-user` | MANAGE_USER_ROLES |
| DELETE | `/api/roles/[roleId]/remove-user/[userId]` | MANAGE_USER_ROLES |
| GET | `/api/roles/[roleId]/users` | MANAGE_USER_ROLES |
| POST | `/api/roles/reorder` | MANAGE_USER_ROLES |

#### Workflows
| Method | Route | Permission |
|--------|-------|------------|
| GET/POST | `/api/admin/workflows/templates` | MANAGE_WORKFLOWS |
| GET/PATCH/DELETE | `/api/admin/workflows/templates/[id]` | MANAGE_WORKFLOWS |
| GET/POST | `/api/admin/workflows/templates/[id]/nodes` | MANAGE_WORKFLOWS |
| POST | `/api/admin/workflows/templates/[id]/connections` | MANAGE_WORKFLOWS |
| GET | `/api/admin/workflows/templates/[id]/steps` | MANAGE_WORKFLOWS |
| PATCH | `/api/admin/workflows/nodes/[nodeId]` | MANAGE_WORKFLOWS |
| DELETE | `/api/admin/workflows/connections/[connectionId]` | MANAGE_WORKFLOWS |
| POST | `/api/workflows/start` | EXECUTE_WORKFLOWS |
| POST | `/api/workflows/progress` | EXECUTE_WORKFLOWS |
| GET | `/api/workflows/instances/[id]` | Auth + project access |
| GET | `/api/workflows/instances/[id]/history` | Auth + project access |
| GET | `/api/workflows/instances/[id]/next-nodes` | Auth + project access |
| GET | `/api/workflows/instances/[id]/active-steps` | Auth + project access |
| POST | `/api/workflows/instances/[id]/handoff` | EXECUTE_WORKFLOWS |
| POST | `/api/workflows/instances/start` | EXECUTE_WORKFLOWS |
| POST | `/api/workflows/steps/assignments` | Auth required |
| GET | `/api/workflows/my-projects` | Auth required |
| GET | `/api/workflows/my-pipeline` | Auth required |
| GET | `/api/workflows/my-approvals` | Auth required |
| GET | `/api/workflows/my-past-projects` | Auth required |
| GET/POST | `/api/workflows/forms/responses` | Auth required |
| GET | `/api/workflows/forms/responses/[id]` | Auth + form access |
| GET | `/api/workflows/history/[historyId]/form` | Auth + workflow access |

#### Analytics
| Method | Route | Permission |
|--------|-------|------------|
| GET | `/api/analytics/overview` | VIEW_ALL_ANALYTICS |
| GET | `/api/analytics/projects` | VIEW_ALL_ANALYTICS |
| GET | `/api/analytics/team` | VIEW_ALL_ANALYTICS or VIEW_ALL_DEPARTMENT_ANALYTICS |
| GET | `/api/analytics/accounts` | VIEW_ALL_ACCOUNT_ANALYTICS or VIEW_ALL_ANALYTICS |
| GET | `/api/analytics/time` | VIEW_ALL_ANALYTICS |
| GET | `/api/analytics/workflows` | VIEW_ALL_ANALYTICS or MANAGE_WORKFLOWS |
| GET | `/api/analytics/network` | VIEW_ALL_ANALYTICS |

#### Capacity & Time
| Method | Route | Permission |
|--------|-------|------------|
| GET | `/api/capacity` | VIEW_TEAM_CAPACITY or VIEW_ALL_CAPACITY |
| GET | `/api/capacity/history` | VIEW_TEAM_CAPACITY or VIEW_ALL_CAPACITY |
| GET | `/api/capacity/organization` | VIEW_ALL_CAPACITY |
| GET | `/api/capacity/department` | VIEW_TEAM_CAPACITY or VIEW_ALL_CAPACITY |
| GET | `/api/capacity/account` | VIEW_TEAM_CAPACITY or VIEW_ALL_CAPACITY |
| GET/POST/DELETE | `/api/availability` | Auth + EDIT_OWN_AVAILABILITY for POST |
| GET/POST | `/api/time-entries` | Auth required |
| GET | `/api/admin/time-entries` | VIEW_ALL_TIME_ENTRIES |
| PATCH/DELETE | `/api/admin/time-entries/[id]` | VIEW_ALL_TIME_ENTRIES + MANAGE_TIME |
| POST | `/api/clock` | Auth + MANAGE_TIME |
| POST | `/api/clock/out` | Auth + MANAGE_TIME |
| POST | `/api/clock/discard` | Auth required |

#### Dashboard
| Method | Route | Permission |
|--------|-------|------------|
| GET | `/api/dashboard/preferences` | Auth required |
| PUT | `/api/dashboard/preferences` | Auth required |
| GET | `/api/dashboard/my-accounts` | Auth required |
| GET | `/api/dashboard/my-analytics` | Auth required |
| GET | `/api/dashboard/my-collaborators` | Auth required |
| GET | `/api/dashboard/my-workflows` | Auth required |
| GET | `/api/dashboard/recent-activity` | Auth required |
| GET | `/api/dashboard/task-completion-trend` | Auth required |
| GET | `/api/dashboard/time-by-project` | Auth required |
| GET | `/api/dashboard/upcoming-deadlines` | Auth required |

#### Users & Auth
| Method | Route | Permission |
|--------|-------|------------|
| GET | `/api/users` | Auth required |
| GET | `/api/users/pending` | MANAGE_USER_ROLES |
| POST | `/api/users/approve` | MANAGE_USER_ROLES |
| GET/PATCH | `/api/profile` | Auth required (own profile) |
| GET | `/api/auth/permissions` | Auth required |
| GET | `/api/setup` | None (public) |
| POST | `/api/setup` | Auth + SETUP_SECRET |
| GET | `/api/cron/reset-demo-data` | CRON_SECRET |

#### Client Portal
| Method | Route | Permission |
|--------|-------|------------|
| GET | `/api/client/portal/projects` | is_client flag |
| GET | `/api/client/portal/projects/[id]` | is_client + project access |
| POST | `/api/client/portal/projects/[id]/approve` | is_client |
| POST | `/api/client/portal/projects/[id]/reject` | is_client |
| POST | `/api/client/portal/projects/[id]/feedback` | is_client |
| POST | `/api/client/accept-invite/[token]` | Token-based |

#### Admin
| Method | Route | Permission |
|--------|-------|------------|
| GET | `/api/admin/rbac-diagnostics` | MANAGE_USERS or isSuperadmin |
| POST | `/api/admin/rbac-diagnostics/test` | MANAGE_USERS or isSuperadmin |
| POST | `/api/admin/move-system-roles` | isSuperadmin |
| GET | `/api/admin/client-feedback` | MANAGE_CLIENT_INVITES |

#### Other
| Method | Route | Permission |
|--------|-------|------------|
| GET | `/api/departments` | VIEW_DEPARTMENTS or VIEW_ALL_DEPARTMENTS |
| POST | `/api/departments` | MANAGE_DEPARTMENTS |
| GET | `/api/org-structure/departments` | VIEW_DEPARTMENTS |
| GET | `/api/org-structure/roles` | Auth required |
| GET | `/app/auth/callback` | None (OAuth callback) |

### 1.3 Database Tables

| Table | Purpose |
|-------|---------|
| `user_profiles` | Extended user profiles (name, email, bio, skills, is_superadmin) |
| `user_roles` | Many-to-many users ↔ roles |
| `roles` | Role definitions with JSONB permissions, department, hierarchy |
| `departments` | Organizational departments |
| `role_hierarchy_audit` | Audit trail for org chart changes |
| `accounts` | Client/customer accounts |
| `account_members` | User ↔ account membership |
| `account_kanban_configs` | Per-account kanban column configuration |
| `projects` | Core project entity |
| `project_assignments` | User assignments to projects (soft delete) |
| `project_stakeholders` | Project observers/approvers |
| `project_updates` | Journal-style project status updates |
| `project_issues` | Project blockers and problems |
| `tasks` | Individual work items within projects |
| `task_dependencies` | Task ordering constraints |
| `task_week_allocations` | Weekly task hour allocations |
| `time_entries` | Actual time worked on tasks |
| `clock_sessions` | Active clock-in/out sessions |
| `user_availability` | Weekly work capacity per user |
| `workflow_templates` | Reusable workflow definitions |
| `workflow_nodes` | Individual steps in workflow |
| `workflow_connections` | Valid transition paths between nodes |
| `workflow_instances` | Active workflow execution tied to project |
| `workflow_history` | Audit trail of workflow transitions |
| `workflow_active_steps` | Current active steps in workflow |
| `form_templates` | Reusable form definitions |
| `form_responses` | Submitted form data |
| `deliverables` | Project deliverables |
| `newsletters` | Company newsletters |
| `milestones` | Project milestones |

### 1.4 Key Components (by domain)

**Layout & Navigation:** app-layout, top-header, breadcrumb, sidebar/*, navigation, client-navigation, loading-overlay
**Auth:** login-form, demo-login-form, auth-provider-wrapper, role-guard, access-denied-page
**Dashboard:** dashboard/* (16 widgets), customize-modal
**Projects:** project-creation-dialog, project-data-table, project-hours-slider, project-updates-card, unified-projects-section, assigned-projects-section
**Tasks:** task-creation-dialog, task-create-edit-dialog
**Accounts:** account-list, account-overview, account-create-dialog, account-edit-dialog, accounts-client-wrapper, kanban-config-dialog
**Departments:** department-list, department-overview, department-create-dialog, department-delete-dialog, department-role-dialog, department-admin-tabs
**Org Chart:** org-chart/* (14 components including canvas, nodes, edges, permission-editor, role dialogs)
**Workflows:** workflow-editor/* (7 components), workflow-progress, workflow-progress-button, workflow-step-assignments, workflow-timeline, workflow-visualization, workflow-visualization-node
**Time Tracking:** clock-widget, clock-out-dialog, clock-widget-manager, time-entries-list, time-entries-summary, time-entries-chart, availability-calendar, drag-availability-calendar
**Capacity:** capacity-dashboard, capacity-trend-chart
**Analytics:** analytics/layout/*, analytics/widgets/* (8 widgets), analytics/network/*
**Newsletters:** newsletter-card, newsletter-creation-dialog, newsletter-edit-dialog, newsletter-delete-dialog
**Other:** user-inbox, milestone-dialog, inline-form-builder, not-found-content, setup-instructions

### 1.5 Lib & Services

**RBAC:** permissions.ts, permission-checker.ts, rbac.ts, rbac-types.ts, server-guards.ts, access-control-server.ts, permission-utils.ts
**Auth:** auth.ts, auth-server.ts, supabase.ts, supabase-server.ts
**Services:** account-service.ts, assignment-service.ts, department-service.ts, department-client-service.ts, form-service.ts, milestone-service.ts, newsletter-service.ts, project-updates-service.ts, project-issues-service.ts, all-project-updates-service.ts, role-management-service.ts, workflow-service.ts, workflow-execution-service.ts, workflow-validation.ts, client-portal-service.ts, organization-service.ts, user-approval-service.ts, task-service-db.ts
**Capacity/Time:** services/capacity-service.ts, services/time-entry-service.ts, services/availability-service.ts
**Utilities:** config.ts, constants.ts, debug-logger.ts, demo-mode.ts, api-demo-guard.ts, rate-limit.ts, utils.ts, validation.ts, validation-schemas.ts, validation-helpers.ts, superadmin-utils.ts, permission-toast.ts, animation-variants.ts
**Hooks:** hooks/useAuth.ts, hooks/use-data.ts, hooks/use-clock-widget-state.tsx
**Contexts:** contexts/AuthContext.tsx

---

## SECTION 2 - RBAC MATRIX

### 2.1 Active Permissions (non-deprecated)

| Permission | Description |
|------------|-------------|
| `manage_user_roles` | Create/edit/delete roles, assign/remove users |
| `manage_users` | Full user management |
| `manage_departments` | Create/edit/delete departments |
| `view_departments` | View departments user belongs to |
| `view_all_departments` | Override: view all departments |
| `manage_accounts` | Create/edit/delete accounts |
| `manage_users_in_accounts` | Assign/remove users from accounts |
| `view_accounts` | View accounts user has access to |
| `view_all_accounts` | Override: view all accounts |
| `manage_projects` | Create/edit/delete projects in assigned accounts |
| `view_projects` | View assigned projects |
| `view_all_projects` | Override: view all projects |
| `manage_all_projects` | Override: manage any project |
| `view_all_department_analytics` | Override: department analytics |
| `view_all_account_analytics` | Override: account analytics |
| `view_all_analytics` | Override: org-wide analytics |
| `edit_own_availability` | Set personal weekly availability |
| `view_team_capacity` | View team capacity metrics |
| `view_all_capacity` | Override: org-wide capacity |
| `manage_time` | Log and edit own time entries |
| `view_all_time_entries` | Override: view all time entries |
| `manage_workflows` | Create/edit/delete workflow templates |
| `execute_workflows` | Hand off work in workflows |
| `skip_workflow_nodes` | Out-of-order workflow execution |
| `manage_client_invites` | Manage client invitations |

### 2.2 Role-Permission Matrix

| Capability | Superadmin | CEO/Executive | Account Director | Account Manager | Strategist/PM | Designer/Dev | Analyst | Client | Intern | Unassigned |
|-----------|------------|---------------|------------------|-----------------|---------------|-------------|---------|--------|--------|------------|
| Admin dashboard | YES | YES | YES | NO | NO | NO | NO | NO | NO | NO |
| Role management | YES | YES | NO | NO | NO | NO | NO | NO | NO | NO |
| Workflow management | YES | YES | YES | NO | NO | NO | NO | NO | NO | NO |
| View all projects | YES | YES | YES | NO | NO | NO | NO | NO | NO | NO |
| Manage all projects | YES | YES | NO | NO | NO | NO | NO | NO | NO | NO |
| Create projects | YES | YES | YES | YES | YES | NO | NO | NO | NO | NO |
| View assigned projects | YES | YES | YES | YES | YES | YES | YES | NO | YES | NO |
| View all accounts | YES | YES | YES | NO | NO | NO | NO | NO | NO | NO |
| Manage accounts | YES | YES | YES | YES | NO | NO | NO | NO | NO | NO |
| View all analytics | YES | YES | NO | NO | NO | NO | YES | NO | NO | NO |
| View team capacity | YES | YES | YES | YES | YES | NO | YES | NO | NO | NO |
| View all time entries | YES | YES | NO | NO | NO | NO | NO | NO | NO | NO |
| Manage time | YES | YES | YES | YES | YES | YES | YES | NO | YES | NO |
| Execute workflows | YES | YES | YES | YES | YES | YES | NO | NO | NO | NO |
| Client portal | NO | NO | NO | NO | NO | NO | NO | YES | NO | NO |
| Welcome page only | NO | NO | NO | NO | NO | NO | NO | NO | NO | YES |

---

## SECTION 3 - TEST PERSONAS

| # | Name | Email | Role | Key Permissions |
|---|------|-------|------|-----------------|
| P01 | Sarah CEO | ceo@test.local | Superadmin | ALL - bypasses all checks |
| P02 | Alex Executive | exec@test.local | Executive Director | View all, manage accounts, analytics, workflows |
| P03 | Jordan Director | director@test.local | Account Director | View all accounts, manage projects, workflows |
| P04 | Morgan Manager | manager@test.local | Account Manager | Manage accounts they own, create projects |
| P05 | Pat Strategist | strategist@test.local | Strategist/PM | View/manage assigned projects, execute workflows |
| P06 | Dana Designer | designer@test.local | Senior Designer | View assigned projects, manage time, execute workflows |
| P07 | Robin Analyst | analyst@test.local | Analyst | View all analytics, view team capacity |
| P08 | Chris Client | client@test.local | Client | Client portal only - approve/reject projects |
| P09 | Taylor Intern | intern@test.local | Intern | Minimal - view assigned projects, manage own time |
| P10 | Sam Unassigned | unassigned@test.local | Unassigned | Welcome page only, pending role assignment |

---

## SECTION 4 - TEST PLAN

### Authentication (F001-F010)

#### F001 - Login with email/password
- **Area:** Both
- **Route:** `/login`, `/api/auth` (Supabase)
- **Test steps:** 1. Navigate to /login 2. Enter valid email and password 3. Click Sign In 4. Verify redirect to /welcome
- **Personas:** P01-P10 (all should succeed with correct credentials)
- **RBAC:** No role restriction on login itself
- **Edge cases:** Wrong password, non-existent email, empty fields, SQL injection in email
- **Status:** NOT STARTED

#### F002 - Signup
- **Area:** Both
- **Route:** `/signup`
- **Test steps:** 1. Navigate to /signup 2. Fill name, email, password 3. Submit 4. Verify redirect to /pending-approval
- **Personas:** New user (not in system)
- **RBAC:** New users get "Unassigned" role
- **Edge cases:** Duplicate email, weak password, empty fields, XSS in name
- **Status:** NOT STARTED

#### F003 - Logout
- **Area:** Frontend
- **Route:** Sidebar user menu, top header
- **Test steps:** 1. Click user avatar 2. Click Sign Out 3. Verify redirect to /login 4. Verify cannot access protected pages
- **Personas:** P01-P09
- **Edge cases:** Network error during logout, back button after logout
- **Status:** NOT STARTED

#### F004 - Forgot password
- **Area:** Both
- **Route:** `/forgot-password`
- **Test steps:** 1. Navigate to /forgot-password 2. Enter email 3. Submit 4. Verify success message
- **Personas:** Any registered user
- **Edge cases:** Non-existent email, empty email, rapid submissions
- **Status:** NOT STARTED

#### F005 - Reset password
- **Area:** Both
- **Route:** `/reset-password`
- **Test steps:** 1. Click reset link from email 2. Enter new password 3. Confirm password 4. Submit 5. Verify redirect to /login
- **Edge cases:** Expired token, password mismatch, short password, direct URL without token
- **Status:** NOT STARTED

#### F006 - Session expiry
- **Area:** Both
- **Test steps:** 1. Log in 2. Wait for session to expire (or manually clear cookies) 3. Try to access a protected page 4. Verify redirect to login
- **Status:** NOT STARTED

#### F007 - Auth callback
- **Area:** Backend
- **Route:** `/auth/callback`
- **Test steps:** 1. Verify OAuth callback processes correctly 2. Check session cookies are set 3. Verify redirect based on type param
- **Status:** NOT STARTED

#### F008 - Demo login
- **Area:** Frontend
- **Route:** `/login` (demo mode)
- **Test steps:** 1. Enable demo mode 2. Navigate to /login 3. Verify demo user cards appear 4. Click a demo user 5. Verify login succeeds
- **Personas:** All 7 demo users
- **Status:** NOT STARTED

#### F009 - Setup (first superadmin)
- **Area:** Both
- **Route:** `/setup`, `/api/setup`
- **Test steps:** 1. GET /api/setup should show available 2. Navigate to /setup 3. Enter setup secret 4. Submit 5. Verify user promoted to superadmin
- **Edge cases:** Wrong secret, setup already completed, unauthenticated user
- **Status:** NOT STARTED

#### F010 - Pending approval page
- **Area:** Frontend
- **Route:** `/pending-approval`
- **Test steps:** 1. Log in as unassigned user 2. Verify redirect to /pending-approval 3. Verify page shows user info 4. Test "Request Approval" button
- **Personas:** P10
- **Status:** NOT STARTED

### Navigation & Layout (F011-F015)

#### F011 - Sidebar navigation
- **Area:** Frontend
- **Route:** All authenticated pages
- **Test steps:** 1. Verify sidebar shows correct items per role 2. Click each nav item 3. Verify correct page loads 4. Verify active state indicator
- **Personas:** P01 (all items), P06 (limited items), P08 (client nav), P10 (welcome only)
- **Status:** NOT STARTED

#### F012 - Breadcrumb navigation
- **Area:** Frontend
- **Test steps:** 1. Navigate to a nested page 2. Verify breadcrumb shows correct path 3. Click each breadcrumb segment 4. Verify navigation works
- **Status:** NOT STARTED

#### F013 - Mobile responsive layout
- **Area:** Frontend
- **Test steps:** 1. Resize to mobile (375px) 2. Verify sidebar collapses 3. Verify hamburger menu works 4. Verify content is not cut off 5. Test at 768px (tablet) and 1024px (desktop)
- **Status:** NOT STARTED

#### F014 - Top header
- **Area:** Frontend
- **Test steps:** 1. Verify clock widget button 2. Verify user avatar dropdown 3. Verify time entries link 4. Test sign out from dropdown
- **Status:** NOT STARTED

#### F015 - 404 page
- **Area:** Frontend
- **Route:** `/nonexistent-page`
- **Test steps:** 1. Navigate to invalid URL 2. Verify 404 page renders 3. Verify back link works
- **Status:** NOT STARTED

### Dashboard (F016-F025)

#### F016 - Dashboard page render
- **Area:** Frontend
- **Route:** `/dashboard`
- **Test steps:** 1. Navigate to /dashboard 2. Verify page loads without errors 3. Verify all widget cards render 4. Verify capacity trend chart shows data
- **Personas:** P01-P07, P09 (should load), P08/P10 (should not access)
- **Status:** NOT STARTED

#### F017 - Dashboard customize modal
- **Area:** Frontend
- **Test steps:** 1. Click "Edit Layout" 2. Toggle widget visibility 3. Save 4. Verify changes persist across page refresh
- **Status:** NOT STARTED

#### F018 - My tasks widget
- **Area:** Frontend
- **Test steps:** 1. Verify assigned tasks appear 2. Verify task status badges 3. Verify click navigates to project
- **Status:** NOT STARTED

#### F019 - My time widget
- **Area:** Frontend
- **Test steps:** 1. Verify clock in/out button works 2. Verify elapsed time display 3. Verify logged hours summary
- **Status:** NOT STARTED

#### F020 - My accounts widget
- **Area:** Frontend
- **Test steps:** 1. Verify assigned accounts appear 2. Verify click navigates to account
- **Status:** NOT STARTED

#### F021 - My workflows widget
- **Area:** Frontend
- **Test steps:** 1. Verify active workflow steps appear 2. Verify "Send to Next Step" button
- **Status:** NOT STARTED

#### F022 - Recent activity widget
- **Area:** Frontend
- **Test steps:** 1. Verify recent events appear 2. Verify timestamps are correct
- **Status:** NOT STARTED

#### F023 - Upcoming deadlines widget
- **Area:** Frontend
- **Test steps:** 1. Verify upcoming deadlines show 2. Verify overdue items highlighted
- **Status:** NOT STARTED

#### F024 - Task completion trend widget
- **Area:** Frontend
- **Test steps:** 1. Verify chart renders 2. Verify data matches actual task completions
- **Status:** NOT STARTED

#### F025 - Log time dialog
- **Area:** Both
- **Route:** Dashboard > Log Time
- **Test steps:** 1. Click log time 2. Select project and task 3. Enter hours 4. Submit 5. Verify time entry created
- **Edge cases:** 0 hours, >24 hours, no project selected, no task selected
- **Status:** NOT STARTED

### Projects (F026-F040)

#### F026 - Projects list page
- **Area:** Both
- **Route:** `/projects`
- **Test steps:** 1. Navigate to /projects 2. Verify table renders 3. Verify department filter 4. Verify column sorting 5. Verify row click navigates to detail
- **Personas:** P01 (sees all), P06 (sees assigned only), P10 (redirected)
- **Status:** NOT STARTED

#### F027 - Create project
- **Area:** Both
- **Route:** `/projects` > Create Project button
- **Test steps:** 1. Click Create Project 2. Fill name, account, dates, hours, priority 3. Select workflow 4. Submit 5. Verify project appears in list
- **Personas:** P01-P05 (can create), P06-P10 (cannot)
- **Edge cases:** Empty name, no account selected, invalid dates
- **Status:** NOT STARTED

#### F028 - Project detail page
- **Area:** Both
- **Route:** `/projects/[projectId]`
- **Test steps:** 1. Navigate to project detail 2. Verify header info 3. Verify workflow progress 4. Verify all sections render (notes, tasks, updates, issues)
- **Personas:** P01-P06 (can view), P08/P10 (cannot)
- **Status:** NOT STARTED

#### F029 - Edit project
- **Area:** Both
- **Test steps:** 1. Click Edit Project 2. Modify fields 3. Save 4. Verify changes persist
- **Personas:** P01-P04 (can edit), P06 (cannot)
- **Status:** NOT STARTED

#### F030 - Project tasks CRUD
- **Area:** Both
- **Test steps:** 1. Create a new task 2. Edit task details 3. Change task status 4. Delete task 5. Verify task list updates
- **Edge cases:** Task with no name, task assignment to non-project-member
- **Status:** NOT STARTED

#### F031 - Task Kanban view
- **Area:** Frontend
- **Test steps:** 1. Click Kanban toggle 2. Verify columns render 3. Drag task between columns 4. Verify status updates
- **Status:** NOT STARTED

#### F032 - Task Gantt view
- **Area:** Frontend
- **Test steps:** 1. Click Gantt toggle 2. Verify timeline renders 3. Verify task bars positioned correctly
- **Status:** NOT STARTED

#### F033 - Project updates CRUD
- **Area:** Both
- **Test steps:** 1. Click New Update 2. Enter content 3. Submit 4. Verify appears in list 5. Edit own update 6. Delete own update
- **RBAC:** Can only edit/delete own updates
- **Status:** NOT STARTED

#### F034 - Project issues CRUD
- **Area:** Both
- **Test steps:** 1. Click Report Issue 2. Enter content 3. Submit 4. Verify appears in list 5. Resolve issue 6. Delete own issue
- **RBAC:** Can only delete own issues
- **Status:** NOT STARTED

#### F035 - Project team management
- **Area:** Both
- **Test steps:** 1. Click Add team member 2. Search for user 3. Assign to project 4. Verify user appears in team 5. Remove user
- **Status:** NOT STARTED

#### F036 - Project workflow progress
- **Area:** Both
- **Test steps:** 1. View current workflow step 2. Click "Send to Next Step" 3. Fill form if required 4. Verify transition 5. Verify history records
- **Personas:** P01-P06 (assigned users)
- **Status:** NOT STARTED

#### F037 - Project complete/reopen
- **Area:** Both
- **Test steps:** 1. Complete a project 2. Verify status changes to complete 3. Verify tasks become read-only 4. Reopen project 5. Verify tasks editable again
- **Status:** NOT STARTED

#### F038 - Project hours slider
- **Area:** Frontend
- **Test steps:** 1. Find a project with estimated hours 2. Drag the remaining hours slider 3. Verify save on release (not every tick) 4. Verify 0 hours shows 100% complete
- **Status:** NOT STARTED

#### F039 - Project notes
- **Area:** Both
- **Test steps:** 1. Click Edit on Project Notes 2. Enter text 3. Save 4. Verify markdown renders
- **Status:** NOT STARTED

#### F040 - Project stakeholders
- **Area:** Both
- **Test steps:** 1. View stakeholders list 2. Add stakeholder 3. Remove stakeholder
- **Status:** NOT STARTED

### Accounts (F041-F050)

#### F041 - Accounts list page
- **Area:** Both
- **Route:** `/accounts`
- **Test steps:** 1. Navigate to /accounts 2. Verify account cards render 3. Test search filter 4. Click View Details
- **Personas:** P01-P04 (can view), P06 (only assigned), P10 (cannot)
- **Status:** NOT STARTED

#### F042 - Create account
- **Area:** Both
- **Test steps:** 1. Click Create Account 2. Fill form 3. Submit 4. Verify account appears
- **Edge cases:** Duplicate name, empty name
- **Status:** NOT STARTED

#### F043 - Edit account
- **Area:** Both
- **Route:** `/accounts/[accountId]`
- **Test steps:** 1. Navigate to account 2. Click edit 3. Modify fields 4. Save
- **Status:** NOT STARTED

#### F044 - Account members management
- **Area:** Both
- **Test steps:** 1. Navigate to account 2. Add member 3. Remove member 4. Verify member list updates
- **Status:** NOT STARTED

#### F045 - Account kanban config
- **Area:** Both
- **Test steps:** 1. Open kanban config 2. Add column 3. Reorder columns 4. Remove column 5. Save
- **Edge cases:** Duplicate column names
- **Status:** NOT STARTED

#### F046 - Account detail page
- **Area:** Both
- **Test steps:** 1. Navigate to account detail 2. Verify project list 3. Verify metrics 4. Verify tabs
- **Status:** NOT STARTED

#### F047 - Client invitation
- **Area:** Both
- **Route:** `/admin/client-portal`
- **Test steps:** 1. Select account 2. Enter client email 3. Send invitation 4. Verify invitation appears in list
- **Personas:** P01-P03 (can invite)
- **Edge cases:** Invalid email, duplicate invitation
- **Status:** NOT STARTED

#### F048 - Client accept invite
- **Area:** Both
- **Route:** `/api/client/accept-invite/[token]`
- **Test steps:** 1. Click invite link 2. Create account or login 3. Verify client portal access
- **Status:** NOT STARTED

#### F049 - Client portal
- **Area:** Both
- **Test steps:** 1. Log in as client 2. Verify limited project view 3. Approve project 4. Reject project 5. Submit feedback
- **Personas:** P08 (client)
- **Status:** NOT STARTED

#### F050 - Client feedback
- **Area:** Both
- **Route:** `/admin/client-feedback`
- **Test steps:** 1. Navigate to client feedback 2. Select account 3. View feedback entries 4. Click to see detail
- **Status:** NOT STARTED

### Departments (F051-F058)

#### F051 - Departments list page
- **Area:** Both
- **Route:** `/departments`
- **Test steps:** 1. Navigate to /departments 2. Verify department cards 3. Check health scores 4. Check metrics
- **Status:** NOT STARTED

#### F052 - Create department
- **Area:** Both
- **Test steps:** 1. Click Create Department 2. Enter name and description 3. Submit 4. Verify appears in list
- **Personas:** P01-P02 (can create)
- **Status:** NOT STARTED

#### F053 - Delete department
- **Area:** Both
- **Test steps:** 1. Click delete on department 2. Confirm 3. Verify removed from list 4. Verify roles unlinked (not deleted)
- **Status:** NOT STARTED

#### F054 - Department detail page
- **Area:** Frontend
- **Route:** `/departments/[departmentId]`
- **Test steps:** 1. Navigate to department 2. Verify members list 3. Verify active projects 4. Verify metrics
- **Status:** NOT STARTED

#### F055 - Department admin page
- **Area:** Both
- **Route:** `/departments/[departmentId]/admin`
- **Test steps:** 1. Navigate to department admin 2. Verify tabs (Roles, Members, Settings) 3. Create role in department 4. Edit department settings
- **Personas:** P01-P02 (admin access), P06 (denied)
- **Status:** NOT STARTED

#### F056 - Department role creation
- **Area:** Both
- **Test steps:** 1. Open role dialog 2. Enter name 3. Set permissions 4. Save 5. Verify role uses correct permission keys
- **Status:** NOT STARTED

#### F057 - Department overview metrics
- **Area:** Frontend
- **Test steps:** 1. View department page 2. Verify project count 3. Verify team size 4. Verify capacity utilization 5. Verify health score
- **Status:** NOT STARTED

#### F058 - Department member list
- **Area:** Frontend
- **Test steps:** 1. View department 2. Verify members are dynamically derived from project assignments 3. Add user to project in department 4. Verify user appears in department members
- **Status:** NOT STARTED

### Roles & RBAC (F059-F067)

#### F059 - Role management page
- **Area:** Both
- **Route:** `/admin/roles`
- **Test steps:** 1. Navigate to /admin/roles 2. Verify hierarchy view 3. Verify department view 4. Verify accounts view
- **Personas:** P01 (full access), P02 (with MANAGE_USER_ROLES), P06 (denied)
- **Status:** NOT STARTED

#### F060 - Create role
- **Area:** Both
- **Test steps:** 1. Click Create Role 2. Enter name, description, department 3. Set permissions 4. Save 5. Verify appears in hierarchy
- **Status:** NOT STARTED

#### F061 - Edit role
- **Area:** Both
- **Test steps:** 1. Click edit on role 2. Modify name/permissions 3. Save 4. Verify changes persist
- **Status:** NOT STARTED

#### F062 - Delete role
- **Area:** Both
- **Test steps:** 1. Click delete on role 2. Confirm 3. Verify role removed 4. Verify users reassigned to Unassigned
- **Edge cases:** Delete system role (should be blocked), delete role with users
- **Status:** NOT STARTED

#### F063 - Assign user to role
- **Area:** Both
- **Test steps:** 1. Click assign user on role 2. Search for user 3. Assign 4. Verify user appears under role 5. Verify permission cache cleared
- **Status:** NOT STARTED

#### F064 - Remove user from role
- **Area:** Both
- **Test steps:** 1. Click remove on user 2. Confirm 3. Verify user removed 4. Verify permission cache cleared
- **Edge cases:** Removing last role from user
- **Status:** NOT STARTED

#### F065 - Role hierarchy drag-and-drop
- **Area:** Frontend
- **Test steps:** 1. Drag role to new position 2. Verify reporting structure updates 3. Verify level numbers update
- **Status:** NOT STARTED

#### F066 - Permission editor
- **Area:** Frontend
- **Test steps:** 1. Click edit permissions on role 2. Toggle permissions 3. Save 4. Verify permission changes affect user access
- **Status:** NOT STARTED

#### F067 - RBAC diagnostics
- **Area:** Both
- **Route:** `/admin/rbac-diagnostics`
- **Test steps:** 1. Navigate to diagnostics 2. Select user 3. Run permission test 4. Verify results match expected
- **Personas:** P01 (superadmin)
- **Status:** NOT STARTED

### Workflows (F068-F078)

#### F068 - Workflow templates list
- **Area:** Both
- **Route:** `/admin/workflows`
- **Test steps:** 1. Navigate to /admin/workflows 2. Verify templates list 3. Verify active/inactive badges 4. Test create button
- **Status:** NOT STARTED

#### F069 - Create workflow template
- **Area:** Both
- **Test steps:** 1. Click Create Workflow 2. Enter name 3. Verify template created 4. Navigate to editor
- **Status:** NOT STARTED

#### F070 - Workflow editor - node creation
- **Area:** Frontend
- **Route:** `/admin/workflows/[id]/edit`
- **Test steps:** 1. Drag Start node 2. Drag Role node 3. Drag Approval node 4. Drag Form node 5. Drag Conditional node 6. Drag End node 7. Verify all render correctly
- **Status:** NOT STARTED

#### F071 - Workflow editor - connections
- **Area:** Frontend
- **Test steps:** 1. Connect start to role 2. Connect role to approval 3. Verify arrow renders 4. Test self-loop prevention 5. Test cycle detection
- **Status:** NOT STARTED

#### F072 - Workflow editor - node config
- **Area:** Frontend
- **Test steps:** 1. Double-click role node 2. Select role 3. Save 4. Double-click approval node 5. Select approver role 6. Save 7. Double-click form node 8. Add fields 9. Save
- **Status:** NOT STARTED

#### F073 - Workflow editor - conditional branches
- **Area:** Frontend
- **Test steps:** 1. Create form node with dropdown field 2. Create conditional node 3. Connect form to conditional 4. Configure branches based on dropdown values 5. Connect branches to different nodes
- **Status:** NOT STARTED

#### F074 - Workflow save and validation
- **Area:** Both
- **Test steps:** 1. Create valid workflow 2. Save 3. Verify saved to database 4. Try saving without start node (should error) 5. Try saving with unconfigured nodes (should error)
- **Status:** NOT STARTED

#### F075 - Workflow activation/deactivation
- **Area:** Both
- **Test steps:** 1. Toggle workflow active/inactive 2. Verify inactive workflows cannot be assigned to projects
- **Status:** NOT STARTED

#### F076 - Workflow execution - start
- **Area:** Both
- **Test steps:** 1. Create project with workflow 2. Verify workflow instance created 3. Verify current step matches start → first node
- **Status:** NOT STARTED

#### F077 - Workflow execution - progress
- **Area:** Both
- **Test steps:** 1. Navigate to project 2. Click "Send to Next Step" 3. Fill form if required 4. Verify transition 5. Check workflow history
- **Status:** NOT STARTED

#### F078 - Workflow execution - approval
- **Area:** Both
- **Test steps:** 1. Reach approval node 2. Approve 3. Verify continues to next node 4. Test rejection path 5. Verify form data preserved
- **Status:** NOT STARTED

### Time Tracking & Capacity (F079-F090)

#### F079 - Clock in
- **Area:** Both
- **Test steps:** 1. Click clock in 2. Verify session starts 3. Verify timer counts up 4. Verify only one active session (race condition fix)
- **Status:** NOT STARTED

#### F080 - Clock out
- **Area:** Both
- **Test steps:** 1. Click clock out 2. Allocate hours to projects/tasks 3. Submit 4. Verify time entries created 5. Verify session ends
- **Status:** NOT STARTED

#### F081 - Clock discard
- **Area:** Both
- **Test steps:** 1. Clock in 2. Click discard 3. Verify session removed without time entries
- **Status:** NOT STARTED

#### F082 - Time entries page
- **Area:** Both
- **Route:** `/time-entries`
- **Test steps:** 1. Navigate to time entries 2. Verify summary cards 3. Test date filter 4. Test project filter 5. Test list view 6. Test chart view
- **Status:** NOT STARTED

#### F083 - Edit time entry
- **Area:** Both
- **Test steps:** 1. Click edit on time entry 2. Modify hours 3. Save 4. Verify 14-day edit window enforced
- **Status:** NOT STARTED

#### F084 - Delete time entry
- **Area:** Both
- **Test steps:** 1. Click delete on time entry 2. Confirm 3. Verify removed from list
- **Status:** NOT STARTED

#### F085 - Admin time tracking
- **Area:** Both
- **Route:** `/admin/time-tracking`
- **Test steps:** 1. Navigate to admin time tracking 2. Verify all users' entries visible 3. Filter by user/date/project 4. Edit entry 5. Delete entry
- **Personas:** P01 (full access), P06 (denied)
- **Status:** NOT STARTED

#### F086 - Capacity page
- **Area:** Both
- **Route:** `/capacity`
- **Test steps:** 1. Navigate to /capacity 2. Verify capacity dashboard 3. Verify availability calendar 4. Test drag-to-set availability
- **Status:** NOT STARTED

#### F087 - Set availability
- **Area:** Both
- **Test steps:** 1. Open availability calendar 2. Drag to set hours per day 3. Verify save 4. Verify week totals update
- **Status:** NOT STARTED

#### F088 - Capacity trend chart
- **Area:** Frontend
- **Test steps:** 1. View capacity dashboard 2. Toggle daily/weekly/monthly/quarterly 3. Verify chart updates 4. Verify metrics cards (utilization, available, allocated, actual)
- **Status:** NOT STARTED

#### F089 - Auto clock-out
- **Area:** Backend
- **Test steps:** 1. Create a clock session older than 16 hours 2. Trigger time entry service 3. Verify session auto-closed with is_auto_clock_out=true
- **Status:** NOT STARTED

#### F090 - Log time dialog
- **Area:** Both
- **Test steps:** 1. Open log time dialog from dashboard 2. Select project 3. Select task 4. Enter hours and description 5. Submit 6. Verify time entry created
- **Status:** NOT STARTED

### Analytics (F091-F098)

#### F091 - Analytics page render
- **Area:** Frontend
- **Route:** `/analytics`
- **Test steps:** 1. Navigate to /analytics 2. Verify summary stats 3. Verify tabs (Overview, Projects, Team, Accounts, Time, Workflows, Network) 4. Click each tab
- **Personas:** P01 (full access), P07 (analytics access), P06 (denied)
- **Status:** NOT STARTED

#### F092 - Capacity utilization widget
- **Area:** Frontend
- **Test steps:** 1. View utilization widget 2. Toggle time period 3. Verify trend/comparison views 4. Test CSV export
- **Status:** NOT STARTED

#### F093 - Project analytics widget
- **Area:** Frontend
- **Test steps:** 1. View project analytics 2. Verify pie chart 3. Verify project table 4. Test CSV export
- **Status:** NOT STARTED

#### F094 - Team performance widget
- **Area:** Frontend
- **Test steps:** 1. View team performance 2. Verify member metrics 3. Test filtering
- **Status:** NOT STARTED

#### F095 - Account insights widget
- **Area:** Frontend
- **Test steps:** 1. View account insights 2. Verify account table 3. Verify metrics per account
- **Status:** NOT STARTED

#### F096 - Time distribution widget
- **Area:** Frontend
- **Test steps:** 1. View time distribution 2. Verify chart types 3. Test period filter
- **Status:** NOT STARTED

#### F097 - Workflow analytics widget
- **Area:** Frontend
- **Test steps:** 1. View workflow analytics 2. Verify bottleneck visualization
- **Status:** NOT STARTED

#### F098 - Network graph widget
- **Area:** Frontend
- **Test steps:** 1. View network graph 2. Verify nodes render 3. Verify edges connect collaborators
- **Status:** NOT STARTED

### Profile & User Management (F099-F105)

#### F099 - Profile page
- **Area:** Both
- **Route:** `/profile`
- **Test steps:** 1. Navigate to /profile 2. Verify user info displays 3. Edit name 4. Edit bio 5. Add/remove skills 6. Save 7. Verify email is read-only
- **Status:** NOT STARTED

#### F100 - Change password
- **Area:** Both
- **Test steps:** 1. Navigate to /profile 2. Click Change Password 3. Enter current + new password 4. Submit 5. Verify success
- **Edge cases:** Wrong current password, weak new password, matching passwords
- **Status:** NOT STARTED

#### F101 - Pending users approval
- **Area:** Both
- **Route:** `/admin/users/pending`
- **Test steps:** 1. Navigate to pending users 2. Verify pending users list 3. Approve user 4. Verify user gets role 5. Reject user
- **Personas:** P01-P02 (can approve)
- **Status:** NOT STARTED

#### F102 - Superadmin setup
- **Area:** Both
- **Route:** `/admin/superadmin-setup`
- **Test steps:** 1. Navigate to superadmin setup 2. Assign superadmin by email 3. Remove superadmin 4. Verify separate input fields
- **Personas:** P01 (superadmin only)
- **Status:** NOT STARTED

#### F103 - User inbox
- **Area:** Frontend
- **Test steps:** 1. View user inbox 2. Verify pending approvals appear 3. Verify assigned projects appear
- **Status:** NOT STARTED

#### F104 - Newsletter CRUD
- **Area:** Both
- **Test steps:** 1. Create newsletter 2. Edit newsletter 3. Publish newsletter 4. Delete newsletter 5. Verify on welcome page
- **Status:** NOT STARTED

#### F105 - Welcome page
- **Area:** Frontend
- **Route:** `/welcome`
- **Test steps:** 1. Navigate to /welcome 2. Verify greeting 3. Verify project updates feed 4. Verify newsletter section
- **Personas:** P01-P10 (all can access)
- **Status:** NOT STARTED

### API Security (F106-F115)

#### F106 - Unauthenticated API access
- **Area:** Backend
- **Test steps:** 1. Call each protected API endpoint without auth headers 2. Verify 401 response for all
- **Status:** NOT STARTED

#### F107 - Cross-role API access
- **Area:** Backend
- **Test steps:** 1. Log in as P09 (intern) 2. Try to call admin-only endpoints 3. Verify 403 response
- **Status:** NOT STARTED

#### F108 - UUID validation on API routes
- **Area:** Backend
- **Test steps:** 1. Call routes with invalid UUIDs (e.g., "abc", "123") 2. Verify 400 "Invalid ID format" response
- **Status:** NOT STARTED

#### F109 - Malformed request bodies
- **Area:** Backend
- **Test steps:** 1. Send invalid JSON to POST/PUT endpoints 2. Verify 400 response 3. Send missing required fields 4. Verify appropriate error
- **Status:** NOT STARTED

#### F110 - Project ownership enforcement
- **Area:** Backend
- **Test steps:** 1. As P06 (designer) try to edit P04's (manager's) project update 2. Verify denied 3. Try to delete P04's issue 4. Verify denied
- **Status:** NOT STARTED

#### F111 - Cross-account data access
- **Area:** Backend
- **Test steps:** 1. As P06 (assigned to Account A) 2. Try to access Account B's data 3. Verify denied
- **Status:** NOT STARTED

#### F112 - Setup endpoint security
- **Area:** Backend
- **Test steps:** 1. GET /api/setup - verify no internal details leaked 2. POST /api/setup with wrong secret - verify denied 3. POST after superadmin exists - verify denied without email leak
- **Status:** NOT STARTED

#### F113 - Cron endpoint security
- **Area:** Backend
- **Test steps:** 1. Call without CRON_SECRET - verify denied 2. Call with wrong secret - verify 401 3. Call without demo mode - verify 403
- **Status:** NOT STARTED

#### F114 - Client portal isolation
- **Area:** Backend
- **Test steps:** 1. As P08 (client) access client portal endpoints 2. Verify can only see assigned projects 3. Try to access non-client endpoints 4. Verify denied
- **Status:** NOT STARTED

#### F115 - Rate limiting
- **Area:** Backend
- **Test steps:** 1. Send rapid requests to auth endpoints 2. Verify rate limit response after threshold
- **Status:** NOT STARTED

### Edge Cases & Error States (F116-F125)

#### F116 - Empty states
- **Area:** Frontend
- **Test steps:** 1. View projects page with no projects 2. View accounts page with no accounts 3. View dashboard with no data 4. Verify all show appropriate empty state messages
- **Status:** NOT STARTED

#### F117 - Error boundaries
- **Area:** Frontend
- **Test steps:** 1. Trigger an error (e.g., navigate to corrupted data) 2. Verify error boundary catches 3. Verify "Try again" button works
- **Status:** NOT STARTED

#### F118 - Loading states
- **Area:** Frontend
- **Test steps:** 1. Navigate to each page 2. Verify loading spinner or skeleton appears before data loads
- **Status:** NOT STARTED

#### F119 - Database unavailable
- **Area:** Both
- **Test steps:** 1. Simulate Supabase unavailable 2. Verify graceful error handling in pages and API routes
- **Status:** NOT STARTED

#### F120 - Long text handling
- **Area:** Frontend
- **Test steps:** 1. Create project with very long name 2. Create task with very long description 3. Verify text truncates or wraps properly 4. Verify no overflow
- **Status:** NOT STARTED

#### F121 - Special characters
- **Area:** Both
- **Test steps:** 1. Enter HTML in text fields 2. Enter SQL-like strings 3. Enter unicode/emoji 4. Verify XSS prevention 5. Verify correct display
- **Status:** NOT STARTED

#### F122 - Concurrent operations
- **Area:** Backend
- **Test steps:** 1. Two users edit same project simultaneously 2. Two users clock in at same time 3. Verify no data corruption
- **Status:** NOT STARTED

#### F123 - Browser back/forward
- **Area:** Frontend
- **Test steps:** 1. Navigate through several pages 2. Press back 3. Verify correct page loads 4. Press forward 5. Verify correct page loads
- **Status:** NOT STARTED

#### F124 - Session handling across tabs
- **Area:** Frontend
- **Test steps:** 1. Open app in two tabs 2. Log out in one tab 3. Verify other tab detects logout
- **Status:** NOT STARTED

#### F125 - Demo mode restrictions
- **Area:** Both
- **Test steps:** 1. Enable demo mode 2. Try destructive actions (delete account, delete role) 3. Verify blocked with message
- **Status:** NOT STARTED

---

## SECTION 5 - AUDIT LOG FORMAT

Each entry in FULLAUDIT.md should follow this template:

```
## FXXX - Feature Name
- **Status:** PASS | FAIL | FIXED | SKIPPED
- **Tested by personas:** P01, P02, ...
- **Date:** YYYY-MM-DD HH:MM
- **Issues found:** description or none
- **Fix applied:** description or N/A
- **Files modified:** list or none
- **Retested after fix:** YES | NO
- **Final status:** PASS | FAIL
```

The top of FULLAUDIT.md should have cumulative stats:

```
## Audit Progress
- **Total:** XXX
- **Passed:** XX
- **Failed:** XX
- **Fixed:** XX
- **Skipped:** XX
- **Remaining:** XX
- **Last updated:** YYYY-MM-DD HH:MM
```

---

## END OF AUDIT PROMPT
