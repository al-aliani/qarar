/**
 * E2E Test - رحلة المستخدم الأساسية (معيار حرج)
 * اختبار واحد يعتمد على Playwright
 */
import { test, expect } from '@playwright/test';

test('يمكن فتح المنصة وعرض الصفحة الرئيسية وفتح قائمة التصدير', async ({ page }) => {
  await page.goto('/index.html');
  // تحقق من عرض العلامة التجارية
  await expect(page.locator('.brand-name')).toContainText('محاكي الجدوى');

  // فتح قائمة التصدير (modal وليس dropdown)
  const exportBtn = page.locator('#btnExportMenu');
  await exportBtn.click();
  // التحقق من ظهور نافذة التصدير
  await expect(page.locator('.export-modal')).toBeVisible({ timeout: 5000 });
});
