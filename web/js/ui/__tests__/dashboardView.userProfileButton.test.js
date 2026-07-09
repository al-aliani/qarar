/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-09 (توحيد المصادقة): زر «حسابي» كان موجوداً فقط داخل AuthComponent.js
 * الميت (حاويته مخفية دائماً) — صفحة الحساب/إعدادات 2FA (UserProfileView.js) لم تكن
 * قابلة للوصول إطلاقاً من أي مسار حي. أُضيف زر «حسابي» في dv-topbar الحي بجانب
 * زر الخروج، يُطلق نفس حدث feasibility:showUserProfile الذي كان له معالج حي بالفعل
 * في app.js لكن بلا أي زر يُطلقه.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../supabaseClient.js', () => ({
    getAuthUser: vi.fn(async () => ({ user: { email: 'user@example.com' } })),
    signOut: vi.fn(async () => {})
}));

vi.mock('../../services/ProjectManager.js', () => ({
    ProjectManager: { getActiveProjects: vi.fn(async () => []) }
}));

describe('DashboardView — زر «حسابي» في dv-topbar', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="dv"></div>';
    });

    it('يظهر زر «حسابي» بجانب زر الخروج حين يوجد مستخدم مسجَّل', async () => {
        const { DashboardView } = await import('../DashboardView.js');
        const view = new DashboardView('dv', { getState: () => ({}), get: () => ({}), subscribe: () => () => {} });
        await view.render();

        const btn = document.getElementById('btnUserProfile');
        expect(btn).not.toBeNull();
        expect(document.getElementById('btnLogout')).not.toBeNull();
    });

    it('النقر على «حسابي» يُطلق حدث feasibility:showUserProfile', async () => {
        const { DashboardView } = await import('../DashboardView.js');
        const view = new DashboardView('dv', { getState: () => ({}), get: () => ({}), subscribe: () => () => {} });
        await view.render();

        const handler = vi.fn();
        window.addEventListener('feasibility:showUserProfile', handler);
        document.getElementById('btnUserProfile').click();
        expect(handler).toHaveBeenCalledTimes(1);
        window.removeEventListener('feasibility:showUserProfile', handler);
    });

    it('لا زر «حسابي» ولا «خروج» لضيف غير مسجَّل — يظهر زر «تسجيل الدخول» فقط', async () => {
        const { getAuthUser } = await import('../../../supabaseClient.js');
        getAuthUser.mockResolvedValueOnce({ user: null });

        const { DashboardView } = await import('../DashboardView.js');
        const view = new DashboardView('dv', { getState: () => ({}), get: () => ({}), subscribe: () => () => {} });
        await view.render();

        expect(document.getElementById('btnUserProfile')).toBeNull();
        expect(document.getElementById('btnLogout')).toBeNull();
        expect(document.getElementById('dashboardLogin')).not.toBeNull();
    });
});
