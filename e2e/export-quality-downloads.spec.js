import { test, expect } from '@playwright/test';
import { loginTestUser, hasE2ECredentials } from './helpers/auth.js';

test('export menu exposes QA fix center and local downloads history', async ({ page }) => {
  // تدقيق 2026-08-22: #/step/N صارت تتطلب تسجيل دخول أيضاً (إغلاق فجوة اتساق موثّقة
  // بـAI_HANDOFF.md — كانت #/home فقط محمية سابقاً بقرار المالك 2026-08-21).
  test.skip(!hasE2ECredentials(), 'يتطلب E2E_CUSTOMER_EMAIL و E2E_CUSTOMER_PASSWORD');
  // جولة driver.js التعريفية تظهر بعد ثانية وتحجب النقر بطبقتها الشفافة (driver-overlay)
  // تحت بطء CI — نفس فخ critical_path.spec.js.
  await page.addInitScript(() => localStorage.setItem('tour_category0_seen', 'true'));
  await page.goto('/index.html');
  await page.waitForLoadState('domcontentloaded');
  await loginTestUser(page);
  await page.evaluate(() => { window.location.hash = '#/step/0'; });

  const exportButton = page.locator('#headerExportMenu, #btnExportMenu, #btnFabExport').first();
  await expect(exportButton).toBeAttached();
  await exportButton.click();

  await expect(page.locator('#exportMenuOverlay')).toHaveClass(/is-open/);
  await expect(page.locator('#btnOpenQaFixCenter')).toBeVisible();
  await page.locator('#btnOpenQaFixCenter').click();

  // العنوان الفعلي في ExportMenu.js._openQaFixCenter() هو "مركز إصلاح الجودة" (بلا "فحص").
  await expect(page.getByRole('heading', { name: /مركز إصلاح الجودة/ })).toBeVisible();
  await expect(page.getByText('الأثر على التقرير:').first()).toBeVisible();

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('feasibility:download', {
      detail: { filename: 'e2e_export_history.json', mimeType: 'application/json', size: 256 }
    }));
  });

  await page.goto('/index.html#/downloads');
  await expect(page.getByRole('heading', { name: 'مركز التنزيلات' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'السجل المحلي' })).toBeVisible();
  await expect(page.getByText('e2e_export_history.json')).toBeVisible();
  await expect(page.getByRole('button', { name: 'إعادة توليد' }).first()).toBeVisible();
});
