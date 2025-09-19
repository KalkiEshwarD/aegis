import { test, expect } from '@playwright/test';

/**
 * Authentication Tests - Following the comprehensive test descriptions
 * These tests cover the secure access flows described in the test documentation
 */

test.describe('Authentication Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Clean browser state before each test
    await page.context().clearCookies();
    await page.context().clearPermissions();
  });

  test('AUTH-001 - Should display login page and form elements', async ({ page }) => {
    // Navigate to the application
    await page.goto('/');

    // Verify redirect to login
    await expect(page).toHaveURL(/.*login/);
    
    // Check login page elements
    await expect(page.getByText('AegisDrive')).toBeVisible();
    await expect(page.getByText('Sign in to your vault')).toBeVisible();
    
    // Check form elements exist
    await expect(page.getByRole('textbox', { name: /username or email/i })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /password/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
    
    // Check registration link
    await expect(page.getByRole('link', { name: /sign up/i })).toBeVisible();
  });

  test('AUTH-002 - Should validate form fields are required', async ({ page }) => {
    await page.goto('/login');

    // Try to submit empty form
    const signInButton = page.getByRole('button', { name: /sign in/i });
    
    // Button should be disabled initially
    await expect(signInButton).toBeDisabled();
    
    // Fill only email field
    await page.getByRole('textbox', { name: /username or email/i }).fill('test@example.com');
    
    // Button should still be disabled
    await expect(signInButton).toBeDisabled();
    
    // Fill password field
    await page.getByRole('textbox', { name: /password/i }).fill('password123');
    
    // Now button should be enabled
    await expect(signInButton).toBeEnabled();
  });

  test('AUTH-003 - Should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    // Fill invalid credentials
    await page.getByRole('textbox', { name: /username or email/i }).fill('invalid@example.com');
    await page.getByRole('textbox', { name: /password/i }).fill('wrongpassword');
    
    // Submit form
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for error message
    await expect(page.locator('[role="alert"], .error-message, .alert')).toBeVisible();
    
    // Verify we're still on login page
    await expect(page).toHaveURL(/.*login/);
  });

  test('AUTH-004 - Should navigate to registration page', async ({ page }) => {
    await page.goto('/login');

    // Click sign up link
    await page.getByRole('link', { name: /sign up/i }).click();

    // Verify navigation to registration
    await expect(page).toHaveURL(/.*register/);
    
    // Check registration form elements
    await expect(page.getByRole('textbox', { name: /username/i })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /password/i })).toBeVisible();
  });

  test('AUTH-005 - Should handle GraphQL errors gracefully', async ({ page }) => {
    await page.goto('/login');

    // Mock a network error or server error
    await page.route('**/graphql', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          errors: [{ message: 'Internal server error' }]
        })
      });
    });

    // Try to login
    await page.getByRole('textbox', { name: /username or email/i }).fill('test@example.com');
    await page.getByRole('textbox', { name: /password/i }).fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Should show error message
    await expect(page.locator('[role="alert"], .error-message, .alert')).toBeVisible();
  });

  test('AUTH-006 - Should toggle password visibility', async ({ page }) => {
    await page.goto('/login');

    const passwordField = page.getByRole('textbox', { name: /password/i });
    const toggleButton = page.getByRole('button', { name: /toggle password/i });

    // Initially password should be hidden (type="password")
    await expect(passwordField).toHaveAttribute('type', 'password');

    // Click toggle button
    await toggleButton.click();

    // Password should now be visible (type="text")
    await expect(passwordField).toHaveAttribute('type', 'text');

    // Click again to hide
    await toggleButton.click();

    // Should be hidden again
    await expect(passwordField).toHaveAttribute('type', 'password');
  });

  test('AUTH-007 - Should handle keyboard navigation', async ({ page }) => {
    await page.goto('/login');

    // Tab through form elements
    await page.keyboard.press('Tab');
    await expect(page.getByRole('textbox', { name: /username or email/i })).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByRole('textbox', { name: /password/i })).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: /sign in/i })).toBeFocused();
  });

  test('AUTH-008 - Should have proper ARIA labels', async ({ page }) => {
    await page.goto('/login');

    // Check ARIA labels
    const usernameField = page.getByRole('textbox', { name: /username or email/i });
    const passwordField = page.getByRole('textbox', { name: /password/i });

    await expect(usernameField).toHaveAttribute('aria-label');
    await expect(passwordField).toHaveAttribute('aria-label');
  });
});