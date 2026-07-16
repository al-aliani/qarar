// @ts-check
import { test, expect } from '@playwright/test';

test.describe('دورة حياة المشروع الكاملة', () => {
    test.beforeEach(async ({ page }) => {
        // Clear local storage and start fresh
        await page.addInitScript(() => localStorage.setItem('tour_category0_seen', 'true'));
        await page.goto('/index.html');
        await page.evaluate(() => localStorage.clear());
        await page.reload();
    });

    test('يجب أن يكون المستخدم قادراً على إنشاء مشروع والوصول إلى لوحة القرار بنجاح', async ({ page }) => {
        // تدقيق 2026-07-15: كان يعتمد على معالج تسلسلي قديم بحقول #projectName/
        // #projectSector ومودال منفصل لإضافة الإيرادات — استُبدل بنظام تصنيفات
        // (StudyCategoryView) وجداول DynamicTable مضمّنة مباشرة في الصفحة.

        // 1. بدء مشروع جديد (فارغ، مستوى مفصّل)
        const btnNew = page.locator('#btnNewProjectEmpty, #cardFullStudy').first();
        await btnNew.waitFor({ state: 'visible', timeout: 10000 });
        await btnNew.click();
        await expect(page.locator('#templateGalleryOverlay')).toBeVisible({ timeout: 8000 });
        const galleryOverlay = page.locator('#templateGalleryOverlay');
        await galleryOverlay.locator('#btnStartBlank').click();
        const advancedMode = galleryOverlay.locator('.mode-card[data-mode="advanced"]');
        if (await advancedMode.isVisible().catch(() => false)) {
            await advancedMode.click();
            await galleryOverlay.locator('#btnBlankCreate').click();
        }
        await expect(galleryOverlay).not.toBeVisible({ timeout: 5000 });

        // 2. تعبئة المعلومات الأساسية (تصنيف "التحقق والتعريف")
        const nameInput = page.locator('#field-name');
        await nameInput.waitFor({ state: 'visible', timeout: 10000 });
        await nameInput.fill('مطعم اختباري E2E');
        const conceptSelect = page.locator('#field-concept');
        if (await conceptSelect.isVisible().catch(() => false)) {
            await conceptSelect.selectOption({ label: 'مطعم' }).catch(() => {});
        }
        const cityInput = page.locator('#field-city');
        if (await cityInput.isVisible().catch(() => false)) {
            await cityInput.fill('الرياض');
        }
        await nameInput.blur();

        // 3. الانتقال لتصنيف "السوق والإيرادات" وإضافة مصدر إيراد
        await page.locator('nav[aria-label="فئات الدراسة"] button', { hasText: 'السوق والإيرادات' }).click();
        const revenueTable = page.locator('[data-table-id="revenueStreams"]');
        await expect(revenueTable).toBeVisible({ timeout: 10000 });
        await revenueTable.locator('button', { hasText: 'إضافة بند' }).first().click();
        await revenueTable.locator('input[data-col="service"]').first().fill('مبيعات الوجبات');
        await revenueTable.locator('input[data-col="avgPrice"]').first().fill('50');
        const customersInput = revenueTable.locator('input[data-col="customersPerMonth"]').first();
        await customersInput.fill('3000');
        await customersInput.blur();

        // 4. الانتقال مباشرة لتصنيف "النتائج والمتابعة"
        await page.locator('nav[aria-label="فئات الدراسة"] button', { hasText: 'النتائج والمتابعة' }).click();

        // 5. التحقق من ظهور لوحة القرار والتقييم
        await expect(page.locator('.decision-dashboard').first()).toBeVisible({ timeout: 10000 });
        // data-value يحمل الرقم الحقيقي الثابت؛ innerText قد يُقرأ أثناء تحريك عداد
        // (CountUp) لم يكتمل بعد فيُرجع قيمة انتقالية غير رقمية.
        const scoreValue = page.locator('#scoreValue:visible').first();
        await expect(scoreValue).toBeVisible();
        const scoreValueAttr = await scoreValue.getAttribute('data-value');
        expect(Number(scoreValueAttr)).toBeGreaterThanOrEqual(0);

        // التحقق من زر الحفظ (ظاهر داخل لوحة القرار وفي الترويسة معاً؛ :visible يتجنّب النسخة المخفية في .sidebar)
        const saveBtn = page.locator('#btnSaveStudy:visible, #headerSaveStudy:visible').first();
        await expect(saveBtn).toBeVisible();
    });
});
