import { test, expect } from '@playwright/test';
import { uniqueEmail, registerViaApi, loginViaApi } from './helpers';

test.describe('Authentication', () => {
  test('should register a new user', async ({ page }) => {
    const email = uniqueEmail();
    const password = 'TestPass123!';

    await page.goto('/');
    // Verify auth screen is shown
    await expect(page.locator('.auth-screen')).toBeVisible();

    // Fill registration form
    await page.getByPlaceholder(/email/i).fill(email);
    await page.getByPlaceholder(/password/i).fill(password);

    // Click register tab/button if separate, or just submit
    const registerBtn = page.getByRole('button', { name: /register|sign up/i });
    if (await registerBtn.isVisible()) {
      await registerBtn.click();
    }

    // Wait for dashboard to load
    await expect(page.locator('.app-shell')).toBeVisible({ timeout: 10_000 });
  });

  test('should login with existing credentials', async ({ page }) => {
    const email = uniqueEmail();
    const password = 'TestPass123!';

    // Register first via API
    await page.goto('/');
    await registerViaApi(page, email, password, 'Test User');
    await page.reload();

    // Now login via UI
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('wiredin_token'));
    await page.reload();

    await expect(page.locator('.auth-screen')).toBeVisible();
    await page.getByPlaceholder(/email/i).fill(email);
    await page.getByPlaceholder(/password/i).fill(password);

    const loginBtn = page.getByRole('button', { name: /login|sign in/i });
    if (await loginBtn.isVisible()) {
      await loginBtn.click();
    }

    await expect(page.locator('.app-shell')).toBeVisible({ timeout: 10_000 });
  });

  test('should logout and return to auth screen', async ({ page }) => {
    const email = uniqueEmail();
    const password = 'TestPass123!';

    await page.goto('/');
    await registerViaApi(page, email, password);
    await page.reload();

    // Wait for dashboard
    await expect(page.locator('.app-shell')).toBeVisible({ timeout: 10_000 });

    // Click logout
    const logoutBtn = page.getByTitle('Logout');
    await logoutBtn.click();

    // Verify auth screen
    await expect(page.locator('.auth-screen')).toBeVisible();
  });
});
