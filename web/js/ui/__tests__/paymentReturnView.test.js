/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const getOrderStatusMock = vi.fn();
vi.mock('../../services/PaymentService.js', () => ({
    getOrderStatus: (...a) => getOrderStatusMock(...a),
}));

describe('PaymentReturnView', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="root"></div>';
        getOrderStatusMock.mockReset();
    });

    it('بلا orderId: يعرض خطأً فوراً بلا أي استطلاع', async () => {
        const { PaymentReturnView } = await import('../PaymentReturnView.js');
        const view = new PaymentReturnView('root', { orderId: null });
        await view.render();
        expect(getOrderStatusMock).not.toHaveBeenCalled();
        expect(document.getElementById('root').textContent).toContain('لا يوجد رقم طلب صالح');
    });

    it('حالة paid فورية: يعرض رسالة نجاح من أول استطلاع', async () => {
        getOrderStatusMock.mockResolvedValue('paid');
        const { PaymentReturnView } = await import('../PaymentReturnView.js');
        const view = new PaymentReturnView('root', { orderId: 'order-1' });
        await view.render();
        expect(document.getElementById('root').textContent).toContain('تم الدفع بنجاح');
        expect(getOrderStatusMock).toHaveBeenCalledTimes(1);
    });

    it('حالة failed: يعرض رسالة فشل واضحة', async () => {
        getOrderStatusMock.mockResolvedValue('failed');
        const { PaymentReturnView } = await import('../PaymentReturnView.js');
        const view = new PaymentReturnView('root', { orderId: 'order-1' });
        await view.render();
        expect(document.getElementById('root').textContent).toContain('لم تكتمل عملية الدفع');
    });

    it('pending ثم paid بعد محاولتين: يستمر بالاستطلاع حتى يستقر على النتيجة الصحيحة', async () => {
        vi.useFakeTimers();
        try {
            getOrderStatusMock
                .mockResolvedValueOnce('pending')
                .mockResolvedValueOnce('pending')
                .mockResolvedValueOnce('paid');
            const { PaymentReturnView } = await import('../PaymentReturnView.js');
            const view = new PaymentReturnView('root', { orderId: 'order-1' });
            const renderPromise = view.render();
            // تقدّم زمني وهمي بدل انتظار حقيقي (POLL_INTERVAL_MS × محاولتين متبقيتين)
            await vi.advanceTimersByTimeAsync(2000);
            await vi.advanceTimersByTimeAsync(2000);
            await renderPromise;
            expect(getOrderStatusMock).toHaveBeenCalledTimes(3);
            expect(document.getElementById('root').textContent).toContain('تم الدفع بنجاح');
        } finally {
            vi.useRealTimers();
        }
    });

    it('يظل pending لعدد المحاولات الأقصى: يعرض "قيد المعالجة" بدل انتظار أبدي', async () => {
        vi.useFakeTimers();
        try {
            getOrderStatusMock.mockResolvedValue('pending');
            const { PaymentReturnView } = await import('../PaymentReturnView.js');
            const view = new PaymentReturnView('root', { orderId: 'order-1' });
            const renderPromise = view.render();
            await vi.advanceTimersByTimeAsync(2000 * 10);
            await renderPromise;
            expect(document.getElementById('root').textContent).toContain('الدفع قيد المعالجة');
            // 10 محاولات كحد أقصى (MAX_ATTEMPTS) — لا حلقة لا نهائية
            expect(getOrderStatusMock.mock.calls.length).toBeLessThanOrEqual(10);
        } finally {
            vi.useRealTimers();
        }
    });

    it('destroy() يوقف الاستطلاع فوراً (لا يستمر بعد مغادرة المستخدم للصفحة)', async () => {
        let callCount = 0;
        getOrderStatusMock.mockImplementation(async () => { callCount++; return 'pending'; });
        const { PaymentReturnView } = await import('../PaymentReturnView.js');
        const view = new PaymentReturnView('root', { orderId: 'order-1' });
        const renderPromise = view.render();
        await new Promise((r) => setTimeout(r, 10));
        view.destroy();
        await renderPromise;
        const countAfterDestroy = callCount;
        await new Promise((r) => setTimeout(r, 100));
        expect(callCount).toBe(countAfterDestroy); // لا استدعاءات إضافية بعد destroy
    });

    it('زر "متابعة" يستدعي onContinue', async () => {
        getOrderStatusMock.mockResolvedValue('paid');
        const onContinue = vi.fn();
        const { PaymentReturnView } = await import('../PaymentReturnView.js');
        const view = new PaymentReturnView('root', { orderId: 'order-1', onContinue });
        await view.render();
        document.getElementById('btnPaymentReturnContinue').click();
        expect(onContinue).toHaveBeenCalledTimes(1);
    });
});
