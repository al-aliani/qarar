/**
 * تدقيق أمني 2026-08-29: create-checkout/index.ts كان بلا أي اختبار تكامل حقيقي
 * (0 تغطية) — نفس الفجوة الموثَّقة في webhook-moyasar/__tests__/index.integration
 * .test.js: verifyOrderAmount هناك كانت مُختبَرة معزولة فقط، ودالة الـwebhook نفسها
 * لا يستدعيها أي اختبار، فتعطيل الحماية فعلياً كان يبقي 110/110 اختبار أخضر. نفس
 * المخاطرة هنا قبل هذا الملف: ثغرة 'free' tier (انظر أدناه) لم تكن ستُكتشف بأي
 * اختبار قائم لأن شيئاً لا يستدعي المعالج الحقيقي.
 *
 * الثغرة المُصلَحة: pricing.ts يعرّف 'free' كـTier صالح (price:0) موجود فقط لعرض
 * صفحة الأسعار/المقارنة على العميل (web/js/core/pricing.js PRICING_COMPARISON.free)
 * — ليست منتجاً يُشترى. قبل هذا الإصلاح، `getPackage('free')` كان يُعيد باقة صالحة
 * فيمرّ فحص `if (!pkg) return 400` بلا أي مانع، وبما أن price=0 فبلا أي addons أو
 * كوبون يصبح `total === 0`، فيدخل الكود فرع «كوبون خصم 100%» الذي يؤكّد الطلب
 * status='paid' مباشرة — طلب مدفوع بالكامل بلا أي دفع فعلي. الإصلاح: PAYABLE_TIERS
 * في index.ts يرفض أي tier ليس ضمن ('self','reviewed','full') — نفس قائمة قيد
 * orders_tier_check في migration 20260709120000_create_orders_payments.sql — قبل
 * الوصول لأي منطق حساب أو إنشاء صف orders.
 *
 * تنبيه مهم اكتُشف أثناء التحقيق: قيد orders_tier_check في القاعدة الحقيقية لم
 * يُوسَّع قط ليشمل 'free' (يبقى check (tier in ('self','reviewed','full')) —
 * لا ALTER لاحق يغيّره)، فإدراج صف بtier='free' كان سيفشل أصلاً بعطل قيد على
 * Postgres حقيقي (insertError ⇒ 500 order_creation_failed) لا أن يمنح paid. لكن
 * هذا حماية عرضية بحتة على مستوى القاعدة فقط — index.ts نفسه لم يكن يملك أي مانع
 * تطبيقي مستقل، فأي بيئة اختبار/محاكاة لا تفرض قيد القاعدة (كهذا الملف بالضبط،
 * أو أي تخفيف مستقبلي للقيد — سابقة موجودة فعلاً: 20260717010000_whatsapp_otp_
 * verification.sql وسّع قيداً مشابهاً "preferred_tier" ليشمل 'free' تحديداً) كانت
 * ستمنح status='paid' فوراً. هذا الملف يثبت أن index.ts نفسه يرفض الآن دون أي
 * اعتماد على قيد القاعدة.
 *
 * نمط الاختبار مطابق لـwebhook-moyasar: تمويه globalThis.Deno + التقاط المعالج
 * الحقيقي عبر Deno.serve، مع استخدام pricing.ts/catalog.ts/cors.ts/rateLimit.ts
 * الحقيقية (لا موك) — فقط createClient ومزوّدو الدفع الثلاثة (نداءات HTTP خارجية
 * فعلية) مُموَّهة.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const ANON_KEY = 'anon-key';
const SERVICE_ROLE_KEY = 'service-role-key';

let capturedHandler = null;
let authState = null; // { data: { user }, error }
let ordersState = null; // آخر صف orders أُنشئ (يُحدَّث بنفس مرجع الكائن كما تفعل القاعدة الحقيقية)
let orderIdSeq = 0;

function buildOrdersTable() {
    return {
        insert: (row) => ({
            select: () => ({
                single: async () => {
                    orderIdSeq += 1;
                    const id = `order-${orderIdSeq}`;
                    ordersState = { id, ...row };
                    return { data: { id }, error: null };
                },
            }),
        }),
        update: (fields) => ({
            eq: async (_col, id) => {
                if (ordersState && ordersState.id === id) ordersState = { ...ordersState, ...fields };
                return { data: null, error: null };
            },
        }),
    };
}

function buildRateLimitTable() {
    return {
        select: () => ({
            eq: () => ({
                eq: () => ({
                    gte: () => ({
                        order: async () => ({ data: [], error: null }), // دائماً تحت الحد
                    }),
                }),
            }),
        }),
        insert: async () => ({ error: null }),
    };
}

function buildStudiesTable() {
    return {
        select: () => ({
            eq: () => ({
                maybeSingle: async () => ({ data: { user_id: 'user-1' }, error: null }),
            }),
        }),
    };
}

function buildCouponsTable() {
    return {
        select: () => ({
            eq: () => ({
                maybeSingle: async () => ({ data: null, error: null }), // بلا كوبون مفعَّل في هذه الاختبارات
            }),
        }),
    };
}

function buildTable(table) {
    if (table === 'orders') return buildOrdersTable();
    if (table === 'rate_limit_events') return buildRateLimitTable();
    if (table === 'studies') return buildStudiesTable();
    if (table === 'coupons') return buildCouponsTable();
    throw new Error(`[test] جدول غير متوقَّع: ${table}`);
}

vi.mock('npm:@supabase/supabase-js@2', () => ({
    createClient: (_url, key) => {
        if (key === SERVICE_ROLE_KEY) return { from: (table) => buildTable(table) };
        return { auth: { getUser: async () => authState } };
    },
}));

const createMoyasarCheckout = vi.fn(async () => ({ checkoutUrl: 'https://moyasar.example/pay/abc', providerRef: 'inv_abc' }));
const createStripeCheckout = vi.fn(async () => ({ checkoutUrl: 'https://stripe.example/pay/abc', providerRef: 'cs_abc' }));
const createTamaraCheckout = vi.fn(async () => ({ checkoutUrl: 'https://tamara.example/pay/abc', providerRef: 'tam_abc' }));
vi.mock('../../_shared/providers/moyasar.ts', () => ({ createMoyasarCheckout: (...a) => createMoyasarCheckout(...a) }));
vi.mock('../../_shared/providers/stripe.ts', () => ({ createStripeCheckout: (...a) => createStripeCheckout(...a) }));
vi.mock('../../_shared/providers/tamara.ts', () => ({ createTamaraCheckout: (...a) => createTamaraCheckout(...a) }));

beforeEach(async () => {
    authState = { data: { user: { id: 'user-1' } }, error: null };
    ordersState = null;
    orderIdSeq = 0;
    capturedHandler = null;
    createMoyasarCheckout.mockClear();
    createStripeCheckout.mockClear();
    createTamaraCheckout.mockClear();

    globalThis.Deno = {
        serve: (handler) => { capturedHandler = handler; },
        env: {
            get: (key) => ({
                SUPABASE_URL: 'https://x.supabase.co',
                SUPABASE_ANON_KEY: ANON_KEY,
                SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
                MOYASAR_SECRET_KEY: 'sk_test_x',
                STRIPE_SECRET_KEY: 'sk_test_stripe',
                TAMARA_API_TOKEN: 'tamara_token',
                APP_ORIGIN: 'https://sahib.sa',
            }[key]),
        },
    };
    vi.resetModules();
    await import('../index.ts');
});

function makeRequest(body, { origin = 'https://sahib.sa' } = {}) {
    return {
        method: 'POST',
        json: async () => body,
        headers: new Map([['Authorization', 'Bearer valid-jwt'], ['origin', origin]]),
    };
}

describe("create-checkout/index.ts — تدقيق أمني 2026-08-29: رفض tier='free' (وأي باقة غير مدفوعة فعلاً)", () => {
    it("يرفض 400 invalid_tier لطلب tier='free' مباشر (تجاوز الواجهة تماماً)، ولا يُنشئ أي صف orders", async () => {
        const res = await capturedHandler(makeRequest({ tier: 'free', provider: 'moyasar' }));
        expect(res.status).toBe(400);
        expect((await res.json()).error).toBe('invalid_tier');
        expect(ordersState).toBeNull(); // لا صف orders أُنشئ إطلاقاً
        expect(createMoyasarCheckout).not.toHaveBeenCalled();
    });

    it("يرفض 400 invalid_tier حتى مع provider='bank_transfer' (فرع لا يمر بمزوّد دفع خارجي أصلاً)", async () => {
        const res = await capturedHandler(makeRequest({ tier: 'free', provider: 'bank_transfer' }));
        expect(res.status).toBe(400);
        expect((await res.json()).error).toBe('invalid_tier');
        expect(ordersState).toBeNull();
    });

    it("[إثبات الحارس] المنطق الأصلي — `if (!pkg) return 400` بلا فحص السعر، ثم `total === 0` ⇒ paid تلقائياً — كان سيسمح للثغرة", async () => {
        // استيراد pricing.ts الحقيقي (غير مموَّه) لإعادة إنتاج القيمة الفعلية التي كان
        // getPackage('free') يُعيدها قبل هذا الإصلاح، بدل افتراضها.
        const { getPackage } = await import('../../_shared/pricing.ts');
        const pkg = getPackage('free');

        // الشرط القديم الوحيد كان `if (!pkg) return 400` — بلا `PAYABLE_TIERS`/فحص سعر.
        const oldCheckWouldReject = !pkg;
        expect(oldCheckWouldReject).toBe(false); // العطل: pkg موجودة (price:0)، فالفحص القديم يمرّرها

        // بلا addons/كوبون، subtotal = pkg.price = 0 ⇒ total = 0، فيدخل فرع
        // "كوبون خصم 100%" (`if (total === 0) { status:'paid' }`) الذي يؤكّد الطلب
        // مدفوعاً بالكامل خادمياً — بلا أي مزوّد دفع استُدعي وبلا ريال واحد تحصَّل.
        const subtotal = pkg.price; // 0
        const total = Math.max(0, Math.round(subtotal * 100) / 100);
        expect(total).toBe(0); // العطل الثاني: يدخل فرع التأكيد التلقائي paid فوراً
    });
});

describe('create-checkout/index.ts — المسار الشرعي يبقى يعمل بعد الإصلاح', () => {
    it("tier='self' الحقيقية (299 ريال) عبر moyasar ⇒ يُنشئ orders pending بtier صحيح ويُعيد checkoutUrl حقيقياً (لا paid فوراً)", async () => {
        const res = await capturedHandler(makeRequest({ tier: 'self', provider: 'moyasar' }));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.checkoutUrl).toBe('https://moyasar.example/pay/abc');
        expect(body.orderId).toBeTruthy();
        expect(createMoyasarCheckout).toHaveBeenCalledTimes(1);
        expect(ordersState.tier).toBe('self');
        expect(ordersState.amount_sar).toBe(299);
        // لم يُؤكَّد "مدفوعاً" من create-checkout نفسها — الدفع الفعلي يصل لاحقاً عبر
        // webhook-moyasar بعد تأكيد المزوّد الحقيقي.
        expect(ordersState.status).toBe('pending');
        expect(ordersState.provider_ref).toBe('inv_abc');
    });

    it("tier='reviewed' عبر tamara ⇒ يمر بنجاح (باقة حقيقية أخرى غير 'self')", async () => {
        const res = await capturedHandler(makeRequest({ tier: 'reviewed', provider: 'tamara' }));
        expect(res.status).toBe(200);
        expect(ordersState.tier).toBe('reviewed');
        expect(createTamaraCheckout).toHaveBeenCalledTimes(1);
    });
});
