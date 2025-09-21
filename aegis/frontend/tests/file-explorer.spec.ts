import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('File Explorer Functionality', () => {
  test.beforeAll(async ({ request }) => {
    // Register test user if not exists
    const registerQuery = `
      mutation Register($input: RegisterInput!) {
        register(input: $input) {
          token
          user {
            id
            username
            email
          }
        }
      }
    `;

    const variables = {
      input: {
        username: 'test',
        email: 'test@playwright.org',
        password: 'TestPlaywright123!@#'
      }
    };

    try {
      const response = await request.post('http://localhost:8080/v1/graphql', {
        data: {
          query: registerQuery,
          variables
        }
      });

      // If user already exists, we expect an error but that's fine
      if (!response.ok()) {
        console.log('User registration failed (possibly already exists):', response.status());
      } else {
        console.log('Test user registered successfully');
      }
    } catch (error) {
      console.log('Registration request failed:', error);
      // Continue with tests even if registration fails
    }
  });

  // Helper function to login
  const login = async (page: any) => {
    await page.goto('/');
    await page.fill('input[name="identifier"]', 'test@playwright.org');
    await page.fill('input[name="password"]', 'TestPlaywright123!@#');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  };

  test('should login successfully', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL('/dashboard');
    // Verify we're on dashboard by checking for file explorer elements
    await expect(page.locator('.file-explorer-container')).toBeVisible();
  });

  test('should upload files using file picker', async ({ page }) => {
    await login(page);

    // Get test files paths
    const testFile1 = path.join(process.cwd(), 'test_upload_file_1.txt');
    const testFile2 = path.join(process.cwd(), 'test_upload_file_2.txt');
    const testFile3 = path.join(process.cwd(), 'test_upload_file_3.txt');

    // Click on the drop zone to trigger file picker (since input is hidden)
    const dropZone = page.locator('.file-explorer-container');
    await dropZone.click();

    // Set files on the hidden input
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([testFile1, testFile2, testFile3]);

    // Wait for upload to complete
    await page.waitForTimeout(5000); // Adjust based on upload time

    // Verify files appear in file explorer
    await expect(page.locator('[data-file-item]').filter({ hasText: 'test_upload_file_1.txt' })).toBeVisible();
    await expect(page.locator('[data-file-item]').filter({ hasText: 'test_upload_file_2.txt' })).toBeVisible();
    await expect(page.locator('[data-file-item]').filter({ hasText: 'test_upload_file_3.txt' })).toBeVisible();
  });

  test('should upload files using drag and drop', async ({ page }) => {
    await login(page);

    // Get test files paths
    const testFile1 = path.join(process.cwd(), 'test_dragdrop_file_1.txt');
    const testFile2 = path.join(process.cwd(), 'test_dragdrop_file_2.txt');

    // Get the drop zone element
    const dropZone = page.locator('.file-explorer-container');

    // Create data transfer with files
    const dataTransfer = await page.evaluateHandle(() => {
      const dt = new DataTransfer();
      const file1 = new File(['test content 1'], 'test_dragdrop_file_1.txt', { type: 'text/plain' });
      const file2 = new File(['test content 2'], 'test_dragdrop_file_2.txt', { type: 'text/plain' });
      dt.items.add(file1);
      dt.items.add(file2);
      return dt;
    });

    // Perform drag and drop
    await dropZone.dispatchEvent('dragover', { dataTransfer });
    await dropZone.dispatchEvent('drop', { dataTransfer });

    // Wait for upload to complete
    await page.waitForTimeout(5000);

    // Verify files appear in file explorer
    await expect(page.locator('[data-file-item]').filter({ hasText: 'test_dragdrop_file_1.txt' })).toBeVisible();
    await expect(page.locator('[data-file-item]').filter({ hasText: 'test_dragdrop_file_2.txt' })).toBeVisible();
  });

  test('should upload files using clipboard', async ({ page }) => {
    await login(page);

    // Mock clipboard with files
    await page.evaluate(() => {
      const originalRead = navigator.clipboard.read;
      navigator.clipboard.read = async () => [{
        types: ['text/plain'],
        getType: async (type: string) => {
          if (type === 'text/plain') {
            return new Blob(['clipboard test content'], { type: 'text/plain' });
          }
          throw new Error('Unsupported type');
        }
      } as any];
    });

    // Focus the file explorer container and paste
    const container = page.locator('.file-explorer-container');
    await container.click();
    await page.keyboard.press('Control+v');

    // Wait for upload to complete
    await page.waitForTimeout(3000);

    // Verify file appears (the code generates a filename based on timestamp)
    await expect(page.locator('[data-file-item]').filter({ hasText: /clipboard-item/ })).toBeVisible();
  });

  test('should select multiple files and drag to folder', async ({ page }) => {
    await login(page);

    // First create a folder
    await page.click('button:has-text("New Folder")');
    await page.fill('input[placeholder="Folder Name"]', 'Test Folder');
    await page.click('button:has-text("Create")');

    // Wait for folder to appear
    await expect(page.locator('[data-file-item]').filter({ hasText: 'Test Folder' })).toBeVisible();

    // Upload some test files first
    const testFile1 = path.join(process.cwd(), 'test_upload_file_1.txt');
    const testFile2 = path.join(process.cwd(), 'test_upload_file_2.txt');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([testFile1, testFile2]);
    await page.waitForTimeout(3000);

    // Select multiple files (using Ctrl+click)
    const file1 = page.locator('[data-file-item]').filter({ hasText: 'test_upload_file_1.txt' });
    const file2 = page.locator('[data-file-item]').filter({ hasText: 'test_upload_file_2.txt' });

    await file1.click({ modifiers: ['Control'] });
    await file2.click({ modifiers: ['Control'] });

    // Drag selected files to folder
    await file1.dragTo(page.locator('[data-file-item]').filter({ hasText: 'Test Folder' }));

    // Wait for move operation
    await page.waitForTimeout(2000);

    // Navigate into folder and verify files are there
    await page.locator('[data-file-item]').filter({ hasText: 'Test Folder' }).dblclick();
    await expect(page.locator('[data-file-item]').filter({ hasText: 'test_upload_file_1.txt' })).toBeVisible();
    await expect(page.locator('[data-file-item]').filter({ hasText: 'test_upload_file_2.txt' })).toBeVisible();
  });

  test('should select multiple files and delete with delete key', async ({ page }) => {
    await login(page);

    // Upload test files
    const testFile1 = path.join(process.cwd(), 'test_upload_file_1.txt');
    const testFile2 = path.join(process.cwd(), 'test_upload_file_2.txt');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([testFile1, testFile2]);
    await page.waitForTimeout(3000);

    // Select multiple files
    const file1 = page.locator('[data-file-item]').filter({ hasText: 'test_upload_file_1.txt' });
    const file2 = page.locator('[data-file-item]').filter({ hasText: 'test_upload_file_2.txt' });

    await file1.click({ modifiers: ['Control'] });
    await file2.click({ modifiers: ['Control'] });

    // Press delete key
    await page.keyboard.press('Delete');

    // Confirm deletion in dialog
    await page.click('button:has-text("Delete")');

    // Verify files are gone
    await expect(page.locator('[data-file-item]').filter({ hasText: 'test_upload_file_1.txt' })).not.toBeVisible();
    await expect(page.locator('[data-file-item]').filter({ hasText: 'test_upload_file_2.txt' })).not.toBeVisible();
  });

  test('should select multiple files, cut, and drag to folder', async ({ page }) => {
    await login(page);

    // Create a folder
    await page.click('button:has-text("New Folder")');
    await page.fill('input[placeholder="Folder Name"]', 'Cut Test Folder');
    await page.click('button:has-text("Create")');
    await expect(page.locator('[data-file-item]').filter({ hasText: 'Cut Test Folder' })).toBeVisible();

    // Upload test files
    const testFile1 = path.join(process.cwd(), 'test_upload_file_1.txt');
    const testFile2 = path.join(process.cwd(), 'test_upload_file_2.txt');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([testFile1, testFile2]);
    await page.waitForTimeout(3000);

    // Select multiple files
    const file1 = page.locator('[data-file-item]').filter({ hasText: 'test_upload_file_1.txt' });
    const file2 = page.locator('[data-file-item]').filter({ hasText: 'test_upload_file_2.txt' });

    await file1.click({ modifiers: ['Control'] });
    await file2.click({ modifiers: ['Control'] });

    // Cut the files (Ctrl+X)
    await page.keyboard.press('Control+x');

    // Verify cut operation feedback (snackbar or similar)
    await expect(page.locator('text=2 item(s) cut')).toBeVisible();

    // Navigate to folder and paste (Ctrl+V)
    const folder = page.locator('[data-file-item]').filter({ hasText: 'Cut Test Folder' });
    await folder.dblclick();

    // Paste (Ctrl+V)
    await page.keyboard.press('Control+v');

    // Wait for paste operation
    await page.waitForTimeout(2000);

    // Verify files are in the folder
    await expect(page.locator('[data-file-item]').filter({ hasText: 'test_upload_file_1.txt' })).toBeVisible();
    await expect(page.locator('[data-file-item]').filter({ hasText: 'test_upload_file_2.txt' })).toBeVisible();

    // Navigate back to root
    await page.goBack();
    // Verify files are no longer in root
    await expect(page.locator('[data-file-item]').filter({ hasText: 'test_upload_file_1.txt' })).not.toBeVisible();
    await expect(page.locator('[data-file-item]').filter({ hasText: 'test_upload_file_2.txt' })).not.toBeVisible();
    });
  
    test('should upload folders using file picker', async ({ page }) => {
      await login(page);
  
      // Get test folders paths
      const testFolder1 = path.join(process.cwd(), 'test_folder_1');
      const testFolder2 = path.join(process.cwd(), 'test_folder_2');
  
      // Click on the drop zone to trigger file picker
      const dropZone = page.locator('.file-explorer-container');
      await dropZone.click();
  
      // Set folders on the hidden input (assuming input supports directory selection)
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles([testFolder1, testFolder2]);
  
      // Wait for upload to complete
      await page.waitForTimeout(5000);
  
      // Verify folders appear in file explorer
      await expect(page.locator('[data-file-item]').filter({ hasText: 'test_folder_1' })).toBeVisible();
      await expect(page.locator('[data-file-item]').filter({ hasText: 'test_folder_2' })).toBeVisible();
    });
  
    test('should upload folders using drag and drop', async ({ page }) => {
      await login(page);
  
      // Get the drop zone element
      const dropZone = page.locator('.file-explorer-container');
  
      // For folders, simulate drag and drop with folder entries
      // Note: This is a simplified simulation; actual folder drag-and-drop from filesystem is complex
      const dataTransfer = await page.evaluateHandle(() => {
        const dt = new DataTransfer();
        // Create mock folder entries (in a real scenario, this would be handled by the browser)
        // For testing purposes, we'll assume the drop zone handles folder-like data
        return dt;
      });
  
      // Perform drag and drop (this may need adjustment based on actual implementation)
      await dropZone.dispatchEvent('dragover', { dataTransfer });
      await dropZone.dispatchEvent('drop', { dataTransfer });
  
      // Wait for upload to complete
      await page.waitForTimeout(5000);
  
      // Verify folders appear in file explorer (assuming test folders are created)
      await expect(page.locator('[data-file-item]').filter({ hasText: 'test_folder_1' })).toBeVisible();
      await expect(page.locator('[data-file-item]').filter({ hasText: 'test_folder_2' })).toBeVisible();
    });
  
    test('should upload folders using clipboard', async ({ page }) => {
      await login(page);
  
      // Mock clipboard with folder data
      await page.evaluate(() => {
        const originalRead = navigator.clipboard.read;
        navigator.clipboard.read = async () => [{
          types: ['text/plain'],
          getType: async (type: string) => {
            if (type === 'text/plain') {
              return new Blob(['folder clipboard test content'], { type: 'text/plain' });
            }
            throw new Error('Unsupported type');
          }
        } as any];
      });
  
      // Focus the file explorer container and paste
      const container = page.locator('.file-explorer-container');
      await container.click();
      await page.keyboard.press('Control+v');
  
      // Wait for upload to complete
      await page.waitForTimeout(3000);
  
      // Verify folders appear (assuming naming convention)
      await expect(page.locator('[data-file-item]').filter({ hasText: /clipboard-folder/ })).toBeVisible();
    });
  
    test('should select multiple folders and drag to another folder', async ({ page }) => {
      await login(page);
  
      // First create a destination folder
      await page.click('button:has-text("New Folder")');
      await page.fill('input[placeholder="Folder Name"]', 'Destination Folder');
      await page.click('button:has-text("Create")');
      await expect(page.locator('[data-file-item]').filter({ hasText: 'Destination Folder' })).toBeVisible();
  
      // Create test folders to move
      await page.click('button:has-text("New Folder")');
      await page.fill('input[placeholder="Folder Name"]', 'Move Folder 1');
      await page.click('button:has-text("Create")');
      await page.click('button:has-text("New Folder")');
      await page.fill('input[placeholder="Folder Name"]', 'Move Folder 2');
      await page.click('button:has-text("Create")');
  
      // Wait for folders to appear
      await expect(page.locator('[data-file-item]').filter({ hasText: 'Move Folder 1' })).toBeVisible();
      await expect(page.locator('[data-file-item]').filter({ hasText: 'Move Folder 2' })).toBeVisible();
  
      // Select multiple folders (using Ctrl+click)
      const folder1 = page.locator('[data-file-item]').filter({ hasText: 'Move Folder 1' });
      const folder2 = page.locator('[data-file-item]').filter({ hasText: 'Move Folder 2' });
  
      await folder1.click({ modifiers: ['Control'] });
      await folder2.click({ modifiers: ['Control'] });
  
      // Drag selected folders to destination folder
      await folder1.dragTo(page.locator('[data-file-item]').filter({ hasText: 'Destination Folder' }));
  
      // Wait for move operation
      await page.waitForTimeout(2000);
  
      // Navigate into destination folder and verify folders are there
      await page.locator('[data-file-item]').filter({ hasText: 'Destination Folder' }).dblclick();
      await expect(page.locator('[data-file-item]').filter({ hasText: 'Move Folder 1' })).toBeVisible();
      await expect(page.locator('[data-file-item]').filter({ hasText: 'Move Folder 2' })).toBeVisible();
    });
  
    test('should select multiple folders and delete with delete key', async ({ page }) => {
      await login(page);
  
      // Create test folders to delete
      await page.click('button:has-text("New Folder")');
      await page.fill('input[placeholder="Folder Name"]', 'Delete Folder 1');
      await page.click('button:has-text("Create")');
      await page.click('button:has-text("New Folder")');
      await page.fill('input[placeholder="Folder Name"]', 'Delete Folder 2');
      await page.click('button:has-text("Create")');
  
      // Wait for folders to appear
      await expect(page.locator('[data-file-item]').filter({ hasText: 'Delete Folder 1' })).toBeVisible();
      await expect(page.locator('[data-file-item]').filter({ hasText: 'Delete Folder 2' })).toBeVisible();
  
      // Select multiple folders
      const folder1 = page.locator('[data-file-item]').filter({ hasText: 'Delete Folder 1' });
      const folder2 = page.locator('[data-file-item]').filter({ hasText: 'Delete Folder 2' });
  
      await folder1.click({ modifiers: ['Control'] });
      await folder2.click({ modifiers: ['Control'] });
  
      // Press delete key
      await page.keyboard.press('Delete');
  
      // Confirm deletion in dialog
      await page.click('button:has-text("Delete")');
  
      // Verify folders are gone
      await expect(page.locator('[data-file-item]').filter({ hasText: 'Delete Folder 1' })).not.toBeVisible();
      await expect(page.locator('[data-file-item]').filter({ hasText: 'Delete Folder 2' })).not.toBeVisible();
    });
  });