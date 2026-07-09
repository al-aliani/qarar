import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createStripeCheckout, parseStripeWebhookStatus, getStripeSessionId } from '../stripe.ts';

describe('createStripeCheckout', () => {
  let fetchMock;
  beforeEach(() => {
    fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ id: 'cs_test_abc123', url: 'https://checkout.stripe.com/c/pay/cs_test_abc123' }),
    }));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('يحوّل الريال إلى هللة (× 100) كـunit_amount', async () => {
    await createStripeCheckout('sk_test_123', {
      amountSar: 990,
      description: 'باقة مراجَع بخبير',
      successUrl: 'https://app.example.com/payment-return?ok=1',
      cancelUrl: 'https://app.example.com/payment-return?cancelled=1',
      metadata: { tier: 'reviewed', orderId: 'order-2' },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.stripe.com/v1/checkout/sessions');
    const params = new URLSearchParams(options.body);
    expect(params.get('line_items[0][price_data][unit_amount]')).toBe('99000');
    expect(params.get('line_items[0][price_data][currency]')).toBe('sar');
    expect(params.get('mode')).toBe('payment');
  });

  it('يستخدم Bearer Auth بالمفتاح السرّي', async () => {
    await createStripeCheckout('sk_test_secret', {
      amountSar: 100,
      description: 'test',
      successUrl: 'https://x.com/ok',
      cancelUrl: 'https://x.com/cancel',
      metadata: {},
    });
    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers.Authorization).toBe('Bearer sk_test_secret');
  });

  it('يُعيد providerRef وcheckoutUrl من استجابة Stripe', async () => {
    const result = await createStripeCheckout('sk_test', {
      amountSar: 100,
      description: 'test',
      successUrl: 'https://x.com/ok',
      cancelUrl: 'https://x.com/cancel',
      metadata: {},
    });
    expect(result.providerRef).toBe('cs_test_abc123');
    expect(result.checkoutUrl).toBe('https://checkout.stripe.com/c/pay/cs_test_abc123');
  });

  it('يمرّر بيانات metadata كحقول form منفصلة', async () => {
    await createStripeCheckout('sk_test', {
      amountSar: 100,
      description: 'test',
      successUrl: 'https://x.com/ok',
      cancelUrl: 'https://x.com/cancel',
      metadata: { orderId: 'order-99', tier: 'self' },
    });
    const [, options] = fetchMock.mock.calls[0];
    const params = new URLSearchParams(options.body);
    expect(params.get('metadata[orderId]')).toBe('order-99');
    expect(params.get('metadata[tier]')).toBe('self');
  });

  it('يرمي خطأً واضحاً عند فشل الطلب', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 400, text: async () => 'Invalid request' });
    await expect(
      createStripeCheckout('bad_key', { amountSar: 100, description: 'x', successUrl: 'https://x.com', cancelUrl: 'https://x.com', metadata: {} })
    ).rejects.toThrow(/400/);
  });
});

describe('parseStripeWebhookStatus / getStripeSessionId', () => {
  it('checkout.session.completed + payment_status=paid ⇒ paid', () => {
    const event = { type: 'checkout.session.completed', data: { object: { id: 'cs_1', payment_status: 'paid' } } };
    expect(parseStripeWebhookStatus(event)).toBe('paid');
    expect(getStripeSessionId(event)).toBe('cs_1');
  });

  it('checkout.session.completed لكن payment_status≠paid ⇒ unknown (لا نفترض نجاحاً)', () => {
    const event = { type: 'checkout.session.completed', data: { object: { id: 'cs_1', payment_status: 'unpaid' } } };
    expect(parseStripeWebhookStatus(event)).toBe('unknown');
  });

  it('checkout.session.async_payment_failed ⇒ failed', () => {
    expect(parseStripeWebhookStatus({ type: 'checkout.session.async_payment_failed' })).toBe('failed');
  });

  it('حدث غير معروف ⇒ unknown', () => {
    expect(parseStripeWebhookStatus({ type: 'customer.created' })).toBe('unknown');
  });
});
