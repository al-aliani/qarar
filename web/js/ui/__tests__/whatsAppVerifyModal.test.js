/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const sendWhatsAppOtpMock = vi.fn();
const verifyWhatsAppOtpMock = vi.fn();

vi.mock('../../services/WhatsAppOtpService.js', () => ({
    sendWhatsAppOtp: (...a) => sendWhatsAppOtpMock(...a),
    verifyWhatsAppOtp: (...a) => verifyWhatsAppOtpMock(...a),
}));

async function waitUntil(predicate, { timeout = 2000, interval = 10 } = {}) {
    const start = Date.now();
    while (!predicate()) {
        if (Date.now() - start > timeout) throw new Error('waitUntil: timed out');
        await new Promise((r) => setTimeout(r, interval));
    }
}

describe('WhatsAppVerifyModal', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        sendWhatsAppOtpMock.mockReset().mockResolvedValue({
            ok: true,
            expiresAt: '2026-07-17T00:05:00.000Z',
            resendAvailableAt: new Date(Date.now() + 60000).toISOString(),
        });
        verifyWhatsAppOtpMock.mockReset().mockResolvedValue({ ok: true });
    });

    it('لا يوجد زر إغلاق (X) — التحقق إلزامي', async () => {
        const { WhatsAppVerifyModal } = await import('../WhatsAppVerifyModal.js');
        const modal = new WhatsAppVerifyModal();
        await modal.open();
        expect(modal.overlay.querySelector('.btn-close')).toBeNull();
        modal.close();
    });

    it('يرسل الرمز تلقائياً عند الفتح', async () => {
        const { WhatsAppVerifyModal } = await import('../WhatsAppVerifyModal.js');
        const modal = new WhatsAppVerifyModal();
        await modal.open();
        expect(sendWhatsAppOtpMock).toHaveBeenCalledTimes(1);
        modal.close();
    });

    it('فشل الإرسال: يعرض خطأ وزر إعادة محاولة، لا حقل إدخال رمز', async () => {
        sendWhatsAppOtpMock.mockResolvedValue({ ok: false, error: 'send_failed' });
        const { WhatsAppVerifyModal } = await import('../WhatsAppVerifyModal.js');
        const modal = new WhatsAppVerifyModal();
        await modal.open();
        expect(modal.overlay.querySelector('#whatsappVerifyCodeInput')).toBeNull();
        expect(modal.overlay.querySelector('#whatsappVerifyRetry')).not.toBeNull();
        modal.close();
    });

    it('رمز خاطئ الصيغة (ليس 6 أرقام): يعرض خطأ ولا يستدعي verifyWhatsAppOtp', async () => {
        const { WhatsAppVerifyModal } = await import('../WhatsAppVerifyModal.js');
        const modal = new WhatsAppVerifyModal();
        await modal.open();
        modal.overlay.querySelector('#whatsappVerifyCodeInput').value = '123';
        modal.overlay.querySelector('#whatsappVerifyForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await waitUntil(() => modal.overlay.querySelector('#whatsappVerifyError')?.textContent);
        expect(verifyWhatsAppOtpMock).not.toHaveBeenCalled();
        modal.close();
    });

    it('رمز صحيح: يستدعي onVerified ويغلق النافذة', async () => {
        const onVerified = vi.fn();
        const { WhatsAppVerifyModal } = await import('../WhatsAppVerifyModal.js');
        const modal = new WhatsAppVerifyModal({ onVerified });
        await modal.open();
        modal.overlay.querySelector('#whatsappVerifyCodeInput').value = '123456';
        modal.overlay.querySelector('#whatsappVerifyForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await waitUntil(() => modal.overlay === null);
        expect(verifyWhatsAppOtpMock).toHaveBeenCalledWith('123456');
        expect(onVerified).toHaveBeenCalled();
        expect(modal.overlay).toBeNull();
    });

    it('رمز خاطئ (رفضه الخادم): يعرض رسالة الخطأ ولا يغلق النافذة', async () => {
        verifyWhatsAppOtpMock.mockResolvedValue({ ok: false, error: 'code_mismatch' });
        const { WhatsAppVerifyModal } = await import('../WhatsAppVerifyModal.js');
        const modal = new WhatsAppVerifyModal();
        await modal.open();
        modal.overlay.querySelector('#whatsappVerifyCodeInput').value = '000000';
        modal.overlay.querySelector('#whatsappVerifyForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await waitUntil(() => modal.overlay.querySelector('#whatsappVerifyError')?.textContent);
        expect(modal.overlay.querySelector('#whatsappVerifyError').textContent).toContain('الرمز غير صحيح');
        expect(modal.overlay).not.toBeNull();
        modal.close();
    });

    it('زر إعادة الإرسال معطَّل أثناء فترة التهدئة', async () => {
        const { WhatsAppVerifyModal } = await import('../WhatsAppVerifyModal.js');
        const modal = new WhatsAppVerifyModal();
        await modal.open();
        const resendBtn = modal.overlay.querySelector('#whatsappVerifyResend');
        expect(resendBtn.disabled).toBe(true);
        modal.close();
    });
});
