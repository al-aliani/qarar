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
            metadata: {},
        });
        const [, options] = fetchMock.mock.calls[0];
        expect(options.headers.Authorization).toBe('Bearer token_secret');
    });

    it('يُعيد providerRef وcheckoutUrl من استجابة Tamara', async () => {
        const result = await createTamaraCheckout('token', {
            amountSar: 100,
            description: 'test',
            callbackUrl: 'https://x.com',
            metadata: {},
        });
        expect(result.providerRef).toBe('ord_abc123');
        expect(result.checkoutUrl).toBe('https://checkout.tamara.co/ord_abc123');
    });

    it('يرمي خطأً واضحاً عند فشل الطلب (لا يُعيد نتيجة صامتة فارغة)', async () => {
        fetchMock.mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'Unauthorized' });
        await expect(
            createTamaraCheckout('bad_token', { amountSar: 100, description: 'x', callbackUrl: 'https://x.com', metadata: {} })
        ).rejects.toThrow(/401/);
    });
});

describe('parseTamaraWebhookStatus', () => {
    it('approved ⇒ paid', () => {
        expect(parseTamaraWebhookStatus({ order_status: 'approved' })).toBe('paid');
    });
    it('captured ⇒ paid', () => {
        expect(parseTamaraWebhookStatus({ order_status: 'captured' })).toBe('paid');
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
