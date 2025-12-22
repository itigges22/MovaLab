# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Table of Contents
1. [Development Commands](#development-commands)
2. [Environment Configuration](#environment-configuration)
3. [Architecture Overview](#architecture-overview)
4. [Database Schema & Supabase](#database-schema--supabase)
5. [Permission System Deep Dive](#permission-system-deep-dive)
6. [Core Business Logic](#core-business-logic)
7. [Component Patterns](#component-patterns)
8. [API Route Patterns](#api-route-patterns)
9. [Common Query Patterns](#common-query-patterns)
10. [Debugging & Troubleshooting](#debugging--troubleshooting)
11. [Performance Considerations](#performance-considerations)

---

## Development Commands

### Running the Application
```bash
npm run dev              # Start development server on localhost:3000
npm run dev:clean        # Clean .next cache and start dev server
npm run dev:fresh        # Kill port 3000, clean cache, start fresh
npm run build            # Production build
npm run start            # Start production server
npm run lint             # Run ESLint (v9 with flat config)
npm run clean            # Clean .next and cache directories
```

### Testing
```bash
npm run test:playwright        # Run Playwright e2e tests
npm run test:unit             # Run unit tests (permission system)
npm run test:integration      # Run integration tests (permissions)
npm run test:permissions      # Run all permission tests + validation
```

### Utility Scripts
```bash
npm run debug:permissions      # Debug permission issues for users
npm run validate:permissions   # Validate permission consistency
npm run fix:permissions        # Fix common permission problems
npm run check:users           # Check user status and roles
npm run setup:test-roles      # Set up comprehensive test roles
```

---

## Environment Configuration

### Required Environment Variables
```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your-supabase-publishable-key
```

### Optional (Production Recommended)
```env
UPSTASH_REDIS_REST_URL=your-redis-url
UPSTASH_REDIS_REST_TOKEN=your-token
ENABLE_RATE_LIMIT=true
```

### Development Only
```env
EXPOSE_ERROR_DETAILS=true
LOG_LEVEL=debug  # Options: debug, info, warn, error
NODE_ENV=development
```

### CRITICAL SECURITY NOTES

**NEVER use `NEXT_PUBLIC_SUPABASE_ANON_KEY`:**
- The anon key bypasses Row Level Security (RLS) policies
- This creates a massive security vulnerability in production
- All data becomes accessible regardless of permissions

**ALWAYS use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`:**
- Publishable keys respect RLS policies
- Data access is properly restricted by PostgreSQL
- This is the production-safe approach

**Why this matters:**
- RLS is enforced at the database level
- Even if application logic fails, RLS protects data
- Anon keys circumvent this critical security layer
- All Supabase client creation MUST use publishable key

---

## Architecture Overview

### Tech Stack
- **Next.js 15** - App Router with React Server Components
- **TypeScript** - Full type safety throughout
- **Supabase** - PostgreSQL with Row Level Security + Auth
- **Tailwind CSS + shadcn/ui** - Component library
- **Recharts** - Analytics visualizations
- **@xyflow/react** - Visual workflow builder
- **@dnd-kit** - Drag-and-drop for Kanban boards
- **Zod** - Runtime type validation
- **SWR** - Client-side data fetching
- **Upstash Redis** - Rate limiting (optional)

### Core Architectural Patterns

#### 1. Hybrid Permission System (~40 Permissions)

**The system uses three overlapping layers:**

**Layer 1: Base Permissions**
- Standard role-based permissions (e.g., `VIEW_PROJECTS`)
- User must have permission in their role's JSONB permissions field
- Example: `{ "view_projects": true, "edit_projects": true }`

**Layer 2: Override Permissions**
- Global access permissions that bypass context checks
- Named with `_ALL_` pattern (e.g., `VIEW_ALL_PROJECTS`)
- Grants access regardless of assignment status
- Used for leadership/admin roles

**Layer 3: Context-Aware Checks**
- Dynamic access based on relationships
- Examples:
  - Assigned to project → can view/edit that project
  - Account manager → can manage all projects in that account
  - Task assignee → can update that task
  - Creator → can edit what they created

**Permission Evaluation Flow:**
```typescript
1. Check if user is superadmin → ALLOW (bypass all checks)
2. Check if user has override permission (VIEW_ALL_*) → ALLOW
3. Check base permission + context:
   - Has base permission? (e.g., EDIT_PROJECT)
   - AND in correct context? (assigned to project)
   → ALLOW if both true
4. Check hierarchical permissions:
   - Can user's reports do this?
   - User inherits subordinate permissions
5. Otherwise → DENY
```

**Key Implementation Files:**
- `lib/permissions.ts` - All ~40 permission enum definitions (consolidated from 136 via Phase 8-9 RBAC refactoring)
- `lib/permission-checker.ts` - Core evaluation engine
- `lib/rbac.ts` - Helper functions and role checks
- `lib/rbac-types.ts` - TypeScript type definitions

**Permission Caching:**
- 5-minute TTL cache for permission checks
- Cache key: `userId:permission:context`
- Cleared automatically on expiry
- Located in `permission-checker.ts`

**CRITICAL RULES:**
- Never hardcode role names ("Executive", "Director", etc.)
- Always use permission checks, not role name checks
- Roles are dynamically created by admins
- Role names can change; permissions are the contract

#### 2. Service Layer Pattern

All business logic is centralized in service files to:
- Separate concerns from API routes
- Enable testing and reuse
- Provide consistent interfaces
- Encapsulate complex operations

**Service Files:**
- `lib/account-service.ts` - Account CRUD, membership management
- `lib/project-updates-service.ts` - Project update logic
- `lib/role-management-service.ts` - Role/permission management
- `lib/workflow-service.ts` - Workflow template CRUD
- `lib/workflow-execution-service.ts` - Workflow state machine
- `lib/services/capacity-service.ts` - Capacity calculations
- `lib/services/time-entry-service.ts` - Time tracking + clock sessions
- `lib/services/availability-service.ts` - User availability management
- `lib/assignment-service.ts` - Project/task assignments
- `lib/department-service.ts` - Department management
- `lib/form-service.ts` - Dynamic form builder
- `lib/milestone-service.ts` - Project milestones
- `lib/newsletter-service.ts` - Company newsletters

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

#### 3. Supabase Client Patterns

**Three distinct client types for different execution contexts:**

**Server Components (React Server Components):**
```typescript
import { createServerSupabase } from '@/lib/supabase-server';

export default async function Page() {
  const supabase = await createServerSupabase();
  if (!supabase) return <div>Database unavailable</div>;

  const { data } = await supabase
    .from('projects')
    .select('*');

  return <ProjectList projects={data} />;
}
```

**API Routes (Next.js Route Handlers):**
```typescript
import { createApiSupabaseClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  // MUST pass request to parse cookies from headers
  const supabase = createApiSupabaseClient(request);
  if (!supabase) {
    return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
  }

  // RLS automatically enforced based on authenticated user
  const { data } = await supabase.from('projects').insert({...});
  return NextResponse.json(data);
}
```

**Client Components (Browser-side React):**
```typescript
'use client';
import { createClientSupabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';

export function ProjectList() {
  const [projects, setProjects] = useState([]);
  const supabase = createClientSupabase();

  useEffect(() => {
    if (!supabase) return;

    supabase.from('projects').select('*').then(({ data }) => {
      setProjects(data || []);
    });
  }, []);

  return <div>{/* render projects */}</div>;
}
```

**Why Three Different Clients:**
1. **Cookie handling differs** - Server Components use `cookies()` from `next/headers`, API routes parse from request headers, client uses browser cookies
2. **Execution context** - Server vs browser environments
3. **RLS enforcement** - All respect RLS, but authentication context setup differs
4. **Performance** - Server components can fetch on server, reducing client waterfalls

**CRITICAL:** Never mix client types. Using `createClientSupabase()` in an API route will fail because browser cookies aren't available in Node.js API handlers.

#### 4. Row Level Security (RLS)

**Every table has RLS policies enforcing data access at PostgreSQL level.**

**RLS Policy Pattern:**
```sql
-- Example: Users can only view projects they're assigned to
CREATE POLICY "Users can view assigned projects"
ON projects FOR SELECT
USING (
  auth.uid() IN (
    SELECT user_id FROM project_assignments
    WHERE project_id = projects.id
    AND removed_at IS NULL
  )
  OR auth.uid() = created_by
  OR auth.uid() = assigned_user_id
);
```

**Common RLS Patterns in MovaLab:**

**1. Assignment-Based Access:**
```sql
-- Check junction table
auth.uid() IN (SELECT user_id FROM project_assignments WHERE ...)
```

**2. Ownership-Based Access:**
```sql
-- User created or is assigned to resource
auth.uid() = created_by OR auth.uid() = assigned_user_id
```

**3. Hierarchical Access:**
```sql
-- Account manager sees all projects in their accounts
auth.uid() IN (
  SELECT account_manager_id FROM accounts
  WHERE id = projects.account_id
)
```

**4. Superadmin Bypass:**
```sql
-- Superadmins bypass all restrictions
EXISTS (
  SELECT 1 FROM user_profiles
  WHERE id = auth.uid()
  AND is_superadmin = true
)
```

**RLS Guarantees:**
- Application bugs CANNOT leak data
- Even direct SQL queries respect RLS
- Database enforces security, not just application logic
- Service role key (never exposed to client) can bypass RLS

**When Adding New Tables:**
1. Always enable RLS: `ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;`
2. Create SELECT policy (who can read)
3. Create INSERT policy (who can create)
4. Create UPDATE policy (who can modify)
5. Create DELETE policy (who can remove)
6. Test policies with different user contexts

#### 5. Dynamic Department Membership

**Unlike static organizational charts, departments derive from active project work.**

**How it works:**
1. User is assigned to a project
2. User has a role (e.g., "Graphic Designer")
3. Role belongs to a department (e.g., "Graphics")
4. User is now part of Graphics department (while working on that project)
5. User removed from all Graphics projects → no longer in Graphics department

**SQL Calculation:**
```sql
-- Get user's departments based on current project assignments
SELECT DISTINCT d.id, d.name
FROM departments d
JOIN roles r ON r.department_id = d.id
JOIN user_roles ur ON ur.role_id = r.id
JOIN project_assignments pa ON pa.user_id = ur.user_id
WHERE ur.user_id = $1
  AND pa.removed_at IS NULL;
```

**Why this pattern:**
- Reflects actual work patterns
- No manual department management needed
- Automatically adapts to role rotations
- Supports multi-department contributors
- Accurate capacity planning per department

**Implementation:** `lib/department-service.ts`

---

## Database Schema & Supabase

### Complete Table Reference

#### User Management Tables

**`user_profiles`** (RLS: Enabled)
```sql
id UUID PRIMARY KEY REFERENCES auth.users(id)
email TEXT NOT NULL UNIQUE
name TEXT NOT NULL
image TEXT
bio TEXT
skills TEXT[]
workload_sentiment TEXT  -- 'comfortable' | 'stretched' | 'overwhelmed'
is_superadmin BOOLEAN DEFAULT false
created_at TIMESTAMPTZ DEFAULT NOW()
updated_at TIMESTAMPTZ DEFAULT NOW()
```
- **Purpose:** Extended user profile beyond Supabase Auth
- **RLS Policy:** Users can view all profiles, edit only their own (except superadmins)
- **Indexes:** email, is_superadmin
- **Special:** Links to `auth.users` via foreign key

**`user_roles`** (RLS: Enabled)
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE
role_id UUID REFERENCES roles(id) ON DELETE CASCADE
assigned_at TIMESTAMPTZ DEFAULT NOW()
assigned_by UUID REFERENCES user_profiles(id)
```
- **Purpose:** Many-to-many relationship between users and roles
- **RLS Policy:** Users can view their own roles, admins can view/modify all
- **Indexes:** user_id, role_id
- **Constraint:** UNIQUE(user_id, role_id)

#### Role & Permission Tables

**`roles`** (RLS: Enabled)
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
name TEXT NOT NULL UNIQUE
department_id UUID REFERENCES departments(id) ON DELETE SET NULL
description TEXT
permissions JSONB NOT NULL DEFAULT '{}'  -- { "permission_name": boolean }
is_system_role BOOLEAN DEFAULT false
hierarchy_level INTEGER DEFAULT 0
display_order INTEGER DEFAULT 0
reporting_role_id UUID REFERENCES roles(id)
chart_position_x FLOAT
chart_position_y FLOAT
created_at TIMESTAMPTZ DEFAULT NOW()
updated_at TIMESTAMPTZ DEFAULT NOW()
```
- **Purpose:** Define roles with permissions and org hierarchy
- **RLS Policy:** All users can view roles, only admins can modify
- **Permissions Storage:** JSONB map of permission_name → boolean
- **Hierarchy:** `reporting_role_id` creates reporting structure
- **System Roles:** Superadmin, Unassigned (flagged with `is_system_role`)

**`departments`** (RLS: Enabled)
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
name TEXT NOT NULL UNIQUE
description TEXT
created_at TIMESTAMPTZ DEFAULT NOW()
updated_at TIMESTAMPTZ DEFAULT NOW()
```
- **Purpose:** Organizational departments
- **RLS Policy:** All users can view, admins can modify
- **Relationship:** One department → many roles → many users

**`role_hierarchy_audit`** (RLS: Enabled)
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
role_id UUID REFERENCES roles(id) ON DELETE CASCADE
changed_by UUID REFERENCES user_profiles(id)
action TEXT NOT NULL  -- 'hierarchy_change'
old_reporting_role_id UUID
new_reporting_role_id UUID
old_hierarchy_level INTEGER
new_hierarchy_level INTEGER
metadata JSONB
created_at TIMESTAMPTZ DEFAULT NOW()
```
- **Purpose:** Audit trail for org chart changes
- **Use Case:** Compliance, rollback, history tracking

#### Account & Project Tables

**`accounts`** (RLS: Enabled)
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
name TEXT NOT NULL UNIQUE
description TEXT
primary_contact_email TEXT
primary_contact_name TEXT
account_manager_id UUID REFERENCES user_profiles(id)
service_tier TEXT  -- 'basic' | 'premium' | 'enterprise'
status TEXT DEFAULT 'active'  -- 'active' | 'inactive' | 'suspended'
created_at TIMESTAMPTZ DEFAULT NOW()
updated_at TIMESTAMPTZ DEFAULT NOW()
```
- **Purpose:** Client/customer accounts
- **RLS Policy:** Users see accounts they're members of or manage
- **Indexes:** account_manager_id, status

**`account_members`** (RLS: Enabled)
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE
account_id UUID REFERENCES accounts(id) ON DELETE CASCADE
created_at TIMESTAMPTZ DEFAULT NOW()
```
- **Purpose:** Track which users have access to which accounts
- **RLS Policy:** Users can view memberships for their accounts
- **Constraint:** UNIQUE(user_id, account_id)

**`projects`** (RLS: Enabled)
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
name TEXT NOT NULL
description TEXT
account_id UUID REFERENCES accounts(id) ON DELETE CASCADE
status TEXT DEFAULT 'planning'  -- 'planning' | 'in_progress' | 'review' | 'complete' | 'on_hold'
priority TEXT DEFAULT 'medium'  -- 'low' | 'medium' | 'high' | 'urgent'
start_date DATE
end_date DATE
estimated_hours NUMERIC(10, 2)
actual_hours NUMERIC(10, 2) DEFAULT 0
remaining_hours NUMERIC(10, 2)
created_by UUID REFERENCES user_profiles(id)
assigned_user_id UUID REFERENCES user_profiles(id)
created_at TIMESTAMPTZ DEFAULT NOW()
updated_at TIMESTAMPTZ DEFAULT NOW()
```
- **Purpose:** Core project entity
- **RLS Policy:** Users see projects they're assigned to or manage
- **Department Derivation:** Via project_assignments → user_roles → roles → departments

**`project_assignments`** (RLS: Enabled)
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
project_id UUID REFERENCES projects(id) ON DELETE CASCADE
user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE
role_in_project TEXT
assigned_at TIMESTAMPTZ DEFAULT NOW()
assigned_by UUID REFERENCES user_profiles(id)
removed_at TIMESTAMPTZ  -- Soft delete
created_at TIMESTAMPTZ DEFAULT NOW()
updated_at TIMESTAMPTZ DEFAULT NOW()
```
- **Purpose:** User assignments to projects
- **Soft Delete:** Uses `removed_at` for historical tracking
- **Indexes:** project_id, user_id, removed_at

**`project_stakeholders`** (RLS: Enabled)
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
project_id UUID REFERENCES projects(id) ON DELETE CASCADE
user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE
role TEXT
added_at TIMESTAMPTZ DEFAULT NOW()
added_by UUID REFERENCES user_profiles(id)
```
- **Purpose:** Track observers, approvers, stakeholders
- **Auto-populated:** `role` field derives from user_roles table

**`project_updates`** (RLS: Enabled)
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
project_id UUID REFERENCES projects(id) ON DELETE CASCADE
content TEXT NOT NULL
created_by UUID REFERENCES user_profiles(id)
created_at TIMESTAMPTZ DEFAULT NOW()
updated_at TIMESTAMPTZ DEFAULT NOW()
```
- **Purpose:** Journal-style project status updates
- **Display:** Dashboard and project detail pages

**`project_issues`** (RLS: Enabled)
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
project_id UUID REFERENCES projects(id) ON DELETE CASCADE
content TEXT NOT NULL
status TEXT DEFAULT 'open'  -- 'open' | 'in_progress' | 'resolved'
created_by UUID REFERENCES user_profiles(id)
resolved_by UUID REFERENCES user_profiles(id)
created_at TIMESTAMPTZ DEFAULT NOW()
resolved_at TIMESTAMPTZ
```
- **Purpose:** Track project blockers and problems
- **Lifecycle:** open → in_progress → resolved

#### Task Management Tables

**`tasks`** (RLS: Enabled)
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
name TEXT NOT NULL
description TEXT
project_id UUID REFERENCES projects(id) ON DELETE CASCADE
status TEXT DEFAULT 'todo'  -- 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'blocked'
priority TEXT DEFAULT 'medium'  -- 'low' | 'medium' | 'high' | 'urgent'
start_date DATE
due_date DATE
estimated_hours NUMERIC(10, 2)
actual_hours NUMERIC(10, 2) DEFAULT 0
remaining_hours NUMERIC(10, 2)
assigned_to UUID REFERENCES user_profiles(id)
created_by UUID REFERENCES user_profiles(id)
created_at TIMESTAMPTZ DEFAULT NOW()
updated_at TIMESTAMPTZ DEFAULT NOW()
```
- **Purpose:** Individual work items within projects
- **Auto-assignment:** When user assigned, they get project access
- **Auto-complete:** When remaining_hours = 0, moves to 'done'

**`task_dependencies`** (No RLS)
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
task_id UUID REFERENCES tasks(id) ON DELETE CASCADE
depends_on_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE
dependency_type TEXT DEFAULT 'finish_to_start'
```
- **Types:** finish_to_start, start_to_start, finish_to_finish, start_to_finish
- **Purpose:** Define task ordering constraints for Gantt chart

#### Capacity & Time Tracking Tables

**`user_availability`** (RLS: Enabled)
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE
week_start_date DATE NOT NULL  -- Always Monday
available_hours NUMERIC(5, 2) NOT NULL DEFAULT 40
schedule_data JSONB  -- { monday: 8, tuesday: 8, ... }
notes TEXT
created_at TIMESTAMPTZ DEFAULT NOW()
updated_at TIMESTAMPTZ DEFAULT NOW()
```
- **Purpose:** Define weekly work capacity per user
- **Default:** 40 hours if not set
- **Constraint:** Max 168 hours (full week), UNIQUE(user_id, week_start_date)
- **Helper Function:** `get_week_start_date(date)` ensures Monday

**`time_entries`** (RLS: Enabled)
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
task_id UUID REFERENCES tasks(id) ON DELETE CASCADE
user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE
project_id UUID REFERENCES projects(id) ON DELETE CASCADE
hours_logged NUMERIC(5, 2) NOT NULL
entry_date DATE NOT NULL
week_start_date DATE NOT NULL
description TEXT
clock_session_id UUID REFERENCES clock_sessions(id)
clock_in_time TIMESTAMPTZ
clock_out_time TIMESTAMPTZ
is_auto_clock_out BOOLEAN DEFAULT false
created_at TIMESTAMPTZ DEFAULT NOW()
updated_at TIMESTAMPTZ DEFAULT NOW()
```
- **Purpose:** Track actual time worked on tasks
- **Constraint:** Max 24 hours per entry
- **Indexes:** user_id, task_id, project_id, week_start_date
- **Clock Integration:** Can link to clock sessions

**`task_week_allocations`** (RLS: Enabled)
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
task_id UUID REFERENCES tasks(id) ON DELETE CASCADE
week_start_date DATE NOT NULL
allocated_hours NUMERIC(5, 2) NOT NULL
assigned_user_id UUID REFERENCES user_profiles(id)
notes TEXT
created_at TIMESTAMPTZ DEFAULT NOW()
updated_at TIMESTAMPTZ DEFAULT NOW()
```
- **Purpose:** Break down task estimates into weekly plans
- **Use Case:** Capacity planning and workload balancing
- **Constraint:** UNIQUE(task_id, week_start_date, assigned_user_id)

**`clock_sessions`** (RLS: Enabled)
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE
clock_in_time TIMESTAMPTZ NOT NULL
clock_out_time TIMESTAMPTZ
is_active BOOLEAN DEFAULT true
is_auto_clock_out BOOLEAN DEFAULT false
notes TEXT
created_at TIMESTAMPTZ DEFAULT NOW()
```
- **Purpose:** Track when users are actively working
- **Auto Clock-Out:** Function auto-closes sessions after 16 hours
- **Safety:** Prevents overnight sessions from corrupting data

#### Workflow System Tables

**`workflow_templates`** (RLS: Enabled)
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
name TEXT NOT NULL UNIQUE
description TEXT
created_by UUID REFERENCES user_profiles(id)
is_active BOOLEAN DEFAULT true
created_at TIMESTAMPTZ DEFAULT NOW()
updated_at TIMESTAMPTZ DEFAULT NOW()
```
- **Purpose:** Reusable workflow definitions
- **Example:** "Video Production Workflow", "Blog Post Approval"

**`workflow_nodes`** (RLS: Enabled)
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
workflow_template_id UUID REFERENCES workflow_templates(id) ON DELETE CASCADE
node_type TEXT NOT NULL  -- 'start' | 'department' | 'role' | 'approval' | 'form' | 'conditional' | 'sync' | 'end'
entity_id UUID  -- References department_id, role_id, etc depending on node_type
label TEXT NOT NULL
settings JSONB  -- Node-specific configuration
form_template_id UUID REFERENCES form_templates(id)
position_x FLOAT
position_y FLOAT
created_at TIMESTAMPTZ DEFAULT NOW()
```
- **Purpose:** Individual steps in workflow
- **Node Types:**
  - `start` - Entry point
  - `department` - Handoff to department
  - `role` - Assign to specific role
  - `approval` - Requires approval
  - `form` - Collect form data
  - `conditional` - Branch based on conditions
  - `sync` - Wait for multiple paths to complete
  - `end` - Exit point

**`workflow_connections`** (RLS: Enabled)
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
workflow_template_id UUID REFERENCES workflow_templates(id) ON DELETE CASCADE
from_node_id UUID REFERENCES workflow_nodes(id) ON DELETE CASCADE
to_node_id UUID REFERENCES workflow_nodes(id) ON DELETE CASCADE
condition JSONB  -- Conditional logic for transitions
label TEXT
created_at TIMESTAMPTZ DEFAULT NOW()
```
- **Purpose:** Define valid transition paths between nodes
- **Validation:** Workflow can only move along defined connections

**`workflow_instances`** (RLS: Enabled)
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
workflow_template_id UUID REFERENCES workflow_templates(id)
project_id UUID REFERENCES projects(id) ON DELETE CASCADE
task_id UUID REFERENCES tasks(id) ON DELETE SET NULL
current_node_id UUID REFERENCES workflow_nodes(id)
status TEXT DEFAULT 'active'  -- 'active' | 'completed' | 'cancelled'
started_at TIMESTAMPTZ DEFAULT NOW()
completed_at TIMESTAMPTZ
started_snapshot JSONB  -- Captures workflow at start
completed_snapshot JSONB  -- Captures workflow at completion
```
- **Purpose:** Active workflow execution tied to a project
- **Snapshot:** Preserves workflow state even if template changes
- **One per project:** Each project can have one active workflow

**`workflow_history`** (RLS: Enabled)
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
workflow_instance_id UUID REFERENCES workflow_instances(id) ON DELETE CASCADE
from_node_id UUID REFERENCES workflow_nodes(id)
to_node_id UUID REFERENCES workflow_nodes(id)
transitioned_by UUID REFERENCES user_profiles(id)
transition_type TEXT  -- 'normal' | 'out_of_order' | 'auto'
notes TEXT
form_response_id UUID REFERENCES form_responses(id)
created_at TIMESTAMPTZ DEFAULT NOW()
```
- **Purpose:** Complete audit trail of all workflow transitions
- **Supports:** Out-of-order transitions with audit
- **Links:** Form responses to workflow steps

**`workflow_active_steps`** (RLS: Enabled)
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
workflow_instance_id UUID REFERENCES workflow_instances(id) ON DELETE CASCADE
node_id UUID REFERENCES workflow_nodes(id)
branch_id TEXT NOT NULL
status TEXT DEFAULT 'active'  -- 'active' | 'completed' | 'waiting'
assigned_user_id UUID REFERENCES user_profiles(id)
activated_at TIMESTAMPTZ DEFAULT NOW()
completed_at TIMESTAMPTZ
aggregate_decision TEXT  -- 'all_approved' | 'any_rejected' | 'no_approvals'
created_at TIMESTAMPTZ DEFAULT NOW()
```
- **Purpose:** Track current active steps in workflow
- **Multi-path:** Supports parallel execution paths (branch_id)
- **Assignment:** Can assign specific users to steps

#### Form System Tables

**`form_templates`** (RLS: Enabled)
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
name TEXT NOT NULL UNIQUE
description TEXT
schema JSONB NOT NULL  -- Form field definitions
created_by UUID REFERENCES user_profiles(id)
created_at TIMESTAMPTZ DEFAULT NOW()
updated_at TIMESTAMPTZ DEFAULT NOW()
```
- **Purpose:** Reusable form definitions
- **Schema Structure:**
```json
{
  "fields": [
    {
      "id": "field_1",
      "type": "text|number|date|dropdown|multiselect|file|textarea|email|checkbox",
      "label": "Field Label",
      "required": true,
      "placeholder": "...",
      "conditional": {
        "field": "field_id",
        "operator": "equals|not_equals|greater_than|less_than|contains",
        "value": "..."
      }
    }
  ]
}
```

**`form_responses`** (RLS: Enabled)
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
form_template_id UUID REFERENCES form_templates(id)
workflow_history_id UUID REFERENCES workflow_history(id)
submitted_by UUID REFERENCES user_profiles(id)
response_data JSONB NOT NULL
submitted_at TIMESTAMPTZ DEFAULT NOW()
```
- **Purpose:** Store submitted form data
- **Link:** Connected to workflow history for traceability

#### Supporting Tables

**`deliverables`** (RLS: Enabled)
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
name TEXT NOT NULL
description TEXT
project_id UUID REFERENCES projects(id) ON DELETE CASCADE
task_id UUID REFERENCES tasks(id)
status TEXT DEFAULT 'draft'  -- 'draft' | 'pending_review' | 'approved' | 'rejected' | 'revised'
submitted_by UUID REFERENCES user_profiles(id)
approved_by UUID REFERENCES user_profiles(id)
submitted_at TIMESTAMPTZ
approved_at TIMESTAMPTZ
feedback TEXT
file_url TEXT
version INTEGER DEFAULT 1
created_at TIMESTAMPTZ DEFAULT NOW()
updated_at TIMESTAMPTZ DEFAULT NOW()
```

**`newsletters`** (RLS: Enabled)
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
title TEXT NOT NULL
content TEXT NOT NULL
created_by UUID REFERENCES user_profiles(id)
is_published BOOLEAN DEFAULT false
published_at TIMESTAMPTZ
created_at TIMESTAMPTZ DEFAULT NOW()
updated_at TIMESTAMPTZ DEFAULT NOW()
```

**`milestones`** (No RLS)
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
name TEXT NOT NULL
description TEXT
date DATE NOT NULL
color TEXT DEFAULT '#3b82f6'
created_at TIMESTAMPTZ DEFAULT NOW()
```

**`account_kanban_configs`** (RLS: Enabled)
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
account_id UUID REFERENCES accounts(id) ON DELETE CASCADE UNIQUE
columns JSONB NOT NULL DEFAULT '[]'
created_at TIMESTAMPTZ DEFAULT NOW()
updated_at TIMESTAMPTZ DEFAULT NOW()
```

### Database Views

**`weekly_capacity_summary`**
```sql
CREATE VIEW weekly_capacity_summary AS
SELECT
  ua.user_id,
  ua.week_start_date,
  ua.available_hours,
  COALESCE(SUM(twa.allocated_hours), 0) as allocated_hours,
  COALESCE(SUM(te.hours_logged), 0) as actual_hours,
  CASE
    WHEN ua.available_hours > 0
    THEN (COALESCE(SUM(te.hours_logged), 0) / ua.available_hours * 100)
    ELSE 0
  END as utilization_rate,
  ua.available_hours - COALESCE(SUM(te.hours_logged), 0) as remaining_capacity
FROM user_availability ua
LEFT JOIN task_week_allocations twa ON twa.assigned_user_id = ua.user_id
  AND twa.week_start_date = ua.week_start_date
LEFT JOIN time_entries te ON te.user_id = ua.user_id
  AND te.week_start_date = ua.week_start_date
GROUP BY ua.user_id, ua.week_start_date, ua.available_hours;
```

### Critical Database Functions

**`get_week_start_date(input_date DATE)`**
```sql
CREATE OR REPLACE FUNCTION get_week_start_date(input_date DATE)
RETURNS DATE AS $$
BEGIN
  -- Returns Monday of the week (ISO week standard)
  RETURN input_date - (EXTRACT(ISODOW FROM input_date)::INTEGER - 1);
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```
- **Used throughout system** for consistent week calculations
- **ISO Standard:** Week starts Monday (day 1), ends Sunday (day 7)

**`auto_clock_out_stale_sessions()`**
```sql
CREATE OR REPLACE FUNCTION auto_clock_out_stale_sessions()
RETURNS void AS $$
BEGIN
  UPDATE clock_sessions
  SET
    clock_out_time = clock_in_time + INTERVAL '16 hours',
    is_active = false,
    is_auto_clock_out = true
  WHERE is_active = true
    AND clock_in_time < NOW() - INTERVAL '16 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```
- **Security Definer:** Runs with elevated permissions
- **Purpose:** Prevent runaway sessions
- **Triggered:** By time entry service before creating entries

---

## Permission System Deep Dive

### The ~40 Permissions (Post-Phase 9 Consolidation)

**Phase 9 RBAC Refinement (Dec 2025):** Reduced from 136 → 58 → **~40 permissions** through aggressive consolidation

**Permission Categories (~15 total):**

1. **Role Management (2):** MANAGE_USER_ROLES (consolidated from 6 permissions), MANAGE_USERS

2. **Department Management (4):** MANAGE_DEPARTMENTS, VIEW_DEPARTMENTS, VIEW_ALL_DEPARTMENTS, MANAGE_USERS_IN_DEPARTMENTS

3. **Account Management (4):** MANAGE_ACCOUNTS, VIEW_ACCOUNTS, VIEW_ALL_ACCOUNTS, MANAGE_USERS_IN_ACCOUNTS

4. **Project Management (4):** MANAGE_PROJECTS, VIEW_PROJECTS, MANAGE_ALL_PROJECTS, VIEW_ALL_PROJECTS

5. **Project Updates (3):** MANAGE_UPDATES, VIEW_UPDATES, VIEW_ALL_UPDATES

6. **Project Issues (2):** MANAGE_ISSUES, VIEW_ISSUES

7. **Newsletter (2):** MANAGE_NEWSLETTERS, VIEW_NEWSLETTERS

8. **Analytics (3):** VIEW_ALL_ANALYTICS, VIEW_ALL_DEPARTMENT_ANALYTICS, VIEW_ALL_ACCOUNT_ANALYTICS

9. **Capacity (2):** VIEW_TEAM_CAPACITY, VIEW_ALL_CAPACITY

10. **Time Tracking (3):** MANAGE_TIME, VIEW_TIME_ENTRIES, VIEW_ALL_TIME_ENTRIES

11. **Workflows (5):** MANAGE_WORKFLOWS, EXECUTE_WORKFLOWS, SKIP_WORKFLOW_NODES, MANAGE_ALL_WORKFLOWS, EXECUTE_ANY_WORKFLOW

12. **Deliverables (3):** MANAGE_DELIVERABLES, APPROVE_DELIVERABLE, REJECT_DELIVERABLE

13. **Client Portal (1):** MANAGE_CLIENT_INVITES (client access is hardcoded for client role)

**Removed/Deprecated Permissions:**
- Table View (DEPRECATED): Replaced by project list view, Kanban/Gantt now operate at **task level** (not project level)
- Forms (INLINE-ONLY): Forms now created inline within workflow nodes, no standalone builder
- Implicit Permissions (REMOVED): VIEW_OWN_PROFILE, VIEW_ANALYTICS, VIEW_OWN_CAPACITY (access is inherent)
- Old CRUD Variants (CONSOLIDATED): CREATE/EDIT/DELETE merged into MANAGE_* pattern

**Important View Distinction:**
- **Kanban Boards** and **Gantt Charts** display and manage **tasks** (individual work items)
- **Workflow Views** display and manage **projects** (high-level client deliverables moving through approval processes)
- This separation reflects real-world operations: teams manage daily task execution while projects follow standardized delivery workflows

**New Features (Phase 9):**
- User Time Entries Page (`/time-entries`): View logged time with charts, filters, and 14-day edit window
- Workflow Node Assignment Enforcement: EXECUTE_WORKFLOWS now validates user assignment to current node
- Granular Analytics Overrides: Department and account-level analytics permissions

### Permission Storage & Retrieval

**Stored in roles table as JSONB:**
```json
{
  "view_projects": true,
  "edit_projects": true,
  "view_all_projects": false,
  "create_project": true,
  "delete_project": false,
  ...
}
```

**Retrieving user permissions:**
```typescript
// Get user with roles and permissions
const { data: userProfile } = await supabase
  .from('user_profiles')
  .select(`
    *,
    user_roles!user_roles_user_id_fkey (
      roles (
        id,
        name,
        permissions,
        department_id
      )
    )
  `)
  .eq('id', userId)
  .single();

// Check specific permission
import { hasPermission } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';

const canEdit = await hasPermission(
  userProfile,
  Permission.EDIT_PROJECT,
  { projectId: 'project-uuid' },
  supabase
);
```

### Context-Aware Permission Checking

**Example: Editing a project**

```typescript
// From lib/permission-checker.ts
export async function checkPermissionHybrid(
  userProfile: UserWithRoles | null,
  permission: Permission,
  context?: PermissionContext,
  supabaseClient?: SupabaseClient
): Promise<boolean> {
  // 1. Superadmin bypass
  if (isSuperadmin(userProfile)) return true;

  // 2. Get override permission (e.g., EDIT_ALL_PROJECTS)
  const overridePermission = getOverridePermission(permission);
  if (overridePermission && hasBasePermission(userProfile, overridePermission)) {
    return true;
  }

  // 3. Check base permission
  if (!hasBasePermission(userProfile, permission)) {
    return false;
  }

  // 4. Check context if provided
  if (context?.projectId) {
    const isAssigned = await isAssignedToProject(
      userProfile.id,
      context.projectId,
      supabaseClient
    );
    return isAssigned;
  }

  // 5. Has base permission, no context needed
  return true;
}
```

**Override Permission Mapping:**
```typescript
function getOverridePermission(base: Permission): Permission | null {
  const overrideMap: Record<string, Permission> = {
    [Permission.VIEW_PROJECTS]: Permission.VIEW_ALL_PROJECTS,
    [Permission.EDIT_PROJECT]: Permission.EDIT_ALL_PROJECTS,
    [Permission.DELETE_PROJECT]: Permission.DELETE_ALL_PROJECTS,
    [Permission.VIEW_DEPARTMENTS]: Permission.VIEW_ALL_DEPARTMENTS,
    [Permission.VIEW_ACCOUNTS]: Permission.VIEW_ALL_ACCOUNTS,
    // ... more mappings
  };
  return overrideMap[base] || null;
}
```

### Permission Caching

**5-minute TTL cache to reduce database queries:**
```typescript
interface CacheEntry {
  result: boolean;
  timestamp: number;
}

const permissionCache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCacheKey(userId: string, permission: Permission, context?: PermissionContext): string {
  const contextStr = context ? JSON.stringify(context) : '';
  return `${userId}:${permission}:${contextStr}`;
}
```

**Cache invalidation:**
- Automatic: Entries expire after 5 minutes
- Manual: Clear cache when roles/permissions change

---

## Core Business Logic

### 1. Proportional Capacity Allocation

**The Problem:**
Traditional systems over-count capacity. If Sarah works 40 hrs/week on 3 accounts, they count her as providing 40 hrs to each account (120 hrs total). This leads to over-commitment.

**The Solution:**
MovaLab splits capacity proportionally. Sarah's 40 hrs/week across 3 accounts = 13.3 hrs per account.

**Implementation (from `lib/services/capacity-service.ts`):**

```typescript
async getUserCapacityMetrics(
  userId: string,
  weekStartDate: string,
  supabaseClient?: SupabaseClient
): Promise<UserCapacityMetrics | null> {
  // 1. Get user's weekly availability
  const { data: availability } = await supabase
    .from('user_availability')
    .select('available_hours')
    .eq('user_id', userId)
    .eq('week_start_date', weekStartDate)
    .single();

  const availableHours = availability?.available_hours || 40; // Default 40

  // 2. Get accounts user is assigned to
  const { data: accountAssignments } = await supabase
    .from('account_members')
    .select('account_id')
    .eq('user_id', userId);

  const accountCount = accountAssignments?.length || 1;

  // 3. Calculate proportional capacity per account
  const capacityPerAccount = availableHours / accountCount;

  // 4. Get allocated hours (from task_week_allocations)
  const { data: allocations } = await supabase
    .from('task_week_allocations')
    .select('allocated_hours')
    .eq('assigned_user_id', userId)
    .eq('week_start_date', weekStartDate);

  const allocatedHours = allocations?.reduce((sum, a) => sum + a.allocated_hours, 0) || 0;

  // 5. Get actual hours logged (from time_entries)
  const { data: timeEntries } = await supabase
    .from('time_entries')
    .select('hours_logged')
    .eq('user_id', userId)
    .eq('week_start_date', weekStartDate);

  const actualHours = timeEntries?.reduce((sum, te) => sum + te.hours_logged, 0) || 0;

  // 6. Calculate utilization
  const utilizationRate = availableHours > 0
    ? (actualHours / availableHours) * 100
    : 0;

  const remainingCapacity = availableHours - actualHours;

  return {
    userId,
    weekStartDate,
    availableHours: capacityPerAccount, // Proportionally split
    allocatedHours,
    actualHours,
    utilizationRate,
    remainingCapacity
  };
}
```

**Key Metrics:**
- **Available Hours:** User capacity ÷ number of accounts
- **Allocated Hours:** Sum of task estimates for the week
- **Actual Hours:** Sum of time entries logged
- **Utilization:** (Actual ÷ Available) × 100
- **Remaining Capacity:** Available - Actual

**Utilization Interpretation:**
- **< 60%** - Under-utilized, room for more work
- **60-80%** - Healthy utilization with buffer
- **80-95%** - High utilization, team is productive
- **95-110%** - Over-allocated, risk of burnout
- **> 110%** - Critical, immediate redistribution needed

### 2. Workflow State Machine

**Visual Node-Based Editor:**
- Drag-and-drop nodes onto canvas
- Connect nodes to define valid paths
- Configure node settings
- Save as reusable template

**Node Types:**

1. **Start** - Entry point (exactly one per workflow)
2. **Department** - Handoff to department (auto-assigns based on department membership)
3. **Role** - Assign to specific role
4. **Approval** - Requires approval before proceeding
5. **Form** - Collect structured data via form
6. **Conditional** - Branch based on conditions
7. **Sync** - Wait for multiple paths to converge
8. **End** - Exit point (can have multiple)

**State Transitions (from `lib/workflow-execution-service.ts`):**

```typescript
async function progressWorkflow(
  supabase: SupabaseClient,
  instanceId: string,
  toNodeId: string,
  userId: string,
  formResponseId?: string
): Promise<void> {
  // 1. Get current state
  const { data: instance } = await supabase
    .from('workflow_instances')
    .select('*, workflow_nodes(*), workflow_connections(*)')
    .eq('id', instanceId)
    .single();

  const currentNodeId = instance.current_node_id;

  // 2. Validate transition is allowed
  const validConnection = instance.workflow_connections.find(
    c => c.from_node_id === currentNodeId && c.to_node_id === toNodeId
  );

  if (!validConnection && !isOutOfOrderAllowed) {
    throw new Error('Invalid workflow transition');
  }

  // 3. Record transition in history
  await supabase.from('workflow_history').insert({
    workflow_instance_id: instanceId,
    from_node_id: currentNodeId,
    to_node_id: toNodeId,
    transitioned_by: userId,
    transition_type: validConnection ? 'normal' : 'out_of_order',
    form_response_id: formResponseId
  });

  // 4. Update workflow instance
  await supabase
    .from('workflow_instances')
    .update({
      current_node_id: toNodeId,
      status: toNode.node_type === 'end' ? 'completed' : 'active',
      completed_at: toNode.node_type === 'end' ? new Date().toISOString() : null
    })
    .eq('id', instanceId);

  // 5. Handle node-specific logic
  if (toNode.node_type === 'department') {
    await assignToDepartment(supabase, instanceId, toNode.entity_id);
  } else if (toNode.node_type === 'role') {
    await assignToRole(supabase, instanceId, toNode.entity_id);
  } else if (toNode.node_type === 'approval') {
    await createApprovalTask(supabase, instanceId, toNode);
  }
}
```

**Workflow Snapshots:**
- **Started Snapshot:** Captures workflow state when instance created
- **Completed Snapshot:** Captures final state when workflow finishes
- **Purpose:** Changes to template don't affect in-progress workflows

### 3. Dynamic Form Builder

**Form Schema Structure:**
```json
{
  "fields": [
    {
      "id": "client_name",
      "type": "text",
      "label": "Client Name",
      "required": true,
      "placeholder": "Enter client name"
    },
    {
      "id": "service_type",
      "type": "dropdown",
      "label": "Service Type",
      "required": true,
      "options": ["Web Development", "Marketing", "Design", "Analytics"]
    },
    {
      "id": "budget",
      "type": "number",
      "label": "Budget",
      "required": false,
      "conditional": {
        "field": "service_type",
        "operator": "equals",
        "value": "Web Development"
      }
    }
  ]
}
```

**Conditional Logic:**
- **Operators:** equals, not_equals, greater_than, less_than, contains
- **Visibility:** Fields appear/disappear based on other field values
- **Validation:** Required fields enforced before submission

**Form Rendering (React):**
```typescript
function DynamicForm({ schema, onSubmit }) {
  const [formData, setFormData] = useState({});

  const isFieldVisible = (field) => {
    if (!field.conditional) return true;

    const { field: condField, operator, value } = field.conditional;
    const condValue = formData[condField];

    switch (operator) {
      case 'equals': return condValue === value;
      case 'not_equals': return condValue !== value;
      case 'greater_than': return condValue > value;
      case 'less_than': return condValue < value;
      case 'contains': return condValue?.includes(value);
      default: return true;
    }
  };

  return (
    <form onSubmit={onSubmit}>
      {schema.fields.map(field =>
        isFieldVisible(field) && (
          <FieldComponent key={field.id} field={field} value={formData[field.id]} onChange={...} />
        )
      )}
    </form>
  );
}
```

### 4. Auto Clock-Out Protection

**The Problem:** Users forget to clock out, sessions run overnight, skewing time tracking data.

**The Solution:** Automatically close sessions after 16 hours.

**Implementation (from `lib/services/time-entry-service.ts`):**

```typescript
async function ensureNoStaleSessions(supabase: SupabaseClient): Promise<void> {
  // Call database function to auto-close old sessions
  await supabase.rpc('auto_clock_out_stale_sessions');

  // Function updates clock_sessions table:
  // - Sets clock_out_time = clock_in_time + 16 hours
  // - Sets is_active = false
  // - Sets is_auto_clock_out = true
  // For all sessions where:
  // - is_active = true
  // - clock_in_time < NOW() - 16 hours
}

// Called before creating time entries to ensure clean data
async function createTimeEntry(
  supabase: SupabaseClient,
  data: TimeEntryData
): Promise<TimeEntry> {
  // 1. Clean up stale sessions first
  await ensureNoStaleSessions(supabase);

  // 2. Validate hours (max 24 per entry)
  if (data.hours_logged > 24) {
    throw new Error('Cannot log more than 24 hours in a single entry');
  }

  // 3. Insert time entry
  const { data: entry, error } = await supabase
    .from('time_entries')
    .insert(data)
    .single();

  return entry;
}
```

**Safety Features:**
- Cap at 16 hours maximum
- Flag auto-closed sessions with `is_auto_clock_out`
- Prevent data corruption from forgotten sessions
- Users can still manually close and re-open if needed

### 5. Time Entries Page (Phase 9 Feature)

**User-Facing Time Tracking Dashboard** at `/time-entries`

**Features:**
1. **Summary Statistics**
   - Hours logged this week (Monday-Sunday)
   - Hours logged this month
   - Daily average (last 30 days, counting only days with entries)
   - Total entries count

2. **List View with Filters**
   - Date range filter (default: last 30 days)
   - Project dropdown filter
   - Task dropdown filter
   - Sorting: by date, hours, or project
   - Pagination: 20 entries per page

3. **Charts & Visualization**
   - Daily trend line chart (last 30 days)
   - Bar chart: hours by project
   - Pie chart: project distribution
   - Summary insights: most active project, total projects, average daily hours

4. **Edit/Delete Actions**
   - 14-day edit window enforcement
   - Edit: Update hours and description
   - Delete: Permanent removal with confirmation
   - Clock session indicator

5. **Access Control**
   - Implicit access: All authenticated users can view their own time entries
   - No permission check required (inherent access to own data)
   - Admins can view all entries with `VIEW_ALL_TIME_ENTRIES`

**Implementation Files:**
- `/app/time-entries/page.tsx` - Main page with tabs
- `/components/time-entries-list.tsx` - Table with filters
- `/components/time-entries-summary.tsx` - Stats cards
- `/components/time-entries-chart.tsx` - Recharts visualizations
- `/components/clock-widget.tsx` - "View All Entries" button added

**14-Day Edit Window:**
```typescript
const canEditEntry = (entry: TimeEntry): boolean => {
  const entryDate = parseISO(entry.entry_date);
  const daysSinceEntry = differenceInDays(new Date(), entryDate);
  return daysSinceEntry <= 14;
};
```

---

## Component Patterns

### Server vs Client Components

**Default to Server Components:**
- Faster initial page load
- Better SEO
- Direct database access
- No JavaScript shipped to client

**Use Client Components when:**
- Need interactivity (onClick, onChange, etc.)
- Using React hooks (useState, useEffect, etc.)
- Browser APIs (localStorage, window, etc.)
- Third-party libraries requiring browser

### Server Component Pattern

```typescript
// app/projects/[projectId]/page.tsx
import { createServerSupabase } from '@/lib/supabase-server';
import { ProjectDetail } from '@/components/project-detail';

export default async function ProjectPage({ params }: { params: { projectId: string } }) {
  const supabase = await createServerSupabase();
  if (!supabase) {
    return <div>Database connection failed</div>;
  }

  // Fetch data directly on server
  const { data: project, error } = await supabase
    .from('projects')
    .select(`
      *,
      account:accounts(*),
      tasks(*),
      project_assignments(
        user_profiles(*)
      )
    `)
    .eq('id', params.projectId)
    .single();

  if (error || !project) {
    return <div>Project not found</div>;
  }

  // Pass data to client component for interactivity
  return <ProjectDetail project={project} />;
}
```

### Client Component Pattern

```typescript
'use client';

import { useState, useEffect } from 'react';
import { createClientSupabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

export function ProjectActions({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(false);
  const supabase = createClientSupabase();

  const handleComplete = async () => {
    if (!supabase) return;

    setLoading(true);

    const { error } = await supabase
      .from('projects')
      .update({ status: 'complete' })
      .eq('id', projectId);

    if (!error) {
      // Trigger refresh
      window.location.reload();
    }

    setLoading(false);
  };

  return (
    <Button onClick={handleComplete} disabled={loading}>
      Mark Complete
    </Button>
  );
}
```

### Hybrid Pattern (Server + Client)

```typescript
// Server Component (page.tsx)
export default async function ProjectPage({ params }) {
  const supabase = await createServerSupabase();
  const { data: project } = await supabase.from('projects').select('*').eq('id', params.projectId).single();

  // Pass initial data to client component
  return <InteractiveProject initialProject={project} />;
}

// Client Component
'use client';

export function InteractiveProject({ initialProject }) {
  const [project, setProject] = useState(initialProject);
  const supabase = createClientSupabase();

  useEffect(() => {
    if (!supabase) return;

    // Subscribe to real-time updates
    const channel = supabase
      .channel('project-changes')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'projects',
        filter: `id=eq.${initialProject.id}`
      }, (payload) => {
        setProject(payload.new);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return <div>{/* Interactive UI with real-time updates */}</div>;
}
```

---

## API Route Patterns

### Standard CRUD Pattern

```typescript
// app/api/projects/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';
import { Permission } from '@/lib/permissions';
import { requireAuthAndPermission } from '@/lib/auth-guards';
import { createProjectSchema } from '@/lib/validation-schemas';
import { logger } from '@/lib/debug-logger';

// GET - List projects
export async function GET(request: NextRequest) {
  try {
    // 1. Auth check
    await requireAuthAndPermission(Permission.VIEW_PROJECTS, {}, request);

    // 2. Get authenticated Supabase client
    const supabase = createApiSupabaseClient(request);
    if (!supabase) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    // 3. RLS automatically filters to user's accessible projects
    const { data, error } = await supabase
      .from('projects')
      .select('*, accounts(name)')
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Error fetching projects', { error });
      return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
    }

    return NextResponse.json(data);

  } catch (error) {
    logger.error('Unexpected error in GET /api/projects', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create project
export async function POST(request: NextRequest) {
  try {
    // 1. Auth check
    await requireAuthAndPermission(Permission.CREATE_PROJECT, {}, request);

    const supabase = createApiSupabaseClient(request);
    if (!supabase) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    // 2. Validate input
    const body = await request.json();
    const validatedData = createProjectSchema.parse(body);

    // 3. Get authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 4. Create project
    const { data, error } = await supabase
      .from('projects')
      .insert({
        ...validatedData,
        created_by: user.id
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating project', { error, userId: user.id });
      return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 });
    }

    logger.error('Unexpected error in POST /api/projects', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

### Context-Aware Permission Pattern

```typescript
// app/api/projects/[projectId]/route.ts

// PUT - Update project
export async function PUT(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    // Check permission WITH context
    await requireAuthAndPermission(
      Permission.EDIT_PROJECT,
      { projectId: params.projectId },  // Context for permission check
      request
    );

    const supabase = createApiSupabaseClient(request);
    if (!supabase) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    const body = await request.json();
    const validatedData = updateProjectSchema.parse(body);

    // RLS ensures user can only update projects they have access to
    const { data, error } = await supabase
      .from('projects')
      .update(validatedData)
      .eq('id', params.projectId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating project', { error, projectId: params.projectId });
      return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
    }

    return NextResponse.json(data);

  } catch (error) {
    logger.error('Unexpected error in PUT /api/projects/[projectId]', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

### Service Layer Delegation Pattern

```typescript
// app/api/workflows/instances/[id]/progress/route.ts
import { WorkflowExecutionService } from '@/lib/workflow-execution-service';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuthAndPermission(Permission.PROGRESS_WORKFLOW, {}, request);

    const supabase = createApiSupabaseClient(request);
    const { data: { user } } = await supabase.auth.getUser();

    const { toNodeId, formResponseId } = await request.json();

    // Delegate complex logic to service layer
    const result = await WorkflowExecutionService.progressWorkflow(
      supabase,
      params.id,
      toNodeId,
      user.id,
      formResponseId
    );

    return NextResponse.json(result);

  } catch (error) {
    logger.error('Workflow progression failed', { error });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

---

## Common Query Patterns

### Fetching User with Roles and Permissions

```typescript
const { data: userProfile } = await supabase
  .from('user_profiles')
  .select(`
    *,
    user_roles!user_roles_user_id_fkey (
      id,
      role_id,
      assigned_at,
      roles!user_roles_role_id_fkey (
        id,
        name,
        permissions,
        department_id,
        is_system_role,
        departments!roles_department_id_fkey (
          id,
          name,
          description
        )
      )
    )
  `)
  .eq('id', userId)
  .single();
```

### Fetching Projects with Nested Data

```typescript
const { data: projects } = await supabase
  .from('projects')
  .select(`
    *,
    accounts(id, name),
    project_assignments!project_assignments_project_id_fkey(
      id,
      user_profiles(id, name, email)
    ),
    tasks(id, name, status, assigned_to)
  `)
  .eq('account_id', accountId)
  .order('created_at', { ascending: false });
```

### Capacity Metrics Query

```typescript
// Get weekly capacity summary for a user
const { data: capacityData } = await supabase
  .from('weekly_capacity_summary')
  .select('*')
  .eq('user_id', userId)
  .gte('week_start_date', startDate)
  .lte('week_start_date', endDate)
  .order('week_start_date');
```

### Workflow Instance with Full Context

```typescript
const { data: workflowInstance } = await supabase
  .from('workflow_instances')
  .select(`
    *,
    workflow_templates(id, name, description),
    projects(id, name, status),
    workflow_nodes!workflow_instances_current_node_id_fkey(
      id,
      node_type,
      label,
      settings
    ),
    workflow_history(
      id,
      from_node_id,
      to_node_id,
      transitioned_by,
      created_at,
      user_profiles(name, email)
    )
  `)
  .eq('id', instanceId)
  .single();
```

---

## Debugging & Troubleshooting

### Permission Debugging

**Problem:** User can't see/edit a resource they should have access to.

**Debug Steps:**

1. **Run permission debugger:**
```bash
npm run debug:permissions
# Enter user ID and permission name
# Shows: user roles, permissions, context checks
```

2. **Check user roles:**
```typescript
const { data: userRoles } = await supabase
  .from('user_roles')
  .select(`
    *,
    roles(name, permissions, is_system_role)
  `)
  .eq('user_id', userId);

console.log('User roles:', userRoles);
```

3. **Check specific permission:**
```typescript
import { hasPermission } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';

const canEdit = await hasPermission(
  userProfile,
  Permission.EDIT_PROJECT,
  { projectId: 'uuid' },
  supabase
);

console.log('Can edit project:', canEdit);
```

4. **Check project assignment:**
```typescript
const { data: assignment } = await supabase
  .from('project_assignments')
  .select('*')
  .eq('user_id', userId)
  .eq('project_id', projectId)
  .is('removed_at', null);

console.log('Project assignment:', assignment);
```

5. **Check RLS policies:**
```sql
-- In Supabase SQL Editor
SELECT * FROM projects WHERE id = 'project-uuid';
-- If empty, RLS is blocking access
```

### Common Issues & Solutions

**Issue:** "Database connection failed"
```typescript
// Solution: Check environment variables
console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('Has key:', !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY);

// Verify client creation
const supabase = createApiSupabaseClient(request);
if (!supabase) {
  console.error('Supabase client creation failed');
}
```

**Issue:** "Unauthorized" in API route
```typescript
// Solution: Check authentication context
const { data: { user }, error } = await supabase.auth.getUser();
console.log('Auth user:', user);
console.log('Auth error:', error);
```

**Issue:** RLS blocking legitimate access
```typescript
// Solution: Check RLS policies in Supabase Dashboard
// Or temporarily disable for testing (DANGEROUS):
-- ALTER TABLE table_name DISABLE ROW LEVEL SECURITY;
-- Test query
-- ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
```

**Issue:** Permission cache stale
```typescript
// Solution: Clear permission cache
import { clearExpiredCache } from '@/lib/permission-checker';
clearExpiredCache();
```

**Issue:** Workflow won't progress
```typescript
// Debug workflow state
const { data: instance } = await supabase
  .from('workflow_instances')
  .select('*, workflow_nodes!current_node_id(*)')
  .eq('id', instanceId)
  .single();

console.log('Current node:', instance.workflow_nodes);

// Check valid connections
const { data: connections } = await supabase
  .from('workflow_connections')
  .select('*')
  .eq('from_node_id', instance.current_node_id);

console.log('Valid next nodes:', connections);
```

### Logging Patterns

```typescript
import { logger } from '@/lib/debug-logger';

// Structured logging with context
logger.info('User logged in', { userId, email });
logger.error('Database query failed', { error, query, userId });
logger.debug('Permission check', { userId, permission, result });

// Log levels (configured via LOG_LEVEL env var)
// debug - Development detailed logs
// info - General information
// warn - Warning conditions
// error - Error conditions
```

---

## Performance Considerations

### Database Query Optimization

**Use select() wisely:**
```typescript
// ❌ BAD - Fetches all columns
const { data } = await supabase.from('projects').select('*');

// ✅ GOOD - Only fetch needed columns
const { data } = await supabase
  .from('projects')
  .select('id, name, status, created_at');
```

**Limit results:**
```typescript
// Always use .limit() for large tables
const { data } = await supabase
  .from('time_entries')
  .select('*')
  .gte('entry_date', startDate)
  .lte('entry_date', endDate)
  .limit(1000);
```

**Use indexes:**
```sql
-- Create indexes for frequently queried columns
CREATE INDEX idx_projects_account_id ON projects(account_id);
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_time_entries_user_week ON time_entries(user_id, week_start_date);
```

**Parallel queries:**
```typescript
// ✅ GOOD - Run independent queries in parallel
const [projects, tasks, timeEntries] = await Promise.all([
  supabase.from('projects').select('*'),
  supabase.from('tasks').select('*'),
  supabase.from('time_entries').select('*')
]);
```

### Component Rendering

**Memoization:**
```typescript
import { useMemo } from 'react';

function ProjectList({ projects }) {
  // Memoize expensive calculations
  const sortedProjects = useMemo(() => {
    return projects.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [projects]);

  return <div>{/* render */}</div>;
}
```

**Virtualization for long lists:**
```typescript
// Use react-window or similar for 100+ items
import { FixedSizeList } from 'react-window';

function LargeTaskList({ tasks }) {
  return (
    <FixedSizeList
      height={600}
      itemCount={tasks.length}
      itemSize={50}
      width="100%"
    >
      {({ index, style }) => (
        <div style={style}>
          {tasks[index].name}
        </div>
      )}
    </FixedSizeList>
  );
}
```

### Caching Strategies

**Permission cache:** 5-minute TTL (already implemented)

**SWR for client-side data fetching:**
```typescript
import useSWR from 'swr';

function ProjectDetail({ projectId }) {
  const { data, error, mutate } = useSWR(
    `/api/projects/${projectId}`,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 5000 // 5 seconds
    }
  );

  // Optimistic update
  const updateProject = async (updates) => {
    mutate({ ...data, ...updates }, false); // Update UI immediately
    await fetch(`/api/projects/${projectId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
    mutate(); // Revalidate
  };

  return <div>{/* render */}</div>;
}
```

---

## Additional Resources

- **Feature Documentation:** `/docs/architecture/FEATURELIST.md` - Comprehensive feature descriptions
- **Security Guide:** `/docs/security/SECURITY.md` - Security architecture and best practices
- **README:** Complete product overview and setup guide
- **CONTRIBUTING.md:** Development setup and contribution guidelines
- **Workflow Docs:** `/docs/workflows/` - Workflow system documentation
- **Testing Docs:** `/docs/testing/` - Testing strategies and reports
- **Discord Community:** [Join the MovaLab Discord](https://discord.gg/99SpYzNbcu) - Get help, share feedback, and connect with other users
