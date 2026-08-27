/**
 * @vitest-environment jsdom
 *
 * دفعة 6 (2026-08-27، اتساق المراقبة): SubscriptionCheckoutView.js يُبلِّغ فشل
 * إنشاء طلب التحويل البنكي إلى monitoring.captureMessage (بلوكر #43)، لكن
 * PaywallModal.js — بوابة الدفع الأخرى، تُفتح من ExportMenu.js/ShareStudyView.js،
 * تمر بنفس startCheckout() بالضبط — لم تكن تستدعي المراقبة إطلاقاً عند نفس
 * الفشل: يظهر الخطأ للعميل فقط، بلا أي أثر يراه الأدمن عبر Sentry.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const startCheckoutMock = vi.fn();
vi.mock('../../services/PaymentService.js', () => ({
    startCheckout: (...a) => startCheckoutMock(...a),
}));

const captureMessageMock = vi.fn();
vi.mock('../../utils/monitoring.js', () => ({
    monitoring: { captureMessage: captureMessageMock },
}));

vi.mock('../../config.js', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, getBankTransferConfig: () => ({ beneficiaryName: 'شركة شفق الأعمال التجارية', bankName: 'بنك البلاد', iban: 'SA5815000900142467710006' }) };
});

vi.mock('../components/BankTransferPanel.js', () => ({ renderBankTransferPanel: vi.fn() }));

function fakeStore(state = {}) {
    return { getState: () => state };
}

describe('PaywallModal._handleBankTransfer — فشل إنشاء الطلب يُبلَّغ للمراقبة', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        startCheckoutMock.mockReset();
        captureMessageMock.mockClear();
        delete window.location;
        window.location = { href: '' };
    });

    it('startCheckout يفشل ⇒ يستدعي monitoring.captureMessage بسياق الباقة ورسالة الخطأ', async () => {
        startCheckoutMock.mockResolvedValue({ ok: false, error: 'insufficient_order_data' });
        const { PaywallModal } = await import('../PaywallModal.js');
        const modal = new PaywallModal('paywallOverlay', fakeStore({ projectInfo: { id: 'study-1' } }));
        modal.open('تقرير PDF شامل');

        const btn = modal.overlay.querySelector('.btn-pay-now');
        expect(btn).toBeTruthy();
        await modal._handleBankTransfer(btn, btn.dataset.package, () => {});

        expect(captureMessageMock).toHaveBeenCalledTimes(1);
        const [message, level, context] = captureMessageMock.mock.calls[0];
        expect(message).toContain('bank_transfer checkout failed');
        expect(level).toBe('warning');
        expect(context).toMatchObject({ provider: 'bank_transfer', studyId: 'study-1', message: 'insufficient_order_data' });
    });

    it('startCheckout ينجح (bankTransfer:true) ⇒ لا يستدعي captureMessage إطلاقاً', async () => {
        startCheckoutMock.mockResolvedValue({ ok: true, bankTransfer: true, orderId: 'order-1', amount: 299 });
        const { PaywallModal } = await import('../PaywallModal.js');
        const modal = new PaywallModal('paywallOverlay', fakeStore({ projectInfo: { id: 'study-1' } }));
        modal.open('تقرير PDF شامل');

        const btn = modal.overlay.querySelector('.btn-pay-now');
        await modal._handleBankTransfer(btn, btn.dataset.package, () => {});

        expect(captureMessageMock).not.toHaveBeenCalled();
    });

    it('[إثبات الحارس] العطل الأصلي: فشل الدفع كان يُعرَض للعميل فقط بلا أي استدعاء مراقبة', async () => {
        const oldHandleBankTransfer = async (result, trackEventFn) => {
            if (!(result.ok && result.bankTransfer)) {
                trackEventFn('payment_error', { message: result.error });
                return 'shown_to_user_only';
            }
        };
        const outcome = await oldHandleBankTransfer({ ok: false, error: 'x' }, () => {});
        expect(outcome).toBe('shown_to_user_only');
        expect(captureMessageMock).not.toHaveBeenCalled(); // لا أثر مراقبة إطلاقاً في السلوك الأصلي
    });
});
