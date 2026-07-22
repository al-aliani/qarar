/**
 * @vitest-environment jsdom
 *
 * تدقيق حي 2026-07-22 (Workflow فحص إضافي): StudyComparison.js كان الملف
 * الوحيد من بين ملفات المشروع التي تعرض projectInfo.name أن لا يستورد
 * escapeHtml — اسم دراسة يحوي علامات HTML كان يُحقن خاماً في <option> وفي
 * عنواني المقارنة (savedName/currentName)، بخلاف GlobalAnalyticsView/
 * InvestorDashboard/ShareView التي تُهرّب نفس الحقل دائماً.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StudyComparison } from '../StudyComparison.js';

vi.mock('../../services/DataService.js', () => ({
    DataService: {
        getAvailableStudiesForComparison: vi.fn(),
        compareStudies: vi.fn(),
    },
}));

import { DataService } from '../../services/DataService.js';

function fakeStore(state = {}) {
    return { get: () => state };
}

describe('StudyComparison — تهريب اسم الدراسة (XSS)', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="comparisonContainer"></div>';
        vi.clearAllMocks();
    });

    it('اسم دراسة يحوي وسم HTML في قائمة الاختيار لا يُنفَّذ كترميز، بل يظهر كنص خام', async () => {
        DataService.getAvailableStudiesForComparison.mockResolvedValue([
            { id: 's1', name: '<img src=x onerror=alert(1)>', date: '2026-01-01' },
        ]);

        const view = new StudyComparison('comparisonContainer', fakeStore({ projectInfo: { id: 'current' } }));
        await view.render();

        const option = document.querySelector('#compareStudySelect option[value="s1"]');
        expect(option.querySelector('img')).toBeNull();
        expect(option.textContent).toContain('<img src=x onerror=alert(1)>');
    });

    it('savedName/currentName في نتيجة المقارنة تُهرَّب أيضاً', async () => {
        const row = { status: 'positive', diff: 1, pct: 1, base: 1, current: 2, isPercent: false };
        DataService.getAvailableStudiesForComparison.mockResolvedValue([{ id: 's1', name: 'دراسة عادية', date: '2026-01-01' }]);
        DataService.compareStudies.mockResolvedValue({
            comparison: { npv: row, irr: row, payback: row, capex: row, opex: row, revenue: row },
            meta: { savedName: '<b>محفوظة</b>', currentName: '"><script>x</script>' },
        });

        const view = new StudyComparison('comparisonContainer', fakeStore({ projectInfo: { id: 'current' } }));
        view.selectedStudyId = 's1';
        await view.render();
        await new Promise((r) => setTimeout(r, 0));

        const header = document.querySelector('.comp-header-card');
        expect(header.querySelector('b')).toBeNull();
        expect(header.querySelector('script')).toBeNull();
        expect(header.textContent).toContain('<b>محفوظة</b>');
    });
});
