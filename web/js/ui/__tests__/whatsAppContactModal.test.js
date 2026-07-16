/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const updateUserProfileMock = vi.fn();
const buildWhatsAppLinkMock = vi.fn(() => 'https://wa.me/9665XXXXXXXX?text=hi');

vi.mock('../../../supabaseClient.js', () => ({
    updateUserProfile: (...a) => updateUserProfileMock(...a),
}));

vi.mock('../../config.js', () => ({
    buildWhatsAppLink: (...a) => buildWhatsAppLinkMock(...a),
}));

async function waitUntil(predicate, { timeout = 2000, interval = 10 } = {}) {
    const start = Date.now();
    while (!predicate()) {
        if (Date.now() - start > timeout) throw new Error('waitUntil: timed out');
        await new Promise((r) => setTimeout(r, interval));
    }
}

describe('WhatsAppContactModal', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        updateUserProfileMock.mockReset().mockResolvedValue({ ok: true, profile: {} });
        buildWhatsAppLinkMock.mockReset().mockReturnValue('https://wa.me/9665XXXXXXXX?text=hi');
    });

    it('فيها زر إغلاق (X) وزر تخطّي — بخلاف الخطوات الإلزامية الأخرى، هذه قابلة للتخطي عمداً', async () => {
        const { WhatsAppContactModal } = await import('../WhatsAppContactModal.js');
        const modal = new WhatsAppContactModal();
        modal.open();
        expect(modal.overlay.querySelector('.btn-close')).not.toBeNull();
        expect(modal.overlay.querySelector('#whatsappContactSkip')).not.toBeNull();
    });

    it('يعرض رابط فتح واتساب من buildWhatsAppLink', async () => {
        const { WhatsAppContactModal } = await import('../WhatsAppContactModal.js');
        const modal = new WhatsAppContactModal();
        modal.open();
        const link = modal.overlay.querySelector('#whatsappContactOpenLink');
        expect(link).not.toBeNull();
        expect(link.href).toBe('https://wa.me/9665XXXXXXXX?text=hi');
    });

    it('واتساب غير مضبوط (buildWhatsAppLink يُرجع null): يعرض رسالة بدل رابط مكسور', async () => {
        buildWhatsAppLinkMock.mockReturnValue(null);
        const { WhatsAppContactModal } = await import('../WhatsAppContactModal.js');
        const modal = new WhatsAppContactModal();
        modal.open();
        expect(modal.overlay.querySelector('#whatsappContactOpenLink')).toBeNull();
        expect(modal.overlay.textContent).toContain('غير متاحة');
    });

    it('ضغط "تخطّي الآن": يضبط whatsapp_contact_prompted=true، يستدعي onDismissed، ويغلق النافذة', async () => {
        const onDismissed = vi.fn();
        const { WhatsAppContactModal } = await import('../WhatsAppContactModal.js');
        const modal = new WhatsAppContactModal({ onDismissed });
        modal.open();
        modal.overlay.querySelector('#whatsappContactSkip').click();
        await waitUntil(() => modal.overlay === null);

        expect(updateUserProfileMock).toHaveBeenCalledWith({ whatsapp_contact_prompted: true });
        expect(onDismissed).toHaveBeenCalledTimes(1);
        expect(modal.overlay).toBeNull();
    });

    it('ضغط زر إغلاق (X): نفس أثر التخطي — يضبط whatsapp_contact_prompted=true ويغلق', async () => {
        const { WhatsAppContactModal } = await import('../WhatsAppContactModal.js');
        const modal = new WhatsAppContactModal();
        modal.open();
        modal.overlay.querySelector('.btn-close').click();
        await waitUntil(() => modal.overlay === null);

        expect(updateUserProfileMock).toHaveBeenCalledWith({ whatsapp_contact_prompted: true });
    });

    it('ضغط "فتح واتساب": يضبط whatsapp_contact_prompted=true أيضاً (يُعتبر عرضاً مكتملاً بصرف النظر هل أُرسلت الرسالة)', async () => {
        const { WhatsAppContactModal } = await import('../WhatsAppContactModal.js');
        const modal = new WhatsAppContactModal();
        modal.open();
        modal.overlay.querySelector('#whatsappContactOpenLink').click();
        await waitUntil(() => modal.overlay === null);

        expect(updateUserProfileMock).toHaveBeenCalledWith({ whatsapp_contact_prompted: true });
    });

    it('فشل حفظ whatsapp_contact_prompted: لا يمنع الإغلاق (فشل بصمت، لا يعلق المستخدم)', async () => {
        updateUserProfileMock.mockRejectedValue(new Error('network error'));
        const { WhatsAppContactModal } = await import('../WhatsAppContactModal.js');
        const modal = new WhatsAppContactModal();
        modal.open();
        modal.overlay.querySelector('#whatsappContactSkip').click();
        await waitUntil(() => modal.overlay === null);
        expect(modal.overlay).toBeNull();
    });
});
