/**
 * classifyNitaqatTier (nitaqatBands.js) — تصنيف تقريبي مبسّط لنطاقات (Nitaqat)،
 * مهمة Nitaqat (دفعة 4). يثبّت: قيم غير صالحة تعيد null، وأن العتبات تختلف فعلياً
 * حسب مجموعة النشاط (sectorKey) لا نطاقاً واحداً ثابتاً للجميع.
 */
import { describe, it, expect } from 'vitest';
import { classifyNitaqatTier, NITAQAT_SIMPLIFIED_THRESHOLDS } from '../nitaqatBands.js';

describe('classifyNitaqatTier', () => {
    it('يعيد null لقيم غير صالحة (undefined/null/سالبة/غير رقمية)', () => {
        expect(classifyNitaqatTier(undefined, 'fnb')).toBeNull();
        expect(classifyNitaqatTier(null, 'fnb')).toBeNull();
        expect(classifyNitaqatTier(-0.1, 'fnb')).toBeNull();
        expect(classifyNitaqatTier('غير رقم', 'fnb')).toBeNull();
    });

    it('كل نتيجة تُفصح صراحة أنها تقريبية (isApproximate=true)', () => {
        const r = classifyNitaqatTier(0.3, 'fnb');
        expect(r.isApproximate).toBe(true);
    });

    describe('مجموعة "balanced" (مطاعم/تجزئة) — fnb', () => {
        it('نسبة أقل من العتبة الدنيا ⇒ أحمر وغير ملتزم', () => {
            const r = classifyNitaqatTier(0.05, 'fnb');
            expect(r.tier).toBe('red');
            expect(r.isCompliant).toBe(false);
        });
        it('نسبة عند العتبة الدنيا بالضبط ⇒ أخضر منخفض وملتزم', () => {
            const r = classifyNitaqatTier(0.10, 'fnb');
            expect(r.tier).toBe('lowGreen');
            expect(r.isCompliant).toBe(true);
        });
        it('نسبة متوسطة ⇒ أخضر متوسط', () => {
            expect(classifyNitaqatTier(0.20, 'fnb').tier).toBe('midGreen');
        });
        it('نسبة مرتفعة ⇒ أخضر مرتفع', () => {
            expect(classifyNitaqatTier(0.30, 'fnb').tier).toBe('highGreen');
        });
        it('نسبة عالية جداً ⇒ بلاتيني', () => {
            expect(classifyNitaqatTier(0.45, 'fnb').tier).toBe('platinum');
        });
    });

    it('مجموعة "laborLight" (صناعي/لوجستي) لها عتبات أدنى من "balanced" لنفس النسبة', () => {
        // 0.10 أحمر في fnb (balanced) لكن أخضر منخفض في industrial (laborLight) —
        // يثبت أن العتبات فعلاً تختلف حسب القطاع لا نطاقاً واحداً ثابتاً.
        expect(classifyNitaqatTier(0.10, 'fnb').tier).toBe('lowGreen');
        expect(classifyNitaqatTier(0.10, 'industrial').tier).not.toBe('red');
        expect(classifyNitaqatTier(0.05, 'industrial').tier).toBe('red');
        expect(classifyNitaqatTier(0.07, 'industrial').tier).toBe('lowGreen');
    });

    it('مجموعة "laborHeavy" (خدمي/SaaS) لها عتبات أعلى من "balanced" لنفس النسبة', () => {
        // 0.10 يقع أخضر منخفض في fnb لكن أحمر في service (عتبته الدنيا 0.15)
        expect(classifyNitaqatTier(0.10, 'service').tier).toBe('red');
        expect(classifyNitaqatTier(0.20, 'saas').tier).toBe('lowGreen');
    });

    it('sectorKey مجهول أو غير مطابق يستخدم المجموعة المتوازنة (balanced) افتراضياً', () => {
        const withUnknown = classifyNitaqatTier(0.20, 'not-a-real-sector');
        const withUndefined = classifyNitaqatTier(0.20, undefined);
        expect(withUnknown.tier).toBe('midGreen');
        expect(withUndefined.tier).toBe('midGreen');
        expect(withUnknown.minCompliantRate).toBe(NITAQAT_SIMPLIFIED_THRESHOLDS.balanced.lowGreen);
    });
});
