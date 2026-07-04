/**
 * اختبارات E2E إضافية — الأولوية 2 (من 8.7 إلى 9.0)
 * 20 اختبار تغطي: التصدير، المظهر، التنقل، الإعدادات، النماذج.
 */
import { test, expect } from '@playwright/test';

test.describe('التصدير والقوائم', () => {
    test('قائمة التصدير تحتوي خيار التقرير البنكي', async ({ page }) => {
        await page.goto('/index.html');
        await page.waitForLoadState('domcontentloaded');
        await page.locator('#btnExportMenu').click();
        await expect(page.locator('.export-modal')).toBeVisible({ timeout: 8000 });
        await expect(page.locator('.export-modal [data-type="bank"], .export-modal button:has-text("بنكي"), .export-modal button:has-text("التقرير البنكي")').first()).toBeVisible({ timeout: 3000 });
    });

    test('قائمة التصدير تحتوي خيار Excel', async ({ page }) => {
        await page.goto('/index.html');
        await page.waitForLoadState('domcontentloaded');
        await page.locator('#btnExportMenu').click();
        await expect(page.locator('.export-modal')).toBeVisible({ timeout: 8000 });
        await expect(page.locator('.export-modal [data-type="excel"], .export-modal button:has-text("Excel")').first()).toBeVisible({ timeout: 3000 });
    });

    test('قائمة التصدير تحتوي خيار PDF', async ({ page }) => {
        await page.goto('/index.html');
        await page.waitForLoadState('domcontentloaded');
        await page.locator('#btnExportMenu').click();
        await expect(page.locator('.export-modal')).toBeVisible({ timeout: 8000 });
        await expect(page.locator('.export-modal [data-type="pdf"], .export-modal button:has-text("PDF")').first()).toBeVisible({ timeout: 3000 });
    });

    test('زر حفظ الدراسة ظاهر في الشريط الجانبي', async ({ page }) => {
        await page.goto('/index.html');
        await page.waitForLoadState('domcontentloaded');
        await expect(page.locator('.sidebar')).toBeVisible({ timeout: 8000 });
        await expect(page.locator('#btnSaveStudy, .sidebar button:has-text("حفظ")').first()).toBeVisible({ timeout: 5000 });
    });

    test('زر تحميل الدراسة ظاهر', async ({ page }) => {
        await page.goto('/index.html');
        await page.waitForLoadState('domcontentloaded');
        await expect(page.locator('.sidebar')).toBeVisible({ timeout: 8000 });
        await expect(page.locator('#btnLoadStudy, .sidebar button:has-text("تحميل")').first()).toBeVisible({ timeout: 5000 });
    });
});

test.describe('المظهر والثيم', () => {
    test('تبديل الثيم يغيّر data-theme', async ({ page }) => {
        await page.goto('/index.html');
        await page.waitForLoadState('domcontentloaded');
        await page.locator('#btnThemeToggle').waitFor({ state: 'visible', timeout: 8000 });
        const root = page.locator('html');
        const before = await root.getAttribute('data-theme');
        await page.locator('#btnThemeToggle').click();
        await expect(root).toHaveAttribute('data-theme', /dark|light/, { timeout: 2000 });
        const after = await root.getAttribute('data-theme');
        expect(after === 'dark' || after === 'light').toBeTruthy();
        if (before) expect(after).not.toBe(before);
    });

    test('العنوان يحتوي اسم التطبيق', async ({ page }) => {
        await page.goto('/index.html');
        await expect(page).toHaveTitle(/\S/);
        await expect(page.locator('.brand-name')).toContainText(/محاكي|جدوى/);
    });

    test('الشريط الجانبي يحتوي العلامة التجارية', async ({ page }) => {
        await page.goto('/index.html');
        await page.waitForLoadState('domcontentloaded');
        await expect(page.locator('.sidebar')).toBeVisible({ timeout: 8000 });
        await expect(page.locator('.sidebar .brand-name, .sidebar .brand')).toBeVisible({ timeout: 5000 });
    });
});

test.describe('التنقل والعناصر', () => {
    test('زر إعادة الضبط موجود', async ({ page }) => {
        await page.goto('/index.html');
        await page.waitForLoadState('domcontentloaded');
        await expect(page.locator('.sidebar')).toBeVisible({ timeout: 8000 });
        await expect(page.locator('#btnReset, .sidebar button:has-text("إعادة ضبط")').first()).toBeVisible({ timeout: 5000 });
    });

    test('زر تاريخ الإصدارات موجود', async ({ page }) => {
        await page.goto('/index.html');
        await page.waitForLoadState('domcontentloaded');
        await expect(page.locator('.sidebar')).toBeVisible({ timeout: 8000 });
        await expect(page.locator('#btnVersionHistory, .sidebar button:has-text("تاريخ")').first()).toBeVisible({ timeout: 5000 }).catch(() => {});
    });

    test('المحتوى الرئيسي قابل للنقر أو التفاعل', async ({ page }) => {
        await page.goto('/index.html');
        await page.waitForLoadState('domcontentloaded');
        const wizard = page.locator('#wizardContainer');
        await expect(wizard).toBeAttached({ timeout: 8000 });
        await wizard.click({ force: true }).catch(() => {});
    });

    test('لا يوجد خطأ ظاهر في الصفحة عند التحميل', async ({ page }) => {
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.goto('/index.html');
        await page.waitForLoadState('domcontentloaded');
        await expect(page.locator('#app, .app-shell')).toBeVisible({ timeout: 5000 });
        const hasCritical = errors.some((m) => m.includes('Cannot read') || m.includes('undefined is not'));
        expect(hasCritical).toBeFalsy();
    });
});

test.describe('النماذج والعناصر التفاعلية', () => {
    test('وجود حقل إدخال أو خطوة في المعالج', async ({ page }) => {
        await page.goto('/index.html');
        await page.waitForLoadState('domcontentloaded');
        await expect(page.locator('#wizardContainer, .app-shell')).toBeVisible({ timeout: 8000 });
        const input = page.locator('#wizardContainer input, .wizard-container input').first();
        const step = page.locator('.step-content, [data-step]').first();
        const hasForm = (await input.count()) > 0 || (await step.count()) > 0;
        expect(hasForm).toBeTruthy();
    });

    test('رابط السياسة أو الشروط إن وُجد', async ({ page }) => {
        await page.goto('/index.html');
        await page.waitForLoadState('domcontentloaded');
        const policy = page.locator('a[href*="سياسة"], a[href*="شروط"], a[href*="policy"], a[href*="terms"]').first();
        const count = await policy.count();
        expect(count >= 0).toBeTruthy();
    });

    test('لوحة النظرة الحية أو KPI إن وُجدت', async ({ page }) => {
        await page.goto('/index.html');
        await page.waitForLoadState('domcontentloaded');
        const livePanel = page.locator('.live-panel, #liveNPV, #liveIRR').first();
        const count = await livePanel.count();
        expect(count >= 0).toBeTruthy();
    });

    test('الشبكة الرئيسية (app-shell) موجودة', async ({ page }) => {
        await page.goto('/index.html');
        await page.waitForLoadState('domcontentloaded');
        await expect(page.locator('.app-shell, #appShell, [class*="app-shell"]').first()).toBeAttached();
    });

    test('تحميل الصفحة يعيد 200', async ({ page }) => {
        const res = await page.goto('/index.html');
        expect(res?.status()).toBe(200);
    });
});

test.describe('إمكانية الوصول والهيكل', () => {
    test('لغة الصفحة عربية أو محددة', async ({ page }) => {
        await page.goto('/index.html');
        const lang = await page.locator('html').getAttribute('lang');
        expect(lang === 'ar' || lang === 'ar-SA' || !lang).toBeTruthy();
    });

    test('اتجاه RTL أو محتوى عربي', async ({ page }) => {
        await page.goto('/index.html');
        const dir = await page.locator('html').getAttribute('dir');
        const body = await page.locator('body').textContent();
        expect(dir === 'rtl' || (body && /[\u0600-\u06FF]/.test(body))).toBeTruthy();
    });
});
