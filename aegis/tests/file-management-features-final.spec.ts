import { test, expect } from '@playwright/test';

/**
 * File Management Features Tests - Comprehensive E2E testing for enhanced file management
 * Tests cover: back navigation, copy/cut/paste, keyboard shortcuts, folder deletion with confirmation
 */

test.describe('File Management Features Tests', () => {

  // Global setup for test user
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    
    try {
      // Navigate to registration page
      await page.goto('/register');
      
      // Fill registration form
      await page.getByRole('textbox', { name: /username/i }).fill('testuser');
      await page.getByRole('textbox', { name: /email/i }).fill('test@example.com');
      await page.getByRole('textbox', { name: /password/i }).fill('password123');
      
      // Submit registration
      await page.getByRole('button', { name: /sign up/i }).click();
      
      // Check if successful (might redirect to dashboard or show success message)
      await page.waitForTimeout(2000);
    } catch (error) {
      // User might already exist, which is fine for testing
      console.log('User registration skipped - user may already exist');
    }
    
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    // Clean browser state before each test
    await page.context().clearCookies();
    await page.context().clearPermissions();

    // Navigate to the application
    await page.goto('/');

    // Login with test user
    await page.getByRole('textbox', { name: /username or email/i }).fill('test@example.com');
    await page.getByRole('textbox', { name: /password/i }).fill('password123');
    
    // Wait for button to be enabled and click
    await page.waitForFunction(() => {
      const button = document.querySelector('button[type="submit"]') as HTMLButtonElement;
      return button && !button.disabled;
    });
    
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for dashboard to load
    await expect(page).toHaveURL(/.*dashboard/);
    await page.waitForLoadState('networkidle');
  });

  test.describe('Folder Back Navigation', () => {

    test('FMF-001 - Should navigate back from folder using back button', async ({ page }) => {
      // Navigate to dashboard
      await page.goto('/dashboard');

      // Create a test folder
      await page.getByRole('button', { name: /new folder/i }).click();
      const folderName = `BackNav Test ${Date.now()}`;
      await page.getByRole('textbox', { name: /folder name/i }).fill(folderName);
      await page.getByRole('button', { name: /create/i }).click();

      // Navigate into the folder
      await page.getByText(folderName).dblclick();

      // Check that we're inside the folder (breadcrumb should show folder name)
      await expect(page.getByRole('link', { name: folderName })).toBeVisible();

      // Click the back button
      await page.getByRole('button', { name: /back/i }).click();

      // Should be back at root level
      await expect(page.getByText(folderName)).toBeVisible();
      await expect(page.getByRole('link', { name: folderName })).not.toBeVisible();
    });

    test('FMF-002 - Should navigate using breadcrumb trail', async ({ page }) => {
      await page.goto('/dashboard');

      // Create nested folder structure
      await page.getByRole('button', { name: /new folder/i }).click();
      const parentFolder = `Parent ${Date.now()}`;
      await page.getByRole('textbox', { name: /folder name/i }).fill(parentFolder);
      await page.getByRole('button', { name: /create/i }).click();

      // Navigate into parent folder
      await page.getByText(parentFolder).dblclick();

      // Create child folder
      await page.getByRole('button', { name: /new folder/i }).click();
      const childFolder = `Child ${Date.now()}`;
      await page.getByRole('textbox', { name: /folder name/i }).fill(childFolder);
      await page.getByRole('button', { name: /create/i }).click();

      // Navigate into child folder
      await page.getByText(childFolder).dblclick();

      // Check breadcrumb trail
      await expect(page.getByRole('link', { name: parentFolder })).toBeVisible();
      await expect(page.getByRole('link', { name: childFolder })).toBeVisible();

      // Click on parent folder in breadcrumb
      await page.getByRole('link', { name: parentFolder }).click();

      // Should be in parent folder
      await expect(page.getByText(childFolder)).toBeVisible();
      await expect(page.getByRole('link', { name: parentFolder })).toBeVisible();
      await expect(page.getByRole('link', { name: childFolder })).not.toBeVisible();
    });

    test('FMF-003 - Should navigate to root using Home breadcrumb', async ({ page }) => {
      await page.goto('/dashboard');

      // Create and navigate into a folder
      await page.getByRole('button', { name: /new folder/i }).click();
      const folderName = `Home Test ${Date.now()}`;
      await page.getByRole('textbox', { name: /folder name/i }).fill(folderName);
      await page.getByRole('button', { name: /create/i }).click();
      await page.getByText(folderName).dblclick();

      // Click Home in breadcrumb
      await page.getByRole('link', { name: /home/i }).click();

      // Should be at root level
      await expect(page.getByText(folderName)).toBeVisible();
      await expect(page.getByRole('link', { name: folderName })).not.toBeVisible();
    });

  });

  test.describe('Folder Deletion with Confirmation', () => {

    test('FMF-004 - Should show confirmation dialog when deleting folder', async ({ page }) => {
      await page.goto('/dashboard');

      // Create test folder
      await page.getByRole('button', { name: /new folder/i }).click();
      const folderName = `Delete Confirm ${Date.now()}`;
      await page.getByRole('textbox', { name: /folder name/i }).fill(folderName);
      await page.getByRole('button', { name: /create/i }).click();

      // Right-click and delete
      await page.getByText(folderName).click({ button: 'right' });
      await page.getByRole('menuitem', { name: /delete/i }).click();

      // Confirmation dialog should appear
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByText(/delete.*folder/i)).toBeVisible();
      await expect(page.getByText(/contents.*deleted/i)).toBeVisible();

      // Should have Cancel and Delete buttons
      await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /delete/i })).toBeVisible();
    });

    test('FMF-005 - Should cancel folder deletion', async ({ page }) => {
      await page.goto('/dashboard');

      // Create test folder
      await page.getByRole('button', { name: /new folder/i }).click();
      const folderName = `Cancel Delete ${Date.now()}`;
      await page.getByRole('textbox', { name: /folder name/i }).fill(folderName);
      await page.getByRole('button', { name: /create/i }).click();

      // Right-click and delete
      await page.getByText(folderName).click({ button: 'right' });
      await page.getByRole('menuitem', { name: /delete/i }).click();

      // Click Cancel
      await page.getByRole('button', { name: /cancel/i }).click();

      // Dialog should close and folder should remain
      await expect(page.getByRole('dialog')).not.toBeVisible();
      await expect(page.getByText(folderName)).toBeVisible();
    });

    test('FMF-006 - Should delete folder after confirmation', async ({ page }) => {
      await page.goto('/dashboard');

      // Create test folder
      await page.getByRole('button', { name: /new folder/i }).click();
      const folderName = `Confirm Delete ${Date.now()}`;
      await page.getByRole('textbox', { name: /folder name/i }).fill(folderName);
      await page.getByRole('button', { name: /create/i }).click();

      // Right-click and delete
      await page.getByText(folderName).click({ button: 'right' });
      await page.getByRole('menuitem', { name: /delete/i }).click();

      // Confirm deletion
      await page.getByRole('button', { name: /delete/i }).click();

      // Dialog should close and folder should be gone
      await expect(page.getByRole('dialog')).not.toBeVisible();
      await expect(page.getByText(folderName)).not.toBeVisible();
    });

  });

  test.describe('Cut, Copy, and Paste Functionality', () => {

    test('FMF-007 - Should cut and paste folders using keyboard shortcuts', async ({ page }) => {
      await page.goto('/dashboard');

      // Create source and target folders
      await page.getByRole('button', { name: /new folder/i }).click();
      const sourceFolder = `Cut Source ${Date.now()}`;
      await page.getByRole('textbox', { name: /folder name/i }).fill(sourceFolder);
      await page.getByRole('button', { name: /create/i }).click();

      await page.getByRole('button', { name: /new folder/i }).click();
      const targetFolder = `Cut Target ${Date.now()}`;
      await page.getByRole('textbox', { name: /folder name/i }).fill(targetFolder);
      await page.getByRole('button', { name: /create/i }).click();

      // Select source folder
      await page.getByText(sourceFolder).click();

      // Cut folder using keyboard shortcut
      await page.keyboard.press('Control+KeyX');

      // Navigate into target folder
      await page.getByText(targetFolder).dblclick();

      // Paste folder using keyboard shortcut
      await page.keyboard.press('Control+KeyV');

      // Source folder should be moved into target folder
      await expect(page.getByText(sourceFolder)).toBeVisible();
    });

    test('FMF-008 - Should show warning for copy functionality', async ({ page }) => {
      await page.goto('/dashboard');

      // Create test folder
      await page.getByRole('button', { name: /new folder/i }).click();
      const folderName = `Copy Test ${Date.now()}`;
      await page.getByRole('textbox', { name: /folder name/i }).fill(folderName);
      await page.getByRole('button', { name: /create/i }).click();

      // Select folder
      await page.getByText(folderName).click();

      // Try to copy using Ctrl+C
      await page.keyboard.press('Control+KeyC');

      // Try to paste using Ctrl+V
      await page.keyboard.press('Control+KeyV');

      // Should show warning message about copy functionality
      await expect(page.getByText(/copy functionality requires.*backend.*api/i)).toBeVisible();
    });

    test('FMF-009 - Should show info message when nothing to paste', async ({ page }) => {
      await page.goto('/dashboard');

      // Try to paste without cutting/copying anything
      await page.keyboard.press('Control+KeyV');

      // Should show info message
      await expect(page.getByText(/no files or folders to paste/i)).toBeVisible();
    });

  });

  test.describe('Keyboard Shortcuts', () => {

    test('FMF-010 - Should support all implemented keyboard shortcuts', async ({ page }) => {
      await page.goto('/dashboard');

      // Create test folder
      await page.getByRole('button', { name: /new folder/i }).click();
      const folderName = `Keyboard Test ${Date.now()}`;
      await page.getByRole('textbox', { name: /folder name/i }).fill(folderName);
      await page.getByRole('button', { name: /create/i }).click();

      // Select folder
      await page.getByText(folderName).click();

      // Test Cut shortcut (Ctrl+X)
      await page.keyboard.press('Control+KeyX');

      // Test Copy shortcut (Ctrl+C)
      await page.keyboard.press('Control+KeyC');

      // Test Paste shortcut (Ctrl+V)
      await page.keyboard.press('Control+KeyV');

      // Test Create Folder shortcut (Ctrl+N)
      await page.keyboard.press('Control+KeyN');
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByRole('button', { name: /cancel/i }).click();

      // All shortcuts should work without throwing errors
      await expect(page.getByText(folderName)).toBeVisible();
    });

  });

});