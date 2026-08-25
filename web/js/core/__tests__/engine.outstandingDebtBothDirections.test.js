/**
 * رصيد القرض عند نهاية الأفق — **الاتجاهان معاً**.
 *
 * تدقيق مستقل 2026-08-25: تصحيح 2026-07-22 عالج اتجاهاً واحداً (قرض **أطول** من الأفق
 * ⟹ رصيد يبقى ويجب خصمه)، وكُتب اختباره من زاوية ذلك الاتجاه وحده
 * (`engine.remainingDebtAtHorizon.test.js`). فبقي الاتجاه المعاكس مكشوفاً تماماً:
 *
 * `computeLoanSchedule` يبني صفوف `annualSummary` لـ`1..termYears` **فقط**. فحين تكون
 * مدة القرض **أقصر** من الأفق ويبقى رصيد غير مسدَّد — قرض سنة واحدة بفترة سماح 12 شهراً،
 * وكلاهما داخل حدود حقلَي الواجهة — لا يوجد صف للسنة `years`، فكان
 * `find(s => s.year === years)?.endingBalance ?? 0` يُرجع صفراً صمتاً و**يختفي القرض
 * كلياً من التقييم**.
 *
 * قياس على الفيكستشر أدناه: NPV = 1,776,046 بالعيب مقابل 844,664 بعد الإصلاح — فارق
 * 931,382 وهو بالضبط 1,500,000 مخصومة خمس سنوات بـ10%.
 *
 * الدرس المعمَّم (وسبب وجود هذا الملف): **كل إصلاح لعيب اتجاهي يحمل اختبارين — الحالة
 * المُصلَحة وعكسها.** الاختبار الذي يوثّق نيّة المؤلف لا يحرس الثابت.
 */
import { describe, it, expect } from 'vitest';
import { calculateStudy } from '../engine.js';
import { outstandingDebtAtHorizon } from '../financial/cashflow.js';
import { SECTIONS } from '../schema.js';

function makeStudy({ termYears, gracePeriodMonths = 0, years = 5, loanAmount = 1500000 }) {
    return {
        [SECTIONS.PROJECT_INFO]: { businessModel: 'Independent' },
        assumptions: { projectionYears: years, discountRate: 0.10, inflationRate: 0.02 },
        [SECTIONS.TECHNICAL]: {
            equipment: [{ price: 1200000, quantity: 1 }],
            buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: []
        },
        [SECTIONS.HR]: { positions: [{ position: 'موظف', count: 8, salary: 5000, months: 12, nationality: 'saudi' }] },
        [SECTIONS.LOGISTICS]: { logistics: [] },
        [SECTIONS.ADMINISTRATIVE]: { administrative: [{ name: 'إيجار', monthly: 60000 }] },
        [SECTIONS.MARKETING]: { campaigns: [] },
        [SECTIONS.REVENUE]: {
            streams: [{ type: 'operating', customersPerMonth: 3000, avgPrice: 100, variableCostRate: 0.44, growthRate: 0.02 }]
        },
        [SECTIONS.SERVICES]: { items: [] },
        [SECTIONS.FINANCING]: {
            sources: {
                equity: { amount: 300000 },
                bankLoan: { amount: loanAmount, interestRate: 0.08, termYears, gracePeriodMonths, repaymentType: 'equal' }
            }
        },
        [SECTIONS.TECH_RESOURCES]: { techResources: [] },
        [SECTIONS.LEGAL]: { licenses: [] }
    };
}

describe('outstandingDebtAtHorizon — وحدة', () => {
    const rows = (...years) => ({ annualSummary: years.map(([year, endingBalance]) => ({ year, endingBalance })) });

    it('الأفق داخل مدة القرض: رصيد سنة الأفق نفسها', () => {
        expect(outstandingDebtAtHorizon(rows([1, 900], [2, 600], [3, 300], [4, 0]), 3)).toBe(300);
    });

    it('**الأفق بعد انتهاء الجدول: رصيد آخر صف — لا صفر**', () => {
        // العيب: find(year === 5) ⟹ undefined ⟹ 0، فيختفي التزام 1,500,000
        expect(outstandingDebtAtHorizon(rows([1, 1500000]), 5)).toBe(1500000);
    });

    it('قرض سُدِّد بالكامل قبل الأفق: صفر (لا عقوبة وهمية)', () => {
        expect(outstandingDebtAtHorizon(rows([1, 800], [2, 400], [3, 0]), 5)).toBe(0);
    });

    it('صفوف غير مرتَّبة: يُختار أكبر سنة ≤ الأفق لا آخر عنصر في المصفوفة', () => {
        expect(outstandingDebtAtHorizon(rows([3, 300], [1, 900], [2, 600]), 2)).toBe(600);
    });

    it('حالات فارغة/غير صالحة ⟹ صفر بلا رمي', () => {
        expect(outstandingDebtAtHorizon(null, 5)).toBe(0);
        expect(outstandingDebtAtHorizon({}, 5)).toBe(0);
        expect(outstandingDebtAtHorizon({ annualSummary: [] }, 5)).toBe(0);
        expect(outstandingDebtAtHorizon(rows([1, -50]), 5)).toBe(0); // لا رصيد سالب
    });
});

describe('التقييم يخصم الدين القائم في الاتجاهين', () => {
    it('**قرض أقصر من الأفق وكله في فترة سماح: الالتزام لا يختفي**', () => {
        const r = calculateStudy(makeStudy({ termYears: 1, gracePeriodMonths: 12, years: 5 }));
        const rowsOut = r.loanSchedule.annualSummary;

        // شرط السيناريو: الجدول ينتهي قبل الأفق ورصيده كامل غير مسدَّد
        expect(rowsOut.map((x) => x.year)).toEqual([1]);
        expect(rowsOut[0].endingBalance).toBe(1500000);

        // بالعيب كانت 1,776,046؛ بعد الإصلاح تُخصم 1,500,000 مخصومة 5 سنوات بـ10%
        const discountedDebt = 1500000 / Math.pow(1.10, 5);
        // 2026-08-25: استرداد رأس المال العامل في نهاية الأفق لم يعد مشروطاً بوجود سياسة
        // دورة نقدية (هذه الدراسة بلا DSO/DPO/DIO) — تدفق داخل حقيقي في السنة الأخيرة
        // يُضاف مخصوماً بنفس المعامل. يُشتق من النتيجة نفسها لا كرقم سحري.
        const discountedRecapture = r.capex.workingCapital / Math.pow(1.10, 5);
        expect(r.indicators.npv).toBeCloseTo(1776046 - discountedDebt + discountedRecapture, 0);
        // خصم الدين أكبر من استرداد رأس المال العامل، فالنتيجة تبقى أدنى من قيمة العيب
        expect(r.indicators.npv).toBeLessThan(1776046);
        expect(r.indicators.npv).not.toBeCloseTo(1776046, 0);
    });

    it('قرض أطول من الأفق: الاتجاه المُصلَح سابقاً لم ينكسر', () => {
        const r = calculateStudy(makeStudy({ termYears: 10, years: 3 }));
        const atHorizon = r.loanSchedule.annualSummary.find((x) => x.year === 3);
        expect(atHorizon.endingBalance).toBeGreaterThan(0);

        // النسخة القديمة كانت تصيب هنا (الصف موجود) — نثبّت أنها ما زالت تصيب
        expect(outstandingDebtAtHorizon(r.loanSchedule, 3)).toBe(atHorizon.endingBalance);
    });

    it('قرض يُسدَّد بالكامل ضمن الأفق: لا خصم ولا انحدار في الأرقام', () => {
        const five = calculateStudy(makeStudy({ termYears: 5, years: 5 }));
        expect(five.loanSchedule.annualSummary.at(-1).endingBalance).toBe(0);
        expect(outstandingDebtAtHorizon(five.loanSchedule, 5)).toBe(0);
        // رقم مرجعي مقاس قبل إصلاح خصم الدين وبعده — الجزء الخاص بالدين يجب ألا يتحرك.
        // 2026-08-25: أُضيف استرداد رأس المال العامل في نهاية الأفق لكل دراسة (لم يعد
        // مشروطاً بسياسة الدورة النقدية)، فالمرجع = 483,264 + الاسترداد مخصوماً 5 سنوات.
        const discountedRecapture = five.capex.workingCapital / Math.pow(1.10, 5);
        expect(Math.round(five.indicators.npv)).toBe(Math.round(483264 + discountedRecapture));
    });
});
