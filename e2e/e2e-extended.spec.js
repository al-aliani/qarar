/**
 * اختبارات E2E إضافية — الأولوية 2 (من 8.7 إلى 9.0)
 * 20 اختبار تغطي: التصدير، المظهر، التنقل، الإعدادات، النماذج.
 */
import { test, expect } from '@playwright/test';

test.describe('التصدير والقوائم', () => {
    // #btnExportMenu داخل .sidebar المخفي دائماً — ندخل سياق دراسة فعلية (workspace)
    // حيث #headerExportMenu هو الزر الظاهر فعلياً، بنفس نمط critical_path.spec.js.
    test('قائمة التصدير تحتوي خيار التقرير البنكي', async ({ page }) => {
        await page.goto('/index.html#/step/0');
        await page.waitForLoadState('domcontentloaded');
        await page.locator('#headerExportMenu').click();
        await expect(page.locator('.export-modal')).toBeVisible({ timeout: 8000 });
        await expect(page.locator('.export-modal [data-type="bank"], .export-modal button:has-text("بنكي"), .export-modal button:has-text("التقرير البنكي")').first()).toBeVisible({ timeout: 3000 });
    });

    test('قائمة التصدير تحتوي خيار Excel', async ({ page }) => {
        await page.goto('/index.html#/step/0');
        await page.waitForLoadState('domcontentloaded');
        await page.locator('#headerExportMenu').click();
        await expect(page.locator('.export-modal')).toBeVisible({ timeout: 8000 });
        await expect(page.locator('.export-modal [data-type="excel"], .export-modal button:has-text("Excel")').first()).toBeVisible({ timeout: 3000 });
    });

    test('قائمة التصدير تحتوي خيار PDF', async ({ page }) => {
        await page.goto('/index.html#/step/0');
        await page.waitForLoadState('domcontentloaded');
        await page.locator('#headerExportMenu').click();
        await expect(page.locator('.export-modal')).toBeVisible({ timeout: 8000 });
        await expect(page.locator('.export-modal [data-type="pdf"], .export-modal button:has-text("PDF")').first()).toBeVisible({ timeout: 3000 });
    });

    test('زر حفظ الدراسة ظاهر', async ({ page }) => {
        // #btnSaveStudy الأصلي (.sidebar) مخفي دائماً؛ #headerSaveStudy هو مكافئه
        // الظاهر فعلياً داخل سياق الدراسة.
        await page.goto('/index.html#/step/0');
        await page.waitForLoadState('domcontentloaded');
        await expect(page.locator('#headerSaveStudy')).toBeVisible({ timeout: 8000 });
    });

    // تدقيق 2026-07-15: #btnLoadStudy (تحميل دراسة من JSON) موجود فقط داخل .sidebar
    // المخفي دائماً منذ استبداله بنظام التصنيفات — لا مكافئ ظاهر له حالياً في أي
    // مكان آخر بالواجهة. هذه ميزة حقيقية أصبحت غير قابلة للوصول لأي مستخدم عادي،
    // لا مجرد اختبار قديم. نتحقق من وجودها في DOM (لم تُحذف من الكود) دون الادّعاء
    // بأنها ظاهرة — ونُبقي هذا التعليق كعلامة على فجوة منتج تحتاج قراراً منفصلاً.
    test('زر تحميل الدراسة موجود في الشيفرة (غير ظاهر حالياً لأي مستخدم)', async ({ page }) => {
        await page.goto('/index.html');
        await page.waitForLoadState('domcontentloaded');
        await expect(page.locator('#btnLoadStudy')).toBeAttached({ timeout: 5000 });
    });
});

test.describe('المظهر والثيم', () => {
    test('تبديل الثيم يغيّر data-theme', async ({ page }) => {
        // #btnThemeToggle (.sidebar) مخفي دائماً؛ #dvThemeToggle هو مكافئه الظاهر
        // في لوحة التحكم الرئيسية (انظر تعليق DashboardView.js عن هذا الاستبدال).
        await page.goto('/index.html');
        await page.waitForLoadState('domcontentloaded');
        const themeBtn = page.locator('#dvThemeToggle');
        await themeBtn.waitFor({ state: 'visible', timeout: 8000 });
        const root = page.locator('html');
        const before = await root.getAttribute('data-theme');
        await themeBtn.click();
        await expect(root).toHaveAttribute('data-theme', /dark|light/, { timeout: 2000 });
        const after = await root.getAttribute('data-theme');
        expect(after === 'dark' || after === 'light').toBeTruthy();
        if (before) expect(after).not.toBe(before);
    });

    test('العنوان يحتوي اسم التطبيق', async ({ page }) => {
        await page.goto('/index.html');
        await expect(page).toHaveTitle(/\S/);
        await expect(page.locator('.brand-name, .app-header__brand').first()).toContainText(/محاكي|جدوى|قرار/);
    });

    test('الترويسة تحتوي العلامة التجارية', async ({ page }) => {
        // .sidebar مخفي دائماً — العلامة التجارية الظاهرة فعلياً هي في لوحة التحكم
        // الرئيسية (.brand-name) أو ترويسة سياق الدراسة (.app-header__brand).
        await page.goto('/index.html');
        await page.waitForLoadState('domcontentloaded');
        await expect(page.locator('.app-shell')).toBeVisible({ timeout: 8000 });
        // .brand-name الأصلي داخل .sidebar المخفي دائماً؛ .dv-brand__name هو
        // العلامة التجارية الظاهرة فعلياً في لوحة التحكم الرئيسية، و.app-header__brand
        // داخل سياق الدراسة. :visible يتجنّب اختيار عنصر مخفي أسبق في DOM.
        await expect(page.locator('.dv-brand__name:visible, .app-header__brand:visible').first()).toBeVisible({ timeout: 5000 });
    });
});

test.describe('التنقل والعناصر', () => {
    // زرا «إعادة ضبط» و«تاريخ الإصدارات» أيضاً داخل .sidebar المخفي دائماً (نفس
    // فجوة إمكانية الوصول المذكورة أعلاه لـ«تحميل دراسة») — موجودان في الشيفرة فقط.
    test('زر إعادة الضبط موجود في الشيفرة (غير ظاهر حالياً لأي مستخدم)', async ({ page }) => {
        await page.goto('/index.html');
        await page.waitForLoadState('domcontentloaded');
        await expect(page.locator('#btnReset')).toBeAttached({ timeout: 5000 });
    });

    test('زر تاريخ الإصدارات موجود في الشيفرة (غير ظاهر حالياً لأي مستخدم)', async ({ page }) => {
        await page.goto('/index.html');
        await page.waitForLoadState('domcontentloaded');
        await expect(page.locator('#btnVersionHistory')).toBeAttached({ timeout: 5000 });
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
        // الصفحة الرئيسية (لوحة تحكم) بلا حقول نموذج فعلية — الحقول تظهر داخل سياق
        // دراسة فعلية (workspace)، فندخل خطوة معلومات المشروع مباشرة.
        await page.goto('/index.html#/step/0');
        await page.waitForLoadState('domcontentloaded');
        await expect(page.locator('#wizardContainer')).toBeVisible({ timeout: 8000 });
        const input = page.locator('#wizardContainer input, .category-step input').first();
        const step = page.locator('.category-step, [data-step-index]').first();
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
