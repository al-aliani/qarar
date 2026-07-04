/**
 * اختبارات فحوصات الجاهزية التمويلية في بوابة QA (إطار المعايير + أعراف البنوك):
 * نسبة الإيرادات/الاستثمار القطاعية، توثيق مصادر CAPEX الكبيرة،
 * مساهمة التمويل الذاتي، ونسبة التوطين.
 */
import { describe, it, expect } from 'vitest';
import { runQAChecks } from '../qaChecks.js';
import { calculateStudy } from '../../core/engine.js';
import { SECTIONS } from '../../core/schema.js';

function cafeStudy(overrides = {}) {
    const base = {
        [SECTIONS.PROJECT_INFO]: { name: 'كافيه اختبار', sector: 'مقهى', businessModel: 'Independent' },
        assumptions: { projectionYears: 5, discountRate: 0.10, inflationRate: 0.02, hiddenOverheadsRate: 0 },
        [SECTIONS.TECHNICAL]: {
            equipment: [{ name: 'ماكينة قهوة', price: 85000, quantity: 1 }],
            buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: []
        },
        [SECTIONS.HR]: {
            positions: [
                { position: 'مدير', count: 1, salary: 8000, months: 12, nationality: 'saudi' },
                { position: 'باريستا', count: 2, salary: 4500, months: 12, nationality: 'expat' }
            ]
        },
        [SECTIONS.LOGISTICS]: { logistics: [] },
        [SECTIONS.ADMINISTRATIVE]: { administrative: [{ name: 'إيجار', monthly: 12000 }] },
        [SECTIONS.MARKETING]: { campaigns: [] },
        [SECTIONS.REVENUE]: {
            streams: [{ service: 'مشروبات', type: 'operating', customersPerMonth: 3000, avgPrice: 20, variableCostRate: 0.30, growthRate: 0.05 }]
        },
        [SECTIONS.SERVICES]: { items: [] },
        [SECTIONS.FINANCING]: { sources: {} },
        [SECTIONS.TECH_RESOURCES]: { techResources: [] },
        [SECTIONS.LEGAL]: { licenses: [] }
    };
    return { ...base, ...overrides };
}

const codes = (qa) => [...(qa.softWarnings || []), ...(qa.hardErrors || [])].map(w => w.code);

describe('نسبة الإيرادات التراكمية/الاستثمار حسب القطاع', () => {
    it('مقهى بإيرادات مبالغ فيها (>50×) يُنبَّه عليه', async () => {
        // إيرادات ضخمة بتكاليف متغيرة شبه معدومة وبلا فريق → رأس مال عامل ضئيل
        // فتقفز النسبة فوق الخط الأحمر (50×) لقطاع المقاهي
        const study = cafeStudy({
            [SECTIONS.HR]: { positions: [{ position: 'مدير', count: 1, salary: 3000, months: 12, nationality: 'saudi' }] },
            [SECTIONS.ADMINISTRATIVE]: { administrative: [] },
            [SECTIONS.REVENUE]: {
                streams: [{ service: 'مشروبات', type: 'operating', customersPerMonth: 20000, avgPrice: 25, variableCostRate: 0.05, growthRate: 0.05 }]
            }
        });
        const results = calculateStudy(study);
        const qa = await runQAChecks(study, results);
        expect(codes(qa)).toContain('REVENUE_TO_CAPEX_EXTREME');
    });

    it('مقهى ضمن النطاق (10–30×) لا يُنبَّه على النسبة', async () => {
        const study = cafeStudy();
        const results = calculateStudy(study);
        const ratio = results.incomeStatement.reduce((a, y) => a + y.revenue, 0) / results.capex.total;
        // تأكد أن السيناريو فعلاً داخل النطاق قبل فحص غياب التحذير
        expect(ratio).toBeGreaterThan(10);
        expect(ratio).toBeLessThan(30);
        const qa = await runQAChecks(study, results);
        expect(codes(qa)).not.toContain('REVENUE_TO_CAPEX_EXTREME');
        expect(codes(qa)).not.toContain('REVENUE_TO_CAPEX_HIGH');
        expect(codes(qa)).not.toContain('REVENUE_TO_CAPEX_LOW');
    });
});

describe('توثيق مصادر بنود CAPEX الكبيرة', () => {
    it('بند كبير بلا مصدر/ملاحظة يُنبَّه عليه', async () => {
        const study = cafeStudy({
            [SECTIONS.TECHNICAL]: {
                equipment: [{ name: 'خط إنتاج', price: 400000, quantity: 1 }],
                buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: []
            }
        });
        const results = calculateStudy(study);
        const qa = await runQAChecks(study, results);
        expect(codes(qa)).toContain('CAPEX_SOURCE_MISSING');
    });

    it('نفس البند مع مصدر موثق لا يُنبَّه عليه', async () => {
        const study = cafeStudy({
            [SECTIONS.TECHNICAL]: {
                equipment: [{ name: 'خط إنتاج', price: 400000, quantity: 1, notes: 'عرض سعر مورد — 3 عروض' }],
                buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: []
            }
        });
        const results = calculateStudy(study);
        const qa = await runQAChecks(study, results);
        expect(codes(qa)).not.toContain('CAPEX_SOURCE_MISSING');
    });
});

describe('مساهمة التمويل الذاتي مقابل القرض', () => {
    it('قرض 95% من الهيكل يُنبَّه عليه (البنوك تتوقع ≥20% ذاتياً)', async () => {
        const study = cafeStudy({
            [SECTIONS.FINANCING]: {
                sources: { bankLoan: { amount: 950000, interestRate: 0.065, termYears: 5 }, equity: { amount: 50000 } }
            }
        });
        const results = calculateStudy(study);
        const qa = await runQAChecks(study, results);
        expect(codes(qa)).toContain('EQUITY_SHARE_LOW');
    });

    it('ذاتي 30% لا يُنبَّه عليه', async () => {
        const study = cafeStudy({
            [SECTIONS.FINANCING]: {
                sources: { bankLoan: { amount: 700000, interestRate: 0.065, termYears: 5 }, equity: { amount: 300000 } }
            }
        });
        const results = calculateStudy(study);
        const qa = await runQAChecks(study, results);
        expect(codes(qa)).not.toContain('EQUITY_SHARE_LOW');
    });
});

describe('نسبة التوطين', () => {
    it('فريق 4 موظفين بلا سعودي واحد يُنبَّه عليه', async () => {
        const study = cafeStudy({
            [SECTIONS.HR]: {
                positions: [{ position: 'باريستا', count: 4, salary: 4500, months: 12, nationality: 'expat' }]
            }
        });
        const results = calculateStudy(study);
        const qa = await runQAChecks(study, results);
        expect(codes(qa)).toContain('SAUDIZATION_ZERO');
    });

    it('وجود سعودي واحد يزيل التنبيه', async () => {
        const study = cafeStudy();
        const results = calculateStudy(study);
        const qa = await runQAChecks(study, results);
        expect(codes(qa)).not.toContain('SAUDIZATION_ZERO');
    });
});
