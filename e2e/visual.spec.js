/**
 * Visual regression testing — لقطات شاشة للمقارنة البصرية
 * التشغيل: npm run test:e2e -- e2e/visual.spec.js
 * تحديث اللقطات: npm run test:e2e -- e2e/visual.spec.js --update-snapshots
 */
import { test, expect } from '@playwright/test';

test.describe('Visual regression — محاكي الجدوى', () => {
    test('الصفحة الرئيسية — الهيكل العام', async ({ page }) => {
        await page.goto('/index.html');
        await page.waitForLoadState('domcontentloaded');
        const main = page.locator('#app, body').first();
        await expect(main).toBeVisible({ timeout: 10000 });
        await expect(page.locator('.sidebar').first()).toBeVisible({ timeout: 10000 });
        await expect(page).toHaveScreenshot('homepage-layout.png', {
            fullPage: true,
            maxDiffPixels: 500,
        });
    });

    test('الشريط الجانبي والتنقل', async ({ page }) => {
        await page.goto('/index.html');
        await page.waitForLoadState('domcontentloaded');
        const sidebar = page.locator('.sidebar').first();
        await expect(sidebar).toBeVisible({ timeout: 10000 });
        await expect(sidebar).toHaveScreenshot('sidebar-nav.png', {
            maxDiffPixels: 300,
        });
    });

    test('منطقة المحتوى الرئيسي (Wizard)', async ({ page }) => {
        await page.goto('/index.html');
        await page.waitForLoadState('domcontentloaded');
        const wizard = page.locator('#wizardContainer');
        await expect(wizard).toBeVisible({ timeout: 10000 });
        await expect(wizard).toHaveScreenshot('wizard-main-area.png', {
            maxDiffPixels: 800,
        });
    });
});
