// @ts-check
import { test, expect } from '@playwright/test';

test.describe('دورة حياة المشروع الكاملة', () => {
    test.beforeEach(async ({ page }) => {
        // Clear local storage and start fresh
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.reload();
    });

    test('يجب أن يكون المستخدم قادراً على إنشاء مشروع والوصول إلى لوحة القرار بنجاح', async ({ page }) => {
        // 1. بدء مشروع جديد
        await page.click('button:has-text("ابدأ دراستك الآن"), button:has-text("دراسة جديدة")');
        
        // 2. تعبئة المعلومات الأساسية (الخطوة 1)
        await page.fill('#projectName', 'مطعم اختباري E2E');
        await page.fill('#projectConcept', 'مطعم وجبات سريعة');
        await page.selectOption('#projectSector', 'food');
        await page.selectOption('#projectCity', 'الرياض');
        await page.click('button:has-text("التالي")');

        // 3. تحليل السوق (الخطوة 2)
        const nextBtn = page.locator('button:has-text("التالي")');
        await nextBtn.waitFor({ state: 'visible' });
        await nextBtn.click();

        // 4. الإيرادات (الخطوة 3)
        // إضافة مصدر إيراد واحد على الأقل لتجنب رسالة "لا توجد بيانات إيرادات"
        await page.waitForSelector('#btnAddRevenueStream');
        await page.click('#btnAddRevenueStream');
        
        // Modal for Revenue Stream appears
        const streamNameInput = page.locator('input[placeholder*="مثال: مبيعات الوجبات"]').first();
        await streamNameInput.waitFor({ state: 'visible' });
        await streamNameInput.fill('مبيعات الوجبات');
        
        // Assuming there are input fields for daily volume and ticket
        const volumeInputs = page.locator('input[type="number"]').nth(0);
        await volumeInputs.fill('100'); 
        const ticketInputs = page.locator('input[type="number"]').nth(1);
        await ticketInputs.fill('50'); 
        
        await page.click('.modal.is-active button:has-text("إضافة"), .modal.is-active button:has-text("حفظ")');

        await nextBtn.click();

        // 5. التكاليف المباشرة والتشغيلية (الخطوات 4، 5، 6)
        for(let i=0; i<3; i++) {
            await nextBtn.waitFor({ state: 'visible' });
            await nextBtn.click();
        }

        // 6. الهيكلة والتمويل (الخطوة الأخيرة)
        const finishBtn = page.locator('button:has-text("النتيجة النهائية"), button:has-text("لوحة القرار")').first();
        if (await finishBtn.isVisible()) {
            await finishBtn.click();
        } else {
            await nextBtn.click();
        }

        // 7. التحقق من ظهور لوحة القرار
        await expect(page.locator('.decision-dashboard')).toBeVisible({ timeout: 10000 });
        
        // التحقق من ظهور التقييم (Score)
        const scoreValue = page.locator('#scoreValue');
        await expect(scoreValue).toBeVisible();
        const scoreText = await scoreValue.innerText();
        expect(Number(scoreText)).toBeGreaterThanOrEqual(0);

        // التحقق من زر الحفظ
        const saveBtn = page.locator('#btnSaveStudy');
        await expect(saveBtn).toBeVisible();
    });
});
