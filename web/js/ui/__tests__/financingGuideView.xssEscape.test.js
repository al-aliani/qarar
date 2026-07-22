/**
 * @vitest-environment jsdom
 *
 * تدقيق حي 2026-07-22 (Workflow فحص إضافي): FinancingGuideView.js كان يحقن
 * item.label (نص حر يُحمَّل من state.financingReadinessChecklist — قابل
 * للتلاعب عبر استيراد نسخة احتياطية JSON غير مُعقَّمة، انظر ProjectManager.
 * importProjectBackup) في innerHTML/aria-label ونافذة الطباعة بلا escapeHtml،
 * بخلاف كل ملف View آخر بالمشروع.
 */
import { describe, it, expect } from 'vitest';
import { FinancingGuideView } from '../FinancingGuideView.js';

function fakeStore(state = {}) {
    return { getState: () => state };
}

describe('FinancingGuideView — تهريب نص بند قائمة التحقق (XSS)', () => {
    it('label يحوي وسم HTML في الجدول الرئيسي وaria-label لا يُنفَّذ، يظهر كنص خام فقط', () => {
        document.body.innerHTML = '<div id="financingContainer"></div>';
        const maliciousLabel = '<img src=x onerror=alert(1)>';
        const view = new FinancingGuideView('financingContainer', fakeStore({
            financingReadinessChecklist: [{ id: 'x', label: maliciousLabel, done: false }],
        }));
        view.render();

        const cell = document.querySelector('#financingChecklistSection td.p-3');
        expect(cell.querySelector('img')).toBeNull();
        expect(cell.textContent).toContain(maliciousLabel);

        const checkbox = document.querySelector('.check-readiness');
        expect(checkbox.getAttribute('aria-label')).toBe(maliciousLabel);
    });
});
