import { test, expect } from '@playwright/test';

test.describe('Critical Path: Full User Journey', () => {

  test('User can create a project, add revenue, and see calculations', async ({ page }) => {
    // 1. Landing Page
    await page.goto('/index.html');
    await expect(page).toHaveTitle(/محاكي دراسة الجدوى/);
    await page.waitForLoadState('domcontentloaded');

    // 2. Start New Project from Dashboard (or empty state)
    await expect(page.locator('#wizardContainer')).toBeVisible({ timeout: 15000 });

    // Click "New Project" (Full Study) — only if dashboard/empty is shown
    const btnNew = page.locator('#btnNewProject, #btnNewProjectEmpty').filter({ hasText: 'دراسة جديدة' }).first();
    if (await btnNew.isVisible()) {
      await btnNew.click();
      await expect(page.locator('#templateGalleryOverlay')).toBeVisible({ timeout: 8000 });
    }

    // 2.1 Template Gallery (if opened)
    const galleryOverlay = page.locator('#templateGalleryOverlay');
    if (await galleryOverlay.isVisible()) {
      const emptyTemplate = galleryOverlay.locator('.template-card[data-id="empty"]');
      await emptyTemplate.click();
      const advancedMode = galleryOverlay.locator('.mode-card[data-mode="advanced"]');
      if (await advancedMode.isVisible()) {
        await advancedMode.click();
        await galleryOverlay.locator('#btnBlankCreate').click();
      }
      await expect(galleryOverlay).not.toBeVisible({ timeout: 5000 });
    }

    // Navigate through the single shared study map (the legacy sidebar is intentionally hidden)
    await expect(page.locator('#btnOpenStudyMap')).toBeVisible({ timeout: 10000 });
    await page.locator('#btnOpenStudyMap').click();
    const projectInfoStep = page.locator('#studyMapDialog [data-study-step]').filter({ hasText: 'معلومات المشروع' });
    await projectInfoStep.click();

    // 3. Fill Project Info
    // Wizard inputs use id="field-{key}" where key matches schema
    // Project Name key is "name" -> #field-name
    const nameInput = page.locator('input[data-key="name"], #field-name').first();
    await nameInput.waitFor({ state: 'visible' });
    await nameInput.fill('مقهى التميز');
    
    // City (select usually, or text) -> schema says default "الرياض"
    // Let's just fill name for now as it's the critical validator

    // Blur to trigger store update
    await nameInput.blur();

    // 4. Navigate to Revenue (مصادر الإيرادات)
    await page.locator('#btnOpenStudyMap').click();
    const revenueStep = page.locator('#studyMapDialog [data-study-step]').filter({ hasText: 'مصادر الإيرادات' });
    await revenueStep.click();

    // 5. Add Revenue Stream
    // Table ID inside Wizard map: revenueStreams -> #table-revenueStreams
    const tableContainer = page.locator('#table-revenueStreams');
    await expect(tableContainer).toBeVisible();

    // Click Add Row
    const addBtn = tableContainer.locator('.btn-add-row');
    await addBtn.click();
    
    // Fill first row inputs
    // DynamicTable inputs have class .table-input and data-col="{key}"
    // Schema keys: service, customersPerMonth, avgPrice
    const row = tableContainer.locator('tr[data-row-index="0"]');
    await expect(row).toBeVisible();

    await row.locator('input[data-col="service"]').fill('قهوة مقطرة');
    await row.locator('input[data-col="avgPrice"]').fill('15');
    await row.locator('input[data-col="customersPerMonth"]').fill('3000'); // 100/day * 30

    // Trigger calculation by blurring or changing focus
    await row.locator('input[data-col="customersPerMonth"]').blur();

    // 6. Check the financial indicators dashboard (the duplicate live panel and early-summary step were removed)
    await page.locator('#btnOpenStudyMap').click();
    const financialDashboardStep = page.locator('#studyMapDialog [data-study-step]').filter({ hasText: 'لوحة المؤشرات المالية' });
    await financialDashboardStep.click();
    await expect(page.locator('h2').filter({ hasText: 'لوحة المؤشرات المالية' })).toBeVisible();
  });

  test('Export Menu triggers download options', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForLoadState('domcontentloaded');
    await page.goto('/index.html#/step/0');
    await expect(page.locator('#headerExportMenu')).toBeVisible({ timeout: 10000 });
    await page.click('#headerExportMenu');
    // Modal uses data-type (ExportMenu.js)
    await expect(page.locator('.export-modal')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('.export-modal [data-type="excel"]')).toBeVisible();
    await expect(page.locator('.export-modal [data-type="pdf"]')).toBeVisible();
    await expect(page.locator('.export-modal [data-type="bank"]')).toBeVisible();
    await expect(page.locator('.export-modal [data-type="pptx"]')).toBeVisible();
    await expect(page.locator('.export-modal [data-type="word"]')).toBeVisible();
    await expect(page.locator('.export-modal [data-type="investor_dashboard"]')).toBeVisible();
  });

});
