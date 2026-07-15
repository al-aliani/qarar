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

    it('classifies all 42 sections exactly once in the intended order', () => {
        const classifiedIndexes = SIDEBAR_SECTIONS.flatMap(category => {
            const indexes = [];
            for (let index = category.range[0]; index <= category.range[1]; index++) indexes.push(index);
            return indexes;
        });

        expect(SIDEBAR_SECTIONS).toHaveLength(8);
        expect(classifiedIndexes).toEqual(STEPS.map((_, index) => index));
        expect(new Set(classifiedIndexes).size).toBe(42);
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

    // تغيير مقصود بقرار صاحب المنتج 2026-07-15: عدّاد «الخطوة X من Y» المعروض كان
    // يعرض دوماً الرقم/الإجمالي المطلقين (من كل الـ42 خطوة) حتى تحت فلتر خطوات ظاهرة
    // أضيق — نفس العلة التي أُصلحت سابقاً لعدّاد «التصنيف X من Y» أدناه. الآن يعرض
    // موضع الخطوة ضمن المجموعة المُصفّاة فعلياً وإجمالي تلك المجموعة، بنفس مبدأ اختبار
    // "with a visible-category filter" أدناه تماماً؛ الفهرسة الداخلية (dataset.stepIndex)
    // تبقى مطلقة كما كانت (تحقّق دون تغيير في السطر التالي).
    it('with a visible-step filter, the step number shows the position within the filtered set, not the absolute index out of 42', async () => {
        const { view } = createView();
        view.setVisibleStepIndexes([0, 2, 6]);

        await view.render(0);

        expect([...document.querySelectorAll('.category-step')].map(section => Number(section.dataset.stepIndex))).toEqual([0, 2, 6]);
        expect([...document.querySelectorAll('.category-step__number')].map(element => element.textContent)).toEqual([
            'الخطوة ١ من ٣',
            'الخطوة ٢ من ٣',
            'الخطوة ٣ من ٣'
        ]);
        // شارة الرقم في فهرس الأقسام (.category-toc__links) تعرض نفس «معادل بصياغة
        // مختلفة» للرقم — يجب ألا تنحرف عن رأس القسم أعلاه لنفس الخطوة (لا أرقام
        // متضاربة على نفس الصفحة لنفس العنصر).
        expect([...document.querySelectorAll('.category-toc__links a span')].map(el => el.textContent)).toEqual(['١', '٢', '٣']);
    });

    it('without a visible-step filter, the step number keeps absolute numbering out of all 42 steps', async () => {
        const { view } = createView();

        await view.render(0);

        expect([...document.querySelectorAll('.category-step__number')].map(element => element.textContent)).toEqual([
            'الخطوة ١ من ٤٢',
            'الخطوة ٢ من ٤٢',
            'الخطوة ٣ من ٤٢',
            'الخطوة ٤ من ٤٢',
            'الخطوة ٥ من ٤٢',
            'الخطوة ٦ من ٤٢',
            'الخطوة ٧ من ٤٢'
        ]);
    });

    it('without a visible-category filter, the category eyebrow keeps absolute numbering out of all 8 categories', async () => {
        const { view } = createView();

        await view.render(2);

        expect(document.querySelector('.category-page__eyebrow').textContent).toBe('التصنيف ٣ من ٨');
    });

    it('with a visible-category filter (e.g. mini study mode), the category eyebrow shows the position within the shrunken set, not the absolute index out of 8', async () => {
        const { view } = createView();
        // يحاكي visibleCategoryIndexesForMode('mini') الحقيقي في app.js: 5 تصنيفات غير فارغة فقط.
        view.setVisibleCategoryIndexes([0, 1, 2, 4, 7]);

        await view.render(4);

        expect(document.querySelector('.category-page__eyebrow').textContent).toBe('التصنيف ٤ من ٥');
    });
});
