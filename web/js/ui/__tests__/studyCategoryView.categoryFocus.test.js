/**
 * @vitest-environment jsdom
 *
 * تدقيق a11y 2026-08-25 — الانتقال الحقيقي الذي يراه مستخدم لوحة المفاتيح ليس رسم
 * خطوة داخل المعالج، بل **تصنيف ⟶ تصنيف**: زرّا «التصنيف السابق/التالي» في تذييل
 * صفحة التصنيف يستدعيان `onNavigateCategory` ⟶ `render()` الذي يستبدل
 * `this.container.innerHTML` بالكامل — فيُتلف الزرّ المُركَّز عليه نفسه ويسقط التركيز
 * إلى <body>. المستخدم كان يجد نفسه في أول المستند بعد كل تصنيف من الثمانية
 * (`grep -c "\.focus("` على StudyCategoryView.js كان يعطي 0).
 *
 * الإصلاح: التقاط العنصر المُركَّز عليه قبل الاستبدال، ونقل التركيز إلى عنوان التصنيف
 * الجديد (tabindex="-1") بعده — وفقط إن أُتلف تركيز قائم فعلاً.
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { SIDEBAR_SECTIONS, STEPS } from '../../core/wizardSteps.js';
import { StudyCategoryView } from '../StudyCategoryView.js';

describe('StudyCategoryView — إدارة التركيز عند الانتقال بين التصنيفات', () => {
    beforeEach(() => {
        document.body.innerHTML = '<main id="wizardContainer"></main>';
        localStorage.setItem('tour_category0_seen', 'true'); // نمنع جولة driver.js من التدخل
    });

    afterEach(() => {
        delete window.HTMLElement.prototype.scrollIntoView;
        document.body.innerHTML = '';
    });

    /** يربط زرّي التنقل بإعادة الرسم الفعلية كما يفعل app.js (navigateToCategory). */
    function createView() {
        let pending = Promise.resolve();
        const view = new StudyCategoryView('wizardContainer', {}, {}, {
            steps: STEPS,
            categories: SIDEBAR_SECTIONS,
            onNavigateCategory: (index) => { pending = view.render(index); }
        });
        vi.spyOn(view, 'renderStepInto').mockResolvedValue();
        return { view, navigation: () => pending };
    }

    it('عنوان التصنيف يحمل tabindex="-1" ومعرّفاً ثابتاً — بدونهما لا يمكن تركيزه برمجياً', async () => {
        const { view } = createView();
        await view.render(0);

        const heading = document.querySelector('#categoryPageHeading');
        expect(heading).toBeTruthy();
        expect(heading.tagName).toBe('H2');
        expect(heading.getAttribute('tabindex')).toBe('-1');
    });

    it('الضغط على «التصنيف التالي» ينقل التركيز إلى عنوان التصنيف الجديد لا إلى <body>', async () => {
        const { view, navigation } = createView();
        await view.render(1);

        const next = document.querySelector('[data-category-next]');
        next.focus();
        expect(document.activeElement).toBe(next);

        next.click();
        await navigation();

        const heading = document.querySelector('#categoryPageHeading');
        // قبل الإصلاح كان activeElement هنا يساوي document.body دائماً.
        expect(document.activeElement).toBe(heading);
        expect(heading.textContent.trim()).toBe(SIDEBAR_SECTIONS[2].label);
        // ولم يعد الزرّ الملتقَط متصلاً بالمستند — هذا بالضبط ما يبرّر نقل التركيز.
        expect(next.isConnected).toBe(false);
    });

    it('«التصنيف السابق» كذلك ينقل التركيز إلى عنوان وجهته', async () => {
        const { view, navigation } = createView();
        await view.render(2);

        const prev = document.querySelector('[data-category-prev]');
        prev.focus();
        prev.click();
        await navigation();

        expect(document.activeElement).toBe(document.querySelector('#categoryPageHeading'));
        expect(document.activeElement.textContent.trim()).toBe(SIDEBAR_SECTIONS[1].label);
    });

    it('إقلاع الصفحة (لا تركيز على شيء) لا يخطف التركيز إلى عنوان التصنيف', async () => {
        const { view } = createView();
        await view.render(0);

        expect(document.activeElement).toBe(document.body);
    });

    it('تركيز المستخدم خارج حاوية التصنيف يبقى كما هو بعد إعادة الرسم', async () => {
        const { view } = createView();
        await view.render(1);

        // زرّ في الهيدر مثلاً — خارج this.container، فلم يُتلف والرسم لا يعنيه.
        const outside = document.createElement('button');
        document.body.appendChild(outside);
        outside.focus();

        await view.render(2);

        expect(document.activeElement).toBe(outside);
    });

    it('التمرير إلى عنوان التصنيف الجديد يحترم prefers-reduced-motion', async () => {
        const { view } = createView();
        const calls = [];
        window.HTMLElement.prototype.scrollIntoView = function (opts) { calls.push(opts); };

        await view.render(1);
        window.matchMedia = () => ({ matches: true });
        document.querySelector('[data-category-next]').focus();
        await view.render(2);
        expect(calls.at(-1)).toMatchObject({ behavior: 'auto' });

        window.matchMedia = () => ({ matches: false });
        document.querySelector('[data-category-next]').focus();
        await view.render(3);
        expect(calls.at(-1)).toMatchObject({ behavior: 'smooth' });
    });
});
