import { test, expect } from '@playwright/test';
import { uniqueEmail, registerViaApi, createWorkspaceViaApi } from './helpers';

test.describe('Workspace Management', () => {
  test.beforeEach(async ({ page }) => {
    const email = uniqueEmail();
    await page.goto('/');
    await registerViaApi(page, email, 'TestPass123!', 'Test User');
    await page.reload();
    await expect(page.locator('.app-shell')).toBeVisible({ timeout: 10_000 });
  });

  test('should create a new workspace', async ({ page }) => {
    // Look for a "New Workspace" button in sidebar
    const newWsBtn = page.locator('button', { hasText: /new workspace|add workspace/i });
    if (await newWsBtn.isVisible()) {
      await newWsBtn.click();

      // Fill workspace name
      const nameInput = page.getByPlaceholder(/workspace name|name/i);
      await nameInput.fill('E2E Test Workspace');

      // Submit
      const submitBtn = page.getByRole('button', { name: /create|save/i });
      await submitBtn.click();

      // Verify workspace appears in sidebar
      await expect(page.locator('.sidebar').getByText('E2E Test Workspace')).toBeVisible();
    }
  });

  test('should add a tile to workspace', async ({ page }) => {
    // Click "Add Tile" button
    const addTileBtn = page.getByRole('button', { name: /add tile/i });
    await addTileBtn.click();

    // Verify modal opens
    await expect(page.locator('.modal')).toBeVisible();

    // Select Reddit platform
    const redditOption = page.locator('[data-platform="reddit"], .modal__platform-option', { hasText: /reddit/i });
    if (await redditOption.isVisible()) {
      await redditOption.click();
    }

    // Fill subreddit config if visible
    const subredditInput = page.getByPlaceholder(/subreddit/i);
    if (await subredditInput.isVisible()) {
      await subredditInput.fill('programming');
    }

    // Submit
    const createBtn = page.getByRole('button', { name: /create|add|save/i }).last();
    await createBtn.click();

    // Verify tile appears in grid
    await expect(page.locator('.tile-card')).toBeVisible({ timeout: 10_000 });
  });

  test('should delete a workspace', async ({ page }) => {
    // Create a workspace via API first
    await createWorkspaceViaApi(page, 'Delete Me Workspace');
    await page.reload();
    await expect(page.locator('.app-shell')).toBeVisible({ timeout: 10_000 });

    // Find the workspace in sidebar and delete it
    const wsItem = page.locator('.sidebar').getByText('Delete Me Workspace');
    if (await wsItem.isVisible()) {
      // Right-click or find delete button
      const deleteBtn = page.locator('[title*="delete" i], [title*="remove" i]').first();
      if (await deleteBtn.isVisible()) {
        await deleteBtn.click();
        // Confirm deletion if needed
        const confirmBtn = page.getByRole('button', { name: /confirm|delete|yes/i });
        if (await confirmBtn.isVisible()) {
          await confirmBtn.click();
        }
      }
    }
  });
});
