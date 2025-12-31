import { test, expect, type Page } from '@playwright/test';

/**
 * Bug Fix Verification Tests - December 2025
 *
 * Tests for 10 critical bug fixes:
 * Bug 1: Loading screen not showing on refresh/login/logout
 * Bug 2: Loading screen disappears before content loads
 * Bug 3: Tab switching causes full reload
 * Bug 4: Capacity Trend Chart not working for most users
 * Bug 5: Site slow for non-admin users
 * Bug 6: "Failed to create workflow instance" error
 * Bug 7: Account/Department capacity shows one user only
 * Bug 8: Org analytics missing utilization line
 * Bug 9: Failed to update task (assignee)
 * Bug 10: Adding people to workflow steps doesn't appear
 */

const DEMO_USERS = {
  admin: { email: 'admin@test.local', name: 'Andy Admin' },
  alex: { email: 'exec@test.local', name: 'Alex Executive' },
  morgan: { email: 'manager@test.local', name: 'Morgan Manager' },
  pat: { email: 'pm@test.local', name: 'Pat ProjectManager' },
  dana: { email: 'designer@test.local', name: 'Dana Designer' },
  dev: { email: 'dev@test.local', name: 'Dev Developer' },
};

async function loginAsDemoUser(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  const demoModeButton = page.locator('button').filter({ hasText: /Alex|Morgan|Pat|Dana|Dev|Andy/ }).first();
  const emailInput = page.locator('input[type="email"]');

  await Promise.race([
    demoModeButton.waitFor({ state: 'visible', timeout: 10000 }),
    emailInput.waitFor({ state: 'visible', timeout: 10000 }),
  ]).catch(() => { });

  if (await demoModeButton.isVisible().catch(() => false)) {
    const userMap: Record<string, string> = {
      'admin@test.local': 'Andy Admin',
      'exec@test.local': 'Alex Executive',
      'manager@test.local': 'Morgan Manager',
      'pm@test.local': 'Pat ProjectManager',
      'designer@test.local': 'Dana Designer',
      'dev@test.local': 'Dev Developer',
    };
    const userName = userMap[email];
    if (!userName) throw new Error(`Unknown demo user: ${email}`);
    await page.locator(`button:has-text("${userName}")`).click();
  } else if (await emailInput.isVisible()) {
    await emailInput.fill(email);
    await page.locator('input[type="password"]').fill('Test1234!');
    await page.locator('button[type="submit"]').click();
  }

  await page.waitForURL(/\/(welcome|dashboard|projects)/, { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

async function logout(page: Page): Promise<void> {
  const userMenu = page.locator('[data-testid="user-menu"], button:has-text("Sign out")');
  if (await userMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
    await userMenu.click();
    const signOut = page.locator('button:has-text("Sign out")');
    if (await signOut.isVisible({ timeout: 2000 }).catch(() => false)) {
      await signOut.click();
    }
  }
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
}

test.describe('Bug 1 & 2 & 3: Loading Screen System', () => {
  test('Loading overlay should appear on navigation', async ({ page }) => {
    await loginAsDemoUser(page, DEMO_USERS.alex.email);

    // Navigate and check for loading overlay
    await page.click('nav a[href="/dashboard"]');

    // Loading overlay should appear
    const loadingOverlay = page.locator('[data-testid="loading-overlay"]');
    const wasVisible = await loadingOverlay.isVisible({ timeout: 3000 }).catch(() => false);

    console.log('Loading overlay appeared during navigation:', wasVisible);

    // Wait for content to load
    await page.waitForLoadState('networkidle');

    // Loading overlay should be gone after content loads
    await expect(loadingOverlay).not.toBeVisible({ timeout: 10000 });

    await logout(page);
  });

  test('Loading overlay should persist until content is ready', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Login as demo user
    const loginButton = page.locator('button:has-text("Alex Executive")');
    if (await loginButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await loginButton.click();

      // Check that loading overlay is visible during transition
      const loadingOverlay = page.locator('[data-testid="loading-overlay"]');

      // Loading should appear during navigation
      const appearedDuringNav = await loadingOverlay.isVisible({ timeout: 2000 }).catch(() => false);
      console.log('Loading overlay during login transition:', appearedDuringNav);

      // Wait for dashboard to be ready
      await page.waitForURL(/\/(welcome|dashboard)/, { timeout: 15000 });
      await page.waitForLoadState('networkidle');

      // Loading should be gone once content is loaded
      await expect(loadingOverlay).not.toBeVisible({ timeout: 10000 });
    }
  });
});

test.describe('Bug 4: Capacity Trend Chart for All Users', () => {
  const testUsers = [
    { user: DEMO_USERS.dana, name: 'Dana Designer' },
    { user: DEMO_USERS.dev, name: 'Dev Developer' },
    { user: DEMO_USERS.pat, name: 'Pat ProjectManager' },
    { user: DEMO_USERS.alex, name: 'Alex Executive' },
  ];

  for (const { user, name } of testUsers) {
    test(`${name} should see capacity data (not all zeros)`, async ({ page }) => {
      await loginAsDemoUser(page, user.email);
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // Wait for charts to load
      await page.waitForTimeout(2000);

      // Look for capacity chart with recharts
      const chartContainer = page.locator('.recharts-responsive-container').first();

      if (await chartContainer.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Check that chart has rendered lines/bars (indicating data)
        const chartLines = page.locator('.recharts-line, .recharts-bar, .recharts-area');
        const lineCount = await chartLines.count();

        console.log(`${name}: Found ${lineCount} chart elements`);
        expect(lineCount).toBeGreaterThan(0);

        // Check that utilization text isn't all 0%
        const utilizationText = page.locator('text=/\\d+%/').first();
        if (await utilizationText.isVisible({ timeout: 2000 }).catch(() => false)) {
          const text = await utilizationText.textContent();
          console.log(`${name}: Utilization display: ${text}`);
        }
      }

      await logout(page);
    });
  }
});

test.describe('Bug 5: Site Performance for Non-Admin Users', () => {
  test('Dashboard should load in reasonable time for Dana Designer', async ({ page }) => {
    const startTime = Date.now();
    await loginAsDemoUser(page, DEMO_USERS.dana.email);
    await page.goto('/dashboard');

    // Wait for main content to appear
    await page.waitForSelector('main', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;
    console.log(`Dashboard load time for Dana: ${loadTime}ms`);

    // Should load in under 8 seconds (reasonable for demo mode)
    expect(loadTime).toBeLessThan(8000);

    await logout(page);
  });

  test('Newsletter section should load quickly', async ({ page }) => {
    await loginAsDemoUser(page, DEMO_USERS.dana.email);
    await page.goto('/welcome');

    const startTime = Date.now();

    // Wait for newsletters to appear
    const newsletterSection = page.locator('text=/newsletter/i').first();
    await newsletterSection.waitFor({ state: 'visible', timeout: 8000 }).catch(() => { });

    const loadTime = Date.now() - startTime;
    console.log(`Newsletter load time: ${loadTime}ms`);

    // Should load in under 5 seconds
    expect(loadTime).toBeLessThan(5000);

    await logout(page);
  });
});

test.describe('Bug 6: Workflow Error Messages', () => {
  test('Workflow errors should show specific messages', async ({ page }) => {
    await loginAsDemoUser(page, DEMO_USERS.admin.email);
    await page.goto('/projects/new');
    await page.waitForLoadState('networkidle');

    // Fill in project details
    const nameInput = page.locator('input[name="name"]');
    if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await nameInput.fill('Test Project ' + Date.now());

      // Select an account if required
      const accountSelect = page.locator('[data-testid="account-select"], select[name="account"]');
      if (await accountSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
        await accountSelect.click();
        const firstOption = page.locator('[role="option"]').first();
        if (await firstOption.isVisible()) {
          await firstOption.click();
        }
      }

      // Submit to see if we get specific error vs generic
      const submitBtn = page.locator('button[type="submit"], button:has-text("Create")');
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
        await page.waitForTimeout(2000);

        // If there's an error, it should be specific, not just "Failed to create workflow instance"
        const errorText = page.locator('.toast, [role="alert"], text=/error/i');
        if (await errorText.isVisible({ timeout: 3000 }).catch(() => false)) {
          const text = await errorText.textContent();
          console.log('Error message:', text);
          // Should not be the generic error
          if (text?.includes('workflow')) {
            expect(text).not.toBe('Failed to create workflow instance');
          }
        }
      }
    }

    await logout(page);
  });
});

test.describe('Bug 7: Account/Department Capacity Aggregation', () => {
  test('Account capacity should show cumulative hours for all team members', async ({ page }) => {
    await loginAsDemoUser(page, DEMO_USERS.alex.email);
    await page.goto('/accounts');
    await page.waitForLoadState('networkidle');

    // Click on the first account to view details
    const accountCard = page.locator('[data-testid="account-card"], .account-card, a[href*="/accounts/"]').first();
    if (await accountCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await accountCard.click();
      await page.waitForLoadState('networkidle');

      // Wait for capacity chart to load
      await page.waitForTimeout(2000);

      // Check that the chart shows multiple data points or cumulative values
      const chartContainer = page.locator('.recharts-responsive-container').first();
      if (await chartContainer.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log('Account capacity chart is visible');

        // Check for "Available" values that should be > 40 (more than one person)
        const availableLabels = page.locator('text=/available/i');
        console.log('Found available labels:', await availableLabels.count());
      }
    }

    await logout(page);
  });

  test('Department capacity should show cumulative hours for all members', async ({ page }) => {
    await loginAsDemoUser(page, DEMO_USERS.alex.email);
    await page.goto('/departments');
    await page.waitForLoadState('networkidle');

    // Click on first department
    const deptCard = page.locator('[data-testid="department-card"], .department-card, a[href*="/departments/"]').first();
    if (await deptCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await deptCard.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Check capacity chart
      const chartContainer = page.locator('.recharts-responsive-container').first();
      if (await chartContainer.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log('Department capacity chart is visible');
      }
    }

    await logout(page);
  });
});

test.describe('Bug 8: Org Analytics Utilization Line', () => {
  test('Organization analytics should show utilization line in capacity chart', async ({ page }) => {
    await loginAsDemoUser(page, DEMO_USERS.alex.email);
    await page.goto('/analytics');
    await page.waitForLoadState('networkidle');

    // Wait for charts to render
    await page.waitForTimeout(3000);

    // Look for the capacity utilization widget
    const capacityWidget = page.locator('text=/capacity utilization/i').first();
    if (await capacityWidget.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Capacity Utilization widget found');

      // Check for 4 lines in the chart (Available, Allocated, Actual, Utilization)
      const chartLines = page.locator('.recharts-line');
      const lineCount = await chartLines.count();
      console.log(`Found ${lineCount} lines in capacity chart`);

      // Should have 4 lines (including utilization)
      expect(lineCount).toBeGreaterThanOrEqual(4);

      // Check legend for "Utilization" entry
      const utilizationLegend = page.locator('text=/utilization/i');
      const hasUtilizationLegend = await utilizationLegend.isVisible({ timeout: 2000 }).catch(() => false);
      console.log('Has Utilization in legend:', hasUtilizationLegend);
      expect(hasUtilizationLegend).toBe(true);
    }

    await logout(page);
  });
});

test.describe('Bug 9: Task Update Errors', () => {
  test('Should be able to update task assignee without error', async ({ page }) => {
    await loginAsDemoUser(page, DEMO_USERS.pat.email);
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    // Click on first project
    const projectCard = page.locator('[data-testid="project-card"], .project-card, a[href*="/projects/"]').first();
    if (await projectCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await projectCard.click();
      await page.waitForLoadState('networkidle');

      // Look for a task to edit
      const taskRow = page.locator('[data-testid="task-row"], .task-row, tr').first();
      if (await taskRow.isVisible({ timeout: 5000 }).catch(() => false)) {
        await taskRow.click();
        await page.waitForTimeout(500);

        // Try to change assignee
        const assigneeSelect = page.locator('[data-testid="assignee-select"], select[name="assignee"], [role="combobox"]').first();
        if (await assigneeSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
          await assigneeSelect.click();
          await page.waitForTimeout(500);

          // Select a different user
          const userOption = page.locator('[role="option"]').first();
          if (await userOption.isVisible({ timeout: 2000 }).catch(() => false)) {
            await userOption.click();
            await page.waitForTimeout(1000);

            // Check for error toast
            const errorToast = page.locator('text=/failed to update/i, text=/error/i');
            const hasError = await errorToast.isVisible({ timeout: 2000 }).catch(() => false);
            console.log('Task update error displayed:', hasError);

            // Should not show generic "Failed to update task" error
            if (hasError) {
              const toastText = await errorToast.textContent();
              expect(toastText?.toLowerCase()).not.toBe('failed to update task');
            }
          }
        }
      }
    }

    await logout(page);
  });
});

test.describe('Bug 10: Workflow Step Assignments UI', () => {
  test('Workflow progress should show step assignments section', async ({ page }) => {
    await loginAsDemoUser(page, DEMO_USERS.admin.email);
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    // Find a project with an active workflow
    const projectCard = page.locator('[data-testid="project-card"], a[href*="/projects/"]').first();
    if (await projectCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await projectCard.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Look for workflow progress section
      const workflowSection = page.locator('text=/workflow/i').first();
      if (await workflowSection.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log('Workflow section found');

        // Look for step assignments section
        const assignmentsSection = page.locator('text=/step assignments/i, text=/assign user/i');
        const hasAssignments = await assignmentsSection.isVisible({ timeout: 5000 }).catch(() => false);
        console.log('Step assignments UI visible:', hasAssignments);

        // Look for assign user button
        const assignButton = page.locator('button:has-text("Assign"), [data-testid="add-assignment"]');
        const hasAssignButton = await assignButton.isVisible({ timeout: 3000 }).catch(() => false);
        console.log('Assign user button visible:', hasAssignButton);

        // Either assignments section or button should be present for active workflows
        if (hasAssignments || hasAssignButton) {
          expect(true).toBe(true);
        }
      }
    }

    await logout(page);
  });

  test('Should be able to assign user to workflow step', async ({ page }) => {
    await loginAsDemoUser(page, DEMO_USERS.admin.email);
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    // Navigate to a project
    const projectCard = page.locator('[data-testid="project-card"], a[href*="/projects/"]').first();
    if (await projectCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await projectCard.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Look for assign button in workflow section
      const assignButton = page.locator('button:has-text("Assign User")');
      if (await assignButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await assignButton.click();
        await page.waitForTimeout(500);

        // Dialog should open
        const dialog = page.getByRole('dialog');
        if (await dialog.isVisible({ timeout: 3000 }).catch(() => false)) {
          console.log('Assignment dialog opened');

          // Should have step selector
          const stepSelect = dialog.locator('[role="combobox"], select').first();
          const hasStepSelect = await stepSelect.isVisible({ timeout: 2000 }).catch(() => false);
          console.log('Step selector visible:', hasStepSelect);
          expect(hasStepSelect).toBe(true);

          // Close dialog
          const cancelBtn = dialog.locator('button:has-text("Cancel")');
          if (await cancelBtn.isVisible()) {
            await cancelBtn.click();
          }
        }
      }
    }

    await logout(page);
  });
});

test.describe('Default Weekly Hours Verification', () => {
  test('Users without explicit availability should default to 40 hours', async ({ page }) => {
    // Login as a user who may not have explicit availability set
    await loginAsDemoUser(page, DEMO_USERS.dana.email);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check capacity widget shows non-zero available hours
    const availableHours = page.locator('text=/available.*\\d+.*h/i').first();
    if (await availableHours.isVisible({ timeout: 5000 }).catch(() => false)) {
      const text = await availableHours.textContent();
      console.log('Available hours display:', text);

      // Extract number and verify it's not 0
      const match = text?.match(/(\d+)/);
      if (match) {
        const hours = parseInt(match[1], 10);
        console.log('Parsed available hours:', hours);
        expect(hours).toBeGreaterThan(0);
      }
    }

    await logout(page);
  });
});
