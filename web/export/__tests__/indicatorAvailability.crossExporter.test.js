// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { WordExporter } from '../wordExporter.js';
import { BankReportGenerator } from '../BankReportGenerator.js';
import { generateExecutiveSummary } from '../../js/services/InternalAIGenerator.js';

function collectText(node, out = []) {
    if (node == null) return out;
    if (typeof node === 'string') { out.push(node); return out; }
    if (Array.isArray(node)) { node.forEach(item => collectText(item, out)); return out; }
    if (typeof node === 'object') {
        if (typeof node.text === 'string') out.push(node.text);
        for (const key of ['root', 'children', 'options']) collectText(node[key], out);
    }
    return out;
}

const weakStudy = {
    projectInfo: { name: 'مشروع بلا تدفقات كافية', concept: 'خدمة', city: 'الرياض' },
    revenue: { streams: [] },
    assumptions: { projectionYears: 5 },
    financing: { sources: {} }
};

describe('القيم غير المتاحة متسقة بين التقارير', () => {
    it('Word لا يحوّل ROI المفقود إلى 0.0%', () => {
        const exporter = new WordExporter({ getState: () => weakStudy });
        exporter.results = { indicators: { npv: 0, irr: null, roi: null, paybackPeriod: null } };
        const text = collectText(exporter.createFinancialTable()).join(' ');

        expect(text).toContain('غير محقق');
        expect(text).not.toContain('0.0%');
    });

    it('تقرير البنك لا يصنّف IRR المفقود كأنه تحت الحد', () => {
        const html = BankReportGenerator.generateHTML({ getState: () => weakStudy });
        expect(html).toContain('غير متاح — لا يمكن تصنيفه');
    });

    it('الملخص التنفيذي يعرض الصفر الحقيقي ويحذف القيمة المفقودة', () => {
        const zero = generateExecutiveSummary(weakStudy, {
            indicators: { npv: 0, irr: 0, roi: 0, profitMargin: 0 },
            decision: 'REVISE'
        });
        expect(zero).toContain('صافي القيمة الحالية: ٠ ريال');
        expect(zero).toContain('معدل العائد الداخلي: 0.0%');
        expect(zero).toContain('العائد على الاستثمار: 0.0%');

        const missing = generateExecutiveSummary(weakStudy, { indicators: {}, decision: 'REVISE' });
        expect(missing).not.toContain('معدل العائد الداخلي:');
        expect(missing).not.toContain('العائد على الاستثمار:');
    });
});
