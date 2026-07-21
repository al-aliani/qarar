/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-21 (بلوكر إطلاق #30): signOut() يمسح كل مفاتيح feas_project_ من هذا
 * الجهاز فوراً (مقصود لخصوصية الأجهزة المشتركة)، لكن نافذة تأكيد الخروج كانت عامة
 * ("هل تود تسجيل الخروج؟") بلا أي إشارة لوجود دراسات محفوظة محلياً فقط (source:
 * 'local') لم تُزامَن مع السحابة بعد — فتُفقَد نهائياً بلا تحذير حقيقي. الإصلاح: فحص
 * المشاريع غير المُزامَنة قبل عرض التأكيد، وتخصيص نص/أيقونة الرسالة عند وجودها.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('sweetalert2', () => ({
    default: { fire: vi.fn(async () => ({ isConfirmed: false })) }
}));

const signOutMock = vi.fn(async () => {});
vi.mock('../../../supabaseClient.js', () => ({
    getAuthUser: vi.fn(async () => ({ user: null })),
    signOut: signOutMock,
    getUserProfile: vi.fn(async () => null),
}));

vi.mock('../../services/ProjectManager.js', () => ({
    ProjectManager: {
        getAllProjects: vi.fn(async () => []),
    }
}));

describe('DashboardView — تحذير الخروج عند وجود دراسات محلية غير مُزامَنة', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="dv"><button type="button" id="btnLogout"></button></div>';
        vi.clearAllMocks();
    });

    it('يعرض تحذيراً محدَّداً (icon: error) يذكر عدد الدراسات غير المُزامَنة إن وُجدت', async () => {
        const { ProjectManager } = await import('../../services/ProjectManager.js');
        ProjectManager.getAllProjects.mockResolvedValue([
            { id: '1', source: 'local' },
            { id: '2', source: 'synced' },
            { id: '3', source: 'local' },
        ]);

        const Swal = (await import('sweetalert2')).default;
        const { DashboardView } = await import('../DashboardView.js');
        const view = new DashboardView('dv', { get: () => ({}), getState: () => ({}) }, () => {});
        view.bindEvents();

        document.getElementById('btnLogout').click();
        await new Promise((r) => setTimeout(r, 0));
        await new Promise((r) => setTimeout(r, 0));

        expect(Swal.fire).toHaveBeenCalledTimes(1);
        const args = Swal.fire.mock.calls[0][0];
        expect(args.icon).toBe('error');
        expect(args.text).toContain('2');
        expect(args.text).toMatch(/غير مُزامَنة|لم تُزامَن/);
    });

    it('يعرض التحذير العام المعتاد (icon: warning) حين كل الدراسات مُزامَنة بالفعل', async () => {
        const { ProjectManager } = await import('../../services/ProjectManager.js');
        ProjectManager.getAllProjects.mockResolvedValue([
            { id: '1', source: 'synced' },
        ]);

        const Swal = (await import('sweetalert2')).default;
        const { DashboardView } = await import('../DashboardView.js');
        const view = new DashboardView('dv', { get: () => ({}), getState: () => ({}) }, () => {});
        view.bindEvents();

        document.getElementById('btnLogout').click();
        await new Promise((r) => setTimeout(r, 0));
        await new Promise((r) => setTimeout(r, 0));

        expect(Swal.fire).toHaveBeenCalledTimes(1);
        const args = Swal.fire.mock.calls[0][0];
        expect(args.icon).toBe('warning');
        expect(args.text).toBe('هل تود تسجيل الخروج؟');
    });
});
