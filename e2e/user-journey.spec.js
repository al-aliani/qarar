/**
 * E2E Test - رحلة المستخدم الأساسية (معيار حرج)
 * اختبار واحد يعتمد على Playwright
 */
import { test, expect } from '@playwright/test';
import { loginTestUser, hasE2ECredentials } from './helpers/auth.js';

test('يمكن فتح المنصة وعرض الصفحة الرئيسية وفتح قائمة التصدير', async ({ page }) => {
  // تدقيق 2026-07-15: .brand-name نصّه الفعلي "قرار" لا "محاكي الجدوى"، وهو أصلاً
  // داخل .sidebar المخفي دائماً؛ #btnExportMenu كذلك. .dv-brand__name هو العلامة
  // التجارية الظاهرة في لوحة التحكم، و#headerExportMenu هو زر التصدير الظاهر
  // داخل سياق دراسة فعلية (workspace) لا لوحة التحكم الرئيسية.
  //
  // تدقيق 2026-08-21: #/home تتطلب تسجيل دخول إلزامياً الآن — .dv-brand__name جزء
  // من لوحة التحكم (DashboardView) التي لا تُرسَم لزائر غير مسجَّل.
  test.skip(!hasE2ECredentials(), 'يتطلب E2E_CUSTOMER_EMAIL و E2E_CUSTOMER_PASSWORD');
  await page.goto('/index.html');
  await page.waitForLoadState('domcontentloaded');
  await loginTestUser(page);
  await expect(page.locator('.dv-brand__name')).toContainText('قرار');

  // فتح قائمة التصدير (modal وليس dropdown) — داخل سياق دراسة فعلية
  // جولة driver.js التعريفية تظهر بعد ثانية وتحجب النقر بطبقتها الشفافة (driver-overlay)
  // تحت بطء CI — نفس فخ critical_path.spec.js.
  await page.addInitScript(() => localStorage.setItem('tour_category0_seen', 'true'));
  await page.goto('/index.html#/step/0');
  const exportBtn = page.locator('#headerExportMenu');
  await exportBtn.waitFor({ state: 'visible', timeout: 10000 });
  await exportBtn.click();
  // التحقق من ظهور نافذة التصدير
  await expect(page.locator('.export-modal')).toBeVisible({ timeout: 5000 });
});
