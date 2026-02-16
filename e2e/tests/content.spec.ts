import { test, expect } from '@playwright/test';
import { uniqueEmail, registerViaApi } from './helpers';

test.describe('Content Features', () => {
  test.beforeEach(async ({ page }) => {
    const email = uniqueEmail();
    await page.goto('/');
    await registerViaApi(page, email, 'TestPass123!', 'Test User');
    await page.reload();
    await expect(page.locator('.app-shell')).toBeVisible({ timeout: 10_000 });
  });

  test('should open bookmarks panel', async ({ page }) => {
    // Click bookmarks button in header
    const bookmarkBtn = page.getByTitle('Bookmarks');
    await bookmarkBtn.click();

    // Verify panel opens
    await expect(page.locator('.bookmarks-panel, [class*="bookmarks"]')).toBeVisible();
  });

  test('should open saved searches modal', async ({ page }) => {
    // Click saved searches button
    const searchBtn = page.getByTitle('Saved Searches');
    await searchBtn.click();

    // Verify modal opens
    await expect(page.locator('.modal')).toBeVisible();
  });

  test('should open analytics panel', async ({ page }) => {
    // Click analytics button
    const analyticsBtn = page.getByTitle('Analytics');
    await analyticsBtn.click();

    // Verify panel opens
    await expect(page.locator('.analytics-panel--open, [class*="analytics"]')).toBeVisible();
  });

  test('should open import/export modal', async ({ page }) => {
    // Click import/export button
    const ieBtn = page.getByTitle('Import/Export');
    await ieBtn.click();

    // Verify modal opens
    await expect(page.locator('.modal')).toBeVisible();
  });

  test('should toggle theme', async ({ page }) => {
    // Get current theme
    const initialTheme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme'),
    );

    // Click theme toggle
    const themeBtn = page.getByTitle(/switch to (light|dark) theme/i);
    await themeBtn.click();

    // Verify theme changed
    const newTheme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme'),
    );
    expect(newTheme).not.toEqual(initialTheme);
  });

  test('should manage API keys', async ({ page }) => {
    // Click API Keys button
    const keyBtn = page.getByTitle('API Key Settings');
    await keyBtn.click();

    // Verify settings modal opens
    await expect(page.locator('.modal')).toBeVisible();
  });
});
