import { describe, it, expect, vi, beforeEach } from 'vitest';

const captureExceptionMock = vi.fn();
vi.mock('../../utils/monitoring.js', () => ({
    monitoring: { captureException: (...a) => captureExceptionMock(...a) },
}));

const getAuthUserMock = vi.fn(async () => ({ user: null }));
const invokeMock = vi.fn(async () => ({ data: null, error: null }));
const rpcMock = vi.fn(async () => ({ data: null, error: null }));
const selectChain = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    limit: vi.fn(),
    single: vi.fn(),
    order: vi.fn(),
};
const fromMock = vi.fn(() => selectChain);

vi.mock('../../../supabaseClient.js', () => ({
    getSupabaseClient: vi.fn(async () => ({
        ok: true,
        supabase: { functions: { invoke: invokeMock }, from: fromMock, rpc: rpcMock },
    })),
    getAuthUser: (...a) => getAuthUserMock(...a),
}));

describe('hasActivePayment', () => {
    beforeEach(() => {
        getAuthUserMock.mockReset().mockResolvedValue({ user: { id: 'u1' } });
        selectChain.select.mockReturnThis();
        selectChain.eq.mockReturnThis();
        selectChain.in.mockReturnThis();
        selectChain.limit.mockResolvedValue({ data: [], error: null });
        fromMock.mockClear();
        captureExceptionMock.mockClear();
    });

    it('بلا studyId ⇒ false فوراً بلا أي استعلام', async () => {
        const { hasActivePayment } = await import('../PaymentService.js');
        expect(await hasActivePayment(null)).toBe(false);
        expect(fromMock).not.toHaveBeenCalled();
    });

    it('زائر غير مسجَّل ⇒ false (لا هوية لربط طلب بها)', async () => {
        getAuthUserMock.mockResolvedValue({ user: null });
        const { hasActivePayment } = await import('../PaymentService.js');
        expect(await hasActivePayment('study-1')).toBe(false);
        expect(fromMock).not.toHaveBeenCalled();
    });

    it('يوجد صف واحد على الأقل بحالة paid ⇒ true', async () => {
        selectChain.limit.mockResolvedValue({ data: [{ id: 'order-1' }], error: null });
        const { hasActivePayment } = await import('../PaymentService.js');
        expect(await hasActivePayment('study-1')).toBe(true);
        expect(fromMock).toHaveBeenCalledWith('orders');
    });

    it('لا صفوف مطابقة ⇒ false', async () => {
        selectChain.limit.mockResolvedValue({ data: [], error: null });
        const { hasActivePayment } = await import('../PaymentService.js');
        expect(await hasActivePayment('study-1')).toBe(false);
    });

    it('خطأ في الاستعلام ⇒ false (فشل آمن، لا يفتح البوابة خطأً)', async () => {
        selectChain.limit.mockResolvedValue({ data: null, error: { message: 'network error' } });
        const { hasActivePayment } = await import('../PaymentService.js');
        expect(await hasActivePayment('study-1')).toBe(false);
    });

    it('تدقيق أمني 2026-08-29: الاستعلام يفلتر على tier من الباقات المدفوعة فعلاً، لا status=paid وحدها', async () => {
        // بلا هذا الفلتر، أي صف orders بحالة paid (مهما كان tier، بما فيه 'free' غير
        // المدفوعة أصلاً) كان يفتح كل بوابات التصدير — انظر hasActivePayment.tierGate
        // .security.test.js لاختبار السلوك الفعلي عبر قاعدة بيانات مموَّهة حقيقية.
        selectChain.limit.mockResolvedValue({ data: [{ id: 'order-1' }], error: null });
        const { hasActivePayment } = await import('../PaymentService.js');
        await hasActivePayment('study-1');
        expect(selectChain.in).toHaveBeenCalledWith('tier', ['self', 'reviewed', 'full']);
    });

    it('بلوكر مراقبة 2026-08-29: خطأ في الاستعلام يُبلَّغ لـmonitoring.captureException بسياق studyId — كان يُبتلَع بconsole.warn فقط', async () => {
        selectChain.limit.mockResolvedValue({ data: null, error: { message: 'network error' } });
        const { hasActivePayment } = await import('../PaymentService.js');
        await hasActivePayment('study-1');

        expect(captureExceptionMock).toHaveBeenCalledTimes(1);
        const [err, context] = captureExceptionMock.mock.calls[0];
        expect(err.message).toBe('network error');
        expect(context).toMatchObject({ source: 'PaymentService.hasActivePayment', studyId: 'study-1' });
    });

    it('نجاح الاستعلام (بصرف النظر عن النتيجة) ⇒ لا يستدعي captureException إطلاقاً', async () => {
        selectChain.limit.mockResolvedValue({ data: [{ id: 'order-1' }], error: null });
        const { hasActivePayment } = await import('../PaymentService.js');
        await hasActivePayment('study-1');
        expect(captureExceptionMock).not.toHaveBeenCalled();
    });
});

describe('startCheckout', () => {
    beforeEach(() => {
        getAuthUserMock.mockReset().mockResolvedValue({ user: { id: 'u1' } });
        invokeMock.mockReset().mockResolvedValue({
            data: { checkoutUrl: 'https://pay.example.com/abc', orderId: 'order-1' },
            error: null,
        });
        captureExceptionMock.mockClear();
    });

    it('بلا مستخدم مسجَّل ⇒ خطأ واضح، لا يستدعي invoke', async () => {
        getAuthUserMock.mockResolvedValue({ user: null });
        const { startCheckout } = await import('../PaymentService.js');
        const result = await startCheckout({ tier: 'self', studyId: 's1', provider: 'moyasar' });
        expect(result.ok).toBe(false);
        expect(invokeMock).not.toHaveBeenCalled();
    });

    it('نجاح: يمرّر tier/studyId/provider لـcreate-checkout ويُعيد checkoutUrl', async () => {
        const { startCheckout } = await import('../PaymentService.js');
        const result = await startCheckout({ tier: 'reviewed', studyId: 's1', provider: 'stripe' });
        expect(invokeMock).toHaveBeenCalledWith('create-checkout', {
            body: { tier: 'reviewed', studyId: 's1', provider: 'stripe' },
        });
        expect(result.ok).toBe(true);
        expect(result.checkoutUrl).toBe('https://pay.example.com/abc');
    });

    it('فشل الخادم (error من invoke، شكل FunctionsHttpError الحقيقي) ⇒ ok:false بالسبب الفعلي من context.json() لا برسالة .message العامة الثابتة', async () => {
        // شكل FunctionsHttpError الحقيقي (@supabase/functions-js): .message نص عام ثابت
        // دوماً ('Edge Function returned a non-2xx status code')، والسبب الفعلي الذي
        // أعادته create-checkout (مثال هنا: invalid_tier) لا يصل إلا عبر قراءة
        // error.context.json() — انظر node_modules/@supabase/functions-js/src/types.ts
        // وFunctionsClient.ts (`throw new FunctionsHttpError(response)`).
        invokeMock.mockResolvedValue({
            data: null,
            error: {
                name: 'FunctionsHttpError',
                message: 'Edge Function returned a non-2xx status code',
                context: { json: async () => ({ error: 'invalid_tier' }) },
            },
        });
        const { startCheckout } = await import('../PaymentService.js');
        const result = await startCheckout({ tier: 'self', studyId: 's1', provider: 'moyasar' });
        expect(result.ok).toBe(false);
        expect(result.error).toBe('invalid_tier');
    });

    it('بلوكر 2026-08-31: السبب الحقيقي (rate_limited) من context.json() يصل لـresult.error بدل رسالة .message العامة الثابتة', async () => {
        invokeMock.mockResolvedValue({
            data: null,
            error: {
                name: 'FunctionsHttpError',
                message: 'Edge Function returned a non-2xx status code',
                context: { json: async () => ({ error: 'rate_limited', retryAfterSeconds: 42 }) },
            },
        });
        const { startCheckout } = await import('../PaymentService.js');
        const result = await startCheckout({ tier: 'self', studyId: 's1', provider: 'moyasar' });
        expect(result.ok).toBe(false);
        expect(result.error).toBe('rate_limited');
        expect(result.error).not.toBe('Edge Function returned a non-2xx status code');
    });

    it('استجابة بلا checkoutUrl ⇒ ok:false (لا نفترض نجاحاً من استجابة ناقصة)', async () => {
        invokeMock.mockResolvedValue({ data: {}, error: null });
        const { startCheckout } = await import('../PaymentService.js');
        const result = await startCheckout({ tier: 'self', studyId: 's1', provider: 'moyasar' });
        expect(result.ok).toBe(false);
    });

    it('بلوكر مراقبة 2026-08-29: استثناء اتصال حقيقي (invoke يرمي) يُبلَّغ لـmonitoring.captureException بسياق الباقة والدراسة والمزوّد', async () => {
        invokeMock.mockRejectedValue(new Error('network down'));
        const { startCheckout } = await import('../PaymentService.js');
        const result = await startCheckout({ tier: 'self', studyId: 's1', provider: 'moyasar' });

        expect(result.ok).toBe(false);
        expect(result.error).toBe('network down');
        expect(captureExceptionMock).toHaveBeenCalledTimes(1);
        const [err, context] = captureExceptionMock.mock.calls[0];
        expect(err.message).toBe('network down');
        expect(context).toMatchObject({ source: 'PaymentService.startCheckout', studyId: 's1', tier: 'self', provider: 'moyasar' });
    });

    it('فشل منطقي عادي من create-checkout (error في data لا استثناء) ⇒ لا يستدعي captureException (ليس استثناء اتصال)', async () => {
        invokeMock.mockResolvedValue({ data: null, error: { message: 'invalid_tier' } });
        const { startCheckout } = await import('../PaymentService.js');
        await startCheckout({ tier: 'self', studyId: 's1', provider: 'moyasar' });
        expect(captureExceptionMock).not.toHaveBeenCalled();
    });

    it('نجاح ⇒ لا يستدعي captureException إطلاقاً', async () => {
        const { startCheckout } = await import('../PaymentService.js');
        await startCheckout({ tier: 'self', studyId: 's1', provider: 'moyasar' });
        expect(captureExceptionMock).not.toHaveBeenCalled();
    });
});

describe('getOrderStatus', () => {
    beforeEach(() => {
        selectChain.select.mockReturnThis();
        selectChain.eq.mockReturnThis();
        selectChain.single.mockResolvedValue({ data: { status: 'paid' }, error: null });
    });

    it('بلا orderId ⇒ null فوراً', async () => {
        const { getOrderStatus } = await import('../PaymentService.js');
        expect(await getOrderStatus(null)).toBeNull();
    });

    it('يُعيد status الفعلي من الصف', async () => {
        const { getOrderStatus } = await import('../PaymentService.js');
        expect(await getOrderStatus('order-1')).toBe('paid');
    });

    it('خطأ من القاعدة (بما فيه معرّف غير موجود) ⇒ يُرمى بدل إعادة null بصمت', async () => {
        // تدقيق حي 2026-07-22: كان يُبتلَع بصمت ويُعاد null، فيعامله PaymentReturnView
        // كـ"لا رد بعد" ويستمر بالاستطلاع 20 ثانية بدل عرض فشل واضح فوراً.
        selectChain.single.mockResolvedValue({ data: null, error: { message: 'not found' } });
        const { getOrderStatus } = await import('../PaymentService.js');
        await expect(getOrderStatus('missing')).rejects.toThrow('not found');
    });
});

describe('listOrders', () => {
    beforeEach(() => {
        getAuthUserMock.mockReset().mockResolvedValue({ user: { id: 'u1' } });
        rpcMock.mockReset().mockResolvedValue({ data: null, error: null });
        selectChain.select.mockReturnThis();
        selectChain.order.mockResolvedValue({ data: [{ id: 'order-1', status: 'expired' }], error: null });
        fromMock.mockClear();
        captureExceptionMock.mockClear();
    });

    it('ينظّف الطلبات المنتهية (RPC) قبل جلب السجل — بلوكر #9', async () => {
        const { listOrders } = await import('../PaymentService.js');
        await listOrders();
        expect(rpcMock).toHaveBeenCalledWith('expire_stale_pending_orders');
        expect(fromMock).toHaveBeenCalledWith('orders');
    });

    it('فشل تنظيف الـRPC لا يمنع عرض السجل', async () => {
        rpcMock.mockResolvedValue({ data: null, error: { message: 'rpc down' } });
        const { listOrders } = await import('../PaymentService.js');
        const result = await listOrders();
        expect(result).toEqual([{ id: 'order-1', status: 'expired' }]);
    });

    it('زائر غير مسجَّل ⇒ [] بلا استدعاء RPC أو استعلام', async () => {
        getAuthUserMock.mockResolvedValue({ user: null });
        const { listOrders } = await import('../PaymentService.js');
        expect(await listOrders()).toEqual([]);
        expect(rpcMock).not.toHaveBeenCalled();
    });

    it('فشل استعلام السجل ⇒ يُرمى بدل [] (فارغ ≠ تعذّر الوصول)', async () => {
        // تدقيق 2026-08-26: كان يُعيد [] لجلسة سليمة فشل استعلامها، فتطبع الواجهة
        // «لا توجد عمليات دفع حتى الآن» — حكمٌ عن حساب العميل مبنيّ على عطل شبكة/خادم.
        selectChain.order.mockResolvedValue({ data: null, error: { message: 'network error' } });
        const { listOrders } = await import('../PaymentService.js');
        await expect(listOrders()).rejects.toThrow('network error');
    });

    it('بلوكر مراقبة 2026-08-29: فشل استعلام السجل يُبلَّغ لـmonitoring.captureException قبل الرمي — لا مستدعٍ حالي (BillingHistoryView/DashboardView) يُبلِّغ عن هذا الرمي بنفسه', async () => {
        selectChain.order.mockResolvedValue({ data: null, error: { message: 'network error' } });
        const { listOrders } = await import('../PaymentService.js');
        await expect(listOrders()).rejects.toThrow('network error');

        expect(captureExceptionMock).toHaveBeenCalledTimes(1);
        const [err, context] = captureExceptionMock.mock.calls[0];
        expect(err.message).toBe('network error');
        expect(context).toMatchObject({ source: 'PaymentService.listOrders' });
    });

    it('نجاح جلب السجل ⇒ لا يستدعي captureException إطلاقاً', async () => {
        const { listOrders } = await import('../PaymentService.js');
        await listOrders();
        expect(captureExceptionMock).not.toHaveBeenCalled();
    });
});
