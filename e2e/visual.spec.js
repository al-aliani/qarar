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
 *
 * تدقيق 2026-08-22: شريط موافقة الكوكيز (public/js/cookie-notice.js) بات عنصراً
 * حقيقياً position:fixed بعد إصلاح a11y/الامتثال. لقطات العنصر (لا fullPage) لعناصر
 * أطول من ارتفاع الفيوبورت (كـ#wizardContainer ~8300px) تُلحِق العناصر الثابتة
 * بموضع الفيوبورت أثناء تصوير/دمج الأجزاء متعددة، فتظهر مكرَّرة/في مواضع غير ثابتة
 * داخل اللقطة النهائية — تسبَّب بفشل متقطّع حقيقي (لا وهمي) عبر عدة تشغيلات. الحل:
 * تثبيت قرار الموافقة قبل التنقّل حتى لا يُحقَن الشريط إطلاقاً بهذه الاختبارات.
 *
 * تدقيق 2026-08-22: #/step/N (اختباري لقطة "شريط التنقل" و"منطقة المحتوى الرئيسي" أدناه)
 * صارت تتطلب تسجيل دخول أيضاً (إغلاق فجوة اتساق موثّقة بـAI_HANDOFF.md — كانت #/home فقط
 * محمية سابقاً). المظهر البصري للعنصرين نفسه بلا تغيير (نفس المكوّن يُرسَم بمعزل عن حالة
 * المصادقة بمجرد الوصول له) — التغيير الوحيد أن الوصول الآن يتطلب loginTestUser() أولاً،
 * فالاختباران يتخطّيان نفسيهما بلا E2E_CUSTOMER_EMAIL/PASSWORD (نفس نمط بقية اختبارات
 * e2e المحمية). لقطة "الهيكل العام" (اختبار أول) غير متأثرة أصلاً — تصوّر #/home نفسها.
 */
import { test, expect } from '@playwright/test';
import { loginTestUser, hasE2ECredentials } from './helpers/auth.js';

test.describe('Visual regression — محاكي الجدوى', () => {
    test('الصفحة الرئيسية — الهيكل العام', async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem('qarar_cookie_consent', 'granted'));
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
        test.skip(!hasE2ECredentials(), 'يتطلب E2E_CUSTOMER_EMAIL و E2E_CUSTOMER_PASSWORD');
        // جولة driver.js التعريفية تظهر بعد ثانية عبر setTimeout (نفس فخ critical_path.spec.js)
        // وتُزيح تخطيط الصفحة أثناء التقاط اللقطة — نُعطّلها هنا لثبات المقارنة البصرية.
        await page.addInitScript(() => localStorage.setItem('tour_category0_seen', 'true'));
        await page.addInitScript(() => localStorage.setItem('qarar_cookie_consent', 'granted'));
        await page.goto('/index.html');
        await page.waitForLoadState('domcontentloaded');
        await loginTestUser(page);
        await page.evaluate(() => { window.location.hash = '#/step/0'; });
        const nav = page.locator('#macroJourneyStepper:visible, #categoryStepper:visible').first();
        await expect(nav).toBeVisible({ timeout: 10000 });
        await expect(nav).toHaveScreenshot('sidebar-nav.png', {
            maxDiffPixels: 300,
        });
    });

    test('منطقة المحتوى الرئيسي (Wizard)', async ({ page }) => {
        test.skip(!hasE2ECredentials(), 'يتطلب E2E_CUSTOMER_EMAIL و E2E_CUSTOMER_PASSWORD');
        await page.addInitScript(() => localStorage.setItem('tour_category0_seen', 'true'));
        await page.addInitScript(() => localStorage.setItem('qarar_cookie_consent', 'granted'));
        await page.goto('/index.html');
        await page.waitForLoadState('domcontentloaded');
        await loginTestUser(page);
        await page.evaluate(() => { window.location.hash = '#/step/0'; });
        const wizard = page.locator('#wizardContainer');
        await expect(wizard).toBeVisible({ timeout: 10000 });
        await expect(wizard).not.toBeEmpty();
        await expect(wizard).toHaveScreenshot('wizard-main-area.png', {
            maxDiffPixels: 800,
            timeout: 20000,
        });
    });
});
