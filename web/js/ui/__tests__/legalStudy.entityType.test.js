/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-08 (ملاحظة منخفضة #62): قائمة «نوع المنشأة» في الدراسة القانونية
 * كانت تفتقد «شركة الشخص الواحد» (SPC، نظام الشركات الجديد 2016) — بديل شائع عن
 * المؤسسة الفردية لحماية أصحاب المطاعم من المسؤولية الشخصية بلا حاجة لشريك.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LegalStudy } from '../LegalStudy.js';

function fakeStore(state) {
    return { getState: () => state, get: () => state, update: () => {}, notify: () => {} };
}

describe('LegalStudy — شركة الشخص الواحد (SPC) متاحة في قائمة الشكل القانوني (#62)', () => {
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; });
    afterEach(() => { document.body.innerHTML = ''; });

    it('يعرض خيار "شركة الشخص الواحد (SPC)" ضمن القائمة', () => {
        const view = new LegalStudy('c', fakeStore({ legal: { legalForm: '', licenses: [] } }));
        view.render();
        const html = document.getElementById('c').innerHTML;
        expect(html).toContain('شركة الشخص الواحد (SPC)');
    });

    it('اختيار محفوظ مسبقاً لهذا النوع يظهر محدَّداً (selected) فعلياً', () => {
        const view = new LegalStudy('c', fakeStore({ legal: { legalForm: 'شركة الشخص الواحد', licenses: [] } }));
        view.render();
        const select = document.getElementById('legalForm');
        expect(select.value).toBe('شركة الشخص الواحد');
    });
});
