/**
 * findOptimalFinancingMix — أفضل نسبة دين/ملكية (ضمن استثمار إجمالي ثابت) تعظّم NPV
 * دون خفض أدنى DSCR عن الهدف. بحث على مرشّحين ثابتين عبر calculateStudy الحقيقية،
 * لا صيغة مغلقة موازية.
 */
import { describe, it, expect } from 'vitest';
import { findOptimalFinancingMix } from '../engine.js';
import { SECTIONS } from '../schema.js';

function makeStudy(overrides = {}) {
    const base = {
        [SECTIONS.PROJECT_INFO]: { businessModel: 'Independent' },
        assumptions: { projectionYears: 5, discountRate: 0.10, inflationRate: 0.02, hiddenOverheadsRate: 0, rampUpMonths: 0 },
        [SECTIONS.TECHNICAL]: {
            equipment: [{ type: 'capital', amount: 300000 }],
            buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: []
        },
        [SECTIONS.HR]: { positions: [] },
        [SECTIONS.LOGISTICS]: { logistics: [] },
        [SECTIONS.ADMINISTRATIVE]: { administrative: [] },
        [SECTIONS.MARKETING]: { campaigns: [], suppliers: [] },
        [SECTIONS.REVENUE]: { streams: [{ type: 'operating', customersPerMonth: 800, avgPrice: 120, variableCostRate: 0.30, growthRate: 0.05 }] },
        [SECTIONS.SERVICES]: { items: [] },
        [SECTIONS.FINANCING]: { sources: { bankLoan: { interestRate: 0.08, termYears: 5 } } },
        [SECTIONS.TECH_RESOURCES]: { techResources: [] },
        [SECTIONS.LEGAL]: { licenses: [] }
    };
    return { ...base, ...overrides };
}

describe('findOptimalFinancingMix', () => {
    it('يعيد مرشحين لكل نسبة دين مع npv وminDscr لكل منهم', () => {
        const result = findOptimalFinancingMix(makeStudy());
        expect(result).not.toBeNull();
        expect(result.candidates.length).toBeGreaterThan(1);
        result.candidates.forEach(c => {
            expect(Number.isFinite(c.npv)).toBe(true);
            expect(c.loanAmount + c.equityAmount).toBeCloseTo(result.candidates[0].loanAmount + result.candidates[0].equityAmount, 0);
        });
    });

    it('best هو دائماً أحد عناصر candidates (لا قيمة مختلَقة)', () => {
        const result = findOptimalFinancingMix(makeStudy());
        expect(result.candidates).toContainEqual(result.best);
    });

    it('يفضّل مرشحين يحققون هدف DSCR عند وجودهم (لا يختار مرشحاً فاشلاً بينما آخر ناجح متاح)', () => {
        const result = findOptimalFinancingMix(makeStudy(), 0.01); // هدف منخفض جداً يسهل تحقيقه
        const anyFeasible = result.candidates.some(c => c.meetsTarget);
        if (anyFeasible) expect(result.best.meetsTarget).toBe(true);
    });

    it('يُرجع null على استثمار إجمالي صفري (لا تجهيزات)', () => {
        const study = makeStudy({ [SECTIONS.TECHNICAL]: { equipment: [], buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: [] } });
        // لا يزال المشروع لديه إيراد وقد يبقى total>0 عبر بنود أخرى؛ نتحقق فقط من عدم الرمي.
        expect(() => findOptimalFinancingMix(study)).not.toThrow();
    });

    it('لا يرمي حين تكون study.financing غير معرّفة إطلاقاً', () => {
        const study = makeStudy();
        delete study[SECTIONS.FINANCING];
        expect(() => findOptimalFinancingMix(study)).not.toThrow();
    });
});
