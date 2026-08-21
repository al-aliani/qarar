/**
 * @vitest-environment jsdom
 *
 * تدقيق أمني 2026-08-21 (47 وكيلاً بتحقق عدائي، ثغرتان حرجتان مؤكَّدتان):
 * (أ) signInWithPassword() كانت تُنشئ جلسة صالحة كاملة فوراً، وAuthGuard.isAuthenticated
 *     يصير true عبر SIGNED_IN بمعزل تام عن نتيجة تحدي 2FA اللاحق — حساب مسروقة كلمة
 *     مروره (بلا جهاز 2FA) يُمنح وصولاً كاملاً بمجرد إغلاق لوحة الرمز.
 * (ب) PASSWORD_RECOVERY تمنح نفس الشيء: فتح رابط الاستعادة وحده يُبادَل بجلسة كاملة
 *     فوراً، وisAuthenticated تصير true قبل أي تغيير فعلي لكلمة المرور.
 *
 * الإصلاح: isAuthenticated لا تصير true إلا بعد التأكد من عدم وجود تحدي AAL معلَّق
 * (SIGNED_IN)، وتبقى false طوال PASSWORD_RECOVERY حتى نجاح تغيير كلمة المرور فعلياً —
 * وإغلاق أي من النافذتين بلا إكمالهما يُبطل الجلسة فعلياً (signOut)، لا يتركها صالحة.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

let authStateCallback = null;
const onAuthStateChangeMock = vi.fn((cb) => { authStateCallback = cb; });
// شكل الإرجاع مطابق لـmfaGetAAL الحقيقية في supabaseClient.js: {ok, data} لا {data, error} خام.
const getAALMock = vi.fn(async () => ({ ok: true, data: { currentLevel: 'aal1', nextLevel: 'aal1' } }));

const signOutMock = vi.fn(async () => {});

vi.mock('../../../supabaseClient.js', () => ({
    getSupabaseClient: vi.fn(async () => ({
        ok: true,
        supabase: { auth: { onAuthStateChange: onAuthStateChangeMock } }
    })),
    getAuthUser: vi.fn(async () => ({ user: { id: 'u1', email: 'a@b.com' }, ok: true })),
    mfaGetAAL: (...args) => getAALMock(...args),
    signOut: (...args) => signOutMock(...args)
}));

const auditLogMock = vi.fn();
vi.mock('../../utils/auditLogger.js', () => ({
    log: (...args) => auditLogMock(...args),
    ACTIONS: { LOGIN: 'login', LOGOUT: 'logout', SIGNUP: 'signup', OAUTH: 'oauth' }
}));

let capturedModalOptions = null;
const newPasswordModalOpenMock = vi.fn();
vi.mock('../../ui/NewPasswordModal.js', () => ({
    NewPasswordModal: class {
        constructor(options) { capturedModalOptions = options; }
        open() { newPasswordModalOpenMock(); }
    }
}));

describe('AuthGuard — لا isAuthenticated=true إلا بعد اكتمال 2FA/تغيير كلمة المرور فعلياً', () => {
    beforeEach(() => {
        authStateCallback = null;
        capturedModalOptions = null;
        onAuthStateChangeMock.mockClear();
        auditLogMock.mockClear();
        newPasswordModalOpenMock.mockClear();
        getAALMock.mockClear();
        signOutMock.mockClear();
        getAALMock.mockResolvedValue({ ok: true, data: { currentLevel: 'aal1', nextLevel: 'aal1' } });
    });

    it('SIGNED_IN بحساب بلا 2FA: isAuthenticated=true فوراً (لا انحدار وظيفي)', async () => {
        const { AuthGuard } = await import('../AuthGuard.js');
        await AuthGuard.subscribeToAuthChanges(() => {});
        await authStateCallback('SIGNED_IN', { user: { email: 'a@b.com' } });

        expect(AuthGuard.isAuthenticated).toBe(true);
        expect(auditLogMock).toHaveBeenCalledWith('login', expect.objectContaining({ email: 'a@b.com' }));
    });

    it('SIGNED_IN بحساب مفعَّل 2FA (aal2 مطلوب): isAuthenticated تبقى false، لا auditLog دخول بعد', async () => {
        getAALMock.mockResolvedValue({ ok: true, data: { currentLevel: 'aal1', nextLevel: 'aal2' } });
        const { AuthGuard } = await import('../AuthGuard.js');
        await AuthGuard.subscribeToAuthChanges(() => {});
        await authStateCallback('SIGNED_IN', { user: { email: 'a@b.com' } });

        // الثغرة الأصلية: كانت isAuthenticated تصير true هنا رغم عدم إكمال تحدي 2FA إطلاقاً.
        expect(AuthGuard.isAuthenticated).toBe(false);
        expect(auditLogMock).not.toHaveBeenCalledWith('login', expect.anything());
    });

    it('refreshAuthState() بعد نجاح تحدي 2FA (aal2 مكتمل فعلياً): isAuthenticated تصير true', async () => {
        getAALMock.mockResolvedValueOnce({ ok: true, data: { currentLevel: 'aal1', nextLevel: 'aal2' } });
        const { AuthGuard } = await import('../AuthGuard.js');
        await AuthGuard.subscribeToAuthChanges(() => {});
        await authStateCallback('SIGNED_IN', { user: { email: 'a@b.com' } });
        expect(AuthGuard.isAuthenticated).toBe(false);

        // بعد تحقق الرمز فعلياً، الجلسة تصبح aal2 — AuthModalStub يستدعي refreshAuthState() هنا.
        getAALMock.mockResolvedValueOnce({ ok: true, data: { currentLevel: 'aal2', nextLevel: 'aal2' } });
        const result = await AuthGuard.refreshAuthState();

        expect(result).toBe(true);
        expect(AuthGuard.isAuthenticated).toBe(true);
    });

    it('PASSWORD_RECOVERY: isAuthenticated تبقى false فور الحدث، قبل أي تفاعل مع النافذة', async () => {
        const { AuthGuard } = await import('../AuthGuard.js');
        AuthGuard.isAuthenticated = true; // محاكاة حالة سابقة، للتأكد أن الحدث يصفّرها فعلياً
        await AuthGuard.subscribeToAuthChanges(() => {});
        await authStateCallback('PASSWORD_RECOVERY', { user: { email: 'a@b.com' } });

        expect(AuthGuard.isAuthenticated).toBe(false);
    });

    it('PASSWORD_RECOVERY: NewPasswordModal تُنشأ بـonSuccess يضبط isAuthenticated=true', async () => {
        const { AuthGuard } = await import('../AuthGuard.js');
        await AuthGuard.subscribeToAuthChanges(() => {});
        await authStateCallback('PASSWORD_RECOVERY', { user: { email: 'a@b.com' } });
        await new Promise((r) => setTimeout(r, 0)); // انتظار الاستيراد الديناميكي لفتح النافذة

        expect(newPasswordModalOpenMock).toHaveBeenCalledTimes(1);
        expect(capturedModalOptions?.onSuccess).toBeTypeOf('function');
        expect(capturedModalOptions?.onClose).toBeTypeOf('function');

        // محاكاة نجاح تغيير كلمة المرور فعلياً (استدعاء onSuccess كما تفعل NewPasswordModal)
        capturedModalOptions.onSuccess();
        expect(AuthGuard.isAuthenticated).toBe(true);
    });

    it('PASSWORD_RECOVERY: إغلاق النافذة بلا تغيير كلمة المرور (onClose) يُبقي isAuthenticated=false ويصفّر currentUser', async () => {
        const { AuthGuard } = await import('../AuthGuard.js');
        await AuthGuard.subscribeToAuthChanges(() => {});
        await authStateCallback('PASSWORD_RECOVERY', { user: { email: 'a@b.com' } });
        await new Promise((r) => setTimeout(r, 0));

        expect(capturedModalOptions?.onClose).toBeTypeOf('function');
        await capturedModalOptions.onClose();

        expect(signOutMock).toHaveBeenCalledTimes(1);
        expect(AuthGuard.isAuthenticated).toBe(false);
        expect(AuthGuard.currentUser).toBeNull();
    });
});
