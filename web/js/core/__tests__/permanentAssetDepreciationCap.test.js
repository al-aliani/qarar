/**
 * تدقيق حي 2026-07-22 (فحص Workflow إضافي + تقرير جلسة موازية، مُتحقَّق منه مستقلاً):
 *
 * 1) الأصول «الدائمة» (مبانٍ/مركبات/خدمات — permanentDepAtYear) كانت تُهلَك بمبلغ ثابت
 *    كل سنة إلى الأبد بلا سقف (permanentAnnualDep القديم) — بعد انتهاء عمرها الافتراضي
 *    (مثال: مبنى بنسبة 15% ⇒ عمر 7 سنوات) يستمر القيد فيتجاوز تراكم الإهلاك تكلفة الأصل
 *    نفسها، فتختل هوية الميزانية (isBalanced=false) بمجرد تجاوز أفق الدراسة عمر الأصل.
 *    الإصلاح: نفس مبدأ الأصول القابلة للإحلال — يتوقف الإهلاك عند life، والسنة الأخيرة
 *    تُقيَّد كي لا يتجاوز التراكم تكلفة الأصل (life=round(1/rate) تقريب، فقد يزيد قليلاً).
 *
 * 2) معدات (Equipment) تحديداً كانت تتجاهل نسبة الاستهلاك التي يُدخلها العميل لمبلغ
 *    الإهلاك نفسه (تستخدم 15% الافتراضية دائماً) رغم استخدام نفس النسبة لحساب عمر
 *    الأصل وتوقيت الإحلال — بخلاف الأثاث والموارد التقنية اللتين تستخدمان نسبة العميل
 *    للمبلغ والعمر معاً. أُزيل الاستثناء.
 */
import { describe, it, expect } from 'vitest';
import { calculateStudy } from '../engine.js';
import { SECTIONS } from '../schema.js';

function makeStudy(overrides = {}) {
    const base = {
        [SECTIONS.PROJECT_INFO]: { name: 'اختبار', sector: 'مطعم', businessModel: 'Independent' },
        assumptions: { projectionYears: 12, discountRate: 0.10, inflationRate: 0.02, taxRate: 0.20, hiddenOverheadsRate: 0 },
        [SECTIONS.TECHNICAL]: {
            equipment: [], buildings: [], furniture: [], vehicles: [],
            establishmentCosts: [], capacityUtilization: [], openingInventory: 0
        },
        [SECTIONS.HR]: { positions: [{ position: 'موظف', count: 2, salary: 5000, months: 12, nationality: 'saudi' }] },
        [SECTIONS.LOGISTICS]: { logistics: [] },
        [SECTIONS.ADMINISTRATIVE]: { administrative: [{ name: 'إيجار', monthly: 5000 }] },
        [SECTIONS.MARKETING]: { campaigns: [] },
        [SECTIONS.REVENUE]: { streams: [{ service: 'مبيعات', type: 'operating', customersPerMonth: 3000, avgPrice: 30, variableCostRate: 0.3, growthRate: 0.02 }] },
        [SECTIONS.SERVICES]: { items: [] },
        [SECTIONS.FINANCING]: { sources: { equity: { amount: 500000, percentage: 100 } } },
        [SECTIONS.TECH_RESOURCES]: { techResources: [] },
        [SECTIONS.LEGAL]: { licenses: [] }
    };
    return { ...base, ...overrides, [SECTIONS.TECHNICAL]: { ...base[SECTIONS.TECHNICAL], ...(overrides[SECTIONS.TECHNICAL] || {}) } };
}

describe('الإهلاك — الأصول الدائمة تتوقف عند نهاية عمرها الافتراضي (لا تتجاوز تكلفة الأصل)', () => {
    it('مبنى بنسبة استهلاك 15% (عمر 7 سنوات) على أفق 12 سنة: الميزانية متوازنة كل السنوات، وتراكم الإهلاك لا يتجاوز التكلفة أبداً', () => {
        const study = makeStudy({
            [SECTIONS.TECHNICAL]: { buildings: [{ name: 'تجهيزات', price: 500000, quantity: 1, depreciationRate: 0.15 }] }
        });
        const r = calculateStudy(study);

        expect(r.balanceSheets.length).toBe(12);
        r.balanceSheets.forEach(bs => {
            expect(bs.isBalanced, `السنة ${bs.year} غير متوازنة (imbalance=${bs.imbalance})`).toBe(true);
            expect(bs.assets.fixed.accumulatedDepreciation).toBeLessThanOrEqual(bs.assets.fixed.gross + 1);
        });

        // الإهلاك يتوقف تماماً بعد السنة السابعة (7 × 15% = 105% مقرَّب لأقرب سنة)
        expect(r.incomeStatement[7].depreciation).toBe(0); // السنة 8 (index 7)
        expect(r.incomeStatement[11].depreciation).toBe(0); // السنة 12

        // مجموع كل سنوات الإهلاك الفعلية يساوي بالضبط تكلفة المبنى، لا أكثر
        const totalDep = r.incomeStatement.reduce((s, y) => s + y.depreciation, 0);
        expect(totalDep).toBeCloseTo(500000, 0);
    });

    it('مركبة بنسبة استهلاك 20% (عمر 5 سنوات) تتوقف عن الإهلاك بعد السنة الخامسة أيضاً', () => {
        const study = makeStudy({
            [SECTIONS.TECHNICAL]: { vehicles: [{ name: 'سيارة توصيل', price: 100000, quantity: 1, depreciationRate: 0.20 }] }
        });
        const r = calculateStudy(study);

        expect(r.incomeStatement[5].depreciation).toBe(0); // السنة 6
        const totalDep = r.incomeStatement.reduce((s, y) => s + y.depreciation, 0);
        expect(totalDep).toBeCloseTo(100000, 0);
        r.balanceSheets.forEach(bs => expect(bs.isBalanced).toBe(true));
    });
});

describe('الإهلاك — معدات: نسبة الاستهلاك المُدخلة تُستخدم في المبلغ لا العمر فقط', () => {
    it('معدة بنسبة استهلاك 25% (لا 15% الافتراضية): مبلغ الإهلاك السنوي يعكس 25% فعلياً', () => {
        const cost = 200000;
        const study = makeStudy({
            [SECTIONS.TECHNICAL]: { equipment: [{ name: 'معدات', price: cost, quantity: 1, depreciationRate: 0.25 }] }
        });
        const r = calculateStudy(study);

        // launchStrategy الافتراضي ⇒ مضاعِف 1.0، و2026-08-25: المعامل صار (1 + computedContingencyRate)
        // بدل 1.10 المصمتة. يساوي 1.10 هنا تحديداً لأن contingencyRate الافتراضي 0.10 وriskPremium = 0
        // (لا سجل مخاطر في هذه الدراسة) ⇒ 1.0 × (1 + 0.10) = 1.10.
        const expectedYear1Dep = cost * 0.25 * 1.10;
        expect(r.incomeStatement[0].depreciation).toBeCloseTo(expectedYear1Dep, 0);
        // ليس مبلغ الـ15% الافتراضي القديم (200000×0.15×1.10=33000)
        expect(r.incomeStatement[0].depreciation).not.toBeCloseTo(cost * 0.15 * 1.10, 0);
    });
});
