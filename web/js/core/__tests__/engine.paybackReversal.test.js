/**
 * عيبان مستقلان في engine.js (2026-08-25):
 *
 * (أ) فترة الاسترداد كانت تُسجَّل عند **أول** عبور للتراكمي فوق الصفر ولا تُلغى إن عاد
 *     التراكمي سالباً ولم يتعافَ حتى نهاية الأفق. مشروع تضخّم تكاليفه 20% مقابل نمو
 *     إيراد 2% يعبر في السنة الأولى ثم ينهار — كان يعرض «0.8 سنة» في الملخص التنفيذي
 *     وتقرير الممول (أقوى مؤشر في الصفحة) ويمرّر passPayback في بوابة القرار رغم NPV سالب.
 *
 * (ب) `|| افتراضي` كان يبتلع الصفر الصريح في inflationRate/discountRate: مستخدم يختار
 *     «بلا تضخم» أو «معدل خصم 0» كان يحصل على نتائج مطابقة حرفياً لـ2% / 10%. نفس الفخ
 *     الذي تحذّر منه rateOrDefault المُصدَّرة في الملف نفسه (كانت للفائدة/الإهلاك فقط).
 *     projectionYears يبقى بحارس `> 0` منفصل — أفق صفر أو سالب غير منطقي.
 */
import { describe, it, expect } from 'vitest';
import { calculateStudy } from '../engine.js';
import { SECTIONS } from '../schema.js';

function makeStudy({ inflationRate = 0.02, growthRate = 0.02, projectionYears = 10, discountRate = 0.10 } = {}) {
    return {
        [SECTIONS.PROJECT_INFO]: { businessModel: 'Independent' },
        assumptions: { projectionYears, discountRate, inflationRate },
        [SECTIONS.TECHNICAL]: {
            equipment: [{ price: 300000, quantity: 1 }],
            buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: []
        },
        [SECTIONS.HR]: { positions: [{ salary: 8000, count: 4, months: 12 }] },
        [SECTIONS.LOGISTICS]: { logistics: [] },
        [SECTIONS.ADMINISTRATIVE]: { administrative: [{ name: 'إيجار', monthlyCost: 15000 }] },
        [SECTIONS.MARKETING]: { campaigns: [] },
        [SECTIONS.REVENUE]: {
            streams: [{ type: 'operating', customersPerMonth: 1500, avgPrice: 100, variableCostRate: 0.30, wasteRate: 0, growthRate }]
        },
        [SECTIONS.SERVICES]: { items: [] },
        [SECTIONS.FINANCING]: { sources: {} },
        [SECTIONS.TECH_RESOURCES]: { techResources: [] },
        [SECTIONS.LEGAL]: { licenses: [] }
    };
}

/** السلسلة التراكمية للتدفق النقدي بنفس بناء المحرك: سنة الصفر = حصة المالك النقدية. */
function cumulativeSeries(r) {
    let cum = -r.financingCheck.equityOutlay;
    const out = [cum];
    for (const y of r.incomeStatement) { cum += y.cashFlow; out.push(cum); }
    return out;
}

describe('(أ) المحرك — فترة استرداد تنتكس إلى السالب لا تُعتمد', () => {
    it('عبور ثم انتكاس (تضخم 20% مقابل نمو 2%): paybackPeriod = null رغم عبور السنة الأولى', () => {
        const r = calculateStudy(makeStudy({ inflationRate: 0.20, growthRate: 0.02 }));
        const cum = cumulativeSeries(r);

        // شرط السيناريو: يعبر الصفر مبكراً ثم يعود سالباً ولا يتعافى حتى نهاية الأفق.
        expect(cum[0]).toBeLessThan(0);
        expect(cum[1]).toBeGreaterThan(0);          // عبَر في السنة الأولى
        expect(cum[cum.length - 1]).toBeLessThan(0); // وانتهى الأفق سالباً
        expect(r.indicators.npv).toBeLessThan(0);

        expect(r.indicators.paybackPeriod).toBeNull();
        expect(r.indicators.payback).toBeNull();
        expect(r.indicators.discountedPaybackPeriod).toBeNull();
        expect(r.indicators.paybackReason).toBe('reverted_to_negative');
    });

    it('بوابة القرار لا تمرّر passPayback لمشروع منتكس (لا GO، وسبب صريح)', () => {
        const r = calculateStudy(makeStudy({ inflationRate: 0.20, growthRate: 0.02 }));
        expect(r.decision).not.toBe('GO');
        expect(r.decisionReasons).toContain('رأس المال لا يُسترد خلال سنوات الدراسة');
    });

    it('عبور ويبقى موجباً حتى النهاية: رقم صحيح لا null', () => {
        const r = calculateStudy(makeStudy({ inflationRate: 0.02, growthRate: 0.02 }));
        const cum = cumulativeSeries(r);
        expect(cum[0]).toBeLessThan(0);
        expect(Math.min(...cum.slice(1))).toBeGreaterThan(0); // كل السنوات بعد العبور موجبة

        expect(r.indicators.paybackPeriod).toBeGreaterThan(0);
        expect(Number.isFinite(r.indicators.paybackPeriod)).toBe(true);
        expect(r.indicators.paybackReason).toBeNull();

        // نقطة العبور محسوبة من التراكمي نفسه: (سنة−1) + |التراكمي السابق| ÷ تدفق السنة
        const expected = 0 + Math.abs(cum[0]) / r.incomeStatement[0].cashFlow;
        expect(r.indicators.paybackPeriod).toBeCloseTo(expected, 10);
    });

    it('لا يعبر الصفر إطلاقاً: null بسبب never_recovered (تمييز عن الانتكاس)', () => {
        // إيراد ضئيل جداً أمام تكاليف ثابتة ⟶ تدفقات سالبة كل السنوات، لا عبور أصلاً.
        const study = makeStudy();
        study[SECTIONS.REVENUE].streams[0].customersPerMonth = 10;
        const r = calculateStudy(study);
        expect(Math.max(...cumulativeSeries(r))).toBeLessThan(0);
        expect(r.indicators.paybackPeriod).toBeNull();
        expect(r.indicators.paybackReason).toBe('never_recovered');
    });
});

describe('(ب) المحرك — الصفر الصريح في التضخم/معدل الخصم يُحترم', () => {
    it('inflationRate = 0 ينتج نتائج مختلفة عن 0.02 (لم تعد تُستبدل صمتاً)', () => {
        const zero = calculateStudy(makeStudy({ inflationRate: 0 }));
        const two = calculateStudy(makeStudy({ inflationRate: 0.02 }));

        // بلا تضخم: التكاليف الثابتة لا تتصاعد ⟶ costInflation = 1 كل سنة ⟶ ربح أعلى.
        expect(zero.indicators.npv).not.toBe(two.indicators.npv);
        expect(zero.indicators.npv).toBeGreaterThan(two.indicators.npv);

        // السنة 1 متطابقة حتماً (costInflation = (1+g)^0 = 1 مهما كان g)، والفرق يبدأ من السنة 2.
        expect(zero.incomeStatement[0].fixedCosts).toBeCloseTo(two.incomeStatement[0].fixedCosts, 6);
        expect(zero.incomeStatement[1].fixedCosts).toBeLessThan(two.incomeStatement[1].fixedCosts);
        // السنة 2 بلا تضخم = السنة 1 نفسها بالضبط (لا معامل تصاعد)
        expect(zero.incomeStatement[1].fixedCosts).toBeCloseTo(zero.incomeStatement[0].fixedCosts, 6);
        // ومع 2%: السنة 2 = السنة 1 × 1.02 حرفياً
        expect(two.incomeStatement[1].fixedCosts).toBeCloseTo(two.incomeStatement[0].fixedCosts * 1.02, 6);

        expect(zero.assumptionsApplied.inflationRate).toBe(0);
    });

    it('discountRate = 0 ينتج نتائج مختلفة عن 0.10 (NPV بلا خصم = مجموع التدفقات)', () => {
        const zero = calculateStudy(makeStudy({ discountRate: 0 }));
        const ten = calculateStudy(makeStudy({ discountRate: 0.10 }));

        expect(zero.indicators.npv).not.toBe(ten.indicators.npv);
        // بمعدل خصم 0 (وبلا علاوة مخاطر — لا مخاطر/SWOT في هذه الدراسة) يصبح NPV
        // مجموع السلسلة الحسابي: −حصة المالك + Σ التدفقات السنوية = آخر قيمة تراكمية.
        const cum = cumulativeSeries(zero);
        expect(zero.indicators.npv).toBeCloseTo(cum[cum.length - 1], 6);
        expect(zero.indicators.npv).toBeGreaterThan(ten.indicators.npv); // تدفقات موجبة ⟹ خصم أقل = قيمة أعلى
    });

    it('projectionYears يبقى بحارس > 0: الصفر والسالب يعودان للافتراضي 5', () => {
        expect(calculateStudy(makeStudy({ projectionYears: 0 })).incomeStatement).toHaveLength(5);
        expect(calculateStudy(makeStudy({ projectionYears: -3 })).incomeStatement).toHaveLength(5);
        expect(calculateStudy(makeStudy({ projectionYears: 7 })).incomeStatement).toHaveLength(7);
    });
});
