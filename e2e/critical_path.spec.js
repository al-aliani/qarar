import { test, expect } from '@playwright/test';

test.describe('Critical Path: Full User Journey', () => {

  test('User can create a project, add revenue, and see calculations', async ({ page }) => {
    // 1. Landing Page
    await page.goto('/index.html');
    await expect(page).toHaveTitle(/محاكي الجدوى/);
    await page.waitForLoadState('domcontentloaded');

    // 2. Start New Project from Dashboard (or empty state)
    await expect(page.locator('.dashboard-view, .dashboard-empty, #wizardContainer, .app-shell')).toBeVisible({ timeout: 15000 });

    // Click "New Project" (Full Study) — only if dashboard/empty is shown
    const btnNew = page.locator('#btnNewProject, #btnNewProjectEmpty').filter({ hasText: 'دراسة جديدة' }).first();
    if (await btnNew.isVisible()) {
      await btnNew.click();
      await expect(page.locator('#templateGalleryOverlay, .sidebar')).toBeVisible({ timeout: 8000 });
    }

    // 2.1 Template Gallery (if opened)
    const galleryOverlay = page.locator('#templateGalleryOverlay');
    if (await galleryOverlay.isVisible()) {
      const emptyTemplate = galleryOverlay.locator('.template-card[data-id="empty"]');
      await emptyTemplate.click();
      await expect(galleryOverlay).not.toBeVisible({ timeout: 5000 });
    }

    // Sidebar should now be visible
    const sidebar = page.locator('.sidebar');
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    // Navigate to "Project Info" via Sidebar (already verified visibility)
    // "معلومات المشروع ونموذج العمل (ريادي/شركات)"
    const projectInfoStep = page.locator('.step-item .step-label').filter({ hasText: 'معلومات المشروع' }).first();
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
    const revenueStep = page.locator('.step-item .step-label').filter({ hasText: 'مصادر الإيرادات' }).first();
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

    // 6. Verify Live Panel Updates
    // The Live Panel #liveNPV should update after short debounce
    const liveNPV = page.locator('#liveNPV');
    await expect(liveNPV).not.toHaveText('--', { timeout: 15000 });
    const npvText = await liveNPV.textContent();
    console.log('Live NPV:', npvText);
    expect(npvText).toBeTruthy();

    // 7. Check Calculation Dashboard (Financial Indicators)
    // Sidebar section: "مؤشرات التقييم المالي"
    const financialEvalStep = page.locator('.step-item .step-label').filter({ hasText: 'مؤشرات التقييم' }).first();
    if (await financialEvalStep.isVisible()) {
        await financialEvalStep.click();
        await expect(page.locator('h3, h4').filter({ hasText: 'صافي القيمة الحالية' }).first()).toBeVisible();
    }
  });

  test('Export Menu triggers download options', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#btnExportMenu')).toBeVisible({ timeout: 10000 });
    await page.click('#btnExportMenu');
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
