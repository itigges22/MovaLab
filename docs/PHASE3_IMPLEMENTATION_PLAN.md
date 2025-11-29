# Phase 3: Systematic Expansion - Implementation Plan

**Date**: 2025-11-27
**Status**: Ready to begin
**Prerequisite**: Phase 2 complete ✅

---

## Phase 2 Completion Summary

### ✅ All Critical Issues Resolved

**Build System**:
- ✅ Cleared `.next` and rebuilt successfully
- ✅ All vendor chunks present
- ✅ All API routes in build output
- ✅ Zero 404 errors, zero MIME type errors

**RLS Security**:
- ✅ Removed dangerous `allow_authenticated_*` policies from `projects` table
- ✅ Removed dangerous `allow_authenticated_*` policies from `accounts` table
- ✅ Tasks table already secure (no dangerous policies)
- ✅ Created context-aware policies for INSERT/UPDATE/DELETE
- ✅ System now secure at database level

**Permission System**:
- ✅ Fixed ALL 46 API routes with authenticated `supabase` client parameter
- ✅ Context-aware permission checks now work correctly
- ✅ Account assignment validation works
- ✅ Project assignment validation works

**Confidence**: **8/10** ⬆️ (up from 2/10 at start)

---

## Phase 3 Objectives

**Goal**: Systematically test and validate the video production workflow with all roles.

**Approach**: Add one role at a time, test each action, expand incrementally.

**Success Criteria**:
- All three roles can log in and access appropriate pages
- Account Manager can create projects
- Creative Lead can view projects and add creative direction
- Videographer can view assigned work and submit for approval
- Workflow handoffs function correctly
- Rejection/revision loops work
- Dual-role permissions (Creative Lead + Videographer) union correctly

---

## Test User Credentials

**Founder (Full Access)**:
- Email: itigges22@gmail.com
- Password: Iman@2012!
- Expected: Access to everything

**Creative Lead + Videographer (Dual Role)**:
- Email: isaactigges1@gmail.com
- Password: Iman@2012!
- Expected: Can review work AND execute work

**Account Manager**:
- Email: lifearrowmedia@gmail.com
- Password: Iman@2012!
- Expected: Can create projects, manage accounts, approve work

---

## Phase 3.1: Basic Role Access Validation

### Test 1: All Roles Can Log In

**For Each Role**:
1. Navigate to http://localhost:3000
2. Log in with credentials
3. Verify dashboard loads
4. Check console for errors
5. Verify user profile shows correct roles
6. Take screenshot

**Expected**:
- ✅ All three users log in successfully
- ✅ Dashboard loads without errors
- ✅ Correct role(s) displayed

**If Failed**: Fix authentication/authorization issues before proceeding

---

### Test 2: Page Access by Role

**Account Manager**:
- Should access: Dashboard, Projects, Accounts, Profile
- Should NOT access: Admin pages (unless has admin permissions)

**Creative Lead + Videographer**:
- Should access: Dashboard, Assigned Projects, Tasks, Profile
- May access: Department pages (if assigned to department)

**Founder**:
- Should access: Everything (all pages, all admin functions)

**Test Method**:
1. Log in as each role
2. Navigate to each major page
3. Document: accessible, 403 error, or 404
4. Verify navigation menu shows/hides appropriate links

---

## Phase 3.2: Account Manager Workflow

### Test 3: Create Project

**Prerequisites**: Logged in as Account Manager

**Steps**:
1. Navigate to Projects page
2. Click "Create Project" button
3. Fill in form:
   - Name: "Test Video Project"
   - Description: "Testing project creation workflow"
   - Account: Select from dropdown (should show assigned accounts only)
   - Status: "Planning"
4. Click "Create"

**Expected**:
- ✅ Form submits successfully
- ✅ Zero console errors
- ✅ Project appears in projects list
- ✅ Project visible in database
- ✅ Success message shown

**If Failed**:
- Check console for permission errors
- Check network tab for 403/500 responses
- Check RLS policies allow insert
- Check CREATE_PROJECT permission exists

---

### Test 4: View Created Project

**Steps**:
1. Click on the newly created project
2. View project details page

**Expected**:
- ✅ Project details load
- ✅ Account Manager is listed as creator
- ✅ Can see edit/delete buttons (if has permission)
- ✅ Zero console errors

---

### Test 5: Assign Users to Project

**Steps**:
1. On project details page
2. Find "Assign Users" or similar UI
3. Assign the Videographer user (isaactigges1@gmail.com)
4. Save assignment

**Expected**:
- ✅ Assignment saves successfully
- ✅ Videographer appears in assigned users list
- ✅ Project assignment record created in database

---

## Phase 3.3: Creative Lead Workflow

### Test 6: Creative Lead Sees Assigned Project

**Prerequisites**: Logged in as Creative Lead/Videographer (isaactigges1@gmail.com)

**Steps**:
1. Navigate to Dashboard
2. View projects list
3. Find the test project created by Account Manager

**Expected**:
- ✅ Test project appears in list (because user is assigned)
- ✅ Can click to view details
- ✅ Zero console errors

**If Failed**:
- Check VIEW_PROJECTS permission exists
- Check project assignment was saved
- Check RLS allows viewing assigned projects

---

### Test 7: Creative Lead Adds Direction

**Steps**:
1. Open the test project
2. Find "Add Creative Direction" or similar UI
3. Add notes: "Make it innovative! Think outside the box on this one."
4. Save

**Expected**:
- ✅ Direction saves successfully
- ✅ Appears in project details
- ✅ Videographer will see this direction

**Note**: If this UI doesn't exist, we need to create it. For now, document whether edit capability exists.

---

## Phase 3.4: Videographer Workflow

### Test 8: Videographer Sees Work

**Prerequisites**: Still logged in as isaactigges1@gmail.com (has Videographer role)

**Steps**:
1. View Dashboard
2. Check for assigned tasks/projects
3. Open the test project

**Expected**:
- ✅ Project appears in "My Work" or similar section
- ✅ Can view creative direction from Creative Lead
- ✅ Can see project details

---

### Test 9: Videographer Creates Task

**Steps**:
1. In the project, create a new task
2. Task name: "Film main sequence"
3. Assign to self
4. Set status: "In Progress"

**Expected**:
- ✅ Task creates successfully
- ✅ Appears in task list
- ✅ Videographer can update task status

---

### Test 10: Videographer Submits for Approval

**Steps**:
1. Mark task as "Complete"
2. Find "Submit for Review" or workflow handoff UI
3. Submit to Creative Lead for approval

**Expected**:
- ✅ Workflow instance created
- ✅ Creative Lead gets notification or sees in queue
- ✅ Status changes to "Pending Review"

**Note**: If workflow UI doesn't exist, document what needs to be built.

---

## Phase 3.5: Approval Workflow

### Test 11: Creative Lead Approves

**Prerequisites**: Switch to Creative Lead perspective (same user, different role)

**Steps**:
1. View pending approvals
2. Find the submitted work
3. Review and approve
4. Submit to Account Manager

**Expected**:
- ✅ Approval saves
- ✅ Work advances to next stage
- ✅ Account Manager sees in their queue

---

### Test 12: Account Manager Approves

**Prerequisites**: Log out and log back in as Account Manager

**Steps**:
1. View pending approvals
2. Find the work approved by Creative Lead
3. Review and approve
4. Submit to Founder for final approval

**Expected**:
- ✅ Approval saves
- ✅ Work advances to Founder
- ✅ Founder sees in their queue

---

### Test 13: Founder Final Approval

**Prerequisites**: Log in as Founder

**Steps**:
1. View pending approvals
2. Find the work
3. Give final approval
4. Mark as ready for delivery

**Expected**:
- ✅ Final approval saves
- ✅ Work marked as "Approved"
- ✅ Account Manager can now deliver to client

---

## Phase 3.6: Rejection/Revision Flow

### Test 14: Creative Lead Rejects Work

**Prerequisites**: Create a new task, submit as Videographer

**Steps**:
1. Log in as Creative Lead
2. View submitted work
3. Reject with notes: "Needs more creativity"
4. Send back to Videographer

**Expected**:
- ✅ Rejection saves
- ✅ Work returns to Videographer
- ✅ Videographer sees rejection notes
- ✅ Can revise and resubmit

---

### Test 15: Multi-Round Revision

**Steps**:
1. Videographer revises and resubmits
2. Creative Lead approves
3. Account Manager rejects
4. Work goes back to Creative Lead
5. Creative Lead sends back to Videographer
6. Videographer revises again
7. Full approval chain

**Expected**:
- ✅ Work can bounce back and forth unlimited times
- ✅ Revision history tracked
- ✅ No workflow "locks" or deadlocks

---

## Phase 3.7: Dual-Role Testing

### Test 16: Permission Union

**Prerequisites**: Logged in as isaactigges1@gmail.com (Creative Lead + Videographer)

**Steps**:
1. Check what permissions user has
2. Verify they have ALL permissions from both roles
3. Test actions that require Creative Lead permission
4. Test actions that require Videographer permission

**Expected**:
- ✅ User has union of all permissions from both roles
- ✅ Can perform both Creative Lead AND Videographer actions
- ✅ No permission conflicts or denials

---

## Phase 3.8: Edge Cases

### Test 17: Self-Approval Prevention

**Test**: Can Creative Lead approve their own work done as Videographer?

**Expected**: System should either allow it (if permissions permit) or prevent it (if business logic requires separation).

**Document**: Current behavior and whether it's correct.

---

### Test 18: Orphaned Projects

**Test**: What happens if assigned user is removed from project?

**Steps**:
1. Create project, assign Videographer
2. Remove Videographer from project
3. Check if Videographer can still see/edit

**Expected**: Videographer should no longer see project (unless has VIEW_ALL_PROJECTS override)

---

### Test 19: Superadmin Bypass

**Test**: Founder can do everything even without specific permissions

**Steps**:
1. Log in as Founder
2. Attempt all CRUD operations on all resources
3. Verify zero permission denials

**Expected**: ✅ Founder bypasses all permission checks

---

## Failure Handling

**For Each Failed Test**:
1. Document exact error message
2. Capture console output
3. Capture network requests
4. Note expected vs actual behavior
5. Create issue ticket with:
   - Test number
   - Role involved
   - Steps to reproduce
   - Error details
   - Severity (CRITICAL/HIGH/MEDIUM/LOW)

**Stop Conditions**:
- If Test 1 (logins) fails → Fix authentication before proceeding
- If Test 3 (create project) fails → Fix before testing downstream workflow
- If Test 6 (Creative Lead sees project) fails → Fix assignment/permissions before approval testing

**Continue Conditions**:
- Minor UI issues → Document and continue
- Edge cases failing → Document and continue if main flow works

---

## Success Metrics

**Phase 3 Complete When**:
- ✅ All three roles can log in
- ✅ Account Manager can create and manage projects
- ✅ Creative Lead can view assigned work and approve
- ✅ Videographer can execute work and submit
- ✅ Workflow handoffs function (at least one full cycle)
- ✅ Rejection/revision works (at least one round-trip)
- ✅ Dual-role permissions work correctly
- ✅ Founder has unrestricted access

**Confidence Target**: **9/10** or higher

---

## Post-Phase 3 Next Steps

**If Phase 3 Succeeds**:
1. Bulk-create workflow templates for common patterns
2. Test client portal (client approval nodes)
3. Test dynamic forms in workflow
4. Performance testing (load test with multiple users)
5. Security audit (penetration testing)
6. Production deployment preparation

**If Phase 3 Partially Succeeds**:
1. Fix blocking issues
2. Re-test failed scenarios
3. Document known limitations
4. Create backlog for remaining fixes

**If Phase 3 Fails**:
1. Root cause analysis
2. Return to Phase 2 (fix foundational issues)
3. Reassess architecture if needed

---

## Timeline Estimate

- Phase 3.1 (Login validation): **30 min**
- Phase 3.2 (Account Manager): **1-2 hours**
- Phase 3.3 (Creative Lead): **1 hour**
- Phase 3.4 (Videographer): **1 hour**
- Phase 3.5 (Approval workflow): **2-3 hours**
- Phase 3.6 (Rejection flow): **1-2 hours**
- Phase 3.7 (Dual-role): **1 hour**
- Phase 3.8 (Edge cases): **1-2 hours**

**Total**: **8-14 hours** for complete Phase 3 testing

---

## Ready to Begin

**Current State**:
- ✅ Build system functional
- ✅ RLS security enforced
- ✅ All API routes fixed
- ✅ Dev server running at localhost:3000

**Next Action**: Begin Test 1 - Verify all three roles can log in.

Let's go! 🚀
