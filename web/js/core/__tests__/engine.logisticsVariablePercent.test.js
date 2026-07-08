/**
 * تدقيق 2026-07-08 (ملاحظة عالية #38): عمود «% متغير» (variablePercent) في جدول
 * الموارد اللوجستية كان معروضاً في الواجهة (schema.js) لكن المحرك يحسب كامل تكلفة
 * كل بند كتكلفة ثابتة (annualLogistics) دائماً، متجاهلاً variablePercent تماماً —
 * فمشروع بند لوجستي "90% متغير" كان يُعامَل وكأنه بند إيجار ثابت 100%.
 */
import { describe, it, expect } from 'vitest';
import { calculateStudy } from '../engine.js';
import { SECTIONS } from '../schema.js';
import { DynamicTable } from '../../ui/DynamicTable.js';

function makeStudy(logisticsItem) {
    return {
        [SECTIONS.PROJECT_INFO]: { businessModel: 'Independent' },
        assumptions: { projectionYears: 3, discountRate: 0.10, inflationRate: 0, hiddenOverheadsRate: 0 },
        [SECTIONS.TECHNICAL]: {
            equipment: [{ price: 100000, quantity: 1 }],
            buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: []
        },
        [SECTIONS.HR]: { positions: [] },
        [SECTIONS.LOGISTICS]: { logistics: logisticsItem ? [logisticsItem] : [] },
        [SECTIONS.ADMINISTRATIVE]: { administrative: [] },
        [SECTIONS.MARKETING]: { campaigns: [] },
        [SECTIONS.REVENUE]: {
            streams: [{ type: 'operating', customersPerMonth: 500, avgPrice: 100, variableCostRate: 0.30, growthRate: 0 }]
        },
        [SECTIONS.SERVICES]: { items: [] },
        [SECTIONS.FINANCING]: { sources: {} },
        [SECTIONS.TECH_RESOURCES]: { techResources: [] },
        [SECTIONS.LEGAL]: { licenses: [] }
    };
}

describe('اللوجستيات: % متغير يقسم التكلفة السنوية بين الثابت والمتغير (#38)', () => {
    it('variablePercent=0 (افتراضي): كامل تكلفة البند ثابتة كما كان سابقاً', () => {
        const r = calculateStudy(makeStudy({ name: 'إيجار مستودع', monthly: 10000, variablePercent: 0 }));
        expect(r.opex.rentAdminAnnual).toBeCloseTo(120000, 6);
        // لا أثر على التكاليف المتغيرة (تبقى فقط من variableCostRate على الإيراد)
        const y1 = r.incomeStatement[0];
        const expectedVCFromRevenueOnly = 500 * 12 * 100 * 0.30;
        expect(y1.variableCosts).toBeCloseTo(expectedVCFromRevenueOnly, 2);
    });

    it('variablePercent=1: كامل تكلفة البند تنتقل إلى التكاليف المتغيرة، لا الثابتة', () => {
        const r = calculateStudy(makeStudy({ name: 'وقود توصيل', monthly: 10000, variablePercent: 1 }));
        expect(r.opex.rentAdminAnnual).toBeCloseTo(0, 6);
        const y1 = r.incomeStatement[0];
        const expectedVCFromRevenueOnly = 500 * 12 * 100 * 0.30;
        // التكلفة المتغيرة الآن تشمل كامل الـ120,000 السنوية للبند اللوجستي أيضاً
        expect(y1.variableCosts).toBeCloseTo(expectedVCFromRevenueOnly + 120000, 2);
    });

    it('variablePercent=0.4: يُقسَّم البند 40% متغير / 60% ثابت بدقة', () => {
        const r = calculateStudy(makeStudy({ name: 'نقل وتوزيع', monthly: 10000, variablePercent: 0.4 }));
        expect(r.opex.rentAdminAnnual).toBeCloseTo(120000 * 0.6, 6);
        const y1 = r.incomeStatement[0];
        const expectedVCFromRevenueOnly = 500 * 12 * 100 * 0.30;
        expect(y1.variableCosts).toBeCloseTo(expectedVCFromRevenueOnly + 120000 * 0.4, 2);
    });

    it('قيمة variablePercent خارج [0,1] (خطأ إدخال) تُقيَّد بأمان لا تُنتج تكلفة سالبة أو تضخّم زائد', () => {
        const r = calculateStudy(makeStudy({ name: 'بند خاطئ', monthly: 10000, variablePercent: 5 }));
        // 5 تُقيَّد إلى 1 (100% متغير) لا 500%
        expect(r.opex.rentAdminAnnual).toBeCloseTo(0, 6);
        const y1 = r.incomeStatement[0];
        const expectedVCFromRevenueOnly = 500 * 12 * 100 * 0.30;
        expect(y1.variableCosts).toBeCloseTo(expectedVCFromRevenueOnly + 120000, 2);
    });

    it('DynamicTable يتعامل مع variablePercent ككسر (0–1) مثل variableCostRate تماماً', () => {
        expect(DynamicTable.isFractionPercentColumn('variablePercent')).toBe(true);
    });
});
