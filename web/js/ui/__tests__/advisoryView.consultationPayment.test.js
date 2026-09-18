/**
 * @vitest-environment jsdom
 *
 * دفع فعلي لطلبات الاستشارة عبر تحويل بنكي (2026-09-16) — مرحلة ثانية من قرار مالك
 * المنتج "تصحيح ومن ثم دفع فعلي" (المرحلة الأولى: تصحيح النص المضلِّل في AdvisoryView،
 * انظر advisoryView.paymentTextAccuracy.test.js). قبل هذا التغيير: لا وجود لأي وسيلة
 * دفع فعلية لطلبات الاستشارة إطلاقاً — الآن تظهر زر "ادفع الآن" لأي طلب غير مدفوع،
 * يفتح نفس لوحة التحويل البنكي المستخدمة للاشتراكات (BankTransferPanel.js، مُعمَّمة
 * بـproductLabel)، وطلب مدفوع فعلاً (payment_status='paid') يعرض شارة "مدفوع" بدل الزر.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const listMock = vi.fn();
vi.mock('../../services/ConsultationService.js', () => ({
    submitConsultationRequest: vi.fn(),
    listMyConsultations: (...args) => listMock(...args)
}));

const renderBankTransferPanelMock = vi.fn(() => true);
vi.mock('../components/BankTransferPanel.js', () => ({
    renderBankTransferPanel: (...args) => renderBankTransferPanelMock(...args)
}));

vi.mock('../../utils/toast.js', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { AdvisoryView } = await import('../AdvisoryView.js');
const { toast } = await import('../../utils/toast.js');

function fakeStore(state = {}) {
    return { getState: () => state };
}

function makeRequest(overrides = {}) {
    return {
        id: 'req-uuid-1',
        consultant_level: 'advisor',
        specialty: 'مالي',
        sector: 'تجارة',
        amount_sar: 990,
        status: 'submitted',
        payment_status: 'unpaid',
        created_at: new Date().toISOString(),
        ...overrides
    };
}

describe('AdvisoryView — دفع فعلي لطلبات الاستشارة عبر تحويل بنكي', () => {
    beforeEach(() => {
        // jsdom لا يُطبّق scrollIntoView إطلاقاً (فجوة بيئة اختبار معروفة، لا علاقة لها
        // بكود AdvisoryView.js نفسه — نفس استدعاء ?.scrollIntoView(...) غير المحروس
        // موجود أصلاً في DashboardView.js/StudyCategoryView.js بهذا المشروع).
        Element.prototype.scrollIntoView = vi.fn();
        renderBankTransferPanelMock.mockClear();
        toast.error.mockClear();
        document.body.innerHTML = '<div id="advisoryContainer"></div>';
    });

    it('طلب غير مدفوع: يظهر زر "ادفع الآن"، ولا شارة "مدفوع"', async () => {
        listMock.mockResolvedValue([makeRequest()]);
        const view = new AdvisoryView('advisoryContainer', fakeStore());
        await view.render();

        expect(document.querySelector('.consult-pay-btn')).not.toBeNull();
        expect(document.body.textContent).not.toContain('مدفوع');
    });

    it('طلب مدفوع فعلاً: يظهر شارة "مدفوع"، ولا زر دفع', async () => {
        listMock.mockResolvedValue([makeRequest({ payment_status: 'paid' })]);
        const view = new AdvisoryView('advisoryContainer', fakeStore());
        await view.render();

        expect(document.querySelector('.consult-pay-btn')).toBeNull();
        expect(document.body.textContent).toContain('مدفوع');
    });

    it('النقر على "ادفع الآن" يستدعي renderBankTransferPanel بالمعرّف والمبلغ ونص منتج يذكر المستوى', async () => {
        listMock.mockResolvedValue([makeRequest()]);
        const view = new AdvisoryView('advisoryContainer', fakeStore());
        await view.render();

        document.querySelector('.consult-pay-btn').click();

        expect(renderBankTransferPanelMock).toHaveBeenCalledTimes(1);
        const [, params] = renderBankTransferPanelMock.mock.calls[0];
        expect(params.orderId).toBe('req-uuid-1');
        expect(params.amount).toBe(990);
        expect(params.productLabel).toContain('استشاري');
        expect(typeof params.onBack).toBe('function');
    });

    it('التحويل البنكي غير مُفعَّل (renderBankTransferPanel تُعيد false): رسالة خطأ واضحة بدل لوحة فارغة', async () => {
        renderBankTransferPanelMock.mockReturnValueOnce(false);
        listMock.mockResolvedValue([makeRequest()]);
        const view = new AdvisoryView('advisoryContainer', fakeStore());
        await view.render();

        document.querySelector('.consult-pay-btn').click();

        expect(toast.error).toHaveBeenCalledTimes(1);
        expect(document.querySelector('#consultPaymentPanel').style.display).toBe('none');
    });
});
