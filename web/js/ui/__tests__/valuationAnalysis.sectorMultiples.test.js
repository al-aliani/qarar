/**
 * مضاعفات تقييم مرجعية لكل قطاع (SECTOR_VALUATION_MULTIPLES) بدل ثابت واحد (3×) لكل الأنشطة.
 * resolveValuationMultiple يعيد استخدام detectSectorBenchmark نفسه (لا كاشف قطاع ثانٍ)،
 * ويسقط على GENERIC_VALUATION_MULTIPLE (=3، نفس الافتراضي القديم) لأي قطاع غير مكتشَف.
 */
import { describe, it, expect } from 'vitest';
import {
    resolveValuationMultiple,
    SECTOR_VALUATION_MULTIPLES,
    GENERIC_VALUATION_MULTIPLE,
    SECTOR_BENCHMARKS
} from '../../core/sectorBenchmarks.js';
import { ValuationAnalysis } from '../ValuationAnalysis.js';

describe('resolveValuationMultiple', () => {
    it('يختار مضاعف قطاع المطاعم/المقاهي لنص يطابق fnb', () => {
        const r = resolveValuationMultiple({ projectInfo: { sector: 'مطعم وجبات سريعة' } });
        expect(r.isGeneric).toBe(false);
        expect(r.multiple).toBe(SECTOR_VALUATION_MULTIPLES.fnb);
        expect(r.label).toBe(SECTOR_BENCHMARKS.fnb.label);
    });

    it('يختار مضاعف SaaS (الأعلى) لنص يطابق منصة رقمية', () => {
        const r = resolveValuationMultiple({ projectInfo: { sector: 'منصة SaaS للحجوزات' } });
        expect(r.isGeneric).toBe(false);
        expect(r.multiple).toBe(SECTOR_VALUATION_MULTIPLES.saas);
        expect(r.multiple).toBeGreaterThan(SECTOR_VALUATION_MULTIPLES.fnb);
    });

    it('يسقط على المضاعف العام (يطابق الافتراضي القديم 3×) عند تعذّر اكتشاف القطاع', () => {
        const r = resolveValuationMultiple({ projectInfo: { sector: 'نشاط غير مصنّف بلا كلمات مفتاحية' } });
        expect(r.isGeneric).toBe(true);
        expect(r.multiple).toBe(GENERIC_VALUATION_MULTIPLE);
        expect(GENERIC_VALUATION_MULTIPLE).toBe(3);
    });

    it('يسقط على المضاعف العام عند غياب أي نص قطاع/فكرة', () => {
        const r = resolveValuationMultiple({ projectInfo: {} });
        expect(r.isGeneric).toBe(true);
        expect(r.multiple).toBe(GENERIC_VALUATION_MULTIPLE);
    });
});

describe('ValuationAnalysis.calculateValuation — يستخدم المضاعف القطاعي بدل الثابت 3×', () => {
    function fakeResults() {
        return {
            incomeStatement: [
                { ebitda: 100000, netIncome: 20000, interest: 5000, depreciation: 10000, replacementCost: 0 }
            ]
        };
    }

    it('قطاع مطاعم: مضاعف مضاعفات السوق = SECTOR_VALUATION_MULTIPLES.fnb، والقيمة = EBITDA × المضاعف', () => {
        const va = Object.create(ValuationAnalysis.prototype);
        const state = {
            projectInfo: { sector: 'مطعم صغير' },
            assumptions: { discountRate: 0.10 },
            financing: { sources: { bankLoan: { amount: 0 } }, totalInvestment: 500000 }
        };
        const valuation = va.calculateValuation(state, fakeResults());

        expect(valuation.multiples.multiple).toBe(SECTOR_VALUATION_MULTIPLES.fnb);
        expect(valuation.multiples.isGenericSector).toBe(false);
        expect(valuation.multiples.ev).toBeCloseTo(100000 * SECTOR_VALUATION_MULTIPLES.fnb, 5);
    });

    it('قطاع SaaS: مضاعف أعلى من قطاع مطاعم لنفس EBITDA', () => {
        const va = Object.create(ValuationAnalysis.prototype);
        const fnbState = {
            projectInfo: { sector: 'مطعم صغير' },
            assumptions: { discountRate: 0.10 },
            financing: { sources: { bankLoan: { amount: 0 } }, totalInvestment: 500000 }
        };
        const saasState = {
            projectInfo: { sector: 'منصة رقمية SaaS' },
            assumptions: { discountRate: 0.10 },
            financing: { sources: { bankLoan: { amount: 0 } }, totalInvestment: 500000 }
        };

        const fnbValuation = va.calculateValuation(fnbState, fakeResults());
        const saasValuation = va.calculateValuation(saasState, fakeResults());

        expect(saasValuation.multiples.ev).toBeGreaterThan(fnbValuation.multiples.ev);
    });

    it('قطاع غير مكتشَف: يسقط على GENERIC_VALUATION_MULTIPLE (نفس سلوك الثابت القديم 3×)', () => {
        const va = Object.create(ValuationAnalysis.prototype);
        const state = {
            projectInfo: { sector: 'نشاط تجاري عام xyz123' },
            assumptions: { discountRate: 0.10 },
            financing: { sources: { bankLoan: { amount: 0 } }, totalInvestment: 500000 }
        };
        const valuation = va.calculateValuation(state, fakeResults());

        expect(valuation.multiples.multiple).toBe(GENERIC_VALUATION_MULTIPLE);
        expect(valuation.multiples.isGenericSector).toBe(true);
    });

    it('عند غياب نتائج المحرك (results فارغة): تبقى القيمة الاحتياطية متوافقة مع المضاعف العام القديم', () => {
        const va = Object.create(ValuationAnalysis.prototype);
        const valuation = va.calculateValuation({}, null);
        expect(valuation.multiples.multiple).toBe(GENERIC_VALUATION_MULTIPLE);
    });
});
