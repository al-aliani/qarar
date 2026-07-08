/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-08 (ملاحظة حرجة UX): خطوة «تفاصيل الفكرة» [3] كانت تُكرّر بالكامل
 * نموذج خطوة «معلومات المشروع» [2] (~49 حقلاً) لأن stepId يُعاد تعيينه إلى dataSection
 * (projectInfo) قبل فحص الشرط، فيدخل نفس فرع رسم الحقول الأساسية+المتقدمة خطأً.
 */
import { describe, it, expect } from 'vitest';
import { Wizard } from '../Wizard.js';
import { SECTIONS, createEmptyStudy } from '../../core/schema.js';

function fakeStore(state) {
    return { get: () => state, getState: () => state, update: () => {}, subscribe: () => {} };
}

describe('Wizard — لا ازدواج بين معلومات المشروع وتفاصيل الفكرة', () => {
    it('خطوة projectDetails لا ترسم حقول projectInfo الأساسية (~49 حقلاً) أو قسم "حقول متقدمة"', () => {
        const state = createEmptyStudy();
        const wizard = new Wizard('missing-container', fakeStore(state), {}, {
            steps: [
                { id: SECTIONS.PROJECT_INFO, label: 'معلومات المشروع', isForm: true },
                { id: 'projectDetails', dataSection: SECTIONS.PROJECT_INFO, label: 'تفاصيل الفكرة', tables: ['products', 'introServices', 'customerValues'] },
            ]
        });
        // renderStep يكتب في this.container (عبر querySelector لاحقاً) — نستخدم حاوية فعلية
        document.body.innerHTML = `<div id="wc"></div>`;
        wizard.container = document.getElementById('wc');

        wizard.renderStep('projectDetails', wizard.steps[1], 1);
        const html = wizard.container.innerHTML;

        expect(html).not.toContain('حقول متقدمة');
        // اسم المشروع حقل أساسي من نموذج projectInfo — لا يجب أن يظهر في خطوة تفاصيل الفكرة
        expect(html).not.toMatch(/name="projectInfo\.name"|data-field="name"/);
        // لكن جداول الخطوة نفسها (منتجات/خدمات) يجب أن تظهر كحاويات
        expect(html).toContain('table-products');
        expect(html).toContain('table-introServices');
    });

    it('خطوة projectInfo نفسها (لا dataSection) تستمر برسم النموذج الأساسي/المتقدم كالمعتاد', () => {
        const state = createEmptyStudy();
        const wizard = new Wizard('missing-container', fakeStore(state), {}, {
            steps: [
                { id: SECTIONS.PROJECT_INFO, label: 'معلومات المشروع', isForm: true, tables: ['glossary'] },
            ]
        });
        document.body.innerHTML = `<div id="wc"></div>`;
        wizard.container = document.getElementById('wc');

        wizard.renderStep(SECTIONS.PROJECT_INFO, wizard.steps[0], 0);
        const html = wizard.container.innerHTML;
        expect(html).toContain('form-grid');
    });
});
