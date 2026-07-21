import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTamaraCheckout, parseTamaraWebhookStatus } from '../tamara.ts';

describe('createTamaraCheckout', () => {
    let fetchMock;
    beforeEach(() => {
        fetchMock = vi.fn(async () => ({
            ok: true,
            json: async () => ({ order_id: 'ord_abc123', checkout_url: 'https://checkout.tamara.co/ord_abc123' }),
        }));
        vi.stubGlobal('fetch', fetchMock);
    });
    afterEach(() => vi.unstubAllGlobals());

    it('يرسل المبلغ بصيغة نصية بخانتين عشريتين (لا هللات كـMoyasar)', async () => {
        await createTamaraCheckout('token_test_123', {
            amountSar: 990,
            description: 'باقة مراجَع بخبير',
            callbackUrl: 'https://app.example.com/payment-return',
            notificationUrl: 'https://project.supabase.co/functions/v1/webhook-tamara',
            metadata: { tier: 'reviewed', orderId: 'order-1' },
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, options] = fetchMock.mock.calls[0];
        expect(url).toBe('https://api.tamara.co/checkout');
        const body = JSON.parse(options.body);
        expect(body.total_amount.amount).toBe('990.00');
        expect(body.total_amount.currency).toBe('SAR');
        expect(body.order_reference_id).toBe('order-1');
    });

    it('يستخدم Bearer token بالتفويض', async () => {
        await createTamaraCheckout('token_secret', {
            amountSar: 100,
            description: 'test',
            callbackUrl: 'https://x.com',
            notificationUrl: 'https://project.supabase.co/functions/v1/webhook-tamara',
            metadata: {},
        });
        const [, options] = fetchMock.mock.calls[0];
        expect(options.headers.Authorization).toBe('Bearer token_secret');
    });

    it('بلوكر #12: يوجّه merchant_url.notification لرابط webhook منفصل عن صفحة العودة، لا نفسها', async () => {
        await createTamaraCheckout('token', {
            amountSar: 100,
            description: 'test',
            callbackUrl: 'https://app.example.com/#/payment-return?order=order-1',
            notificationUrl: 'https://project.supabase.co/functions/v1/webhook-tamara',
            metadata: {},
        });
        const [, options] = fetchMock.mock.calls[0];
        const body = JSON.parse(options.body);
        expect(body.merchant_url.notification).toBe('https://project.supabase.co/functions/v1/webhook-tamara');
        expect(body.merchant_url.notification).not.toBe(body.merchant_url.success);
        expect(body.merchant_url.success).toBe('https://app.example.com/#/payment-return?order=order-1');
    });

    it('يُعيد providerRef وcheckoutUrl من استجابة Tamara', async () => {
        const result = await createTamaraCheckout('token', {
            amountSar: 100,
            description: 'test',
            callbackUrl: 'https://x.com',
            notificationUrl: 'https://project.supabase.co/functions/v1/webhook-tamara',
            metadata: {},
        });
        expect(result.providerRef).toBe('ord_abc123');
        expect(result.checkoutUrl).toBe('https://checkout.tamara.co/ord_abc123');
    });

    it('يرمي خطأً واضحاً عند فشل الطلب (لا يُعيد نتيجة صامتة فارغة)', async () => {
        fetchMock.mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'Unauthorized' });
        await expect(
            createTamaraCheckout('bad_token', {
                amountSar: 100,
                description: 'x',
                callbackUrl: 'https://x.com',
                notificationUrl: 'https://project.supabase.co/functions/v1/webhook-tamara',
                metadata: {},
            })
        ).rejects.toThrow(/401/);
    });
});

describe('parseTamaraWebhookStatus', () => {
    it('بلوكر #12: approved (موافقة/حجز بلا قبض فعلي) ⇒ unknown، لا paid — لا يفتح القفل قبل القبض', () => {
        expect(parseTamaraWebhookStatus({ order_status: 'approved' })).toBe('unknown');
    });
    it('captured (قبض فعلي مؤكَّد) ⇒ paid', () => {
        expect(parseTamaraWebhookStatus({ order_status: 'captured' })).toBe('paid');
    });
    it('fully_captured ⇒ paid', () => {
        expect(parseTamaraWebhookStatus({ order_status: 'fully_captured' })).toBe('paid');
    });
    it('declined ⇒ failed', () => {
        expect(parseTamaraWebhookStatus({ order_status: 'declined' })).toBe('failed');
    });
    it('expired ⇒ failed', () => {
        expect(parseTamaraWebhookStatus({ order_status: 'expired' })).toBe('failed');
    });
    it('حدث غير معروف ⇒ unknown (لا نفترض نجاحاً افتراضياً)', () => {
        expect(parseTamaraWebhookStatus({ order_status: 'something_else' })).toBe('unknown');
    });
});
