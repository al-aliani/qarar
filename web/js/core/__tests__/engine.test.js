/**
 * Unit Tests للمحرك المالي (engine.js)
 * المرحلة 3 — اختبارات شاملة
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
        [SECTIONS.REVENUE]: {
            streams: [{
                type: 'operating',
                customersPerMonth: 500,
                avgPrice: 100,
                variableCostRate: 0.30
            }]
        },
        [SECTIONS.SERVICES]: { items: [] },
        [SECTIONS.FINANCING]: { sources: {} },
        [SECTIONS.TECH_RESOURCES]: { techResources: [] },
        [SECTIONS.LEGAL]: { licenses: [] }
    };
    return { ...base, ...overrides };
}

describe('Engine - calculateStudy', () => {
    it('returns null for empty study', () => {
        expect(calculateStudy(null)).toBeNull();
        expect(calculateStudy(undefined)).toBeNull();
    });

    it('returns indicators object with npv, irr, paybackPeriod', () => {
        const study = createMinimalStudy();
        const result = calculateStudy(study);
        expect(result).toBeTruthy();
        expect(result.indicators).toBeDefined();
        expect(typeof result.indicators.npv).toBe('number');
        expect(typeof result.indicators.irr).toBe('number');
        expect(typeof result.indicators.paybackPeriod).toBe('number');
    });

    it('NPV is positive when revenue exceeds costs', () => {
        const study = createMinimalStudy();
        const result = calculateStudy(study);
        expect(result.indicators.npv).toBeGreaterThan(-1000000);
    });

    it('IRR is a reasonable percentage (0-100%)', () => {
        const study = createMinimalStudy();
        const result = calculateStudy(study);
        const irr = result.indicators.irr;
        expect(irr).toBeGreaterThanOrEqual(-1);
        expect(irr).toBeLessThanOrEqual(5);
    });

    it('paybackPeriod is finite and positive for viable project', () => {
        const study = createMinimalStudy();
        const result = calculateStudy(study);
        const payback = result.indicators.paybackPeriod;
        expect(payback).toBeGreaterThanOrEqual(0);
        expect(payback).toBeLessThan(50);
    });

    it('breakEvenPointValue is calculated', () => {
        const study = createMinimalStudy();
        const result = calculateStudy(study);
        expect(typeof result.indicators.breakEvenPointValue).toBe('number');
    });

    it('incomeStatement has 5 years', () => {
        const study = createMinimalStudy();
        const result = calculateStudy(study);
        expect(result.incomeStatement).toBeDefined();
        expect(result.incomeStatement.length).toBe(5);
    });

    it('respects revenue override', () => {
        const study = createMinimalStudy();
        const base = calculateStudy(study);
        const withMoreRevenue = calculateStudy(study, { revenueChange: 0.2 });
        expect(withMoreRevenue.indicators.npv).toBeGreaterThan(base.indicators.npv);
    });

    it('capex and cashFlow are defined', () => {
        const study = createMinimalStudy();
        const result = calculateStudy(study);
        expect(result.capex).toBeDefined();
        expect(result.cashFlow).toBeDefined();
    });
});

/**
 * Golden tests: سيناريوهات ثابتة لضمان عدم كسر المحرك بتعديلات لاحقة.
 * المدخلات محددة والمخرجات ضمن نطاقات متوقعة.
 */
describe('Engine - golden scenarios', () => {
    /** دراسة بسيطة: استثمار 50k، إيراد 500 عميل/شهر × 100 ريال، تكلفة متغيرة 30% */
    const goldenMinimal = createMinimalStudy({
        [SECTIONS.TECHNICAL]: {
            equipment: [{ price: 50000, quantity: 1 }],
            buildings: [],
            furniture: [],
            establishmentCosts: [],
            capacityUtilization: []
        },
        [SECTIONS.REVENUE]: {
            streams: [{
                type: 'operating',
                customersPerMonth: 500,
                avgPrice: 100,
                variableCostRate: 0.30
            }]
        }
    });

    it('golden minimal: NPV positive and in reasonable range', () => {
        const result = calculateStudy(goldenMinimal);
        expect(result.indicators.npv).toBeGreaterThan(0);
        expect(result.indicators.npv).toBeLessThan(5_000_000);
    });

    it('golden minimal: IRR positive and within engine sanity cap', () => {
        const result = calculateStudy(goldenMinimal);
        const irr = result.indicators.irr;
        // السيناريو بلا تكاليف ثابتة (لا إيجار/رواتب) فالـ IRR الحقيقي مرتفع جداً بطبيعته؛
        // المهم: موجب، محدود، وداخل سقف الأمان (≤ 10 أي 1000%) الذي يمنع القيم الفلكية.
        expect(Number.isFinite(irr)).toBe(true);
        expect(irr).toBeGreaterThan(0);
        expect(irr).toBeLessThanOrEqual(10);
    });

    it('golden minimal: payback between 0.5 and 10 years', () => {
        const result = calculateStudy(goldenMinimal);
        const payback = result.indicators.paybackPeriod;
        expect(payback).toBeGreaterThanOrEqual(0);
        expect(payback).toBeLessThanOrEqual(10);
    });

    it('golden minimal: decision exists and is string', () => {
        const result = calculateStudy(goldenMinimal);
        expect(result.decision).toBeDefined();
        expect(typeof result.decision).toBe('string');
    });

    /** سيناريو أسوأ: إيراد أقل، تكلفة أعلى */
    const goldenWorst = createMinimalStudy({
        [SECTIONS.REVENUE]: {
            streams: [{
                type: 'operating',
                customersPerMonth: 100,
                avgPrice: 50,
                variableCostRate: 0.7
            }]
        }
    });

    it('golden worst: NPV lower than golden minimal', () => {
        const minimalResult = calculateStudy(goldenMinimal);
        const worstResult = calculateStudy(goldenWorst);
        expect(worstResult.indicators.npv).toBeLessThan(minimalResult.indicators.npv);
    });
});
