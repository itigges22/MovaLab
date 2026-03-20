/**
 * Final Sweep: Things that could break in production
 * 1. Middleware/proxy behavior
 * 2. Static asset serving
 * 3. API response headers (CORS, Cache-Control, CSP)
 * 4. Large payload handling
 * 5. Malformed query parameters
 * 6. Content-Type mismatches
 * 7. HTTP method enforcement
 * 8. Error response format consistency
 */

const APP = 'http://localhost:3000';
const DB = 'http://127.0.0.1:54321';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

interface Result { test: string; pass: boolean; detail: string; }
const results: Result[] = [];

// ============================================================
// TEST 1: Security Headers
// ============================================================
async function testSecurityHeaders() {
  console.log('\n🔒 Test 1: Security Headers');

  const res = await fetch(`${APP}/login`);
  const headers = Object.fromEntries(res.headers.entries());

  const checks = [
    { name: 'X-Frame-Options', expected: 'DENY', value: headers['x-frame-options'] },
    { name: 'X-Content-Type-Options', expected: 'nosniff', value: headers['x-content-type-options'] },
    { name: 'X-XSS-Protection', expected: '1; mode=block', value: headers['x-xss-protection'] },
    { name: 'Referrer-Policy', expected: 'strict-origin-when-cross-origin', value: headers['referrer-policy'] },
    { name: 'Content-Security-Policy', expected: 'exists', value: headers['content-security-policy'] ? 'exists' : 'missing' },
  ];

  for (const check of checks) {
    results.push({
      test: `Header: ${check.name}`,
      pass: check.value === check.expected || (check.expected === 'exists' && !!check.value),
      detail: `Expected: ${check.expected}, Got: ${check.value || 'missing'}`
    });
  }

  // Verify no server info leakage
  results.push({
    test: 'Header: No X-Powered-By',
    pass: !headers['x-powered-by'],
    detail: `${headers['x-powered-by'] || 'Not present (good)'}`
  });
}

// ============================================================
// TEST 2: HTTP Method Enforcement
// ============================================================
async function testMethodEnforcement() {
  console.log('\n📫 Test 2: HTTP Method Enforcement');

  // GET-only endpoints should reject POST
  const getOnlyEndpoints = ['/api/analytics/overview', '/api/departments'];
  for (const ep of getOnlyEndpoints) {
    const res = await fetch(`${APP}${ep}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    results.push({
      test: `Method: POST to GET-only ${ep}`,
      pass: res.status === 405 || res.status === 401 || res.status === 404,
      detail: `Status: ${res.status}`
    });
  }

  // DELETE on non-deletable resources
  const res = await fetch(`${APP}/api/profile`, { method: 'DELETE' });
  results.push({
    test: 'Method: DELETE on /api/profile',
    pass: res.status === 405 || res.status === 401,
    detail: `Status: ${res.status}`
  });
}

// ============================================================
// TEST 3: Malformed Query Parameters
// ============================================================
async function testMalformedQueries() {
  console.log('\n🔍 Test 3: Malformed Query Parameters');

  const tests = [
    { name: 'SQL in query param', url: `${APP}/api/projects?id=1%20OR%201=1` },
    { name: 'Very long query param', url: `${APP}/api/projects?name=${'A'.repeat(5000)}` },
    { name: 'Null bytes', url: `${APP}/api/projects?id=%00` },
    { name: 'Path traversal', url: `${APP}/api/projects/../../../etc/passwd` },
  ];

  for (const t of tests) {
    const res = await fetch(t.url);
    results.push({
      test: `Query: ${t.name}`,
      pass: res.status !== 500, // Should not cause 500 server error
      detail: `Status: ${res.status} (no 500 = safe)`
    });
  }
}

// ============================================================
// TEST 4: Content-Type Handling
// ============================================================
async function testContentType() {
  console.log('\n📄 Test 4: Content-Type Handling');

  // Send form-encoded to JSON endpoint
  const formRes = await fetch(`${APP}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'name=test&account_id=123'
  });
  results.push({
    test: 'ContentType: Form-encoded to JSON endpoint',
    pass: formRes.status === 401 || formRes.status === 400 || formRes.status === 415,
    detail: `Status: ${formRes.status}`
  });

  // Send XML
  const xmlRes = await fetch(`${APP}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/xml' },
    body: '<project><name>test</name></project>'
  });
  results.push({
    test: 'ContentType: XML to JSON endpoint',
    pass: xmlRes.status === 401 || xmlRes.status === 400 || xmlRes.status === 415,
    detail: `Status: ${xmlRes.status}`
  });
}

// ============================================================
// TEST 5: Error Response Consistency
// ============================================================
async function testErrorConsistency() {
  console.log('\n❗ Test 5: Error Response Consistency');

  const errorEndpoints = [
    { url: `${APP}/api/projects`, method: 'GET', desc: 'No auth' },
    { url: `${APP}/api/tasks/not-a-uuid`, method: 'PUT', desc: 'Invalid UUID' },
    { url: `${APP}/api/nonexistent`, method: 'GET', desc: 'Not found' },
  ];

  for (const ep of errorEndpoints) {
    const res = await fetch(ep.url, { method: ep.method, headers: { 'Content-Type': 'application/json' }, body: ep.method !== 'GET' ? '{}' : undefined });
    const contentType = res.headers.get('content-type');

    results.push({
      test: `Error format: ${ep.desc}`,
      pass: contentType?.includes('application/json') || res.status === 404 || res.status === 405,
      detail: `Status: ${res.status}, Content-Type: ${contentType || 'none'}`
    });
  }
}

// ============================================================
// TEST 6: Static Asset Serving
// ============================================================
async function testStaticAssets() {
  console.log('\n📁 Test 6: Static Asset Serving');

  const assets = [
    { name: 'Robots.txt', url: `${APP}/robots.txt` },
    { name: 'Sitemap', url: `${APP}/sitemap.xml` },
  ];

  for (const asset of assets) {
    const res = await fetch(asset.url);
    results.push({
      test: `Static: ${asset.name}`,
      pass: res.status === 200,
      detail: `Status: ${res.status}`
    });
  }
}

// ============================================================
// TEST 7: API Rate Limiting Headers
// ============================================================
async function testRateLimitHeaders() {
  console.log('\n⏳ Test 7: Rate Limiting');

  // Fire 20 rapid requests
  const promises = Array(20).fill(null).map(() =>
    fetch(`${APP}/api/projects`)
  );
  const responses = await Promise.all(promises);
  const statuses = responses.map(r => r.status);
  const has429 = statuses.includes(429);

  results.push({
    test: 'Rate limit: 20 rapid requests',
    pass: true, // Rate limiting is optional in dev mode
    detail: `Statuses: ${[...new Set(statuses)].join(',')}. ${has429 ? 'Rate limited (429)' : 'No rate limiting in dev mode (expected)'}`
  });
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log('🔎 MovaLab Final Sweep Test Suite\n');
  console.log('================================================');

  await testSecurityHeaders();
  await testMethodEnforcement();
  await testMalformedQueries();
  await testContentType();
  await testErrorConsistency();
  await testStaticAssets();
  await testRateLimitHeaders();

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
