import { test, expect } from '@playwright/test';
import { loginTestUser } from './helpers/auth.js';

/**
 * اختبار مسار الدفع الحقيقي (تحويل بنكي) من متصفح حقيقي — عبر Supabase الحيّة فعلاً
 * (لا mock). هذا المسار لم يكن مختبَراً آلياً ولا يدوياً قط (AI_HANDOFF.md §4/§6)، وهو ما
 * سمح لعطل CORS في دوال Edge وعطل admin_list_pending_bank_transfers (study_id uuid=text)
 * بالبقاء حتى اكتُشفا بتدقيق 2026-07-22.
 *
 * يتطلب حسابات حقيقية مؤكَّدة البريد مسبقاً — الاختبار لا يقدر ينشئ حساباً جديداً آلياً
 * (Supabase لا يُرجع جلسة بعد signUp() قبل تأكيد البريد يدوياً من صندوق الوارد). زوّد
 * بيانات الدخول عبر متغيرات بيئة قبل التشغيل، مثال (PowerShell):
 *   $env:E2E_CUSTOMER_EMAIL   = "..."
 *   $env:E2E_CUSTOMER_PASSWORD = "..."
 *   $env:E2E_ADMIN_EMAIL       = "..."   # اختياري — يُخطى الاختبار الثاني إن غاب
 *   $env:E2E_ADMIN_PASSWORD    = "..."
 *   npx playwright test e2e/payment_bank_transfer.spec.js
 *
 * ⚠️ .env المحلي مربوط افتراضياً بمشروع Supabase الحيّ (لا sandbox منفصلة) — تشغيل هذا
 * الاختبار يُنشئ طلب تحويل بنكي pending حقيقياً بالإنتاج تحت اسم دراسة مميَّز
 * ("اختبار دفع e2e <timestamp>") لتسهيل حذفه يدوياً لاحقاً. لا نضغط زر "تأكيد وصول
 * الحوالة" — الاختبار مسار قراءة فقط في جانب الأدمن، لا يُكمِل أي عملية دفع فعلية.
 *
 * تسجيل الدخول (بما فيه CompletePhoneModal لحساب بلا رقم جوال) عبر e2e/helpers/auth.js
 * المشترك — #/home صارت تتطلب تسجيل دخول إلزامياً فتُفتح نافذة الدخول تلقائياً.
 */

test.describe('مسار الدفع: تحويل بنكي (حي)', () => {
  test('عميل مسجَّل يُنشئ طلب تحويل بنكي بنجاح من دراسة فعلية', async ({ page }) => {
    const email = process.env.E2E_CUSTOMER_EMAIL;
    const password = process.env.E2E_CUSTOMER_PASSWORD;
    test.skip(!email || !password, 'يتطلب E2E_CUSTOMER_EMAIL و E2E_CUSTOMER_PASSWORD (حساب مؤكَّد بريد فعلاً)');

    await page.addInitScript(() => localStorage.setItem('tour_category0_seen', 'true'));
    await page.goto('/index.html');
    await page.waitForLoadState('domcontentloaded');

    // 1) تسجيل الدخول (نافذة الدخول تُفتح تلقائياً — #/home تتطلب مصادقة إلزامياً الآن)
    await loginTestUser(page);

    // 2) إنشاء دراسة جديدة فارغة (نفس تدفّق full_study.spec.js)
    const btnNew = page.locator('#btnNewProjectEmpty, #cardFullStudy').first();
    if (await btnNew.isVisible().catch(() => false)) {
      await btnNew.click();
      await expect(page.locator('#templateGalleryOverlay')).toBeVisible({ timeout: 8000 });
    }
    const galleryOverlay = page.locator('#templateGalleryOverlay');
    if (await galleryOverlay.isVisible().catch(() => false)) {
      await galleryOverlay.locator('#btnStartBlank').click();
      const advancedMode = galleryOverlay.locator('.mode-card[data-mode="advanced"]');
      if (await advancedMode.isVisible().catch(() => false)) {
        await advancedMode.click();
        await galleryOverlay.locator('#btnBlankCreate').click();
        await galleryOverlay.locator('#fw_btnBack').click();
      }
      await expect(galleryOverlay).not.toBeVisible({ timeout: 5000 });
    }

    // 3) اسم مميَّز يسهل التعرف عليه لاحقاً بلوحة الأدمن (وحذفه يدوياً إن رغبت)
    const studyName = `اختبار دفع e2e ${Date.now()}`;
    const nameInput = page.locator('#field-name');
    await nameInput.waitFor({ state: 'visible', timeout: 10000 });
    await nameInput.fill(studyName);
    await nameInput.blur();

    // انتظار المزامنة السحابية (AutoSave: تصحيح 1s ثم كتابة سحابية فعلية — autoSave.js)
    await page.waitForTimeout(3000);

    // 4) صفحة الدفع — تُظهر "ابدأ دراستك أولاً" إن لم تكتمل المزامنة بعد؛ نعيد المحاولة مرة
    await page.evaluate(() => { window.location.hash = '#/checkout'; });
    const noStudyMsg = page.locator('text=ابدأ دراستك أولاً');
    if (await noStudyMsg.isVisible({ timeout: 3000 }).catch(() => false)) {
      await page.waitForTimeout(3000);
      await page.evaluate(() => { window.location.hash = '#/home'; });
      await page.evaluate(() => { window.location.hash = '#/checkout'; });
    }

    // 5) الدفع بتحويل بنكي — يستدعي create-checkout عبر CORS فعلياً من متصفح حقيقي
    const payBtn = page.locator('#checkoutPayBank');
    await payBtn.waitFor({ state: 'visible', timeout: 10000 });
    await payBtn.click();

    // 6) التحقق: لوحة التحويل البنكي ظهرت = الطلب أُنشئ بنجاح بالخلفية الحيّة (لا خطأ CORS/شبكة)
    await expect(page.locator('text=حوّل المبلغ التالي إلى حساب الشركة')).toBeVisible({ timeout: 15000 });
    // getByText(..., {exact:true}) بدل text= (مطابقة جزئية) — النص يظهر كسطر داخل بطاقة
    // الدفع كاملة أيضاً، فالمطابقة الجزئية كانت تُرجع عنصرين (strict mode violation).
    const refRow = page.getByText('رقم الطلب المرجعي', { exact: true }).locator('..');
    await expect(refRow).toBeVisible();
    console.log(`[e2e] طلب تحويل بنكي أُنشئ بنجاح — دراسة "${studyName}"، ${await refRow.textContent()}`);
  });

  test('الأدمن يفتح تبويب التحويلات البنكية بلا عطل (فحص رجوع study_id uuid=text)', async ({ page }) => {
    const email = process.env.E2E_ADMIN_EMAIL;
    const password = process.env.E2E_ADMIN_PASSWORD;
    test.skip(!email || !password, 'يتطلب E2E_ADMIN_EMAIL و E2E_ADMIN_PASSWORD (حساب بصلاحية أدمن)');

    await page.goto('/index.html');
    await page.waitForLoadState('domcontentloaded');

    // نافذة الدخول تُفتح تلقائياً؛ loginTestUser تنتظر #dvAccountToggle أيضاً — إثبات
    // استقرار الجلسة فعلياً قبل أي محاولة فتح مسار محمي (isAdmin() يرجع false فوراً
    // بلا currentUser لو نودي قبل ذلك).
    await loginTestUser(page);

    // AuthGuard.isAdmin() قد يُرجع false عابراً لو نُودي مباشرة بعد نجاح الدخول (سباق
    // استقرار الجلسة/JWT) — AdminDashboardView.render() حينها يُعيد التوجيه صمتاً لـ''.
    // نعيد محاولة التنقّل لـ#/admin مرة إضافية بعد مهلة قصيرة بدل اعتبارها فشلاً حقيقياً.
    const bankTab = page.locator('#adminTabs [data-tab="bank_transfers"]');
    await page.evaluate(() => { window.location.hash = '#/admin'; });
    const admitted = await bankTab.waitFor({ state: 'visible', timeout: 6000 }).then(() => true).catch(() => false);
    if (!admitted) {
      await page.waitForTimeout(1500);
      await page.evaluate(() => { window.location.hash = '#/admin'; });
      await bankTab.waitFor({ state: 'visible', timeout: 10000 });
    }
    // تبويب "نظرة عامة" الافتراضي يُحمَّل ويُعاد رسمه لحظياً بعد أول ظهور للوحة — قد
    // يفصل الزرّ عن الـDOM لحظة النقر (element was detached from the DOM). ننتظر
    // استقراره فعلياً بدل الاعتماد على retry الداخلي لـPlaywright وحده.
    await bankTab.click({ timeout: 5000 }).catch(async () => {
      await page.waitForTimeout(1000);
      await bankTab.click();
    });

    // ننتظر عنوان تبويب التحويلات البنكية تحديداً (لا .admin-table العام — تبويب
    // "نظرة عامة" الافتراضي يحوي 6 جداول admin-table أخرى قد تبقى بالـDOM لحظياً).
    await expect(page.locator('text=طلبات بانتظار تأكيد وصول الحوالة')).toBeVisible({ timeout: 10000 });

    // مسار قراءة فقط — لا نضغط "تأكيد وصول الحوالة". العطل الأصلي (uuid=text) كان يُسقط
    // الاستعلام بالكامل ويعرض admin-error بدل الجدول، حتى مع طلبات pending فعلية موجودة.
    await expect(page.locator('.admin-error')).not.toBeVisible();
  });
});
