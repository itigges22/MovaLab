import { chromium, Browser, Page } from 'playwright';

const BASE_URL = 'http://localhost:3000';

export async function loginAsPersona(email: string, password: string = 'Test1234!'): Promise<{ browser: Browser; page: Page }> {
  const browser = await chromium.launch({
    headless: false,
    args: ['--window-size=1280,900']
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  // Navigate to login
  await page.goto(`${BASE_URL}/login`);
  await page.waitForTimeout(3000);

  // Check if already redirected (session exists)
  if (page.url().includes('/welcome') || page.url().includes('/dashboard')) {
    // Clear storage and retry
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.context().clearCookies();
    await page.goto(`${BASE_URL}/login`);
    await page.waitForTimeout(3000);
  }

  // Fill login form
  try {
    await page.getByRole('textbox', { name: 'Email' }).fill(email);
    await page.getByRole('textbox', { name: 'Password' }).fill(password);
    await page.getByRole('button', { name: 'Login' }).click();
    await page.waitForTimeout(5000);
  } catch (e) {
    console.log(`Login form not found for ${email}, may already be logged in`);
  }

  return { browser, page };
}

export async function testPageAccess(page: Page, path: string, expectAccess: boolean): Promise<{ pass: boolean; url: string; title: string }> {
  await page.goto(`${BASE_URL}${path}`);
  await page.waitForTimeout(3000);

  const url = page.url();
  const title = await page.title();
  const hasAccess = !url.includes('/login') && !url.includes('/welcome');
  const pass = hasAccess === expectAccess;

  return { pass, url, title };
}

export { BASE_URL };
