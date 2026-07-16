/**
 * @vitest-environment jsdom
 *
 * تكامل بطاقة نطاقات (Nitaqat) + مقارنة تكلفة سعودي/وافد في Wizard.js أسفل جدول
 * «الوظائف والرواتب» (مهمة Nitaqat، دفعة 4) — يثبّت أن الخطاف الفعلي (renderTable)
 * يُظهر البطاقة بمحتوى صحيح، لا فقط المنطق النقي في nitaqatHrCard.js.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { Wizard } from '../Wizard.js';
import { SECTIONS, TABLE_SCHEMAS, createEmptyStudy } from '../../core/schema.js';

function fakeStore(state) {
    return { get: () => state, getState: () => state, update: () => {}, updatePath: () => {} };
}

afterEach(() => {
    document.body.innerHTML = '';
});

describe('Wizard — بطاقة Nitaqat أسفل جدول الوظائف والرواتب', () => {
    it('تعرض تصنيف النطاق ومقارنة التكلفة سعودي/وافد حين توجد وظائف مُدخلة', () => {
        const state = createEmptyStudy();
        state.projectInfo.sector = 'مطعم شعبي';
        state.hr.positions = [
            { position: 'مدير', nationality: 'saudi', count: 1, salary: 12000 },
            { position: 'نادل', nationality: 'expat', count: 3, salary: 4000 }
        ];

        const wizard = new Wizard('c', fakeStore(state), { positions: TABLE_SCHEMAS.positions }, {
            steps: [{ id: SECTIONS.HR, label: 'الموارد البشرية', tables: ['positions'] }]
        });
        document.body.innerHTML = `<div id="c"></div>`;
        wizard.container = document.getElementById('c');

        wizard.renderStep(SECTIONS.HR, wizard.steps[0], 0);

        const card = document.getElementById('nitaqatHrCard');
        expect(card).toBeTruthy();
        expect(card.textContent).toMatch(/25%/); // موظف سعودي واحد من أصل 4
        expect(card.textContent).toMatch(/مطاعم ومقاهي/);
        expect(card.textContent).toMatch(/موظف سعودي/);
        expect(card.textContent).toMatch(/موظف وافد/);
    });

    it('تعرض دعوة لإضافة موظفين حين يكون جدول الوظائف فارغاً (بلا رمي استثناء)', () => {
        const state = createEmptyStudy();
        const wizard = new Wizard('c', fakeStore(state), { positions: TABLE_SCHEMAS.positions }, {
            steps: [{ id: SECTIONS.HR, label: 'الموارد البشرية', tables: ['positions'] }]
        });
        document.body.innerHTML = `<div id="c"></div>`;
        wizard.container = document.getElementById('c');

        expect(() => wizard.renderStep(SECTIONS.HR, wizard.steps[0], 0)).not.toThrow();

        const card = document.getElementById('nitaqatHrCard');
        expect(card).toBeTruthy();
        expect(card.textContent).toMatch(/أضف موظفين/);
    });
});
