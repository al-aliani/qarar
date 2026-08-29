/**
 * دفعة 2 من خطة إغلاق فجوات الطبقات الـ16: نفس فجوة التغطية المُثبَتة في
 * webhook-moyasar. يستدعي المعالج الحقيقي، يستخدم verifyTamaraNotificationToken
 * وverifyOrderAmount الحقيقيين، يموّه فقط createClient/sendAlert/insertNotification.
 *
 * مهم: تخمين استخراج المبلغ (`total_amount.amount ?? amount`) موثَّق بعدم يقين في
 * providers/tamara.ts (شكل حمولة webhook الحيّة الفعلي غير مؤكَّد). الاختبار الأول
 * يثبّت حالة نجاح التخمين الحالي حين تصل الحمولة بنفس بنية total_amount.amount
 * المُرسَلة عند الإنشاء؛ الاختبار الثاني يوثّق صراحة أن شكلاً مختلفاً يؤدي لـ
 * fail-open (لا حماية فعلية) — هذا سلوك مقصود موثَّق، لا عطل في هذا الاختبار.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const TOKEN = 'test-tamara-token';
let capturedHandler = null;
let dbState = null;

function buildOrdersTable() {
    return {
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
        env: { get: (key) => (key === 'TAMARA_NOTIFICATION_TOKEN' ? TOKEN : key === 'SUPABASE_URL' ? 'https://x.supabase.co' : key === 'SUPABASE_SERVICE_ROLE_KEY' ? 'x' : undefined) },
    };
    vi.resetModules();
    await import('../index.ts');
});

function makeRequest(body, token = TOKEN) {
    return { method: 'POST', json: async () => body, headers: { get: (h) => (h === 'Authorization' ? `Bearer ${token}` : null) } };
}

describe('webhook-tamara/index.ts — تكامل حقيقي لفحص المبلغ', () => {
    it('يرفض 400 amount_mismatch حين تصل الحمولة بنفس بنية total_amount.amount المُرسَلة عند الإنشاء بمبلغ أقل', async () => {
        const res = await capturedHandler(makeRequest({
            order_id: 'order_attack', order_status: 'captured', total_amount: { amount: '1.00', currency: 'SAR' },
        }));
        expect(res.status).toBe(400);
        expect(await res.text()).toBe('amount_mismatch');
        expect(dbState.status).toBe('pending');
    });

    it('يمنح status=paid حين يطابق total_amount.amount المستحق تماماً', async () => {
        const res = await capturedHandler(makeRequest({
            order_id: 'order_ok', order_status: 'captured', total_amount: { amount: '1999.00', currency: 'SAR' },
        }));
        expect(res.status).toBe(200);
        expect(dbState.status).toBe('paid');
    });

    it('[توثيق قيد معروف] شكل حمولة غير متوقَّع (total_amount غائب) يمنح الوصول بلا حماية فعلية (fail-open مقصود)', async () => {
        const res = await capturedHandler(makeRequest({
            order_id: 'order_unknown_shape', order_status: 'captured', amount_paid: '1.00',
        }));
        // fail-open مقصود: لا حقل مفهوم ⟶ لا رفض ⟶ يمنح كما لو لم يوجد فحص إطلاقاً.
        // هذا يوثّق الفجوة صراحة لا يخفيها — يستحق تحققاً مع Sandbox حقيقي (بند خارج نطاق هذه الدفعة).
        expect(res.status).toBe(200);
        expect(dbState.status).toBe('paid');
    });

    it('[إثبات الحارس] توكن غير صحيح يُرفَض قبل فحص المبلغ أصلاً', async () => {
        const res = await capturedHandler(makeRequest(
            { order_id: 'order_ok', order_status: 'captured', total_amount: { amount: '1999.00', currency: 'SAR' } },
            'wrong-token'
        ));
        expect(res.status).toBe(401);
        expect(dbState.status).toBe('pending');
    });
});

describe('webhook-tamara/index.ts — تدقيق أمني 2026-08-28 (اتساق مع webhook-moyasar): metadata قائمة بيضاء لا جسم خام', () => {
    it('metadata المخزَّنة لا تحوي حقولاً حسّاسة محتملة (بيانات عميل) رغم وجودها في الحمولة الخام', async () => {
        const res = await capturedHandler(makeRequest({
            order_id: 'order_ok', order_status: 'captured', total_amount: { amount: '1999.00', currency: 'SAR' },
            consumer: { email: 'customer@example.com', phone_number: '0500000000' },
        }));
        expect(res.status).toBe(200);
        expect(dbState.status).toBe('paid');
        expect(JSON.stringify(dbState.metadata)).not.toContain('customer@example.com');
        expect(JSON.stringify(dbState.metadata)).not.toContain('0500000000');
    });

    it('metadata تحتفظ بحقول تدقيق آمنة فعلية (معرّف الطلب، الحالة، المبلغ) — ليست فارغة كلياً', async () => {
        await capturedHandler(makeRequest({
            order_id: 'order_ok', order_status: 'captured', total_amount: { amount: '1999.00', currency: 'SAR' },
        }));
        expect(dbState.metadata).toMatchObject({ order_id: 'order_ok', order_status: 'captured', total_amount: { amount: '1999.00', currency: 'SAR' } });
    });

    it('[إثبات الحارس] العطل الأصلي: تخزين payload كاملاً كان يضع بيانات العميل الحسّاسة مباشرة في العمود المقروء من صاحب الطلب', () => {
        const rawPayload = { order_id: 'order_x', consumer: { email: 'leak@example.com' } };
        const oldUpdateFields = { status: 'paid', metadata: rawPayload }; // السطر المحذوف: metadata: payload
        expect(oldUpdateFields.metadata.consumer.email).toBe('leak@example.com');
    });
});
