import { test, expect } from '@playwright/test';

test.describe('دورة دراسة الجدوى الكاملة', () => {
  test('يجب أن يكمل المستخدم دراسة كاملة بنجاح مع ظهور لوحة القرار', async ({ page }) => {
    // تدقيق 2026-07-15: هذا الاختبار كان يعتمد على معالج تسلسلي قديم (#btnNextStep
    // يتقدّم خطوة-خطوة عبر 45 خطوة) — استُبدل بنظام تنقّل بالتصنيفات (8 تصنيفات،
    // كل تصنيف يعرض كل خطواته دفعة واحدة). النص الحرفي "NPV"/"IRR" أيضاً لم يعد
    // يظهر لأن حارس التعريب في app.js يستبدله بمصطلحات عربية.
    await page.addInitScript(() => localStorage.setItem('tour_category0_seen', 'true'));

    // 1. الدخول للمنصة
    await page.goto('/index.html');
    await expect(page).toHaveTitle(/قرار|جدوى/);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#wizardContainer')).not.toBeEmpty();

    // 2. إنشاء دراسة جديدة (فارغة، مستوى مفصّل)
    const btnNew = page.locator('#btnNewProjectEmpty, #cardFullStudy').first();
    if (await btnNew.isVisible().catch(() => false)) {
      await btnNew.click();
      await expect(page.locator('#templateGalleryOverlay')).toBeVisible({ timeout: 8000 });
    }
    const galleryOverlay = page.locator('#templateGalleryOverlay');
    if (await galleryOverlay.isVisible().catch(() => false)) {
      await galleryOverlay.locator('.template-card[data-id="empty"]').click();
      const advancedMode = galleryOverlay.locator('.mode-card[data-mode="advanced"]');
      if (await advancedMode.isVisible().catch(() => false)) {
        await advancedMode.click();
        await galleryOverlay.locator('#btnBlankCreate').click();
      }
      await expect(galleryOverlay).not.toBeVisible({ timeout: 5000 });
    }

    // 3. تعبئة اسم المشروع (تصنيف "التحقق والتعريف" هو المعروض افتراضياً بعد الإنشاء)
    const nameInput = page.locator('#field-name');
    await nameInput.waitFor({ state: 'visible', timeout: 10000 });
    await nameInput.fill('مشروع اختبار e2e');
    await nameInput.blur();

    // 4. الانتقال مباشرة لتصنيف "النتائج والمتابعة" والتحقق من ظهور لوحة القرار
    await page.locator('nav[aria-label="فئات الدراسة"] button', { hasText: 'النتائج والمتابعة' }).click();
    await expect(page.locator('h2', { hasText: 'لوحة القرار الاستثماري' })).toBeVisible({ timeout: 10000 });

    // 5. التحقق من ظهور مؤشرات مالية فعلية (بالمصطلح العربي بعد التعريب)
    await expect(page.locator('text=صافي القيمة الحالية').first()).toBeVisible();
    await expect(page.locator('text=العائد الداخلي').first()).toBeVisible();
  });
});
