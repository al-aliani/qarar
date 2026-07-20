/**
 * تدقيق جولة الموقع 2026-07-20 (بند #3): DSCR «غير قابل للحساب» كان يُنسب دائماً إلى
 * «EBITDA سالبة/صفرية» — فيتناقض مع بطاقة EBITDA الخضراء الموجبة، ولا يميّز «لا قرض»
 * (DSCR لا ينطبق) عن CFADS ≤ 0 (قد يكون EBITDA موجباً لكن الزكاة/الإحلال تبتلعه).
 * الإصلاح: علَم indicators.dscrReason = no_debt_service | no_cfads | null.
 */
import { describe, it, expect } from 'vitest';
import { calculateStudy } from '../engine.js';
import { SECTIONS } from '../schema.js';

function makeStudy({ variableCostRate = 0.30, wasteRate = 0, loan = 0 } = {}) {
    return {
        [SECTIONS.PROJECT_INFO]: { businessModel: 'Independent' },
        assumptions: { projectionYears: 5, discountRate: 0.10, inflationRate: 0.02 },
        [SECTIONS.TECHNICAL]: {
            equipment: [{ price: 100000, quantity: 1 }],
            buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: []
        },
        [SECTIONS.HR]: { positions: [] },
        [SECTIONS.LOGISTICS]: { logistics: [] },
        [SECTIONS.ADMINISTRATIVE]: { administrative: [] },
        [SECTIONS.MARKETING]: { campaigns: [] },
        [SECTIONS.REVENUE]: {
            streams: [{ type: 'operating', customersPerMonth: 500, avgPrice: 100, variableCostRate, wasteRate, growthRate: 0 }]
        },
        [SECTIONS.SERVICES]: { items: [] },
        [SECTIONS.FINANCING]: {
            sources: loan > 0 ? { bankLoan: { amount: loan, interestRate: 0.08, termYears: 5, gracePeriodMonths: 0 } } : {}
        },
        [SECTIONS.TECH_RESOURCES]: { techResources: [] },
        [SECTIONS.LEGAL]: { licenses: [] }
    };
}

describe('المحرك — سبب تعذّر DSCR (dscrReason)', () => {
    it('لا قرض: dscr=null و dscrReason=no_debt_service (DSCR لا ينطبق، ليس مشكلة)', () => {
        const r = calculateStudy(makeStudy({ loan: 0 }));
        expect(r.indicators.dscr).toBeNull();
        expect(r.indicators.dscrReason).toBe('no_debt_service');
    });

    it('قرض + هامش صحي: dscr محسوب و dscrReason=null', () => {
        const r = calculateStudy(makeStudy({ loan: 200000, variableCostRate: 0.30 }));
        expect(r.indicators.dscr).not.toBeNull();
        expect(r.indicators.dscrReason).toBeNull();
    });

    it('قرض + CFADS سالب (متغيرة+هدر 120%): dscr=null و dscrReason=no_cfads (لا EBITDA سالبة تلقائياً)', () => {
        const r = calculateStudy(makeStudy({ loan: 200000, variableCostRate: 0.90, wasteRate: 0.30 }));
        expect(r.indicators.dscr).toBeNull();
        expect(r.indicators.dscrReason).toBe('no_cfads');
    });
});
