/**
 * @vitest-environment jsdom
 *
 * الخلل: بطاقة الطلب لا تعرض رقم الطلب إطلاقاً، وطلب بحالة pending لا يملك أي
 * زر إجراء (الزر الوحيد كان مشروطاً بـstatus === 'paid'). الإصلاح: عرض رقم
 * الطلب المختصر على كل بطاقة + رابط تواصل واتساب لطلبات pending.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const buildWhatsAppLinkMock = vi.fn(() => 'https://wa.me/9665XXXXXXXX?text=hi');

vi.mock('../../../supabaseClient.js', () => ({
    getAuthUser: vi.fn(async () => ({ user: { id: 'u1' } })),
}));

vi.mock('../../config.js', () => ({
    buildWhatsAppLink: (...a) => buildWhatsAppLinkMock(...a),
}));

vi.mock('../../services/PaymentService.js', () => ({
    listOrders: vi.fn(async () => [
        { id: '3fa85f64-5717-4562-b3fc-2c963f66afa6', tier: 'self', amount_sar: 299, currency: 'SAR', status: 'pending', created_at: '2026-08-01T00:00:00Z', paid_at: null },
    ]),
}));

describe('BillingHistoryView — رقم الطلب وزر إجراء طلب pending', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="root"></div>';
        buildWhatsAppLinkMock.mockClear();
    });

    it('يعرض رقم الطلب المختصر ورابط تواصل واتساب بدل بطاقة بلا أي زر', async () => {
        const { BillingHistoryView } = await import('../BillingHistoryView.js');
        const view = new BillingHistoryView(document.getElementById('root'), {});
        await view.render();

        expect(document.body.textContent).toContain('#3fa85f64');

        const link = document.querySelector('a[href="https://wa.me/9665XXXXXXXX?text=hi"]');
        expect(link).not.toBeNull();
        expect(buildWhatsAppLinkMock).toHaveBeenCalledTimes(1);
    });
});
