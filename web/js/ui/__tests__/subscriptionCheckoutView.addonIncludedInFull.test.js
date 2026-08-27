/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-08-27 (فحص شامل للموقع الحي): «جلسة شرح النتائج» (399 ﷼) كانت تُعرض
 * قابلة للاختيار حتى لمشتري باقة «خدمة كاملة» (4,999) التي تتضمنها أصلاً — لا
 * فلترة حسب pkg.id في ${ADDONS.map(...)}. عميل يشتري full ثم يضغط الإضافة سهواً
 * (أو يظنها إلزامية) كان يدفع 399 ﷼ زائدة لشيء يملكه بالفعل.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/PaymentService.js', () => ({ startCheckout: vi.fn() }));
vi.mock('../../core/store.js', () => ({
    store: { getState: () => ({ projectInfo: { id: 'study-1', name: 'دراسة مقهى' } }) },
}));
vi.mock('../../services/ProjectManager.js', () => ({
    ProjectManager: { loadProject: vi.fn(async () => ({ data: { projectInfo: { id: 'study-1', name: 'دراسة مقهى' } } })) },
}));
vi.mock('../../config.js', () => ({
    getBankTransferConfig: vi.fn(() => ({ beneficiaryName: 'شركة شفق الأعمال التجارية', bankName: 'بنك البلاد', iban: 'SA5815000900142467710006' })),
}));
vi.mock('../../utils/analytics.js', () => ({ trackEvent: vi.fn() }));
vi.mock('../components/BankTransferPanel.js', () => ({ renderBankTransferPanel: vi.fn() }));

async function mountView(selectedPackage) {
    document.body.innerHTML = '<div id="root"></div>';
    const container = document.getElementById('root');
    sessionStorage.setItem('selected_package', selectedPackage);
    const { SubscriptionCheckoutView } = await import('../SubscriptionCheckoutView.js');
    const view = new SubscriptionCheckoutView(container);
    await view.render();
    return { view, container };
}

describe('SubscriptionCheckoutView — «جلسة شرح النتائج» مشمولة في باقة full، لا تُباع إضافة', () => {
    beforeEach(() => vi.clearAllMocks());

    it('باقة full: مربّع result_session معطَّل ومحدَّد تلقائياً، مع ملاحظة "مشمولة في باقتك"', async () => {
        const { container } = await mountView('full');
        const checkbox = container.querySelector('[data-addon="result_session"]');
        expect(checkbox.disabled).toBe(true);
        expect(checkbox.checked).toBe(true);
        const row = container.querySelector('[data-addon-row="result_session"]');
        expect(row.textContent).toContain('مشمولة في باقتك');
    });

    it('باقة full: الإجمالي المعروض لا يضيف 399 ﷼ لجلسة الشرح', async () => {
        const { container } = await mountView('full');
        // full = 4,999 شامل الضريبة، بلا أي إضافة أخرى محدَّدة.
        expect(container.querySelector('#checkoutTotal').textContent).toContain('4,999');
    });

    it('باقة full: selectedAddons() المُرسَلة فعلياً للخادم لا تحتوي result_session', async () => {
        const { view } = await mountView('full');
        expect(view.selectedAddons()).not.toContain('result_session');
    });

    it('باقة reviewed: result_session تبقى إضافة اختيارية عادية (قابلة للتحديد، غير مشمولة)', async () => {
        const { container } = await mountView('reviewed');
        const checkbox = container.querySelector('[data-addon="result_session"]');
        expect(checkbox.disabled).toBe(false);
        expect(checkbox.checked).toBe(false);
        const row = container.querySelector('[data-addon-row="result_session"]');
        expect(row.querySelector('[data-addon-note]').style.display).toBe('none');
    });

    it('التبديل من reviewed (باختيار يدوي لـresult_session) إلى full: يبقى محدَّداً لكن يصبح مجانياً ومعطَّلاً', async () => {
        const { container, view } = await mountView('reviewed');
        container.querySelector('[data-addon="result_session"]').click();
        expect(view.selectedAddons()).toContain('result_session');

        container.querySelector('[data-tier="full"]').click();
        const checkbox = container.querySelector('[data-addon="result_session"]');
        expect(checkbox.checked).toBe(true);
        expect(checkbox.disabled).toBe(true);
        expect(view.selectedAddons()).not.toContain('result_session');
    });

    it('التبديل رجوعاً من full إلى reviewed: تُلغى إجبارية التحديد ويعود اختيارياً غير محدَّد', async () => {
        const { container } = await mountView('full');
        container.querySelector('[data-tier="reviewed"]').click();
        const checkbox = container.querySelector('[data-addon="result_session"]');
        expect(checkbox.disabled).toBe(false);
        expect(checkbox.checked).toBe(false);
    });

    it('التبديل بين باقتين لا تتضمنان الإضافة يحافظ على اختيار المستخدم اليدوي (لا يُصفَّر)', async () => {
        const { container, view } = await mountView('self');
        container.querySelector('[data-addon="result_session"]').click();
        expect(view.selectedAddons()).toContain('result_session');

        container.querySelector('[data-tier="reviewed"]').click();
        expect(view.selectedAddons()).toContain('result_session');
    });
});
