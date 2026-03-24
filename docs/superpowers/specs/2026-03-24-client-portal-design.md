# Client Portal — Feature Design Spec

**Date:** 2026-03-24
**Status:** Approved
**Author:** Claude (QA/Feature Dev)

---

## Overview

Build a client-facing portal for MovaLab that allows external client users to view their projects, track workflow progress, approve/reject at workflow approval nodes, submit feedback, and view their project team. Clients are invited by admins, accept via email link, and access a dedicated portal with its own layout separate from the internal app.

## Scope

### In Scope
- Database migration to fix `client_portal_invitations`, `client_feedback` table schemas
- RLS policies on client tables + policy additions on `workflow_history`, `project_updates`, `project_issues` for client users
- Service code fixes (`client-portal-service.ts` column name mismatches, query fixes)
- Client invitation email flow (using Resend, modeled after existing internal invitation system)
- Client invitation acceptance page (`/client-invite/[token]`) with Supabase signup
- Dedicated `(client-portal)` route group with own layout
- Layout-level auth guards for client routing (not middleware — Edge Runtime constraint)
- Client dashboard with pending actions, project overview, recent activity
- Projects list page
- Project detail page with workflow progress, approve/reject, feedback submission, team view
- Client profile page
- Error propagation in invite-client API route

### Out of Scope
- Deliverables viewing (no deliverables table/feature yet)
- Client-to-team messaging/chat
- Multi-account client access (one client = one account for V1)
- Client self-registration (invite-only)

## Architecture

### Route Structure

```
app/(client-portal)/
  layout.tsx                    — Client layout with auth guard (is_client check)
  client-portal/
    page.tsx                    — Dashboard
    projects/
      page.tsx                  — Projects list
      [projectId]/
        page.tsx                — Project detail + approve/reject + feedback
    profile/
      page.tsx                  — Client profile

app/client-invite/
  [token]/
    page.tsx                    — Invitation acceptance page (public, no auth required)
```

### Key Decisions
- Separate `(client-portal)` route group — own layout, not nested under `(main)`
- **Layout-level auth guards** (not middleware) — the `layout.tsx` server component calls `createServerSupabase()`, checks `is_client`, and redirects non-client users. This avoids Edge Runtime limitations in `middleware.ts`.
- Reuses shadcn/ui components and Tailwind styling
- All data via existing `/api/client/portal/*` API routes
- Client access gated by `is_client` flag on `user_profiles`, not role permissions

### Existing Code Reused
- `lib/client-portal-service.ts` — business logic (needs column name fixes)
- `/api/client/portal/projects` — GET (list projects)
- `/api/client/portal/projects/[id]` — GET (project detail)
- `/api/client/portal/projects/[id]/approve` — POST
- `/api/client/portal/projects/[id]/reject` — POST
- `/api/client/portal/projects/[id]/feedback` — POST
- `/api/client/accept-invite/[token]` — POST (needs signup flow addition)
- `/api/accounts/[accountId]/invite-client` — POST (needs email sending + error propagation)
- `/api/accounts/[accountId]/client-invites` — GET
- `/api/accounts/[accountId]/client-feedback` — GET
- `app/(main)/admin/client-portal/page.tsx` — Admin management UI
- `lib/validation-schemas.ts` — Client validation schemas

## Service Code Fixes (client-portal-service.ts)

### Fix 1: workflow_history column names
The service uses `handed_off_by` and `out_of_order` (lines ~675, ~750) but the actual DB columns are `transitioned_by` and `transition_type`. Fix:
- `handed_off_by` → `transitioned_by`
- `out_of_order: false` → `transition_type: 'normal'`

### Fix 2: projects.workflow_instance_id doesn't exist
The service selects `workflow_instance_id` from `projects` but this column doesn't exist. `workflow_instances` has `project_id` FK back to projects. Fix: join through `workflow_instances` table to get workflow state, or add a separate query.

### Fix 3: visibility type mismatch
TypeScript interface declares `visibility: 'private' | 'public'` but the DB constraint should be `('account', 'project', 'private')`. Fix: update TypeScript type to match DB constraint values.

### Fix 4: accept-invite needs auth user creation
The `/api/client/accept-invite/[token]` route requires an authenticated user, but the service doesn't create one. Fix: the `/client-invite/[token]` page handles Supabase `auth.signUp()` client-side first, then calls the accept endpoint with the newly authenticated session.

### Fix 5: invite-client error propagation
The invite-client API catches all errors as generic 500. Fix: propagate specific service errors ("pending invitation exists", "user is internal") as 400/409 responses.

## Database Migration

### `client_portal_invitations` — Fix Schema

```sql
-- Add missing columns
ALTER TABLE client_portal_invitations
  ADD COLUMN IF NOT EXISTS token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill invited_at from created_at for existing rows
UPDATE client_portal_invitations SET invited_at = created_at WHERE invited_at IS NULL;

-- Update status constraint to include 'cancelled'
ALTER TABLE client_portal_invitations
  DROP CONSTRAINT IF EXISTS client_portal_invitations_status_check;
ALTER TABLE client_portal_invitations
  ADD CONSTRAINT client_portal_invitations_status_check
  CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled'));

-- Enable RLS
ALTER TABLE client_portal_invitations ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage invitations"
  ON client_portal_invitations FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_superadmin = true)
    OR EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN user_roles ur ON ur.user_id = up.id
      JOIN roles r ON r.id = ur.role_id
      WHERE up.id = auth.uid()
      AND (r.permissions->>'manage_client_invites')::boolean = true
    )
  );

CREATE POLICY "Clients can view own invitations"
  ON client_portal_invitations FOR SELECT
  USING (email = (SELECT email FROM user_profiles WHERE id = auth.uid()));
```

### `client_feedback` — Rebuild Schema

```sql
-- Drop old columns
ALTER TABLE client_feedback
  DROP COLUMN IF EXISTS submitted_by,
  DROP COLUMN IF EXISTS rating,
  DROP COLUMN IF EXISTS feedback_text;

-- Add new columns matching service expectations
ALTER TABLE client_feedback
  ADD COLUMN IF NOT EXISTS client_user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS satisfaction_score INTEGER CHECK (satisfaction_score >= 1 AND satisfaction_score <= 10),
  ADD COLUMN IF NOT EXISTS what_went_well TEXT,
  ADD COLUMN IF NOT EXISTS what_needs_improvement TEXT,
  ADD COLUMN IF NOT EXISTS performance_metrics JSONB,
  ADD COLUMN IF NOT EXISTS workflow_history_id UUID REFERENCES workflow_history(id),
  ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'private' CHECK (visibility IN ('account', 'project', 'private'));

-- Enable RLS
ALTER TABLE client_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can insert own feedback"
  ON client_feedback FOR INSERT
  WITH CHECK (client_user_id = auth.uid());

CREATE POLICY "Clients can view own feedback"
  ON client_feedback FOR SELECT
  USING (client_user_id = auth.uid());

CREATE POLICY "Admins can view all feedback"
  ON client_feedback FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_superadmin = true)
    OR EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN user_roles ur ON ur.user_id = up.id
      JOIN roles r ON r.id = ur.role_id
      WHERE up.id = auth.uid()
      AND (r.permissions->>'manage_client_invites')::boolean = true
    )
  );
```

### RLS Policies for Client Write Operations

Client approve/reject needs to write to `workflow_history`, `project_updates`, and `project_issues`. Add policies:

```sql
-- Allow client users to insert workflow history (for approve/reject)
CREATE POLICY "Client users can insert workflow history"
  ON workflow_history FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND is_client = true
    )
    AND EXISTS (
      SELECT 1 FROM workflow_instances wi
      JOIN projects p ON p.id = wi.project_id
      JOIN user_profiles up ON up.client_account_id = p.account_id
      WHERE wi.id = workflow_instance_id AND up.id = auth.uid()
    )
  );

-- Allow client users to insert project updates (for audit trail)
CREATE POLICY "Client users can insert project updates"
  ON project_updates FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND is_client = true
    )
    AND EXISTS (
      SELECT 1 FROM projects p
      JOIN user_profiles up ON up.client_account_id = p.account_id
      WHERE p.id = project_id AND up.id = auth.uid()
    )
  );

-- Allow client users to insert project issues (for rejection reasons)
CREATE POLICY "Client users can insert project issues"
  ON project_issues FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND is_client = true
    )
    AND EXISTS (
      SELECT 1 FROM projects p
      JOIN user_profiles up ON up.client_account_id = p.account_id
      WHERE p.id = project_id AND up.id = auth.uid()
    )
  );
```

## Client Invitation Flow

1. Admin opens Client Portal admin page → selects account → clicks "Invite Client"
2. Enters client email (existing admin UI)
3. API (`/api/accounts/[accountId]/invite-client`):
   - Generates 32-byte hex token (existing service code)
   - Inserts into `client_portal_invitations`
   - **New:** Sends email via Resend with link to `/client-invite/[token]`
   - **Fix:** Propagates specific errors (duplicate invite → 409, internal user → 400)
4. Client clicks link → `/client-invite/[token]` page (public, no auth required):
   - Server component validates token (not expired, not accepted)
   - Shows: account name, registration form (name, email pre-filled, password, company position)
   - **On submit (client-side):**
     a. Calls `supabase.auth.signUp({ email, password })` to create the Supabase auth user
     b. On success, calls `/api/client/accept-invite/[token]` with the now-authenticated session
     c. Accept API updates `user_profiles` with `is_client=true`, `client_account_id`, assigns Client role
     d. Redirects to `/client-portal`
5. Error states: expired token, already accepted, invalid token — all show appropriate messages

## Client Portal UI

### Layout (`app/(client-portal)/layout.tsx`)
- Server component auth guard: `createServerSupabase()` → check `is_client === true` → redirect non-clients to `/dashboard`
- Clean sidebar: MovaLab logo, "Client Portal" badge, account name
- Nav: Dashboard, Projects, Profile
- Sign out button
- Dark mode support (matches internal app theme)
- Responsive

### Dashboard (`/client-portal`)
- **Pending Actions** (top, prominent): Cards for projects at approval nodes. Each shows project name, workflow step, "Review" button linking to project detail
- **My Projects** overview: Cards with project name, status badge, priority, deadline, current workflow step, estimated hours
- **Recent Activity**: Timeline of workflow progressions, team updates

### Projects List (`/client-portal/projects`)
- Table view: project name, status, priority, workflow step, deadline, estimated hours
- Click to navigate to project detail

### Project Detail (`/client-portal/projects/[projectId]`)
- **Workflow Progress**: Visual step indicator (completed steps, current step, remaining)
- **Approve/Reject**: Visible only at approval nodes. Feedback textarea, Approve and Reject buttons
- **Project Info**: Status, priority, dates, estimated hours (no actual hours)
- **Team**: Assigned team members
- **Updates**: Read-only timeline
- **Submit Feedback**: Satisfaction score (1-10), "What went well?", "What needs improvement?"

### Profile (`/client-portal/profile`)
- Name, email, company position, account name
- Change password

## Access Control

### Layout-Level Guards (not middleware)
- `(client-portal)/layout.tsx`: checks `is_client === true`, redirects others to `/dashboard`
- `(main)/layout.tsx`: checks `is_client !== true`, redirects clients to `/client-portal`
- `/client-invite/[token]`: public page, no auth required (server validates token)
- Login page: after successful login, redirect based on `is_client` flag

### API Access Control
- Client portal API routes (`/api/client/portal/*`) check `is_client === true` (existing)
- Internal API routes remain unchanged (RLS + permissions)

## Data Visibility for Clients

- **See:** Project name, description, status, priority, start/end dates, estimated hours, workflow step, team members, project updates
- **Don't see:** Actual hours logged, time entries, capacity data, budget, internal notes, other accounts' data
- **Can do:** Approve/reject at approval nodes, submit feedback
- **Cannot do:** Create/edit/delete projects, create/edit tasks, manage team, access admin

## Testing Plan

- Invite client via admin UI → verify email received (Resend)
- Accept invitation → verify Supabase auth user created, `is_client=true` set
- Login as client → verify redirect to `/client-portal`
- Dashboard shows correct projects for client's account only
- Pending actions shows projects at approval nodes
- Approve a project → verify workflow progresses, audit trail created
- Reject a project → verify workflow stays, issue created, audit trail
- Submit feedback → verify stored and visible in admin feedback view
- Client cannot access internal routes (layout guard redirects)
- Internal user cannot access client portal routes
- Token expiry enforced (expired invitations rejected)
- Duplicate invitation prevention (409 error)
- RLS enforcement: client can only see their account's projects
