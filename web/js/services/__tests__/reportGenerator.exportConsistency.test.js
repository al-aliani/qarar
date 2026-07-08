/**
 * تدقيق 2026-07-09: يثبّت إصلاحين في ReportGenerator.js:
 *
 * (1) عدم اتساق عدد السنوات بين أقسام التقرير: قائمة الدخل والميزانية كانتا تعرضان
 *     كل سنوات الدراسة (حتى سقف تعسفي 7)، بينما قسم التدفقات النقدية (renderCashFlow)
 *     كان يقتصر على أول 5 سنوات فقط — ما يجعل التدفقات النقدية لا تتطابق مع بقية
 *     التقرير في أي دراسة بأفق 6 أو 7 سنوات (فجوة يلاحظها أي ممول أو مدقق فوراً).
 *
 * (2) غياب تفصيل مصادر الإيراد: قسم قائمة الدخل لم يكن يعرض إطلاقاً تفصيل
 *     state.revenue.streams (لكل مصدر: العملاء شهرياً × متوسط السعر) رغم أن
 *     المستخدم يُدخل هذه البيانات فعلياً — الآن تظهر كجدول فرعي (سنة أولى فقط).
 */
import { describe, it, expect } from 'vitest';
import { ReportGenerator } from '../ReportGenerator.js';
import { createEmptyStudy, SECTIONS } from '../../core/schema.js';
import { calculateStudy } from '../../core/engine.js';
import { formatCurrency } from '../../utils/formatters.js';

// دراسة واقعية بحد أدنى من البيانات لكل الأقسام اللازمة لإنتاج قائمة دخل/تدفقات
// نقدية/ميزانية فعلية بأفق 7 سنوات (نمط مطابق لـ marginalStudy في
// scenarioAnalysis.test.js وreportGenerator.orgStructure.test.js).
function sevenYearStudy() {
    const data = createEmptyStudy();
    data[SECTIONS.PROJECT_INFO] = { ...data[SECTIONS.PROJECT_INFO], businessModel: 'Independent' };
    data.assumptions = { ...data.assumptions, projectionYears: 7, discountRate: 0.10, inflationRate: 0.02, taxRate: 0 };
    data[SECTIONS.TECHNICAL] = { equipment: [{ price: 300000, quantity: 1 }], buildings: [], furniture: [{ price: 50000, quantity: 1 }], establishmentCosts: [], capacityUtilization: [] };
    data[SECTIONS.HR] = { positions: [{ position: 'شيف', count: 3, salary: 5000, months: 12, nationality: 'saudi' }] };
    data[SECTIONS.LOGISTICS] = { logistics: [] };
    data[SECTIONS.ADMINISTRATIVE] = { administrative: [{ name: 'إيجار', monthly: 12000 }] };
    data[SECTIONS.MARKETING] = { campaigns: [] };
    data[SECTIONS.REVENUE] = { streams: [{ type: 'operating', customersPerMonth: 700, avgPrice: 100, variableCostRate: 0.30, growthRate: 0.03 }] };
    data[SECTIONS.SERVICES] = { items: [] };
    data[SECTIONS.FINANCING] = { sources: { equity: { amount: 250000 }, bankLoan: { amount: 150000, interestRate: 0.07, termYears: 5, gracePeriodMonths: 0, repaymentType: 'equal' } } };
    data[SECTIONS.TECH_RESOURCES] = { techResources: [] };
    data[SECTIONS.LEGAL] = { licenses: [] };
    return data;
}

describe('ReportGenerator — إصلاح سقف السنوات المتضارب بين الأقسام (Bug 1)', () => {
    it('قائمة الدخل تعرض كل السنوات السبع (لا سقف 7 وهمي كان يقتصر بالصدفة)', () => {
        const state = sevenYearStudy();
        const results = calculateStudy(state);
        expect(results.incomeStatement.length).toBe(7);

        const section = ReportGenerator._renderSection('income_statement', state, results, null, 1);
        expect(section).not.toBeNull();
        expect(section.html).toContain('السنة 7');
    });

    it('قسم التدفقات النقدية يعرض أيضاً كل السنوات السبع — لم يعد مقصوراً على 5 فقط', () => {
        const state = sevenYearStudy();
        const results = calculateStudy(state);
        expect(results.cashFlow.length).toBeGreaterThan(5);

        const section = ReportGenerator._renderSection('cash_flow', state, results, null, 1);
        expect(section).not.toBeNull();
        expect(section.html).toContain('السنة 7');
        // لا يقتصر عرض السنوات على 5 كما كان سابقاً
        expect(section.html).toContain('السنة 6');

        // تأكيد مباشر عبر renderCashFlow نفسها (بمعزل عن أي منطق آخر في _renderSection)
        const rawCashFlowHtml = ReportGenerator.renderCashFlow(results.cashFlow);
        const yearHeaderMatches = rawCashFlowHtml.match(/السنة \d+/g) || [];
        expect(yearHeaderMatches.length).toBe(7);
    });

    it('الميزانية العمومية تعرض أيضاً كل السنوات دون سقف 7 صلب', () => {
        const state = sevenYearStudy();
        const results = calculateStudy(state);
        const section = ReportGenerator._renderSection('balance_sheet', state, results, null, 1);
        expect(section).not.toBeNull();
        expect(section.html).toContain('السنة 7');
    });
});

describe('ReportGenerator — تفصيل مصادر الإيراد في قائمة الدخل (Bug 2)', () => {
    it('يعرض أسماء مصادر الإيراد وقيمة إيراد السنة الأولى المحسوبة لكل مصدر', () => {
        const state = sevenYearStudy();
        state.revenue.streams = [
            { name: 'الوجبات داخل المطعم', customersPerMonth: 500, avgPrice: 80, growthRate: 0.03, type: 'operating' },
            { name: 'التوصيل الإلكتروني', customersPerMonth: 300, avgPrice: 60, growthRate: 0.05, type: 'operating' },
        ];
        const results = calculateStudy(state);
        const section = ReportGenerator._renderSection('income_statement', state, results, null, 1);

        expect(section).not.toBeNull();
        expect(section.html).toContain('تفصيل مصادر الإيراد (السنة الأولى)');
        expect(section.html).toContain('الوجبات داخل المطعم');
        expect(section.html).toContain('التوصيل الإلكتروني');

        // القيمة المحسوبة لمصدر "التوصيل الإلكتروني": 300 عميل × 12 شهر × 60 ريال = 216,000
        const expectedYear1Revenue = formatCurrency(300 * 12 * 60);
        expect(section.html).toContain(expectedYear1Revenue);
    });

    it('عند غياب streams (مصفوفة فارغة) لا يظهر عنوان القسم الفرعي إطلاقاً — لا جدول فارغ مضلِّل', () => {
        const state = sevenYearStudy();
        state.revenue.streams = [];
        const results = calculateStudy(state);
        const section = ReportGenerator._renderSection('income_statement', state, results, null, 1);

        expect(section).not.toBeNull();
        expect(section.html).not.toContain('تفصيل مصادر الإيراد');
    });

    it('يستخدم fallback الاسم من stream.service ثم تسمية عامة عند غياب كليهما', () => {
        const state = sevenYearStudy();
        state.revenue.streams = [
            { service: 'اشتراكات شهرية', customersPerMonth: 100, avgPrice: 200, type: 'operating' },
            { customersPerMonth: 50, avgPrice: 40, type: 'operating' },
        ];
        const results = calculateStudy(state);
        const section = ReportGenerator._renderSection('income_statement', state, results, null, 1);

        expect(section.html).toContain('اشتراكات شهرية');
        expect(section.html).toContain('مصدر إيراد');
    });

    it('يهرب (escape) اسم مصدر الإيراد — لا حقن HTML عبر بيانات المستخدم', () => {
        const state = sevenYearStudy();
        state.revenue.streams = [
            { name: '<img src=x onerror=alert(1)>', customersPerMonth: 100, avgPrice: 50, type: 'operating' },
        ];
        const results = calculateStudy(state);
        const section = ReportGenerator._renderSection('income_statement', state, results, null, 1);

        expect(section.html).not.toContain('<img src=x onerror=alert(1)>');
        expect(section.html).toContain('&lt;img');
    });
});
