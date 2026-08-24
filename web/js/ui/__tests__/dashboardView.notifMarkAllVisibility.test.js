/**
 * @vitest-environment jsdom
 *
 * الخلل المؤكَّد: زر «تعليم الكل كمقروء» في رأس لوحة الإشعارات (dvNotifMarkAll) كان
 * يظهر دوماً لأي مستخدم مسجَّل دخوله بصرف النظر عن وجود إشعارات غير مقروءة فعلاً —
 * حالة الفراغ كانت تُعالَج فقط داخل قائمة الإشعارات (dvNotifList) ولا تمسّ الزر.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../supabaseClient.js', () => ({
    getAuthUser: vi.fn(async () => ({ user: { email: 'user@example.com' } })),
    signOut: vi.fn(async () => {})
}));

vi.mock('../../services/ProjectManager.js', () => ({
    ProjectManager: { getActiveProjects: vi.fn(async () => []) }
}));

vi.mock('../../services/NotificationService.js', () => ({
    listNotifications: vi.fn(),
    markAllRead: vi.fn(async () => true),
    unreadCount: vi.fn(async () => 0)
}));

describe('DashboardView — ظهور زر «تعليم الكل كمقروء» حسب وجود إشعارات غير مقروءة', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="dv"></div>';
        vi.clearAllMocks();
    });

    it('يُخفى الزر حين كل الإشعارات مقروءة بالفعل', async () => {
        const { listNotifications } = await import('../../services/NotificationService.js');
        listNotifications.mockResolvedValue([
            { id: '1', title: 'إشعار قديم', body: null, read_at: new Date().toISOString(), created_at: new Date().toISOString() }
        ]);

        const { DashboardView } = await import('../DashboardView.js');
        const view = new DashboardView('dv', { getState: () => ({}), get: () => ({}), subscribe: () => () => {} });
        await view.render();

        document.getElementById('dvNotifBell').click();
        await new Promise(r => setTimeout(r, 0));

        expect(document.getElementById('dvNotifMarkAll').style.display).toBe('none');
    });

    it('يظهر الزر حين توجد إشعارات غير مقروءة، ويُخفى عند فتح اللوحة لاحقاً بعد أن صارت كلها مقروءة', async () => {
        const { listNotifications } = await import('../../services/NotificationService.js');
        listNotifications.mockResolvedValueOnce([
            { id: '1', title: 'جديد', body: null, read_at: null, created_at: new Date().toISOString() }
        ]);

        const { DashboardView } = await import('../DashboardView.js');
        const view = new DashboardView('dv', { getState: () => ({}), get: () => ({}), subscribe: () => () => {} });
        await view.render();

        const bell = document.getElementById('dvNotifBell');
        bell.click();
        await new Promise(r => setTimeout(r, 0));
        expect(document.getElementById('dvNotifMarkAll').style.display).toBe('');

        // فتح لاحق للوحة (استدعاء ثانٍ لـrenderNotifList) بعد ما صارت كل الإشعارات
        // مقروءة يجب أن يُحدِّث ظهور الزر، لا يقتصر التحقق على أول تحميل فقط.
        listNotifications.mockResolvedValueOnce([
            { id: '1', title: 'جديد', body: null, read_at: new Date().toISOString(), created_at: new Date().toISOString() }
        ]);
        bell.click(); // إغلاق
        await new Promise(r => setTimeout(r, 0));
        bell.click(); // إعادة فتح
        await new Promise(r => setTimeout(r, 0));

        expect(document.getElementById('dvNotifMarkAll').style.display).toBe('none');
    });
});
