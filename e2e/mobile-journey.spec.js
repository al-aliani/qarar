import { test, expect, devices } from '@playwright/test';

test.use({ ...devices['Pixel 5'] });

/**
 * يفتح خريطة الدراسة المشتركة وينتقل لخطوة معيّنة بنصّ تسميتها. الخريطة خارج
 * محتوى الخطوة، لذلك تعمل مع المكوّنات العامة والمتخصصة على السواء.
 */
async function goToWizardStep(page, labelSubstring, attempts = 3) {
    // ملحوظة: الصفحة تتجمّد أحياناً لثوانٍ طويلة (رسم/حفظ خلفي دوري) فيتعثر استقرار
    // هدف النقر مؤقتاً — مهلة سخية لكل محاولة مع إعادة محاولة واحدة كشبكة أمان.
    let lastError = null;
    for (let i = 0; i < attempts; i++) {
        try {
            await page.locator('#btnOpenStudyMap').click({ timeout: 20000 });
            const targetBtn = page.locator('#studyMapDialog [data-study-step]').filter({ hasText: labelSubstring });
            await expect(targetBtn).toBeVisible({ timeout: 10000 });
            await targetBtn.click({ timeout: 20000 });
            return;
        } catch (e) {
            lastError = e;
        }
    }
    throw lastError;
}

/**
 * DynamicTable.render() يستبدل DOM الصف بالكامل عند كل حدث 'change' (لتحديث الأعمدة
 * المحسوبة). ملء عدة خلايا في نفس الصف بسرعة يتسابق مع هذا الاستبدال — القيمة تُكتب على
 * عقدة DOM تُستبدل قبل أن يُعاد رسمها بالبيانات الصحيحة، فتُفقد القيمة بصمت (0 بدل القيمة
 * المُدخلة). نتحقق من ثبات كل قيمة بعد ملئها ونعيد المحاولة إن لزم بدل الوثوق بـ fill() مرة واحدة.
 */
async function fillTableCell(row, colKey, value, attempts = 4) {
    const input = row.locator(`input[data-col="${colKey}"]`);
    for (let i = 0; i < attempts; i++) {
        await input.fill(String(value));
        try {
            await expect(input).toHaveValue(String(value), { timeout: 1200 });
            return;
        } catch (e) {
            if (i === attempts - 1) throw e;
        }
    }
}

test('mobile journey keeps wizard and wide tables usable', async ({ page }) => {
    test.setTimeout(240000);

    await page.goto('/index.html');
    await expect(page.locator('.dashboard-view, .dashboard-empty, #wizardContainer, .app-shell').first()).toBeVisible({ timeout: 15000 });

    // فحص تجاوز أفقي على مستوى الصفحة — الفحص الأصلي، يبقى كما هو كفحص إضافي لا بديل.
    const noPageOverflowOnLoad = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2);
    expect(noPageOverflowOnLoad).toBeTruthy();

    // نافذة ترحيب أول زيارة (DashboardView.maybeShowOnboarding) تُدرَج في document.body
    // بمعزل عن .app-shell فتبقى عالقة فوق المحتوى بعد إنشاء المشروع إن لم تُغلق أولاً.
    const onboardingDismiss = page.locator('#btnOnboardingDismiss');
    try {
        await onboardingDismiss.click({ timeout: 3000 });
    } catch (e) {
        // لم تظهر النافذة — لا شيء لإغلاقه
    }

    // إنشاء دراسة فارغة عبر نفس تسلسل critical_path.spec.js الحقيقي: «دراسة جديدة» ثم
    // معرض القوالب. اختيار «مشروع فارغ» صار خطوتين (TemplateGallery.renderBlankAttributionForm):
    // يعرض أولاً بطاقات اختيار مستوى التفصيل (مصغّر/بسيط/مفصّل) قبل إنشاء الدراسة فعلياً —
    // النقر القديم على بطاقة القالب فقط لم يعد يُغلق المعرض.
    const btnNew = page.locator('#btnNewProject, #btnNewProjectEmpty').filter({ hasText: 'دراسة جديدة' }).first();
    await expect(btnNew).toBeVisible({ timeout: 8000 });
    await btnNew.click();
    const galleryOverlay = page.locator('#templateGalleryOverlay');
    await expect(galleryOverlay).toBeVisible({ timeout: 8000 });
    await galleryOverlay.locator('#btnStartBlank').click();
    const advancedMode = page.locator('.mode-card[data-mode="advanced"]');
    await expect(advancedMode).toBeVisible({ timeout: 5000 });
    await advancedMode.click();
    await page.locator('#btnBlankCreate').click();
    await expect(galleryOverlay).not.toBeVisible({ timeout: 5000 });

    // الهبوط على معلومات المشروع؛ الخريطة المشتركة متاحة من كل خطوة بعد ذلك.
    await page.evaluate(() => { window.location.hash = '#/step/2'; });

    await expect(page.locator('#btnOpenStudyMap')).toBeVisible({ timeout: 20000 });
    // فسحة تسوية قصيرة بعد الهبوط على أول خطوة قياسية — التنقّل الأول لاحقاً هو
    // الأكثر عرضة للتعثّر إن بدأ أثناء إعادة رسم لم تستقر بعد.
    await page.waitForTimeout(800);

    // ── خطوة "مصادر الإيرادات": تغذّي القوائم المالية لاحقاً بإيراد > 0 ──
    await goToWizardStep(page, 'مصادر الإيرادات');
    await expect(page.locator('#table-revenueStreams')).toBeVisible({ timeout: 8000 });
    await page.waitForTimeout(400);

    await page.locator('#table-revenueStreams .btn-add-row').click();
    await page.waitForTimeout(400);
    const revenueRow = page.locator('#table-revenueStreams tr[data-row-index="0"]');
    await expect(revenueRow).toBeVisible();
    await fillTableCell(revenueRow, 'service', 'قهوة مقطرة');
    await page.waitForTimeout(400);
    await fillTableCell(revenueRow, 'avgPrice', '15');
    await page.waitForTimeout(400);
    await fillTableCell(revenueRow, 'customersPerMonth', '3000');
    await page.waitForTimeout(400);

    // ── خطوة "الأصول والتجهيزات": تغذّي القوائم المالية بـ capex > 0 (بدونه تظهر
    // رسالة "لا توجد بيانات استثمارات" بدل الجداول فعلياً) ──
    await goToWizardStep(page, 'الأصول والتجهيزات');
    await expect(page.locator('#table-equipment')).toBeVisible({ timeout: 8000 });
    await page.waitForTimeout(400);

    await page.locator('#table-equipment .btn-add-row').click();
    await page.waitForTimeout(400);
    const equipmentRow = page.locator('#table-equipment tr[data-row-index="0"]');
    await expect(equipmentRow).toBeVisible();
    await fillTableCell(equipmentRow, 'name', 'ماكينة قهوة');
    await page.waitForTimeout(400);
    await fillTableCell(equipmentRow, 'quantity', '1');
    await page.waitForTimeout(400);
    await fillTableCell(equipmentRow, 'price', '8000');
    await page.waitForTimeout(400);

    // ── خطوة "القوائم المالية التقديرية" (FinancialStatements.js): بوجود إيراد
    // واستثمار كافيين، تُعرض جداول قائمة الدخل/التدفقات النقدية/الميزانية العمومية
    // فعلاً بدل رسالة الخطأ — أول مرة تحوي .table-container.scrollable-x عناصر حقيقية. ──
    await goToWizardStep(page, 'القوائم المالية التقديرية');

    // لا تحذير بيانات ناقصة — يؤكد أن الإيراد والـ capex المُدخلين أعلاه سُجّلا فعلاً
    // في المتجر قبل وصولنا هنا (لا مجرد قيم محلية في الحقول لم تُحفظ).
    await expect(page.locator('.alert--warning')).toHaveCount(0);

    const wideTables = page.locator('.table-container.scrollable-x');
    await expect(wideTables.first()).toBeVisible({ timeout: 10000 });
    const tableCount = await wideTables.count();
    // FinancialStatements.js يُصدر ≥ 3 جداول عريضة (دخل، تدفقات نقدية، تدفقات ربع سنوية،
    // ميزانية عمومية) حين تتوفر بيانات كافية — عدد صفري هنا يعني رجوعاً لرسالة الخطأ.
    expect(tableCount).toBeGreaterThan(0);
    for (let i = 0; i < tableCount; i++) {
        await expect(wideTables.nth(i)).toHaveCSS('overflow-x', /auto|scroll/);
    }

    // فحص التجاوز الأفقي على مستوى الصفحة مكرَّر هنا عمداً — أوسع نقطة في الرحلة
    // (جداول مالية بعرض 6+ أعمدة على شاشة 393px) هي الأولى اختباراً لصحة overflow-x.
    const noPageOverflowAtEnd = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2);
    expect(noPageOverflowAtEnd).toBeTruthy();
});
