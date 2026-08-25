/**
 * @vitest-environment jsdom
 *
 * تدقيق a11y 2026-08-25 — التركيز كان يضيع كلياً عند كل انتقال خطوة في المعالج.
 *
 * `renderStep()` يستبدل `container.innerHTML` بالكامل، فالعنصر المُركَّز عليه يُحذف
 * من الشجرة ويسقط التركيز إلى <body>: مستخدم لوحة المفاتيح يعود لأول الصفحة عند كل
 * خطوة، وقارئ الشاشة لا يسمع أن الخطوة تغيّرت أصلاً.
 *
 * ⚠️ هذا الملف أُعيدت كتابته بالكامل (2026-08-25) لأن نسخته الأولى كانت **تقيس
 * سيناريو لا يقع في الإنتاج**: كانت تستدعي `renderStep()` مرتين على **نفس** كائن
 * Wizard، فينجح الإصلاح القديم (علَم `this._hasRenderedStep` لتخطّي أول رسم) وتبقى
 * الاختبارات خضراء — بينما المسار الوحيد في الإنتاج
 * (`stepComponentRegistry.js` ⟵ `wizardFactory` في `StudyCategoryView.js`) يبني
 * **نسخة Wizard جديدة كل رسم**، فالعلَم يولد فارغاً كل مرة والدالة كانت ترجع فوراً
 * في كل انتقال بلا استثناء. كل رسم هنا يمرّ عبر `renderViaFactory` الذي يحاكي ذلك
 * حرفياً: نسخة جديدة، نفس عنصر الحاوية.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';

vi.mock('nouislider', () => ({
    default: { create: (el) => { el.noUiSlider = { on: vi.fn() }; } }
}));

const { Wizard } = await import('../Wizard.js');
const { SECTIONS, createEmptyStudy } = await import('../../core/schema.js');

const STEPS = [
    { id: SECTIONS.ASSUMPTIONS, label: 'الافتراضات المالية', isForm: true, tables: [] },
    { id: SECTIONS.PROJECT_INFO, label: 'بيانات المشروع', isForm: true, tables: [] }
];

function fakeStore(state) {
    return { get: () => state, getState: () => state, update: vi.fn(), updatePath: vi.fn() };
}

/**
 * يحاكي مسار الإنتاج الوحيد حرفياً:
 *   StudyCategoryView.wizardFactory = () => new Wizard(containerId, ...)
 *   stepComponentRegistry: const wizardInstance = wizardFactory(); wizardInstance.renderStep(...)
 * أي: **نسخة جديدة لكل رسم**، ونفس عنصر الحاوية الباقي في DOM.
 */
function renderViaFactory(containerId, stepIndex, state) {
    const wizard = new Wizard(containerId, fakeStore(state), {}, { steps: STEPS });
    expect(wizard.container, `الحاوية ${containerId} يجب أن تكون موجودة في DOM`).toBeTruthy();
    wizard.renderStep(STEPS[stepIndex].id, STEPS[stepIndex], stepIndex);
    return wizard;
}

beforeEach(() => {
    document.body.innerHTML = '<div id="category-step-content-0"></div><div id="category-step-content-1"></div>';
});

afterEach(() => {
    vi.restoreAllMocks();
    delete window.HTMLElement.prototype.scrollIntoView;
    document.body.innerHTML = '';
});

describe('Wizard — إدارة التركيز عبر انتقالات الخطوات (نسخة جديدة كل رسم، كما في الإنتاج)', () => {
    it('عنوان الخطوة يحمل tabindex="-1" وصنفاً ثابتاً — بدونهما لا يمكن تركيزه برمجياً', () => {
        const wizard = renderViaFactory('category-step-content-0', 0, createEmptyStudy());

        const heading = wizard.container.querySelector('.wizard-step-heading');
        expect(heading).toBeTruthy();
        expect(heading.tagName).toBe('H2');
        // العنصر غير التفاعلي لا يقبل focus() بلا tabindex — هذا ما يجعل الإصلاح ممكناً.
        expect(heading.getAttribute('tabindex')).toBe('-1');
    });

    it('إقلاع الصفحة (لا تركيز على شيء) لا يخطف التركيز', () => {
        renderViaFactory('category-step-content-0', 0, createEmptyStudy());
        expect(document.activeElement).toBe(document.body);
    });

    it('انتقال خطوة بنسخة Wizard جديدة (مسار الإنتاج) ينقل التركيز إلى عنوان الخطوة الجديدة', () => {
        const state = createEmptyStudy();
        const first = renderViaFactory('category-step-content-0', 0, state);

        // المستخدم مُركِّز على حقل داخل الخطوة الحالية قبل الانتقال.
        const field = first.container.querySelector('input, select, textarea, button');
        expect(field, 'الخطوة يجب أن تحوي عنصراً تفاعلياً لتكون المحاكاة ذات معنى').toBeTruthy();
        field.focus();
        expect(document.activeElement).toBe(field);

        // نسخة **جديدة** ترسم في **نفس** الحاوية — هذا ما يفعله wizardFactory فعلياً.
        const second = renderViaFactory('category-step-content-0', 1, state);

        const heading = second.container.querySelector('.wizard-step-heading');
        expect(document.activeElement).toBe(heading);
        // العنوان يحمل اسم الخطوة الجديدة، فتركيزه إعلان مفيد لا مجرّد نقل مؤشر.
        expect(heading.textContent.trim()).toBe('بيانات المشروع');
    });

    it('صفحة التصنيف ترسم عدة خطوات دفعةً واحدة: رسم خطوة في حاوية أخرى لا ينتزع تركيز المستخدم', () => {
        const state = createEmptyStudy();
        const first = renderViaFactory('category-step-content-0', 0, state);
        const field = first.container.querySelector('input, select, textarea, button');
        field.focus();

        // الخطوة التالية في الصفحة تُرسم في حاويتها المستقلة — لم تُتلف تركيز المستخدم.
        const second = renderViaFactory('category-step-content-1', 1, state);

        // حارس ضد اجتياز كاذب: لا بد أن يوجد هدف تركيز صالح في الحاوية الأخرى أصلاً،
        // وإلا مرّ الاختبار لانعدام الهدف لا لصحة المعيار. وقع هذا فعلاً أثناء التطوير:
        // مُعرِّف الخطوة المكرّر جعل البحث المُقيَّد بالحاوية يعيد null دائماً.
        expect(second.container.querySelector('.wizard-step-heading')).toBeTruthy();
        expect(document.activeElement).toBe(field);
    });

    it('التمرير بعد الانتقال يحترم prefers-reduced-motion', () => {
        const state = createEmptyStudy();
        const calls = [];
        // jsdom لا يوفّر scrollIntoView ولا matchMedia — نركّبهما لرصد الخيارات الممرَّرة.
        window.HTMLElement.prototype.scrollIntoView = function (opts) { calls.push(opts); };

        const focusInside = () => {
            document.getElementById('category-step-content-0').querySelector('input, select, textarea, button').focus();
        };

        renderViaFactory('category-step-content-0', 0, state);

        window.matchMedia = () => ({ matches: true }); // المستخدم يطلب تقليل الحركة
        focusInside();
        renderViaFactory('category-step-content-0', 1, state);
        expect(calls.at(-1)).toMatchObject({ behavior: 'auto' });

        window.matchMedia = () => ({ matches: false });
        focusInside();
        renderViaFactory('category-step-content-0', 0, state);
        expect(calls.at(-1)).toMatchObject({ behavior: 'smooth' });
    });
});
