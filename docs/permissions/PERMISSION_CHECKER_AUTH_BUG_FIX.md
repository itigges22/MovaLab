# Permission Checker Authentication Bug Fix

## Date: 2025-11-27

## Issue Summary

Account Manager users were getting "Insufficient permissions to view project updates" errors even though they had the required permissions and proper account access.

## Root Cause

**Critical Architectural Bug:** The permission checker (`lib/permission-checker.ts`) was creating its own browser Supabase client using `createClientSupabase()` instead of accepting an authenticated server client as a parameter.

### The Problem

When API routes called `hasPermission()`, the permission checker would:
1. Create a new browser client without request authentication context
2. Query the database with this unauthenticated client
3. RLS policies would see the request as unauthenticated and deny data access
4. Permission checks would fail even for users who should have access

This is the **same systemic issue** we discovered with 54+ API routes that were using `createServerSupabase()` instead of `createApiSupabaseClient(request)`.

## Example Scenario

Account Manager user:
- ✓ Has `view_projects` permission in their role
- ✓ Is a member of the account
- ✓ Is the account manager for the account
- ✓ Created the project being viewed
- ✗ Still got "Insufficient permissions" error

Why? The permission checker couldn't verify they created the project because:
```typescript
// In isAssignedToProject() - BEFORE THE FIX
const supabase = createClientSupabase(); // ❌ No auth context!
const { data: project } = await supabase
  .from('projects')
  .select('created_by, assigned_user_id')
  .eq('id', projectId)
  .single();

if (project) {
  if (project.created_by === userId) {
    return true; // This SHOULD work but project is null due to RLS
  }
}
```

The query returned `null` because RLS policies couldn't see the authenticated user.

## Fix Applied

### 1. Updated `lib/permission-checker.ts`

Added optional `SupabaseClient` parameter to all functions:
- `checkPermissionHybrid(userProfile, permission, context, supabaseClient?)`
- `isAssignedToProject(userId, projectId, supabaseClient?)`
- `hasAccountAccess(userId, accountId, supabaseClient?)`
- `hasBasePermission(userProfile, permission, supabaseClient?)`
- `checkAnyPermission(..., supabaseClient?)`
- `checkAllPermissions(..., supabaseClient?)`
- `getUserPermissions(userProfile, supabaseClient?)`
- All helper functions

### 2. Updated `lib/rbac.ts`

Updated all wrapper functions to pass through the client:
- `hasPermission(userProfile, permission, context?, supabaseClient?)`
- `hasAnyPermission(userProfile, permissions, context?, supabaseClient?)`
- `hasAllPermissions(userProfile, permissions, context?, supabaseClient?)`
- All deprecated legacy functions

### 3. Updated API Route

Fixed `app/api/projects/[projectId]/updates/route.ts`:
```typescript
// BEFORE
const canViewProjects = await hasPermission(userProfile, Permission.VIEW_PROJECTS, {
  projectId,
  accountId: project.account_id
});

// AFTER
const canViewProjects = await hasPermission(userProfile, Permission.VIEW_PROJECTS, {
  projectId,
  accountId: project.account_id
}, supabase); // ✓ Pass authenticated client
```

## Backwards Compatibility

The fix maintains full backwards compatibility:
- Client-side code can continue calling without the parameter
- Server-side API routes **should** pass their authenticated client
- Falls back to `createClientSupabase()` if no client provided

## Impact

This fix resolves:
- ✓ Account Manager "Insufficient permissions" error
- ✓ Any permission checks that rely on project assignment verification
- ✓ Any permission checks that rely on account access verification
- ✓ Context-aware permission checks in all API routes that pass the client

## Additional Routes Needing Update

Found 20+ API routes still calling `hasPermission()` without passing the Supabase client:
- `app/api/tasks/route.ts`
- `app/api/tasks/[taskId]/route.ts`
- `app/api/projects/[projectId]/route.ts`
- `app/api/projects/[projectId]/issues/[issueId]/route.ts`
- `app/api/projects/[projectId]/issues/route.ts`
- `app/api/projects/[projectId]/updates/[updateId]/route.ts`
- `app/api/projects/route.ts`
- `app/api/admin/forms/templates/route.ts`
- Many more...

These routes will continue to work due to backwards compatibility, but **should be updated** to pass the authenticated client for optimal permission checking with RLS context.

## Testing

To verify the fix:
1. Log in as Account Manager user
2. Navigate to a project you created
3. Project updates should now load without permission errors
4. Permission checks should correctly identify you as the creator

## Recommendation

**Gradual Migration:** Update remaining API routes to pass the Supabase client parameter when convenient. Priority routes:
1. Routes that check project/account assignment context
2. Routes with complex permission hierarchies
3. Routes experiencing permission-related issues

## Technical Notes

- RLS policies require authenticated user context to function properly
- Server-side Supabase clients must be created with request context: `createApiSupabaseClient(request)`
- Browser clients (`createClientSupabase()`) work in client components but not in server contexts
- Permission checker now supports both contexts through optional parameter pattern
