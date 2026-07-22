import { describe, it, expect, vi, beforeEach } from 'vitest';

const getAuthUserMock = vi.fn(async () => ({ user: null }));
const invokeMock = vi.fn(async () => ({ data: null, error: null }));
const rpcMock = vi.fn(async () => ({ data: null, error: null }));
const selectChain = {
    select: vi.fn(),
    eq: vi.fn(),
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
        selectChain.limit.mockResolvedValue({ data: [], error: null });
        fromMock.mockClear();
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
});

describe('startCheckout', () => {
    beforeEach(() => {
        getAuthUserMock.mockReset().mockResolvedValue({ user: { id: 'u1' } });
        invokeMock.mockReset().mockResolvedValue({
            data: { checkoutUrl: 'https://pay.example.com/abc', orderId: 'order-1' },
            error: null,
        });
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

    it('فشل الخادم (error من invoke) ⇒ ok:false برسالة الخطأ', async () => {
        invokeMock.mockResolvedValue({ data: null, error: { message: 'invalid_tier' } });
        const { startCheckout } = await import('../PaymentService.js');
        const result = await startCheckout({ tier: 'self', studyId: 's1', provider: 'moyasar' });
        expect(result.ok).toBe(false);
        expect(result.error).toBe('invalid_tier');
    });

    it('استجابة بلا checkoutUrl ⇒ ok:false (لا نفترض نجاحاً من استجابة ناقصة)', async () => {
        invokeMock.mockResolvedValue({ data: {}, error: null });
        const { startCheckout } = await import('../PaymentService.js');
        const result = await startCheckout({ tier: 'self', studyId: 's1', provider: 'moyasar' });
        expect(result.ok).toBe(false);
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
});
