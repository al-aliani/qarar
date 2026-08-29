/**
 * @vitest-environment jsdom
 *
 * بند 4 (بانر إصدار المحرك، 2026-08-29): الملخص التنفيذي أيضاً سطح ملخّص/قرار
 * (نفس فئة ProjectOverviewView/DecisionDashboard) — يستخدم نفس المنطق المشترك في
 * utils/engineVersionNotice.js بدل نسخة محلية.
 */
import { describe, it, expect } from 'vitest';
import { ExecutiveSummary } from '../ExecutiveSummary.js';
import { createEmptyStudy } from '../../core/schema.js';

function fakeStore(state) {
    return { getState: () => state, get: () => state, update: () => {} };
}

describe('ExecutiveSummary — تنبيه تغيّر إصدار المحرك', () => {
    it('لا بانر حين لا توجد بصمة إصدار محفوظة (دراسة جديدة/قديمة قبل الميزة)', () => {
        const state = createEmptyStudy();
        document.body.innerHTML = '<div id="host"></div>';
        const view = new ExecutiveSummary('host', fakeStore(state), null);

        view.render(0, 'indicators');

        expect(document.getElementById('host').innerHTML).not.toContain('engine-version-notice');
    });

    it('[إثبات الحارس] يعرض البانر الحقيقي عبر render() الفعلية حين تختلف البصمة المحفوظة عن الحالية', () => {
        const state = createEmptyStudy();
        state._meta = { engineVersion: 'a-version-that-will-never-match-current' };
        document.body.innerHTML = '<div id="host"></div>';
        const view = new ExecutiveSummary('host', fakeStore(state), null);

        view.render(0, 'indicators');

        expect(document.getElementById('host').innerHTML).toContain('engine-version-notice');
    });
});
