/**
 * Visual regression testing — لقطات شاشة للمقارنة البصرية
 * التشغيل: npm run test:e2e -- e2e/visual.spec.js
 * تحديث اللقطات: npm run test:e2e -- e2e/visual.spec.js --update-snapshots
 *
 * تدقيق 2026-08-21: .sidebar مخفي دائماً منذ استبداله بنظام التنقّل بالتصنيفات (نفس
 * الفخ الموثّق بـAI_HANDOFF.md §5) — كانت اللقطتان الثانية والثالثة تفشلان قبل حتى
 * الوصول لمقارنة الصورة. كذلك /index.html صارت تتطلب تسجيل دخول (#/home)، فمحتوى
 * الصفحة الرئيسية لزائر غير مسجَّل هو نافذة الدخول/التنبيه نفسها لا لوحة التحكم —
 * لقطة "الهيكل العام" تختبر الآن هذا المظهر الفعلي (.app-shell بدل .sidebar).
 * اللقطتان الثانية والثالثة تنتقلان إلى #/step/0 (مسار غير محمي، انظر critical_path.spec.js)
 * حيث تُعرض التصنيفات ومحتوى المعالج فعلياً.
 */
import { test, expect } from '@playwright/test';

test.describe('Visual regression — محاكي الجدوى', () => {
    test('الصفحة الرئيسية — الهيكل العام', async ({ page }) => {
        await page.goto('/index.html');
        await page.waitForLoadState('domcontentloaded');
        const main = page.locator('#app, body').first();
        await expect(main).toBeVisible({ timeout: 10000 });
        await expect(page.locator('.app-shell').first()).toBeVisible({ timeout: 10000 });
        await expect(page).toHaveScreenshot('homepage-layout.png', {
            fullPage: true,
            maxDiffPixels: 500,
        });
    });

    test('شريط التنقل بالتصنيفات', async ({ page }) => {
        // جولة driver.js التعريفية تظهر بعد ثانية عبر setTimeout (نفس فخ critical_path.spec.js)
        // وتُزيح تخطيط الصفحة أثناء التقاط اللقطة — نُعطّلها هنا لثبات المقارنة البصرية.
        await page.addInitScript(() => localStorage.setItem('tour_category0_seen', 'true'));
        await page.goto('/index.html#/step/0');
        await page.waitForLoadState('domcontentloaded');
        const nav = page.locator('#macroJourneyStepper:visible, #categoryStepper:visible').first();
        await expect(nav).toBeVisible({ timeout: 10000 });
        await expect(nav).toHaveScreenshot('sidebar-nav.png', {
            maxDiffPixels: 300,
        });
    });

    test('منطقة المحتوى الرئيسي (Wizard)', async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem('tour_category0_seen', 'true'));
        await page.goto('/index.html#/step/0');
        await page.waitForLoadState('domcontentloaded');
        const wizard = page.locator('#wizardContainer');
        await expect(wizard).toBeVisible({ timeout: 10000 });
        await expect(wizard).not.toBeEmpty();
        await expect(wizard).toHaveScreenshot('wizard-main-area.png', {
            maxDiffPixels: 800,
            timeout: 20000,
        });
    });
});
