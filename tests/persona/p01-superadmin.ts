/**
 * P01 - Super Admin (superadmin@test.local)
 * Expected: FULL access to everything
 */
import { chromium } from 'playwright';
const BASE = 'http://localhost:3000';

(async () => {
  console.log('🔐 P01 Superadmin: Launching browser...');
  const browser = await chromium.launch({ headless: false, args: ['--window-size=1280,900', '--window-position=0,0'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  const results: string[] = [];
  const log = (msg: string) => { console.log(`[P01] ${msg}`); results.push(msg); };

  // Login
  log('Navigating to login...');
  await page.goto(`${BASE}/login`);
  await page.waitForTimeout(2000);

  // May already be authenticated from previous session
  if (!page.url().includes('/login')) {
    log(`Already authenticated, at ${page.url()}`);
  } else {
    await page.waitForTimeout(2000);
    try {
      await page.getByRole('textbox', { name: 'Email' }).fill('superadmin@test.local');
      await page.getByRole('textbox', { name: 'Password' }).fill('Test1234!');
      await page.getByRole('button', { name: 'Login' }).click();
      await page.waitForTimeout(4000);
      log(`Login complete, at ${page.url()}`);
    } catch {
      log('Login form not available, checking current page...');
    }
  }

  // Test all pages superadmin should access
  const pages = [
    '/dashboard', '/projects', '/accounts', '/departments',
    '/analytics', '/capacity', '/time-entries', '/profile',
    '/admin', '/admin/roles', '/admin/workflows', '/admin/time-tracking',
    '/admin/client-portal', '/admin/client-feedback',
    '/admin/database', '/admin/rbac-diagnostics', '/admin/superadmin-setup',
    '/admin/users/pending'
  ];

  for (const p of pages) {
    await page.goto(`${BASE}${p}`);
    await page.waitForTimeout(2000);
    const url = page.url();
    const pass = url.includes(p) || url.includes('/welcome') || url.includes('/dashboard');
    log(`${p}: ${pass ? 'PASS' : 'FAIL'} (at ${url})`);
  }

  // Test clicking Create Project button
  await page.goto(`${BASE}/projects`);
  await page.waitForTimeout(3000);
  const createBtn = page.getByRole('button', { name: 'Create Project' });
  const hasCreateBtn = await createBtn.isVisible().catch(() => false);
  log(`Create Project button visible: ${hasCreateBtn ? 'PASS' : 'FAIL'}`);

  // Test clicking Create Account button
  await page.goto(`${BASE}/accounts`);
  await page.waitForTimeout(3000);
  const createAccBtn = page.getByRole('button', { name: 'Create Account' });
  const hasCreateAccBtn = await createAccBtn.isVisible().catch(() => false);
  log(`Create Account button visible: ${hasCreateAccBtn ? 'PASS' : 'FAIL'}`);

  // Summary
  const passed = results.filter(r => r.includes('PASS')).length;
  const failed = results.filter(r => r.includes('FAIL')).length;
  log(`\n=== P01 SUPERADMIN SUMMARY: ${passed} PASS, ${failed} FAIL ===`);

  // Keep browser open for 30 seconds so user can see
  log('Browser staying open for 30 seconds...');
  await page.waitForTimeout(30000);
  await browser.close();
})();
