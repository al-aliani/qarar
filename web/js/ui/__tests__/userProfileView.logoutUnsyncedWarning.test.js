/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-21 (بلوكر #30، جزء 2/3): زر الخروج بصفحة «حسابي» كان يستدعي
 * signOut() مباشرة بلا أي تحقق من دراسات محلية غير مُزامَنة — على عكس زر لوحة
 * التحكم الذي أُصلح سابقاً (018c027). الإصلاح: توحيد الحماية عبر
 * signOutGuard.confirmAndSignOut المشترك (نفس تجربة لوحة التحكم).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const swalFireMock = vi.fn(async () => ({ isConfirmed: false }));
vi.mock('sweetalert2', () => ({ default: { fire: swalFireMock } }));

const signOutMock = vi.fn(async () => {});
vi.mock('../../../supabaseClient.js', () => ({
    getSupabaseClient: vi.fn(async () => ({ ok: true, supabase: {} })),
    getAuthUser: vi.fn(async () => ({ user: { id: 'u1', email: 'a@b.com', created_at: '2026-01-01' } })),
    getUserProfile: vi.fn(async () => ({ ok: true, profile: { phone: '' } })),
    updateUserDisplayName: vi.fn(),
    updateUserProfile: vi.fn(),
    signOut: signOutMock,
}));

const getAllProjectsMock = vi.fn(async () => []);
vi.mock('../../services/ProjectManager.js', () => ({
    ProjectManager: { getAllProjects: getAllProjectsMock },
}));

vi.mock('../../utils/auditLogger.js', () => ({ log: vi.fn(), ACTIONS: { LOGOUT: 'logout' } }));
vi.mock('../../utils/toast.js', () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }));
vi.mock('../../utils/analytics.js', () => ({ trackEvent: vi.fn() }));

async function renderView() {
    document.body.innerHTML = '<div id="up"></div>';
    const { UserProfileView } = await import('../UserProfileView.js');
    const view = new UserProfileView(document.getElementById('up'), {});
    await view.render();
    return view;
}

describe('UserProfileView — تحذير الخروج عند وجود دراسات محلية غير مُزامَنة (بلوكر #30)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        swalFireMock.mockResolvedValue({ isConfirmed: false });
        getAllProjectsMock.mockResolvedValue([]);
    });

    it('يعرض تحذيراً محدَّداً (icon: error) قبل الخروج حين توجد دراسات غير مُزامَنة، ولا يمسح إن أُلغي', async () => {
        getAllProjectsMock.mockResolvedValue([
            { id: '1', source: 'local' },
            { id: '2', source: 'cloud' },
        ]);
        await renderView();

        document.getElementById('btnUserProfileLogout').click();
        // معالج النقر يستورد sweetalert2 وsignOutGuard.js ديناميكياً (Promise.all) قبل
        // استدعاء Swal.fire — عدد دورات microtask/macrotask المطلوبة لاستقرارها غير
        // ثابت (يتفاوت فعلياً تحت ضغط CI)، فعدد محاولات setTimeout(0) الثابت كان
        // يفشل أحياناً (0 أو حتى تسرّب لاختبار لاحق) — vi.waitFor يبقى صحيحاً بصرف
        // النظر عن عدد الدورات الفعلي.
        await vi.waitFor(() => expect(swalFireMock).toHaveBeenCalledTimes(1));

        const args = swalFireMock.mock.calls[0][0];
        expect(args.icon).toBe('error');
        expect(args.text).toContain('1');
        expect(signOutMock).not.toHaveBeenCalled();
    });

    it('عند التأكيد فعلياً: يستدعي signOut ويُنفّذ التسجيل/التنبيه المرافق', async () => {
        swalFireMock.mockResolvedValue({ isConfirmed: true });
        getAllProjectsMock.mockResolvedValue([{ id: '1', source: 'local' }]);
        const { log: auditLogMock } = await import('../../utils/auditLogger.js');
        const { toast: toastMock } = await import('../../utils/toast.js');
        await renderView();

        document.getElementById('btnUserProfileLogout').click();
        await vi.waitFor(() => expect(signOutMock).toHaveBeenCalledTimes(1));

        expect(auditLogMock).toHaveBeenCalledWith('logout', {});
        expect(toastMock.info).toHaveBeenCalledWith('تم تسجيل الخروج');
    });
});
