/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const getOrderStatusMock = vi.fn();
vi.mock('../../services/PaymentService.js', () => ({
    getOrderStatus: (...a) => getOrderStatusMock(...a),
}));

const captureMessageMock = vi.fn();
const captureExceptionMock = vi.fn();
vi.mock('../../utils/monitoring.js', () => ({
    monitoring: { captureMessage: captureMessageMock, captureException: captureExceptionMock },
}));

// تدقيق 2026-07-10: buildWhatsAppLink صار يُعيد null بلا رقم مضبوط (تراجع رشيق) بدل
// رابط مكسور. WHATSAPP_NUMBER يُحسَب مرة واحدة عند تحميل config.js، فنُموِّه الدالة
// مباشرة لاختبار مسار "الرقم مضبوط فعلياً" بمعزل عن توقيت تحميل الوحدات.
vi.mock('../../config.js', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        buildWhatsAppLink: (text) => `https://wa.me/966501234567?text=${encodeURIComponent(text || '')}`,
    };
});

describe('PaymentReturnView', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="root"></div>';
        getOrderStatusMock.mockReset();
        captureMessageMock.mockClear();
    });

    it('بلوكر #43: حالة failed تُبلَّغ للمراقبة (لا تختفي بصفحة العميل فقط)', async () => {
        getOrderStatusMock.mockResolvedValue('failed');
        const { PaymentReturnView } = await import('../PaymentReturnView.js');
        const view = new PaymentReturnView('root', { orderId: 'order-1' });
        await view.render();
        expect(captureMessageMock).toHaveBeenCalledTimes(1);
        expect(captureMessageMock).toHaveBeenCalledWith(expect.stringContaining('order-1'), 'warning', { orderId: 'order-1', status: 'failed' });
    });

    it('بلوكر #43: حالة paid لا تستدعي المراقبة (لا حاجة لتنبيه على نجاح)', async () => {
        getOrderStatusMock.mockResolvedValue('paid');
        const { PaymentReturnView } = await import('../PaymentReturnView.js');
        const view = new PaymentReturnView('root', { orderId: 'order-1' });
        await view.render();
        expect(captureMessageMock).not.toHaveBeenCalled();
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

    it('دفعة 6 (اتساق المراقبة): still_pending بعد استنفاد الاستطلاع يُبلَّغ للمراقبة، لا يبقى صامتاً كالثلاث الأخريات', async () => {
        // كان still_pending الحالة الوحيدة من أربع حالات (paid/failed/refunded/still_pending)
        // بلا أي استدعاء مراقبة — رغم أنها تعني غالباً أن الـwebhook تأخّر أو فشل فعلياً.
        vi.useFakeTimers();
        try {
            getOrderStatusMock.mockResolvedValue('pending');
            const { PaymentReturnView } = await import('../PaymentReturnView.js');
            const view = new PaymentReturnView('root', { orderId: 'order-stuck' });
            const renderPromise = view.render();
            await vi.advanceTimersByTimeAsync(2000 * 10);
            await renderPromise;
            expect(captureMessageMock).toHaveBeenCalledTimes(1);
            expect(captureMessageMock).toHaveBeenCalledWith(expect.stringContaining('order-stuck'), 'warning', { orderId: 'order-stuck', status: 'still_pending' });
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

    it('حالة paid: لا يعرض رابط واتساب (دفع ناجح لا يحتاج دعماً فنياً)', async () => {
        getOrderStatusMock.mockResolvedValue('paid');
        const { PaymentReturnView } = await import('../PaymentReturnView.js');
        const view = new PaymentReturnView('root', { orderId: 'order-1' });
        await view.render();
        expect(document.querySelector('a[href^="https://wa.me/"]')).toBeNull();
    });

    it('حالة failed: يعرض رابط واتساب فعلياً برسالة تذكر رقم الطلب', async () => {
        getOrderStatusMock.mockResolvedValue('failed');
        const { PaymentReturnView } = await import('../PaymentReturnView.js');
        const view = new PaymentReturnView('root', { orderId: 'order-xyz' });
        await view.render();
        const waLink = document.querySelector('a[href^="https://wa.me/"]');
        expect(waLink).not.toBeNull();
        expect(waLink.getAttribute('target')).toBe('_blank');
        const decoded = decodeURIComponent(waLink.getAttribute('href').split('text=')[1]);
        expect(decoded).toContain('order-xyz');
    });

    it('خطأ خادم حقيقي (مثال: 500 من حلقة RLS) أو معرّف غير موجود: يعرض فشلاً فورياً بلا انتظار', async () => {
        // تدقيق حي 2026-07-22: كان getOrderStatus يبتلع الخطأ ويُعيد null، فيُعامَل كـ"لا رد
        // بعد" ويستمر الاستطلاع لعشرين ثانية كاملة قبل "لا يزال قيد المعالجة" — مضلِّل لمعرّف
        // مزوَّر أو عطل خادمي حقيقي. الآن getOrderStatus يرمي، ويجب أن نتوقف من أول محاولة.
        getOrderStatusMock.mockRejectedValue(new Error('infinite recursion detected in policy for relation "orders"'));
        const { PaymentReturnView } = await import('../PaymentReturnView.js');
        const view = new PaymentReturnView('root', { orderId: 'fake-order' });
        await view.render();
        expect(getOrderStatusMock).toHaveBeenCalledTimes(1);
        expect(document.getElementById('root').textContent).toContain('تعذّر التحقق من حالة هذا الطلب');
    });

    it('حالة still_pending: يعرض رابط واتساب أيضاً (انتظار طويل قد يحتاج دعماً)', async () => {
        vi.useFakeTimers();
        try {
            getOrderStatusMock.mockResolvedValue('pending');
            const { PaymentReturnView } = await import('../PaymentReturnView.js');
            const view = new PaymentReturnView('root', { orderId: 'order-1' });
            const renderPromise = view.render();
            await vi.advanceTimersByTimeAsync(2000 * 10);
            await renderPromise;
            expect(document.querySelector('a[href^="https://wa.me/"]')).not.toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });
});
