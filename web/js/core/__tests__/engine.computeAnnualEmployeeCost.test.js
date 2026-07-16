/**
 * computeAnnualEmployeeCost (engine.js) — تكلفة سنوية لموظف واحد (مهمة Nitaqat، دفعة 4).
 * يثبّت أن الرقم يطابق فعلياً ما يحسبه calculateStudy لنفس المُدخلات (جدول رواتب بصف
 * واحد فقط، count=1) — لا صيغة GOSI/رسوم موازية منفصلة قد تنحرف عن المحرك الحقيقي.
 */
import { describe, it, expect } from 'vitest';
import { calculateStudy, computeAnnualEmployeeCost, SAUDI_GOSI_RATE_2026, EXPAT_GOSI_RATE } from '../engine.js';
import { SECTIONS } from '../schema.js';

function createMinimalStudy(overrides = {}) {
    const base = {
        [SECTIONS.PROJECT_INFO]: { businessModel: 'Independent' },
        assumptions: { projectionYears: 5, discountRate: 0.10, inflationRate: 0, taxRate: 0 },
        [SECTIONS.TECHNICAL]: {
            equipment: [{ price: 50000, quantity: 1 }],
            buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: []
        },
        [SECTIONS.HR]: { positions: [] },
        [SECTIONS.LOGISTICS]: { logistics: [] },
        [SECTIONS.ADMINISTRATIVE]: { administrative: [] },
        [SECTIONS.MARKETING]: { campaigns: [] },
        [SECTIONS.REVENUE]: { streams: [{ type: 'operating', customersPerMonth: 500, avgPrice: 100, variableCostRate: 0.30 }] },
        [SECTIONS.SERVICES]: { items: [] },
        [SECTIONS.FINANCING]: { sources: {} },
        [SECTIONS.TECH_RESOURCES]: { techResources: [] },
        [SECTIONS.LEGAL]: { licenses: [] }
    };
    return { ...base, ...overrides };
}

describe('computeAnnualEmployeeCost — يطابق مخرَج calculateStudy الحقيقي', () => {
    it('موظف سعودي واحد: نفس رقم opex.payrollAnnual تماماً (GOSI + تأمين، بلا رسوم وافد)', () => {
        const study = createMinimalStudy({
            [SECTIONS.HR]: {
                positions: [{ position: 'مدير', nationality: 'saudi', count: 1, salary: 10000, months: 12 }],
                healthInsurancePerHead: 1500,
                govtFees: { workCard: 9600, ticket: 2500, iqama: 650 }
            }
        });
        const result = calculateStudy(study);

        const expected = computeAnnualEmployeeCost({
            salary: 10000, months: 12, nationality: 'saudi',
            gosiRate: SAUDI_GOSI_RATE_2026, healthInsurancePerHead: 1500,
            govtFees: { workCard: 9600, ticket: 2500, iqama: 650 }
        });

        expect(result.opex.payrollAnnual).toBeCloseTo(expected, 6);
    });

    it('موظف وافد واحد: نفس رقم opex.payrollAnnual تماماً (GOSI 2% + تأمين + رسوم حكومية)', () => {
        const study = createMinimalStudy({
            [SECTIONS.HR]: {
                positions: [{ position: 'فني', nationality: 'expat', count: 1, salary: 12000, months: 12 }],
                healthInsurancePerHead: 1500,
                govtFees: { workCard: 9600, ticket: 2500, iqama: 650 }
            }
        });
        const result = calculateStudy(study);

        const expected = computeAnnualEmployeeCost({
            salary: 12000, months: 12, nationality: 'expat',
            healthInsurancePerHead: 1500,
            govtFees: { workCard: 9600, ticket: 2500, iqama: 650 }
        });

        expect(result.opex.payrollAnnual).toBeCloseTo(expected, 6);
        expect(EXPAT_GOSI_RATE).toBe(0.02);
    });

    it('تجاوز gosiRate عبر assumptions.gosiRate ينسحب على الحساب اليدوي أيضاً (السعودي فقط)', () => {
        const study = createMinimalStudy({
            assumptions: { projectionYears: 5, discountRate: 0.10, inflationRate: 0, taxRate: 0, gosiRate: 0.10 },
            [SECTIONS.HR]: {
                positions: [{ position: 'محاسب', nationality: 'saudi', count: 1, salary: 8000, months: 12 }],
                healthInsurancePerHead: 1200,
                govtFees: {}
            }
        });
        const result = calculateStudy(study);

        const expected = computeAnnualEmployeeCost({
            salary: 8000, months: 12, nationality: 'saudi', gosiRate: 0.10, healthInsurancePerHead: 1200
        });

        expect(result.opex.payrollAnnual).toBeCloseTo(expected, 6);
    });

    it('الفرق بين تكلفة الوافد والسعودي منطقي (ليس صفراً ولا سالباً بلا تفسير) لنفس الراتب', () => {
        const saudiCost = computeAnnualEmployeeCost({ salary: 9000, months: 12, nationality: 'saudi' });
        const expatCost = computeAnnualEmployeeCost({ salary: 9000, months: 12, nationality: 'expat' });
        expect(saudiCost).not.toBe(expatCost);
        expect(Number.isFinite(saudiCost)).toBe(true);
        expect(Number.isFinite(expatCost)).toBe(true);
    });
});
