/**
 * تدقيق توحيد سعر الوحدة (2026-08-24، OfferingView.js/PricingOptimizerView.js): يثبّت على
 * مستوى المحرّك الكامل (calculateStudy، لا buildRevenueModel وحدها) أن:
 *   (أ) دراسة فيها services.items فقط بدون revenue.streams تحسب الإيراد/NPV بشكل طبيعي.
 *   (ب) دراسة فيها كلا المصدرين بنفس الأرقام لا تُضاعِف الإيراد (الحارس في revenue.js:38
 *       يُستبعد التحقق منه في engine.regression.revenue.test.js على buildRevenueModel مباشرة؛
 *       هذا الاختبار يتأكد أن نفس الحارس يبقى ساري المفعول عبر calculateStudy كاملاً).
 * لا تعديل هنا على engine.js/revenue.js — اختبار قراءة فقط.
 */
import { describe, it, expect } from 'vitest';
import { calculateStudy } from '../engine.js';
import { SECTIONS } from '../schema.js';

function createMinimalStudy(overrides = {}) {
    const base = {
        [SECTIONS.PROJECT_INFO]: { businessModel: 'Independent' },
        assumptions: {
            projectionYears: 5,
            discountRate: 0.10,
            inflationRate: 0.02,
            taxRate: 0
        },
        [SECTIONS.TECHNICAL]: {
            equipment: [{ price: 50000, quantity: 1 }],
            buildings: [],
            furniture: [],
            establishmentCosts: [],
            capacityUtilization: []
        },
        [SECTIONS.HR]: { positions: [] },
        [SECTIONS.LOGISTICS]: { logistics: [] },
        [SECTIONS.ADMINISTRATIVE]: { administrative: [] },
        [SECTIONS.MARKETING]: { campaigns: [] },
        [SECTIONS.REVENUE]: { streams: [] },
        [SECTIONS.SERVICES]: { items: [] },
        [SECTIONS.FINANCING]: { sources: {} },
        [SECTIONS.TECH_RESOURCES]: { techResources: [] },
        [SECTIONS.LEGAL]: { licenses: [] }
    };
    return { ...base, ...overrides };
}

describe('توحيد سعر الوحدة: services.items وrevenue.streams عبر calculateStudy الكامل', () => {
    it('(أ) services.items فقط بلا revenue.streams: يحسب الإيراد/NPV بشكل طبيعي بلا احتساب مزدوج', () => {
        const study = createMinimalStudy({
            [SECTIONS.SERVICES]: {
                items: [{ customersPerMonth: 500, pricePerUnit: 100, variableCostPerUnit: 30, growthRate: 0.05 }]
            }
        });
        const result = calculateStudy(study);
        expect(result).toBeTruthy();
        // 500 عميل/شهر × 12 × 100 ريال = 600,000 — بلا أي مضاعفة (لا مصدر ثانٍ موجود أصلاً هنا)
        expect(result.incomeStatement[0].revenue).toBeCloseTo(600000, 5);
        expect(Number.isFinite(result.indicators.npv)).toBe(true);
        expect(Number.isFinite(result.indicators.irr)).toBe(true);
    });

    it('(ب) services.items + revenue.streams تشغيلي بنفس الأرقام: لا يُضاعَف الإيراد', () => {
        const servicesOnly = createMinimalStudy({
            [SECTIONS.SERVICES]: {
                items: [{ customersPerMonth: 500, pricePerUnit: 100, variableCostPerUnit: 30, growthRate: 0.05 }]
            }
        });
        const both = createMinimalStudy({
            [SECTIONS.REVENUE]: {
                streams: [{ type: 'operating', customersPerMonth: 500, avgPrice: 100, variableCostRate: 0.30 }]
            },
            [SECTIONS.SERVICES]: {
                items: [{ customersPerMonth: 500, pricePerUnit: 100, variableCostPerUnit: 30, growthRate: 0.05 }]
            }
        });

        const servicesOnlyResult = calculateStudy(servicesOnly);
        const bothResult = calculateStudy(both);

        // لولا الحارس: 600,000 (خدمات) + 600,000 (مصادر إيراد) = 1,200,000 — تراكب صامت.
        expect(bothResult.incomeStatement[0].revenue).toBeCloseTo(600000, 5);
        expect(bothResult.incomeStatement[0].revenue).toBeCloseTo(servicesOnlyResult.incomeStatement[0].revenue, 5);
        expect(bothResult.indicators.npv).toBeCloseTo(servicesOnlyResult.indicators.npv, 2);
    });
});
