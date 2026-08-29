/**
 * تدقيق أمني 2026-08-29: create-checkout/index.ts كان بلا أي اختبار تكامل حقيقي
 * (0 تغطية) — نفس الفجوة الموثَّقة في webhook-moyasar/__tests__/index.integration
 * .test.js: verifyOrderAmount هناك كانت مُختبَرة معزولة فقط، ودالة الـwebhook نفسها
 * لا يستدعيها أي اختبار، فتعطيل الحماية فعلياً كان يبقي 110/110 اختبار أخضر. نفس
 * المخاطرة هنا قبل هذا الملف: ثغرة 'free' tier (انظر أدناه) لم تكن ستُكتشف بأي
 * اختبار قائم لأن شيئاً لا يستدعي المعالج الحقيقي.
 *
 * الثغرة المُصلَحة (دفعة أمنية سابقة، #51): pricing.ts يعرّف 'free' كـTier صالح
 * (price:0) موجود فقط لعرض صفحة الأسعار/المقارنة على العميل
 * (web/js/core/pricing.js PRICING_COMPARISON.free) — ليست منتجاً يُشترى. قبل ذلك
 * الإصلاح، `getPackage('free')` كان يُعيد باقة صالحة فيمرّ فحص `if (!pkg) return
 * 400` بلا أي مانع، وبما أن price=0 فبلا أي addons أو كوبون يصبح `total === 0`،
 * فيدخل الكود فرع «كوبون خصم 100%» الذي يؤكّد الطلب status='paid' مباشرة — طلب
 * مدفوع بالكامل بلا أي دفع فعلي. الإصلاح: PAYABLE_TIERS في index.ts يرفض أي tier
 * ليس ضمن ('self','reviewed','full') — نفس قائمة قيد orders_tier_check في
 * migration 20260709120000_create_orders_payments.sql — قبل الوصول لأي منطق حساب
 * أو إنشاء صف orders.
 *
 * دفعة إصلاح مهلات مزوّدي الدفع 2026-08-29 (#54): fetch لدى Moyasar/Stripe/
 * Tamara (supabase/functions/_shared/providers/*.ts) كان بلا أي مهلة — تعليق شبكي
 * حقيقي هناك (لا استجابة، لا رفض) كان يُعلّق create-checkout نفسه للأبد، تاركاً
 * العميل أمام واجهة دفع متجمّدة بلا أي ملاحظة. الوصف السفلي يحقن رفض AbortError/
 * TimeoutError من طبقة المزوّد (بدل انتظار 15 ثانية حقيقية لإطلاق
 * AbortSignal.timeout فعلياً — تلك المهلة آلية منصّة موثوقة، والتوصيل الفعلي
 * لـsignal مُختبَر توصيلاً في providers/__tests__/*.test.js) ليثبت أن create-checkout
 * يتعامل مع هذا الرفض بوضوح: تحديث الطلب لحالة failed، تنبيه عبر sendAlert،
 * واستجابة 502 واضحة — لا تعليق أبدي ولا استثناء غير مُعالَج يهرب من المعالج.
 *
 * بلوكر مراقبة 2026-08-29 (دفعة منفصلة، آخر مجموعة اختبارات أدناه): create-checkout
 * هي الدالة المسؤولة فعلياً عن إنشاء صف orders المدفوع — كانت الوحيدة بين دوال
 * الدفع (بخلاف webhook-moyasar/stripe/tamara) التي تكتفي بـconsole.error بلا أي
 * أثر يصل لأي مراقبة إنتاجية عند فشل *إدراج* الطلب تحديداً (فشل إنشاء جلسة
 * المزوّد نفسه صار مُغطّى فعلياً ضمن دفعة #54 أعلاه — مجموعة الاختبارات الأخيرة هنا
 * تغطي فقط فجوة الإدراج المتبقية، عبر حقن فشل قابل للتحكم عبر nextInsertError).
 *
 * نمط الاختبار مطابق لـwebhook-moyasar: تمويه globalThis.Deno + التقاط المعالج
 * الحقيقي عبر Deno.serve، مع استخدام pricing.ts/catalog.ts/cors.ts/rateLimit.ts
 * الحقيقية (لا موك) — فقط createClient ومزوّدو الدفع الثلاثة (نداءات HTTP خارجية
 * فعلية) وsendAlert (تنبيه خارجي حقيقي أيضاً) مُموَّهة.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const ANON_KEY = 'anon-key';
const SERVICE_ROLE_KEY = 'service-role-key';

let capturedHandler = null;
let authState = null; // { data: { user }, error }
let ordersState = null; // آخر صف orders أُنشئ (يُحدَّث بنفس مرجع الكائن كما تفعل القاعدة الحقيقية)
let orderIdSeq = 0;
let nextInsertError = null; // حقن فشل إدراج لاختبار واحد فقط — يُستهلك ويُعاد null تلقائياً

function buildOrdersTable() {
    return {
        insert: (row) => ({
            select: () => ({
                single: async () => {
                    if (nextInsertError) {
                        const err = nextInsertError;
                        nextInsertError = null;
                        return { data: null, error: err };
                    }
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
    if (table === 'studies') return buildStudiesTable();
    if (table === 'coupons') return buildCouponsTable();
    throw new Error(`[test] جدول غير متوقَّع: ${table}`);
}

// تدقيق 2026-08-29 (سباق تزامن حدّ المعدّل): checkRateLimit صار يستدعي RPC ذرّي
// واحد (check_and_record_rate_limit) بدل .from('rate_limit_events') مباشرة —
// كل اختبارات هذا الملف تفترض "دائماً تحت الحد" أصلاً (لا تختبر رفض 429)، فالموك
// يُرجع allowed:true ثابتاً، مطابقاً لسلوك buildRateLimitTable القديم تماماً.
function buildRpc(fnName) {
    if (fnName !== 'check_and_record_rate_limit') throw new Error(`[test] rpc غير متوقَّع: ${fnName}`);
    return { single: async () => ({ data: { allowed: true, retry_after_seconds: null }, error: null }) };
}

vi.mock('npm:@supabase/supabase-js@2', () => ({
    createClient: (_url, key) => {
        if (key === SERVICE_ROLE_KEY) return { from: (table) => buildTable(table), rpc: (fnName) => buildRpc(fnName) };
        return { auth: { getUser: async () => authState } };
    },
}));

const createMoyasarCheckout = vi.fn(async () => ({ checkoutUrl: 'https://moyasar.example/pay/abc', providerRef: 'inv_abc' }));
const createStripeCheckout = vi.fn(async () => ({ checkoutUrl: 'https://stripe.example/pay/abc', providerRef: 'cs_abc' }));
const createTamaraCheckout = vi.fn(async () => ({ checkoutUrl: 'https://tamara.example/pay/abc', providerRef: 'tam_abc' }));
vi.mock('../../_shared/providers/moyasar.ts', () => ({ createMoyasarCheckout: (...a) => createMoyasarCheckout(...a) }));
vi.mock('../../_shared/providers/stripe.ts', () => ({ createStripeCheckout: (...a) => createStripeCheckout(...a) }));
vi.mock('../../_shared/providers/tamara.ts', () => ({ createTamaraCheckout: (...a) => createTamaraCheckout(...a) }));

const sendAlertMock = vi.fn();
vi.mock('../../_shared/alerting.ts', () => ({ sendAlert: (...a) => sendAlertMock(...a) }));

function makeRequest(body, { origin = 'https://sahib.sa' } = {}) {
    return {
        method: 'POST',
        json: async () => body,
        headers: new Map([['Authorization', 'Bearer valid-jwt'], ['origin', origin]]),
    };
}

beforeEach(async () => {
    authState = { data: { user: { id: 'user-1' } }, error: null };
    ordersState = null;
    orderIdSeq = 0;
    nextInsertError = null;
    capturedHandler = null;
    createMoyasarCheckout.mockClear();
    createStripeCheckout.mockClear();
    createTamaraCheckout.mockClear();
    sendAlertMock.mockClear();

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
                SENTRY_DSN: 'https://public@o1.ingest.sentry.io/1',
            }[key]),
        },
    };
    vi.resetModules();
    await import('../index.ts');
});

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

describe('create-checkout/index.ts — تعليق/مهلة مزوّد الدفع لا يُعلّق الدالة للأبد', () => {
    it('AbortError/TimeoutError من Moyasar ⇒ 502 واضح، الطلب يتحوّل failed، وتنبيه sendAlert بنوع provider_timeout', async () => {
        createMoyasarCheckout.mockRejectedValueOnce(new DOMException('signal timed out', 'TimeoutError'));

        const res = await capturedHandler(makeRequest({ tier: 'self', provider: 'moyasar' }));
        const body = await res.json();

        expect(res.status).toBe(502);
        expect(body).toEqual({ error: 'checkout_creation_failed' });
        expect(ordersState.status).toBe('failed');
        expect(sendAlertMock).toHaveBeenCalledTimes(1);
        const [, ctx] = sendAlertMock.mock.calls[0];
        expect(ctx.tags.kind).toBe('provider_timeout');
        expect(ctx.tags.source).toBe('create-checkout');
        expect(ctx.message).toContain('timeout=true');
    });

    it('فشل عادي (غير مهلة) من Stripe ⇒ نفس استجابة 502 الواضحة، لكن تنبيه sendAlert بنوع provider_checkout_failed لا provider_timeout', async () => {
        createStripeCheckout.mockRejectedValueOnce(new Error('Stripe checkout session creation failed (400): bad request'));

        const res = await capturedHandler(makeRequest({ tier: 'self', provider: 'stripe' }));
        const body = await res.json();

        expect(res.status).toBe(502);
        expect(body).toEqual({ error: 'checkout_creation_failed' });
        expect(ordersState.status).toBe('failed');
        const [, ctx] = sendAlertMock.mock.calls[0];
        expect(ctx.tags.kind).toBe('provider_checkout_failed');
    });

    it('[إثبات الحارس] رفض المزوّد يُعاد كاستجابة Response منظّمة لا كاستثناء يهرب من المعالج (العطل الأصلي: بلا try/catch حول استدعاء المزوّد كان يُسقط الطلب كرفض غير مُعالَج)', async () => {
        createMoyasarCheckout.mockRejectedValueOnce(new DOMException('signal timed out', 'TimeoutError'));
        await expect(capturedHandler(makeRequest({ tier: 'self', provider: 'moyasar' }))).resolves.toBeInstanceOf(Response);
    });

    it('نجاح عادي (بلا تعليق) يبقى يعمل كالمعتاد بعد إضافة المهلة — checkoutUrl وorderId يُعادان، لا تنبيه ولا فشل', async () => {
        const res = await capturedHandler(makeRequest({ tier: 'self', provider: 'tamara' }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.checkoutUrl).toBe('https://tamara.example/pay/abc');
        expect(body.orderId).toBeTruthy();
        expect(ordersState.status).not.toBe('failed');
        expect(sendAlertMock).not.toHaveBeenCalled();
    });
});

describe('create-checkout/index.ts — تنبيه المراقبة عند فشل إدراج صف orders (بلوكر مراقبة 2026-08-29)', () => {
    it('فشل إدراج صف orders ⇒ sendAlert يُستدعى بسياق واضح، مع بقاء استجابة order_creation_failed/500 كما كانت', async () => {
        nextInsertError = { message: 'insert failed: db down' };

        const res = await capturedHandler(makeRequest({ tier: 'self', provider: 'moyasar' }));

        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({ error: 'order_creation_failed' });
        expect(ordersState).toBeNull();
        expect(sendAlertMock).toHaveBeenCalledTimes(1);
        const [dsn, ctx] = sendAlertMock.mock.calls[0];
        expect(dsn).toBe('https://public@o1.ingest.sentry.io/1');
        expect(ctx.level).toBe('error');
        expect(ctx.tags).toEqual({ source: 'create-checkout', kind: 'order_insert_failed' });
        expect(ctx.message).toContain('insert failed: db down');
    });

    it('نجاح كامل ⇒ لا يُستدعى sendAlert إطلاقاً', async () => {
        const res = await capturedHandler(makeRequest({ tier: 'self', provider: 'moyasar' }));

        expect(res.status).toBe(200);
        expect(sendAlertMock).not.toHaveBeenCalled();
    });
});
