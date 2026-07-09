import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMoyasarCheckout, parseMoyasarWebhookStatus } from '../moyasar.ts';

describe('createMoyasarCheckout', () => {
  let fetchMock;
  beforeEach(() => {
    fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ id: 'inv_abc123', url: 'https://moyasar.com/invoices/inv_abc123' }),
    }));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('يحوّل الريال إلى هللة (× 100) في الحمولة المرسَلة', async () => {
    await createMoyasarCheckout('sk_test_123', {
      amountSar: 249,
      description: 'باقة ذاتي',
      callbackUrl: 'https://app.example.com/payment-return',
      metadata: { tier: 'self', orderId: 'order-1' },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.moyasar.com/v1/invoices');
    const body = JSON.parse(options.body);
    expect(body.amount).toBe(24900);
    expect(body.currency).toBe('SAR');
  });

  it('يستخدم Basic Auth بالمفتاح السرّي (لا يُرسل بلا تفويض)', async () => {
    await createMoyasarCheckout('sk_test_secret', {
      amountSar: 100,
      description: 'test',
      callbackUrl: 'https://x.com',
      metadata: {},
    });
    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers.Authorization).toBe(`Basic ${btoa('sk_test_secret:')}`);
  });

  it('يُعيد providerRef وcheckoutUrl من استجابة Moyasar', async () => {
    const result = await createMoyasarCheckout('sk_test', {
      amountSar: 100,
      description: 'test',
      callbackUrl: 'https://x.com',
      metadata: {},
    });
    expect(result.providerRef).toBe('inv_abc123');
    expect(result.checkoutUrl).toBe('https://moyasar.com/invoices/inv_abc123');
  });

  it('يرمي خطأً واضحاً عند فشل الطلب (لا يُعيد نتيجة صامتة فارغة)', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'Unauthorized' });
    await expect(
      createMoyasarCheckout('bad_key', { amountSar: 100, description: 'x', callbackUrl: 'https://x.com', metadata: {} })
    ).rejects.toThrow(/401/);
  });
});

describe('parseMoyasarWebhookStatus', () => {
  it('invoice_paid ⇒ paid', () => {
    expect(parseMoyasarWebhookStatus({ type: 'invoice_paid' })).toBe('paid');
  });
  it('data.status=paid ⇒ paid (شكل بديل موثَّق)', () => {
    expect(parseMoyasarWebhookStatus({ data: { status: 'paid' } })).toBe('paid');
  });
  it('invoice_failed ⇒ failed', () => {
    expect(parseMoyasarWebhookStatus({ type: 'invoice_failed' })).toBe('failed');
  });
  it('حدث غير معروف ⇒ unknown (لا نفترض نجاحاً افتراضياً)', () => {
    expect(parseMoyasarWebhookStatus({ type: 'something_else' })).toBe('unknown');
  });
});
