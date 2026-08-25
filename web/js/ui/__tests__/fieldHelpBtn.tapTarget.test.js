/**
 * @vitest-environment jsdom
 *
 * قياس حيّ 2026-08-26 على منفذ 375px داخل المعالج: من أصل 221 هدف لمس، 83 يفشل
 * WCAG 2.2 §2.5.8 (AA) الذي يشترط 24×24 بكسل CSS كحد أدنى — و**72 منها** هذا الزر
 * وحده (كان 22×22). الزر مرافق لكل حقل عبر الأربعين خطوة، فالفشل يتكرر في المنتج كله.
 *
 * الحارس بنيوي لا تخطيطي عمداً: jsdom لا يحسب تخطيطاً، فـgetBoundingClientRect يُرجع
 * أصفاراً ولا يمكن قياس الحجم المرسوم. نقرأ التصريح من نص الأنماط المحقونة نفسه —
 * وهو المصدر الوحيد لهذا الحجم (لا يُضبط في أي مكان آخر، تحقّق بـgrep قبل التعديل).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { fieldHelp } from '../components/FieldHelp.js';

const WCAG_MIN_PX = 24;

// الأنماط تُحقن مرة واحدة بعلم على مستوى الوحدة (ensureStyles)، فإزالة العنصر من DOM
// لا تُعيد الحقن. نلتقط النص مرة واحدة ونعيد استخدامه في كل الاختبارات.
let CSS_TEXT = '';
let BTN_RULE = '';

beforeAll(() => {
    document.body.innerHTML = fieldHelp('شرح تجريبي', 'مثال تجريبي');
    CSS_TEXT = document.getElementById('field-help-styles')?.textContent || '';
    BTN_RULE = (CSS_TEXT.match(/\.field-help-btn\s*\{([^}]*)\}/) || [])[1] || '';
});

describe('FieldHelp — حجم زر «؟» يحقق الحد الأدنى لهدف اللمس', () => {
    it('التصريح يضبط عرضاً وارتفاعاً لا يقلّان عن 24px (WCAG 2.2 §2.5.8 AA)', () => {
        const rule = BTN_RULE ? [null, BTN_RULE] : null;
        expect(rule, 'لم يُعثر على قاعدة .field-help-btn في الأنماط المحقونة').toBeTruthy();

        const w = rule[1].match(/(?:^|[;\s])width:\s*([\d.]+)px/);
        const h = rule[1].match(/(?:^|[;\s])height:\s*([\d.]+)px/);
        expect(w, 'لا يوجد تصريح width بالبكسل').toBeTruthy();
        expect(h, 'لا يوجد تصريح height بالبكسل').toBeTruthy();

        expect(parseFloat(w[1]),
            `عرض زر «؟» ${w[1]}px دون الحد ${WCAG_MIN_PX}px — يتكرر بجانب كل حقل في الأربعين خطوة`
        ).toBeGreaterThanOrEqual(WCAG_MIN_PX);
        expect(parseFloat(h[1]),
            `ارتفاع زر «؟» ${h[1]}px دون الحد ${WCAG_MIN_PX}px — يتكرر بجانب كل حقل في الأربعين خطوة`
        ).toBeGreaterThanOrEqual(WCAG_MIN_PX);
    });

    it('الزر يبقى دائرياً ومتمركزاً بعد التكبير (لا يتحول لبيضاوي)', () => {
        const rule = BTN_RULE;
        const w = parseFloat(rule.match(/(?:^|[;\s])width:\s*([\d.]+)px/)[1]);
        const h = parseFloat(rule.match(/(?:^|[;\s])height:\s*([\d.]+)px/)[1]);
        expect(w, 'العرض والارتفاع يجب أن يتساويا ليبقى الزر دائرة').toBe(h);
        expect(rule).toMatch(/border-radius:\s*50%/);
        expect(rule).toMatch(/align-items:\s*center/);
        expect(rule).toMatch(/justify-content:\s*center/);
    });

    it('الاسم المتاح والحالة المطوية موجودان على الزر نفسه', () => {
        document.body.innerHTML = fieldHelp('شرح', 'مثال');
        const btn = document.querySelector('.field-help-btn');
        expect(btn.getAttribute('aria-label')).toBeTruthy();
        expect(btn.getAttribute('aria-expanded')).toBe('false');
        expect(btn.getAttribute('aria-controls')).toBeTruthy();
        expect(document.getElementById(btn.getAttribute('aria-controls'))).toBeTruthy();
    });
});
