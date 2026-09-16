/**
 * @vitest-environment jsdom
 *
 * تدقيق شامل 2026-09-16: قسم "الملخص التنفيذي" في تقرير Word/PDF المُصدَّر كان يعرض
 * جدول NPV/IRR/الاسترداد/التوصية بثقة كاملة حتى لدراسة بإيراد وحيد بلا أي تكلفة —
 * نفس بوابة hasMinimumFinancialData المستخدمة في DecisionDashboard.js تُطبَّق الآن هنا.
 */
import { describe, it, expect } from 'vitest';
import { ReportGenerator } from '../ReportGenerator.js';

const revenueOnlyState = {
    projectInfo: { name: 'دراسة بإيراد بلا تكلفة' },
    revenue: { streams: [{ type: 'operating', customersPerMonth: 500, avgPrice: 100 }] },
    assumptions: {},
};

const fullState = {
    ...revenueOnlyState,
    technical: { equipment: [{ name: 'معدات', price: 100000, quantity: 1 }] },
};

const resultsWithConfidentNumbers = {
    indicators: { npv: 1612007, irr: null, paybackPeriod: 0.1 },
    capex: { total: 0 },
    decision: 'REVISE',
};

describe('ReportGenerator — قسم الملخص التنفيذي يحترم بوابة اكتمال بيانات التكلفة', () => {
    it('دراسة بإيراد بلا تكلفة: لا يعرض جدول NPV/IRR واثقاً، يعرض تنبيه اكتمال بيانات بدلاً منه', () => {
        const { html } = ReportGenerator._renderSection('executive_summary', revenueOnlyState, resultsWithConfidentNumbers, {}, 1, 'ar');
        expect(html).toContain('لا توجد بيانات كافية');
        expect(html).not.toContain('<table');
    });

    it('لا انحدار: دراسة مكتملة البيانات (إيراد + معدات) ما زالت تعرض جدول NPV/IRR بالأرقام الفعلية', () => {
        const { html } = ReportGenerator._renderSection('executive_summary', fullState, resultsWithConfidentNumbers, {}, 1, 'ar');
        expect(html).toContain('<table');
        expect(html).toContain('١٬٦١٢٬٠٠٧');
        expect(html).not.toContain('لا توجد بيانات كافية');
    });
});
