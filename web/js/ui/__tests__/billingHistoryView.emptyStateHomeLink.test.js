/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-17: رابط "عرض الباقات" في حالة "لا توجد عمليات دفع بعد" كان href="#/home"
 * بلا أي مستمع حدث — لو كان المستخدم أصلاً على #/home، المتصفح لا يُطلق hashchange لهاش لم
 * يتغيّر، فلا يحدث شيء عند النقر. الإصلاح: مستمع click يستدعي onBack() مباشرة (نفس ما يفعله
 * #btnBillingBack) بدل الاعتماد فقط على href.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../supabaseClient.js', () => ({
    getAuthUser: vi.fn(async () => ({ user: { id: 'u1' } })),
}));

vi.mock('../../services/PaymentService.js', () => ({
    listOrders: vi.fn(async () => []),
}));

describe('BillingHistoryView — رابط "عرض الباقات" في حالة عدم وجود طلبات', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="root"></div>';
    });

    it('النقر عليه يستدعي onBack() مباشرة، لا الاعتماد فقط على href', async () => {
        const { BillingHistoryView } = await import('../BillingHistoryView.js');
        const onBack = vi.fn();
        const view = new BillingHistoryView(document.getElementById('root'), { onBack });
        await view.render();

        const link = document.getElementById('billingEmptyPricingLink');
        expect(link).not.toBeNull();
        link.click();

        expect(onBack).toHaveBeenCalledTimes(1);
    });
});
