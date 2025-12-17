# Database Scout - RLS Investigation Report

**Date:** 2025-11-27
**Investigator:** Database Scout (Founder Agent)
**Database:** MovaLab Supabase PostgreSQL
**Scope:** RLS policies, data integrity, permission system architecture

---

## Executive Summary

This investigation identified **5 CRITICAL issues** and **3 HIGH-priority issues** in the MovaLab database RLS implementation. The most severe finding is a **circular RLS dependency** in the `user_roles` table that creates infinite recursion in permission checking. Additionally, overly permissive policies allow any authenticated user to modify critical data, and complex nested RLS queries in workflow tables will cause performance degradation and potential access failures.

**Immediate Action Required:**
1. Fix circular RLS dependency in `user_roles` table
2. Remove overly permissive authenticated-only policies
3. Resolve duplicate/conflicting policies on same tables

---

## Database State Overview

### User Accounts
- **Total users:** 4 (in auth.users)
- **User profiles:** 4 (correctly created via trigger)
- **Superadmin flag:** 1 user (jitigges@vt.edu)
- **Role assignments:** 6 user_role entries across 4 users

### Test Account Credentials
- **Email:** itigges22@gmail.com
- **Role:** Founder (hierarchy level 11, full permissions)
- **Superadmin status:** NO (not in Superadmin role, is_superadmin flag = false)

### Role System
- **Total roles:** 20 roles defined
- **System roles:** 3 (No Assigned Role, Client, Superadmin)
- **Department roles:** 17
- **Founder role permissions:** 78 out of 136 possible permissions enabled

### Data Population
- Most application tables empty (0 rows) - indicates testing/development environment
- Workflow system configured: 8 templates, 31 nodes, 28 connections
- Clock sessions active: 5 entries
- User availability data: 4 entries
- Account members: 2 entries

---

## CRITICAL Findings

### CRITICAL-1: Circular RLS Dependency in user_roles Table

**Table:** `user_roles`
**Severity:** CRITICAL
**Impact:** Infinite recursion, permission system failure, potential database deadlock

**Details:**
The `user_roles` table has RLS policies that call the function `user_has_permission()`:

```sql
-- Policy on user_roles table
CREATE POLICY "user_roles_select_policy" ON user_roles
FOR SELECT USING (
  (user_id = auth.uid())
  OR user_is_superadmin()
  OR user_has_permission('view_users')
  OR user_has_permission('manage_users')
);
```

However, `user_has_permission()` function queries the `user_roles` table:

```sql
CREATE FUNCTION user_has_permission(permission_name text) RETURNS boolean AS $$
BEGIN
  -- Queries user_roles table (which has RLS policies!)
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND (r.permissions->permission_name)::boolean = TRUE
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
```

**Circular dependency chain:**
1. Query `user_roles` table
2. RLS policy activates, calls `user_has_permission('view_users')`
3. `user_has_permission()` queries `user_roles` table
4. RLS policy activates again → INFINITE LOOP

**Why This Breaks:**
- When `SECURITY DEFINER` is used, the function runs with definer privileges (bypassing RLS)
- BUT if RLS is enabled on tables the function queries, those policies still apply
- This creates a recursive evaluation where policy → function → policy → function...
- PostgreSQL will either error out or cause severe performance degradation

**Recommendation:**
- Change `user_has_permission()` and `user_is_superadmin()` to use `SECURITY DEFINER` to bypass RLS when querying `user_roles` and `user_profiles`
- OR create a view with `security_invoker = false` that bypasses RLS for permission checking
- OR remove the RLS policies from `user_roles` table entirely (use application-level checks only)

---

### CRITICAL-2: Duplicate and Conflicting RLS Policies on user_roles

**Table:** `user_roles`
**Severity:** CRITICAL
**Impact:** Unpredictable access control, security vulnerabilities

**Details:**
The `user_roles` table has **10 policies** with multiple policies for the same operations:

**SELECT operation (3 policies):**
1. `"Users can view their own roles"` - allows if `user_id = auth.uid()`
2. `"authenticated_users_can_read_user_roles"` - allows if `auth.uid() IS NOT NULL` (ANY authenticated user)
3. `"user_roles_select_policy"` - allows with permission checks

**INSERT operation (2 policies):**
1. `"authenticated_users_can_insert_user_roles"` - allows if `true` (ANYONE!)
2. `"user_roles_insert_policy"` - allows with permission checks

**DELETE operation (3 policies):**
1. `"authenticated_users_can_delete_user_roles"` - allows if `true` (ANYONE!)
2. `"user_roles_delete_policy"` - allows with permission checks
3. `"Superadmins can manage all user roles"` - allows superadmins
4. `"Superadmins can view all user roles"` - duplicate superadmin policy

**PostgreSQL RLS behavior:**
- Multiple policies for the same operation are combined with OR logic
- If ANY policy allows access, the operation succeeds
- The most permissive policy wins

**Current reality:**
- ANY authenticated user can read ANY user's roles (due to policy #2)
- ANY authenticated user can insert new role assignments (due to `true` policy)
- ANY authenticated user can delete any role assignment (due to `true` policy)

**Recommendation:**
- Delete the overly permissive `authenticated_users_can_*` policies immediately
- Keep only the permission-based policies and superadmin policies
- Verify no other tables have similar duplicate/conflicting policies

---

### CRITICAL-3: Overly Permissive Policies on Core Tables

**Tables:** `projects`, `accounts`, `tasks`
**Severity:** CRITICAL
**Impact:** Data modification by any authenticated user

**Details:**

**Projects table:**
```sql
-- Any authenticated user can DELETE projects
CREATE POLICY "allow_authenticated_delete" ON projects
FOR DELETE USING (auth.uid() IS NOT NULL);

-- Any authenticated user can UPDATE projects
CREATE POLICY "allow_authenticated_update" ON projects
FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Any authenticated user can INSERT projects
CREATE POLICY "allow_authenticated_insert" ON projects
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
```

**Accounts table:**
```sql
-- Same overly permissive policies as projects
CREATE POLICY "allow_authenticated_delete" ON accounts...
CREATE POLICY "allow_authenticated_update" ON accounts...
CREATE POLICY "allow_authenticated_insert" ON accounts...
```

**Impact:**
- A user with "Creative Lead" role can delete ANY account or project
- No permission checking occurs for INSERT/UPDATE/DELETE operations
- Only SELECT has role-based restrictions
- This completely bypasses the permission system defined in roles

**Recommendation:**
- Remove all `allow_authenticated_*` policies immediately
- Implement proper permission-based policies for INSERT/UPDATE/DELETE operations
- Example:
  ```sql
  CREATE POLICY "projects_delete_policy" ON projects
  FOR DELETE USING (
    is_superadmin(auth.uid())
    OR user_has_permission('delete_project')
    OR (created_by = auth.uid() AND user_has_permission('delete_own_projects'))
  );
  ```

---

### CRITICAL-4: Nested RLS Queries in Workflow Tables

**Table:** `workflow_history`
**Severity:** CRITICAL
**Impact:** Severe performance degradation, potential query timeouts, RLS evaluation failures

**Details:**
The `workflow_history_view_assigned` SELECT policy is extremely complex and references 6 other RLS-protected tables:

```sql
CREATE POLICY "workflow_history_view_assigned" ON workflow_history
FOR SELECT USING (
  -- Checks user_profiles, user_roles, roles (nested RLS #1)
  (EXISTS (
    SELECT 1
    FROM user_profiles up
    JOIN user_roles ur ON ur.user_id = up.id
    JOIN roles r ON r.id = ur.role_id
    WHERE up.id = auth.uid()
    AND (r.permissions->>'view_workflows' = 'true'
         OR r.permissions->>'manage_workflows' = 'true')
  ))
  AND
  -- Checks workflow_instances (nested RLS #2)
  (EXISTS (
    SELECT 1
    FROM workflow_instances wi
    WHERE wi.id = workflow_history.workflow_instance_id
    AND (
      -- Checks project_assignments (nested RLS #3)
      (wi.project_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM project_assignments pa
        WHERE pa.project_id = wi.project_id
        AND pa.user_id = auth.uid()
        AND pa.removed_at IS NULL
      ))
      OR
      -- Checks tasks table (nested RLS #4)
      (wi.task_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM tasks t
        WHERE t.id = wi.task_id
        AND t.assigned_to = auth.uid()
      ))
      OR
      -- Nested check again (nested RLS #5)
      (EXISTS (
        SELECT 1
        FROM user_profiles up2
        JOIN user_roles ur2 ON ur2.user_id = up2.id
        JOIN roles r2 ON r2.id = ur2.role_id
        WHERE up2.id = auth.uid()
        AND r2.permissions->>'view_all_projects' = 'true'
      ))
    )
  ))
);
```

**Tables with RLS policies referenced:**
1. `user_profiles` - has 5 RLS policies
2. `user_roles` - has 10 RLS policies (including circular dependency!)
3. `roles` - has RLS policies
4. `workflow_instances` - has RLS policies
5. `project_assignments` - has RLS policies
6. `tasks` - has 5 RLS policies

**Problem:**
- Each nested EXISTS query triggers RLS policy evaluation on that table
- RLS policies on those tables may reference OTHER tables
- Creates a cascade of policy evaluations
- PostgreSQL must evaluate potentially hundreds of nested conditions for a single row
- The `user_roles` circular dependency makes this even worse

**Recommendation:**
- Simplify this policy dramatically
- Use `SECURITY DEFINER` functions to bypass RLS for permission checks
- Consider denormalizing workflow access permissions
- Example simplified approach:
  ```sql
  CREATE POLICY "workflow_history_view" ON workflow_history
  FOR SELECT USING (
    is_superadmin(auth.uid())
    OR user_can_view_workflow_history(workflow_instance_id, auth.uid())
  );

  -- Function uses SECURITY DEFINER to bypass RLS
  CREATE FUNCTION user_can_view_workflow_history(instance_id uuid, user_id uuid)
  RETURNS boolean
  SECURITY DEFINER
  SET search_path = public
  AS $$
    -- Direct queries without RLS evaluation
  $$;
  ```

---

### CRITICAL-5: Functions Reference RLS-Protected Tables

**Functions:** `is_superadmin(user_id)`, `user_has_permission(permission)`
**Severity:** CRITICAL
**Impact:** Inconsistent access control, potential permission bypass

**Details:**

Both critical permission functions query RLS-protected tables:

**is_superadmin function:**
```sql
CREATE FUNCTION is_superadmin(user_id uuid) RETURNS boolean
SECURITY DEFINER -- Runs with elevated privileges
AS $$
BEGIN
  -- Queries user_profiles (has RLS policies)
  IF EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = is_superadmin.user_id AND is_superadmin = TRUE
  ) THEN RETURN TRUE;
  END IF;

  -- Queries user_roles (has RLS policies with circular dependency!)
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = is_superadmin.user_id
    AND r.is_system_role = TRUE
    AND LOWER(r.name) = 'superadmin'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
```

**Problem:**
- `SECURITY DEFINER` means function runs with creator's privileges
- BUT RLS is still enforced on tables the function queries
- If `user_roles` RLS blocks the query, `is_superadmin()` returns false even for actual superadmins
- This can lock out superadmins from accessing data

**Example failure scenario:**
1. User has Superadmin role
2. Query executes: `SELECT * FROM projects WHERE is_superadmin(auth.uid())`
3. `is_superadmin()` function queries `user_roles` table
4. `user_roles` RLS policy evaluates, calls `user_has_permission('view_users')`
5. `user_has_permission()` queries `user_roles` again
6. Circular dependency or access denied
7. `is_superadmin()` returns FALSE
8. Superadmin denied access to projects

**Recommendation:**
- Set `search_path` in function to bypass RLS: `SET search_path TO ''` won't help
- Better: Grant `BYPASSRLS` privilege to the function's creator role
- OR: Remove RLS entirely from `user_roles`, `user_profiles`, and `roles` tables
- These are permission-checking tables and should be accessible by permission functions

---

## HIGH Priority Findings

### HIGH-1: Inconsistent Superadmin Checking

**Tables:** Multiple
**Severity:** HIGH
**Impact:** Inconsistent behavior, confusion in codebase

**Details:**
Three different methods are used to check for superadmin status across policies:

**Method 1: is_superadmin(auth.uid()) function**
- Used in: `projects`, `accounts`, `tasks`, `user_roles`
- Checks both `user_profiles.is_superadmin` flag AND Superadmin role

**Method 2: user_is_superadmin() function**
- Used in: `user_roles` policies
- Same logic as `is_superadmin()` but different function name

**Method 3: Direct EXISTS query**
- Used in: `workflow_history` policies
- Queries `user_profiles.is_superadmin = true` directly
- Does NOT check for Superadmin role

**Problem:**
- Inconsistent behavior: some tables check role, others check flag, some check both
- If a user has Superadmin role but flag is false, access varies by table
- No single source of truth for "who is a superadmin"

**Current state:**
- jitigges@vt.edu: has Superadmin role, has is_superadmin=true flag → WORKS EVERYWHERE
- If someone has role but not flag, or flag but not role → INCONSISTENT ACCESS

**Recommendation:**
- Standardize on ONE function: `is_superadmin(auth.uid())`
- Document that function checks BOTH flag and role (belt-and-suspenders approach)
- Update all policies to use this single function
- OR: Pick one mechanism (flag XOR role) and remove the other

---

### HIGH-2: Missing Context-Aware Policies

**Tables:** `projects`, `accounts`, `tasks`
**Severity:** HIGH
**Impact:** No permission-based access control, RBAC system bypassed

**Details:**
The codebase documentation states:
> "Permission System (Hybrid RBAC): Three-tier checking in lib/permission-checker.ts:
> 1. Base permission (does role have the permission?)
> 2. Context awareness (is user assigned to the resource?)
> 3. Override permissions (e.g., EDIT_ALL_PROJECTS bypasses assignment check)"

However, the database RLS policies do NOT implement this hybrid checking. Current state:

**Projects table:**
- SELECT: Requires having a role (any role) - NO project assignment check
- INSERT/UPDATE/DELETE: Requires being authenticated - NO permission check at all

**Tasks table:**
- SELECT: Requires having a role (any role) - NO task assignment check
- UPDATE: Checks if assigned_to/created_by/owner_id = current user
- INSERT: Requires being creator
- DELETE: Requires being creator

**Missing logic:**
- No check for "user has permission AND is assigned to this project"
- No check for override permissions like `edit_all_projects`
- No integration with the 136-permission system defined in code

**Gap between code and database:**
- Application code in `lib/permission-checker.ts` does hybrid checking
- Database RLS does NOT do hybrid checking
- If someone bypasses application (direct SQL, API exploit), no permission checking occurs

**Recommendation:**
- Implement context-aware policies that check BOTH permissions AND assignments
- Example for projects:
  ```sql
  CREATE POLICY "projects_update_policy" ON projects
  FOR UPDATE USING (
    is_superadmin(auth.uid())
    OR (
      user_has_permission('edit_project')
      AND (
        EXISTS (
          SELECT 1 FROM project_assignments pa
          WHERE pa.project_id = projects.id
          AND pa.user_id = auth.uid()
          AND pa.removed_at IS NULL
        )
        OR user_has_permission('edit_all_projects')
      )
    )
  );
  ```

---

### HIGH-3: No RLS on OAuth Tables

**Tables:** `auth.oauth_clients`, `auth.oauth_authorizations`, `auth.oauth_consents`
**Severity:** HIGH
**Impact:** Potential OAuth token exposure if tables are populated

**Details:**
- All three OAuth-related tables in auth schema have `rls_enabled: false`
- Currently 0 rows, so no immediate exposure
- If OAuth integration is added, tokens/secrets would be readable by anyone with database access

**Recommendation:**
- If OAuth is not being used, these tables can be ignored
- If OAuth will be used, enable RLS and restrict access to service role only
- Monitor for any OAuth client registrations

---

## MEDIUM Priority Findings

### MEDIUM-1: Backup Table in Public Schema

**Table:** `project_departments_backup`
**Severity:** MEDIUM
**Impact:** Cluttered schema, potential confusion

**Details:**
- Table has 18 rows
- RLS enabled but marked as BACKUP TABLE in comment
- Should be in a private schema or deleted if no longer needed

**Recommendation:**
- If backup is still needed, move to a `_archive` or `_backup` schema
- If not needed, drop the table
- Document backup retention policy

---

### MEDIUM-2: Roles Table Open to All Authenticated Users

**Table:** `roles`
**Severity:** MEDIUM
**Impact:** Role structure and permissions visible to all users

**Details:**
Comment on roles table states:
> "SELECT is open to authenticated users, but modifications require service role"

Current policy:
```sql
-- Any authenticated user can read all roles and their permissions
SELECT * FROM roles; -- WORKS for any logged-in user
```

**Problem:**
- All users can see the entire permission structure
- Role hierarchies are visible
- Department assignments are visible
- This is information disclosure but not data modification

**Recommendation:**
- If transparency is desired, keep as-is
- If roles should be restricted, implement permission-based SELECT policy
- Consider: should users only see roles in their department?

---

### MEDIUM-3: No Audit Trail for RLS Policy Changes

**Severity:** MEDIUM
**Impact:** No visibility into who changed what policies

**Details:**
- PostgreSQL doesn't track RLS policy changes in application tables
- The `role_hierarchy_audit` table tracks role changes, but not policy changes
- No way to know when overly permissive policies were added

**Recommendation:**
- Implement migration-based policy management
- Store all RLS policies in version-controlled migration files
- Use code review for all RLS policy changes
- Consider adding a custom audit trigger for pg_policy changes

---

## LOW Priority Findings

### LOW-1: Inconsistent Naming Conventions

**Severity:** LOW
**Impact:** Code maintainability

**Details:**
- Some policies use descriptive names: `"Users with roles can view projects"`
- Others use technical names: `"allow_authenticated_delete"`
- Some use table prefixes: `"tasks_update_policy"`
- No consistent pattern

**Recommendation:**
- Establish naming convention: `{table}_{operation}_{description}`
- Example: `projects_select_with_role`, `tasks_update_if_assigned`
- Update policies during next refactor

---

### LOW-2: Missing Indexes on Frequently Queried RLS Columns

**Severity:** LOW
**Impact:** RLS query performance

**Details:**
RLS policies frequently query:
- `user_roles.user_id` - likely indexed (foreign key)
- `project_assignments.user_id` - likely indexed (foreign key)
- `user_profiles.is_superadmin` - NOT indexed (boolean, low cardinality)
- `roles.name` for 'Superadmin' check - NOT indexed

**Recommendation:**
- Add index on `user_profiles.is_superadmin` for faster superadmin checks
- Add partial index on `roles.name WHERE name = 'Superadmin'`
- Monitor query performance with `EXPLAIN ANALYZE`

---

## Founder Access Test Results

### Test Environment
- Dev server running at localhost:3000
- Attempted login as: itigges22@gmail.com
- Assigned role: Founder (hierarchy level 11, 78 permissions)

### Results
**Status:** UNABLE TO COMPLETE BROWSER TESTING

**Reason:** Next.js build errors preventing page load:
- Multiple "MIME type 'text/plain' not supported" errors
- CSS and JavaScript files returning 404
- Page stuck in "Checking authentication..." state

**Console errors:**
```
Failed to load resource: 404 (Not Found)
Refused to apply style from layout.css because MIME type 'text/plain' is not supported
Refused to execute script from main-app.js because MIME type 'text/plain' is not executable
```

**Database-level testing (via SQL):**
- ✅ User exists in auth.users
- ✅ User profile created correctly
- ✅ Founder role assigned correctly
- ✅ is_superadmin flag = FALSE (correct for Founder)
- ✅ Superadmin user (jitigges@vt.edu) has both role AND flag

**Predicted browser behavior (if working):**
Based on RLS policies discovered:
- ❌ Would see database errors due to circular RLS dependency
- ❌ Could potentially modify/delete ANY data due to overly permissive policies
- ⚠️ May experience timeouts on workflow-related pages due to nested RLS queries

**Recommendation:**
- Fix Next.js build issues (appears to be asset serving problem)
- After fixing, test Founder role access to verify RLS policies work as expected
- Test with network tab open to capture any RLS-related 403 errors

---

## Systemic Patterns Observed

### Pattern 1: Policy Layering Without Consolidation
Multiple layers of policies added over time without removing old ones:
- Initial permissive policies (`allow_authenticated_*`)
- Permission-based policies added later
- Superadmin policies added
- Result: Most permissive policy wins, making stricter policies ineffective

### Pattern 2: Mixing Application-Level and Database-Level Permission Checking
- Application code has sophisticated 3-tier permission checking
- Database RLS has simple authenticated-only checks
- Creates false sense of security ("permissions are checked in code")
- Database bypass (SQL injection, compromised service role) has full access

### Pattern 3: Function-Based RLS Policies Querying RLS-Protected Tables
- Common pattern: `CREATE POLICY ... USING (user_has_permission('...'))`
- Function queries `user_roles` table which has RLS
- Creates nested evaluation and circular dependencies
- PostgreSQL struggles to optimize these queries

### Pattern 4: No Clear Ownership of Permission Checking
- Some tables rely entirely on application code
- Some tables have database RLS
- Some have both (with different logic)
- No documented decision on which layer is authoritative

---

## Recommended Investigation Areas

### 1. Performance Testing Under Load
**Why:** Nested RLS queries may cause timeouts with real data volume

**Test:**
- Populate tables with realistic data (1000+ projects, 100+ users, 50+ roles)
- Execute queries that trigger workflow_history RLS policy
- Measure query execution time
- Look for queries > 1 second

### 2. Permission System Consistency Audit
**Why:** Gap between 136 permissions in code vs RLS implementation

**Audit:**
- List all 136 permissions from `lib/permissions.ts`
- Map each permission to database RLS policies that enforce it
- Identify permissions with no database enforcement
- Identify RLS policies that don't match any code permission

### 3. Workflow System RLS Deep Dive
**Why:** Most complex RLS policies, highest risk of failures

**Investigate:**
- `workflow_instances` policies
- `workflow_nodes` policies
- `workflow_connections` policies
- `workflow_approvals` policies
- Foreign key relationships and circular dependencies

### 4. Test RLS Bypass Scenarios
**Why:** Verify defense in depth

**Test scenarios:**
- User with no roles tries to access data
- User with role but no project assignment tries to access project
- User attempts to modify data they can only view
- Verify superadmin bypasses work correctly

### 5. Migration Path Planning
**Why:** Fixing these issues requires careful migration strategy

**Plan:**
- Cannot drop all policies at once (would expose data)
- Need phased approach with testing between phases
- Requires downtime or careful transaction management
- Document rollback procedures

---

## Summary of Findings

### By Severity

**CRITICAL (5 findings):**
1. Circular RLS dependency in user_roles
2. Duplicate/conflicting policies on user_roles
3. Overly permissive policies on core tables
4. Nested RLS queries in workflow tables
5. Functions reference RLS-protected tables

**HIGH (3 findings):**
1. Inconsistent superadmin checking
2. Missing context-aware policies
3. No RLS on OAuth tables

**MEDIUM (3 findings):**
1. Backup table in public schema
2. Roles table open to all authenticated users
3. No audit trail for RLS policy changes

**LOW (2 findings):**
1. Inconsistent naming conventions
2. Missing indexes on RLS columns

### By Impact

**Data Security:**
- CRITICAL: Any authenticated user can modify any account/project/task
- CRITICAL: user_roles can be modified by anyone
- HIGH: No permission-based access control in database

**System Stability:**
- CRITICAL: Circular RLS dependency can cause infinite loops
- CRITICAL: Nested RLS queries will cause severe performance issues
- CRITICAL: Permission functions may fail for actual superadmins

**Code Maintainability:**
- HIGH: Inconsistent superadmin checking across codebase
- MEDIUM: No audit trail for policy changes
- LOW: Inconsistent naming conventions

---

## Next Steps

### Immediate (Within 24 hours)
1. **Fix circular dependency:** Remove RLS from user_roles or make functions bypass RLS
2. **Remove overly permissive policies:** Delete all `allow_authenticated_*` policies
3. **Verify superadmin access:** Ensure jitigges@vt.edu can still access everything

### Short-term (Within 1 week)
1. **Implement proper permission-based policies** for INSERT/UPDATE/DELETE operations
2. **Simplify workflow_history policies** using SECURITY DEFINER functions
3. **Consolidate duplicate policies** to single policy per operation
4. **Test with realistic data volume** to identify performance issues

### Long-term (Within 1 month)
1. **Audit all 136 permissions** and map to RLS policies
2. **Implement context-aware policies** for hybrid permission checking
3. **Create RLS policy migration strategy** and version control
4. **Document RLS policy architecture** and ownership model
5. **Set up monitoring** for RLS-related query performance

---

## Conclusion

The MovaLab database has a sophisticated permission system defined in application code with 136 granular permissions and role-based access control. However, the database-level RLS policies do not enforce these permissions, creating a significant security gap.

The most critical issue is the circular RLS dependency in the `user_roles` table, which will cause permission checking to fail or enter infinite recursion. The second most critical issue is the overly permissive policies that allow any authenticated user to modify critical data, completely bypassing the intended permission system.

These issues must be addressed immediately before moving to production. The recommended approach is:
1. Fix the circular dependency first (enables permission checking to work)
2. Remove overly permissive policies (prevents unauthorized access)
3. Implement proper context-aware policies (enforces the hybrid RBAC system)
4. Test thoroughly with realistic data and load

**Risk Assessment:**
- **Current state:** HIGH RISK - any authenticated user can modify most data
- **After immediate fixes:** MEDIUM RISK - permission system functional but not complete
- **After short-term fixes:** LOW RISK - defense in depth with application + database enforcement
- **After long-term fixes:** SECURE - comprehensive RLS implementation aligned with code

**Estimated effort:**
- Immediate fixes: 4-8 hours (careful testing required)
- Short-term fixes: 2-3 days (policy rewriting and testing)
- Long-term fixes: 1-2 weeks (full audit and implementation)

---

## Appendix: Key User & Role Data

### User: itigges22@gmail.com (Test account)
- **ID:** 0ad129ef-8da3-450a-8c4d-c34ceb09ca1c
- **Name:** Johnathon Tiggess
- **Role:** Founder
- **is_superadmin:** false
- **Created:** 2025-10-09 05:26:46 UTC

### User: jitigges@vt.edu (Actual superadmin)
- **ID:** 608a7221-004c-4539-9563-141a8814e5ca
- **Name:** Isaac Tigges
- **Role:** Superadmin
- **is_superadmin:** true
- **Created:** 2025-10-09 02:28:43 UTC

### Founder Role Permissions (78 enabled)
- Full project/account/task management
- Workflow management and execution
- User management and role assignment
- Analytics and capacity viewing
- Newsletter and department management
- Client portal management
- Does NOT have: Some admin-level permissions reserved for Superadmin

### Superadmin Role Permissions (6 enabled)
- Workflow management (view, manage, execute)
- Client portal (send invites, view feedback)
- Skip workflow nodes
- Note: Likely relies on is_superadmin flag for full access, not role permissions

---

**Report End**
