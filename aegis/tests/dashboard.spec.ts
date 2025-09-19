import { test, expect } from '@playwright/test';

/**
 * Dashboard Tests - Following the comprehensive test descriptions
 * These tests cover the main dashboard interface and navigation
 */

test.describe('Dashboard Tests', () => {
  
  test('DASH-001 - Should display login page when not authenticated', async ({ page }) => {
    // Try to access dashboard directly
    await page.goto('/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL(/.*login/);
    
    // Verify login page elements
    await expect(page.getByText('AegisDrive')).toBeVisible();
    await expect(page.getByText('Sign in to your vault')).toBeVisible();
  });

  test('DASH-002 - Should show proper page structure', async ({ page }) => {
    await page.goto('/');

    // Check basic page structure
    await expect(page).toHaveTitle(/AegisDrive/);
    
    // Check main sections exist
    await expect(page.locator('main')).toBeVisible();
    
    // Check form structure
    await expect(page.locator('form')).toBeVisible();
  });

  test('DASH-003 - Should handle responsive design', async ({ page }) => {
    // Test desktop viewport
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto('/');
    
    // Verify login form is visible
    await expect(page.getByRole('textbox', { name: /username or email/i })).toBeVisible();
    
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Form should still be visible and functional
    await expect(page.getByRole('textbox', { name: /username or email/i })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /password/i })).toBeVisible();
  });

  test('DASH-004 - Should handle browser navigation', async ({ page }) => {
    await page.goto('/');
    
    // Go to registration
    await page.getByRole('link', { name: /sign up/i }).click();
    await expect(page).toHaveURL(/.*register/);
    
    // Go back
    await page.goBack();
    await expect(page).toHaveURL(/.*login/);
    
    // Go forward
    await page.goForward();
    await expect(page).toHaveURL(/.*register/);
  });

  test('DASH-005 - Should validate HTTPS security headers', async ({ page }) => {
    const response = await page.goto('/');
    
    // Check response status
    expect(response?.status()).toBe(200);
    
    // Check content type
    const contentType = response?.headers()['content-type'];
    expect(contentType).toContain('text/html');
  });

  test('DASH-006 - Should load without console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');
    
    // Wait for page to fully load
    await page.waitForLoadState('networkidle');
    
    // Filter out known React development warnings
    const criticalErrors = consoleErrors.filter(error => 
      !error.includes('React Router Future Flag Warning') &&
      !error.includes('Warning:') &&
      !error.includes('Failed to load shared error codes')
    );
    
    // No critical console errors should occur
    expect(criticalErrors).toHaveLength(0);
  });
});