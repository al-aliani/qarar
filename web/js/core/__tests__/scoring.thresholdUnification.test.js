/**
 * تدقيق 2026-07-08 (ملاحظة متوسطة #7): scoring.js كانت تشتق عتبة فترة الاسترداد
 * الافتراضية محلياً (7 سنوات) بدل resolveDecisionThresholds الموحّدة في engine.js
 * (3.5 سنة فعلياً) — فتتناقض بطاقة تفاصيل التقييم مع شارة القرار الفعلية في نفس
 * شاشة لوحة القرار لنفس المشروع (استرداد 5 سنوات كان يظهر "محقَّق ✓" هنا بينما
 * القرار الفعلي REVISE بسببه بالضبط).
 * ملاحظة منخفضة #44: مسار احتياطي لحساب هامش الربح في نفس الملف كان يقسم على
 * (الإيرادات || 1) فيُنتج هامشاً غير منطقي عند إيراد صفري فعلي.
 */
import { describe, it, expect } from 'vitest';
import { calculateProjectScore } from '../scoring.js';
import { resolveDecisionThresholds } from '../engine.js';

function ind(overrides = {}) {
    return { npv: 100000, irr: 0.20, paybackPeriod: 3, roi: 0.25, profitMargin: 0.15, ...overrides };
}

describe('calculateProjectScore — عتبة الاسترداد موحّدة مع resolveDecisionThresholds (#7)', () => {
    it('الحد الافتراضي (بلا state.assumptions.thresholds) يطابق 3.5 سنة من resolveDecisionThresholds تماماً', () => {
        expect(resolveDecisionThresholds().maxPayback).toBe(3.5);
        const r = calculateProjectScore({}, { indicators: ind({ paybackPeriod: 3.5 }) });
        expect(r.details.find(d => d.label.includes('≤ 3.5 سنوات'))?.score).toBe(25);
    });

    it('استرداد 5 سنوات (بين 3.5 الفعلية و7 القديمة الخاطئة) لا يُمنح 25 كاملة بعد الإصلاح', () => {
        const r = calculateProjectScore({}, { indicators: ind({ paybackPeriod: 5 }) });
        const fullMarks = r.details.find(d => d.label.includes('≤ 3.5 سنوات'));
        expect(fullMarks).toBeUndefined();
        const partial = r.details.find(d => d.label === 'فترة الاسترداد أطول من المطلوب');
        expect(partial?.score).toBe(10);
    });

    it('يقرأ results.assumptionsApplied.thresholds المُحلَّلة فعلياً من المحرك أولاً (لا يُعيد اشتقاقها)', () => {
        const r = calculateProjectScore({}, {
            indicators: ind({ paybackPeriod: 6 }),
            assumptionsApplied: { thresholds: { minNPV: 0, minIRR: 0.15, maxPayback: 7, minROI: 0.20 } }
        });
        // 6 ≤ 7 (العتبة المُمرَّرة من نتيجة المحرك) ⇒ يجب أن يُمنح كاملاً رغم أن الافتراضي العام 3.5
        expect(r.details.find(d => d.label.includes('≤ 7 سنوات'))?.score).toBe(25);
    });

    it('العتبة المخصَّصة عبر state.assumptions.thresholds.maxPayback (بلا assumptionsApplied) تُحترَم', () => {
        const state = { assumptions: { thresholds: { maxPayback: 10 } } };
        const r = calculateProjectScore(state, { indicators: ind({ paybackPeriod: 8 }) });
        expect(r.details.find(d => d.label.includes('≤ 10 سنوات'))?.score).toBe(25);
    });
});

describe('calculateProjectScore — هامش الربح الاحتياطي لا يُنتج قيمة غير منطقية عند إيراد صفري (#44)', () => {
    it('إيراد صفري فعلي مع صافي دخل موجب (بيانات شاذة): الهامش الاحتياطي = 0 لا رقماً متضخماً يُصنَّف زوراً "مقبولاً"', () => {
        const r = calculateProjectScore({}, {
            indicators: { npv: 0, irr: 0, paybackPeriod: 999, roi: 0 }, // profitMargin غائب عمداً لتفعيل المسار الاحتياطي
            incomeStatement: [{ revenue: 0, netIncome: 50000 }]
        });
        // بدون الإصلاح: هامش = 50000/(0||1) = 50000 (٪5,000,000) > 0.1 ⇒ يُصنَّف "ربحية منخفضة" (6 نقاط) زوراً
        // بعد الإصلاح: هامش = 0 (إيراد صفري ⇒ لا حساب منطقي) فيُصنَّف "الربحية غير محققة" (0 نقطة)
        const zero = r.details.find(dd => dd.label === 'الربحية غير محققة');
        expect(zero?.score).toBe(0);
        const inflated = r.details.find(dd => dd.label === 'ربحية منخفضة');
        expect(inflated).toBeUndefined();
    });

    it('إيراد موجب حقيقي لا يزال يحسب الهامش الاحتياطي بشكل صحيح كما كان', () => {
        const r = calculateProjectScore({}, {
            indicators: { npv: 0, irr: 0, paybackPeriod: 999, roi: 0 },
            incomeStatement: [{ revenue: 100000, netIncome: 20000 }]
        });
        // هامش = 20000/100000 = 0.20 ≥ افتراض minROI (لكن roi=0 فالفرع المُفعَّل margin>0.1) ⇒ نقاط جزئية على الأقل
        const zero = r.details.find(dd => dd.label === 'الربحية غير محققة');
        expect(zero).toBeUndefined();
    });
});
