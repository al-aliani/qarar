/**
 * @vitest-environment jsdom
 *
 * سلسلة إكمال الحساب (AuthGuard._runOnboardingGates) — ثلاث خطوات متسلسلة:
 * جوال → دعوة تواصل واتساب (تُعرَض مرة واحدة، انظر WhatsAppContactModal.js
 * وmigration 20260717020000 — تحقق يدوي من الأدمن بدل رمز آلي) → تفضيل باقة.
 * كل نافذة تُفتح فقط إن كانت الخطوات السابقة لها بالسلسلة مكتملة فعلاً.
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
}

describe('AuthGuard._runOnboardingGates — سلسلة إكمال الحساب', () => {
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

    it('جوال ناقص: يفتح CompletePhoneModal فقط، لا النوافذ الأخرى', async () => {
        getUserProfileMock.mockResolvedValue({ ok: true, profile: { phone: null, whatsapp_contact_prompted: false, preferred_tier: null } });
        await triggerSignedIn();

        expect(completePhoneOpenMock).toHaveBeenCalledTimes(1);
        expect(whatsappContactOpenMock).not.toHaveBeenCalled();
        expect(packagePreferenceOpenMock).not.toHaveBeenCalled();
    });

    it('جوال موجود لكن دعوة واتساب لم تُعرَض بعد: يفتح WhatsAppContactModal فقط', async () => {
        getUserProfileMock.mockResolvedValue({ ok: true, profile: { phone: '+966512345678', whatsapp_contact_prompted: false, preferred_tier: null } });
        await triggerSignedIn();

        expect(completePhoneOpenMock).not.toHaveBeenCalled();
        expect(whatsappContactOpenMock).toHaveBeenCalledTimes(1);
        expect(packagePreferenceOpenMock).not.toHaveBeenCalled();
    });

    it('دعوة واتساب عُرضت (whatsapp_contact_prompted=true) لكن بلا تفضيل باقة: يفتح PackagePreferenceModal فقط', async () => {
        getUserProfileMock.mockResolvedValue({ ok: true, profile: { phone: '+966512345678', whatsapp_contact_prompted: true, preferred_tier: null } });
        await triggerSignedIn();

        expect(completePhoneOpenMock).not.toHaveBeenCalled();
        expect(whatsappContactOpenMock).not.toHaveBeenCalled();
        expect(packagePreferenceOpenMock).toHaveBeenCalledTimes(1);
    });

    it('كل الحالات مكتملة: لا يفتح أي نافذة', async () => {
        getUserProfileMock.mockResolvedValue({ ok: true, profile: { phone: '+966512345678', whatsapp_contact_prompted: true, preferred_tier: 'self' } });
        await triggerSignedIn();

        expect(completePhoneOpenMock).not.toHaveBeenCalled();
        expect(whatsappContactOpenMock).not.toHaveBeenCalled();
        expect(packagePreferenceOpenMock).not.toHaveBeenCalled();
    });

    it('استدعاء onSaved من CompletePhoneModal يُعيد تشغيل السلسلة ويفتح الخطوة التالية', async () => {
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

    it('استدعاء onDismissed من WhatsAppContactModal يُعيد تشغيل السلسلة ويفتح الخطوة التالية (مو نفس النافذة ثانية)', async () => {
        getUserProfileMock
            .mockResolvedValueOnce({ ok: true, profile: { phone: '+966512345678', whatsapp_contact_prompted: false, preferred_tier: null } })
            .mockResolvedValueOnce({ ok: true, profile: { phone: '+966512345678', whatsapp_contact_prompted: true, preferred_tier: null } });
        await triggerSignedIn();

        expect(whatsappContactOpenMock).toHaveBeenCalledTimes(1);
        expect(packagePreferenceOpenMock).not.toHaveBeenCalled();

        await whatsappContactOptions.onDismissed();
        await new Promise((r) => setTimeout(r, 0));

        expect(packagePreferenceOpenMock).toHaveBeenCalledTimes(1);
        // لا يُعاد فتح WhatsAppContactModal مرة ثانية
        expect(whatsappContactOpenMock).toHaveBeenCalledTimes(1);
    });

    it('getUserProfile فاشلة (ok:false، مثلاً هجرات لم تُطبَّق بعد): لا يفتح أي نافذة، لا يمنع الدخول', async () => {
        getUserProfileMock.mockResolvedValue({ ok: false, error: 'profiles table missing' });
        await triggerSignedIn();

        expect(completePhoneOpenMock).not.toHaveBeenCalled();
        expect(whatsappContactOpenMock).not.toHaveBeenCalled();
        expect(packagePreferenceOpenMock).not.toHaveBeenCalled();
    });
});
