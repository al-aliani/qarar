/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-15: PPTXExporter.export() كان يفشل 100% من المرات — كل الشرائح
 * تستخدم `pptxgen.ShapeType.rect/line` (الكلاس المستورَد نفسه)، بينما ShapeType
 * خاصية على الـinstance فقط (`this.pptx.ShapeType`)، فيرمي فوراً عند أول شريحة
 * محتوى (addSlideTitle). ميزة تصدير عرض المستثمر كانت مربوطة بزر حقيقي في
 * ExportMenu لكن معطّلة بالكامل خلف try/catch صامت (toast خطأ فقط).
 */
import { describe, it, expect } from 'vitest';
import { PPTXExporter } from '../pptxExporter.js';

function fakeStore(state) {
    return { getState: () => state };
}

function baseState() {
    return {
        projectInfo: { name: 'مشروع اختبار', concept: 'مقهى تجريبي', description: 'وصف تجريبي' },
        marketSizing: { tam: { value: 5000000 }, sam: { value: 1200000 }, som: { value: 300000 } },
        assumptions: { projectionYears: 5, discountRate: 0.10, inflationRate: 0.02, taxRate: 0 },
        executiveSummary: {},
        riskAnalysis: { risks: [] },
        reportSectionOrder: []
    };
}

describe('PPTXExporter — export() ينجح فعلياً', () => {
    it('يبني كل الشرائح (بما فيها الشرائح التي ترسم أشكال rect/line) بلا استثناء', async () => {
        const exporter = new PPTXExporter(fakeStore(baseState()));
        const result = await exporter.export();
        expect(result.success).toBe(true);
        expect(result.fileName).toContain('.pptx');
    });
});
