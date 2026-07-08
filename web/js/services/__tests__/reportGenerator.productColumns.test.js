/**
 * تدقيق 2026-07-08 (ملاحظة عالية، منهجية IFC/UNIDO): التقرير النهائي المُصدَّر كان
 * يُسقط حقول تفرّد المنتج (uniqueFeatures/valueAdded) بالكامل من جدول المنتجات حتى
 * لو أُدخلت بشكل صحيح — عمودان فقط. الآن الجدول يعرض العمودين الإضافيين.
 */
import { describe, it, expect } from 'vitest';
import { ReportGenerator } from '../ReportGenerator.js';
import { createEmptyStudy } from '../../core/schema.js';

describe('ReportGenerator — جدول المنتجات يعرض تفرّد المنتج', () => {
    it('يعرض عمودي "الخصائص الفريدة" و"القيمة المضافة" بقيمهما الفعلية', () => {
        const state = createEmptyStudy();
        state.projectInfo.products = [
            { type: 'final', name: 'قهوة مختصة', description: 'وصف', uniqueFeatures: 'تحميص محلي', valueAdded: 'جودة عالية', customerBenefit: 'طعم مميز' }
        ];
        const results = ReportGenerator.calculateResults(state);
        const section = ReportGenerator._renderSection('intro_feasibility', state, results, state.projectInfo, 1);
        const html = section.html;

        expect(html).toContain('الخصائص الفريدة');
        expect(html).toContain('القيمة المضافة');
        expect(html).toContain('تحميص محلي');
        expect(html).toContain('جودة عالية');
    });
});
