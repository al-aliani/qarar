/**
 * Edge Function: create-checkout
 * تُستدعى من العميل (supabase.functions.invoke) بعد اختيار المستخدم باقة ومزوّد دفع.
 * أمني: السعر الفعلي المُرسَل لمزوّد الدفع يُشتقّ حصراً من _shared/pricing.ts —
 * أي سعر يصل ضمن جسم الطلب من العميل (إن وُجد) يُتجاهَل تماماً؛ هذا يمنع أي تلاعب
 * DevTools بتعديل المبلغ قبل إرساله.
 *
 * تدفق الطلب:
 * 1) تحقق من هوية المستخدم عبر JWT في رأس Authorization (لا نثق بأي user_id
 *    مُرسَل في جسم الطلب — نشتقّه من الجلسة نفسها فقط).
 * 2) تحقق tier ضد الجدول الخادمي المعتمد.
 * 3) إنشاء صف orders بحالة pending (عبر مفتاح service_role — يتجاوز RLS عمداً،
 *    هذا هو المسار الوحيد المسموح للكتابة في هذا الجدول).
 * 4) استدعاء مزوّد الدفع المختار لإنشاء جلسة/فاتورة، وربط orders.provider_ref بها.
 * 5) إعادة رابط الدفع للعميل للتوجيه إليه (window.location.href = checkoutUrl).
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getPackage } from '../_shared/pricing.ts';
import { createMoyasarCheckout } from '../_shared/providers/moyasar.ts';
import { createStripeCheckout } from '../_shared/providers/stripe.ts';
import { createTamaraCheckout } from '../_shared/providers/tamara.ts';
import { selectedAddons } from '../_shared/catalog.ts';
import { corsHeaders, handlePreflight } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rateLimit.ts';
import { sendAlert } from '../_shared/alerting.ts';

// تدقيق أمني 2026-08-21: بلا حد سابقاً — أي جلسة عادية تقدر تستنزف حصة Moyasar/
// Stripe/Tamara الحيّة بحلقة استدعاءات (كل نداء ناجح ينشئ فاتورة/جلسة حقيقية على
// حساب المالك التجاري). 10 طلبات كل 10 دقائق يكفي بسخاء لأي استخدام مشروع حقيقي.
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_SECONDS = 600;

// تدقيق أمني 2026-08-29: 'free' موجودة في _shared/pricing.ts (وTier يقبلها) لغرض
// مختلف تماماً — تمثيل الباقة المجانية في شاشات العرض/المقارنة على العميل (انظر
// web/js/core/pricing.js PRICING_COMPARISON.free)، وليست منتجاً يُشترى عبر هذه
// الدالة. getPackage('free') كان يُعيد باقة صالحة (price:0) فتمرّ فحص `if (!pkg)`
// بلا أي مانع، وينتهي الأمر عند فرع `total === 0` أدناه الذي يؤكّد الطلب paid
// مباشرة (مصمَّم أصلاً لكوبون خصم 100% على باقة حقيقية) — أي طلب paid بلا أي دفع
// فعلي. القائمة أدناه يجب أن تطابق حرفياً قيد orders_tier_check في migration
// 20260709120000_create_orders_payments.sql (لم يُوسَّع لاحقاً ليشمل 'free' —
// هذا الفحص التطبيقي دفاع مستقل، لا اعتماد على قيد القاعدة وحدها مستقبلاً).
const PAYABLE_TIERS = new Set(['self', 'reviewed', 'full']);

function jsonResponse(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(req) },
  });
}

Deno.serve(async (req: Request) => {
  const sentryDsn = Deno.env.get('SENTRY_DSN');
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonResponse(req, { error: 'method_not_allowed' }, 405);

  // أمني/تشغيلي: منه تُبنى روابط العودة بعد الدفع لدى Moyasar/Stripe/Tamara. الافتراضي
  // الصامت 'http://localhost:5173' كان بلوكر إطلاق: إن نُسي سرّ APP_ORIGIN في بيئة
  // الإنتاج، يُعاد توجيه كل عميل دفع فعلاً إلى localhost (صفحة ميتة) فيظن أنه دفع بلا
  // نتيجة. البديل الآمن: اشتقاق الأصل من ترويسة Origin للطلب — يضبطها المتصفح ولا يمكن
  // لسكربت الصفحة تزويرها عبر الأصول، فتعكس موقع الاستدعاء الحقيقي؛ ورابط العودة يحمل
  // فقط ?order=<id> لصفحة حالة (الفتح الفعلي عبر webhook موقّع)، فلا خطر إعادة توجيه.
  const configuredOrigin = Deno.env.get('APP_ORIGIN');
  const APP_ORIGIN = configuredOrigin || req.headers.get('origin') || 'http://localhost:5173';
  if (!configuredOrigin) {
    console.warn('[create-checkout] APP_ORIGIN غير مضبوط — اشتقاق الأصل من ترويسة الطلب:', APP_ORIGIN);
  }

  const authHeader = req.headers.get('Authorization') || '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) return jsonResponse(req, { error: 'missing_auth' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // عميل بصلاحية المستخدم نفسه (anon key + JWT) — للتحقق من هويته فقط، لا للكتابة.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(jwt);
  if (userError || !userData?.user) return jsonResponse(req, { error: 'invalid_session' }, 401);
  const userId = userData.user.id;

  let body: { tier?: string; studyId?: string; provider?: string; addons?: string[]; coupon?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(req, { error: 'invalid_json_body' }, 400);
  }

  const pkg = getPackage(body.tier || '');
  if (!pkg || !PAYABLE_TIERS.has(pkg.id)) return jsonResponse(req, { error: 'invalid_tier' }, 400);

  const provider = body.provider === 'stripe' ? 'stripe' : body.provider === 'moyasar' ? 'moyasar' : body.provider === 'tamara' ? 'tamara' : body.provider === 'bank_transfer' ? 'bank_transfer' : null;
  if (!provider) return jsonResponse(req, { error: 'invalid_provider' }, 400);

  // عميل بصلاحية service_role — الوحيد المسموح له بالكتابة في orders (RLS لا يسمح
  // لأي دور آخر بذلك إطلاقاً، انظر migration الخاص بهذا الجدول).
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const rateLimit = await checkRateLimit(adminClient, userId, 'create-checkout', RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_SECONDS);
  if (!rateLimit.ok) {
    return jsonResponse(req, { error: 'rate_limited', retryAfterSeconds: rateLimit.retryAfterSeconds }, 429);
  }

  // أمني: studyId يصل من جسم الطلب بلا أي تحقق ملكية — دون هذا الفحص يستطيع أي
  // مستخدم دفع (بماله الخاص) لباقة 'reviewed' مستهدفاً دراسة شخص آخر، فيمنح ذلك
  // أي مراجع يدّعي الطلب قراءة كاملة لبياناتها المالية عبر studies_select_reviewer
  // (migration 20260713000000_reviewer_portal.sql) — الدراسة لم توافق عليه أصلاً.
  if (body.studyId) {
    const { data: study, error: studyError } = await adminClient
      .from('studies')
      .select('user_id')
      .eq('id', body.studyId)
      .maybeSingle();
    if (studyError || !study || study.user_id !== userId) {
      return jsonResponse(req, { error: 'study_not_owned' }, 403);
    }
  }
  const addons = selectedAddons(body.addons, pkg.id);
  const subtotal = pkg.price + addons.reduce((sum, item) => sum + item.price, 0);
  const couponCode = String(body.coupon || '').trim().toUpperCase();
  let discountPercent = 0;
  if (couponCode) {
    const { data: coupon } = await adminClient.from('coupons').select('discount_percent,active,expires_at,max_uses,used_count').eq('code', couponCode).maybeSingle();
    const valid = coupon?.active && (!coupon.expires_at || new Date(coupon.expires_at) > new Date()) && (!coupon.max_uses || coupon.used_count < coupon.max_uses);
    if (valid) discountPercent = Number(coupon.discount_percent || 0);
  }
  const discount = Math.round(subtotal * discountPercent) / 100;
  // الأسعار في pricing.ts شاملة ضريبة القيمة المضافة (15%): المبلغ المعلن هو المحصّل
  // بالضبط. نستخرج مكوّن الضريبة من داخل الإجمالي (VAT-inclusive) بدل إضافته فوق السعر
  // — فالعميل يدفع 299/1999/4999 كما هو معلن، والضريبة مبيّنة للفاتورة فقط.
  const total = Math.max(0, Math.round((subtotal - discount) * 100) / 100);
  const vat = Math.round((total - total / 1.15) * 100) / 100;

  const { data: orderRow, error: insertError } = await adminClient
    .from('orders')
    .insert({
      user_id: userId,
      study_id: body.studyId || null,
      tier: pkg.id,
      amount_sar: total,
      subtotal_sar: subtotal,
      discount_sar: discount,
      vat_sar: vat,
      total_sar: total,
      amount_due_sar: total,
      coupon_code: discountPercent ? couponCode : null,
      items: [{ id: pkg.id, name: pkg.name, price: pkg.price }, ...addons],
      provider,
      status: 'pending',
    })
    .select('id')
    .single();

  if (insertError || !orderRow) {
    // هذه الدالة هي المسؤولة الفعلية عن إنشاء الطلب المدفوع أصلاً — فشل هنا سابقاً كان
    // يُسجَّل بconsole.error فقط بخلاف webhook-moyasar/stripe/tamara التي تُنبِّه فعلياً.
    console.error('[create-checkout] insert order failed:', insertError);
    await sendAlert(sentryDsn, {
      message: `[create-checkout] order insert failed (user_id=${userId}, tier=${pkg.id}): ${insertError?.message || insertError}`,
      level: 'error',
      tags: { source: 'create-checkout', kind: 'order_insert_failed' },
    });
    return jsonResponse(req, { error: 'order_creation_failed' }, 500);
  }

  const orderId = orderRow.id as string;

  // كوبون خصم 100%: total=0 — يجب أن يُؤكَّد الطلب تلقائياً بصرف النظر عن provider
  // المُرسَل (بما فيه bank_transfer)، فلا حاجة لأي قناة تحصيل عند مبلغ صفري. هذا
  // الفحص يسبق فرع bank_transfer أدناه عمداً (تدقيق 2026-08-31): كان مرتَّباً بعده
  // سابقاً، فأي كوبون 100% مع bank_transfer (القناة الوحيدة الحيّة فعلياً) كان يرجع
  // من فرع bank_transfer قبل الوصول هنا — الطلب يبقى pending للأبد ويُطلب من العميل
  // تحويل 0 ريال فعلياً. مزوّدو الدفع الخارجيون (Moyasar/Stripe/Tamara) أيضاً يرفضون
  // مبلغاً صفرياً، فلا شيء فعلياً للتحصيل هنا بأي حال.
  if (total === 0) {
    await adminClient.from('orders').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', orderId);
    return jsonResponse(req, { orderId, freeViaCoupon: true, amount: 0 });
  }

  // تحويل بنكي: قناة يدوية — الطلب أُنشئ بحالة pending أعلاه، ولا مزوّد دفع خارجي.
  // نُرجع رقم الطلب والمبلغ فقط ليعرض العميل بيانات الحساب ويحوّل، ثم يؤكّده الأدمن
  // يدوياً (admin_confirm_bank_transfer) بعد وصول الحوالة فتصبح الحالة paid ويُفتح القفل.
  if (provider === 'bank_transfer') {
    return jsonResponse(req, { orderId, bankTransfer: true, amount: total });
  }

  const returnUrl = `${APP_ORIGIN}/#/payment-return?order=${orderId}`;

  try {
    let checkoutUrl: string;
    let providerRef: string;

    if (provider === 'moyasar') {
      const secretKey = Deno.env.get('MOYASAR_SECRET_KEY')!;
      const result = await createMoyasarCheckout(secretKey, {
        amountSar: total,
        description: `قرار — باقة ${pkg.name}`,
        callbackUrl: returnUrl,
        metadata: { orderId, tier: pkg.id, userId },
      });
      checkoutUrl = result.checkoutUrl;
      providerRef = result.providerRef;
    } else if (provider === 'tamara') {
      const apiToken = Deno.env.get('TAMARA_API_TOKEN')!;
      // bلوكر #12: إشعار الخادم-إلى-خادم يجب أن يصل webhook-tamara (Edge Function)
      // لا صفحة SPA الأمامية (returnUrl) — تلك لا تستقبل استدعاءات خادمية إطلاقاً.
      const notificationUrl = `${supabaseUrl}/functions/v1/webhook-tamara`;
      const result = await createTamaraCheckout(apiToken, {
        amountSar: total,
        description: `قرار — باقة ${pkg.name}`,
        callbackUrl: returnUrl,
        notificationUrl,
        metadata: { orderId, tier: pkg.id, userId },
      });
      checkoutUrl = result.checkoutUrl;
      providerRef = result.providerRef;
    } else {
      const secretKey = Deno.env.get('STRIPE_SECRET_KEY')!;
      const result = await createStripeCheckout(secretKey, {
        amountSar: total,
        description: `قرار — باقة ${pkg.name}`,
        successUrl: returnUrl,
        cancelUrl: `${APP_ORIGIN}/#/payment-return?order=${orderId}&cancelled=1`,
        metadata: { orderId, tier: pkg.id, userId },
      });
      checkoutUrl = result.checkoutUrl;
      providerRef = result.providerRef;
    }

    await adminClient.from('orders').update({ provider_ref: providerRef }).eq('id', orderId);

    return jsonResponse(req, { checkoutUrl, orderId });
  } catch (e) {
    // تدقيق 2026-08-29: fetch لدى المزوّد (moyasar.ts/stripe.ts/tamara.ts) صار محدوداً
    // بمهلة (AbortSignal.timeout) — تعليق شبكي حقيقي هناك يصل هنا كرفض (AbortError/
    // TimeoutError) بدل تعليق create-checkout نفسه للأبد. نميّزه في التنبيه فقط
    // (معلومة تشخيصية مفيدة)، والاستجابة للعميل تبقى نفسها: رسالة واضحة 502، لا انهيار
    // بلا معالجة ولا 500 غامض.
    const isTimeout = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError');
    console.error('[create-checkout] provider checkout creation failed:', e);
    await adminClient.from('orders').update({ status: 'failed' }).eq('id', orderId);
    await sendAlert(sentryDsn, {
      message: `[create-checkout] provider checkout creation failed (provider=${provider}, orderId=${orderId}, timeout=${isTimeout}): ${e instanceof Error ? e.message : String(e)}`,
      level: 'error',
      tags: { source: 'create-checkout', kind: isTimeout ? 'provider_timeout' : 'provider_checkout_failed' },
    });
    return jsonResponse(req, { error: 'checkout_creation_failed' }, 502);
  }
});
