# MovaLab Core Features - Part 1 of 4

**Last Updated:** December 22, 2025
**Status:** Production-Ready
**Total Features Documented:** ~40 Permissions, 48+ Tables, 80+ API Routes, 100+ Components

---

## 1. AUTHENTICATION & USER MANAGEMENT

### 1.1 Authentication System
| Feature | Location | Access |
|---------|----------|--------|
| Email/password auth | `/app/login`, `/app/signup` | Public |
| OAuth integration | `lib/auth.ts` | Public |
| Password reset | `/forgot-password`, `/reset-password` | Public |
| Email verification | Supabase Auth | Public |
| Session management | Cookie-based, 3 client types | All |

**Key Files:** `lib/auth.ts`, `lib/auth-server.ts`, `lib/supabase.ts`

**Three Supabase Client Types:**
- **Server Components:** `createServerSupabase()` - SSR, no JS to client
- **API Routes:** `createApiSupabaseClient(request)` - Maintains auth context
- **Client Components:** `createClientSupabase()` - Browser-side, real-time

### 1.2 User Registration & Approval
| Feature | API Route | Permission |
|---------|-----------|------------|
| Self-registration | `POST /api/users` | Public |
| Approval queue | `GET /api/users/pending` | `MANAGE_USER_ROLES` |
| Approve users | `POST /api/users/approve` | `MANAGE_USER_ROLES` |
| Bulk approval | Admin UI | `MANAGE_USER_ROLES` |

**Location:** `/app/pending-approval`, `/app/admin/users/pending`
**Service:** `lib/user-approval-service.ts`
**Features:** Email notifications, rejection with reason, auto "Unassigned" role assignment

### 1.3 User Profiles
| Feature | API | Access |
|---------|-----|--------|
| Edit profile | `PUT /api/profile` | Own profile |
| Avatar upload | Image field | Own profile |
| Workload sentiment | 3 states: comfortable/stretched/overwhelmed | Own profile |
| Skills tags | Array field | Own profile |

**Location:** `/app/profile/page.tsx`
**Database:** `user_profiles` table
**Fields:** name, bio, image, skills[], workload_sentiment, is_superadmin

---

## 2. ROLE-BASED ACCESS CONTROL (RBAC)

### 2.1 Permission System (~40 Permissions)

**Post-Phase 9 Consolidation:** Reduced from 136 → 58 → **40 permissions**

| Category | Permissions | Count |
|----------|-------------|-------|
| **Role Management** | `MANAGE_USER_ROLES`, `MANAGE_USERS` | 2 |
| **Departments** | `MANAGE_DEPARTMENTS`, `VIEW_DEPARTMENTS`, `VIEW_ALL_DEPARTMENTS`, `MANAGE_USERS_IN_DEPARTMENTS` | 4 |
| **Accounts** | `MANAGE_ACCOUNTS`, `VIEW_ACCOUNTS`, `VIEW_ALL_ACCOUNTS`, `MANAGE_USERS_IN_ACCOUNTS` | 4 |
| **Projects** | `MANAGE_PROJECTS`, `VIEW_PROJECTS`, `VIEW_ALL_PROJECTS`, `MANAGE_ALL_PROJECTS` | 4 |
| **Updates** | `MANAGE_UPDATES`, `VIEW_UPDATES`, `VIEW_ALL_UPDATES` | 3 |
| **Issues** | `MANAGE_ISSUES`, `VIEW_ISSUES` | 2 |
| **Newsletters** | `MANAGE_NEWSLETTERS`, `VIEW_NEWSLETTERS` | 2 |
| **Analytics** | `VIEW_ALL_ANALYTICS`, `VIEW_ALL_DEPARTMENT_ANALYTICS`, `VIEW_ALL_ACCOUNT_ANALYTICS` | 3 |
| **Capacity** | `VIEW_TEAM_CAPACITY`, `VIEW_ALL_CAPACITY` | 2 |
| **Time Tracking** | `MANAGE_TIME`, `VIEW_TIME_ENTRIES`, `VIEW_ALL_TIME_ENTRIES` | 3 |
| **Workflows** | `MANAGE_WORKFLOWS`, `EXECUTE_WORKFLOWS`, `SKIP_WORKFLOW_NODES`, `MANAGE_ALL_WORKFLOWS`, `EXECUTE_ANY_WORKFLOW` | 5 |
| **Deliverables** | `MANAGE_DELIVERABLES`, `APPROVE_DELIVERABLE`, `REJECT_DELIVERABLE` | 3 |
| **Client Portal** | `MANAGE_CLIENT_INVITES` | 1 |

**Key Files:**
- `lib/permissions.ts` - Permission enum definitions
- `lib/permission-checker.ts` - Evaluation engine (5-min cache)
- `lib/rbac.ts` - Helper functions
- `lib/rbac-types.ts` - TypeScript types

**Permission Model:**
1. **Base Permissions:** Standard role-based (e.g., `VIEW_PROJECTS`)
2. **Override Permissions:** Global access (e.g., `VIEW_ALL_PROJECTS`)
3. **Context-Aware:** Dynamic based on relationships (assignment, ownership, hierarchy)

**Evaluation Flow:**
```
1. Superadmin? → ALLOW
2. Override permission (VIEW_ALL_*)? → ALLOW
3. Base permission + context? → ALLOW if both
4. Hierarchical permissions? → ALLOW if inherited
5. Otherwise → DENY
```

### 2.2 Role Management

**Visual Org Chart Editor:**
| Feature | Technology | Location |
|---------|-----------|----------|
| Drag-and-drop role positioning | @xyflow/react | `/app/admin/roles` |
| Hierarchical relationships | Graph-based | `components/org-chart/` |
| Permission assignment | JSONB storage | Role edit dialog |
| User assignment | Many-to-many | `user_roles` table |

**API Routes:**
- `GET /api/roles` - List all roles
- `POST /api/roles` - Create role
- `PUT /api/roles/[roleId]` - Update role
- `DELETE /api/roles/[roleId]` - Delete role
- `POST /api/roles/[roleId]/assign-user` - Assign user
- `POST /api/roles/reorder` - Reorder display

**Service:** `lib/role-management-service.ts`
**Components:** 15+ components in `components/org-chart/`
**Database:** `roles`, `user_roles`, `role_hierarchy_audit`

**Features:**
- Create custom roles with descriptions
- Granular permission assignment (40 permissions)
- Department association
- Reporting structure (manager-subordinate)
- Hierarchy levels
- Visual chart positioning
- Audit trail for hierarchy changes
- System roles (Superadmin, Unassigned) protected

**Access:** `MANAGE_USER_ROLES` permission

### 2.3 Department Management

**Dynamic Department Membership:**
```
User → Project Assignment → Role → Department
```
Membership is **derived** from active project work, not manually assigned.

| Feature | API | Database |
|---------|-----|----------|
| Create department | `POST /api/departments` | `departments` |
| View members | Calculated query | Dynamic |
| Department projects | Filter by assignment | `projects` |
| Department capacity | Aggregated metrics | `weekly_capacity_summary` |

**Location:** `/app/departments/[departmentId]`
**Service:** `lib/department-service.ts`, `lib/department-client-service.ts`

**Features:**
- Department CRUD operations
- Member roster (auto-calculated)
- Department analytics
- Department admin dashboard
- Multi-department contributors supported

**Access:**
- View: `VIEW_DEPARTMENTS` (own), `VIEW_ALL_DEPARTMENTS` (all)
- Manage: `MANAGE_DEPARTMENTS`

### 2.4 Superadmin Setup

| Feature | Location | Access |
|---------|----------|--------|
| Bootstrap first superadmin | `/superadmin-setup` | Public (one-time) |
| Promote to superadmin | `/admin/superadmin-setup` | Existing superadmin |
| Demote superadmin | Admin panel | Existing superadmin |

**Service:** `lib/superadmin-utils.ts`
**Database:** `user_profiles.is_superadmin` boolean flag

**Superadmin Capabilities:**
- Bypass ALL permission checks
- Access all data regardless of RLS
- Platform-wide configuration
- User management
- System diagnostics

---

## 3. ACCOUNT & PROJECT MANAGEMENT

### 3.1 Account Management

**Accounts = Client/Customer Organizations**

| Feature | API Route | Components |
|---------|-----------|------------|
| List accounts | `GET /api/accounts` | `account-list.tsx` |
| Create account | `POST /api/accounts` | `account-create-dialog.tsx` |
| Account details | `GET /api/accounts/[id]` | `account-overview.tsx` |
| Update account | `PUT /api/accounts/[id]` | `account-edit-dialog.tsx` |
| Delete account | `DELETE /api/accounts/[id]` | Confirmation dialog |

**Location:** `/app/accounts/[accountId]`
**Service:** `lib/account-service.ts`
**Database:** `accounts`, `account_members`, `account_kanban_configs`

**Account Fields:**
- Name, description
- Primary contact (name, email)
- Account manager (user reference)
- Service tier (basic, premium, enterprise)
- Status (active, inactive, suspended)

**Account Features:**
- **Team Membership:** Assign users to accounts
- **Proportional Capacity:** User's hours split across assigned accounts
  - Example: 40hrs/week ÷ 3 accounts = 13.3hrs per account
- **Project Management:** All projects belong to an account
- **Kanban Config:** Custom task columns per account
- **Metrics:** Active projects, completed projects, hours logged, team size

**Account Views:**
- Overview tab
- Active Projects (List/Kanban/Gantt)
- Finished Projects archive
- Team members
- Client feedback

**API Routes:**
- `GET /api/accounts/[id]/members` - List members
- `POST /api/accounts/[id]/members` - Add member
- `DELETE /api/accounts/[id]/members/[userId]` - Remove member
- `GET /api/accounts/[id]/kanban-config` - Get Kanban columns
- `PUT /api/accounts/[id]/kanban-config` - Update columns

**Access:**
- View: `VIEW_ACCOUNTS` (assigned), `VIEW_ALL_ACCOUNTS` (all)
- Manage: `MANAGE_ACCOUNTS`, `MANAGE_USERS_IN_ACCOUNTS`

### 3.2 Project Management

**Projects = High-Level Client Deliverables**

| Feature | API Route | Permission |
|---------|-----------|------------|
| List projects | `GET /api/projects` | `VIEW_PROJECTS` |
| Create project | `POST /api/projects` | `MANAGE_PROJECTS` |
| Project details | `GET /api/projects/[id]` | `VIEW_PROJECTS` |
| Update project | `PUT /api/projects/[id]` | `MANAGE_PROJECTS` |
| Delete project | `DELETE /api/projects/[id]` | `MANAGE_PROJECTS` |
| Complete project | `POST /api/projects/[id]/complete` | `MANAGE_PROJECTS` |
| Reopen project | `POST /api/projects/[id]/reopen` | `MANAGE_PROJECTS` |

**Location:** `/app/projects/[projectId]`
**Database:** `projects`, `project_assignments`, `project_stakeholders`

**Project Fields:**
- Name, description
- Account (required)
- Priority (low, medium, high, urgent)
- Start/end dates
- Estimated/actual/remaining hours
- Created by, assigned user
- **Status:** Derived from workflow node position (no longer static field)

**Project Assignment:**
- Assign users via `project_assignments` table
- Soft-delete with `removed_at` timestamp
- Role in project designation
- Assignment history preserved
- Auto-assignment when task assigned

**Project Stakeholders:**
- Add observers/approvers
- Role designation
- Read-only project access

**Project Views:**
- List view with filters (priority, department, sorting)
- Detail page with tabs:
  - Overview
  - Tasks (List/Kanban/Gantt)
  - Workflow visualization
  - Updates feed
  - Issues/blockers
  - Team members

**API Routes:**
- `GET /api/projects/[id]/assignments` - List assignments
- `POST /api/projects/[id]/assignments` - Add assignment
- `DELETE /api/projects/[id]/assignments` - Remove assignment
- `GET /api/projects/[id]/stakeholders` - List stakeholders
- `POST /api/projects/[id]/stakeholders` - Add stakeholder

**Access:**
- View: `VIEW_PROJECTS` (assigned), `VIEW_ALL_PROJECTS` (all)
- Manage: `MANAGE_PROJECTS` (assigned), `MANAGE_ALL_PROJECTS` (all)

### 3.3 Task Management

**Tasks = Individual Work Items Within Projects**

| Feature | Location | Technology |
|---------|----------|------------|
| List View | Project detail page | Table with sorting |
| Kanban Board | `/accounts/[id]` | @dnd-kit/core |
| Gantt Chart | Project detail page | Custom + date-fns |

**Database:** `tasks`, `task_dependencies`, `task_week_allocations`
**Service:** `lib/task-service.ts`, `lib/task-service-db.ts`, `lib/supabase-task-service.ts`

**Task Fields:**
- Name, description
- Project (required)
- Status (backlog, todo, in_progress, review, done, blocked)
- Priority (low, medium, high, urgent)
- Start/due dates
- Estimated/actual/remaining hours
- Assigned user

**Task Dependencies:**
- Finish-to-start
- Start-to-start
- Finish-to-finish
- Start-to-finish
- Visualized in Gantt chart

**Task Views:**

**1. List View**
- Tabular display
- Sortable columns
- Status filters
- Quick actions

**2. Kanban Board** (Task-level, NOT project-level)
- Custom columns per account
- Drag-and-drop status updates
- Task card details
- Visual workflow

**3. Gantt Chart** (Task-level, NOT project-level)
- Timeline visualization
- Dependency arrows
- Milestone markers
- Drag-to-reschedule
- Zoom: daily, monthly, quarterly, yearly

**Weekly Allocations:**
- Break estimates into weekly plans
- Track allocated hours per week
- Capacity planning integration

**API Routes:**
- `GET /api/tasks` - List tasks
- `POST /api/tasks` - Create task
- `PUT /api/tasks/[id]` - Update task
- `DELETE /api/tasks/[id]` - Delete task

**Access:** Same as project permissions

### 3.4 Project Updates

**Status Update Feed**

| Feature | API Route | Database |
|---------|-----------|----------|
| Create update | `POST /api/projects/[id]/updates` | `project_updates` |
| Edit update | `PUT /api/projects/[id]/updates/[updateId]` | `project_updates` |
| Delete update | `DELETE /api/projects/[id]/updates/[updateId]` | `project_updates` |
| View all updates | `GET /api/project-updates` | Org-wide feed |

**Service:** `lib/project-updates-service.ts`, `lib/all-project-updates-service.ts`
**Components:** `components/project-updates-card.tsx`

**Features:**
- Rich text content
- Author attribution
- Timestamp tracking
- Chronological feed
- Department/account filtering
- Permissions-based visibility

**Access:**
- View: `VIEW_UPDATES` (assigned), `VIEW_ALL_UPDATES` (all)
- Manage: `MANAGE_UPDATES`

### 3.5 Project Issues/Blockers

**Issue Tracking**

| Status | Description |
|--------|-------------|
| Open | Newly reported issue |
| In Progress | Being addressed |
| Resolved | Issue fixed |

**API Routes:**
- `GET /api/projects/[id]/issues` - List issues
- `POST /api/projects/[id]/issues` - Create issue
- `PUT /api/projects/[id]/issues/[issueId]` - Update issue
- `DELETE /api/projects/[id]/issues/[issueId]` - Delete issue

**Service:** `lib/project-issues-service.ts`
**Database:** `project_issues`

**Features:**
- Issue description
- Status workflow
- Assignment tracking
- Resolution tracking
- Resolution notes

**Access:**
- View: `VIEW_ISSUES`
- Manage: `MANAGE_ISSUES`

---

## 4. ROW-LEVEL SECURITY (RLS)

**Every table has RLS policies enforcing data access at PostgreSQL level.**

### RLS Policy Patterns

**1. Assignment-Based Access:**
```sql
auth.uid() IN (SELECT user_id FROM project_assignments WHERE ...)
```

**2. Ownership-Based Access:**
```sql
auth.uid() = created_by OR auth.uid() = assigned_user_id
```

**3. Hierarchical Access:**
```sql
auth.uid() IN (SELECT account_manager_id FROM accounts WHERE ...)
```

**4. Superadmin Bypass:**
```sql
EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_superadmin = true)
```

### RLS Guarantees
- Application bugs CANNOT leak data
- Direct SQL queries respect RLS
- Database enforces security
- Service role key (server-side only) can bypass

### RLS Best Practices
1. Enable RLS: `ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;`
2. Create policies for: SELECT, INSERT, UPDATE, DELETE
3. Test with different user contexts
4. Never use anon key (bypasses RLS) - use publishable key

---

## Summary Statistics

**Core Features (Part 1):**
- ✅ 3 Authentication methods
- ✅ 40 Permissions across 12 categories
- ✅ 5 User management features
- ✅ Account management with proportional capacity
- ✅ Project management with workflow integration
- ✅ Task management with 3 view types (List/Kanban/Gantt)
- ✅ RLS on all tables for database-level security

**Next:** Part 2 covers Workflow System, Time Tracking, and Client Portal features.
