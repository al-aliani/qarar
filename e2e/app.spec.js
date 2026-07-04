/**
 * اختبار E2E أساسي — تحميل التطبيق وعناصر الواجهة
 */
import { test, expect } from '@playwright/test';

test.describe('محاكي الجدوى — E2E', () => {
    test('تحميل الصفحة الرئيسية وعرض العنوان', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveTitle(/محاكي|جدوى|دراسة/i);
    });

    test('وجود الشريط الجانبي وزر التصدير', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');
        const sidebar = page.locator('.sidebar').first();
        await expect(sidebar).toBeVisible({ timeout: 10000 });
        const exportBtn = page.locator('#btnExportMenu, button:has-text("تصدير")').first();
        await expect(exportBtn).toBeVisible({ timeout: 5000 });
    });

    test('الانتقال للمحتوى الرئيسي (wizardContainer)', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');
        const main = page.locator('#wizardContainer').first();
        await expect(main).toBeAttached();
    });

    test('زر تبديل المظهر (Dark/Light) موجود', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');
        const themeBtn = page.locator('#btnThemeToggle');
        await expect(themeBtn).toBeVisible({ timeout: 8000 });
    });

    test('شريط التنقل (Breadcrumb) أو المحتوى الرئيسي ظاهر', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');
        const breadcrumb = page.locator('#breadcrumbBar');
        const wizard = page.locator('#wizardContainer');
        await expect(breadcrumb.or(wizard).first()).toBeAttached();
    });

    test('حاوية المصادقة أو زر الدخول ظاهرة', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');
        await expect(page.locator('.sidebar, #app')).toBeVisible({ timeout: 8000 });
        const authContainer = page.locator('#authContainer');
        const hasAuth = await authContainer.count() > 0;
        const hasLogin = await page.locator('button:has-text("دخول"), #btnLogin').count() > 0;
        expect(hasAuth || hasLogin).toBeTruthy();
    });
});
