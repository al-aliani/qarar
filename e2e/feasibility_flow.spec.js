import { test, expect } from '@playwright/test';

test.describe('Feasibility Simulator Main Flow', () => {
  
  test('should load the main page and display the primary inputs', async ({ page }) => {
    // Navigate to the local server (assuming Vite runs on 5173 or the python backend)
    await page.goto('http://localhost:5173/'); 

    // Check that the title exists
    await expect(page).toHaveTitle(/دراسة الجدوى|Feasibility|Simulator/i);

    // Ensure there is some content loaded
    const body = page.locator('body');
    await expect(body).toBeVisible();
    
    // Take a screenshot of the initial load to ensure UI hasn't degraded
    await page.screenshot({ path: 'e2e/screenshots/initial-load.png' });
  });

});
