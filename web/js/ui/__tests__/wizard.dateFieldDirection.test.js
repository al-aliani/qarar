/**
 * @vitest-environment jsdom
 *
 * حقول التاريخ (input[type="date"]) داخل النموذج RTL كانت تعرض placeholder الأجزاء
 * (يوم/شهر/سنة) معكوساً بصرياً («قنس/رهش/موي» بدل «سنة/شهر/يوم») على الإنتاج الحي —
 * رغم وجود قاعدة CSS مخصصة (`input[type="date"]{direction:ltr}` في wizard-forms.css)
 * لأن حزمة CSS المبنية تفقدها أحياناً (تأكيد عبر build محلي: type="date" غائبة كلياً من
 * bundle-*.css الناتج، رغم وجودها في المصدر وفي كل خطوة معزولة من خط أنابيب PostCSS/esbuild
 * عند اختبارها منفردة — لم يُحدَّد السبب الجذري الدقيق داخل Vite/Rollup). الإصلاح هنا لا
 * يعتمد على تلك القاعدة الخارجية: يضبط direction:ltr inline مباشرة في HTML المُرسَّم، وهذا
 * لا يمكن أن يُفقَد أثناء البناء لأنه جزء من نص HTML نفسه لا قاعدة CSS منفصلة.
 */
import { describe, it, expect } from 'vitest';
import { Wizard } from '../Wizard.js';
import { createEmptyStudy } from '../../core/schema.js';

function fakeStore(state) {
    return { get: () => state, getState: () => state, update: () => {}, updatePath: () => {} };
}

describe('حقل التاريخ — اتجاه LTR ثابت داخل HTML المُرسَّم', () => {
    it('يضبط direction:ltr inline بدل الاعتماد فقط على سمة dir أو قاعدة CSS خارجية', () => {
        const state = createEmptyStudy();
        const wizard = new Wizard('missing-container', fakeStore(state), {}, { steps: [] });

        const html = wizard.renderField('projectInfo', 'projectInfo.timeline.startDate', 'startDate', '');

        expect(html).toContain('type="date"');
        expect(html).toContain('dir="ltr"');
        expect(html).toContain('direction:ltr');
    });
});
