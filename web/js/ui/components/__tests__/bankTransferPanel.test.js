/**
 * @vitest-environment jsdom
 *
 * BankTransferPanel — مصدر وحيد مشترك (استُخرج من PaywallModal.js عند إضافة نفس
 * التدفق لـSubscriptionCheckoutView.js، قرار مالك 2026-07-22: تحويل بنكي فقط).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const getBankTransferConfigMock = vi.fn();
const buildWhatsAppLinkMock = vi.fn((text) => `https://wa.me/966500000000?text=${encodeURIComponent(text)}`);
vi.mock('../../../config.js', () => ({
    getBankTransferConfig: (...a) => getBankTransferConfigMock(...a),
    buildWhatsAppLink: (...a) => buildWhatsAppLinkMock(...a),
}));

vi.mock('../../../utils/analytics.js', () => ({ trackEvent: vi.fn() }));

describe('renderBankTransferPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '<div id="c"></div>';
    });

    it('إعداد غير صالح (null) ⇒ يرجع false ولا يغيّر المحتوى', async () => {
        getBankTransferConfigMock.mockReturnValue(null);
        const { renderBankTransferPanel } = await import('../BankTransferPanel.js');
        const container = document.getElementById('c');
        container.innerHTML = '<p>original</p>';
        const ok = renderBankTransferPanel(container, { tier: 'self', orderId: 'order-abcdefgh', amount: 299, onBack: vi.fn() });
        expect(ok).toBe(false);
        expect(container.innerHTML).toBe('<p>original</p>');
    });

    it('يعرض الآيبان/اسم المستفيد/البنك ورقم الطلب المرجعي فعلياً (8 أحرف)', async () => {
        getBankTransferConfigMock.mockReturnValue({ beneficiaryName: 'شركة شفق الأعمال التجارية', bankName: 'بنك البلاد', iban: 'SA5815000900142467710006', accountNumber: '' });
        const { renderBankTransferPanel } = await import('../BankTransferPanel.js');
        const container = document.getElementById('c');
        const ok = renderBankTransferPanel(container, { tier: 'self', orderId: 'order-abcdefgh-extra', amount: 299, onBack: vi.fn() });

        expect(ok).toBe(true);
        expect(container.textContent).toContain('SA5815000900142467710006');
        expect(container.textContent).toContain('شركة شفق الأعمال التجارية');
        expect(container.textContent).toContain('بنك البلاد');
        expect(container.textContent).toContain('order-ab'); // أول 8 أحرف فقط كرقم مرجعي
    });

    it('زر "رجوع" يستدعي onBack', async () => {
        getBankTransferConfigMock.mockReturnValue({ beneficiaryName: 'اسم', bankName: 'بنك', iban: 'SA5815000900142467710006' });
        const onBack = vi.fn();
        const { renderBankTransferPanel } = await import('../BankTransferPanel.js');
        const container = document.getElementById('c');
        renderBankTransferPanel(container, { tier: 'self', orderId: 'order-1', amount: 299, onBack });

        container.querySelector('#bankBack').click();
        expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('رابط واتساب يحمل رقم الطلب المرجعي إن كان الرقم مضبوطاً', async () => {
        getBankTransferConfigMock.mockReturnValue({ beneficiaryName: 'اسم', bankName: 'بنك', iban: 'SA5815000900142467710006' });
        const { renderBankTransferPanel } = await import('../BankTransferPanel.js');
        const container = document.getElementById('c');
        renderBankTransferPanel(container, { tier: 'self', orderId: 'order-xyz12345', amount: 299, onBack: vi.fn() });

        const link = container.querySelector('a[href^="https://wa.me/"]');
        expect(link).not.toBeNull();
        const decoded = decodeURIComponent(link.getAttribute('href').split('text=')[1]);
        expect(decoded).toContain('order-xy');
    });

    it('لا رابط واتساب (رقم غير مضبوط) ⇒ رسالة بديلة بدل رابط مكسور', async () => {
        getBankTransferConfigMock.mockReturnValue({ beneficiaryName: 'اسم', bankName: 'بنك', iban: 'SA5815000900142467710006' });
        buildWhatsAppLinkMock.mockReturnValue(null);
        const { renderBankTransferPanel } = await import('../BankTransferPanel.js');
        const container = document.getElementById('c');
        renderBankTransferPanel(container, { tier: 'self', orderId: 'order-1', amount: 299, onBack: vi.fn() });

        expect(container.querySelector('a[href^="https://wa.me/"]')).toBeNull();
        expect(container.textContent).toContain('غير مضبوط');
    });
});
