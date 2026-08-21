/**
 * اختبار E2E أساسي — تحميل التطبيق وعناصر الواجهة
 */
import { test, expect } from '@playwright/test';
import { loginTestUser, hasE2ECredentials } from './helpers/auth.js';

test.describe('محاكي الجدوى — E2E', () => {
    test('تحميل الصفحة الرئيسية وعرض العنوان', async ({ page }) => {
        await page.goto('/index.html');
        await expect(page).toHaveTitle(/محاكي|جدوى|دراسة/i);
    });

    test('وجود شريط تصنيفات الدراسة وزر التصدير', async ({ page }) => {
        // تدقيق 2026-07-15: .sidebar مخفي دائماً منذ استبداله بنظام التنقّل بالتصنيفات
        // (انظر main.css) — التنقّل الأساسي الحالي هو #categoryStepper. زر التصدير
        // نفسه يختلف معرّفه بين الصفحة الرئيسية (لوحة التحكم) وداخل الدراسة (#headerExportMenu)
        // — نطابق أي عنصر نصّه "تصدير" بدل معرّف واحد يتغيّر حسب السياق.
        // التطبيق يقلع إلى لوحة التحكم (DashboardView) لا إلى دراسة مباشرة، فشريط
        // التصنيفات (#categoryStepper) وزر التصدير لا يظهران إلا بعد فتح دراسة فعلية.
        // ننشئ دراسة فارغة (نفس تدفّق critical_path) ثم نتحقق من عناصر مساحة الدراسة.
        // تدقيق 2026-08-21: #/home تتطلب تسجيل دخول إلزامياً الآن.
        test.skip(!hasE2ECredentials(), 'يتطلب E2E_CUSTOMER_EMAIL و E2E_CUSTOMER_PASSWORD');
        await page.addInitScript(() => localStorage.setItem('tour_category0_seen', 'true'));
        await page.goto('/index.html');
        await page.waitForLoadState('domcontentloaded');
        await loginTestUser(page);
        // waitFor صريح (لا isVisible لحظي) — لوحة التحكم تُرسم بعد فحص async لحالة
        // المستخدم، ففحص لحظي مبكر يتخطّى الإنشاء فلا يظهر #field-name (نفس نمط full-project-cycle الناجح).
        const btnNew = page.locator('#btnNewProjectEmpty, #cardFullStudy').first();
        await btnNew.waitFor({ state: 'visible', timeout: 10000 });
        await btnNew.click();
        const galleryOverlay = page.locator('#templateGalleryOverlay');
        await expect(galleryOverlay).toBeVisible({ timeout: 8000 });
        await galleryOverlay.locator('#btnStartBlank').click();
        const advancedMode = galleryOverlay.locator('.mode-card[data-mode="advanced"]');
        if (await advancedMode.isVisible().catch(() => false)) {
            await advancedMode.click();
            await galleryOverlay.locator('#btnBlankCreate').click();
            await galleryOverlay.locator('#fw_btnBack').click(); // تخطي معالج التأسيس
        }
        await expect(galleryOverlay).not.toBeVisible({ timeout: 5000 });
        // بعد الإنشاء يُحمَّل عرض الدراسة (حقل الاسم ظاهر). شريط التنقّل متجاوب:
        // #categoryStepper (8 تصنيفات) على الشاشات العريضة، و#macroJourneyStepper
        // (3 مراحل) على الضيّقة — نتحقق من ظهور أيّهما بدل الإصرار على الثابت المخفي.
        await expect(page.locator('#field-name')).toBeVisible({ timeout: 10000 });
        const categoryNav = page.locator('#macroJourneyStepper:visible, #categoryStepper:visible').first();
        await expect(categoryNav).toBeVisible({ timeout: 10000 });
        const exportBtn = page.locator('button:visible, a:visible').filter({ hasText: 'تصدير' }).first();
        await expect(exportBtn).toBeVisible({ timeout: 5000 });
    });

    test('الانتقال للمحتوى الرئيسي (wizardContainer)', async ({ page }) => {
        await page.goto('/index.html');
        await page.waitForLoadState('domcontentloaded');
        const main = page.locator('#wizardContainer').first();
        await expect(main).toBeAttached();
    });

    test('زر تبديل المظهر (Dark/Light) موجود', async ({ page }) => {
        // #btnThemeToggle الأصلي داخل .sidebar المخفي دائماً؛ #headerThemeToggle
        // ظاهر فقط داخل وضع الدراسة (workspace)، و#dvThemeToggle ظاهر في لوحة
        // التحكم الرئيسية — على المستخدم أن يجد واحداً منهما ظاهراً في أي الحالتين.
        // تدقيق 2026-08-21: كلا العنصرين جزء من لوحة التحكم/مساحة الدراسة، تتطلبان تسجيل دخول الآن.
        test.skip(!hasE2ECredentials(), 'يتطلب E2E_CUSTOMER_EMAIL و E2E_CUSTOMER_PASSWORD');
        await page.goto('/index.html');
        await page.waitForLoadState('domcontentloaded');
        await loginTestUser(page);
        // :visible يفلتر عند المطابقة قبل first() — دون هذا، عنصر hidden أسبق في DOM
        // (headerThemeToggle) قد يُختار بدل dvThemeToggle الظاهر فعلياً، فيفشل التوكيد رغم توفّر الزر.
        const themeBtn = page.locator('#headerThemeToggle:visible, #dvThemeToggle:visible').first();
        await expect(themeBtn).toBeVisible({ timeout: 8000 });
    });

    test('شريط التنقل (Breadcrumb) أو المحتوى الرئيسي ظاهر', async ({ page }) => {
        await page.goto('/index.html');
        await page.waitForLoadState('domcontentloaded');
        const breadcrumb = page.locator('#breadcrumbBar');
        const wizard = page.locator('#wizardContainer');
        await expect(breadcrumb.or(wizard).first()).toBeAttached();
    });

    test('حاوية المصادقة أو زر الدخول ظاهرة', async ({ page }) => {
        // كان يفحص .count() فوراً بلا انتظار — لوحة التحكم (DashboardView) تُرسم
        // بعد فحص async لحالة المستخدم، فقد يُقرأ العدد صفراً قبل اكتمال الرسم.
        // toBeVisible() ينتظر تلقائياً (auto-retry) بدل قراءة لقطة لحظية.
        await page.goto('/index.html');
        await page.waitForLoadState('domcontentloaded');
        await expect(page.locator('.app-shell')).toBeVisible({ timeout: 8000 });
        const authOrLogin = page.locator('#authContainer, #dashboardLogin, button:has-text("دخول")').first();
        await expect(authOrLogin).toBeVisible({ timeout: 8000 });
    });
});
