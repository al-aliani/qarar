/**
 * @vitest-environment jsdom
 *
 * تدقيق اختبار مستخدم 2026-07-19 (شخصية شريك/مستثمر): «لوحة الإحصائيات الشاملة»
 * (مقارنة المحفظة عبر كل الدراسات) موجودة وتعمل فعلياً لكنها مدفونة تحت
 * «الأدوات والمحرّكات» — لا رابط لها من مكان مقارنة الدراسات على الرئيسية نفسه،
 * رغم أنه أنسب موضع لها. أضيف رابط داخل توولكيت «مقارنة سريعة بين دراساتك».
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../supabaseClient.js', () => ({
    getAuthUser: vi.fn(async () => ({ user: null })),
    signOut: vi.fn(async () => {})
}));

const twoComparableProjects = [
    { id: 'p1', name: 'مقهى قهوة مختصة', lastModified: Date.now(), data: { projectInfo: {}, engineResults: { indicators: { npv: 569968, irr: null } } } },
    { id: 'p2', name: 'عيادة أسنان', lastModified: Date.now(), data: { projectInfo: {}, engineResults: { indicators: { npv: 1923272, irr: null } } } }
];

vi.mock('../../services/ProjectManager.js', () => ({
    ProjectManager: { getActiveProjects: vi.fn(async () => twoComparableProjects) }
}));

describe('DashboardView — رابط «لوحة الإحصائيات الشاملة» من توولكيت مقارنة الدراسات', () => {
    it('يظهر عند وجود دراستين قابلتين للمقارنة أو أكثر', async () => {
        document.body.innerHTML = '<div id="dv"></div>';
        const { DashboardView } = await import('../DashboardView.js');
        const view = new DashboardView('dv', { getState: () => ({}), get: () => ({}), subscribe: () => () => {} });
        await view.render();

        expect(document.getElementById('linkGlobalAnalyticsFromComparison')).not.toBeNull();
    });

    it('النقر عليه يُطلق حدث feasibility:showGlobalAnalytics (نفس معالج app.js الحي)', async () => {
        document.body.innerHTML = '<div id="dv"></div>';
        const { DashboardView } = await import('../DashboardView.js');
        const view = new DashboardView('dv', { getState: () => ({}), get: () => ({}), subscribe: () => () => {} });
        await view.render();

        const handler = vi.fn();
        window.addEventListener('feasibility:showGlobalAnalytics', handler);
        document.getElementById('linkGlobalAnalyticsFromComparison').click();
        expect(handler).toHaveBeenCalledTimes(1);
        window.removeEventListener('feasibility:showGlobalAnalytics', handler);
    });

    it('لا يظهر لدراسة واحدة فقط (لا شيء لمقارنته)', async () => {
        document.body.innerHTML = '<div id="dv"></div>';
        const { ProjectManager } = await import('../../services/ProjectManager.js');
        ProjectManager.getActiveProjects.mockResolvedValueOnce([twoComparableProjects[0]]);

        const { DashboardView } = await import('../DashboardView.js');
        const view = new DashboardView('dv', { getState: () => ({}), get: () => ({}), subscribe: () => () => {} });
        await view.render();

        expect(document.getElementById('linkGlobalAnalyticsFromComparison')).toBeNull();
    });
});
