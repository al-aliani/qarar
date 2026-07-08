/**
 * Unit Tests لمحرك مونت كارلو (MonteCarloEngine.js)
 * يحرس ضد خطأ NaN عندما تفشل جميع التكرارات (baseState فارغ/غير صالح).
 */
import { describe, it, expect } from 'vitest';
import { MonteCarloEngine } from '../MonteCarloEngine.js';
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

function assertNoNaN(stats) {
    for (const [key, value] of Object.entries(stats)) {
        expect(value, `stats.${key} must be finite`).toEqual(expect.any(Number));
        expect(Number.isFinite(value), `stats.${key} = ${value} must be finite`).toBe(true);
    }
}

describe('MonteCarloEngine - runSimulation', () => {
    it('does NOT produce NaN/undefined and flags not-ok when all iterations fail (null baseState)', () => {
        // calculateStudy(null) returns null → every iteration throws → results = []
        const result = MonteCarloEngine.runSimulation(null, 50, 0.15);

        expect(result.ok).toBe(false);
        expect(result.error).toBe('insufficient_data');
        expect(result.completedRuns).toBe(0);

        // No NaN / undefined leaking into the risk dashboard.
        assertNoNaN(result.stats);
        expect(result.stats.minNPV).toBe(0);
        expect(result.stats.maxNPV).toBe(0);
        expect(result.stats.avgNPV).toBe(0);
        expect(result.stats.successProbability).toBe(0);

        // Histogram must be a defined, renderable array (empty is fine).
        expect(Array.isArray(result.histogram)).toBe(true);
    });

    it('also handles an empty-object baseState without NaN', () => {
        const result = MonteCarloEngine.runSimulation({}, 20, 0.15);
        // Whether it completes or fails, stats must never be NaN/undefined.
        assertNoNaN(result.stats);
        expect(Array.isArray(result.histogram)).toBe(true);
    });

    it('yields finite avgNPV with p10 <= p50 <= p90 and min <= avg <= max for a normal run', () => {
        const study = createMinimalStudy();
        const result = MonteCarloEngine.runSimulation(study, 200, 0.15);

        expect(result.ok).toBe(true);
        expect(result.completedRuns).toBeGreaterThan(0);

        assertNoNaN(result.stats);
        const { minNPV, maxNPV, avgNPV, p10, p50, p90 } = result.stats;

        expect(Number.isFinite(avgNPV)).toBe(true);
        expect(p10).toBeLessThanOrEqual(p50);
        expect(p50).toBeLessThanOrEqual(p90);
        expect(minNPV).toBeLessThanOrEqual(avgNPV);
        expect(avgNPV).toBeLessThanOrEqual(maxNPV);

        // Every histogram bin must have a finite, non-negative count.
        for (const bin of result.histogram) {
            expect(Number.isFinite(bin.count)).toBe(true);
            expect(bin.count).toBeGreaterThanOrEqual(0);
        }
    });

    // تدقيق 2026-07-08 (البند 3): لا ابتلاع صامت لأخطاء التكرارات — يجب أن يُميَّز
    // «بيانات غير كافية» عن نجاح كامل، ويُعاد سبب الفشل صراحةً.
    it('valid baseState + valid overrides ⇒ لا فشل (failedRuns=0, failureReason=null)', () => {
        const result = MonteCarloEngine.runSimulation(createMinimalStudy(), 100, 0.15);
        expect(result.ok).toBe(true);
        expect(result.completedRuns).toBeGreaterThan(0);
        expect(result.failedRuns).toBe(0);
        expect(result.failureReason).toBeNull();
    });

    it('baseState فارغ (null) ⇒ ok:false مع سبب فشل واضح لا ابتلاع صامت', () => {
        const result = MonteCarloEngine.runSimulation(null, 30, 0.15);
        expect(result.ok).toBe(false);
        expect(result.error).toBe('insufficient_data');
        expect(result.failedRuns).toBe(30);           // كل التكرارات فشلت وعُدّت
        expect(typeof result.failureReason).toBe('string');
        expect(result.failureReason.length).toBeGreaterThan(0);
    });
});
