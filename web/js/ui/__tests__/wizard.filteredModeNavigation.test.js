/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-08 (ملاحظة عالية #25): في وضع «الدراسة السريعة» (وكذلك المصغّر/
 * البسيط)، كان Wizard.js يحسب الخطوة التالية/السابقة بجمع/طرح 1 من
 * this.currentStepIndex مباشرة — لكن هذا فهرس مطلق (من STEPS الكاملة عبر app.js)
 * بينما this.steps في هذه الأوضاع مصفوفة مُصفّاة قصيرة غير متجاورة بالضرورة مع
 * الفهرسة المطلقة. النتيجة: زر «التالي» كان يوصل المستخدم لأي خطوة مطلقة تالية
 * (قد تكون متقدمة/مخفية تماماً عن وضعه) بدل الخطوة التالية ضمن مساره المُصفّى
 * فعلياً — يناقض وعد «5 دقائق فقط» في الوضع السريع.
 *
 * الإصلاح: stepIndexMap (محلي→مطلق، يضبطه app.js عبر applyMode) + دالتا ترجمة
 * _localStepIndex/_absoluteStepIndex في Wizard.js. هذا يثبّت الترجمة مباشرة عبر
 * DOM حقيقي (نقر فعلي على الأزرار) لا استدعاء دوال داخلية فقط.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Wizard } from '../Wizard.js';

function fakeStore(state = {}) {
    return { get: () => state, getState: () => state, update: vi.fn(), updatePath: vi.fn() };
}

// 10 خطوات مطلقة (كامل المسار)؛ الوضع السريع يُظهر فقط الفهارس المطلقة [0,2,3,6,8]
// (5 خطوات) — تماماً كنمط quickVisible الحقيقي في app.js (يتخطى خطوات متقدمة بينها).
const FULL_STEPS = Array.from({ length: 10 }, (_, i) => ({ id: `step${i}`, label: `خطوة ${i}` }));
const QUICK_ABSOLUTE_INDICES = [0, 2, 3, 6, 8];
const QUICK_STEPS = QUICK_ABSOLUTE_INDICES.map(i => FULL_STEPS[i]);

function setupNavDom() {
    document.body.innerHTML = `
        <div id="c">
            <div class="wizard-nav">
                <button id="btnPrevStep"></button>
                <div class="nav-indicator"><span class="nav-indicator__label"></span></div>
                <button id="btnNextStep"></button>
            </div>
        </div>`;
}

describe('Wizard — ترجمة الفهرس المحلي↔المطلق (stepIndexMap)', () => {
    it('_localStepIndex: بلا stepIndexMap (وضع متقدم)، الفهرس المحلي = المطلق مباشرة', () => {
        setupNavDom();
        const w = new Wizard('c', fakeStore(), {}, { steps: FULL_STEPS, onNavigate: () => {} });
        w.currentStepIndex = 6;
        expect(w._localStepIndex()).toBe(6);
        expect(w._absoluteStepIndex(6)).toBe(6);
    });

    it('_localStepIndex: بوجود stepIndexMap (وضع سريع)، يترجم الفهرس المطلق لموضعه الصحيح ضمن المصفوفة المُصفّاة', () => {
        setupNavDom();
        const w = new Wizard('c', fakeStore(), {}, { steps: QUICK_STEPS, onNavigate: () => {} });
        w.stepIndexMap = QUICK_ABSOLUTE_INDICES;
        w.currentStepIndex = 6; // الموضع الرابع في القائمة المُصفّاة (index 3)
        expect(w._localStepIndex()).toBe(3);
        expect(w._absoluteStepIndex(3)).toBe(6);
        expect(w._absoluteStepIndex(4)).toBe(8); // الخطوة التالية الفعلية = المطلق 8، لا 7
        expect(w._absoluteStepIndex(2)).toBe(3); // الخطوة السابقة الفعلية = المطلق 3، لا 5
    });
});

describe('Wizard — نقر أزرار التالي/السابق في الوضع السريع (تكامل DOM فعلي)', () => {
    beforeEach(() => setupNavDom());

    it('زر «التالي» من خطوة مطلقة 6 (محلي 3) يستدعي onNavigate(8) — لا onNavigate(7) الخاطئ (الخلل الأصلي)', () => {
        const onNavigate = vi.fn();
        const w = new Wizard('c', fakeStore(), {}, { steps: QUICK_STEPS, onNavigate });
        w.stepIndexMap = QUICK_ABSOLUTE_INDICES;
        w.currentStepIndex = 6;
        w.bindNavigationEvents();

        document.getElementById('btnNextStep').click();

        expect(onNavigate).toHaveBeenCalledWith(8);
        expect(onNavigate).not.toHaveBeenCalledWith(7); // 7 خطوة متقدمة مخفية عن الوضع السريع
    });

    it('زر «السابق» من خطوة مطلقة 6 (محلي 3) يستدعي onNavigate(3) — لا onNavigate(5) الخاطئ', () => {
        const onNavigate = vi.fn();
        const w = new Wizard('c', fakeStore(), {}, { steps: QUICK_STEPS, onNavigate });
        w.stepIndexMap = QUICK_ABSOLUTE_INDICES;
        w.currentStepIndex = 6;
        w.bindNavigationEvents();

        document.getElementById('btnPrevStep').click();

        expect(onNavigate).toHaveBeenCalledWith(3);
        expect(onNavigate).not.toHaveBeenCalledWith(5);
    });

    it('من أول خطوة مرئية (محلي 0): زر السابق لا يستدعي onNavigate إطلاقاً', () => {
        const onNavigate = vi.fn();
        const w = new Wizard('c', fakeStore(), {}, { steps: QUICK_STEPS, onNavigate });
        w.stepIndexMap = QUICK_ABSOLUTE_INDICES;
        w.currentStepIndex = 0; // أول عنصر في القائمة المُصفّاة
        w.bindNavigationEvents();

        document.getElementById('btnPrevStep').click();
        expect(onNavigate).not.toHaveBeenCalled();
    });

    it('من آخر خطوة مرئية (المطلق 8، محلي 4): زر التالي لا يستدعي onNavigate إطلاقاً', () => {
        const onNavigate = vi.fn();
        const w = new Wizard('c', fakeStore(), {}, { steps: QUICK_STEPS, onNavigate });
        w.stepIndexMap = QUICK_ABSOLUTE_INDICES;
        w.currentStepIndex = 8; // آخر عنصر في القائمة المُصفّاة
        w.bindNavigationEvents();

        document.getElementById('btnNextStep').click();
        expect(onNavigate).not.toHaveBeenCalled();
    });
});

describe('Wizard — شريط التنقل (appendNav): حالة التعطيل ونص «الخطوة التالية»', () => {
    beforeEach(() => setupNavDom());

    it('في منتصف المسار المُصفّى: لا تعطيل، ونص الخطوة التالية هو تسمية الخطوة المرئية الفعلية التالية', () => {
        const w = new Wizard('c', fakeStore(), {}, { steps: QUICK_STEPS, onNavigate: () => {} });
        w.stepIndexMap = QUICK_ABSOLUTE_INDICES;
        w.appendNav(6); // المطلق 6 = محلي 3، التالي محلي 4 = المطلق 8 = step8

        expect(document.getElementById('btnPrevStep').disabled).toBe(false);
        expect(document.getElementById('btnNextStep').disabled).toBe(false);
        expect(document.querySelector('.nav-indicator__label').textContent).toBe('خطوة 8');
    });

    it('عند أول خطوة مرئية (المطلق 0): زر السابق معطَّل رغم أن الفهرس المطلق نفسه ليس صفراً حصراً بهذا المثال', () => {
        const w = new Wizard('c', fakeStore(), {}, { steps: QUICK_STEPS, onNavigate: () => {} });
        w.stepIndexMap = QUICK_ABSOLUTE_INDICES;
        w.appendNav(0);

        expect(document.getElementById('btnPrevStep').disabled).toBe(true);
        expect(document.getElementById('btnNextStep').disabled).toBe(false);
    });

    it('عند آخر خطوة مرئية (المطلق 8، محلي 4 = آخر عنصر): زر التالي معطَّل رغم أن المطلق 8 ليس آخر شيء في STEPS الكاملة (10 عناصر)', () => {
        const w = new Wizard('c', fakeStore(), {}, { steps: QUICK_STEPS, onNavigate: () => {} });
        w.stepIndexMap = QUICK_ABSOLUTE_INDICES;
        w.appendNav(8);

        expect(document.getElementById('btnNextStep').disabled).toBe(true);
        expect(document.getElementById('btnPrevStep').disabled).toBe(false);
        // هذا بالضبط الخلل الأصلي: buggy stepIndex(8) !== this.steps.length-1(4) فيبقى الزر فعّالاً خطأً
    });
});

describe('Wizard — الوضع المتقدم (بلا stepIndexMap): لا انحدار في السلوك السابق الصحيح', () => {
    beforeEach(() => setupNavDom());

    it('يتنقل بفهرس مطلق مباشر تسلسلي كالمعتاد عندما steps = STEPS الكاملة', () => {
        const onNavigate = vi.fn();
        const w = new Wizard('c', fakeStore(), {}, { steps: FULL_STEPS, onNavigate });
        w.currentStepIndex = 4;
        w.bindNavigationEvents();

        document.getElementById('btnNextStep').click();
        expect(onNavigate).toHaveBeenCalledWith(5);
    });

    it('appendNav في الوضع المتقدم: التعطيل يطابق حدود المصفوفة الكاملة كالمعتاد', () => {
        const w = new Wizard('c', fakeStore(), {}, { steps: FULL_STEPS, onNavigate: () => {} });
        w.appendNav(9); // آخر عنصر فعلياً في FULL_STEPS (10 عناصر، فهرس 0-9)
        expect(document.getElementById('btnNextStep').disabled).toBe(true);
    });
});
