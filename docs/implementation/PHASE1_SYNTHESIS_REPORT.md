# Phase 1 Discovery - Comprehensive Synthesis Report

**Date**: 2025-11-27
**Confidence Assessment**: The application is fundamentally broken at multiple layers simultaneously

---

## Executive Summary

The PRISM PSA application has **catastrophic failures across all three architectural layers**:

1. **Database Layer (RLS)**: Security holes allowing unauthorized data modification
2. **Application Layer (Permissions)**: Missing authenticated client passing breaks permission checks
3. **Frontend Layer (Build)**: Critical build failures prevent application from functioning

**Current State**: The application is **completely unusable** and **insecure** in production.

**Estimated Severity**: **9/10** - This is a full system failure, not isolated bugs.

---

## Layer 1: Database Security (CRITICAL)

### Findings from Database Scout (Founder Agent)

**5 CRITICAL Issues:**

1. **Overly Permissive RLS Policies** - ANY authenticated user can INSERT/UPDATE/DELETE on core tables
   ```sql
   -- This allows ANYONE authenticated to delete ANY project
   CREATE POLICY "allow_authenticated_delete" ON projects
   FOR DELETE USING (auth.uid() IS NOT NULL);
   ```
   - **Impact**: Complete bypass of 58-permission RBAC system at database level
   - **Severity**: CRITICAL - Security hole
   - **Tables Affected**: `projects`, `accounts`, `tasks`

2. **Circular RLS Dependency** - `user_roles` table policies call `user_has_permission()` which queries `user_roles` again
   - **Impact**: Infinite recursion locks out users including superadmins
   - **Severity**: CRITICAL - Can lock out all users

3. **Duplicate Conflicting Policies** - `user_roles` table has 10 policies, multiple for same operation
   - **Impact**: Most permissive policy always wins, unpredictable behavior
   - **Severity**: CRITICAL - Security unpredictability

4. **Nested RLS Performance Bomb** - `workflow_history` policy queries 6 other RLS-protected tables
   - **Impact**: Cascading permission evaluations cause extreme slowdown
   - **Severity**: HIGH - Performance degradation

5. **Function RLS Conflicts** - `is_superadmin()` and `user_has_permission()` functions query RLS-protected tables
   - **Impact**: Can lock out actual superadmins
   - **Severity**: CRITICAL - Admin lockout risk

**3 HIGH-Priority Issues:**
- Inconsistent superadmin checking (3 different methods used)
- Missing context-aware policies (RBAC system not enforced at DB level)
- No RLS on OAuth tables

**Data Integrity Findings:**
- Founder test account (itigges22@gmail.com) has Founder role but is NOT a superadmin
- Actual superadmin is jitigges@vt.edu
- Founder can currently DELETE/UPDATE any account or project due to overly permissive policies

**Full Details**: `/docs/DATABASE_SCOUT_FINDINGS_REPORT.md`

---

## Layer 2: Permission System (HIGH)

### Findings from Permission Mapper (Manual Investigation)

**Permission Count Discrepancy:**
- **Stated**: 102 permissions
- **Actual**: 58 permissions in `lib/permissions.ts`
- **Gap**: 44 missing or miscounted permissions

**Architecture:**
- **Location**: `lib/permissions.ts` - Well-structured enum with 58 permissions
- **Checker**: `lib/permission-checker.ts` - Hybrid RBAC (base + context + override)
- **Wrapper**: `lib/rbac.ts` - Helper functions with legacy compatibility
- **Categories**: 17 categories (Roles, Departments, Accounts, Projects, Tasks, etc.)

**Permission Checking Pattern (CRITICAL BUG):**

All 46 API routes follow this pattern:
```typescript
// app/api/projects/route.ts:65
const canCreateProject = await hasPermission(userProfile, Permission.CREATE_PROJECT, { accountId })
```

**THE BUG**: They're NOT passing the authenticated `supabaseClient` as the 4th parameter!

```typescript
// CURRENT (BROKEN):
hasPermission(userProfile, Permission.CREATE_PROJECT, { accountId })

// REQUIRED (per lib/permission-checker.ts:312-316):
hasPermission(userProfile, Permission.CREATE_PROJECT, { accountId }, supabase)
```

**Impact of Missing Authenticated Client:**
- Permission checker creates NEW unauthenticated client
- RLS policies see request as unauthenticated
- Context checks (isAssignedToProject, hasAccountAccess) fail
- Permission checks incorrectly deny legitimate access
- **Result**: Authorized users cannot perform actions they should be able to

**Hybrid Permission System Design:**
1. **Base Permission**: Does user's role have the permission?
2. **Context Awareness**: Is user assigned to the resource?
3. **Override Permissions**: Does user have override (e.g., VIEW_ALL_PROJECTS)?

**Superadmin Detection (3 Different Methods):**
1. `is_superadmin` flag in user_profiles
2. "Superadmin" role name
3. "Executive" role name (hardcoded in permissions.ts:898)

**Workflow Permissions:**
- CREATE_PROJECT → Account Manager
- VIEW_PROJECTS → Creative Lead, Videographer (assigned projects)
- EDIT_PROJECT → Creative Lead (for adding direction)
- EXECUTE_WORKFLOWS → All roles (for handoffs)
- MANAGE_WORKFLOWS → Account Manager (for creating workflow instances)

**Permission-to-Page Mapping:** Not fully documented, requires frontend investigation

**Inconsistencies Found:**
- MEDIUM: Hardcoded role checks in isSuperadmin (lines 896-903 in permissions.ts)
- MEDIUM: Permission count mismatch (58 actual vs 102 stated)
- HIGH: Missing authenticated client in ALL 46 API routes

---

## Layer 3: Frontend / Build System (CRITICAL)

### Findings from Frontend Auditor (Account Manager Agent)

**Application State: COMPLETELY BROKEN**

**3 Blocking Issues:**

1. **Missing lucide-react Vendor Chunk** (CRITICAL)
   - Project detail pages crash with 500 Internal Server Error
   - Error: Module not found `./vendor-chunks/lucide-react.js`
   - **Blocks**: Viewing any project details

2. **JavaScript Chunks Return 404** (CRITICAL)
   - All pages stuck in "Loading..." state after initial load
   - MIME type errors prevent React from executing
   - **Blocks**: All navigation after first page load

3. **Missing /api/clock Route** (CRITICAL)
   - Time tracking API doesn't exist in build output
   - File not found error on every page load
   - **Blocks**: Time tracking functionality

**Page Accessibility:**
- ✅ Dashboard: Loads on first visit, shows user profile and 1 project
- ❌ Project Details: 500 error, redirects to login
- ❌ Projects List: Infinite "Loading..." state
- ⚠️ Accounts: Loads but shows "No Accounts" despite backend having 1 account
- ❌ Dashboard (after navigation): Stuck on "Loading..." permanently

**Additional Findings:**
- Permission system works correctly at backend level (logs show proper checks)
- 22+ redundant permission checks per page load (performance issue)
- Data mismatch: Server fetches 1 account, UI displays 0 accounts
- Console spam: 15+ expected permission denials logged as WARN on every page

**User Experience:**
Account Manager sees a functional dashboard for ~30 seconds. Any navigation attempt either crashes with 500 error or gets stuck in infinite loading. After a few attempts, even the dashboard becomes unusable.

**Workflow Testing Status**: **0% Complete** - Cannot test ANY workflow because application is completely broken

**Full Details**: `/docs/audit/ACCOUNT_MANAGER_FRONTEND_AUDIT_REPORT.md`

---

## Unified Picture: What's Broken and Where

### Severity Classification

**CRITICAL (9 issues) - Immediate Production Risk:**
1. Overly permissive RLS policies (any user can delete projects/accounts/tasks)
2. Circular RLS dependency (can lock out all users)
3. Duplicate conflicting RLS policies (unpredictable security)
4. RLS function conflicts (can lock out superadmins)
5. Missing authenticated client in ALL API routes (breaks context checks)
6. Missing lucide-react vendor chunk (crashes project pages)
7. 404 JavaScript chunks (breaks all navigation)
8. Missing /api/clock route (breaks time tracking)
9. Data mismatch between backend and frontend (accounts show 0 when 1 exists)

**HIGH (4 issues) - Core Functionality Broken:**
1. Nested RLS performance bomb (extreme slowdown)
2. Inconsistent superadmin checking (3 different methods)
3. Missing context-aware RLS policies (RBAC not enforced at DB)
4. Permission count discrepancy (58 vs 102 stated)

**MEDIUM (2 issues) - Technical Debt:**
1. Hardcoded role checks in permission system
2. 22+ redundant permission checks per page load

**LOW (1 issue) - Minor Annoyances:**
1. Console spam with 15+ permission denial warnings

---

## Which Layer is Most Broken?

**All three layers are critically broken**, but in a specific order:

1. **Frontend/Build (Blocking)** - Nothing works until build is fixed
2. **Database/RLS (Security Risk)** - Once build works, unauthorized access is possible
3. **Application/Permissions (Functionality Broken)** - Even authorized users can't perform actions

**Root Cause Assessment:**

The issues are **NOT cascading from one layer**. They are **independent failures** at each layer:
- Frontend build failures are tooling/configuration issues
- RLS policies are overly permissive database configuration
- Permission checks are missing a function parameter

**Implication**: Fixing one layer will NOT fix the others. All three must be addressed.

---

## Role Access Comparison: CAN vs SHOULD

### Founder Role (itigges22@gmail.com)

**SHOULD Access:**
- ✅ Everything across all accounts, projects, departments
- ✅ Admin dashboard
- ✅ All CRUD operations
- ✅ Workflow management
- ✅ User and role management

**CAN Access (Current State):**
- ✅ Database: Can query all tables (RLS allows authenticated users)
- ❌ Frontend: CANNOT navigate beyond initial dashboard page
- ⚠️ Security Risk: Can DELETE any project/account due to overly permissive RLS
- ❌ NOT flagged as superadmin (neither flag nor Superadmin role)

**Discrepancy**: Founder has database-level access but frontend is broken. Also has too much delete access due to RLS holes.

### Creative Lead + Videographer (isaactigges1@gmail.com)

**SHOULD Access (Dual Role):**
- ✅ View assigned projects (Videographer)
- ✅ Submit completed work for approval (Videographer)
- ✅ View work to review (Creative Lead)
- ✅ Approve/reject submitted work (Creative Lead)
- ✅ Add creative direction to projects (Creative Lead)
- ✅ Execute workflow handoffs (both roles)

**CAN Access (Current State):**
- ❓ Unknown - Agent timed out, manual testing blocked by build failures
- ❌ Frontend: CANNOT navigate beyond initial page
- ⚠️ Permission union: Unknown if dual-role permissions are correctly unioned
- ❌ Workflow testing: Impossible due to build failures

**Discrepancy**: Cannot test. Frontend broken prevents validation.

### Account Manager (lifearrowmedia@gmail.com)

**SHOULD Access:**
- ✅ Create video requests/projects
- ✅ View projects in assigned accounts
- ✅ Manage account users
- ✅ Approve work after Creative Lead approval
- ✅ Reject work and send back for revision
- ✅ Deliver final work to client

**CAN Access (Current State):**
- ✅ Database: Queries execute correctly, 1 account returned
- ❌ Frontend: Dashboard shows "No Accounts" (data mismatch)
- ❌ Frontend: CANNOT view project details (500 error)
- ❌ Frontend: CANNOT view project list (infinite loading)
- ❌ Frontend: CANNOT navigate after first page (404 chunks)
- ❌ Workflow: 0% testable

**Discrepancy**: Backend works correctly, frontend completely broken.

---

## Patterns Observed (Systemic Issues)

### Pattern 1: Security-Performance Tradeoff Gone Wrong
- **Observation**: Overly permissive RLS policies (`auth.uid() IS NOT NULL`) were likely added to "fix" permission issues
- **Root Cause**: Instead of fixing permission checks properly, RLS was relaxed to allow everything
- **Result**: System is insecure but doesn't perform better

### Pattern 2: Missing Link Between Layers
- **Observation**: RLS policies don't enforce RBAC, application permission checks don't use authenticated client
- **Root Cause**: Each layer was built independently without integration
- **Result**: No defense in depth - if one layer fails, whole system fails

### Pattern 3: Build System Degradation
- **Observation**: Vendor chunks missing, routes not in build output
- **Root Cause**: Likely recent dependency update or configuration change broke build
- **Result**: Progressive degradation - works briefly then fails

### Pattern 4: Over-Engineering Permission System, Under-Engineering Implementation
- **Observation**: Sophisticated 3-tier hybrid permission system (base + context + override)
- **But**: Implementation missing critical authenticated client parameter
- **Result**: Well-designed system that doesn't work

### Pattern 5: Frontend-Backend Data Sync Broken
- **Observation**: Backend returns 1 account, frontend shows 0
- **Root Cause**: Either RLS filtering on frontend client or UI state management issue
- **Result**: Users see incorrect data

---

## Blockers Requiring User Input

**None at this time.** Issues are clear and actionable.

---

## Recommended Next Steps

### Immediate Actions (Within 4 Hours):

1. **Fix Build System** (Layer 3 - BLOCKING)
   - `rm -rf .next && npm run build`
   - Verify `/api/clock` route exists and is included in build
   - Resolve lucide-react vendor chunk issue
   - Test that pages load without 404/500 errors

2. **Remove Overly Permissive RLS Policies** (Layer 1 - SECURITY)
   - Remove all `allow_authenticated_*` policies from `projects`, `accounts`, `tasks`
   - Keep only context-aware policies (user is creator, assigned, or has override permission)
   - Verify jitigges@vt.edu superadmin still has access after changes

3. **Fix Authenticated Client Passing** (Layer 2 - FUNCTIONALITY)
   - Update ALL 46 API routes to pass `supabase` as 4th parameter to `hasPermission()`
   - Pattern: `hasPermission(userProfile, permission, context, supabase)`
   - Test that context-aware permission checks work correctly

### Short-Term Actions (Within 24 Hours):

4. **Fix Circular RLS Dependency**
   - Remove RLS from `user_roles` OR make `user_has_permission()` bypass RLS
   - Test that permission checks don't cause infinite recursion

5. **Consolidate Superadmin Detection**
   - Choose ONE method: `is_superadmin` flag (recommended) or "Superadmin" role name
   - Update all code to use single method
   - Remove hardcoded "Executive" superadmin check

6. **Resolve Permission Count Discrepancy**
   - Audit: Are there 58 or 102 permissions?
   - Update documentation to reflect actual count
   - Verify all workflow permissions are defined

### Medium-Term Actions (This Week):

7. **Add Context-Aware RLS Policies**
   - Enforce RBAC at database level
   - Policies should check role permissions AND resource assignment
   - Test that RLS + application permissions work together

8. **Performance Optimization**
   - Fix nested RLS performance bomb in `workflow_history`
   - Reduce 22+ redundant permission checks per page load
   - Implement better caching strategy

9. **Data Sync Investigation**
   - Fix accounts data mismatch (backend 1, frontend 0)
   - Verify RLS policies on frontend client work correctly
   - Test data consistency across all pages

### Long-Term Actions (Next Sprint):

10. **Permission System Audit**
    - Document all 58 permissions and what they control
    - Create permission-to-page mapping
    - Verify frontend permission checks match backend

11. **Workflow Testing**
    - Once build is stable, test full workflow end-to-end
    - Verify rejection/revision loops work correctly
    - Test dual-role users (Creative Lead + Videographer)

---

## Phase 2 Recommendation: Establish One Working Vertical

**Proposed Starting Point**: Account Manager Creates a Video Request/Project

**Why This Vertical?**
1. Beginning of workflow - if this doesn't work, nothing downstream can work
2. Tests all three layers:
   - Frontend: Project creation form
   - Application: CREATE_PROJECT permission check with account context
   - Database: INSERT into projects table with RLS enforcement
3. Simple enough to debug quickly
4. Critical functionality that users need immediately

**Success Criteria for Working Vertical:**
- ✅ Account Manager can navigate to projects page
- ✅ Account Manager can open "Create Project" dialog
- ✅ Account Manager can fill out form and click "Create"
- ✅ Permission check passes (with authenticated client)
- ✅ RLS allows INSERT (user is account manager)
- ✅ Project appears in database
- ✅ Project appears in UI
- ✅ Zero console errors
- ✅ Zero 403/500 responses

**Coordinated Agent Work for Vertical:**
- Database Scout: Verify RLS on projects table allows Account Manager to INSERT
- Permission Mapper: Verify CREATE_PROJECT permission is correctly checked with authenticated client
- Frontend Auditor: Verify project creation form loads and submits without errors

---

## Conclusion

The PRISM PSA application is in a **catastrophic state** with critical failures at all three architectural layers. The issues are **independent** and **non-cascading**, requiring fixes at each layer.

**Confidence in Platform**: Currently **2/10** (user's stated confidence is accurate).

**Path Forward**: Fix build system first (unblocks testing), then secure database (prevents unauthorized access), then fix permission checks (enables authorized access). Establish one working vertical as proof of concept, then expand systematically.

**Estimated Recovery Time**:
- Build fixes: 2-4 hours
- Security fixes: 4-6 hours
- Permission fixes: 6-8 hours
- One working vertical: 12-16 hours total
- Full system stabilization: 3-5 days

**Risk Assessment**: System is **NOT production-ready**. Do not deploy until all CRITICAL issues are resolved.
