# Workflow Form Node Fix

## Date: 2025-11-27

## Issue Summary

Form nodes in workflows were not appearing in users' inboxes, making it impossible to fill out required forms. Forms seemed to be "skipped" in the workflow progression.

## Root Cause

The `getUserPendingApprovals()` function in `lib/workflow-execution-service.ts` was **only querying for approval nodes**, completely ignoring form nodes.

### The Bug

```typescript
// BEFORE - Line 348
.eq('workflow_nodes.node_type', 'approval');  // ❌ Only approval nodes!
```

When a workflow progressed to a form node:
1. ✓ The workflow instance correctly moved to the form node
2. ✓ The form node was assigned to the appropriate role/user
3. ✗ But the user's inbox query filtered by `node_type === 'approval'` only
4. ✗ Form nodes were excluded from results
5. ✗ Users couldn't see or fill out the form
6. ✗ Workflow appeared to "skip" the form node

## User Experience Impact

**Observed Behavior:**
- User could "send project to next task" from start node
- Form node was in the workflow but not visible in inbox
- No way to fill out the form
- Data didn't save anywhere visible
- Appeared to skip the second node entirely

**Why It Seemed to Skip:**
The workflow instance WAS at the form node, but since the inbox query didn't show form nodes, users had no way to interact with it. They could only progress it (moving to the next node), effectively "skipping" the form without filling it out.

## Fix Applied

### 1. Updated `getUserPendingApprovals()` in `lib/workflow-execution-service.ts`

Changed the query to include BOTH approval AND form nodes:

```typescript
// AFTER - Line 352
.in('workflow_nodes.node_type', ['approval', 'form']);  // ✓ Both node types!
```

Added documentation explaining the function now returns both types:
```typescript
/**
 * Get user's pending workflow tasks (approvals and forms)
 * Note: Function name kept as "getUserPendingApprovals" for backwards compatibility,
 * but now returns both approval nodes AND form nodes
 */
```

### 2. Fixed `getUserActiveProjects()` Authentication

Also fixed another instance of the `createServerSupabase()` bug in the same file:

```typescript
// BEFORE
export async function getUserActiveProjects(userId: string): Promise<any[]> {
  const supabase = await createServerSupabase();  // ❌ Wrong pattern!

// AFTER
export async function getUserActiveProjects(supabase: SupabaseClient, userId: string): Promise<any[]> {
  if (!supabase) return [];  // ✓ Accept authenticated client!
```

### 3. Updated API Route `app/api/workflows/my-projects/route.ts`

Fixed the route to use the correct Supabase client pattern and pass it to the service:

```typescript
// BEFORE
import { createServerSupabase } from '@/lib/supabase-server';
const supabase = await createServerSupabase();
const projects = await getUserActiveProjects(user.id);

// AFTER
import { createApiSupabaseClient } from '@/lib/supabase-server';
const supabase = createApiSupabaseClient(request);
const projects = await getUserActiveProjects(supabase, user.id);
```

## Expected Behavior After Fix

Now when a workflow reaches a form node:

1. ✓ Workflow instance moves to the form node
2. ✓ Form node is assigned to the appropriate role/user
3. ✓ **Form node appears in user's inbox** (via `/api/workflows/my-approvals`)
4. ✓ User can see the form that needs to be filled out
5. ✓ User fills out the form and submits it
6. ✓ Form response is saved with `form_response_id`
7. ✓ Workflow progresses with the form data attached

## How Forms Should Work in Workflow

### Form Node Configuration
- **Node Type:** `form`
- **Form Template ID:** ID of the form template to display
- **Entity ID:** Role ID that should fill out the form

### Form Submission Flow
1. User views their inbox at `/api/workflows/my-approvals`
2. Sees pending form(s) to fill out
3. Fills out the form (form UI should be rendered based on form_template_id)
4. Submits form response (saved to `form_responses` table)
5. Calls `/api/workflows/progress` with `formResponseId` parameter
6. Workflow history records the form_response_id
7. Workflow progresses to next node

## Testing

To verify the fix:

1. **Create a workflow with a form node:**
   - Start node → Form node → Role node → End node
   - Assign form node to a specific role

2. **Start the workflow on a project:**
   - User creates project, workflow starts
   - Workflow should move from start to form node

3. **Check user's inbox:**
   - Log in as user with the role assigned to the form node
   - Call `/api/workflows/my-approvals`
   - **Should see the workflow instance with the form node** ✓

4. **Fill out and submit form:**
   - Display the form based on `form_template_id`
   - User fills out form
   - Create form response
   - Call `/api/workflows/progress` with the form response ID
   - Verify workflow moves to next node

## Related Issues

This fix resolves issue #7 from the original production blocker list:
> "Form in workflow that is required but nowhere to fill it out (not appearing in inbox)"

## Additional Notes

- The function is still named `getUserPendingApprovals()` for backwards compatibility
- Could be renamed to `getUserPendingWorkflowTasks()` in a future refactor
- Form UI rendering is not implemented yet - frontend needs to handle displaying forms based on `form_template_id`
- Form response creation/submission flow may need additional implementation
