/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-09 (توحيد المصادقة):
 * (أ) auditLog(LOGIN/LOGOUT) كان موجوداً فقط داخل AuthComponent.js الميت (حاويته
 *     #authContainer مخفية دائماً) — لا شيء يُسجَّل فعلياً في الإنتاج. الآن مركزياً
 *     في subscribeToAuthChanges عبر أحداث SIGNED_IN/SIGNED_OUT الحقيقية من Supabase.
 * (ب) PASSWORD_RECOVERY لم يكن له أي معالج إطلاقاً — رابط "نسيت كلمة المرور" ينتهي
 *     بلا أي واجهة لتعيين كلمة مرور جديدة. الآن يفتح NewPasswordModal تلقائياً.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

let authStateCallback = null;
const onAuthStateChangeMock = vi.fn((cb) => { authStateCallback = cb; });

vi.mock('../../../supabaseClient.js', () => ({
    getSupabaseClient: vi.fn(async () => ({
        ok: true,
        supabase: { auth: { onAuthStateChange: onAuthStateChangeMock } }
    })),
    getAuthUser: vi.fn(async () => ({ user: null, ok: false }))
}));

const auditLogMock = vi.fn();
vi.mock('../../utils/auditLogger.js', () => ({
    log: (...args) => auditLogMock(...args),
    ACTIONS: { LOGIN: 'login', LOGOUT: 'logout', SIGNUP: 'signup', OAUTH: 'oauth' }
}));

const newPasswordModalOpenMock = vi.fn();
vi.mock('../../ui/NewPasswordModal.js', () => ({
    NewPasswordModal: class {
        open() { newPasswordModalOpenMock(); }
    }
}));

describe('AuthGuard.subscribeToAuthChanges — auditLog مركزي + معالجة PASSWORD_RECOVERY', () => {
    beforeEach(() => {
        authStateCallback = null;
        onAuthStateChangeMock.mockClear();
        auditLogMock.mockClear();
        newPasswordModalOpenMock.mockClear();
    });

    it('SIGNED_IN يسجّل ACTIONS.LOGIN فعلياً', async () => {
        const { AuthGuard } = await import('../AuthGuard.js');
        await AuthGuard.subscribeToAuthChanges(() => {});
        expect(authStateCallback).toBeTypeOf('function');

        // تدقيق أمني 2026-08-21: الاستدعاء صار async (فحص AAL/2FA قبل تسجيل الدخول
        // فعلياً كمكتمل) — راجع authGuard.mfaAndPasswordRecovery.test.js لتغطية مخصَّصة.
        await authStateCallback('SIGNED_IN', { user: { email: 'a@b.com' } });
        expect(auditLogMock).toHaveBeenCalledWith('login', expect.objectContaining({ email: 'a@b.com' }));
    });

    it('SIGNED_OUT يسجّل ACTIONS.LOGOUT فعلياً', async () => {
        const { AuthGuard } = await import('../AuthGuard.js');
        await AuthGuard.subscribeToAuthChanges(() => {});
        await authStateCallback('SIGNED_OUT', { user: null });
        expect(auditLogMock).toHaveBeenCalledWith('logout', expect.any(Object));
    });

    it('PASSWORD_RECOVERY يفتح NewPasswordModal بدل تركه بلا أي واجهة', async () => {
        const { AuthGuard } = await import('../AuthGuard.js');
        await AuthGuard.subscribeToAuthChanges(() => {});
        authStateCallback('PASSWORD_RECOVERY', { user: { email: 'a@b.com' } });
        // الفتح async (import ديناميكي) — ننتظر دورة microtask
        await new Promise((r) => setTimeout(r, 0));
        expect(newPasswordModalOpenMock).toHaveBeenCalledTimes(1);
        // لا يُسجَّل كدخول/خروج عادي — حدث مختلف دلالياً
        expect(auditLogMock).not.toHaveBeenCalled();
    });

    it('TOKEN_REFRESHED لا يستدعي auditLog ولا NewPasswordModal (حدث صامت متوقَّع)', async () => {
        const { AuthGuard } = await import('../AuthGuard.js');
        await AuthGuard.subscribeToAuthChanges(() => {});
        authStateCallback('TOKEN_REFRESHED', { user: { email: 'a@b.com' } });
        expect(auditLogMock).not.toHaveBeenCalled();
        expect(newPasswordModalOpenMock).not.toHaveBeenCalled();
    });
});
