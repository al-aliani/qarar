/**
 * تدقيق 2026-07-08 (ملاحظة عالية #16): خطوة «الهيكل التنظيمي والحوكمة» تجمع
 * المخطط التنظيمي (departments) وخطة التوطين (saudization) لكن لا يظهر أي منهما
 * في التقرير النهائي المُصدَّر أو أي مسار قرار (عدا بندين ثانويين: المجلس
 * الاستشاري ومؤشرات الأداء، عبر sectionExporter.js المنفصل تماماً). هذا يثبّت
 * دمجهما فعلياً في ReportGenerator (قسم 'org_structure' الجديد).
 */
import { describe, it, expect } from 'vitest';
import { ReportGenerator } from '../ReportGenerator.js';
import { createEmptyStudy } from '../../core/schema.js';
import { DEFAULT_REPORT_SECTION_ORDER } from '../../core/schema.js';

describe('ReportGenerator — قسم الهيكل التنظيمي وخطة التوطين', () => {
    it('org_structure مُدرَج في ترتيب أقسام التقرير الافتراضي', () => {
        expect(DEFAULT_REPORT_SECTION_ORDER).toContain('org_structure');
    });

    it('يعرض المخطط التنظيمي (القسم/المسؤول/المسؤوليات/يتبع لـ) بالقيم الفعلية', () => {
        const state = createEmptyStudy();
        state.orgStructure = {
            departments: [
                { id: 'd1', name: 'الإدارة العامة', head: 'أحمد العتيبي', responsibilities: 'الإشراف الكامل', parentId: null },
                { id: 'd2', name: 'العمليات', head: 'سارة القحطاني', responsibilities: 'إدارة الفروع اليومية', parentId: 'd1' },
            ]
        };
        const results = ReportGenerator.calculateResults(state);
        const section = ReportGenerator._renderSection('org_structure', state, results, null, 1);

        expect(section).not.toBeNull();
        expect(section.html).toContain('المخطط التنظيمي');
        expect(section.html).toContain('أحمد العتيبي');
        expect(section.html).toContain('سارة القحطاني');
        expect(section.html).toContain('إدارة الفروع اليومية');
        // العمود "يتبع لـ" يعرض اسم القسم الأب (الإدارة العامة) لا مجرد المعرّف الخام d1
        expect(section.html).toContain('الإدارة العامة');
    });

    it('يعرض خطة التوطين (النسبة الحالية/المستهدفة/خطة التحقيق) بالقيم الفعلية', () => {
        const state = createEmptyStudy();
        state.orgStructure = {
            saudization: { currentPercentage: 28, targetPercentage: 45, plan: 'توظيف 4 كوادر سعودية خلال 12 شهراً في العمليات والمبيعات' }
        };
        const results = ReportGenerator.calculateResults(state);
        const section = ReportGenerator._renderSection('org_structure', state, results, null, 1);

        expect(section).not.toBeNull();
        expect(section.html).toContain('خطة التوطين');
        expect(section.html).toContain('28');
        expect(section.html).toContain('45');
        expect(section.html).toContain('توظيف 4 كوادر سعودية');
    });

    it('لا مخطط تنظيمي ولا خطة توطين مُدخَلة: يُتخطّى القسم بالكامل (لا صف فارغ مضلِّل في التقرير)', () => {
        const state = createEmptyStudy();
        const results = ReportGenerator.calculateResults(state);
        const section = ReportGenerator._renderSection('org_structure', state, results, null, 1);

        expect(section).toBeNull();
    });

    it('مخطط تنظيمي فارغ الأسماء (أقسام بلا name) يُعامَل كغياب بيانات — لا صفوف فارغة', () => {
        const state = createEmptyStudy();
        state.orgStructure = { departments: [{ id: 'd1', name: '', head: '', responsibilities: '', parentId: null }] };
        const results = ReportGenerator.calculateResults(state);
        const section = ReportGenerator._renderSection('org_structure', state, results, null, 1);

        expect(section).toBeNull();
    });

    it('currentPercentage=0/targetPercentage=0 هي القيمة الافتراضية لدراسة بكر (createEmptyStudy) — لا تُميَّز عن "لم يُدخَل شيء"، فيُتخطّى القسم', () => {
        const state = createEmptyStudy();
        // تأكيد صريح أن هذا هو الافتراضي الفعلي قبل أي إدخال مستخدم
        expect(state.orgStructure.saudization).toEqual({ targetPercentage: 0, currentPercentage: 0, plan: '' });
        const results = ReportGenerator.calculateResults(state);
        const section = ReportGenerator._renderSection('org_structure', state, results, null, 1);
        expect(section).toBeNull();
    });

    it('currentPercentage مُدخَلة فعلياً (15) لكن بلا هدف أو خطة: لا تكفي وحدها لإثبات إدخال حقيقي — يُتخطّى القسم أيضاً', () => {
        const state = createEmptyStudy();
        state.orgStructure = { saudization: { currentPercentage: 15, targetPercentage: 0, plan: '' } };
        const results = ReportGenerator.calculateResults(state);
        const section = ReportGenerator._renderSection('org_structure', state, results, null, 1);
        // قرار تصميمي: currentPercentage وحدها (حتى لو رقماً حقيقياً كـ15) لا تُميَّز
        // موثوقاً عن حالات أخرى غامضة؛ الإشارة الموثوقة هي targetPercentage>0 أو نص خطة.
        expect(section).toBeNull();
    });

    it('targetPercentage>0 وحدها (بلا currentPercentage أو خطة) كافية لإظهار القسم', () => {
        const state = createEmptyStudy();
        state.orgStructure = { saudization: { currentPercentage: 0, targetPercentage: 30, plan: '' } };
        const results = ReportGenerator.calculateResults(state);
        const section = ReportGenerator._renderSection('org_structure', state, results, null, 1);
        expect(section).not.toBeNull();
        expect(section.html).toContain('30');
    });
});
