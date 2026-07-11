/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-08: عنقود ScenarioAnalysis.js — ثلاث ملاحظات في نفس الملف:
 * #34 (متوسطة): verdict-box كان يعرض "قد لا يكون مجدياً" (استنتاج مالي سلبي زائف)
 * عند تعذّر حساب السيناريو المتشائم فعلياً (npv=null بسبب استثناء/NaN)، بدل
 * الإفصاح عن حالة التعذّر بشكل محايد (نفس null > 0 === false في JS).
 * #59 (منخفضة): نسب السيناريوهات الافتراضية (متشائم/متفائل) غير موسومة كتقدير
 * (ASSUMPTION) في الواجهة ولا في schema.js.
 * #60 (منخفضة): إشارة إلى تحليل حساسية "أدناه" رغم أن الدالة انتقلت لخطوة منفصلة.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const calculateStudyMock = vi.fn();
vi.mock('../../core/engine.js', () => ({
    calculateStudy: (...args) => calculateStudyMock(...args)
}));

const { ScenarioAnalysis } = await import('../ScenarioAnalysis.js');
const { SECTIONS, createEmptyStudy } = await import('../../core/schema.js');

function fakeStore(state) {
    return { getState: () => state, get: () => state, update: () => { }, notify: () => { } };
}

describe('ScenarioAnalysis — عنقود #34/#59/#60', () => {
    beforeEach(() => {
        document.body.innerHTML = `<div id="c"></div>`;
        calculateStudyMock.mockReset();
    });
    afterEach(() => { document.body.innerHTML = ''; });

    it('#34: تعذّر حساب السيناريو المتشائم فعلياً (استثناء) يُعرض كحالة محايدة "❔" لا تحذيراً مالياً زائفاً', () => {
        calculateStudyMock.mockImplementation((state, scenarioParams) => {
            if (!scenarioParams) return { indicators: { npv: 300000, irr: 0.15, paybackPeriod: 4 } };
            if (scenarioParams.revenueChange < 0) throw new Error('تعذّر الحساب (بيانات ناقصة) — محاكاة اختبار');
            return { indicators: { npv: 900000, irr: 0.25, paybackPeriod: 2 } };
        });

        const view = new ScenarioAnalysis('c', fakeStore({ scenarios: {} }), null);
        view.render();
        // نقرأ عنصر verdict-box تحديداً لا innerHTML الكامل — الأخير يحتوي أيضاً على
        // تعليق مطوّر توثيقي يذكر نص السلوك القديم حرفياً، فيُفسد أي بحث نصي عام.
        const verdict = document.querySelector('.verdict-box');

        expect(verdict.className).toContain('verdict-neutral');
        // العلامة المحايدة صارت أيقونة sprite (i-info) بلا نص إيموجي — الصنف verdict-neutral
        // هو الإشارة الدلالية المُختبَرة (تدقيق تنظيف الإيموجي 2026-07-11).
        expect(verdict.textContent).toContain('تعذّر حساب السيناريو المتشائم');
        expect(verdict.textContent).not.toContain('قد لا يكون مجدياً');
    });

    // ملاحظة: حالة "NPV سالب حقيقي ⇒ تحذير حقيقي" مُغطاة فعلاً بدراسة هامشية واقعية
    // (لا mock) في scenarioAnalysis.test.js — لا تُكرَّر هنا لتفادي ازدواج الاختبار.

    it('#59: يفصح عن أن نسب السيناريوهات الافتراضية تقديرات (ASSUMPTION) قابلة للتعديل', () => {
        calculateStudyMock.mockImplementation((state, scenarioParams) => {
            if (!scenarioParams) return { indicators: { npv: 300000, irr: 0.15, paybackPeriod: 4 } };
            return { indicators: { npv: 100000, irr: 0.1, paybackPeriod: 5 } };
        });

        const view = new ScenarioAnalysis('c', fakeStore({ scenarios: {} }), null);
        view.render();
        const html = document.getElementById('c').innerHTML;

        // الإفصاح صار موجزاً بطلب المالك (تدقيق 2026-07-11): يكفي أن يوضح أنها
        // تقديرات عامة قابلة للتعديل — دون مصطلح ASSUMPTION التقني في الواجهة.
        expect(html).toContain('تقديرات عامة');
        expect(html).toContain('عدّلها');
    });

    it('#59: القيم الافتراضية في schema.js (SECTIONS.SCENARIOS) لم تتغيّر رقمياً (التوسيم تعليق توثيقي فقط)', () => {
        const study = createEmptyStudy();
        expect(study[SECTIONS.SCENARIOS].pessimistic).toEqual({ revenueChange: -0.20, costChange: 0.15, description: 'سيناريو متشائم' });
        expect(study[SECTIONS.SCENARIOS].optimistic).toEqual({ revenueChange: 0.25, costChange: -0.10, description: 'سيناريو متفائل' });
    });

    it('#60: يشير لتحليل الحساسية كخطوة منفصلة، لا "أدناه" (الدالة القديمة أُزيلت من هذا المكوّن)', () => {
        calculateStudyMock.mockImplementation((state, scenarioParams) => {
            if (!scenarioParams) return { indicators: { npv: 300000, irr: 0.15, paybackPeriod: 4 } };
            return { indicators: { npv: 100000, irr: 0.1, paybackPeriod: 5 } };
        });

        const view = new ScenarioAnalysis('c', fakeStore({ scenarios: {} }), null);
        view.render();
        const html = document.getElementById('c').innerHTML;

        expect(html).toContain('خطوة «تحليل الحساسية» المنفصلة');
        expect(html).not.toContain('(±10%) أدناه');
    });
});
