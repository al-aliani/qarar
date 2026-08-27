/**
 * تدقيق 2026-08-27 (فحص شامل للموقع الحي): «جلسة شرح النتائج» (399 ﷼) كانت تُباع
 * كإضافة قابلة للاختيار في شاشة الدفع حتى لمشتري باقة «خدمة كاملة» (4,999) التي
 * تتضمنها أصلاً (PRICING_COMPARISON.full.includes في web/js/core/pricing.js).
 * إخفاء الإضافة في الواجهة وحده لا يكفي: create-checkout يحسب subtotal من
 * body.addons القادم من العميل مباشرة (pkg.price + addons.reduce(...))، فأي
 * تلاعب أو خلل في منطق الواجهة كان سيُحاسِب العميل 399 ﷼ إضافية فعلياً رغم
 * الشراء. selectedAddons أصبحت المرجع الوحيد الموثوق: تستبعد أي إضافة تحمل
 * includedIn تطابق باقة الطلب، بصرف النظر عمّا أرسله العميل.
 */
import { describe, it, expect } from 'vitest';
import { ADDONS, selectedAddons } from '../catalog.ts';

describe('catalog.ts — selectedAddons تستبعد الإضافات المشمولة في الباقة', () => {
    it('result_session مُعرَّفة بـincludedIn تحتوي full', () => {
        expect(ADDONS.result_session.includedIn).toContain('full');
    });

    it('طلب باقة full يستبعد result_session من الإجمالي حتى لو أرسلها العميل صراحة', () => {
        const result = selectedAddons(['result_session', 'priority_support'], 'full');
        expect(result.map((a) => a.id)).toEqual(['priority_support']);
    });

    it('نفس الإضافة تُحتسَب طبيعياً لباقة لا تتضمنها (reviewed)', () => {
        const result = selectedAddons(['result_session'], 'reviewed');
        expect(result.map((a) => a.id)).toEqual(['result_session']);
    });

    it('بلا packageId (استدعاء قديم) تبقى كل الإضافات المُرسَلة كما هي — لا كسر توافق خلفي', () => {
        const result = selectedAddons(['result_session', 'extra_review']);
        expect(result.map((a) => a.id).sort()).toEqual(['extra_review', 'result_session']);
    });

    it('[إثبات الحارس] إزالة تصفية includedIn تُعيد احتساب 399 ﷼ إضافية لمشتري full', () => {
        const withoutFilter = (ids) => [...new Set(ids.map(String))].map((id) => ADDONS[id]).filter(Boolean);
        const broken = withoutFilter(['result_session']);
        expect(broken.reduce((s, a) => s + a.price, 0)).toBe(399);
        // بينما النسخة المُصلَحة تستبعدها فعلياً لباقة full:
        expect(selectedAddons(['result_session'], 'full').reduce((s, a) => s + a.price, 0)).toBe(0);
    });
});
