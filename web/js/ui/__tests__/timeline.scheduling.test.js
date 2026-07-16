/**
 * @vitest-environment jsdom
 *
 * Timeline.js — ميزات المسار الحرج/التبعيات/الربط بالتكلفة والتمويل/أثر التأخير
 * على NPV/التصدير (دفعة خطة التنفيذ 2026-07). المنطق الحسابي نفسه مُختبَر بمعزل
 * في timelineScheduling.test.js/engine.delayedLaunchImpact.test.js/icsExport.test.js
 * — هذا الملف يثبت أن Timeline.js يستهلكها ويعرضها بشكل صحيح فقط.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SECTIONS } from '../../core/schema.js';

vi.mock('../../services/AIConnector.js', () => ({ generateTableSuggestions: vi.fn() }));
vi.mock('../../core/engine.js', () => ({
    calculateDelayedLaunchImpact: vi.fn(() => ({ delayMonths: 3, baselineNpv: 100000, delayedNpv: 80000, npvImpact: -20000 }))
}));
vi.mock('../../../export/utils.js', () => ({ loadXLSX: vi.fn(() => Promise.resolve()) }));

import { Timeline } from '../Timeline.js';
import { calculateDelayedLaunchImpact } from '../../core/engine.js';

function fakeStore(state) {
    return {
        get: () => state,
        getState: () => state,
        updatePath: (section, key, value) => { state[section][key] = value; },
        update: () => {},
        notify: () => {}
    };
}

function buildStudy(overrides = {}) {
    return {
        projectInfo: {},
        [SECTIONS.TECHNICAL]: { establishmentCosts: [] },
        [SECTIONS.FINANCING]: { sources: {} },
        [SECTIONS.TIMELINE]: { activities: [] },
        ...overrides
    };
}

describe('Timeline — المسار الحرج والتبعيات', () => {
    beforeEach(() => { document.body.innerHTML = '<div id="c"></div>'; });
    afterEach(() => { document.body.innerHTML = ''; vi.clearAllMocks(); });

    it('يعرض وسم «حرج» للمرحلة التي لا سلاك لها في سلسلة تبعيات', () => {
        const study = buildStudy({
            [SECTIONS.TIMELINE]: {
                activities: [
                    { id: 1, name: 'تراخيص', startMonth: 1, duration: 2, category: 'legal' },
                    { id: 2, name: 'تصميم', startMonth: 3, duration: 1, category: 'technical', dependsOn: [1] }
                ]
            }
        });
        const timeline = new Timeline('c', fakeStore(study));
        expect(() => timeline.render()).not.toThrow();
        const html = document.getElementById('c').innerHTML;
        expect(html).toContain('حرج');
        expect(html).toContain('المسار الحرج والجدولة');
    });

    it('دورة تبعيات: يعرض تنبيهاً صديقاً بدل رمي استثناء يُسقط الشاشة', () => {
        const study = buildStudy({
            [SECTIONS.TIMELINE]: {
                activities: [
                    { id: 1, name: 'أ', startMonth: 1, duration: 1, dependsOn: [2] },
                    { id: 2, name: 'ب', startMonth: 1, duration: 1, dependsOn: [1] }
                ]
            }
        });
        const timeline = new Timeline('c', fakeStore(study));
        expect(() => timeline.render()).not.toThrow();
        expect(document.getElementById('c').innerHTML).toContain('تبعيات دائرية');
    });

    it('إضافة مرحلة جديدة مع تبعية مُحدَّدة تحفظ dependsOn الصحيح', () => {
        const study = buildStudy({
            [SECTIONS.TIMELINE]: { activities: [{ id: 111, name: 'تراخيص', startMonth: 1, duration: 2 }] }
        });
        const timeline = new Timeline('c', fakeStore(study));
        timeline.render();

        document.getElementById('newActName').value = 'تصميم';
        document.getElementById('newActStart').value = '3';
        document.getElementById('newActDuration').value = '1';
        document.querySelector('.newActDependsOn[value="111"]').checked = true;
        document.getElementById('btnAddActivity').click();

        const activities = study[SECTIONS.TIMELINE].activities;
        const added = activities.find(a => a.name === 'تصميم');
        expect(added.dependsOn).toEqual(['111']);
    });
});

describe('Timeline — أثر تأخير الافتتاح على NPV', () => {
    beforeEach(() => { document.body.innerHTML = '<div id="c"></div>'; });
    afterEach(() => { document.body.innerHTML = ''; vi.clearAllMocks(); });

    it('يحسب ويعرض أثر التأخير عبر calculateDelayedLaunchImpact', () => {
        const timeline = new Timeline('c', fakeStore(buildStudy()));
        timeline.render();

        document.getElementById('delayMonthsInput').value = '3';
        document.getElementById('btnCalcDelayImpact').click();

        expect(calculateDelayedLaunchImpact).toHaveBeenCalledWith(expect.anything(), 3);
        const resultText = document.getElementById('delayImpactResult').textContent;
        expect(resultText).toContain('3 شهر');
        // toLocaleString('ar-SA') يُنتج أرقاماً هندية عربية (٨٠٬٠٠٠) بنفس اتفاقية التطبيق العامة
        expect(resultText).toContain((80000).toLocaleString('ar-SA'));
    });
});

describe('Timeline — التصدير', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="c"></div>';
        global.URL.createObjectURL = vi.fn(() => 'blob:mock');
        global.URL.revokeObjectURL = vi.fn();
    });
    afterEach(() => { document.body.innerHTML = ''; vi.clearAllMocks(); });

    it('تصدير ICS بلا تاريخ بدء مشروع يُظهر تحذيراً ولا يُنشئ رابط تنزيل', () => {
        const study = buildStudy({ [SECTIONS.TIMELINE]: { activities: [{ id: 1, name: 'أ', startMonth: 1 }] } });
        const timeline = new Timeline('c', fakeStore(study));
        timeline.render();
        document.getElementById('btnExportIcs').click();
        expect(global.URL.createObjectURL).not.toHaveBeenCalled();
    });

    it('تصدير ICS بتاريخ بدء صالح يُنشئ رابط تنزيل فعلياً', () => {
        const study = buildStudy({
            projectInfo: { timeline: { projectStart: '2026-01-01' } },
            [SECTIONS.TIMELINE]: { activities: [{ id: 1, name: 'أ', startMonth: 1 }] }
        });
        const timeline = new Timeline('c', fakeStore(study));
        timeline.render();
        document.getElementById('btnExportIcs').click();
        expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
});
