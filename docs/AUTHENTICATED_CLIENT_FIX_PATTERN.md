# Authenticated Client Fix Pattern

## Problem

All 46 API routes have permission checks that are missing the authenticated `supabase` client parameter.

**Current (Broken) Pattern:**
```typescript
const canDo = await hasPermission(userProfile, Permission.SOME_PERMISSION, { context })
```

**Fixed Pattern:**
```typescript
const canDo = await hasPermission(userProfile, Permission.SOME_PERMISSION, { context }, supabase)
```

## Why This Matters

From `lib/permission-checker.ts:312-316`:
```typescript
/**
 * IMPORTANT: Server-side code (API routes) MUST pass the authenticated SupabaseClient as the 4th parameter.
 * Without it, RLS policies will see the request as unauthenticated and deny access to data,
 * causing permission checks to fail incorrectly.
 */
```

Without the authenticated client:
1. Permission checker creates a NEW unauthenticated client
2. RLS policies see the request as unauthenticated
3. Context checks (`isAssignedToProject`, `hasAccountAccess`) query with bad RLS context
4. Queries return empty results
5. Permission check incorrectly denies access to authorized users

## Routes Fixed

- ✅ `/app/api/projects/route.ts` (2 calls fixed - lines 66, 170)

## Routes Remaining (45)

All routes in `/app/api/` that use `hasPermission()` need the same fix:

```bash
app/api/admin/workflows/templates/route.ts
app/api/admin/workflows/templates/[id]/steps/route.ts
app/api/admin/workflows/templates/[id]/route.ts
app/api/projects/[projectId]/updates/route.ts
app/api/workflows/instances/[id]/handoff/route.ts
app/api/client/portal/projects/[id]/reject/route.ts
app/api/client/portal/projects/[id]/approve/route.ts
app/api/client/portal/projects/[id]/feedback/route.ts
app/api/client/portal/projects/[id]/route.ts
app/api/workflows/instances/[id]/history/route.ts
app/api/workflows/instances/[id]/route.ts
app/api/workflows/history/[historyId]/form/route.ts
app/api/workflows/instances/[id]/next-nodes/route.ts
app/api/admin/workflows/templates/[id]/connections/route.ts
app/api/admin/workflows/templates/[id]/nodes/route.ts
app/api/workflows/forms/responses/[id]/route.ts
app/api/admin/workflows/connections/[connectionId]/route.ts
app/api/admin/workflows/nodes/[nodeId]/route.ts
app/api/admin/forms/templates/[id]/route.ts
app/api/tasks/[taskId]/route.ts
app/api/accounts/[accountId]/client-feedback/route.ts
app/api/accounts/route.ts
app/api/accounts/[accountId]/invite-client/route.ts
app/api/accounts/[accountId]/client-invites/route.ts
app/api/workflows/forms/responses/route.ts
app/api/workflows/instances/start/route.ts
app/api/admin/forms/templates/route.ts
app/api/admin/client-feedback/route.ts
app/api/client/portal/projects/route.ts
app/api/projects/[projectId]/updates/[updateId]/route.ts
app/api/projects/[projectId]/issues/[issueId]/route.ts
app/api/projects/[projectId]/issues/route.ts
app/api/projects/[projectId]/route.ts
app/api/tasks/route.ts
app/api/admin/rbac-diagnostics/test/route.ts
app/api/admin/rbac-diagnostics/route.ts
app/api/project-updates/route.ts
app/api/clock/out/route.ts
app/api/admin/time-entries/[id]/route.ts
app/api/clock/route.ts
app/api/time-entries/route.ts
app/api/availability/route.ts
app/api/admin/time-entries/route.ts
app/api/capacity/route.ts
app/api/auth/permissions/route.ts
```

## Bulk Fix Strategy

For each route:
1. Grep for `hasPermission(` calls
2. Check if the supabase client is already passed as 4th parameter
3. If not, add `, supabase` after the context parameter (or `undefined` if no context)
4. Add comment: `// CRITICAL: Pass authenticated supabase client for proper RLS context`

## Example Fixes

### No Context
```typescript
// BEFORE
const can = await hasPermission(userProfile, Permission.VIEW_TASKS)

// AFTER
const can = await hasPermission(userProfile, Permission.VIEW_TASKS, undefined, supabase)
```

### With Context
```typescript
// BEFORE
const can = await hasPermission(userProfile, Permission.EDIT_PROJECT, { projectId })

// AFTER
const can = await hasPermission(userProfile, Permission.EDIT_PROJECT, { projectId }, supabase)
```

### With Context AND Account
```typescript
// BEFORE
const can = await hasPermission(userProfile, Permission.CREATE_TASK, { projectId, accountId })

// AFTER
const can = await hasPermission(userProfile, Permission.CREATE_TASK, { projectId, accountId }, supabase)
```

## Testing After Fix

After fixing each route, verify:
1. Permission checks pass for authorized users
2. Permission checks fail for unauthorized users
3. No console errors about RLS
4. Context-aware checks (assigned projects, accounts) work correctly

## Priority Order

Fix in this order:
1. **HIGH**: Core workflow routes (projects, tasks, accounts)
2. **MEDIUM**: Workflow automation routes
3. **LOW**: Admin diagnostic routes

## Status

**1 / 46 routes fixed** (2.2% complete)

Next: Test working vertical with fixed `/api/projects` route before bulk-fixing the rest.
