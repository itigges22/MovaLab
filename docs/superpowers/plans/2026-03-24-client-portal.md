# Client Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full client-facing portal where external clients can view projects, approve/reject workflow steps, submit feedback, and track project progress.

**Architecture:** Dedicated `(client-portal)` route group with its own layout, separate from the internal `(main)` app. Layout-level auth guards (not middleware) detect `is_client` flag and enforce routing. Existing API routes and service layer are reused with targeted fixes.

**Tech Stack:** Next.js 15 App Router, Supabase (PostgreSQL + RLS + Auth), shadcn/ui, Tailwind CSS, Resend (email), Zod validation

**Spec:** `docs/superpowers/specs/2026-03-24-client-portal-design.md`

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `supabase/migrations/20260324100000_client_portal_schema_fixes.sql` | Fix client tables + add RLS policies |
| `app/(client-portal)/layout.tsx` | Client portal layout with auth guard |
| `app/(client-portal)/client-portal/page.tsx` | Client dashboard |
| `app/(client-portal)/client-portal/projects/page.tsx` | Projects list |
| `app/(client-portal)/client-portal/projects/[projectId]/page.tsx` | Project detail + approve/reject + feedback |
| `app/(client-portal)/client-portal/profile/page.tsx` | Client profile |
| `app/client-invite/[token]/page.tsx` | Invitation acceptance page (public) |
| `components/client-portal-sidebar.tsx` | Client portal sidebar navigation |
| `components/client-workflow-progress.tsx` | Workflow step visualization for clients |
| `components/client-approve-reject.tsx` | Approve/reject UI with feedback textarea |
| `components/client-feedback-form.tsx` | Feedback submission form |
| `lib/email/templates/client-invitation.ts` | Client invitation email HTML template |

### Modified Files
| File | Changes |
|------|---------|
| `lib/client-portal-service.ts` | Fix column names, query joins, TypeScript types |
| `app/api/accounts/[accountId]/invite-client/route.ts` | Add email sending + error propagation |
| `app/api/client/accept-invite/[token]/route.ts` | Support signup flow |
| `app/(main)/layout.tsx` | Add `is_client` redirect guard |
| `middleware.ts` | Add `/client-invite` to public routes |
| `app/login/page.tsx` (or equivalent) | Redirect clients to `/client-portal` after login |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260324100000_client_portal_schema_fixes.sql`

- [ ] **Step 1: Write the migration file**

Copy the SQL from the spec's "Database Migration" section verbatim. Includes:
- `client_portal_invitations`: add `token`, `accepted_at`, `invited_at` columns, update status constraint, enable RLS + policies
- `client_feedback`: drop old columns, add new columns matching service, enable RLS + policies
- `workflow_history`: add client INSERT policy
- `project_updates`: add client INSERT policy
- `project_issues`: add client INSERT policy
- Backfill `invited_at` from `created_at`

SQL is fully specified in spec lines 100-233.

- [ ] **Step 2: Apply migration on local Supabase**

Run: `npx supabase db reset` or `npx supabase migration up`
Expected: Migration applies without errors.

- [ ] **Step 3: Verify tables with Supabase Studio**

Open `http://localhost:54323`, check:
- `client_portal_invitations` has `token`, `accepted_at`, `invited_at` columns
- `client_feedback` has `client_user_id`, `satisfaction_score`, `what_went_well`, `what_needs_improvement`, `performance_metrics`, `workflow_history_id`, `visibility`
- RLS is enabled on both tables

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260324100000_client_portal_schema_fixes.sql
git commit -m "feat: client portal database migration — fix schemas + add RLS policies"
```

---

## Task 2: Service Code Fixes

**Files:**
- Modify: `lib/client-portal-service.ts`

- [ ] **Step 1: Fix workflow_history column names**

Find all instances of `handed_off_by` (lines ~678, ~755) and replace with `transitioned_by`.
Find all instances of `out_of_order: false` (lines ~680, ~757) and replace with `transition_type: 'normal'`.

- [ ] **Step 2: Fix projects.workflow_instance_id query**

In `getClientProjects()` (line ~328) and `getClientProjectById()` (line ~359), the query selects `workflow_instance_id` from `projects` which doesn't exist. Change to a separate query joining through `workflow_instances`:

```typescript
// After getting projects, fetch workflow instances separately
const projectIds = projects.map(p => p.id);
const { data: workflowInstances } = await supabase
  .from('workflow_instances')
  .select('id, project_id, current_node_id, status, workflow_nodes!workflow_instances_current_node_id_fkey(id, node_type, label)')
  .in('project_id', projectIds)
  .eq('status', 'active');

// Merge workflow data into projects
const projectsWithWorkflow = projects.map(p => ({
  ...p,
  workflow_instance: workflowInstances?.find(wi => wi.project_id === p.id) || null,
}));
```

Remove `workflow_instance_id` from the projects SELECT statement.

- [ ] **Step 3: Fix visibility TypeScript type**

Find the `ClientFeedback` interface (line ~46) and update:
```typescript
// Change from:
visibility: 'private' | 'public';
// To:
visibility: 'account' | 'project' | 'private';
```

- [ ] **Step 4: Verify build passes**

Run: `npm run build`
Expected: No TypeScript errors related to client-portal-service.

- [ ] **Step 5: Commit**

```bash
git add lib/client-portal-service.ts
git commit -m "fix: client-portal-service column names, query joins, TypeScript types"
```

---

## Task 3: Invitation Email + API Error Propagation

**Files:**
- Create: `lib/email/templates/client-invitation.ts`
- Modify: `app/api/accounts/[accountId]/invite-client/route.ts`

- [ ] **Step 1: Create client invitation email template**

```typescript
// lib/email/templates/client-invitation.ts
export function clientInvitationEmailHtml(params: {
  accountName: string;
  inviteUrl: string;
  expiresInDays: number;
}): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>You're invited to view your projects on MovaLab</h2>
      <p><strong>${params.accountName}</strong> has invited you to their client portal where you can track project progress, approve deliverables, and provide feedback.</p>
      <a href="${params.inviteUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 16px 0;">Accept Invitation</a>
      <p style="color: #6b7280; font-size: 14px;">This invitation expires in ${params.expiresInDays} days.</p>
      <p style="color: #6b7280; font-size: 14px;">If you didn't expect this email, you can safely ignore it.</p>
    </div>
  `;
}
```

- [ ] **Step 2: Add email sending to invite-client route**

In `app/api/accounts/[accountId]/invite-client/route.ts`, after the invitation is created by the service (line ~80), add:

```typescript
import { sendEmail } from '@/lib/email/mailer';
import { clientInvitationEmailHtml } from '@/lib/email/templates/client-invitation';

// After: const invitation = await sendClientInvitation(...)
const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/client-invite/${invitation.token}`;
const emailResult = await sendEmail({
  to: invitation.email,
  subject: `You're invited to ${account.name} on MovaLab`,
  html: clientInvitationEmailHtml({
    accountName: account.name,
    inviteUrl,
    expiresInDays: 7,
  }),
});

if (!emailResult.success) {
  logger.warn('Failed to send client invitation email', { email: invitation.email, error: emailResult.error });
}
```

- [ ] **Step 3: Fix error propagation**

Replace the generic catch block with specific error handling:

```typescript
catch (error: unknown) {
  const err = error as Error;
  logger.error('Error in POST /api/accounts/[id]/invite-client', {}, err);

  if (err.message?.includes('pending invitation already exists')) {
    return NextResponse.json({ error: 'A pending invitation already exists for this email' }, { status: 409 });
  }
  if (err.message?.includes('internal user')) {
    return NextResponse.json({ error: 'This email belongs to an internal user' }, { status: 400 });
  }

  return NextResponse.json({ error: 'Failed to send invitation' }, { status: 500 });
}
```

- [ ] **Step 4: Fetch account name for email**

Before sending the email, query the account name:
```typescript
const { data: account } = await supabase
  .from('accounts')
  .select('name')
  .eq('id', accountId)
  .single();
```

- [ ] **Step 5: Commit**

```bash
git add lib/email/templates/client-invitation.ts app/api/accounts/[accountId]/invite-client/route.ts
git commit -m "feat: send client invitation email via Resend + propagate API errors"
```

---

## Task 4: Client Invitation Acceptance Page

**Files:**
- Create: `app/client-invite/[token]/page.tsx`
- Modify: `middleware.ts` (add `/client-invite` to public routes)
- Modify: `app/api/client/accept-invite/[token]/route.ts`

- [ ] **Step 1: Add `/client-invite` to middleware public routes**

In `middleware.ts`, add to the `publicRoutes` array (line ~18):
```typescript
'/client-invite',  // Client portal invitations
```

- [ ] **Step 2: Add GET handler to accept-invite route**

The accept-invite route currently only has POST. Add a GET handler that validates the token and returns invitation details (needed by the page to show account name):

```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = createApiSupabaseClient(request);
  // Use admin/service client since user isn't authenticated yet
  // Validate token, return account name + email
}
```

Note: Since the user isn't authenticated yet during GET, use the service role client or a public-facing validation function.

- [ ] **Step 3: Create the invitation acceptance page**

Model after `app/invite/[token]/page.tsx`. Client component with states: `loading`, `form`, `success`, `error`.

Form fields: name, password, confirm password, company position (optional).

Submit flow:
1. `supabase.auth.signUp({ email, password })` — creates auth user
2. `fetch('/api/client/accept-invite/[token]', { method: 'POST', body: { name, company_position } })` — marks invitation accepted, sets up profile
3. Redirect to `/client-portal`

- [ ] **Step 4: Update accept-invite API to handle fresh signup**

The current API requires `supabase.auth.getUser()` to succeed. After `signUp()`, the user may need email verification or may be auto-confirmed. Ensure the API can handle the post-signup session.

If Supabase requires email confirmation, the flow needs adjustment — check `lib/supabase-server.ts` for confirmation settings.

- [ ] **Step 5: Test the flow manually**

1. Create an invitation via admin UI or API
2. Navigate to `/client-invite/[token]`
3. Fill form, submit
4. Verify: auth user created, `user_profiles.is_client = true`, `client_account_id` set, redirected to `/client-portal`

- [ ] **Step 6: Commit**

```bash
git add app/client-invite/[token]/page.tsx middleware.ts app/api/client/accept-invite/[token]/route.ts
git commit -m "feat: client invitation acceptance page with signup flow"
```

---

## Task 5: Client Portal Layout + Sidebar

**Files:**
- Create: `app/(client-portal)/layout.tsx`
- Create: `components/client-portal-sidebar.tsx`

- [ ] **Step 1: Create client portal sidebar component**

Simple sidebar with: MovaLab logo, "Client Portal" label, account name badge, nav links (Dashboard, Projects, Profile), sign out button. Follow the pattern in `components/client-navigation.tsx` but much simpler — no permission checks needed, just hardcoded nav items.

- [ ] **Step 2: Create client portal layout**

Server component that:
1. Calls `createServerSupabase()` to get auth
2. Queries `user_profiles` for `is_client` and `client_account_id`
3. If NOT `is_client`, redirect to `/dashboard`
4. If not authenticated, redirect to `/login`
5. Fetches account name from `accounts` table
6. Renders sidebar + `{children}`

```typescript
import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import ClientPortalSidebar from '@/components/client-portal-sidebar';

export default async function ClientPortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase();
  if (!supabase) redirect('/login');

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('is_client, client_account_id, name, email')
    .eq('id', user.id)
    .single();

  if (!profile?.is_client) redirect('/dashboard');

  const { data: account } = await supabase
    .from('accounts')
    .select('name')
    .eq('id', profile.client_account_id)
    .single();

  return (
    <div className="flex h-screen">
      <ClientPortalSidebar
        userName={profile.name}
        userEmail={profile.email}
        accountName={account?.name || 'Unknown Account'}
      />
      <main className="flex-1 overflow-auto p-6">
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Add `is_client` redirect to main layout**

In `app/(main)/layout.tsx`, after the auth check, add:
```typescript
if (userProfile?.is_client) {
  redirect('/client-portal');
}
```

This ensures client users are always routed to their portal.

- [ ] **Step 4: Verify layout renders**

Navigate to `/client-portal` as a test client user. Should see sidebar with logo, account name, nav links. Non-client users should be redirected away.

- [ ] **Step 5: Commit**

```bash
git add app/(client-portal)/layout.tsx components/client-portal-sidebar.tsx
git commit -m "feat: client portal layout with auth guard + sidebar"
```

---

## Task 6: Client Dashboard Page

**Files:**
- Create: `app/(client-portal)/client-portal/page.tsx`

- [ ] **Step 1: Create the dashboard page**

Client component that fetches from `/api/client/portal/projects` and displays:

1. **Pending Actions** section: Filter projects where workflow is at an approval node. Show project name, current step, "Review" link to project detail.

2. **My Projects** section: Cards for each project with: name, status badge, priority badge, deadline, estimated hours, current workflow step.

3. **Recent Activity** section: Fetch project updates for client's projects and display as timeline.

Use existing shadcn/ui components: `Card`, `Badge`, `Button`, `Separator`.

- [ ] **Step 2: Handle empty states**

- No projects: "No projects found for your account"
- No pending actions: "No items requiring your attention"
- No activity: "No recent activity"

- [ ] **Step 3: Commit**

```bash
git add app/(client-portal)/client-portal/page.tsx
git commit -m "feat: client portal dashboard with pending actions + project overview"
```

---

## Task 7: Client Projects List Page

**Files:**
- Create: `app/(client-portal)/client-portal/projects/page.tsx`

- [ ] **Step 1: Create projects list page**

Fetch from `/api/client/portal/projects`. Display as table with columns:
- Project Name
- Status (badge)
- Priority (badge)
- Workflow Step
- Deadline
- Estimated Hours

Each row links to `/client-portal/projects/[projectId]`.

- [ ] **Step 2: Commit**

```bash
git add app/(client-portal)/client-portal/projects/page.tsx
git commit -m "feat: client portal projects list page"
```

---

## Task 8: Project Detail Page + Approve/Reject + Feedback

**Files:**
- Create: `app/(client-portal)/client-portal/projects/[projectId]/page.tsx`
- Create: `components/client-workflow-progress.tsx`
- Create: `components/client-approve-reject.tsx`
- Create: `components/client-feedback-form.tsx`

- [ ] **Step 1: Create workflow progress visualization**

`components/client-workflow-progress.tsx`: Takes workflow nodes and current node ID. Renders a horizontal step indicator showing completed, current, and upcoming steps.

- [ ] **Step 2: Create approve/reject component**

`components/client-approve-reject.tsx`: Shows when project is at an approval node. Contains:
- Current step name
- Feedback/notes textarea
- "Approve" button (green) → calls `/api/client/portal/projects/[id]/approve`
- "Reject" button (red) → calls `/api/client/portal/projects/[id]/reject`
- Loading states, success/error toasts

- [ ] **Step 3: Create feedback form component**

`components/client-feedback-form.tsx`: Contains:
- Satisfaction score (1-10, clickable number buttons or slider)
- "What went well?" textarea
- "What needs improvement?" textarea
- Submit button → calls `/api/client/portal/projects/[id]/feedback`

- [ ] **Step 4: Create the project detail page**

Fetches from `/api/client/portal/projects/[projectId]`. Displays:
- Project header (name, status, priority)
- Workflow progress visualization
- Approve/reject section (conditional on approval node)
- Project info (dates, estimated hours — no actual hours)
- Team members list
- Project updates timeline (read-only)
- Feedback form

- [ ] **Step 5: Test approve/reject flow**

1. Ensure a project is at an approval node
2. Navigate to project detail as client
3. Click "Approve" with notes
4. Verify: workflow progresses, audit trail created, toast success
5. Test "Reject" similarly — workflow stays, issue created

- [ ] **Step 6: Commit**

```bash
git add app/(client-portal)/client-portal/projects/[projectId]/page.tsx components/client-workflow-progress.tsx components/client-approve-reject.tsx components/client-feedback-form.tsx
git commit -m "feat: client project detail with workflow progress, approve/reject, feedback"
```

---

## Task 9: Client Profile Page

**Files:**
- Create: `app/(client-portal)/client-portal/profile/page.tsx`

- [ ] **Step 1: Create client profile page**

Display: name, email, company position, account name. Allow editing name and company position via `/api/profile` PATCH. Show change password section.

- [ ] **Step 2: Commit**

```bash
git add app/(client-portal)/client-portal/profile/page.tsx
git commit -m "feat: client portal profile page"
```

---

## Task 10: Login Redirect for Client Users

**Files:**
- Modify: `app/login/page.tsx` or auth callback handler

- [ ] **Step 1: Add client redirect after login**

After successful login, check if `user_profiles.is_client === true`. If so, redirect to `/client-portal` instead of `/dashboard`. Check the auth callback or the login success handler for where this redirect logic lives.

- [ ] **Step 2: Test full flow**

1. Sign out
2. Login as client user
3. Verify redirect to `/client-portal` (not `/dashboard`)
4. Login as internal user
5. Verify redirect to `/dashboard` (not `/client-portal`)

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: redirect client users to /client-portal on login"
```

---

## Task 11: Deploy to Production + Test

- [ ] **Step 1: Apply migration on production VPS**

```bash
ssh root@159.89.38.56
cd /root/MovaLab
npx supabase migration up
```

- [ ] **Step 2: Build and restart**

```bash
git pull origin main
npm run build
# restart the app process
```

- [ ] **Step 3: End-to-end test on production**

1. Admin sends client invitation from Client Portal admin page
2. Check email received (Resend)
3. Click link → acceptance page renders
4. Fill form → account created
5. Login as client → redirected to `/client-portal`
6. Dashboard shows projects
7. Navigate to project with approval node
8. Approve/reject works
9. Submit feedback works
10. Client cannot access internal routes

- [ ] **Step 4: Commit any fixes**

```bash
git commit -m "fix: production deployment fixes for client portal"
```
