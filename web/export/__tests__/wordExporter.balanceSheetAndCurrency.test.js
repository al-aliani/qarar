/**
 * تدقيق حي 2026-07-22 (تقرير go/no-go)، مُتحقَّق منه 2026-08-21: جدول الميزانية في
 * Word لم يكن يعرض صفّاً لفجوة التمويل ولا للإجمالي النهائي (الخصوم + حقوق الملكية)
 * إطلاقاً رغم أن totalLiabilitiesAndEquity يضمّ fundingGap صمتاً (lib/calc/balanceSheet.js).
 * كذلك formatCurrency كانت تختصر أي مبلغ ≥ مليون إلى "1.6 مليون ريال" في كل جداول
 * القوائم المالية (لا بطاقات KPI فقط)، مفقدةً حتى ±50,000 ﷼ من الدقة.
 */
import { describe, it, expect } from 'vitest';
import { WordExporter } from '../wordExporter.js';

function collectStrings(node, out = []) {
    if (node == null) return out;
    if (typeof node === 'string') { out.push(node); return out; }
    if (Array.isArray(node)) { node.forEach((n) => collectStrings(n, out)); return out; }
    if (typeof node === 'object') {
        if (typeof node.text === 'string') out.push(node.text);
        for (const key of ['root', 'children', 'options']) {
            if (node[key] !== undefined) collectStrings(node[key], out);
        }
    }
    return out;
}

function fakeStore(state) {
    return { getState: () => state };
}

// رأس مال مدفوع أقل عمداً من تكلفة المعدات ⇒ fundingGap > 0 مضمون، ومبلغ معدات > مليون
// ريال عمداً ⇒ يقع بالضبط في نطاق اختصار formatCurrency القديم (≥ 1,000,000).
function underfundedStudy() {
    return {
        projectInfo: { name: 'دراسة اختبار الميزانية', businessModel: 'Independent' },
        assumptions: { projectionYears: 3, discountRate: 0.10, inflationRate: 0.02, taxRate: 0 },
        marketSizing: {},
        technical: { equipment: [{ price: 1650000, quantity: 1 }], buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: [] },
        hr: { positions: [{ position: 'موظف', count: 1, salary: 4000, months: 12, nationality: 'saudi' }] },
        logistics: { logistics: [] },
        administrative: { administrative: [] },
        marketing: { campaigns: [] },
        revenue: { streams: [{ type: 'operating', customersPerMonth: 2000, avgPrice: 40, variableCostRate: 0.3, growthRate: 0 }] },
        services: { items: [] },
        financing: { sources: { equity: { amount: 100000, percentage: 100 } } },
        techResources: { techResources: [] },
        legal: { licenses: [] }
    };
}

describe('WordExporter — جدول الميزانية يعرض فجوة التمويل والإجمالي، والمبالغ بدقة كاملة', () => {
    it('نتائج المحرك تؤكد fundingGap > 0 ومعدات ≥ مليون ريال (شرط الاختبار)', () => {
        const exporter = new WordExporter(fakeStore(underfundedStudy()));
        expect(exporter.results?.balanceSheets?.[0]?.fundingGap).toBeGreaterThan(0);
    });

    it('createBalanceSheetTable() يتضمّن صفّي "فجوة تمويل غير مغطاة" و"الخصوم + حقوق الملكية"', () => {
        const exporter = new WordExporter(fakeStore(underfundedStudy()));
        const table = exporter.createBalanceSheetTable();
        const strings = collectStrings(table);
        expect(strings.some((s) => s.includes('فجوة تمويل غير مغطاة'))).toBe(true);
        expect(strings.some((s) => s.includes('الخصوم + حقوق الملكية'))).toBe(true);
    });

    it('المبالغ الكبيرة (المعدات ≥ مليون ريال) لا تُختصر إلى "X.X مليون ريال" في جدول قائمة الدخل', () => {
        const exporter = new WordExporter(fakeStore(underfundedStudy()));
        const table = exporter.createIncomeStatementTable();
        const strings = collectStrings(table);
        expect(strings.some((s) => s.includes('مليون'))).toBe(false);
    });

    it('المبالغ الكبيرة لا تُختصر في جدول الميزانية نفسه', () => {
        const exporter = new WordExporter(fakeStore(underfundedStudy()));
        const table = exporter.createBalanceSheetTable();
        const strings = collectStrings(table);
        expect(strings.some((s) => s.includes('مليون'))).toBe(false);
    });
});
