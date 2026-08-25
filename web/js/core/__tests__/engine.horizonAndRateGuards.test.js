/**
 * حرّاس المدخلات الرقمية في calculateStudy (تصحيح 2026-08-25) — ثلاثة مدخلات كان بإمكان
 * قيمة واحدة فيها أن تُفرغ الدراسة أو تُنتج قراراً كاذباً:
 *
 * 1) projectionYears: الحارس كان `> 0` بينما تعليقه يدّعي منع «أفق الصفر». 0.5 و0.9
 *    و"0.03" كلها تمرّ ⟹ `for (i = 1; i <= years; i++)` لا تدور ولا مرة ⟹
 *    incomeStatement فارغ وكل المؤشرات صفر/null. الآن `>= 1` مع Math.floor للكسور.
 *
 * 2) discountRate = −1 ⟹ `Math.pow(1 + r, i) = 0` ⟹ معامل الخصم = Infinity ⟹
 *    NPV = Infinity ⟹ القرار «امضِ» لأي مشروع مهما كانت خسائره. CentralAssumptionsView
 *    تقصّ بـMath.max(0, …) لكن Wizard.updateStore لا تقصّ، فالحدّ يُفرض في المحرك.
 *    الصفر يبقى مقبولاً عمداً (مقارنة اسمية يطلبها المستخدم — تصحيح 052c6ef).
 *
 * 3) inflationRate ≤ −1: لا ينفجر إلى Infinity (لا يدخل مقاماً قط) لكنه ينهار بصمت —
 *    عند −1 بالضبط يصبح معامل تصاعد التكاليف صفراً فتختفي كل التكاليف من السنة الثانية
 *    فصاعداً (تشغيل مجاني ⟹ أرباح وهمية)، وتحت −1 يتناوب بين موجب وسالب.
 *    الانكماش المعتدل (−2%) يبقى مقبولاً لأنه سيناريو اقتصادي مشروع.
 */
import { describe, it, expect } from 'vitest';
import { calculateStudy } from '../engine.js';
import { SECTIONS } from '../schema.js';

const DEFAULT_YEARS = 5;
const DEFAULT_DISCOUNT_RATE = 0.10;
const DEFAULT_INFLATION = 0.02;

function makeStudy(assumptions = {}) {
    return {
        [SECTIONS.PROJECT_INFO]: { businessModel: 'Independent' },
        assumptions: { projectionYears: 5, discountRate: 0.10, inflationRate: 0, ...assumptions },
        [SECTIONS.TECHNICAL]: {
            equipment: [{ price: 100000, quantity: 1 }],
            buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: []
        },
        [SECTIONS.HR]: { positions: [] },
        [SECTIONS.LOGISTICS]: { logistics: [] },
        [SECTIONS.ADMINISTRATIVE]: { administrative: [{ name: 'إيجار', monthly: 8000 }] },
        [SECTIONS.MARKETING]: { campaigns: [] },
        [SECTIONS.REVENUE]: {
            streams: [{ type: 'operating', customersPerMonth: 300, avgPrice: 100, variableCostRate: 0.35, growthRate: 0 }]
        },
        [SECTIONS.SERVICES]: { items: [] },
        [SECTIONS.FINANCING]: { sources: {} },
        [SECTIONS.TECH_RESOURCES]: { techResources: [] },
        [SECTIONS.LEGAL]: { licenses: [] }
    };
}

describe('المحرك — حارس أفق الدراسة (projectionYears)', () => {
    it('كسر دون سنة كاملة (0.5 / 0.9 / "0.03" / 0 / سالب / نص): يسقط للافتراضي 5 سنوات', () => {
        for (const py of [0.5, 0.9, '0.03', 0.999999, 0, -3, 'abc', null, undefined, NaN]) {
            const r = calculateStudy(makeStudy({ projectionYears: py }));
            expect(r.incomeStatement.length, `projectionYears=${String(py)}`).toBe(DEFAULT_YEARS);
            // العيب الفعلي الذي كان يُنتجه أفق الصفر: قوائم فارغة ومؤشرات ميتة
            expect(r.incomeStatement.length).toBeGreaterThan(0);
            expect(Number.isFinite(r.indicators.npv)).toBe(true);
            expect(r.indicators.npv).not.toBe(0);
        }
    });

    it('كسر فوق سنة: يُقطع لأسفل عمداً (2.5 ⟹ سنتان، 4.99 ⟹ 4) — القوائم سنوية بحكم البناء', () => {
        expect(calculateStudy(makeStudy({ projectionYears: 2.5 })).incomeStatement.length).toBe(2);
        expect(calculateStudy(makeStudy({ projectionYears: 4.99 })).incomeStatement.length).toBe(4);
        expect(calculateStudy(makeStudy({ projectionYears: 1.0001 })).incomeStatement.length).toBe(1);
    });

    it('الأعداد الصحيحة الصالحة تمرّ كما هي (الحارس لا يزيح المدخلات السليمة)', () => {
        for (const py of [1, 3, 7, 10]) {
            expect(calculateStudy(makeStudy({ projectionYears: py })).incomeStatement.length).toBe(py);
        }
    });
});

describe('المحرك — حارس معدل الخصم السالب', () => {
    it('discountRate = −1: لا Infinity ولا قرار «امضِ» مجاني — يسقط للافتراضي 10%', () => {
        const r = calculateStudy(makeStudy({ discountRate: -1 }));
        expect(Number.isFinite(r.indicators.npv)).toBe(true);
        expect(r.indicators.npv).not.toBe(Infinity);
        expect(r.assumptionsApplied.discountRate).toBeCloseTo(DEFAULT_DISCOUNT_RATE, 10);
        // مطابق حرفياً لتشغيل المعدل الافتراضي — لا أثر متبقٍّ للمدخل المرفوض
        expect(r.indicators.npv).toBeCloseTo(calculateStudy(makeStudy({ discountRate: 0.10 })).indicators.npv, 6);
    });

    it('أي معدل خصم سالب آخر يُرفض كذلك (الريال المستقبلي لا يكون أثمن من الحاضر)', () => {
        for (const dr of [-0.5, -0.01, -2, -1e9]) {
            const r = calculateStudy(makeStudy({ discountRate: dr }));
            expect(r.assumptionsApplied.discountRate, `discountRate=${dr}`).toBeCloseTo(DEFAULT_DISCOUNT_RATE, 10);
            expect(Number.isFinite(r.indicators.npv)).toBe(true);
        }
    });

    it('الصفر يبقى مقبولاً (مقارنة اسمية صريحة): NPV غير مخصوم ويختلف عن افتراضي 10%', () => {
        const zero = calculateStudy(makeStudy({ discountRate: 0 }));
        const ten = calculateStudy(makeStudy({ discountRate: 0.10 }));
        expect(zero.assumptionsApplied.discountRate).toBe(0);
        expect(Number.isFinite(zero.indicators.npv)).toBe(true);
        expect(zero.indicators.npv).toBeGreaterThan(ten.indicators.npv);
    });

    it('تكلفة حقوق الملكية السالبة تُرفض أيضاً (المسار الثاني للمعدل) وتسقط لافتراضيها 15%', () => {
        const study = makeStudy({ useWaccAsDiscountRate: true });
        study.financing = { costOfEquity: -1 };
        const r = calculateStudy(study);
        expect(r.assumptionsApplied.discountRateSource).toBe('costOfEquity');
        expect(r.assumptionsApplied.discountRate).toBeCloseTo(0.15, 10);
        expect(Number.isFinite(r.indicators.npv)).toBe(true);
    });
});

describe('المحرك — حارس التضخم ≤ −1', () => {
    it('inflationRate = −1: التكاليف لا تختفي من السنة الثانية — يسقط للافتراضي 2%', () => {
        const r = calculateStudy(makeStudy({ inflationRate: -1 }));
        expect(r.assumptionsApplied.inflationRate).toBeCloseTo(DEFAULT_INFLATION, 10);
        // العيب: معامل التكلفة = Math.pow(1 + (−1), 2) = 0 ⟹ ثوابت السنة الثالثة = 0
        expect(r.incomeStatement[2].fixedCosts).toBeGreaterThan(0);
    });

    it('inflationRate < −1: لا تكاليف متناوبة الإشارة — يسقط للافتراضي 2%', () => {
        for (const inf of [-1.5, -2, -10]) {
            const r = calculateStudy(makeStudy({ inflationRate: inf }));
            expect(r.assumptionsApplied.inflationRate, `inflationRate=${inf}`).toBeCloseTo(DEFAULT_INFLATION, 10);
            r.incomeStatement.forEach(y => expect(y.fixedCosts).toBeGreaterThan(0));
        }
    });

    it('الانكماش المعتدل والصفر يبقيان مقبولين (سيناريوهات مشروعة لا فراغ)', () => {
        const deflation = calculateStudy(makeStudy({ inflationRate: -0.02 }));
        expect(deflation.assumptionsApplied.inflationRate).toBeCloseTo(-0.02, 10);
        // تكاليف السنة الثالثة تنكمش لكنها تبقى موجبة: 96,000 × 0.98² = 92,198.4
        expect(deflation.incomeStatement[2].fixedCosts).toBeGreaterThan(0);
        expect(deflation.incomeStatement[2].fixedCosts).toBeLessThan(deflation.incomeStatement[0].fixedCosts);

        const zero = calculateStudy(makeStudy({ inflationRate: 0 }));
        expect(zero.assumptionsApplied.inflationRate).toBe(0);
        expect(zero.incomeStatement[2].fixedCosts).toBeCloseTo(zero.incomeStatement[0].fixedCosts, 6);
    });
});
