// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { enhanceFieldHelp, observeFieldHelp } from '../components/FieldHelpEnhancer.js';

describe('FieldHelpEnhancer', () => {
    beforeEach(() => {
        document.body.innerHTML = '<main id="wizardContainer"></main>';
    });

    it('يضيف شرحاً متخصصاً للخانة التي لا تملك علامة مساعدة', () => {
        const root = document.getElementById('wizardContainer');
        root.innerHTML = `
            <div class="form-group">
                <label for="field-discountRate">معدل الخصم</label>
                <input id="field-discountRate" data-key="discountRate" type="number">
            </div>`;

        const result = enhanceFieldHelp(root);
        expect(result).toEqual({ total: 1, covered: 1, added: 1 });
        expect(root.querySelectorAll('.field-help-btn')).toHaveLength(1);
        expect(root.querySelector('.field-help-pop').textContent).toContain('تحويل أرباح المستقبل');
        expect(root.querySelector('input').getAttribute('aria-describedby')).toMatch(/^field-help-/);
    });

    it('لا يكرر العلامة الموجودة عند إعادة الرسم أو الاستدعاء', () => {
        const root = document.getElementById('wizardContainer');
        root.innerHTML = '<label for="projectName">اسم المشروع</label><input id="projectName">';

        enhanceFieldHelp(root);
        enhanceFieldHelp(root);
        expect(root.querySelectorAll('.field-help')).toHaveLength(1);
    });

    it('يضع شرح الجدول في رأس العمود مرة واحدة لكل الصفوف', () => {
        const root = document.getElementById('wizardContainer');
        root.innerHTML = `
            <table>
                <thead><tr><th>السعر</th><th>ملاحظات</th></tr></thead>
                <tbody>
                    <tr><td><input type="number"></td><td><textarea></textarea></td></tr>
                    <tr><td><input type="number"></td><td><textarea></textarea></td></tr>
                </tbody>
            </table>`;

        const result = enhanceFieldHelp(root);
        expect(result.total).toBe(4);
        expect(result.covered).toBe(4);
        expect(root.querySelectorAll('th .field-help')).toHaveLength(2);
    });

    it('يوفر شرحاً عاماً واضحاً للخانات غير المسجلة', () => {
        const root = document.getElementById('wizardContainer');
        root.innerHTML = '<label for="custom">تفصيل خاص بالمشروع</label><input id="custom" placeholder="اكتب التفصيل">';

        enhanceFieldHelp(root);
        expect(root.querySelector('.field-help-pop').textContent).toContain('تفصيل خاص بالمشروع');
        expect(root.querySelector('.fh-example').textContent).toContain('اكتب التفصيل');
    });

    it('يراقب الخانات المضافة لاحقاً ويشرحها تلقائياً', async () => {
        const root = document.getElementById('wizardContainer');
        const stop = observeFieldHelp(root);
        root.innerHTML = '<label for="price">السعر</label><input id="price" type="number">';
        await vi.waitFor(() => expect(root.querySelector('.field-help')).not.toBeNull());
        stop();
    });
});

