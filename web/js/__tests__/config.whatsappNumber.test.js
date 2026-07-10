/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-09 (تعديلات ما قبل الإطلاق): WHATSAPP_NUMBER كان رقماً ثابتاً
 * مكرَّراً حرفياً في config.js وlanding.html معاً. صار يُشتقّ من مصدر واحد قابل
 * للتعديل (نفس أولوية القراءة المتّبعة في supabaseClient.js):
 * VITE_WHATSAPP_NUMBER (بناء) ← window.WHATSAPP_NUMBER (تشغيل، من
 * public/whatsapp-config.js) ← localStorage (تجاوز يدوي) ← شغرة + تحذير.
 * WHATSAPP_NUMBER يُحسَب مرة واحدة عند تحميل الوحدة، فكل اختبار هنا يستخدم
 * vi.resetModules() لإعادة تقييمه بحالة مختلفة.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('config.js — resolveWhatsAppNumber (أولوية المصادر)', () => {
    beforeEach(() => {
        vi.resetModules();
        delete window.WHATSAPP_NUMBER;
        localStorage.clear();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        delete window.WHATSAPP_NUMBER;
        localStorage.clear();
    });

    it('لا مصدر مضبوط: يعود للشغرة التوضيحية مع تحذير console', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { WHATSAPP_NUMBER } = await import('../config.js');
        expect(WHATSAPP_NUMBER).toBe('9665XXXXXXXX');
        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy.mock.calls[0][0]).toContain('واتساب الدعم غير مضبوط');
    });

    it('window.WHATSAPP_NUMBER مضبوط (public/whatsapp-config.js): يُستخدم فعلياً بلا تحذير', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        window.WHATSAPP_NUMBER = '966501234567';
        const { WHATSAPP_NUMBER } = await import('../config.js');
        expect(WHATSAPP_NUMBER).toBe('966501234567');
        expect(warnSpy).not.toHaveBeenCalled();
    });

    it('localStorage مضبوط (تجاوز يدوي محلي): يُستخدم إن غاب window', async () => {
        localStorage.setItem('WHATSAPP_NUMBER', '966509876543');
        const { WHATSAPP_NUMBER } = await import('../config.js');
        expect(WHATSAPP_NUMBER).toBe('966509876543');
    });

    it('window له الأولوية على localStorage', async () => {
        window.WHATSAPP_NUMBER = '966501111111';
        localStorage.setItem('WHATSAPP_NUMBER', '966502222222');
        const { WHATSAPP_NUMBER } = await import('../config.js');
        expect(WHATSAPP_NUMBER).toBe('966501111111');
    });

    it('VITE_WHATSAPP_NUMBER (متغيّر بيئة) له الأولوية على window وlocalStorage معاً', async () => {
        vi.stubEnv('VITE_WHATSAPP_NUMBER', '966503333333');
        window.WHATSAPP_NUMBER = '966501111111';
        const { WHATSAPP_NUMBER } = await import('../config.js');
        expect(WHATSAPP_NUMBER).toBe('966503333333');
    });

    it('قيمة غير رقمية بالكامل (شغرة كـ X) لا تُعتبر مضبوطة — تعود للشغرة الافتراضية', async () => {
        window.WHATSAPP_NUMBER = '9665XXXXXXXX';
        const { WHATSAPP_NUMBER } = await import('../config.js');
        expect(WHATSAPP_NUMBER).toBe('9665XXXXXXXX');
    });

    it('buildWhatsAppLink يستخدم الرقم المضبوط فعلياً في الرابط الناتج', async () => {
        window.WHATSAPP_NUMBER = '966501234567';
        const { buildWhatsAppLink } = await import('../config.js');
        const link = buildWhatsAppLink('رسالة تجريبية');
        expect(link).toContain('https://wa.me/966501234567?text=');
    });

    it('buildWhatsAppLink بلا رقم مضبوط: يُعيد null (تراجع رشيق) بدل رابط مكسور بلا مستلم', async () => {
        // تدقيق 2026-07-10: كان يُعيد https://wa.me/?text=... — رابط يفتح واتساب بلا أي
        // جهة اتصال محددة، يبدو للمستخدم كطلب لم يصل لأحد. المستدعي الآن مسؤول عن
        // إخفاء/تعطيل زر واتساب حين يُعاد null (انظر PaywallModal.js وPaymentReturnView.js).
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { buildWhatsAppLink } = await import('../config.js');
        const link = buildWhatsAppLink('رسالة تجريبية');
        expect(link).toBeNull();
    });
});
