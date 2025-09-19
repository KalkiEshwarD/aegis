import { test, expect } from '@playwright/test';

/**
 * Folder Functionality Tests - Comprehensive E2E testing for folder operations
 * Tests cover: creation, deletion, moving, drag-and-drop, and nested folder operations
 */

test.describe('Folder Functionality Tests', () => {

  test.beforeEach(async ({ page }) => {
    // Clean browser state before each test
    await page.context().clearCookies();
    await page.context().clearPermissions();

    // Navigate to the application
    await page.goto('/');

    // Login with test user (assuming test user exists)
    await page.getByRole('textbox', { name: /username or email/i }).fill('test@example.com');
    await page.getByRole('textbox', { name: /password/i }).fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for dashboard to load
    await expect(page).toHaveURL(/.*dashboard/);
    await page.waitForLoadState('networkidle');
  });

  test.describe('Folder Creation', () => {

    test('FLD-001 - Should create folder from toolbar button', async ({ page }) => {
      // Navigate to dashboard
      await page.goto('/dashboard');

      // Click "New Folder" button in toolbar
      await page.getByRole('button', { name: /new folder/i }).click();

      // Dialog should appear
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByText('Create New Folder')).toBeVisible();

      // Fill folder name
      const folderName = `Test Folder ${Date.now()}`;
      await page.getByRole('textbox', { name: /folder name/i }).fill(folderName);

      // Submit form
      await page.getByRole('button', { name: /create/i }).click();

      // Dialog should close and folder should appear
      await expect(page.getByRole('dialog')).not.toBeVisible();
      await expect(page.getByText(folderName)).toBeVisible();
    });

    test('FLD-002 - Should create nested folder from context menu', async ({ page }) => {
      // First create a parent folder
      await page.goto('/dashboard');
      await page.getByRole('button', { name: /new folder/i }).click();
      const parentName = `Parent Folder ${Date.now()}`;
      await page.getByRole('textbox', { name: /folder name/i }).fill(parentName);
      await page.getByRole('button', { name: /create/i }).click();

      // Right-click on the parent folder to open context menu
      await page.getByText(parentName).click({ button: 'right' });

      // Click "New Folder" from context menu
      await page.getByRole('menuitem', { name: /new folder/i }).click();

      // Fill nested folder name
      const childName = `Child Folder ${Date.now()}`;
      await page.getByRole('textbox', { name: /folder name/i }).fill(childName);
      await page.getByRole('button', { name: /create/i }).click();

      // Verify nested folder appears
      await expect(page.getByText(childName)).toBeVisible();

      // Navigate into parent folder and verify child is there
      await page.getByText(parentName).dblclick();
      await expect(page.getByText(childName)).toBeVisible();
    });

    test('FLD-003 - Should validate folder name requirements', async ({ page }) => {
      await page.goto('/dashboard');

      // Click "New Folder" button
      await page.getByRole('button', { name: /new folder/i }).click();

      // Try to create folder with empty name
      await page.getByRole('textbox', { name: /folder name/i }).fill('');
      await expect(page.getByRole('button', { name: /create/i })).toBeDisabled();

      // Try to create folder with whitespace only
      await page.getByRole('textbox', { name: /folder name/i }).fill('   ');
      await expect(page.getByRole('button', { name: /create/i })).toBeDisabled();

      // Valid name should enable button
      await page.getByRole('textbox', { name: /folder name/i }).fill('Valid Folder');
      await expect(page.getByRole('button', { name: /create/i })).toBeEnabled();
    });

    test('FLD-004 - Should prevent duplicate folder names in same location', async ({ page }) => {
      await page.goto('/dashboard');

      const folderName = `Duplicate Test ${Date.now()}`;

      // Create first folder
      await page.getByRole('button', { name: /new folder/i }).click();
      await page.getByRole('textbox', { name: /folder name/i }).fill(folderName);
      await page.getByRole('button', { name: /create/i }).click();

      // Try to create folder with same name
      await page.getByRole('button', { name: /new folder/i }).click();
      await page.getByRole('textbox', { name: /folder name/i }).fill(folderName);
      await page.getByRole('button', { name: /create/i }).click();

      // Should show error message
      await expect(page.getByText(/folder.*already.*exists/i)).toBeVisible();
    });

  });

  test.describe('Folder Navigation', () => {

    test('FLD-005 - Should navigate into and out of folders', async ({ page }) => {
      // Create a test folder
      await page.goto('/dashboard');
      await page.getByRole('button', { name: /new folder/i }).click();
      const folderName = `Navigation Test ${Date.now()}`;
      await page.getByRole('textbox', { name: /folder name/i }).fill(folderName);
      await page.getByRole('button', { name: /create/i }).click();

      // Double-click to navigate into folder
      await page.getByText(folderName).dblclick();

      // Should show empty folder state or be in folder context
      await expect(page.getByText('Home')).toBeVisible(); // Breadcrumb or navigation indicator

      // Navigate back to root
      await page.getByText('Home').click();
      await expect(page.getByText(folderName)).toBeVisible();
    });

    test('FLD-006 - Should display folder tree in sidebar', async ({ page }) => {
      // Create nested folder structure
      await page.goto('/dashboard');

      // Create parent folder
      await page.getByRole('button', { name: /new folder/i }).click();
      const parentName = `Tree Parent ${Date.now()}`;
      await page.getByRole('textbox', { name: /folder name/i }).fill(parentName);
      await page.getByRole('button', { name: /create/i }).click();

      // Create child folder
      await page.getByText(parentName).click({ button: 'right' });
      await page.getByRole('menuitem', { name: /new folder/i }).click();
      const childName = `Tree Child ${Date.now()}`;
      await page.getByRole('textbox', { name: /folder name/i }).fill(childName);
      await page.getByRole('button', { name: /create/i }).click();

      // Verify folder tree shows hierarchy
      await expect(page.getByText(parentName)).toBeVisible();
      await expect(page.getByText(childName)).toBeVisible();
    });

  });

  test.describe('File Drag and Drop to Folders', () => {

    test('FLD-007 - Should drag and drop file into folder', async ({ page }) => {
      // Create a test folder
      await page.goto('/dashboard');
      await page.getByRole('button', { name: /new folder/i }).click();
      const folderName = `Drag Test ${Date.now()}`;
      await page.getByRole('textbox', { name: /folder name/i }).fill(folderName);
      await page.getByRole('button', { name: /create/i }).click();

      // Upload a test file first
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'test-file.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('Test file content')
      });

      // Wait for file to appear
      await expect(page.getByText('test-file.txt')).toBeVisible();

      // Perform drag and drop from file to folder
      const fileElement = page.getByText('test-file.txt');
      const folderElement = page.getByText(folderName);

      // Use Playwright's dragTo method
      await fileElement.dragTo(folderElement);

      // File should disappear from current view
      await expect(page.getByText('test-file.txt')).not.toBeVisible();

      // Navigate into folder and verify file is there
      await page.getByText(folderName).dblclick();
      await expect(page.getByText('test-file.txt')).toBeVisible();
    });

    test('FLD-008 - Should handle multiple file drag and drop', async ({ page }) => {
      // Create test folder
      await page.goto('/dashboard');
      await page.getByRole('button', { name: /new folder/i }).click();
      const folderName = `Multi Drag ${Date.now()}`;
      await page.getByRole('textbox', { name: /folder name/i }).fill(folderName);
      await page.getByRole('button', { name: /create/i }).click();

      // Upload multiple files
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles([
        {
          name: 'file1.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('Content 1')
        },
        {
          name: 'file2.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('Content 2')
        }
      ]);

      // Select multiple files (Ctrl+click)
      await page.getByText('file1.txt').click();
      await page.keyboard.down('Control');
      await page.getByText('file2.txt').click();
      await page.keyboard.up('Control');

      // Drag to folder
      const folderElement = page.getByText(folderName);
      await page.getByText('file1.txt').dragTo(folderElement);

      // Files should disappear from current view
      await expect(page.getByText('file1.txt')).not.toBeVisible();
      await expect(page.getByText('file2.txt')).not.toBeVisible();

      // Navigate into folder and verify both files are there
      await page.getByText(folderName).dblclick();
      await expect(page.getByText('file1.txt')).toBeVisible();
      await expect(page.getByText('file2.txt')).toBeVisible();
    });

  });

  test.describe('Folder Operations', () => {

    test('FLD-009 - Should rename folder', async ({ page }) => {
      // Create test folder
      await page.goto('/dashboard');
      await page.getByRole('button', { name: /new folder/i }).click();
      const oldName = `Rename Test ${Date.now()}`;
      await page.getByRole('textbox', { name: /folder name/i }).fill(oldName);
      await page.getByRole('button', { name: /create/i }).click();

      // Right-click and select rename
      await page.getByText(oldName).click({ button: 'right' });
      await page.getByRole('menuitem', { name: /rename/i }).click();

      // Enter new name
      const newName = `Renamed ${Date.now()}`;
      await page.getByRole('textbox').fill(newName);
      await page.keyboard.press('Enter');

      // Verify rename
      await expect(page.getByText(oldName)).not.toBeVisible();
      await expect(page.getByText(newName)).toBeVisible();
    });

    test('FLD-010 - Should move folder to different location', async ({ page }) => {
      // Create two folders
      await page.goto('/dashboard');

      // Create source folder
      await page.getByRole('button', { name: /new folder/i }).click();
      const sourceName = `Source ${Date.now()}`;
      await page.getByRole('textbox', { name: /folder name/i }).fill(sourceName);
      await page.getByRole('button', { name: /create/i }).click();

      // Create destination folder
      await page.getByRole('button', { name: /new folder/i }).click();
      const destName = `Destination ${Date.now()}`;
      await page.getByRole('textbox', { name: /folder name/i }).fill(destName);
      await page.getByRole('button', { name: /create/i }).click();

      // Move source folder into destination
      await page.getByText(sourceName).click({ button: 'right' });
      await page.getByRole('menuitem', { name: /move/i }).click();

      // Select destination folder in move dialog
      await page.getByText(destName).click();
      await page.getByRole('button', { name: /move here/i }).click();

      // Source folder should disappear from root
      await expect(page.getByText(sourceName)).not.toBeVisible();

      // Navigate into destination and verify source is there
      await page.getByText(destName).dblclick();
      await expect(page.getByText(sourceName)).toBeVisible();
    });

    test('FLD-011 - Should delete folder with confirmation', async ({ page }) => {
      // Create test folder
      await page.goto('/dashboard');
      await page.getByRole('button', { name: /new folder/i }).click();
      const folderName = `Delete Test ${Date.now()}`;
      await page.getByRole('textbox', { name: /folder name/i }).fill(folderName);
      await page.getByRole('button', { name: /create/i }).click();

      // Right-click and select delete
      await page.getByText(folderName).click({ button: 'right' });
      await page.getByRole('menuitem', { name: /delete/i }).click();

      // Confirm deletion
      await expect(page.getByText(/delete.*folder/i)).toBeVisible();
      await page.getByRole('button', { name: /delete/i }).click();

      // Folder should be gone
      await expect(page.getByText(folderName)).not.toBeVisible();
    });

  });

  test.describe('Error Handling', () => {

    test('FLD-012 - Should handle network errors gracefully', async ({ page }) => {
      await page.goto('/dashboard');

      // Mock network failure
      await page.route('**/graphql', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            errors: [{ message: 'Internal server error' }]
          })
        });
      });

      // Try to create folder
      await page.getByRole('button', { name: /new folder/i }).click();
      await page.getByRole('textbox', { name: /folder name/i }).fill('Test Folder');
      await page.getByRole('button', { name: /create/i }).click();

      // Should show error message
      await expect(page.locator('[role="alert"], .error-message, .alert')).toBeVisible();
    });

    test('FLD-013 - Should prevent moving folder into itself', async ({ page }) => {
      // Create test folder
      await page.goto('/dashboard');
      await page.getByRole('button', { name: /new folder/i }).click();
      const folderName = `Self Move ${Date.now()}`;
      await page.getByRole('textbox', { name: /folder name/i }).fill(folderName);
      await page.getByRole('button', { name: /create/i }).click();

      // Try to move folder into itself
      await page.getByText(folderName).click({ button: 'right' });
      await page.getByRole('menuitem', { name: /move/i }).click();

      // The folder itself should be disabled in the selection dialog
      const folderOption = page.getByText(folderName);
      await expect(folderOption).toHaveAttribute('aria-disabled', 'true');
    });

  });

  test.describe('Performance and Accessibility', () => {

    test('FLD-014 - Should load folder tree efficiently', async ({ page }) => {
      await page.goto('/dashboard');

      // Create multiple folders quickly
      for (let i = 0; i < 10; i++) {
        await page.getByRole('button', { name: /new folder/i }).click();
        await page.getByRole('textbox', { name: /folder name/i }).fill(`Perf Test ${i}`);
        await page.getByRole('button', { name: /create/i }).click();
      }

      // All folders should be visible
      for (let i = 0; i < 10; i++) {
        await expect(page.getByText(`Perf Test ${i}`)).toBeVisible();
      }

      // Page should remain responsive
      const loadTime = await page.evaluate(() => performance.now());
      expect(loadTime).toBeLessThan(5000); // Should load within 5 seconds
    });

    test('FLD-015 - Should support keyboard navigation', async ({ page }) => {
      await page.goto('/dashboard');

      // Create a folder
      await page.getByRole('button', { name: /new folder/i }).click();
      await page.getByRole('textbox', { name: /folder name/i }).fill('Keyboard Test');
      await page.getByRole('button', { name: /create/i }).click();

      // Test keyboard navigation in folder tree
      await page.keyboard.press('Tab');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter'); // Should navigate into folder

      // Should be in folder context
      await expect(page.getByText('Home')).toBeVisible();
    });

  });

});