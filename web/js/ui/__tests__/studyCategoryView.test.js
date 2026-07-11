/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SIDEBAR_SECTIONS, STEPS } from '../../core/wizardSteps.js';
import { StudyCategoryView } from '../StudyCategoryView.js';

describe('StudyCategoryView', () => {
    beforeEach(() => {
        document.body.innerHTML = '<main id="wizardContainer"></main>';
    });

    function createView(options = {}) {
        const onNavigateCategory = vi.fn();
        const view = new StudyCategoryView('wizardContainer', {}, {}, {
            steps: STEPS,
            categories: SIDEBAR_SECTIONS,
            onNavigateCategory,
            ...options
        });
        vi.spyOn(view, 'renderStepInto').mockResolvedValue();
        return { view, onNavigateCategory };
    }

    it('classifies all 41 sections exactly once in the intended order', () => {
        const classifiedIndexes = SIDEBAR_SECTIONS.flatMap(category => {
            const indexes = [];
            for (let index = category.range[0]; index <= category.range[1]; index++) indexes.push(index);
            return indexes;
        });

        expect(SIDEBAR_SECTIONS).toHaveLength(8);
        expect(classifiedIndexes).toEqual(STEPS.map((_, index) => index));
        expect(new Set(classifiedIndexes).size).toBe(41);
        expect(STEPS.slice(0, 7).map(step => step.label)).toEqual([
            'الدراسة المبدئية',
            'مقارنة الأفكار',
            'معلومات المشروع',
            'المنتجات والخدمات',
            'الأشخاص الرئيسون',
            'فرضية المشروع',
            'الأهداف الذكية'
        ]);
    });

    it('renders every section in the first classification on one page', async () => {
        const { view } = createView();

        await view.render(0);

        const sections = document.querySelectorAll('.category-step');
        const links = document.querySelectorAll('[data-category-anchor]');
        expect(sections).toHaveLength(7);
        expect(links).toHaveLength(7);
        expect([...sections].map(section => Number(section.dataset.stepIndex))).toEqual([0, 1, 2, 3, 4, 5, 6]);
        expect(document.querySelector('.category-page__header').textContent).toContain('التحقق والتعريف');
    });

    it('uses classification-level previous and next navigation', async () => {
        const { view, onNavigateCategory } = createView();

        await view.render(1);
        document.querySelector('[data-category-prev]').click();
        document.querySelector('[data-category-next]').click();

        expect(onNavigateCategory).toHaveBeenNthCalledWith(1, 0);
        expect(onNavigateCategory).toHaveBeenNthCalledWith(2, 2);
    });

    it('respects the visible-step filter without changing original section numbers', async () => {
        const { view } = createView();
        view.setVisibleStepIndexes([0, 2, 6]);

        await view.render(0);

        expect([...document.querySelectorAll('.category-step')].map(section => Number(section.dataset.stepIndex))).toEqual([0, 2, 6]);
        expect([...document.querySelectorAll('.category-step__number')].map(element => element.textContent)).toEqual([
            'القسم ١ من ٤١',
            'القسم ٣ من ٤١',
            'القسم ٧ من ٤١'
        ]);
    });
});
