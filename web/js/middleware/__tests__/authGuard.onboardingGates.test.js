/**
 * @vitest-environment jsdom
 *
 * سلسلة إكمال الحساب — قسمان منفصلان الآن (تدقيق 2026-07-17: تأجيل بوابتَي
 * واتساب/الباقة لما بعد أول رسم فعلي للرئيسية، تفادي تكديس 3 نوافذ متتالية قبل
 * أي قيمة من المنتج — انظر AuthGuard.js):
 * 1) AuthGuard._runOnboardingGates (SIGNED_IN فقط) — يفتح بوابة الجوال الإلزامية
 *    فقط، ولا يُكمل تلقائياً لبقية السلسلة.
 * 2) AuthGuard.runDeferredOnboardingGates() (تُستدعى من DashboardView بعد أول
 *    رسم للرئيسية) — دعوة تواصل واتساب (2026-07-17: تحقق يدوي بدل رمز آلي عبر
 *    ميتا، انظر migration 20260717020000) ثم تفضيل باقة، كلتاهما قابلة للتخطي.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

let authStateCallback = null;
const onAuthStateChangeMock = vi.fn((cb) => { authStateCallback = cb; });
const getUserProfileMock = vi.fn();

vi.mock('../../../supabaseClient.js', () => ({
    getSupabaseClient: vi.fn(async () => ({
        ok: true,
        supabase: { auth: { onAuthStateChange: onAuthStateChangeMock } }
    })),
    getAuthUser: vi.fn(async () => ({ user: null, ok: false })),
    getUserProfile: (...a) => getUserProfileMock(...a),
}));

vi.mock('../../utils/auditLogger.js', () => ({
    log: vi.fn(),
    ACTIONS: { LOGIN: 'login', LOGOUT: 'logout', SIGNUP: 'signup', OAUTH: 'oauth' }
}));

const completePhoneOpenMock = vi.fn();
let completePhoneOptions = null;
vi.mock('../../ui/CompletePhoneModal.js', () => ({
    CompletePhoneModal: class {
        constructor(options) { completePhoneOptions = options; }
        open() { completePhoneOpenMock(); }
    }
}));

const whatsappContactOpenMock = vi.fn();
let whatsappContactOptions = null;
vi.mock('../../ui/WhatsAppContactModal.js', () => ({
    WhatsAppContactModal: class {
        constructor(options) { whatsappContactOptions = options; }
        open() { whatsappContactOpenMock(); }
    }
}));

const packagePreferenceOpenMock = vi.fn();
vi.mock('../../ui/PackagePreferenceModal.js', () => ({
    PackagePreferenceModal: class {
        constructor() {}
        open() { packagePreferenceOpenMock(); }
    }
}));

async function triggerSignedIn() {
    const { AuthGuard } = await import('../AuthGuard.js');
    await AuthGuard.subscribeToAuthChanges(() => {});
    authStateCallback('SIGNED_IN', { user: { id: 'u1', email: 'a@b.com' } });
    await new Promise((r) => setTimeout(r, 0));
    return AuthGuard;
}

describe('AuthGuard._runOnboardingGates (SIGNED_IN) — بوابة الجوال فقط، متزامنة', () => {
    beforeEach(() => {
        vi.resetModules();
        authStateCallback = null;
        onAuthStateChangeMock.mockClear();
        getUserProfileMock.mockReset();
        completePhoneOpenMock.mockClear();
        whatsappContactOpenMock.mockClear();
        packagePreferenceOpenMock.mockClear();
        completePhoneOptions = null;
        whatsappContactOptions = null;
    });

    it('جوال ناقص: يفتح CompletePhoneModal فقط', async () => {
        getUserProfileMock.mockResolvedValue({ ok: true, profile: { phone: null, whatsapp_contact_prompted: false, preferred_tier: null } });
        await triggerSignedIn();

        expect(completePhoneOpenMock).toHaveBeenCalledTimes(1);
        expect(whatsappContactOpenMock).not.toHaveBeenCalled();
        expect(packagePreferenceOpenMock).not.toHaveBeenCalled();
    });

    it('جوال موجود بالفعل: SIGNED_IN وحدها لا تفتح واتساب ولا الباقة (مؤجَّلتان لـrunDeferredOnboardingGates)', async () => {
        getUserProfileMock.mockResolvedValue({ ok: true, profile: { phone: '+966512345678', whatsapp_contact_prompted: false, preferred_tier: null } });
        await triggerSignedIn();

        expect(completePhoneOpenMock).not.toHaveBeenCalled();
        expect(whatsappContactOpenMock).not.toHaveBeenCalled();
        expect(packagePreferenceOpenMock).not.toHaveBeenCalled();
    });

    it('getUserProfile فاشلة (ok:false، مثلاً هجرات لم تُطبَّق بعد): لا يفتح أي نافذة، لا يمنع الدخول', async () => {
        getUserProfileMock.mockResolvedValue({ ok: false, error: 'profiles table missing' });
        await triggerSignedIn();

        expect(completePhoneOpenMock).not.toHaveBeenCalled();
    });

    it('onSaved من CompletePhoneModal يستدعي السلسلة المؤجَّلة بـforce:true ويفتح واتساب مباشرة', async () => {
        getUserProfileMock
            .mockResolvedValueOnce({ ok: true, profile: { phone: null, whatsapp_contact_prompted: false, preferred_tier: null } })
            .mockResolvedValueOnce({ ok: true, profile: { phone: '+966512345678', whatsapp_contact_prompted: false, preferred_tier: null } });
        await triggerSignedIn();

        expect(completePhoneOpenMock).toHaveBeenCalledTimes(1);
        expect(whatsappContactOpenMock).not.toHaveBeenCalled();

        await completePhoneOptions.onSaved();
        await new Promise((r) => setTimeout(r, 0));

        expect(whatsappContactOpenMock).toHaveBeenCalledTimes(1);
    });
});

describe('AuthGuard.runDeferredOnboardingGates — واتساب/تفضيل الباقة بعد أول رسم للرئيسية', () => {
    beforeEach(() => {
        vi.resetModules();
        authStateCallback = null;
        onAuthStateChangeMock.mockClear();
        getUserProfileMock.mockReset();
        completePhoneOpenMock.mockClear();
        whatsappContactOpenMock.mockClear();
        packagePreferenceOpenMock.mockClear();
        completePhoneOptions = null;
        whatsappContactOptions = null;
    });

    it('جوال موجود، دعوة واتساب لم تُعرَض بعد: تفتح WhatsAppContactModal فقط', async () => {
        getUserProfileMock.mockResolvedValue({ ok: true, profile: { phone: '+966512345678', whatsapp_contact_prompted: false, preferred_tier: null } });
        const { AuthGuard } = await import('../AuthGuard.js');
        await AuthGuard.runDeferredOnboardingGates();

        expect(completePhoneOpenMock).not.toHaveBeenCalled();
        expect(whatsappContactOpenMock).toHaveBeenCalledTimes(1);
        expect(packagePreferenceOpenMock).not.toHaveBeenCalled();
    });

    it('دعوة واتساب عُرضت (whatsapp_contact_prompted=true) لكن بلا تفضيل باقة: تفتح PackagePreferenceModal فقط', async () => {
        getUserProfileMock.mockResolvedValue({ ok: true, profile: { phone: '+966512345678', whatsapp_contact_prompted: true, preferred_tier: null } });
        const { AuthGuard } = await import('../AuthGuard.js');
        await AuthGuard.runDeferredOnboardingGates();

        expect(whatsappContactOpenMock).not.toHaveBeenCalled();
        expect(packagePreferenceOpenMock).toHaveBeenCalledTimes(1);
    });

    it('كل الحالات مكتملة: لا تفتح أي نافذة', async () => {
        getUserProfileMock.mockResolvedValue({ ok: true, profile: { phone: '+966512345678', whatsapp_contact_prompted: true, preferred_tier: 'self' } });
        const { AuthGuard } = await import('../AuthGuard.js');
        await AuthGuard.runDeferredOnboardingGates();

        expect(whatsappContactOpenMock).not.toHaveBeenCalled();
        expect(packagePreferenceOpenMock).not.toHaveBeenCalled();
    });

    it('الجوال لا يزال ناقصاً (سباق: الرئيسية رُسمت قبل بوابة SIGNED_IN): ترجع بصمت بلا فتح أي نافذة', async () => {
        getUserProfileMock.mockResolvedValue({ ok: true, profile: { phone: null, whatsapp_contact_prompted: false, preferred_tier: null } });
        const { AuthGuard } = await import('../AuthGuard.js');
        await AuthGuard.runDeferredOnboardingGates();

        expect(completePhoneOpenMock).not.toHaveBeenCalled();
        expect(whatsappContactOpenMock).not.toHaveBeenCalled();
        expect(packagePreferenceOpenMock).not.toHaveBeenCalled();
    });

    it('استدعاء onDismissed من WhatsAppContactModal يفتح الخطوة التالية (مو نفس النافذة ثانية)', async () => {
        getUserProfileMock
            .mockResolvedValueOnce({ ok: true, profile: { phone: '+966512345678', whatsapp_contact_prompted: false, preferred_tier: null } })
            .mockResolvedValueOnce({ ok: true, profile: { phone: '+966512345678', whatsapp_contact_prompted: true, preferred_tier: null } });
        const { AuthGuard } = await import('../AuthGuard.js');
        await AuthGuard.runDeferredOnboardingGates();

        expect(whatsappContactOpenMock).toHaveBeenCalledTimes(1);
        expect(packagePreferenceOpenMock).not.toHaveBeenCalled();

        await whatsappContactOptions.onDismissed();
        await new Promise((r) => setTimeout(r, 0));

        expect(packagePreferenceOpenMock).toHaveBeenCalledTimes(1);
        // لا يُعاد فتح WhatsAppContactModal مرة ثانية
        expect(whatsappContactOpenMock).toHaveBeenCalledTimes(1);
    });

    it('حارس التكرار: نداءان متتاليان بلا force يجلبان البروفايل مرة واحدة فقط (لا يُعاد الفحص عند كل زيارة للرئيسية)', async () => {
        getUserProfileMock.mockResolvedValue({ ok: true, profile: { phone: '+966512345678', whatsapp_contact_prompted: true, preferred_tier: 'self' } });
        const { AuthGuard } = await import('../AuthGuard.js');
        await AuthGuard.runDeferredOnboardingGates();
        await AuthGuard.runDeferredOnboardingGates();

        expect(getUserProfileMock).toHaveBeenCalledTimes(1);
    });

    it('getUserProfile فاشلة: لا يفتح أي نافذة، لا ينهار', async () => {
        getUserProfileMock.mockResolvedValue({ ok: false, error: 'profiles table missing' });
        const { AuthGuard } = await import('../AuthGuard.js');
        await expect(AuthGuard.runDeferredOnboardingGates()).resolves.not.toThrow();

        expect(whatsappContactOpenMock).not.toHaveBeenCalled();
        expect(packagePreferenceOpenMock).not.toHaveBeenCalled();
    });
});
