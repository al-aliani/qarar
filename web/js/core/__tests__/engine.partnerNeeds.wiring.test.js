/**
 * calculateStudy يُرفق result.partnerNeeds فعلياً (لا اختبار الدالة المعزولة فقط) —
 * راجع partnerNeeds.test.js لاختبارات قواعد التصنيف نفسها.
 */
import { describe, it, expect } from 'vitest';
import { calculateStudy } from '../engine.js';
import { SECTIONS } from '../schema.js';

function makeStudy(overrides = {}) {
    const base = {
        [SECTIONS.PROJECT_INFO]: { businessModel: 'Independent' },
        assumptions: { projectionYears: 5, discountRate: 0.10, inflationRate: 0.02, hiddenOverheadsRate: 0 },
        [SECTIONS.TECHNICAL]: { equipment: [], buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: [] },
        [SECTIONS.HR]: { positions: [] },
        [SECTIONS.LOGISTICS]: { logistics: [] },
        [SECTIONS.ADMINISTRATIVE]: { administrative: [] },
        [SECTIONS.MARKETING]: { campaigns: [], suppliers: [] },
        [SECTIONS.REVENUE]: { streams: [{ type: 'operating', customersPerMonth: 500, avgPrice: 100, variableCostRate: 0.30, growthRate: 0 }] },
        [SECTIONS.SERVICES]: { items: [] },
        [SECTIONS.FINANCING]: { sources: {} },
        [SECTIONS.TECH_RESOURCES]: { techResources: [] },
        [SECTIONS.LEGAL]: { licenses: [] }
    };
    return { ...base, ...overrides };
}

describe('calculateStudy — partnerNeeds مرفقة على النتيجة', () => {
    it('result.partnerNeeds مصفوفة فعلية لدراسة حد أدنى', () => {
        const r = calculateStudy(makeStudy());
        expect(Array.isArray(r.partnerNeeds)).toBe(true);
    });

    it('ملكية أجنبية 40%: result.partnerNeeds يحوي بند market_entry مبنياً على financingCheck نفسه', () => {
        const r = calculateStudy(makeStudy({
            assumptions: { projectionYears: 5, discountRate: 0.10, inflationRate: 0.02, hiddenOverheadsRate: 0, foreignOwnershipRate: 0.4 }
        }));
        expect(r.partnerNeeds.some(n => n.type === 'market_entry')).toBe(true);
    });
});
