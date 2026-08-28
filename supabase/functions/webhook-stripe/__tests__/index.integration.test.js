/**
 * دفعة 2 من خطة إغلاق فجوات الطبقات الـ16: نفس فجوة التغطية المُثبَتة في
 * webhook-moyasar (انظر تعليق ذلك الملف) — يستدعي المعالج الحقيقي، يستخدم
 * verifyStripeSignature وverifyOrderAmount الحقيقيين (لا موك)، يموّه فقط
 * createClient/sendAlert/insertNotification.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hmacSha256Hex } from '../../_shared/webhookVerify.ts';

const SECRET = 'whsec_test_stripe';
let capturedHandler = null;
let dbState = null;

function buildOrdersTable() {
    return {
        // Stripe: update(fields).eq('provider',...).eq('provider_ref',...).eq('status', prevStatus).select() —
        // 3 مستويات eq قبل select (بخلاف moyasar/tamara ذات البنية المتطابقة لكن سطراً واحداً).
        update: (fields) => ({
            eq: () => ({
                eq: () => ({
                    eq: (_col, expectedStatus) => ({
                        select: async () => {
                            if (!dbState || dbState.status !== expectedStatus) return { data: [], error: null };
                            dbState = { ...dbState, ...fields };
                            return { data: [{ id: 'order-1', user_id: 'user-1', study_id: 'study-1' }], error: null };
                        },
                    }),
                }),
            }),
            in: () => ({ eq: () => ({ eq: async () => ({ data: null, error: null }) }) }),
        }),
        select: () => ({
            eq: () => ({
                eq: () => ({
                    maybeSingle: async () => ({ data: dbState ? { amount_sar: dbState.amount_sar } : null }),
                }),
            }),
        }),
    };
}

vi.mock('npm:@supabase/supabase-js@2', () => ({
    createClient: () => ({ from: () => buildOrdersTable() }),
}));
vi.mock('../../_shared/alerting.ts', () => ({ sendAlert: vi.fn() }));
vi.mock('../../_shared/notify.ts', () => ({ insertNotification: vi.fn() }));

beforeEach(async () => {
    dbState = { amount_sar: 1999, status: 'pending' };
    capturedHandler = null;
    globalThis.Deno = {
        serve: (handler) => { capturedHandler = handler; },
        env: { get: (key) => (key === 'STRIPE_WEBHOOK_SECRET' ? SECRET : key === 'SUPABASE_URL' ? 'https://x.supabase.co' : key === 'SUPABASE_SERVICE_ROLE_KEY' ? 'x' : undefined) },
    };
    vi.resetModules();
    await import('../index.ts');
});

async function makeSignedRequest(eventObj) {
    const rawBody = JSON.stringify(eventObj);
    const ts = Math.floor(Date.now() / 1000);
    const sig = await hmacSha256Hex(SECRET, `${ts}.${rawBody}`);
    return {
        method: 'POST',
        text: async () => rawBody,
        headers: { get: (h) => (h === 'Stripe-Signature' ? `t=${ts},v1=${sig}` : null) },
    };
}

describe('webhook-stripe/index.ts — تكامل حقيقي لفحص المبلغ', () => {
    it('يرفض 400 amount_mismatch حين يؤكد Stripe مبلغاً أقل من المستحق (amount_total)', async () => {
        const req = await makeSignedRequest({
            id: 'evt_1', type: 'checkout.session.completed',
            data: { object: { id: 'cs_attack', payment_status: 'paid', amount_total: 100 } },
        });
        const res = await capturedHandler(req);
        expect(res.status).toBe(400);
        expect(await res.text()).toBe('amount_mismatch');
        expect(dbState.status).toBe('pending');
    });

    it('يمنح status=paid فعلياً حين يطابق amount_total المستحق تماماً', async () => {
        const req = await makeSignedRequest({
            id: 'evt_2', type: 'checkout.session.completed',
            data: { object: { id: 'cs_ok', payment_status: 'paid', amount_total: 199900 } },
        });
        const res = await capturedHandler(req);
        expect(res.status).toBe(200);
        expect(dbState.status).toBe('paid');
    });

    it('[إثبات الحارس] توقيع غير صحيح يُرفَض قبل فحص المبلغ أصلاً', async () => {
        const rawBody = JSON.stringify({ id: 'evt_3', type: 'checkout.session.completed', data: { object: { id: 'cs_ok', payment_status: 'paid', amount_total: 199900 } } });
        const req = { method: 'POST', text: async () => rawBody, headers: { get: (h) => (h === 'Stripe-Signature' ? 't=1,v1=deadbeef' : null) } };
        const res = await capturedHandler(req);
        expect(res.status).toBe(401);
        expect(dbState.status).toBe('pending');
    });
});
