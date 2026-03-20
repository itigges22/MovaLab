/**
 * P06 - Dana Designer (designer@test.local)
 * Expected: View assigned projects, manage time, execute workflows
 * Should NOT see: Admin pages, analytics, all accounts
 */
import { chromium } from 'playwright';
const BASE = 'http://localhost:3000';

(async () => {
  console.log('🎨 P06 Designer: Launching browser...');
  const browser = await chromium.launch({ headless: false, args: ['--window-size=1280,900', '--window-position=660,0'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  const results: string[] = [];
  const log = (msg: string) => { console.log(`[P06] ${msg}`); results.push(msg); };

  // Login
  log('Navigating to login...');
  await page.goto(`${BASE}/login`);
  await page.waitForTimeout(3000);

  if (page.url().includes('/login')) {
    try {
      await page.getByRole('textbox', { name: 'Email' }).fill('designer@test.local');
      await page.getByRole('textbox', { name: 'Password' }).fill('Test1234!');
      await page.getByRole('button', { name: 'Login' }).click();
      await page.waitForTimeout(4000);
      log(`Login complete, at ${page.url()}`);
    } catch {
      log('Login form issue');
    }
  }

  // Pages designer SHOULD access
  const allowedPages = ['/dashboard', '/projects', '/time-entries', '/profile', '/welcome'];
  for (const p of allowedPages) {
    await page.goto(`${BASE}${p}`);
    await page.waitForTimeout(2000);
    const url = page.url();
    log(`${p} (should access): ${!url.includes('/login') ? 'PASS' : 'FAIL'} (at ${url})`);
  }

  // Pages designer should NOT access (admin pages)
  const deniedPages = ['/admin', '/admin/roles', '/admin/workflows', '/analytics'];
  for (const p of deniedPages) {
    await page.goto(`${BASE}${p}`);
    await page.waitForTimeout(2000);
    const url = page.url();
    // Should be redirected away from admin pages
    const redirected = url.includes('/welcome') || url.includes('/login') || url.includes('/dashboard');
    log(`${p} (should deny): ${redirected ? 'PASS (redirected)' : 'FAIL (accessed!)'} (at ${url})`);
  }

  // Check projects page - should see subset, not all
  await page.goto(`${BASE}/projects`);
  await page.waitForTimeout(3000);
  log('Checking project visibility as designer...');

  // Summary
  const passed = results.filter(r => r.includes('PASS')).length;
  const failed = results.filter(r => r.includes('FAIL')).length;
  log(`\n=== P06 DESIGNER SUMMARY: ${passed} PASS, ${failed} FAIL ===`);

  log('Browser staying open for 30 seconds...');
  await page.waitForTimeout(30000);
  await browser.close();
})();
