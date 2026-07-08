/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-08 (ملاحظة حرجة، خبير المحتوى): عرض المستثمر (InvestorDashboard/
 * buildPitchPayload) كان يُفرغ قسم «الفريق» دائماً — state.keyPeople كائن
 * {keyPeople:[], partnershipContracts:[]} حسب schema.js، لا مصفوفة مباشرة، فكان
 * Array.isArray(state.keyPeople) يعيد false دوماً بصرف النظر عمّا أدخله المستخدم.
 */
import { describe, it, expect } from 'vitest';
import { InvestorDashboard, buildPitchPayload } from '../InvestorDashboard.js';
import { SECTIONS, createEmptyStudy } from '../../core/schema.js';

function studyWithTeam() {
    const state = createEmptyStudy();
    state[SECTIONS.KEY_PEOPLE] = {
        keyPeople: [{ name: 'عبدالعزيز', role: 'المؤسس' }, { name: 'سارة', role: 'الشريكة' }],
        partnershipContracts: []
    };
    return state;
}

describe('InvestorDashboard — قسم الفريق لا يُفرَّغ', () => {
    it('buildPitchPayload يستخرج الفريق فعلياً من state.keyPeople.keyPeople', () => {
        const payload = buildPitchPayload(studyWithTeam(), {});
        expect(payload.team).toEqual([
            { name: 'عبدالعزيز', role: 'المؤسس' },
            { name: 'سارة', role: 'الشريكة' }
        ]);
    });

    it('_buildDataFromStore (المسار الحي داخل التطبيق) يستخرج نفس الفريق', () => {
        document.body.innerHTML = `<div id="c"></div>`;
        const store = { getState: () => studyWithTeam() };
        const dash = new InvestorDashboard('c', store);
        const data = dash._buildDataFromStore();
        expect(data.team.map(p => p.name)).toEqual(['عبدالعزيز', 'سارة']);
    });
});
