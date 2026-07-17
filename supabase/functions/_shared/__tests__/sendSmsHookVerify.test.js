/**
 * اختبار التحقق من توقيع Supabase Send SMS Hook (معيار Standard Webhooks).
 * نفس مبرر webhookVerify.test.js: المصدر يستخدم Web Crypto القياسية فقط، فيعمل
 * تحت Vitest/Node رغم أن وجهته الفعلية بيئة Deno.
 *
 * أهمية هذه الاختبارات: بدون تحقق سليم يستطيع أي طرف استدعاء عنوان send-sms-hook
 * برقم ورمز من اختياره فيُرسل رسائل واتساب على حساب المالك (استنزاف رصيد Meta).
 */
import { describe, it, expect } from 'vitest';
import { verifyStandardWebhookSignature } from '../webhookVerify.ts';

/** يبني توقيعاً صحيحاً تماماً كما يفعل Supabase، لاختبار المسار السعيد بصدق. */
async function signLikeSupabase(secretBase64, id, timestamp, body) {
  const bin = atob(secretBase64);
  const keyBytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) keyBytes[i] = bin.charCodeAt(i);
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${body}`));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

const SECRET_B64 = btoa('super-secret-key-material');
const CONFIGURED = `v1,whsec_${SECRET_B64}`;
const BODY = JSON.stringify({ user: { phone: '966501234567' }, sms: { otp: '123456' } });
const ID = 'msg_2abc';

const nowSeconds = () => Math.floor(Date.now() / 1000);

describe('verifyStandardWebhookSignature — Send SMS Hook', () => {
    it('يقبل توقيعاً صحيحاً بصيغة السرّ الكاملة "v1,whsec_<base64>"', async () => {
        const ts = nowSeconds();
        const sig = await signLikeSupabase(SECRET_B64, ID, ts, BODY);
        const result = await verifyStandardWebhookSignature(
            CONFIGURED,
            { id: ID, timestamp: String(ts), signature: `v1,${sig}` },
            BODY
        );
        expect(result.ok).toBe(true);
    });

    it('يقبل السرّ بلا بادئة "v1," أو "whsec_" (تسامح مع النسخ اليدوي)', async () => {
        const ts = nowSeconds();
        const sig = await signLikeSupabase(SECRET_B64, ID, ts, BODY);
        for (const secret of [`whsec_${SECRET_B64}`, SECRET_B64]) {
            const result = await verifyStandardWebhookSignature(
                secret,
                { id: ID, timestamp: String(ts), signature: `v1,${sig}` },
                BODY
            );
            expect(result.ok, `فشل بصيغة السرّ: ${secret.slice(0, 12)}…`).toBe(true);
        }
    });

    it('يقبل عند وجود عدة توقيعات في الرأس (تدوير المفاتيح)', async () => {
        const ts = nowSeconds();
        const sig = await signLikeSupabase(SECRET_B64, ID, ts, BODY);
        const result = await verifyStandardWebhookSignature(
            CONFIGURED,
            { id: ID, timestamp: String(ts), signature: `v1,ZmFrZXNpZ25hdHVyZQ== v1,${sig}` },
            BODY
        );
        expect(result.ok).toBe(true);
    });

    it('يرفض جسماً مُعدَّلاً بعد التوقيع (حقن رقم مهاجم)', async () => {
        const ts = nowSeconds();
        const sig = await signLikeSupabase(SECRET_B64, ID, ts, BODY);
        const tampered = JSON.stringify({ user: { phone: '966599999999' }, sms: { otp: '123456' } });
        const result = await verifyStandardWebhookSignature(
            CONFIGURED,
            { id: ID, timestamp: String(ts), signature: `v1,${sig}` },
            tampered
        );
        expect(result.ok).toBe(false);
        expect(result.reason).toBe('signature_mismatch');
    });

    it('يرفض توقيعاً بمفتاح خاطئ (طرف خارجي يزوّر الطلب)', async () => {
        const ts = nowSeconds();
        const sig = await signLikeSupabase(btoa('attacker-key'), ID, ts, BODY);
        const result = await verifyStandardWebhookSignature(
            CONFIGURED,
            { id: ID, timestamp: String(ts), signature: `v1,${sig}` },
            BODY
        );
        expect(result.ok).toBe(false);
        expect(result.reason).toBe('signature_mismatch');
    });

    it('يرفض طلباً قديماً خارج نافذة التسامح (إعادة إرسال)', async () => {
        const oldTs = nowSeconds() - 600;
        const sig = await signLikeSupabase(SECRET_B64, ID, oldTs, BODY);
        const result = await verifyStandardWebhookSignature(
            CONFIGURED,
            { id: ID, timestamp: String(oldTs), signature: `v1,${sig}` },
            BODY
        );
        expect(result.ok).toBe(false);
        expect(result.reason).toBe('timestamp_out_of_tolerance');
    });

    it('يرفض الرؤوس الناقصة والسرّ غير المضبوط بأسباب صريحة', async () => {
        const ts = String(nowSeconds());
        const cases = [
            [CONFIGURED, { id: null, timestamp: ts, signature: 'v1,x' }, 'missing_webhook_id'],
            [CONFIGURED, { id: ID, timestamp: null, signature: 'v1,x' }, 'missing_webhook_timestamp'],
            [CONFIGURED, { id: ID, timestamp: ts, signature: null }, 'missing_webhook_signature'],
            ['', { id: ID, timestamp: ts, signature: 'v1,x' }, 'missing_configured_secret'],
        ];
        for (const [secret, headers, expected] of cases) {
            const result = await verifyStandardWebhookSignature(secret, headers, BODY);
            expect(result.ok).toBe(false);
            expect(result.reason).toBe(expected);
        }
    });
});
