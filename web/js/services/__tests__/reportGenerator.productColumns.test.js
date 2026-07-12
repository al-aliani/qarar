/**
 * تدقيق 2026-07-08 (ملاحظة عالية، منهجية IFC/UNIDO): التقرير النهائي المُصدَّر كان
 * يُسقط حقول تفرّد المنتج (uniqueFeatures/valueAdded) بالكامل من جدول المنتجات حتى
 * لو أُدخلت بشكل صحيح — عمودان فقط. الآن الجدول يعرض العمودين الإضافيين.
 *
 * تدقيق دفعة 3 (2026-07-12، اختبار عميل بقالة): «الخصائص الفريدة» و«القيمة المضافة»
 * دُمجا في عمود واحد في schema.js (products.uniqueFeatures) — كانا يطلبان عملياً
 * نفس الإجابة لمنتج بسيط. التقرير يدمج valueAdded القديم (إن وُجد في دراسة محفوظة
 * سابقاً) مع uniqueFeatures عرضاً بدل عمود مستقل، فيبقى كلا النصين ظاهرين في الإخراج.
 */
import { describe, it, expect } from 'vitest';
import { ReportGenerator } from '../ReportGenerator.js';
import { createEmptyStudy } from '../../core/schema.js';

describe('ReportGenerator — جدول المنتجات يعرض تفرّد المنتج', () => {
    it('يعرض عمود "الميزة الفريدة / القيمة المضافة" المدمج بقيمتيه الفعليتين', () => {
        const state = createEmptyStudy();
        state.projectInfo.products = [
            { type: 'final', name: 'قهوة مختصة', description: 'وصف', uniqueFeatures: 'تحميص محلي', valueAdded: 'جودة عالية', customerBenefit: 'طعم مميز' }
        ];
        const results = ReportGenerator.calculateResults(state);
        const section = ReportGenerator._renderSection('intro_feasibility', state, results, state.projectInfo, 1);
        const html = section.html;

        expect(html).toContain('الميزة الفريدة / القيمة المضافة');
        expect(html).toContain('تحميص محلي');
        expect(html).toContain('جودة عالية');
    });
});
