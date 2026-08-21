/**
 * مساعد تسجيل دخول مشترك لاختبارات e2e — تدقيق 2026-08-21 (قرار مالك): #/home صارت
 * تتطلب تسجيل دخول إلزامياً، فأي اختبار يتفاعل مع لوحة التحكم أو ينشئ دراسة يحتاج
 * تسجيل دخول أولاً (نافذة الدخول تُفتح تلقائياً عند تحميل الصفحة لزائر غير مسجَّل —
 * راجع app.js: routeToView، فرع '' | 'home' | HOME_PANEL_ROUTES).
 *
 * يتطلب E2E_CUSTOMER_EMAIL/E2E_CUSTOMER_PASSWORD (حساب مؤكَّد بريد فعلاً بالمشروع
 * الحيّ المربوط في .env المحلي — لا sandbox منفصلة). الاختبارات التي تستدعي هذا
 * المساعد يجب أن تتخطّى نفسها (test.skip) إن غابا، بنفس نمط payment_bank_transfer.spec.js.
 */
import { expect } from '@playwright/test';

export function hasE2ECredentials() {
    return !!(process.env.E2E_CUSTOMER_EMAIL && process.env.E2E_CUSTOMER_PASSWORD);
}

/**
 * يسجّل الدخول عبر نافذة المصادقة التي تُفتح تلقائياً على #/home لزائر غير مسجَّل.
 * يُستدعى مباشرة بعد page.goto('/index.html') (أو أي مسار مُدار عبر routeToView مثل
 * #/home) وقبل أي تفاعل مع عناصر لوحة التحكم (DashboardView) التي لم تعد تُرسَم إلا
 * بعد نجاح تسجيل الدخول.
 */
export async function loginTestUser(page) {
    const email = process.env.E2E_CUSTOMER_EMAIL;
    const password = process.env.E2E_CUSTOMER_PASSWORD;
    if (!email || !password) {
        throw new Error('loginTestUser: يتطلب E2E_CUSTOMER_EMAIL و E2E_CUSTOMER_PASSWORD — استخدم hasE2ECredentials() + test.skip قبل الاستدعاء');
    }
    const overlay = page.locator('#authModalOverlay');
    await expect(overlay).toBeVisible({ timeout: 15000 });
    await page.locator('#authEmail').fill(email);
    await page.locator('#authPassword').fill(password);
    await page.locator('#authBtnSignIn').click();
    await expect(overlay).not.toBeVisible({ timeout: 15000 });
    await handlePhoneGateIfPresent(page);
    await expect(page.locator('#dvAccountToggle')).toBeVisible({ timeout: 10000 });
}

/**
 * مستخدم يُنشأ يدوياً من لوحة Supabase (Authentication → Add user) بلا رقم جوال
 * يُواجَه بـCompletePhoneModal («أكمل حسابك») فور أول دخول (AuthGuard._continuePhoneGate).
 */
export async function handlePhoneGateIfPresent(page) {
    const overlay = page.locator('#completePhoneModalOverlay');
    if (await overlay.isVisible({ timeout: 4000 }).catch(() => false)) {
        await page.locator('#completePhoneInput').fill('0500000000');
        await page.locator('#completePhoneSubmit').click();
        await expect(overlay).not.toBeVisible({ timeout: 10000 });
    }
}
