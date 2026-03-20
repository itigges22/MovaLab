/**
 * Advanced Tests:
 * 1. E2E User Journey (login → create → edit → complete → verify)
 * 2. Cascade Deletion (delete department → verify roles unlinked)
 * 3. Data Integrity (foreign key constraints, orphan prevention)
 * 4. Timezone/Date handling
 * 5. Session edge cases
 * 6. N+1 query detection (measure response times)
 */

const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const BASE = 'http://127.0.0.1:54321';

interface Result { test: string; pass: boolean; detail: string; }
const results: Result[] = [];

async function getToken(email: string): Promise<string> {
  const res = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY },
    body: JSON.stringify({ email, password: 'Test1234!' })
  });
  const data = await res.json();
  return data.access_token;
}

function svc(path: string, method = 'GET', body?: any) {
  const opts: any = {
    method,
    headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'apikey': SERVICE_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=representation' }
  };
  if (body) opts.body = JSON.stringify(body);
  return fetch(`${BASE}/rest/v1/${path}`, opts);
}

function authed(token: string, path: string, method = 'GET', body?: any) {
  const opts: any = {
    method,
    headers: { 'Authorization': `Bearer ${token}`, 'apikey': ANON_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=representation' }
  };
  if (body) opts.body = JSON.stringify(body);
  return fetch(`${BASE}/rest/v1/${path}`, opts);
}

// ============================================================
// TEST 1: E2E User Journey
// ============================================================
async function testE2EJourney() {
  console.log('\n🚀 Test 1: E2E User Journey');
  const adminToken = await getToken('superadmin@test.local');
  const adminId = '11111111-1111-1111-1111-000000000001';

  // Step 1: Create a project update
  const update = await authed(adminToken, 'project_updates', 'POST', {
    project_id: 'ffffffff-0001-0002-0003-000000000001',
    content: 'E2E journey test: Sprint review completed successfully',
    created_by: adminId
  });
  const updateData = await update.json();
  const updateId = updateData?.[0]?.id;
  results.push({ test: 'E2E: Create project update', pass: update.status === 201 && !!updateId, detail: `Status: ${update.status}` });

  // Step 2: Create a project issue
  const issue = await authed(adminToken, 'project_issues', 'POST', {
    project_id: 'ffffffff-0001-0002-0003-000000000001',
    content: 'E2E journey test: Deadline at risk due to scope change',
    status: 'open',
    created_by: adminId
  });
  const issueData = await issue.json();
  const issueId = issueData?.[0]?.id;
  results.push({ test: 'E2E: Create project issue', pass: issue.status === 201 && !!issueId, detail: `Status: ${issue.status}` });

  // Step 3: Resolve the issue
  if (issueId) {
    const resolve = await authed(adminToken, `project_issues?id=eq.${issueId}`, 'PATCH', {
      status: 'resolved',
      resolved_by: adminId,
      resolved_at: new Date().toISOString()
    });
    results.push({ test: 'E2E: Resolve issue', pass: resolve.status === 200, detail: `Status: ${resolve.status}` });
  }

  // Step 4: Create a time entry
  const timeEntry = await authed(adminToken, 'time_entries', 'POST', {
    task_id: 'ffffffff-ffff-0001-0001-000000000001',
    user_id: adminId,
    project_id: 'ffffffff-0001-0002-0003-000000000001',
    hours_logged: 2.5,
    entry_date: '2026-03-20',
    week_start_date: '2026-03-16',
    description: 'E2E journey: Sprint review and planning'
  });
  const teData = await timeEntry.json();
  const teId = teData?.[0]?.id;
  results.push({ test: 'E2E: Log time entry', pass: timeEntry.status === 201 && !!teId, detail: `Status: ${timeEntry.status}, hours: 2.5` });

  // Step 5: Verify the data chain exists
  const verifyUpdate = await authed(adminToken, `project_updates?id=eq.${updateId}&select=content`);
  const verifyIssue = await authed(adminToken, `project_issues?id=eq.${issueId}&select=status`);
  const verifyTime = await authed(adminToken, `time_entries?id=eq.${teId}&select=hours_logged`);

  const uData = await verifyUpdate.json();
  const iData = await verifyIssue.json();
  const tData = await verifyTime.json();

  results.push({
    test: 'E2E: Verify data chain',
    pass: uData?.[0]?.content?.includes('Sprint review') && iData?.[0]?.status === 'resolved' && tData?.[0]?.hours_logged === 2.5,
    detail: `Update: ${!!uData?.[0]}, Issue resolved: ${iData?.[0]?.status}, Time: ${tData?.[0]?.hours_logged}h`
  });

  // Cleanup
  if (updateId) await authed(adminToken, `project_updates?id=eq.${updateId}`, 'DELETE');
  if (issueId) await svc(`project_issues?id=eq.${issueId}`, 'DELETE');
  if (teId) await svc(`time_entries?id=eq.${teId}`, 'DELETE');
}

// ============================================================
// TEST 2: Cascade Deletion
// ============================================================
async function testCascadeDeletion() {
  console.log('\n🗑️ Test 2: Cascade Deletion');

  // Create a test department
  const deptRes = await svc('departments', 'POST', {
    name: 'Test Cascade Dept',
    description: 'Will be deleted to test cascades'
  });
  const deptData = await deptRes.json();
  const deptId = deptData?.[0]?.id;
  results.push({ test: 'Cascade: Create test department', pass: deptRes.status === 201, detail: `ID: ${deptId}` });

  // Create a role in that department
  const roleRes = await svc('roles', 'POST', {
    name: 'Test Cascade Role',
    department_id: deptId,
    permissions: '{"view_projects": true}',
    hierarchy_level: 5,
    description: 'Test role for cascade deletion'
  });
  const roleData = await roleRes.json();
  const roleId = roleData?.[0]?.id;
  results.push({ test: 'Cascade: Create test role', pass: roleRes.status === 201, detail: `ID: ${roleId}` });

  // Delete the department
  const delRes = await svc(`departments?id=eq.${deptId}`, 'DELETE');
  results.push({ test: 'Cascade: Delete department', pass: delRes.status === 204, detail: `Status: ${delRes.status}` });

  // Verify department is gone
  const verifyDept = await svc(`departments?id=eq.${deptId}&select=id`);
  const deptGone = await verifyDept.json();
  results.push({ test: 'Cascade: Department deleted', pass: deptGone.length === 0, detail: `Rows: ${deptGone.length}` });

  // Verify role still exists but department_id is NULL (ON DELETE SET NULL)
  const verifyRole = await svc(`roles?id=eq.${roleId}&select=id,name,department_id`);
  const roleAfter = await verifyRole.json();
  results.push({
    test: 'Cascade: Role unlinked (SET NULL)',
    pass: roleAfter.length === 1 && roleAfter[0].department_id === null,
    detail: `Role exists: ${roleAfter.length === 1}, dept_id: ${roleAfter[0]?.department_id}`
  });

  // Cleanup the orphaned role
  await svc(`roles?id=eq.${roleId}`, 'DELETE');
}

// ============================================================
// TEST 3: Foreign Key Integrity
// ============================================================
async function testForeignKeyIntegrity() {
  console.log('\n🔗 Test 3: Foreign Key Integrity');

  // Try to create a project with non-existent account_id
  const badProject = await svc('projects', 'POST', {
    name: 'Orphan Project',
    account_id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
    created_by: '11111111-1111-1111-1111-000000000001'
  });
  results.push({
    test: 'FK: Project with non-existent account',
    pass: badProject.status !== 201,
    detail: `Status: ${badProject.status} (expected rejection)`
  });

  // Try to create a task with non-existent project_id
  const badTask = await svc('tasks', 'POST', {
    name: 'Orphan Task',
    project_id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
    created_by: '11111111-1111-1111-1111-000000000001'
  });
  results.push({
    test: 'FK: Task with non-existent project',
    pass: badTask.status !== 201,
    detail: `Status: ${badTask.status} (expected rejection)`
  });

  // Try to assign a user role with non-existent role_id
  const badRole = await svc('user_roles', 'POST', {
    user_id: '11111111-1111-1111-1111-000000000001',
    role_id: 'ffffffff-ffff-ffff-ffff-ffffffffffff'
  });
  results.push({
    test: 'FK: User role with non-existent role',
    pass: badRole.status !== 201,
    detail: `Status: ${badRole.status} (expected rejection)`
  });
}

// ============================================================
// TEST 4: Date/Timezone Handling
// ============================================================
async function testDateTimezone() {
  console.log('\n🕐 Test 4: Date/Timezone Handling');

  const token = await getToken('superadmin@test.local');

  // Test time entry at midnight boundary
  const midnightEntry = await authed(token, 'time_entries', 'POST', {
    task_id: 'ffffffff-ffff-0001-0001-000000000001',
    user_id: '11111111-1111-1111-1111-000000000001',
    project_id: 'ffffffff-0001-0002-0003-000000000001',
    hours_logged: 1.0,
    entry_date: '2026-03-16', // Monday
    week_start_date: '2026-03-16', // Should be Monday
    description: 'Midnight boundary test'
  });
  const meData = await midnightEntry.json();
  results.push({
    test: 'Date: Monday week_start_date',
    pass: midnightEntry.status === 201 && meData?.[0]?.week_start_date === '2026-03-16',
    detail: `week_start: ${meData?.[0]?.week_start_date}`
  });

  // Test time entry on Sunday (should still have Monday as week start)
  const sundayEntry = await authed(token, 'time_entries', 'POST', {
    task_id: 'ffffffff-ffff-0001-0001-000000000001',
    user_id: '11111111-1111-1111-1111-000000000001',
    project_id: 'ffffffff-0001-0002-0003-000000000001',
    hours_logged: 0.5,
    entry_date: '2026-03-22', // Sunday
    week_start_date: '2026-03-16', // Previous Monday
    description: 'Sunday entry test'
  });
  results.push({
    test: 'Date: Sunday entry with correct week_start',
    pass: sundayEntry.status === 201,
    detail: `Status: ${sundayEntry.status}`
  });

  // Test far-future date
  const futureEntry = await authed(token, 'time_entries', 'POST', {
    task_id: 'ffffffff-ffff-0001-0001-000000000001',
    user_id: '11111111-1111-1111-1111-000000000001',
    project_id: 'ffffffff-0001-0002-0003-000000000001',
    hours_logged: 1.0,
    entry_date: '2030-12-31',
    week_start_date: '2030-12-30',
    description: 'Future date test'
  });
  results.push({
    test: 'Date: Far-future date accepted',
    pass: futureEntry.status === 201,
    detail: `Status: ${futureEntry.status}`
  });

  // Cleanup
  const cleanupEntries = await svc('time_entries?description=like.*test*&user_id=eq.11111111-1111-1111-1111-000000000001', 'DELETE');
}

// ============================================================
// TEST 5: Performance / N+1 Detection
// ============================================================
async function testPerformance() {
  console.log('\n⏱️ Test 5: Performance / Response Times');
  const token = await getToken('superadmin@test.local');

  const endpoints = [
    { name: 'Projects with accounts', path: 'projects?select=id,name,accounts(name)' },
    { name: 'Users with roles', path: 'user_profiles?select=id,name,user_roles(role_id,roles(name))' },
    { name: 'Tasks with projects', path: 'tasks?select=id,name,projects(name)' },
    { name: 'Workflow instances', path: 'workflow_instances?select=id,status,workflow_templates(name)' },
    { name: 'Time entries (last 30 days)', path: 'time_entries?select=id,hours_logged,entry_date&order=entry_date.desc&limit=100' },
    { name: 'Departments with roles', path: 'departments?select=id,name,roles(id,name)' },
  ];

  for (const ep of endpoints) {
    const start = Date.now();
    const res = await authed(token, ep.path);
    const elapsed = Date.now() - start;
    const data = await res.json();

    results.push({
      test: `Perf: ${ep.name}`,
      pass: elapsed < 2000 && res.status === 200,
      detail: `${elapsed}ms, ${data.length} rows, status ${res.status}`
    });
  }

  // Test complex join (potential N+1)
  const start = Date.now();
  const complexRes = await authed(token, 'projects?select=id,name,status,accounts(name),project_assignments(user_id,user_profiles(name)),tasks(id,name,status)');
  const complexElapsed = Date.now() - start;
  const complexData = await complexRes.json();
  results.push({
    test: 'Perf: Complex project join (accounts+assignments+tasks)',
    pass: complexElapsed < 3000,
    detail: `${complexElapsed}ms, ${complexData.length} projects with nested data`
  });
}

// ============================================================
// TEST 6: Session/Token Edge Cases
// ============================================================
async function testSessionEdgeCases() {
  console.log('\n🔑 Test 6: Session Edge Cases');

  // Test with expired/invalid token
  const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
  const fakeRes = await fetch(`${BASE}/rest/v1/projects?select=id`, {
    headers: { 'Authorization': `Bearer ${fakeToken}`, 'apikey': ANON_KEY }
  });
  results.push({
    test: 'Session: Fake JWT token rejected',
    pass: fakeRes.status === 401,
    detail: `Status: ${fakeRes.status}`
  });

  // Test with empty Authorization header
  const emptyAuthRes = await fetch(`${BASE}/rest/v1/projects?select=id`, {
    headers: { 'Authorization': '', 'apikey': ANON_KEY }
  });
  results.push({
    test: 'Session: Empty auth header',
    pass: emptyAuthRes.status === 200, // Anon key still works for SELECT
    detail: `Status: ${emptyAuthRes.status} (anon key allows read)`
  });

  // Test with no apikey at all
  const noKeyRes = await fetch(`${BASE}/rest/v1/projects?select=id`, {
    headers: { 'Authorization': `Bearer ${fakeToken}` }
  });
  results.push({
    test: 'Session: No API key',
    pass: noKeyRes.status === 401 || noKeyRes.status === 403,
    detail: `Status: ${noKeyRes.status}`
  });

  // Test refresh token flow
  const loginRes = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY },
    body: JSON.stringify({ email: 'designer@test.local', password: 'Test1234!' })
  });
  const loginData = await loginRes.json();
  const refreshToken = loginData.refresh_token;

  if (refreshToken) {
    const refreshRes = await fetch(`${BASE}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY },
      body: JSON.stringify({ refresh_token: refreshToken })
    });
    results.push({
      test: 'Session: Refresh token works',
      pass: refreshRes.status === 200,
      detail: `Status: ${refreshRes.status}`
    });
  }
}

// ============================================================
// TEST 7: Double-submit prevention
// ============================================================
async function testDoubleSubmit() {
  console.log('\n🔁 Test 7: Double-submit / Idempotency');
  const token = await getToken('superadmin@test.local');

  // Send 10 identical project update creates simultaneously
  const body = {
    project_id: 'ffffffff-0001-0002-0003-000000000001',
    content: 'Double submit test ' + Date.now(),
    created_by: '11111111-1111-1111-1111-000000000001'
  };

  const promises = Array(10).fill(null).map(() =>
    authed(token, 'project_updates', 'POST', body)
  );
  const responses = await Promise.all(promises);
  const successes = responses.filter(r => r.status === 201);

  // All should succeed (no unique constraint on content)
  // But we should verify they're all separate records
  results.push({
    test: 'Double-submit: 10 identical creates',
    pass: successes.length === 10,
    detail: `${successes.length}/10 created (no unique constraint on content - app should debounce)`
  });

  // Count how many were created
  const countRes = await authed(token, `project_updates?content=eq.${encodeURIComponent(body.content)}&select=id`);
  const countData = await countRes.json();
  results.push({
    test: 'Double-submit: Verify count',
    pass: countData.length === 10,
    detail: `${countData.length} records created`
  });

  // Cleanup
  for (const item of countData) {
    await authed(token, `project_updates?id=eq.${item.id}`, 'DELETE');
  }
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log('🧪 MovaLab Advanced Test Suite\n');
  console.log('================================================');

  await testE2EJourney();
  await testCascadeDeletion();
  await testForeignKeyIntegrity();
  await testDateTimezone();
  await testPerformance();
  await testSessionEdgeCases();
  await testDoubleSubmit();

  console.log('\n================================================');
  console.log('📊 RESULTS SUMMARY');
  console.log('================================================\n');

  let pass = 0, fail = 0;
  for (const r of results) {
    const icon = r.pass ? '✅' : '❌';
    console.log(`${icon} ${r.test}`);
    console.log(`   ${r.detail}`);
    if (r.pass) pass++; else fail++;
  }

  console.log(`\n================================================`);
  console.log(`TOTAL: ${pass} PASS, ${fail} FAIL out of ${results.length} tests`);
  console.log(`================================================`);

  if (fail > 0) process.exit(1);
}

main().catch(console.error);
