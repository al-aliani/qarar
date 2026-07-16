import { describe, it, expect, vi, beforeEach } from 'vitest';

const getAuthUserMock = vi.fn(async () => ({ user: null }));
const invokeMock = vi.fn(async () => ({ data: null, error: null }));

vi.mock('../../../supabaseClient.js', () => ({
    getSupabaseClient: vi.fn(async () => ({
        ok: true,
        supabase: { functions: { invoke: invokeMock } },
    })),
    getAuthUser: (...a) => getAuthUserMock(...a),
}));

describe('sendWhatsAppOtp', () => {
    beforeEach(() => {
        getAuthUserMock.mockReset().mockResolvedValue({ user: { id: 'u1' } });
        invokeMock.mockReset().mockResolvedValue({
            data: { ok: true, expiresAt: '2026-07-17T00:05:00.000Z', resendAvailableAt: '2026-07-17T00:01:00.000Z' },
            error: null,
        });
    });

    it('بلا مستخدم مسجَّل ⇒ خطأ واضح، لا يستدعي invoke', async () => {
        getAuthUserMock.mockResolvedValue({ user: null });
        const { sendWhatsAppOtp } = await import('../WhatsAppOtpService.js');
        const result = await sendWhatsAppOtp();
        expect(result.ok).toBe(false);
        expect(invokeMock).not.toHaveBeenCalled();
    });

    it('نجاح: يستدعي whatsapp-otp-send ويُعيد أوقات الانتهاء/إعادة الإرسال', async () => {
        const { sendWhatsAppOtp } = await import('../WhatsAppOtpService.js');
        const result = await sendWhatsAppOtp();
        expect(invokeMock).toHaveBeenCalledWith('whatsapp-otp-send', { body: {} });
        expect(result.ok).toBe(true);
        expect(result.expiresAt).toBe('2026-07-17T00:05:00.000Z');
    });

    it('فشل الخادم (error من invoke) ⇒ ok:false برسالة الخطأ', async () => {
        invokeMock.mockResolvedValue({ data: null, error: { message: 'network_down' } });
        const { sendWhatsAppOtp } = await import('../WhatsAppOtpService.js');
        const result = await sendWhatsAppOtp();
        expect(result.ok).toBe(false);
        expect(result.error).toBe('network_down');
    });

    it('استجابة data.ok=false (مثال: cooldown_active) ⇒ يمرَّر رمز الخطأ كما هو', async () => {
        invokeMock.mockResolvedValue({ data: { ok: false, error: 'cooldown_active' }, error: null });
        const { sendWhatsAppOtp } = await import('../WhatsAppOtpService.js');
        const result = await sendWhatsAppOtp();
        expect(result.ok).toBe(false);
        expect(result.error).toBe('cooldown_active');
    });
});

describe('verifyWhatsAppOtp', () => {
    beforeEach(() => {
        getAuthUserMock.mockReset().mockResolvedValue({ user: { id: 'u1' } });
        invokeMock.mockReset().mockResolvedValue({ data: { ok: true }, error: null });
    });

    it('بلا مستخدم مسجَّل ⇒ خطأ واضح، لا يستدعي invoke', async () => {
        getAuthUserMock.mockResolvedValue({ user: null });
        const { verifyWhatsAppOtp } = await import('../WhatsAppOtpService.js');
        const result = await verifyWhatsAppOtp('123456');
        expect(result.ok).toBe(false);
        expect(invokeMock).not.toHaveBeenCalled();
    });

    it('نجاح: يمرّر الرمز لـwhatsapp-otp-verify', async () => {
        const { verifyWhatsAppOtp } = await import('../WhatsAppOtpService.js');
        const result = await verifyWhatsAppOtp('123456');
        expect(invokeMock).toHaveBeenCalledWith('whatsapp-otp-verify', { body: { code: '123456' } });
        expect(result.ok).toBe(true);
    });

    it('رمز خاطئ (code_mismatch) ⇒ ok:false برمز الخطأ', async () => {
        invokeMock.mockResolvedValue({ data: { ok: false, error: 'code_mismatch' }, error: null });
        const { verifyWhatsAppOtp } = await import('../WhatsAppOtpService.js');
        const result = await verifyWhatsAppOtp('000000');
        expect(result.ok).toBe(false);
        expect(result.error).toBe('code_mismatch');
    });
});
