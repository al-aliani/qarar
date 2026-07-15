/**
 * @vitest-environment jsdom
 *
 * خريطة الدراسة موحّدة الآن خارج محتوى الخطوة، لذلك تبقى ظاهرة ومتسقة حتى عندما
 * يستبدل مكوّن متخصص محتوى Wizard بالكامل.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StudyJourney, getStudyJourneyContext } from '../StudyJourney.js';
import { STEPS, SIDEBAR_SECTIONS } from '../../core/wizardSteps.js';

function mountJourney(onNavigate = vi.fn(), steps = STEPS, stepIndexMap = null) {
    document.body.innerHTML = `
        <div id="headerStageBar"></div>
        <div id="mobileStageIndicator"></div>
        <nav id="breadcrumbBar"><button id="btnOpenStudyMap">المسار</button></nav>
        <dialog id="studyMapDialog"></dialog>`;
    return new StudyJourney({ steps, stepIndexMap, onNavigate });
}

describe('StudyJourney — مسار موحّد ومصنّف لكل الخطوات', () => {
    beforeEach(() => { document.body.innerHTML = ''; });

    it('يعرض 42 خطوة موزعة على الفئات الثماني بلا فقد أو تكرار', () => {
        const journey = mountJourney();
        journey.update(15);

        const groups = document.querySelectorAll('.study-map__group');
        const buttons = document.querySelectorAll('.study-map__step');
        expect(groups.length).toBe(SIDEBAR_SECTIONS.length);
        expect(buttons.length).toBe(STEPS.length);
        expect(STEPS.length).toBe(42);

        groups.forEach((group, index) => {
            expect(group.querySelector('.study-map__group-title').textContent).toBe(SIDEBAR_SECTIONS[index].label);
        });
    });

    it('يبرز خطوة واحدة فقط ويعرض أرقاماً عربية في الرأس والجوال', () => {
        const journey = mountJourney();
        journey.update(20);

        const current = document.querySelectorAll('.study-map__step.is-current');
        expect(current.length).toBe(1);
        expect(Number(current[0].dataset.studyStep)).toBe(20);
        expect(current[0].getAttribute('aria-current')).toBe('step');

        const headerText = document.getElementById('headerStageBar').textContent;
        expect(headerText).toMatch(/[٠-٩]/);
        expect(headerText).not.toMatch(/[0-9]/);
        expect(document.getElementById('mobileStageIndicator').textContent).toMatch(/[٠-٩]/);
    });

    it('يفتح الخريطة وينتقل بالفهرس المطلق ثم يغلقها', () => {
        const onNavigate = vi.fn();
        const journey = mountJourney(onNavigate);
        journey.update(0);

        document.getElementById('btnOpenStudyMap').click();
        const dialog = document.getElementById('studyMapDialog');
        expect(dialog.hasAttribute('open')).toBe(true);

        dialog.querySelector('[data-study-step="25"]').click();
        expect(onNavigate).toHaveBeenCalledWith(25);
        expect(dialog.hasAttribute('open')).toBe(false);
    });

    it('يحترم المسار المصفّى ويحسب موضعه المحلي دون تغيير الفهرس المطلق', () => {
        const absoluteIndices = [2, 3, 10, 23, 36];
        const filtered = absoluteIndices.map(index => STEPS[index]);
        const context = getStudyJourneyContext(23, filtered, absoluteIndices);

        expect(context.position).toBe(4);
        expect(context.total).toBe(5);
        expect(context.absoluteIndex).toBe(23);
        expect(context.percent).toBe(80);
    });

    it('لا يدّعي اكتمال الخطوات السابقة بمجرد القفز إلى خطوة متقدمة', () => {
        const journey = mountJourney();
        journey.update(30);

        const previous = document.querySelector('[data-study-step="2"]');
        expect(previous.classList.contains('is-current')).toBe(false);
        expect(previous.textContent).not.toContain('✓');
        expect(previous.getAttribute('title')).toBeNull();
    });

    it('can present the eight classifications as the primary journey', () => {
        const categories = SIDEBAR_SECTIONS.map(section => ({ id: section.id, label: section.label }));
        const categorySections = categories.map((category, index) => ({
            id: category.id,
            label: category.label,
            range: [index, index]
        }));
        document.body.innerHTML = `
            <div id="headerStageBar"></div>
            <div id="mobileStageIndicator"></div>
            <nav id="breadcrumbBar"><button id="btnOpenStudyMap">المسار</button></nav>
            <dialog id="studyMapDialog"></dialog>`;
        const journey = new StudyJourney({
            steps: categories,
            masterSteps: categories,
            sections: categorySections,
            unitLabel: 'التصنيف',
            mapHeading: 'انتقل إلى أي تصنيف'
        });

        journey.update(3);

        expect(document.querySelectorAll('[data-study-step]')).toHaveLength(8);
        expect(document.querySelectorAll('.study-map__group')).toHaveLength(1);
        expect(document.getElementById('headerStageBar').textContent).toContain('التصنيف ٤ من ٨');
        expect(document.getElementById('btnOpenStudyMap').getAttribute('aria-label')).toContain('تصنيفات الدراسة');
    });
});
