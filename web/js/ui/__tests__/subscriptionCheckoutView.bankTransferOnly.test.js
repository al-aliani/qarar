/**
 * @vitest-environment jsdom
 *
 * قرار مالك 2026-07-22: الدفع بالمنصة يكون تحويلاً بنكياً فقط، بلا بوابات
 * إلكترونية (Moyasar/Tamara/Stripe). صفحة الدفع الرئيسية (من صفحة التسعير) كانت
 * تعرض 3 أزرار إلكترونية فقط بلا أي خيار تحويل بنكي، ومعالج الاستجابة فيها كان
 * سيحاول فتح checkoutUrl غير موجود لو أُضيف زر التحويل بسذاجة (استجابة
 * bank_transfer لا تحمل checkoutUrl). هذا يثبّت الإصلاح: زر تحويل بنكي وحيد،
 * يعرض لوحة الحساب البنكي عبر BankTransferPanel المشتركة (نفس منطق PaywallModal
 * المُثبَت) بدل محاولة redirect مكسورة.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const startCheckoutMock = vi.fn();
vi.mock('../../services/PaymentService.js', () => ({
    startCheckout: (...a) => startCheckoutMock(...a),
}));

vi.mock('../../core/store.js', () => ({
    store: { getState: () => ({ projectInfo: { id: 'study-1', name: 'دراسة مقهى' } }) },
}));

const loadProjectMock = vi.fn(async () => ({ data: { projectInfo: { id: 'study-1', name: 'دراسة مقهى' } } }));
vi.mock('../../services/ProjectManager.js', () => ({
    ProjectManager: { loadProject: (...a) => loadProjectMock(...a) },
}));

const getBankTransferConfigMock = vi.fn(() => ({ beneficiaryName: 'شركة شفق الأعمال التجارية', bankName: 'بنك البلاد', iban: 'SA5815000900142467710006' }));
vi.mock('../../config.js', () => ({
    getBankTransferConfig: (...a) => getBankTransferConfigMock(...a),
}));

vi.mock('../../utils/analytics.js', () => ({ trackEvent: vi.fn() }));

const renderBankTransferPanelMock = vi.fn();
vi.mock('../components/BankTransferPanel.js', () => ({
    renderBankTransferPanel: (...a) => renderBankTransferPanelMock(...a),
}));

async function mountView() {
    document.body.innerHTML = '<div id="root"></div>';
    const container = document.getElementById('root');
    const { SubscriptionCheckoutView } = await import('../SubscriptionCheckoutView.js');
    const view = new SubscriptionCheckoutView(container);
    await view.render();
    return { view, container };
}

describe('SubscriptionCheckoutView — تحويل بنكي فقط (قرار مالك 2026-07-22)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sessionStorage.setItem('selected_package', 'self');
        getBankTransferConfigMock.mockReturnValue({ beneficiaryName: 'شركة شفق الأعمال التجارية', bankName: 'بنك البلاد', iban: 'SA5815000900142467710006' });
    });

    it('لا تعرض أي زر مزوّد إلكتروني (moyasar/tamara/stripe) إطلاقاً', async () => {
        const { container } = await mountView();
        expect(container.querySelector('[data-provider="moyasar"]')).toBeNull();
        expect(container.querySelector('[data-provider="tamara"]')).toBeNull();
        expect(container.querySelector('[data-provider="stripe"]')).toBeNull();
    });

    it('تعرض زر تحويل بنكي وحيداً حين الإعداد صالح', async () => {
        const { container } = await mountView();
        const btn = container.querySelector('#checkoutPayBank');
        expect(btn).not.toBeNull();
        expect(btn.textContent).toContain('تحويل بنكي');
    });

    it('إعداد بنكي غير صالح (null) ⇒ رسالة "غير متاح" بدل زر مكسور', async () => {
        getBankTransferConfigMock.mockReturnValue(null);
        const { container } = await mountView();
        expect(container.querySelector('#checkoutPayBank')).toBeNull();
        expect(container.textContent).toContain('غير متاح');
    });

    it('الضغط على زر التحويل ينشئ طلباً بـprovider=bank_transfer ويعرض لوحة الحساب البنكي (لا redirect مكسور لـcheckoutUrl)', async () => {
        startCheckoutMock.mockResolvedValue({ ok: true, bankTransfer: true, orderId: 'order-123', amount: 299 });
        const { container } = await mountView();

        container.querySelector('#checkoutPayBank').click();
        await new Promise((r) => setTimeout(r, 0));
        await new Promise((r) => setTimeout(r, 0));

        expect(startCheckoutMock).toHaveBeenCalledWith(expect.objectContaining({ provider: 'bank_transfer', studyId: 'study-1' }));
        expect(renderBankTransferPanelMock).toHaveBeenCalledTimes(1);
        const [panelContainer, params] = renderBankTransferPanelMock.mock.calls[0];
        expect(panelContainer.id).toBe('checkoutCard');
        expect(params.orderId).toBe('order-123');
        expect(params.amount).toBe(299);
        expect(typeof params.onBack).toBe('function');
    });

    it('فشل إنشاء طلب التحويل ⇒ رسالة خطأ واضحة، لا لوحة حساب بنكي', async () => {
        startCheckoutMock.mockResolvedValue({ ok: false, error: 'network down' });
        const { container } = await mountView();

        container.querySelector('#checkoutPayBank').click();
        await new Promise((r) => setTimeout(r, 0));
        await new Promise((r) => setTimeout(r, 0));

        expect(renderBankTransferPanelMock).not.toHaveBeenCalled();
        const errEl = container.querySelector('#checkoutError');
        expect(errEl.style.display).not.toBe('none');
        expect(errEl.textContent).toContain('network down');
    });
});

describe('SubscriptionCheckoutView — placeholder كوبون الخصم لا يُسرّب كوداً حقيقياً', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sessionStorage.setItem('selected_package', 'self');
        getBankTransferConfigMock.mockReturnValue({ beneficiaryName: 'شركة شفق الأعمال التجارية', bankName: 'بنك البلاد', iban: 'SA5815000900142467710006' });
    });

    it('placeholder حقل الكوبون نص إرشادي محايد، لا كود خصم حقيقي (WELCOME10) مذكور حرفياً', async () => {
        const { container } = await mountView();
        const input = container.querySelector('#checkoutCoupon');
        expect(input).not.toBeNull();
        expect(input.getAttribute('placeholder')).not.toMatch(/WELCOME10/i);
    });
});
