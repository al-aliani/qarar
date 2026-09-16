/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { isAdmin } = vi.hoisted(() => ({ isAdmin: vi.fn() }));

vi.mock('../../middleware/AuthGuard.js', () => ({
    AuthGuard: { isAdmin, runDeferredOnboardingGates: vi.fn() },
}));

vi.mock('../../../supabaseClient.js', () => ({
    getAuthUser: vi.fn(async () => ({ user: { id: 'owner-id', email: 'owner@example.com' } })),
    signOut: vi.fn(async () => {}),
}));

vi.mock('../../services/ProjectManager.js', () => ({
    ProjectManager: { getActiveProjects: vi.fn(async () => []) },
}));

describe('DashboardView — رابط لوحة الإدارة', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="dv"></div>';
        window.location.hash = '';
        isAdmin.mockReset();
    });

    it('يظهر في القائمة الجانبية وقائمة الحساب للأدمن ويفتح مسار الإدارة', async () => {
        isAdmin.mockResolvedValue(true);
        const { DashboardView } = await import('../DashboardView.js');
        const view = new DashboardView('dv', { getState: () => ({}), get: () => ({}), subscribe: () => () => {} });

        await view.render();

        expect(document.getElementById('btnAdminDashboard')).not.toBeNull();
        const links = document.querySelectorAll('[data-dv-route="admin"]');
        expect(links).toHaveLength(2);
        links[0].click();
        expect(window.location.hash).toBe('#/admin');
    });

    it('لا يظهر لغير الأدمن', async () => {
        isAdmin.mockResolvedValue(false);
        const { DashboardView } = await import('../DashboardView.js');
        const view = new DashboardView('dv', { getState: () => ({}), get: () => ({}), subscribe: () => () => {} });

        await view.render();

        expect(document.querySelector('[data-dv-route="admin"]')).toBeNull();
        expect(document.getElementById('btnAdminDashboard')).toBeNull();
    });
});
