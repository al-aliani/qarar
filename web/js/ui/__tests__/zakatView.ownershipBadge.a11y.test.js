/**
 * @vitest-environment jsdom
 *
 * إتاحة (a11y): شارة هيكل الملكية في ZakatView.js تتبدّل بين لونين (badge--success
 * حين الملكية سعودية بالكامل، وbadge--warning حين وجود حصة أجنبية مختلطة). الشارة
 * أصلاً تحمل نصاً وصفياً كاملاً (وليس مجرد نقطة لونية) — نتحقق أن هذا النص الظاهر
 * يرافق الصنف اللوني دوماً معاً، فلا يعتمد تمييز الحالتين على اللون وحده.
 * نفس نمط التحقق في batch6.readinessDimensions.test.js.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ZakatView } from '../ZakatView.js';

function fakeStore(state) {
    return { getState: () => state };
}

describe('ZakatView — شارة هيكل الملكية لا تعتمد على اللون فقط (a11y)', () => {
    beforeEach(() => {
        document.body.innerHTML = `<div id="c"></div>`;
    });

    it('ملكية سعودية كاملة (100%) ⇒ badge--success + نص "زكاة فقط" ظاهر معاً', () => {
        const state = { projectInfo: {}, assumptions: {} };
        const view = new ZakatView('c', fakeStore(state));
        view.render();

        const badge = document.querySelector('.zakat-view .badge');
        expect(badge).toBeTruthy();
        // (1) الصنف اللوني
        expect(badge.className).toContain('badge--success');
        // (2) النص الظاهر — لا يكفي اللون وحده للتمييز
        expect(badge.textContent).toContain('زكاة فقط');
    });

    it('ملكية مختلطة (حصة أجنبية 30%) ⇒ badge--warning + نص "مختلط" يوضّح النسب معاً', () => {
        const state = { projectInfo: {}, assumptions: { foreignOwnershipRate: 0.3 } };
        const view = new ZakatView('c', fakeStore(state));
        view.render();

        const badge = document.querySelector('.zakat-view .badge');
        expect(badge).toBeTruthy();
        // (1) الصنف اللوني
        expect(badge.className).toContain('badge--warning');
        // (2) النص الظاهر يوضّح النسب فعلياً — لا يكفي اللون وحده
        expect(badge.textContent).toContain('مختلط');
        expect(badge.textContent).toContain('70%');
        expect(badge.textContent).toContain('30%');
    });

    it('حقل الملكية القديم (projectInfo.saudiOwnership) يُعطي نفس النتيجة النصية+اللونية المتسقة', () => {
        const state = { projectInfo: { saudiOwnership: 60 }, assumptions: {} };
        const view = new ZakatView('c', fakeStore(state));
        view.render();

        const badge = document.querySelector('.zakat-view .badge');
        expect(badge.className).toContain('badge--warning');
        expect(badge.textContent).toContain('مختلط');
        expect(badge.textContent).toContain('60%');
        expect(badge.textContent).toContain('40%');
    });
});
