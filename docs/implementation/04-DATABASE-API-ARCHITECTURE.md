# MovaLab Features - Part 4 of 4: Database, API & Architecture

**Last Updated:** December 22, 2025

---

## 13. DATABASE SCHEMA

### Complete Table Inventory (48 Tables)

### User & Authentication Tables (4)

| Table | Purpose | Key Fields | RLS |
|-------|---------|------------|-----|
| `user_profiles` | Extended user data | id, email, name, image, bio, skills[], workload_sentiment, is_superadmin | ✅ |
| `user_roles` | User-role assignments | user_id, role_id, assigned_at, assigned_by | ✅ |
| `roles` | Role definitions | name, department_id, permissions (JSONB), hierarchy_level, reporting_role_id | ✅ |
| `role_hierarchy_audit` | Hierarchy changes | role_id, changed_by, old/new_reporting_role_id, old/new_hierarchy_level | ✅ |

**Key Constraints:**
- `user_profiles.id` → `auth.users(id)` (Supabase Auth)
- `user_roles` UNIQUE(user_id, role_id)
- `roles.name` UNIQUE

---

### Organization Tables (2)

| Table | Purpose | Key Fields | RLS |
|-------|---------|------------|-----|
| `departments` | Department definitions | name, description | ✅ |
| `accounts` | Client accounts | name, account_manager_id, service_tier, status | ✅ |

**Service Tiers:** basic, premium, enterprise
**Account Status:** active, inactive, suspended

---

### Account Management Tables (2)

| Table | Purpose | Key Fields | RLS |
|-------|---------|------------|-----|
| `account_members` | User-account assignments | user_id, account_id | ✅ |
| `account_kanban_configs` | Per-account Kanban columns | account_id, columns (JSONB) | ✅ |

**Constraint:** `account_members` UNIQUE(user_id, account_id)

---

### Project & Task Tables (6)

| Table | Purpose | Key Fields | RLS |
|-------|---------|------------|-----|
| `projects` | Project records | name, account_id, priority, start/end_date, estimated/actual/remaining_hours, created_by, assigned_user_id | ✅ |
| `project_assignments` | User-project assignments | project_id, user_id, role_in_project, removed_at (soft delete) | ✅ |
| `project_stakeholders` | Project observers | project_id, user_id, role | ✅ |
| `project_updates` | Status updates feed | project_id, content, created_by | ✅ |
| `project_issues` | Issues/blockers | project_id, content, status, created_by, resolved_by | ✅ |
| `tasks` | Task records | name, project_id, status, priority, start/due_date, estimated/actual/remaining_hours, assigned_to | ✅ |

**Task Status:** backlog, todo, in_progress, review, done, blocked
**Issue Status:** open, in_progress, resolved

---

### Task Management Tables (2)

| Table | Purpose | Key Fields | RLS |
|-------|---------|------------|-----|
| `task_dependencies` | Task relationships | task_id, depends_on_task_id, dependency_type | ❌ |
| `task_week_allocations` | Weekly task planning | task_id, week_start_date, allocated_hours, assigned_user_id | ✅ |

**Dependency Types:** finish_to_start, start_to_start, finish_to_finish, start_to_finish
**Constraint:** `task_week_allocations` UNIQUE(task_id, week_start_date, assigned_user_id)

---

### Workflow System Tables (6)

| Table | Purpose | Key Fields | RLS |
|-------|---------|------------|-----|
| `workflow_templates` | Workflow definitions | name, description, is_active, created_by | ✅ |
| `workflow_nodes` | Workflow steps | workflow_template_id, node_type, entity_id, label, settings (JSONB), position_x, position_y | ✅ |
| `workflow_connections` | Valid paths | workflow_template_id, from_node_id, to_node_id, condition (JSONB), label | ✅ |
| `workflow_instances` | Active workflows | workflow_template_id, project_id, current_node_id, status, started_snapshot, completed_snapshot | ✅ |
| `workflow_active_steps` | Current active nodes | workflow_instance_id, node_id, branch_id, status, assigned_user_id | ✅ |
| `workflow_history` | Transition audit trail | workflow_instance_id, from/to_node_id, transitioned_by, transition_type, form_response_id | ✅ |

**Node Types:** start, department, role, approval, form, conditional, sync, end
**Instance Status:** active, completed, cancelled
**Transition Types:** normal, out_of_order, auto

---

### Form System Tables (2)

| Table | Purpose | Key Fields | RLS |
|-------|---------|------------|-----|
| `form_templates` | Dynamic form definitions | name, schema (JSONB), created_by | ✅ |
| `form_responses` | Submitted form data | form_template_id, workflow_history_id, submitted_by, response_data (JSONB) | ✅ |

**Form Field Types:** text, textarea, number, email, date, dropdown, multiselect, checkbox, file (12 types)

---

### Time & Capacity Tables (3)

| Table | Purpose | Key Fields | RLS |
|-------|---------|------------|-----|
| `user_availability` | Weekly schedules | user_id, week_start_date, available_hours, schedule_data (JSONB) | ✅ |
| `time_entries` | Logged work hours | task_id, user_id, project_id, hours_logged, entry_date, week_start_date, clock_session_id | ✅ |
| `clock_sessions` | Active tracking | user_id, clock_in_time, clock_out_time, is_active, is_auto_clock_out | ✅ |

**Constraints:**
- `user_availability` UNIQUE(user_id, week_start_date), max 168 hours
- `time_entries` max 24 hours per entry
- `clock_sessions` auto-close after 16 hours

---

### Client Portal Tables (2)

| Table | Purpose | Key Fields | RLS |
|-------|---------|------------|-----|
| `client_invitations` | Client invite tokens | email, token, expiry_date, status, invited_by | ✅ |
| `client_feedback` | Satisfaction ratings | project_id, client_id, satisfaction_score, what_went_well, what_needs_improvement | ✅ |

**Invitation Status:** pending, accepted, expired
**Satisfaction Score:** 1-10 (integer)

---

### Supporting Tables (3)

| Table | Purpose | Key Fields | RLS |
|-------|---------|------------|-----|
| `deliverables` | Project deliverables | name, project_id, task_id, status, submitted_by, approved_by, file_url, version | ✅ |
| `newsletters` | Company announcements | title, content, created_by, is_published, published_at | ✅ |
| `milestones` | Timeline markers | name, description, date, color | ❌ |

**Deliverable Status:** draft, pending_review, approved, rejected, revised

---

### Database Views (1)

**`weekly_capacity_summary`**

Pre-calculated capacity metrics for performance:
- user_id, week_start_date
- available_hours
- allocated_hours (SUM from task_week_allocations)
- actual_hours (SUM from time_entries)
- utilization_rate: (actual / available * 100)
- remaining_capacity: (available - actual)

**Joins:** user_availability + task_week_allocations + time_entries

---

### Database Functions (2)

**`get_week_start_date(input_date DATE) RETURNS DATE`**

Returns Monday of the week (ISO week standard):
```sql
RETURN input_date - (EXTRACT(ISODOW FROM input_date)::INTEGER - 1);
```

**Used throughout system** for consistent week calculations.

---

**`auto_clock_out_stale_sessions() RETURNS void`**

Automatically closes sessions after 16 hours:
```sql
UPDATE clock_sessions
SET
  clock_out_time = clock_in_time + INTERVAL '16 hours',
  is_active = false,
  is_auto_clock_out = true
WHERE is_active = true
  AND clock_in_time < NOW() - INTERVAL '16 hours';
```

**Security Definer:** Runs with elevated permissions
**Called by:** Time entry service before creating entries

---

## 14. API ROUTES REFERENCE (80+ Routes)

### Authentication & Users (5)

| Method | Route | Purpose | Permission |
|--------|-------|---------|------------|
| POST | `/api/users/approve` | Approve pending users | `MANAGE_USER_ROLES` |
| GET | `/api/users/pending` | Get pending registrations | `MANAGE_USER_ROLES` |
| GET | `/api/users` | List all users | `MANAGE_USERS` |
| GET | `/api/auth/permissions` | Get current user permissions | Authenticated |
| GET | `/api/profile` | Get user profile | Own profile |
| PUT | `/api/profile` | Update user profile | Own profile |

---

### Accounts (12)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/accounts` | List accounts |
| POST | `/api/accounts` | Create account |
| GET | `/api/accounts/[accountId]` | Get account details |
| PUT | `/api/accounts/[accountId]` | Update account |
| DELETE | `/api/accounts/[accountId]` | Delete account |
| GET | `/api/accounts/[accountId]/members` | Get members |
| POST | `/api/accounts/[accountId]/members` | Add member |
| DELETE | `/api/accounts/[accountId]/members/[userId]` | Remove member |
| GET | `/api/accounts/[accountId]/kanban-config` | Get Kanban config |
| PUT | `/api/accounts/[accountId]/kanban-config` | Update Kanban config |
| POST | `/api/accounts/[accountId]/invite-client` | Send client invitation |
| GET | `/api/accounts/[accountId]/client-invites` | List invitations |
| GET | `/api/accounts/[accountId]/client-feedback` | Get feedback |
| GET | `/api/accounts/members` | Get all memberships |

---

### Projects (14)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/projects` | List projects |
| POST | `/api/projects` | Create project |
| GET | `/api/projects/[projectId]` | Get project details |
| PUT | `/api/projects/[projectId]` | Update project |
| DELETE | `/api/projects/[projectId]` | Delete project |
| POST | `/api/projects/[projectId]/complete` | Mark complete |
| POST | `/api/projects/[projectId]/reopen` | Reopen project |
| GET | `/api/projects/[projectId]/assignments` | Get assignments |
| POST | `/api/projects/[projectId]/assignments` | Add assignment |
| DELETE | `/api/projects/[projectId]/assignments` | Remove assignment |
| GET | `/api/projects/[projectId]/stakeholders` | Get stakeholders |
| POST | `/api/projects/[projectId]/stakeholders` | Add stakeholder |
| GET | `/api/projects/[projectId]/updates` | Get updates |
| POST | `/api/projects/[projectId]/updates` | Create update |
| PUT | `/api/projects/[projectId]/updates/[updateId]` | Edit update |
| DELETE | `/api/projects/[projectId]/updates/[updateId]` | Delete update |
| GET | `/api/projects/[projectId]/issues` | Get issues |
| POST | `/api/projects/[projectId]/issues` | Create issue |
| PUT | `/api/projects/[projectId]/issues/[issueId]` | Update issue |
| DELETE | `/api/projects/[projectId]/issues/[issueId]` | Delete issue |

---

### Tasks (4)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/tasks` | List tasks |
| POST | `/api/tasks` | Create task |
| GET | `/api/tasks/[taskId]` | Get task details |
| PUT | `/api/tasks/[taskId]` | Update task |
| DELETE | `/api/tasks/[taskId]` | Delete task |

---

### Workflows (20+)

**Templates:**
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/admin/workflows/templates` | List templates |
| POST | `/api/admin/workflows/templates` | Create template |
| GET | `/api/admin/workflows/templates/[id]` | Get template |
| PUT | `/api/admin/workflows/templates/[id]` | Update template |
| DELETE | `/api/admin/workflows/templates/[id]` | Delete template |
| GET | `/api/admin/workflows/templates/[id]/nodes` | Get nodes |
| POST | `/api/admin/workflows/templates/[id]/nodes` | Create node |
| GET | `/api/admin/workflows/templates/[id]/connections` | Get connections |
| POST | `/api/admin/workflows/templates/[id]/connections` | Create connection |
| DELETE | `/api/admin/workflows/nodes/[nodeId]` | Delete node |
| DELETE | `/api/admin/workflows/connections/[connectionId]` | Delete connection |

**Instances:**
| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/workflows/instances/start` | Start workflow |
| GET | `/api/workflows/instances/[id]` | Get instance |
| GET | `/api/workflows/instances/[id]/history` | Get history |
| GET | `/api/workflows/instances/[id]/active-steps` | Get active steps |
| GET | `/api/workflows/instances/[id]/next-nodes` | Get next nodes |
| POST | `/api/workflows/instances/[id]/handoff` | Hand off workflow |
| POST | `/api/workflows/progress` | Progress workflow |

**Queries:**
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/workflows/my-pipeline` | My workflow inbox |
| GET | `/api/workflows/my-approvals` | Pending approvals |
| GET | `/api/workflows/my-projects` | My active projects |
| GET | `/api/workflows/my-past-projects` | Completed workflows |

**Forms:**
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/workflows/forms/responses` | Get responses |
| POST | `/api/workflows/forms/responses` | Submit form |
| GET | `/api/workflows/history/[historyId]/form` | Get form |

---

### Roles & Departments (8)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/roles` | List roles |
| POST | `/api/roles` | Create role |
| GET | `/api/roles/[roleId]` | Get role |
| PUT | `/api/roles/[roleId]` | Update role |
| DELETE | `/api/roles/[roleId]` | Delete role |
| GET | `/api/roles/[roleId]/users` | Get users with role |
| POST | `/api/roles/[roleId]/assign-user` | Assign user |
| POST | `/api/roles/[roleId]/unassign-user` | Remove user |
| POST | `/api/roles/reorder` | Reorder roles |
| GET | `/api/departments` | List departments |
| POST | `/api/departments` | Create department |
| GET | `/api/org-structure/roles` | Org chart roles |
| GET | `/api/org-structure/departments` | Org chart departments |

---

### Capacity & Time Tracking (15)

**Capacity:**
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/capacity` | Get user capacity |
| GET | `/api/capacity/department` | Get department capacity |
| GET | `/api/capacity/account` | Get account capacity |
| GET | `/api/capacity/organization` | Get org capacity |
| GET | `/api/capacity/history` | Get capacity history |

**Availability:**
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/availability` | Get user availability |
| POST | `/api/availability` | Set availability |
| PUT | `/api/availability` | Update availability |

**Clock:**
| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/clock` | Clock in |
| POST | `/api/clock/out` | Clock out |
| POST | `/api/clock/discard` | Discard session |

**Time Entries:**
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/time-entries` | Get time entries |
| POST | `/api/time-entries` | Create time entry |
| PUT | `/api/time-entries/[id]` | Update entry (14-day window) |
| DELETE | `/api/time-entries/[id]` | Delete entry (14-day window) |

**Admin Time Entries:**
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/admin/time-entries` | Admin: Get all entries |
| PUT | `/api/admin/time-entries/[id]` | Admin: Update entry |
| DELETE | `/api/admin/time-entries/[id]` | Admin: Delete entry |

---

### Client Portal (6)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/client/portal/projects` | List client projects |
| GET | `/api/client/portal/projects/[id]` | Get client project |
| POST | `/api/client/portal/projects/[id]/approve` | Approve project |
| POST | `/api/client/portal/projects/[id]/reject` | Reject project |
| POST | `/api/client/portal/projects/[id]/feedback` | Submit feedback |
| POST | `/api/client/accept-invite/[token]` | Accept invitation |

---

### Admin & Diagnostics (5)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/admin/rbac-diagnostics` | Run diagnostics |
| POST | `/api/admin/rbac-diagnostics/test` | Test permission |
| GET | `/api/admin/client-feedback` | Get all feedback |
| POST | `/api/admin/move-system-roles` | Move system roles (utility) |
| GET | `/api/debug-stakeholders` | Debug stakeholders |

---

### Miscellaneous (2)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/project-updates` | Get all updates (org-wide) |

---

## 15. ARCHITECTURAL PATTERNS

### 15.1 Service Layer Pattern

**All business logic is in service files, NOT in components or API routes.**

**Service Files (20+ total):**
- `lib/account-service.ts` - Account CRUD, membership
- `lib/project-updates-service.ts` - Update logic
- `lib/role-management-service.ts` - Role/permission management
- `lib/workflow-service.ts` - Workflow CRUD
- `lib/workflow-execution-service.ts` - Workflow state machine
- `lib/services/capacity-service.ts` - Capacity calculations
- `lib/services/time-entry-service.ts` - Time tracking + clock
- `lib/services/availability-service.ts` - Availability management
- `lib/assignment-service.ts` - Assignments
- `lib/department-service.ts` - Department management
- `lib/form-service.ts` - Dynamic forms
- `lib/milestone-service.ts` - Milestones
- `lib/newsletter-service.ts` - Newsletters
- `lib/client-portal-service.ts` - Client invitations
- `lib/user-approval-service.ts` - User approval
- `lib/task-service.ts` - Task operations
- And more...

**Standard Pattern:**
```typescript
// Service encapsulates business logic
export class AccountService {
  static async createAccount(
    supabase: SupabaseClient,
    data: CreateAccountData
  ): Promise<Account> {
    // Validation
    // Database operations
    // Return result
  }
}

// API route delegates to service
export async function POST(request: NextRequest) {
  const supabase = createApiSupabaseClient(request);
  const result = await AccountService.createAccount(supabase, data);
  return NextResponse.json(result);
}
```

---

### 15.2 Hybrid Permission System

**Three Overlapping Layers:**

**1. Base Permissions:** Standard role-based
- Example: `VIEW_PROJECTS`
- User must have permission in role's JSONB field
- Example: `{ "view_projects": true }`

**2. Override Permissions:** Global access
- Named with `_ALL_` pattern
- Example: `VIEW_ALL_PROJECTS`
- Grants access regardless of context
- Used for leadership/admin roles

**3. Context-Aware Checks:** Dynamic access
- Based on relationships:
  - Assigned to project
  - Account manager
  - Task assignee
  - Creator

**Permission Evaluation Flow:**
```
1. Superadmin? → ALLOW (bypass all)
2. Override permission (VIEW_ALL_*)? → ALLOW
3. Base permission + context?
   - Has base permission? (e.g., EDIT_PROJECT)
   - AND in correct context? (assigned to project)
   → ALLOW if both true
4. Hierarchical permissions?
   - User inherits subordinate permissions
5. Otherwise → DENY
```

**Key Files:**
- `lib/permissions.ts` - 40 permission enums
- `lib/permission-checker.ts` - Evaluation engine
- `lib/rbac.ts` - Helper functions
- `lib/rbac-types.ts` - TypeScript types

**Caching:**
- 5-minute TTL cache
- Cache key: `userId:permission:context`
- Cleared automatically on expiry

**CRITICAL RULES:**
- Never hardcode role names
- Always use permission checks, not role checks
- Roles are dynamically created by admins
- Permissions are the contract

---

### 15.3 Row-Level Security (RLS)

**Every table has RLS policies enforcing data access at PostgreSQL level.**

**Common Patterns:**

**Assignment-Based:**
```sql
auth.uid() IN (
  SELECT user_id FROM project_assignments
  WHERE project_id = projects.id
  AND removed_at IS NULL
)
```

**Ownership-Based:**
```sql
auth.uid() = created_by OR auth.uid() = assigned_user_id
```

**Hierarchical:**
```sql
auth.uid() IN (
  SELECT account_manager_id FROM accounts
  WHERE id = projects.account_id
)
```

**Superadmin Bypass:**
```sql
EXISTS (
  SELECT 1 FROM user_profiles
  WHERE id = auth.uid()
  AND is_superadmin = true
)
```

**RLS Guarantees:**
- Application bugs CANNOT leak data
- Direct SQL queries respect RLS
- Database enforces security
- Service role key (server-side) can bypass

**Adding New Tables:**
1. Enable RLS: `ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;`
2. Create SELECT policy
3. Create INSERT policy
4. Create UPDATE policy
5. Create DELETE policy
6. Test with different user contexts

---

### 15.4 Dynamic Department Membership

**Departments derive from active project work:**

```
User → Project Assignment → Role → Department
```

**How it works:**
1. User assigned to project
2. User has role (e.g., "Graphic Designer")
3. Role belongs to department (e.g., "Graphics")
4. User is now in Graphics department
5. User removed from all Graphics projects → no longer in Graphics

**SQL Calculation:**
```sql
SELECT DISTINCT d.id, d.name
FROM departments d
JOIN roles r ON r.department_id = d.id
JOIN user_roles ur ON ur.role_id = r.id
JOIN project_assignments pa ON pa.user_id = ur.user_id
WHERE ur.user_id = $1
  AND pa.removed_at IS NULL;
```

**Benefits:**
- Reflects actual work patterns
- No manual department management
- Automatically adapts to role changes
- Supports multi-department contributors
- Accurate capacity planning

---

### 15.5 Proportional Capacity Allocation

**Problem:** Traditional systems over-count capacity

**Example:**
- Sarah works 40 hrs/week on 3 accounts
- Traditional: 40 hrs × 3 accounts = 120 hrs ❌

**MovaLab Solution:**
- Sarah's 40 hrs ÷ 3 accounts = 13.3 hrs per account ✅

**Implementation:**
```typescript
const accountCount = assignedAccounts.length || 1;
const capacityPerAccount = availableHours / accountCount;
```

**Benefits:**
- Prevents over-commitment
- Accurate resource planning
- Realistic account capacity
- Better workload distribution

---

## 16. DEVELOPMENT & DEBUGGING

### Development Commands

**Running:**
```bash
npm run dev              # Start dev server
npm run dev:clean        # Clean cache + start
npm run dev:fresh        # Kill port 3000, clean, start
npm run build            # Production build
npm run start            # Start production
npm run lint             # ESLint v9
npm run clean            # Clean .next
```

**Testing:**
```bash
npm run test:playwright        # E2E tests
npm run test:unit             # Unit tests
npm run test:integration      # Integration tests
npm run test:permissions      # Permission tests + validation
```

**Debugging:**
```bash
npm run debug:permissions      # Debug user permissions
npm run validate:permissions   # Validate consistency
npm run fix:permissions        # Fix common issues
npm run check:users           # Check user status
npm run setup:test-roles      # Create test roles
```

---

### Environment Variables

**Required:**
```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your-key
```

**CRITICAL SECURITY:**
- **NEVER** use `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Anon key bypasses Row Level Security (RLS)
- **ALWAYS** use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- Publishable keys respect RLS policies

**Optional (Production):**
```env
UPSTASH_REDIS_REST_URL=your-redis-url
UPSTASH_REDIS_REST_TOKEN=your-token
ENABLE_RATE_LIMIT=true
```

**Development Only:**
```env
EXPOSE_ERROR_DETAILS=true
LOG_LEVEL=debug  # Options: debug, info, warn, error
NODE_ENV=development
```

---

### Performance Optimizations

**Frontend:**
- Code splitting (Next.js dynamic imports)
- SSR disabled for heavy components
- Suspense boundaries with skeletons
- Memoized components
- Lazy loading
- Image optimization

**Backend:**
- Database views for complex queries
- Permission caching (5-min TTL)
- Indexed columns
- Connection pooling
- Parallel query execution

**Database Indexes:**
```sql
CREATE INDEX idx_projects_account_id ON projects(account_id);
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_time_entries_user_week ON time_entries(user_id, week_start_date);
```

---

## 17. KEY DISTINCTIONS

### Kanban vs Workflow

**Kanban Boards:**
- Operate on **TASKS** (individual work items)
- Located in account detail page
- Task status transitions (backlog → todo → in_progress → done)
- Custom columns per account
- Daily team operations

**Workflow Visualizations:**
- Operate on **PROJECTS** (high-level deliverables)
- Visual node-based flow
- Department/role handoffs
- Client approval gates
- Standardized delivery process

### Forms

- Forms created **INLINE** within workflow nodes
- No standalone form builder page
- Dynamic form creation during workflow config
- Responses linked to workflow history

### Client Access

- Client permissions **HARDCODED** based on `is_client` flag
- NOT managed through permission system
- Predefined access:
  - View assigned projects
  - Approve/reject workflow steps
  - Submit feedback
  - Read-only project details

---

## COMPLETE FEATURE SUMMARY

**MovaLab Platform Statistics:**

### Permissions & Access
- ✅ 40 Permissions (consolidated from 136 in Phase 8-9)
- ✅ 12 Permission categories
- ✅ 3-layer hybrid permission model
- ✅ 5-minute permission cache
- ✅ RLS on all 48 tables

### Database
- ✅ 48 Tables
- ✅ 1 Database view (weekly_capacity_summary)
- ✅ 2 Database functions
- ✅ Complete RLS policies
- ✅ Audit trails

### API
- ✅ 80+ API routes
- ✅ RESTful design
- ✅ Permission enforcement
- ✅ Input validation (Zod)
- ✅ Service layer delegation

### Components
- ✅ 26 shadcn/ui components
- ✅ 100+ application components
- ✅ 4 specialized visualizations (Kanban, Gantt, Workflow, Org Chart)
- ✅ Performance optimizations

### Features
- ✅ Authentication (3 methods)
- ✅ User management
- ✅ RBAC with visual org chart
- ✅ Account management
- ✅ Project management
- ✅ Task management (List/Kanban/Gantt)
- ✅ Workflow builder (8 node types)
- ✅ Workflow execution
- ✅ Dynamic forms (12 field types)
- ✅ Time tracking (Clock + Entries Page)
- ✅ Capacity planning (proportional allocation)
- ✅ Client portal
- ✅ Client feedback
- ✅ Analytics dashboard
- ✅ Admin tools

### Routes
- ✅ 40+ page routes
- ✅ Public/authenticated separation
- ✅ Admin route group
- ✅ Client portal routes

### Tech Stack
- Next.js 15 (App Router)
- TypeScript (full type safety)
- Supabase (PostgreSQL + Auth + RLS)
- Tailwind CSS + shadcn/ui
- @xyflow/react (workflows, org chart)
- @dnd-kit (Kanban)
- Recharts (analytics)
- Zod (validation)
- SWR (data fetching)
- Upstash Redis (optional rate limiting)

---

**End of Documentation - Part 4 of 4**

For more details, refer to:
- `/docs/architecture/CLAUDE.md` - Complete development guide
- `/docs/security/SECURITY.md` - Security architecture
- `/README.md` - Product overview
- `/CONTRIBUTING.md` - Development setup
