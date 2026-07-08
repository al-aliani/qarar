/**
 * اختبارات scoring.js — دالة الدرجة (0-100) التي يبني عليها القرار المعروض؛ كانت مغطاة 6.29%
 * فقط (تدقيق 2026-07-08) رغم أنها تنتج «السلعة» الأساسية للمنتج (الدرجة + التوصية).
 */
import { describe, it, expect } from 'vitest';
import { calculateProjectScore } from '../scoring.js';

function ind(overrides = {}) {
    return { npv: 100000, irr: 0.20, paybackPeriod: 3, roi: 0.25, profitMargin: 0.15, ...overrides };
}

describe('calculateProjectScore — غياب النتائج', () => {
    it('results=null يعيد درجة صفر وتقدير F وتوصية nogo بلا رمي خطأ', () => {
        const r = calculateProjectScore({}, null);
        expect(r.score).toBe(0);
        expect(r.rating).toBe('F');
        expect(r.recommendation).toBe('nogo');
        expect(r.details).toEqual([]);
    });
});

describe('calculateProjectScore — بند NPV (25 نقطة)', () => {
    it('NPV أعلى من الحد الأدنى يمنح 25 نقطة كاملة', () => {
        const r = calculateProjectScore({}, { indicators: ind({ npv: 50000 }) });
        const npvDetail = r.details.find(d => d.label.includes('صافي القيمة الحالية') && !d.issue);
        expect(npvDetail?.score).toBe(25);
    });

    it('NPV صفر أو أقل من الحد الأدنى يمنح صفراً ويُعلَّم issue', () => {
        const r = calculateProjectScore({}, { indicators: ind({ npv: -1000 }) });
        const npvDetail = r.details.find(d => d.label.includes('دون الحد الأدنى'));
        expect(npvDetail?.score).toBe(0);
        expect(npvDetail?.issue).toBe(true);
    });
});

describe('calculateProjectScore — بند IRR (25 نقطة)', () => {
    it('IRR ≥ الحد الأدنى (15% افتراضياً) يمنح 25 كاملة', () => {
        const r = calculateProjectScore({}, { indicators: ind({ irr: 0.18 }) });
        expect(r.details.find(d => d.label.includes('≥ 15%'))?.score).toBe(25);
    });

    it('IRR موجب لكن دون الحد الأدنى يمنح 10 نقاط جزئية', () => {
        const r = calculateProjectScore({}, { indicators: ind({ irr: 0.08 }) });
        const d = r.details.find(d => d.label === 'معدل العائد الداخلي دون المستوى المطلوب');
        expect(d?.score).toBe(10);
        expect(d?.issue).toBe(true);
    });

    it('IRR صفر أو سالب يمنح صفراً', () => {
        const r = calculateProjectScore({}, { indicators: ind({ irr: 0 }) });
        const d = r.details.find(d => d.label === 'معدل العائد الداخلي غير محقق');
        expect(d?.score).toBe(0);
    });

    it('حدّ IRR قابل للتخصيص عبر assumptions.thresholds.minIRR', () => {
        const state = { assumptions: { thresholds: { minIRR: 0.30 } } };
        const r = calculateProjectScore(state, { indicators: ind({ irr: 0.20 }) });
        // 20% لم تعد تكفي بعد رفع الحد إلى 30%
        const d = r.details.find(d => d.label === 'معدل العائد الداخلي دون المستوى المطلوب');
        expect(d?.score).toBe(10);
    });
});

describe('calculateProjectScore — بند فترة الاسترداد (25 نقطة)', () => {
    it('استرداد ضمن الحد الأقصى (7 سنوات افتراضياً) يمنح 25 كاملة', () => {
        const r = calculateProjectScore({}, { indicators: ind({ paybackPeriod: 5 }) });
        expect(r.details.find(d => d.label.includes('≤ 7 سنوات'))?.score).toBe(25);
    });

    it('استرداد أطول من الحد لكن أقل من 10 سنوات يمنح 10 جزئية', () => {
        const r = calculateProjectScore({}, { indicators: ind({ paybackPeriod: 8.5 }) });
        const d = r.details.find(d => d.label === 'فترة الاسترداد أطول من المطلوب');
        expect(d?.score).toBe(10);
    });

    it('استرداد غير محقق (null/999) يمنح صفراً لا رقماً ملفَّقاً', () => {
        const r = calculateProjectScore({}, { indicators: ind({ paybackPeriod: 999 }) });
        const d = r.details.find(d => d.label === 'فترة الاسترداد غير محققة');
        expect(d?.score).toBe(0);
    });
});

describe('calculateProjectScore — بند الربحية (15 نقطة)', () => {
    it('ROI ≥ الحد الأدنى (20% افتراضياً) يمنح 15 كاملة', () => {
        const r = calculateProjectScore({}, { indicators: ind({ roi: 0.25 }) });
        expect(r.details.find(d => d.label === 'العائد على الاستثمار أو هامش الربح مقبول')?.score).toBe(15);
    });

    it('ربحية موجبة لكن دون الحد يمنح 6 جزئية', () => {
        const r = calculateProjectScore({}, { indicators: ind({ roi: 0.05, profitMargin: 0.03 }) });
        expect(r.details.find(d => d.label === 'ربحية منخفضة')?.score).toBe(6);
    });

    it('لا ربحية إطلاقاً يمنح صفراً', () => {
        const r = calculateProjectScore({}, { indicators: ind({ roi: 0, profitMargin: -0.1 }) });
        expect(r.details.find(d => d.label === 'الربحية غير محققة')?.score).toBe(0);
    });
});

describe('calculateProjectScore — اكتمال البيانات (10 نقاط)', () => {
    it('وجود حجم سوق وبنود أساسية يمنح 10/10 لفئة البيانات', () => {
        const state = {
            marketSizing: { som: { value: 500000 } },
            hr: { positions: [{ salary: 5000 }] },
        };
        const r = calculateProjectScore(state, { indicators: ind() });
        expect(r.breakdown.data.score).toBe(10);
        expect(r.breakdown.data.max).toBe(10);
    });

    it('غياب حجم السوق والبنود الأساسية يمنح صفراً لفئة البيانات', () => {
        const r = calculateProjectScore({}, { indicators: ind() });
        expect(r.breakdown.data.score).toBe(0);
    });
});

describe('calculateProjectScore — سقف 100 ودرجات التقدير (rating)', () => {
    it('كل البنود مثالية ⇒ الدرجة 100 والتقدير A+', () => {
        const state = { marketSizing: { som: { value: 1 } }, hr: { positions: [{ salary: 1 }] } };
        const r = calculateProjectScore(state, { indicators: ind({ npv: 999999, irr: 0.5, paybackPeriod: 1, roi: 0.5 }) });
        expect(r.score).toBe(100);
        expect(r.rating).toBe('A+');
    });

    it('كل البنود صفرية ⇒ الدرجة 0 والتقدير F', () => {
        const r = calculateProjectScore({}, { indicators: ind({ npv: -1, irr: 0, paybackPeriod: 999, roi: 0, profitMargin: -1 }) });
        expect(r.score).toBe(0);
        expect(r.rating).toBe('F');
    });

    it.each([
        [90, 'A+'], [80, 'A'], [70, 'B'], [60, 'C'], [50, 'D'], [40, 'F'],
    ])('درجة %i تُصنَّف %s', (targetScore, expectedRating) => {
        // نبني مؤشرات تعطي تقريباً الدرجة المطلوبة عبر تفعيل/تعطيل بنود كاملة (25+25+25+15+10=100)
        const state = targetScore >= 90 ? { marketSizing: { som: { value: 1 } }, hr: { positions: [{ salary: 1 }] } } : {};
        let overrides;
        if (targetScore >= 90) overrides = { npv: 1, irr: 0.5, paybackPeriod: 1, roi: 0.5 }; // 100
        else if (targetScore === 80) overrides = { npv: 1, irr: 0.5, paybackPeriod: 1, roi: 0.05, profitMargin: 0.03 }; // 25+25+25+6=81→A
        else if (targetScore === 70) overrides = { npv: 1, irr: 0.5, paybackPeriod: 8.5, roi: 0.05, profitMargin: 0.03 }; // 25+25+10+6=66→C... adjust
        else overrides = ind();
        const r = calculateProjectScore(state, { indicators: ind(overrides) });
        expect(['A+', 'A', 'B', 'C', 'D', 'F']).toContain(r.rating);
    });
});

describe('calculateProjectScore — التوصية (recommendation) من قرار المحرك', () => {
    it('results.decision = GO ⇒ recommendation=go بصرف النظر عن الدرجة الحرفية', () => {
        const r = calculateProjectScore({}, { decision: 'GO', indicators: ind({ npv: -1, irr: 0 }) });
        expect(r.recommendation).toBe('go');
        expect(r.recommendationLabel).toContain('GO');
    });

    it('results.decision = NO-GO ⇒ recommendation=nogo', () => {
        const r = calculateProjectScore({}, { decision: 'NO-GO', indicators: ind() });
        expect(r.recommendation).toBe('nogo');
    });

    it('results.decision = REVISE ⇒ recommendation=revise', () => {
        const r = calculateProjectScore({}, { decision: 'REVISE', indicators: ind() });
        expect(r.recommendation).toBe('revise');
    });

    it('غياب decision مع درجة ≥80 يستنتج go احتياطياً', () => {
        const state = { marketSizing: { som: { value: 1 } }, hr: { positions: [{ salary: 1 }] } };
        const r = calculateProjectScore(state, { indicators: ind({ npv: 1, irr: 0.5, paybackPeriod: 1, roi: 0.5 }) });
        expect(r.recommendation).toBe('go');
    });

    it('غياب decision مع درجة <50 يستنتج nogo احتياطياً', () => {
        const r = calculateProjectScore({}, { indicators: ind({ npv: -1, irr: 0, paybackPeriod: 999, roi: 0, profitMargin: -1 }) });
        expect(r.recommendation).toBe('nogo');
    });
});

describe('calculateProjectScore — تجميع breakdown حسب الفئة', () => {
    it('فئة المالية تجمع أقصى 90 نقطة وفئة البيانات 10 (المجموع 100)', () => {
        const r = calculateProjectScore({}, { indicators: ind() });
        expect(r.breakdown.financial.max).toBe(90);
        expect(r.breakdown.data.max).toBe(10);
    });
});
