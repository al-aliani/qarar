/**
 * اختبار منطق التحقق من توقيع Webhook (Stripe/Moyasar) عبر Vitest (Node) —
 * الملف المصدر webhookVerify.ts يستخدم حصراً Web Crypto API القياسية
 * (crypto.subtle) بلا أي API خاص بـDeno، فيعمل بلا تعديل هنا رغم أن الوجهة
 * الفعلية (Edge Functions) هي بيئة Deno غير المتوفرة محلياً في هذه الجلسة.
 */
import { describe, it, expect } from 'vitest';
import {
  verifyStripeSignature,
  verifyMoyasarSecretToken,
  hmacSha256Hex,
} from '../webhookVerify.ts';

describe('verifyStripeSignature', () => {
  const secret = 'whsec_test_12345';
  const body = JSON.stringify({ id: 'evt_123', type: 'checkout.session.completed' });

  it('يقبل توقيعاً صحيحاً محسوباً بنفس الخوارزمية (HMAC-SHA256 على timestamp.body)', async () => {
    const ts = 1720000000;
    const expectedSig = await hmacSha256Hex(secret, `${ts}.${body}`);
    const header = `t=${ts},v1=${expectedSig}`;
    const result = await verifyStripeSignature(body, header, secret, 300, ts + 5);
    expect(result.ok).toBe(true);
  });

  it('يرفض توقيعاً بجسم مُعدَّل (حتى لو طابق نفس الطابع الزمني)', async () => {
    const ts = 1720000000;
    const expectedSig = await hmacSha256Hex(secret, `${ts}.${body}`);
    const header = `t=${ts},v1=${expectedSig}`;
    const tamperedBody = JSON.stringify({ id: 'evt_123', type: 'checkout.session.completed', amount: 999999 });
    const result = await verifyStripeSignature(tamperedBody, header, secret, 300, ts + 5);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('signature_mismatch');
  });

  it('يرفض توقيعاً بسرّ خاطئ', async () => {
    const ts = 1720000000;
    const wrongSig = await hmacSha256Hex('wrong-secret', `${ts}.${body}`);
    const header = `t=${ts},v1=${wrongSig}`;
    const result = await verifyStripeSignature(body, header, secret, 300, ts + 5);
    expect(result.ok).toBe(false);
  });

  it('يرفض حدثاً قديماً جداً (حماية من هجوم إعادة التشغيل)', async () => {
    const ts = 1720000000;
    const sig = await hmacSha256Hex(secret, `${ts}.${body}`);
    const header = `t=${ts},v1=${sig}`;
    const farFuture = ts + 10000; // أبعد بكثير من tolerance الافتراضي (300s)
    const result = await verifyStripeSignature(body, header, secret, 300, farFuture);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('timestamp_out_of_tolerance');
  });

  it('يرفض غياب رأس التوقيع كلياً', async () => {
    const result = await verifyStripeSignature(body, null, secret);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('missing_signature_header');
  });

  it('يرفض رأساً مشوَّهاً (بلا t أو v1)', async () => {
    const result = await verifyStripeSignature(body, 'garbage=1,foo=bar', secret);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('malformed_signature_header');
  });
});

describe('verifyMoyasarSecretToken', () => {
  it('يقبل secret_token مطابقاً', () => {
    const result = verifyMoyasarSecretToken({ secret_token: 'moy_secret_abc' }, 'moy_secret_abc');
    expect(result.ok).toBe(true);
  });

  it('يرفض secret_token مختلفاً', () => {
    const result = verifyMoyasarSecretToken({ secret_token: 'wrong' }, 'moy_secret_abc');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('secret_token_mismatch');
  });

  it('يرفض غياب secret_token من الحمولة كلياً (محاولة تزييف حدث بلا أي رمز)', () => {
    const result = verifyMoyasarSecretToken({ id: 'pay_123' }, 'moy_secret_abc');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('missing_secret_token');
  });
});
