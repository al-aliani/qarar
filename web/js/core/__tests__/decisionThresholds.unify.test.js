/**
 * اختبارات توحيد عتبات القرار (تدقيق 2026-07-08، ملاحظة حرجة CFO + عالية):
 * كانت شاشات مختلفة (InvestorAnalysis: استرداد 7 سنوات، DecisionDashboard: DSCR 1.5،
 * FinancialDashboard: IRR≥5%/ROI>0% ثابتة) تفترض عتبات احتياطية مختلفة عن العتبات
 * الفعلية التي يستخدمها محرك القرار (maxPayback=3.5، targetDSCR=1.25، minIRR=15%،
 * minROI=20%) — فتُظهر ✓ لمشروع يصنّفه المحرك نفسه REVISE/NO-GO. هذا الملف يثبّت
 * أن resolveDecisionThresholds (المصدر الوحيد الجديد) يعيد نفس القيم التي يستخدمها
 * computeDecision فعلياً، وأن calculateStudy يعرضها في assumptionsApplied.thresholds.
 */
import { describe, it, expect } from 'vitest';
import { calculateStudy, resolveDecisionThresholds } from '../engine.js';
import { SECTIONS } from '../schema.js';

function makeStudy(overrides = {}) {
    const base = {
        [SECTIONS.PROJECT_INFO]: { businessModel: 'Independent' },
        assumptions: { projectionYears: 5, discountRate: 0.10, inflationRate: 0.02, taxRate: 0 },
        [SECTIONS.TECHNICAL]: { equipment: [{ price: 250000, quantity: 1 }], buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: [] },
        [SECTIONS.HR]: { positions: [] },
        [SECTIONS.LOGISTICS]: { logistics: [] },
        [SECTIONS.ADMINISTRATIVE]: { administrative: [] },
        [SECTIONS.MARKETING]: { campaigns: [] },
        [SECTIONS.REVENUE]: { streams: [{ type: 'operating', customersPerMonth: 1200, avgPrice: 100, variableCostRate: 0.30, growthRate: 0.03 }] },
        [SECTIONS.SERVICES]: { items: [] },
        [SECTIONS.FINANCING]: { sources: {} },
        [SECTIONS.TECH_RESOURCES]: { techResources: [] },
        [SECTIONS.LEGAL]: { licenses: [] }
    };
    return { ...base, ...overrides };
}

describe('resolveDecisionThresholds — مصدر وحيد', () => {
    it('الافتراضات (بلا إدخال مستخدم) تطابق ما يستخدمه computeDecision فعلياً: maxPayback=3.5 لا 7', () => {
        const th = resolveDecisionThresholds(undefined, undefined);
        expect(th).toEqual({ minNPV: 0, minIRR: 0.15, maxPayback: 3.5, minROI: 0.20, targetDSCR: 1.25 });
    });

    it('targetDSCR: يقرأ assumptions.thresholds.targetDSCR أولاً، ثم financing.targetDSCR، ثم 1.25', () => {
        expect(resolveDecisionThresholds({ targetDSCR: 1.4 }, { targetDSCR: 1.6 }).targetDSCR).toBe(1.4);
        expect(resolveDecisionThresholds({}, { targetDSCR: 1.6 }).targetDSCR).toBe(1.6);
        expect(resolveDecisionThresholds({}, {}).targetDSCR).toBe(1.25);
    });

    it('تجاوز المستخدم لأي عتبة يسري فعلياً (لا يُستبدل بالافتراضي)', () => {
        const th = resolveDecisionThresholds({ minIRR: 0.25, maxPayback: 2, minROI: 0.5, minNPV: 100000 });
        expect(th).toEqual({ minNPV: 100000, minIRR: 0.25, maxPayback: 2, minROI: 0.5, targetDSCR: 1.25 });
    });
});

describe('calculateStudy — assumptionsApplied.thresholds', () => {
    it('يعرض حزمة العتبات الفعلية المُطبَّقة على القرار (نفس ما تقرأه كل الشاشات الآن)', () => {
        const r = calculateStudy(makeStudy());
        expect(r.assumptionsApplied.thresholds).toEqual({
            minNPV: 0, minIRR: 0.15, maxPayback: 3.5, minROI: 0.20, targetDSCR: 1.25
        });
    });

    it('مشروع باسترداد ~3.6 سنة (بين 3.5 الفعلية و7 القديمة الخاطئة): القرار الفعلي يرفضه لا يقبله', () => {
        // كانت شاشة InvestorAnalysis تُظهر هذه الحالة ✓ ("فترة استرداد معقولة < 7 سنوات")
        // بينما القرار الحقيقي (محرك القرار) يرفضها REVISE فعلياً — بالضبط التناقض
        // الذي وثّقه تدقيق 2026-07-08 كملاحظة حرجة.
        const r = calculateStudy(makeStudy({
            [SECTIONS.ADMINISTRATIVE]: { administrative: [{ name: 'إيجار', monthly: 17000 }] },
            [SECTIONS.REVENUE]: { streams: [{ type: 'operating', customersPerMonth: 400, avgPrice: 100, variableCostRate: 0.30, growthRate: 0 }] }
        }));
        expect(r.indicators.paybackPeriod).toBeGreaterThan(3.5);
        expect(r.indicators.paybackPeriod).toBeLessThan(7);
        expect(r.decision).not.toBe('GO');
    });
});
