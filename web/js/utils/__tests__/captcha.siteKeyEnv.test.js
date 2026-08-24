/**
 * @vitest-environment jsdom
 *
 * تدقيق أمني 2026-08-24: Site Key كان يُقرأ من window.RECAPTCHA_SITE_KEY أو
 * localStorage — أي مستخدم عادي يستطيع تغييره من متصفحه عبر صفحة التكاملات، رغم
 * أنه إعداد مركزي يحمي تسجيل الدخول لكل المستخدمين. صار يُقرأ فقط من
 * import.meta.env.VITE_RECAPTCHA_SITE_KEY وقت البناء (نفس نمط VITE_WHATSAPP_NUMBER
 * في config.js) — SITE_KEY يُحسَب مرة واحدة عند تحميل الوحدة، فكل اختبار هنا
 * يستخدم vi.resetModules() لإعادة تقييمه بحالة مختلفة.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('captcha.js — Site Key من VITE_RECAPTCHA_SITE_KEY فقط', () => {
    beforeEach(() => {
        vi.resetModules();
        delete window.RECAPTCHA_SITE_KEY;
        localStorage.clear();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        delete window.RECAPTCHA_SITE_KEY;
        localStorage.clear();
    });

    it('لا متغيّر بيئة مضبوط: isCaptchaConfigured() تعيد false', async () => {
        const { isCaptchaConfigured } = await import('../captcha.js');
        expect(isCaptchaConfigured()).toBe(false);
    });

    it('VITE_RECAPTCHA_SITE_KEY مضبوط: isCaptchaConfigured() تعيد true', async () => {
        vi.stubEnv('VITE_RECAPTCHA_SITE_KEY', '6Lc-test-key');
        const { isCaptchaConfigured } = await import('../captcha.js');
        expect(isCaptchaConfigured()).toBe(true);
    });

    it('window.RECAPTCHA_SITE_KEY لم يعد يُفعّل الحماية (الثغرة المُصلَحة)', async () => {
        window.RECAPTCHA_SITE_KEY = '6Lc-window-key';
        const { isCaptchaConfigured } = await import('../captcha.js');
        expect(isCaptchaConfigured()).toBe(false);
    });

    it('localStorage.RECAPTCHA_SITE_KEY لم يعد يُفعّل الحماية (الثغرة المُصلَحة)', async () => {
        localStorage.setItem('RECAPTCHA_SITE_KEY', '6Lc-localstorage-key');
        const { isCaptchaConfigured } = await import('../captcha.js');
        expect(isCaptchaConfigured()).toBe(false);
    });
});
