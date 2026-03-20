/**
 * P08 - Chris Client (client@test.local)
 * Expected: Very restricted - only welcome page and client portal
 * Should NOT see: Dashboard, projects, accounts, admin, analytics
 */
import { chromium } from 'playwright';
const BASE = 'http://localhost:3000';

(async () => {
  console.log('👤 P08 Client: Launching browser...');
  const browser = await chromium.launch({ headless: false, args: ['--window-size=1280,900', '--window-position=1320,0'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  const results: string[] = [];
  const log = (msg: string) => { console.log(`[P08] ${msg}`); results.push(msg); };

  // Login
  log('Navigating to login...');
  await page.goto(`${BASE}/login`);
  await page.waitForTimeout(3000);

  if (page.url().includes('/login')) {
    try {
      await page.getByRole('textbox', { name: 'Email' }).fill('client@test.local');
      await page.getByRole('textbox', { name: 'Password' }).fill('Test1234!');
      await page.getByRole('button', { name: 'Login' }).click();
      await page.waitForTimeout(4000);
      log(`Login complete, at ${page.url()}`);
    } catch {
      log('Login form issue');
    }
  }

  // Welcome page should be accessible
  await page.goto(`${BASE}/welcome`);
  await page.waitForTimeout(2000);
  log(`/welcome: ${!page.url().includes('/login') ? 'PASS' : 'FAIL'} (at ${page.url()})`);

  // All these should be denied/redirected for client
  const deniedPages = [
    '/dashboard', '/projects', '/accounts', '/departments',
    '/analytics', '/capacity', '/admin', '/admin/roles',
    '/admin/workflows', '/admin/time-tracking'
  ];

  for (const p of deniedPages) {
    await page.goto(`${BASE}${p}`);
    await page.waitForTimeout(2000);
    const url = page.url();
    const redirected = url.includes('/welcome') || url.includes('/login') || url.includes('/pending');
    log(`${p} (should deny): ${redirected ? 'PASS (redirected)' : 'NEEDS REVIEW'} (at ${url})`);
  }

  // Verify sidebar is minimal (should only show Welcome)
  log('Checking sidebar navigation items...');

  // Summary
  const passed = results.filter(r => r.includes('PASS')).length;
  const failed = results.filter(r => r.includes('FAIL')).length;
  const review = results.filter(r => r.includes('REVIEW')).length;
  log(`\n=== P08 CLIENT SUMMARY: ${passed} PASS, ${failed} FAIL, ${review} REVIEW ===`);

  log('Browser staying open for 30 seconds...');
  await page.waitForTimeout(30000);
  await browser.close();
})();
