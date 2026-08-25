/**
 * @vitest-environment jsdom
 *
 * انحدار أحدثه ترحيل النوافذ إلى الحابس المشترك (2026-08-25) — ثم أُغلق.
 *
 * `focusTrap.js` القديم كان يسجّل مستمع Tab على **الحاوية نفسها**، فلا يرى حدثاً نشأ
 * خارجها. أما `modalA11y.js` فيسجّل على `document` بـ`capture: true` — فصار حابس
 * قائمة التصدير يلتقط Tab الصادر من أي سطح متداخل يُفتح فوقها **ولم يُرحَّل بعد**،
 * فينتزع التركيز إلى القائمة الخلفية.
 *
 * الأثر الملموس على المستخدم: عند تصدير دراسة فيها تحذيرات جودة، تُفتح بوابة الجودة
 * فوق القائمة ويُركَّز على «أوافق وأكمل التصدير» — وأول Tab كان يقذف المستخدم إلى
 * القائمة خلف البوابة، فيصير زر «مراجعة أولاً» **غير قابل للوصول بلوحة المفاتيح
 * إطلاقاً**. وكلا السطحين كان يُعلن `aria-modal="true"` بلا حبس تركيز — ادّعاء غير
 * صحيح لقارئ الشاشة.
 *
 * الإصلاح: ترحيل السطحين المتداخلين (`_qaGate` و`_openQaFixCenter`) إلى
 * `attachModalA11y` كي يصير كلٌّ منهما أعلى `openStack` فيتولّى مفاتيحه بنفسه.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExportMenu } from '../ExportMenu.js';

function makeStore(state = {}) {
    return {
        getState: () => ({ projectInfo: { name: 'مشروع', concept: 'فكرة' }, ...state }),
        updatePath: vi.fn()
    };
}

/** يحاكي Tab كما يصل فعلاً: من داخل السطح المتداخل، على مرحلة الالتقاط عبر document. */
function pressTab(fromEl, { shift = false } = {}) {
    const ev = new window.KeyboardEvent('keydown', {
        key: 'Tab', shiftKey: shift, bubbles: true, cancelable: true
    });
    fromEl.dispatchEvent(ev);
    return ev;
}

describe('ExportMenu — سطح متداخل فوق قائمة مفتوحة لا يفقد تركيزه', () => {
    beforeEach(() => {
        document.body.innerHTML = '<main id="appMain"><button id="opener">تصدير</button></main>';
    });

    it('بوابة الجودة: Tab بداخلها لا يُنتزع إلى قائمة التصدير خلفها', async () => {
        const menu = new ExportMenu('exportMenuOverlay', makeStore());
        document.getElementById('opener').focus();
        menu.open();

        // شرط السيناريو: القائمة مفتوحة فعلاً وحابسها نشط.
        expect(menu.overlay).toBeTruthy();
        expect(menu.overlay.contains(document.activeElement)).toBe(true);

        // بوابة جودة بتنبيه لَيّن (فزرّا «مراجعة أولاً» و«أوافق وأكمل» كلاهما موجود).
        const gatePromise = menu._qaGate({ softWarnings: ['تنبيه تجريبي'] }, false);
        await new Promise((r) => setTimeout(r, 0));

        const gate = document.querySelector('.qa-gate-overlay');
        expect(gate).toBeTruthy();

        // التركيز الأولي داخل البوابة لا في القائمة خلفها.
        expect(gate.contains(document.activeElement)).toBe(true);
        const proceed = gate.querySelector('button[data-act="proceed"]');
        const cancel = gate.querySelector('button[data-act="cancel"]');
        expect(proceed).toBeTruthy();
        expect(cancel).toBeTruthy();
        expect(document.activeElement).toBe(proceed);

        // العيب: أول Tab كان يقذف التركيز إلى قائمة التصدير خلف البوابة.
        pressTab(document.activeElement);
        expect(gate.contains(document.activeElement)).toBe(true);
        expect(menu.overlay.contains(document.activeElement)).toBe(false);

        // و«مراجعة أولاً» قابل للوصول فعلاً بالتنقّل الدوري (كان مستحيلاً).
        let guard = 0;
        while (document.activeElement !== cancel && guard++ < 10) {
            pressTab(document.activeElement);
        }
        expect(document.activeElement).toBe(cancel);

        // Escape يُغلق البوابة ويُرجع الوعد بـfalse (لا يُكمل التصدير).
        document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        await expect(gatePromise).resolves.toBe(false);
        expect(document.querySelector('.qa-gate-overlay')).toBeNull();
    });

    it('مركز إصلاح الجودة: تركيز بالداخل، Tab محبوس، وEscape يغلق', () => {
        const menu = new ExportMenu('exportMenuOverlay', makeStore());
        document.getElementById('opener').focus();
        menu.open();

        menu._lastQa = { softWarnings: ['ملاحظة'] };
        menu._openQaFixCenter();

        const fixCenter = document.getElementById('qaFixCenterOverlay');
        expect(fixCenter).toBeTruthy();
        expect(fixCenter.contains(document.activeElement)).toBe(true);

        pressTab(document.activeElement);
        expect(fixCenter.contains(document.activeElement)).toBe(true);
        expect(menu.overlay.contains(document.activeElement)).toBe(false);

        // كان بلا Escape إطلاقاً — الإغلاق الوحيد كان نقر × بالفأرة.
        document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        expect(document.getElementById('qaFixCenterOverlay')).toBeNull();
    });
});
