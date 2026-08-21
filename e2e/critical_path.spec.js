import { test, expect } from '@playwright/test';
import { loginTestUser, hasE2ECredentials } from './helpers/auth.js';

test.describe('Critical Path: Full User Journey', () => {

  test('User can create a project, add revenue, and see calculations', async ({ page }) => {
    // تدقيق 2026-08-21: #/home تتطلب تسجيل دخول إلزامياً الآن (قرار مالك) — لوحة
    // التحكم (DashboardView) لا تُرسَم لزائر غير مسجَّل، فهذا الاختبار (ينشئ دراسة
    // من زر داخل اللوحة) يحتاج حساباً تجريبياً مؤكَّداً.
    test.skip(!hasE2ECredentials(), 'يتطلب E2E_CUSTOMER_EMAIL و E2E_CUSTOMER_PASSWORD');

    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // جولة driver.js التعريفية (مرة واحدة لكل مستخدم حقيقي) تظهر على التصنيف الأول
    // بعد ثانية عبر setTimeout، وقد تتراكب فوق تصنيف لاحق إن انتقل الاختبار أسرع من
    // ذلك — نُعطّلها هنا لأن هذا الاختبار يفحص تدفّق البيانات لا تجربة الجولة نفسها.
    await page.addInitScript(() => localStorage.setItem('tour_category0_seen', 'true'));

    // 1. Landing Page
    await page.goto('/index.html');
    await expect(page).toHaveTitle(/محاكي دراسة الجدوى/);
    await page.waitForLoadState('domcontentloaded');
    await loginTestUser(page);

    // حارس أساسي ضد بلا-محتوى-صامت: #wizardContainer له ارتفاع CSS ثابت حتى فارغاً،
    // فـ toBeVisible() وحده لا يكشف صفحة فارغة فعلياً (اكتُشف 2026-07-15: استيراد
    // ميت واحد كسر التطبيق بالكامل بصفحة بيضاء بلا أي خطأ ظاهر، وهذا التوكيد
    // القديم (toBeVisible فقط) لم يكن سيكشفه).
    await expect(page.locator('#wizardContainer')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#wizardContainer')).not.toBeEmpty();

    // 2. Start New Project (Full Study) — الزر يختلف حسب وجود مشاريع محفوظة مسبقاً
    const btnNew = page.locator('#btnNewProjectEmpty, #cardFullStudy').first();
    if (await btnNew.isVisible().catch(() => false)) {
      await btnNew.click();
      await expect(page.locator('#templateGalleryOverlay')).toBeVisible({ timeout: 8000 });
    }

    // 2.1 Template Gallery: مشروع فارغ ← مستوى "مفصّل" ← إنشاء
    const galleryOverlay = page.locator('#templateGalleryOverlay');
    if (await galleryOverlay.isVisible().catch(() => false)) {
      const emptyTemplate = galleryOverlay.locator('#btnStartBlank');
      await emptyTemplate.click();
      const advancedMode = galleryOverlay.locator('.mode-card[data-mode="advanced"]');
      if (await advancedMode.isVisible().catch(() => false)) {
        await advancedMode.click();
        await galleryOverlay.locator('#btnBlankCreate').click();
        // بعد «إنشاء الدراسة» يظهر معالج التأسيس (renderFoundationWizard) داخل المعرض نفسه
        // بدل إغلاقه فوراً؛ «تخطي التأسيس» (fw_btnBack بالخطوة 1) يستدعي skipWizard() فيغلق المعرض.
        await galleryOverlay.locator('#fw_btnBack').click();
      }
      await expect(galleryOverlay).not.toBeVisible({ timeout: 5000 });
    }

    // 3. ننتهي مباشرةً على تصنيف "التحقق والتعريف" — حقول معلومات المشروع ظاهرة
    // على نفس الصفحة (لا حوار وسيط منفصل؛ نظام التنقّل الحالي تصنيفات لا خريطة خطوات مسطّحة)
    const nameInput = page.locator('#field-name');
    await nameInput.waitFor({ state: 'visible', timeout: 10000 });
    await nameInput.fill('مقهى التميز');
    await nameInput.blur();

    // 4. الانتقال لتصنيف "السوق والإيرادات" عبر شريط التصنيفات العلوي
    await page.locator('nav[aria-label="فئات الدراسة"] button', { hasText: 'السوق والإيرادات' }).click();

    // 5. إضافة صف إيراد داخل جدول "مصادر الإيرادات"
    const tableContainer = page.locator('[data-table-id="revenueStreams"]');
    await expect(tableContainer).toBeVisible({ timeout: 10000 });

    const addBtn = tableContainer.locator('button', { hasText: 'إضافة بند' }).first();
    await addBtn.click();

    const serviceInput = tableContainer.locator('input[data-col="service"]').first();
    await expect(serviceInput).toBeVisible();
    await serviceInput.fill('قهوة مقطرة');
    await tableContainer.locator('input[data-col="avgPrice"]').first().fill('15');
    const customersInput = tableContainer.locator('input[data-col="customersPerMonth"]').first();
    await customersInput.fill('3000'); // 100/day * 30
    await customersInput.blur();

    // 6. الانتقال لتصنيف "النتائج والمتابعة" والتحقق من ظهور لوحة القرار الاستثماري فعلياً
    await page.locator('nav[aria-label="فئات الدراسة"] button', { hasText: 'النتائج والمتابعة' }).click();
    await expect(page.locator('.category-page__sections')).not.toBeEmpty({ timeout: 10000 });
    await expect(page.locator('h2', { hasText: 'النتائج والمتابعة' })).toBeVisible();

    expect(pageErrors, `Uncaught page errors: ${pageErrors.join('; ')}`).toEqual([]);
  });

  test('Export Menu triggers download options', async ({ page }) => {
    // تدقيق 2026-08-21: goto أول لـ/index.html (بلا هاش) كان يفتح نافذة تسجيل الدخول
    // (تُفتح تلقائياً الآن على #/home)، وتبقى عالقة فوق الصفحة بعد goto ثانٍ لهاش
    // مختلف بنفس الوثيقة (لا يُعيد تحميل الصفحة فعلياً) فتحجب #headerExportMenu.
    // #/step/N نفسها لا تتطلب تسجيل دخول (مسار منفصل غير محمي)، فالتنقّل المباشر إليها كافٍ.
    await page.goto('/index.html#/step/0');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#headerExportMenu')).toBeVisible({ timeout: 10000 });
    await page.click('#headerExportMenu');
    // Modal uses data-type (ExportMenu.js)
    await expect(page.locator('.export-modal')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('.export-modal [data-type="excel"]')).toBeVisible();
    await expect(page.locator('.export-modal [data-type="pdf"]')).toBeVisible();
    await expect(page.locator('.export-modal [data-type="lending_ready"]')).toBeVisible();
    await expect(page.locator('.export-modal [data-type="pptx"]')).toBeVisible();
    await expect(page.locator('.export-modal [data-type="word"]')).toBeVisible();
    // investor_dashboard ينتمي لمسار فلترة "مستثمر" لا "تمويل" (الافتراضي) — بطاقات
    // المسار الآخر مخفية (hidden) حتى يُنقر تبويبها (ExportMenu.js: _applyExportPath).
    await page.locator('.export-path-card[data-export-path="investor"]').click();
    await expect(page.locator('.export-modal [data-type="investor_dashboard"]')).toBeVisible();
  });

});
