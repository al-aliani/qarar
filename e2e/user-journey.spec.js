/**
 * E2E Test - رحلة المستخدم الأساسية (معيار حرج)
 * اختبار واحد يعتمد على Playwright
 */
import { test, expect } from '@playwright/test';

test('يمكن فتح المنصة وعرض الصفحة الرئيسية وفتح قائمة التصدير', async ({ page }) => {
  // تدقيق 2026-07-15: .brand-name نصّه الفعلي "قرار" لا "محاكي الجدوى"، وهو أصلاً
  // داخل .sidebar المخفي دائماً؛ #btnExportMenu كذلك. .dv-brand__name هو العلامة
  // التجارية الظاهرة في لوحة التحكم، و#headerExportMenu هو زر التصدير الظاهر
  // داخل سياق دراسة فعلية (workspace) لا لوحة التحكم الرئيسية.
  await page.goto('/index.html');
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('.dv-brand__name')).toContainText('قرار');

  // فتح قائمة التصدير (modal وليس dropdown) — داخل سياق دراسة فعلية
  await page.goto('/index.html#/step/0');
  const exportBtn = page.locator('#headerExportMenu');
  await exportBtn.waitFor({ state: 'visible', timeout: 10000 });
  await exportBtn.click();
  // التحقق من ظهور نافذة التصدير
  await expect(page.locator('.export-modal')).toBeVisible({ timeout: 5000 });
});
