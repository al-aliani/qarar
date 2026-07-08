const { test, expect } = require('@playwright/test');

test.describe('دورة دراسة الجدوى الكاملة', () => {
  test('يجب أن يكمل المستخدم دراسة كاملة بنجاح مع ظهور لوحة القرار', async ({ page }) => {
    // 1. الدخول للمنصة
    await page.goto('/');
    
    // 2. التحقق من تحميل الصفحة واسم المنصة
    await expect(page).toHaveTitle(/قرار/);
    
    // 3. تجاوز الشاشة الترحيبية (إذا وجدت) أو البدء بدراسة جديدة
    const startButton = page.locator('text="ابدأ دراسة جديدة"');
    if (await startButton.isVisible()) {
      await startButton.click();
    }
    
    // 4. تعبئة بيانات المشروع المبدئية
    // الانتظار حتى يظهر المعالج
    await page.waitForSelector('.wizard-container');
    
    // 5. التنقل عبر المراحل الأساسية للمعالج
    // نحتاج للضغط على "التالي" بشكل متكرر وتعبئة بعض الحقول لضمان عدم وجود أخطاء
    
    let hasNext = true;
    let stepCount = 0;
    while (hasNext && stepCount < 45) { // حد أقصى للخطوات لتجنب الحلقات اللانهائية
      stepCount++;
      
      // تفقد وجود حقول إجبارية في الشاشة الحالية يمكن تعبئتها
      const nameInput = page.locator('input[data-key="name"]');
      if (await nameInput.isVisible() && await nameInput.isEditable()) {
        await nameInput.fill('مشروع اختبار e2e');
      }

      const nextBtn = page.locator('#btnNextStep');
      if (await nextBtn.isVisible() && await nextBtn.isEnabled()) {
        await nextBtn.click();
        await page.waitForTimeout(300); // مهلة قصيرة لانتقال الخطوة
      } else {
        hasNext = false; // لا يوجد زر تالي أو غير مفعل
      }
    }
    
    // 6. التحقق من الوصول للوحة القرار (Dashboard)
    // نبحث عن النص "لوحة القرار الاستثماري" أو مؤشرات مالية
    await expect(page.locator('text="لوحة القرار الاستثماري"').first()).toBeVisible({ timeout: 10000 });
    
    // التحقق من وجود مؤشر NPV
    await expect(page.locator('text="NPV"').first()).toBeVisible();
    await expect(page.locator('text="IRR"').first()).toBeVisible();
  });
});
