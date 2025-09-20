import { test, expect } from '@playwright/test';

test.describe('Enhanced File Sharing Features', () => {
  let baseURL: string;
  let user1Email = 'user1@test.com';
  let user1Password = 'password123!';
  let user2Email = 'user2@test.com';
  let user2Password = 'password123!';

  test.beforeAll(async () => {
    baseURL = 'http://localhost:3000';
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(baseURL);
  });

  async function registerUser(page: any, email: string, password: string, username: string) {
    await page.click('text=Sign Up');
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.fill('input[name="confirmPassword"]', password);
    await page.click('button[type="submit"]');
    
    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard');
  }

  async function loginUser(page: any, email: string, password: string) {
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    
    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard');
  }

  async function uploadTestFile(page: any, filename: string = 'test-document.txt') {
    // Navigate to files section
    await page.click('text=Files');
    
    // Create a temporary file for upload
    const fileContent = 'This is a test document for file sharing functionality.';
    const encoder = new TextEncoder();
    const data = encoder.encode(fileContent);
    
    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: filename,
      mimeType: 'text/plain',
      buffer: data,
    });
    
    // Wait for upload to complete
    await expect(page.locator(`text=${filename}`)).toBeVisible({ timeout: 10000 });
    return filename;
  }

  test('User Registration and Login', async ({ page }) => {
    // Register first user
    await registerUser(page, user1Email, user1Password, 'testuser1');
    
    // Verify we're on the dashboard
    await expect(page.locator('text=Dashboard')).toBeVisible();
    
    // Logout
    await page.click('button:has-text("Logout")');
    
    // Register second user 
    await registerUser(page, user2Email, user2Password, 'testuser2');
    
    // Verify we're on the dashboard
    await expect(page.locator('text=Dashboard')).toBeVisible();
  });

  test('File Sharing with Password Protection', async ({ page, context }) => {
    // Login as user1
    await loginUser(page, user1Email, user1Password);
    
    // Upload a test file
    const filename = await uploadTestFile(page);
    
    // Share the file with password protection
    await page.click(`[data-testid="share-${filename}"]`);
    
    // Enable password protection
    await page.check('input[name="requirePassword"]');
    await page.fill('input[name="password"]', 'share123!');
    
    // Set expiration date (24 hours from now)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    await page.fill('input[name="expiresAt"]', tomorrowStr);
    
    // Set download limit
    await page.fill('input[name="maxDownloads"]', '3');
    
    // Create share
    await page.click('button:has-text("Create Share Link")');
    
    // Get the share link
    const shareLink = await page.locator('[data-testid="share-link"]').inputValue();
    expect(shareLink).toContain('/share/');
    
    // Open new incognito context to test anonymous access
    const incognitoContext = await context.browser()?.newContext();
    const incognitoPage = await incognitoContext?.newPage();
    
    if (incognitoPage) {
      // Navigate to share link
      await incognitoPage.goto(shareLink);
      
      // Should see password prompt
      await expect(incognitoPage.locator('text=Enter Password')).toBeVisible();
      
      // Try wrong password first (rate limiting test)
      await incognitoPage.fill('input[name="password"]', 'wrongpass');
      await incognitoPage.click('button:has-text("Access File")');
      
      // Should see error message
      await expect(incognitoPage.locator('text=Invalid password')).toBeVisible();
      
      // Try correct password
      await incognitoPage.fill('input[name="password"]', 'share123!');
      await incognitoPage.click('button:has-text("Access File")');
      
      // Should be able to download the file
      const downloadPromise = incognitoPage.waitForEvent('download');
      await incognitoPage.click('button:has-text("Download")');
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBe(filename);
      
      await incognitoContext?.close();
    }
  });

  test('Configurable Expiration Dates', async ({ page, context }) => {
    // Login as user1
    await loginUser(page, user1Email, user1Password);
    
    // Upload a test file
    const filename = await uploadTestFile(page, 'expiring-document.txt');
    
    // Share the file with expiration set to past date (simulate expired link)
    await page.click(`[data-testid="share-${filename}"]`);
    
    // Set expiration date to yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    await page.fill('input[name="expiresAt"]', yesterdayStr);
    
    // Create share
    await page.click('button:has-text("Create Share Link")');
    
    // Get the share link
    const shareLink = await page.locator('[data-testid="share-link"]').inputValue();
    
    // Test expired link in incognito
    const incognitoContext = await context.browser()?.newContext();
    const incognitoPage = await incognitoContext?.newPage();
    
    if (incognitoPage) {
      await incognitoPage.goto(shareLink);
      
      // Should see expired message
      await expect(incognitoPage.locator('text=expired')).toBeVisible();
      
      await incognitoContext?.close();
    }
  });

  test('Download Limits Enforcement', async ({ page, context }) => {
    // Login as user1
    await loginUser(page, user1Email, user1Password);
    
    // Upload a test file
    const filename = await uploadTestFile(page, 'limited-downloads.txt');
    
    // Share with download limit of 1
    await page.click(`[data-testid="share-${filename}"]`);
    await page.fill('input[name="maxDownloads"]', '1');
    await page.click('button:has-text("Create Share Link")');
    
    const shareLink = await page.locator('[data-testid="share-link"]').inputValue();
    
    // First download should work
    const incognitoContext = await context.browser()?.newContext();
    const incognitoPage = await incognitoContext?.newPage();
    
    if (incognitoPage) {
      await incognitoPage.goto(shareLink);
      
      const downloadPromise = incognitoPage.waitForEvent('download');
      await incognitoPage.click('button:has-text("Download")');
      await downloadPromise;
      
      // Second attempt should show limit reached
      await incognitoPage.reload();
      await expect(incognitoPage.locator('text=download limit')).toBeVisible();
      
      await incognitoContext?.close();
    }
  });

  test('Rate Limiting for Password Attempts', async ({ page, context }) => {
    // Login as user1
    await loginUser(page, user1Email, user1Password);
    
    // Upload and share file with password
    const filename = await uploadTestFile(page, 'rate-limited.txt');
    await page.click(`[data-testid="share-${filename}"]`);
    await page.check('input[name="requirePassword"]');
    await page.fill('input[name="password"]', 'correct123!');
    await page.click('button:has-text("Create Share Link")');
    
    const shareLink = await page.locator('[data-testid="share-link"]').inputValue();
    
    const incognitoContext = await context.browser()?.newContext();
    const incognitoPage = await incognitoContext?.newPage();
    
    if (incognitoPage) {
      await incognitoPage.goto(shareLink);
      
      // Make multiple failed attempts
      for (let i = 0; i < 5; i++) {
        await incognitoPage.fill('input[name="password"]', `wrong${i}`);
        await incognitoPage.click('button:has-text("Access File")');
        await incognitoPage.waitForTimeout(500);
      }
      
      // Should see rate limiting message
      await expect(incognitoPage.locator('text=too many attempts')).toBeVisible();
      
      await incognitoContext?.close();
    }
  });

  test('Shared with Me Functionality', async ({ page, browser }) => {
    // Login as user1 and share a file
    await loginUser(page, user1Email, user1Password);
    const filename = await uploadTestFile(page, 'shared-with-user2.txt');
    
    await page.click(`[data-testid="share-${filename}"]`);
    await page.click('button:has-text("Create Share Link")');
    const shareLink = await page.locator('[data-testid="share-link"]').inputValue();
    
    // Login as user2 in new context
    const user2Context = await browser.newContext();
    const user2Page = await user2Context.newPage();
    
    await user2Page.goto(baseURL);
    await loginUser(user2Page, user2Email, user2Password);
    
    // Access the shared file to add it to "shared with me"
    await user2Page.goto(shareLink);
    const downloadPromise = user2Page.waitForEvent('download');
    await user2Page.click('button:has-text("Download")');
    await downloadPromise;
    
    // Go back to dashboard and check "Shared with Me" section
    await user2Page.goto(`${baseURL}/dashboard`);
    await user2Page.click('text=Shared');
    await user2Page.click('text=Shared with Me');
    
    // Should see the file in shared with me list
    await expect(user2Page.locator(`text=${filename}`)).toBeVisible();
    await expect(user2Page.locator('text=testuser1')).toBeVisible(); // Shared by user1
    
    await user2Context.close();
  });

  test('Share Revocation', async ({ page, context }) => {
    // Login as user1
    await loginUser(page, user1Email, user1Password);
    
    // Upload and share file
    const filename = await uploadTestFile(page, 'revokable-file.txt');
    await page.click(`[data-testid="share-${filename}"]`);
    await page.click('button:has-text("Create Share Link")');
    const shareLink = await page.locator('[data-testid="share-link"]').inputValue();
    
    // Verify link works first
    const incognitoContext = await context.browser()?.newContext();
    const incognitoPage = await incognitoContext?.newPage();
    
    if (incognitoPage) {
      await incognitoPage.goto(shareLink);
      await expect(incognitoPage.locator('button:has-text("Download")')).toBeVisible();
      await incognitoContext?.close();
    }
    
    // Revoke the share
    await page.click('text=Shared');
    await page.click(`[data-testid="delete-share-${filename}"]`);
    await page.click('button:has-text("Confirm")');
    
    // Verify link no longer works
    const incognitoContext2 = await context.browser()?.newContext();
    const incognitoPage2 = await incognitoContext2?.newPage();
    
    if (incognitoPage2) {
      await incognitoPage2.goto(shareLink);
      await expect(incognitoPage2.locator('text=not found')).toBeVisible();
      await incognitoContext2?.close();
    }
  });

  test('Invalid Share Links Show Appropriate Errors', async ({ page }) => {
    // Test invalid share token
    await page.goto(`${baseURL}/share/invalid-token-123`);
    await expect(page.locator('text=not found')).toBeVisible();
    
    // Test malformed share URL
    await page.goto(`${baseURL}/share/`);
    await expect(page.locator('text=invalid')).toBeVisible();
  });

  test('Multiple Downloads Within Limits', async ({ page, context }) => {
    // Login as user1
    await loginUser(page, user1Email, user1Password);
    
    // Upload and share with limit of 3
    const filename = await uploadTestFile(page, 'multiple-downloads.txt');
    await page.click(`[data-testid="share-${filename}"]`);
    await page.fill('input[name="maxDownloads"]', '3');
    await page.click('button:has-text("Create Share Link")');
    const shareLink = await page.locator('[data-testid="share-link"]').inputValue();
    
    const incognitoContext = await context.browser()?.newContext();
    const incognitoPage = await incognitoContext?.newPage();
    
    if (incognitoPage) {
      await incognitoPage.goto(shareLink);
      
      // Download 3 times successfully
      for (let i = 0; i < 3; i++) {
        const downloadPromise = incognitoPage.waitForEvent('download');
        await incognitoPage.click('button:has-text("Download")');
        await downloadPromise;
        
        if (i < 2) {
          await incognitoPage.reload(); // Reload page for next download
        }
      }
      
      // 4th attempt should fail
      await incognitoPage.reload();
      await expect(incognitoPage.locator('text=download limit')).toBeVisible();
      
      await incognitoContext?.close();
    }
  });

  test('Comprehensive Share Management UI', async ({ page }) => {
    // Login as user1
    await loginUser(page, user1Email, user1Password);
    
    // Upload multiple files and create various shares
    const files = ['doc1.txt', 'doc2.txt', 'doc3.txt'];
    
    for (const filename of files) {
      await uploadTestFile(page, filename);
      await page.click(`[data-testid="share-${filename}"]`);
      
      // Create different types of shares
      if (filename === 'doc1.txt') {
        // Password protected
        await page.check('input[name="requirePassword"]');
        await page.fill('input[name="password"]', 'pass123');
      } else if (filename === 'doc2.txt') {
        // With expiration
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        await page.fill('input[name="expiresAt"]', tomorrow.toISOString().split('T')[0]);
      } else {
        // With download limit
        await page.fill('input[name="maxDownloads"]', '5');
      }
      
      await page.click('button:has-text("Create Share Link")');
      await page.click('button:has-text("Close")');
    }
    
    // Navigate to shared files view
    await page.click('text=Shared');
    
    // Verify all shares are listed with appropriate status indicators
    for (const filename of files) {
      await expect(page.locator(`text=${filename}`)).toBeVisible();
    }
    
    // Verify status indicators
    await expect(page.locator('text=Password Protected')).toBeVisible();
    await expect(page.locator('text=Expires')).toBeVisible();
    await expect(page.locator('text=Limited Downloads')).toBeVisible();
    
    // Test copy link functionality
    await page.click('[data-testid="copy-link-doc1.txt"]');
    // Should show success message or update clipboard
    
    // Test share statistics
    await expect(page.locator('text=Download Count')).toBeVisible();
    await expect(page.locator('text=Created')).toBeVisible();
  });
});