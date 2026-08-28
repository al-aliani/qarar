/**
 * دفعة 2 من خطة إغلاق فجوات الطبقات الـ16: فجوة تغطية حقيقية اكتشفتها مراجعة
 * عدائية مستقلة — verifyOrderAmount مُختبَرة معزولة فقط (amountGuard.test.js)،
 * لا يوجد أي اختبار يستدعي webhook-moyasar/index.ts نفسه فعلياً، فحقن عطل
 * حقيقي (تعليق استدعاء الفحص كلياً من الـwebhook) لا يُكتشَف بأي اختبار قائم —
 * أُثبت هذا عملياً أثناء المراجعة (110/110 اختبار بقيت خضراء رغم تعطيل الحماية).
 *
 * هذا الملف يستدعي المعالج الحقيقي عبر تمويه Deno.serve/Deno.env (Deno.serve
 * ينفَّذ كأثر جانبي وقت الاستيراد، لا نُهيّئ globalThis.Deno إلا بعده)،
 * ويستخدم verifyMoyasarSecretToken وverifyOrderAmount الحقيقيين (لا موك) —
 * فقط createClient/sendAlert/insertNotification مُموَّهة.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const SECRET = 'test-moyasar-secret';
let capturedHandler = null;
let dbState = null; // { amount_sar, status } لصف orders المطابق provider/provider_ref

function buildOrdersTable() {
    return {
        // .update(fields).eq('provider',...).eq('provider_ref',...).eq('status', prevStatus).select() —
        // مسار التحديث الرئيسي (منح/رفض الوصول).
        // .update({review_status}).in('id',[...]).eq(...).eq(...) — مسار طابور المراجعين، سلسلة مختلفة
        // تماماً على نفس الجدول. الدالة المُرجَعة من update() تدعم الاثنين معاً.
        update: (fields) => ({
            eq: () => ({
                eq: () => ({
                    eq: (_col, expectedStatus) => ({
                        select: async () => {
                            if (!dbState || dbState.status !== expectedStatus) {
                                return { data: [], error: null };
                            }
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
    createClient: () => ({
        from: (table) => buildOrdersTable(table),
    }),
}));
vi.mock('../../_shared/alerting.ts', () => ({ sendAlert: vi.fn() }));
vi.mock('../../_shared/notify.ts', () => ({ insertNotification: vi.fn() }));

beforeEach(async () => {
    dbState = { amount_sar: 1999, status: 'pending' };
    capturedHandler = null;
    globalThis.Deno = {
        serve: (handler) => { capturedHandler = handler; },
        env: { get: (key) => (key === 'MOYASAR_WEBHOOK_SECRET' ? SECRET : key === 'SUPABASE_URL' ? 'https://x.supabase.co' : key === 'SUPABASE_SERVICE_ROLE_KEY' ? 'x' : undefined) },
    };
    vi.resetModules();
    await import('../index.ts');
});

function makeRequest(body) {
    return { method: 'POST', json: async () => body, headers: new Map() };
}

describe('webhook-moyasar/index.ts — تكامل حقيقي لفحص المبلغ (لا اختبار معزول)', () => {
    it('يرفض 400 amount_mismatch حين يؤكد Moyasar مبلغاً أقل من المستحق فعلياً (1999 مطلوب مقابل 1 مؤكَّد)', async () => {
        const res = await capturedHandler(makeRequest({
            type: 'invoice_paid',
            secret_token: SECRET,
            data: { id: 'inv_attack', status: 'paid', amount: 100 }, // 1.00 ريال بالهللة
        }));
        expect(res.status).toBe(400);
        expect(await res.text()).toBe('amount_mismatch');
        expect(dbState.status).toBe('pending'); // لم يُمنح الوصول
    });

    it('يمنح status=paid فعلياً حين يطابق المبلغ المؤكَّد المستحق تماماً', async () => {
        const res = await capturedHandler(makeRequest({
            type: 'invoice_paid',
            secret_token: SECRET,
            data: { id: 'inv_ok', status: 'paid', amount: 199900 }, // 1999.00 ريال بالهللة
        }));
        expect(res.status).toBe(200);
        expect(dbState.status).toBe('paid');
    });

    it('[إثبات الحارس] توقيع غير صحيح يُرفَض قبل الوصول لفحص المبلغ أصلاً (البوابة الأولى تبقى فعّالة)', async () => {
        const res = await capturedHandler(makeRequest({
            type: 'invoice_paid',
            secret_token: 'wrong-secret',
            data: { id: 'inv_ok', status: 'paid', amount: 199900 },
        }));
        expect(res.status).toBe(401);
        expect(dbState.status).toBe('pending');
    });
});
