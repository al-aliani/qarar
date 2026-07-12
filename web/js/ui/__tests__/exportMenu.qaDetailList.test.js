/**
 * @vitest-environment jsdom
 *
 * دفعة 3 (2026-07-12، اختبار عميل بقالة): نافذة التصدير كانت تعرض «تحذيرات: 6» بلا أي
 * تفصيل. الآن #export-qa-badge يعرض قائمة مفصّلة قابلة للنقر (كل بند يقفز لخطوته عبر
 * حدث feasibility:navigateToStep الذي يلتقطه app.js)، وحوار بوابة الجودة (_qaGate) يتيح
 * نفس القفز لبنوده أيضاً.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEmptyStudy } from '../../core/schema.js';
import { stepIndexById } from '../../core/wizardSteps.js';
import { ExportMenu } from '../ExportMenu.js';

function fakeStore(state) {
    return { getState: () => state, get: () => state, update: vi.fn(), notify: vi.fn() };
}

describe('ExportMenu — قائمة تحذيرات فحص الجودة المفصّلة (#export-qa-badge)', () => {
    beforeEach(() => {
        document.body.innerHTML = `<div id="exportMenuOverlay"></div>`;
    });

    it('دراسة فارغة (بلا إيرادات) تعرض تفصيلاً قابلاً للنقر بدل عدد مجرّد فقط', async () => {
        const menu = new ExportMenu('exportMenuOverlay', fakeStore(createEmptyStudy()));
        await menu.open();

        const badge = document.getElementById('export-qa-badge');
        expect(badge.innerHTML).toContain('qa-detail-list');
        const items = badge.querySelectorAll('.qa-detail-item');
        expect(items.length).toBeGreaterThan(0);
    });

    it('بند مرتبط بمسار "revenue" (لا إيرادات) قابل للنقر ويحمل فهرس خطوة مصادر الإيرادات الصحيح', async () => {
        const menu = new ExportMenu('exportMenuOverlay', fakeStore(createEmptyStudy()));
        await menu.open();

        const badge = document.getElementById('export-qa-badge');
        const jumpButtons = Array.from(badge.querySelectorAll('button.qa-detail-item[data-step-index]'));
        const revenueBtn = jumpButtons.find((b) => /إيراد/.test(b.textContent));
        expect(revenueBtn).toBeTruthy();
        expect(Number(revenueBtn.dataset.stepIndex)).toBe(stepIndexById('revenue'));
    });

    it('النقر على بند قابل للنقر يُطلق feasibility:navigateToStep بفهرس الخطوة الصحيح ويُغلق القائمة', async () => {
        const menu = new ExportMenu('exportMenuOverlay', fakeStore(createEmptyStudy()));
        await menu.open();
        menu.overlay.classList.add('is-open'); // يثبّت الحالة الأولية قبل النقر

        const badge = document.getElementById('export-qa-badge');
        const jumpButtons = Array.from(badge.querySelectorAll('button.qa-detail-item[data-step-index]'));
        expect(jumpButtons.length).toBeGreaterThan(0);
        const target = jumpButtons[0];
        const expectedIndex = Number(target.dataset.stepIndex);

        const handler = vi.fn();
        window.addEventListener('feasibility:navigateToStep', handler);
        target.click();
        window.removeEventListener('feasibility:navigateToStep', handler);

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler.mock.calls[0][0].detail.stepIndex).toBe(expectedIndex);
        expect(menu.overlay.classList.contains('is-open')).toBe(false);
    });

    it('دراسة تجتاز الفحص دون تحذيرات تعرض الشارة الخضراء بلا قائمة تفصيل', async () => {
        const el = document.createElement('div');
        el.id = 'export-qa-badge';
        const menu = new ExportMenu('exportMenuOverlay', fakeStore(createEmptyStudy()));
        menu._renderQaSummary(el, { hardErrors: [], softWarnings: [], validationErrors: [], validationWarnings: [] });

        expect(el.innerHTML).toContain('اجتازت فحص الجودة');
        expect(el.innerHTML).not.toContain('qa-detail-list');
    });

    it('_renderQaSummary يهرّب HTML في نص التحذير (لا حقن Stored XSS)', () => {
        const el = document.createElement('div');
        const menu = new ExportMenu('exportMenuOverlay', fakeStore(createEmptyStudy()));
        menu._renderQaSummary(el, {
            hardErrors: [{ code: 'X', message: '<img src=x onerror=alert(1)>', path: 'system' }],
            softWarnings: [], validationErrors: [], validationWarnings: []
        });

        expect(el.innerHTML).not.toContain('<img');
        expect(el.innerHTML).toContain('&lt;img');
    });
});
