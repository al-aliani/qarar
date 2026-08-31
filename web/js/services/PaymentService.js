/**
 * PaymentService — واجهة العميل لأتمتة الدفع (2026-07-09).
 * لا يحسب أي سعر هنا ولا يثق بأي حالة دفع محفوظة محلياً — كل تحقق فعلي من
 * "هل دُفع هذا؟" يمر عبر جدول orders المحمي بـRLS (قراءة فقط للمالك)، وكل
 * إنشاء طلب دفع يمر عبر Edge Function create-checkout (السعر يُشتقّ خادمياً).
 */
import { getSupabaseClient, getAuthUser } from '../../supabaseClient.js';
import { monitoring } from '../utils/monitoring.js';

// تدقيق أمني 2026-08-29: الباقات المدفوعة فعلياً فقط — يجب أن تطابق حرفياً
// PAYABLE_TIERS في supabase/functions/create-checkout/index.ts وقيد orders_tier_check
// (migration 20260709120000_create_orders_payments.sql). 'free' موجودة في pricing.js/
// pricing.ts لعرض صفحة الأسعار فقط وليست منتجاً حقيقياً — hasActivePayment كانت تتحقق
// من status='paid' فقط بلا أي فلترة على tier، فأي صف orders بحالة paid (بصرف النظر عن
// tier) كان يفتح كل بوابات التصدير المدفوعة؛ هذا دفاع مستقل حتى لو انفتح مسار سعر صفري
// آخر مستقبلاً على جانب create-checkout.
const PAID_TIERS = ['self', 'reviewed', 'full'];

/**
 * هل يوجد طلب مدفوع فعلياً (status='paid' وtier من الباقات المدفوعة الحقيقية) لهذه
 * الدراسة تحديداً؟ يُستخدم لفتح بوابة تصدير التقرير النهائي دون تكرار الدفع لكل صيغة تصدير.
 * @param {string} studyId
 * @returns {Promise<boolean>}
 */
export async function hasActivePayment(studyId) {
    if (!studyId) return false;
    const { supabase, ok } = await getSupabaseClient();
    if (!ok || !supabase) return false;

    const { user } = await getAuthUser();
    if (!user) return false; // زائر غير مسجَّل لا يملك أي طلب مرتبط بهويته

    const { data, error } = await supabase
        .from('orders')
        .select('id')
        .eq('study_id', studyId)
        .eq('status', 'paid')
        .in('tier', PAID_TIERS)
        .limit(1);

    if (error) {
        console.warn('[PaymentService] فشل التحقق من حالة الدفع:', error.message);
        // فشل آمن (يبقى false — لا يفتح بوابة التصدير خطأً)، لكن دون هذا كان الفشل
        // نفسه لا يصل لأي مراقبة — قد يعني حجب تصدير مدفوع فعلاً عن عميل بصمت.
        monitoring.captureException(new Error(error.message || 'فشل التحقق من حالة الدفع'), { source: 'PaymentService.hasActivePayment', studyId });
        return false;
    }
    return Array.isArray(data) && data.length > 0;
}

/**
 * بدء جلسة دفع فعلية عبر Edge Function (create-checkout) — يعيد رابط دفع
 * حقيقياً من المزوّد (Moyasar أو Stripe) يجب توجيه المتصفح إليه.
 * @param {{tier: 'self'|'reviewed'|'full', studyId: string, provider: 'moyasar'|'stripe'|'tamara'}} params
 * @returns {Promise<{ok: boolean, checkoutUrl?: string, orderId?: string, error?: string}>}
 */
export async function startCheckout({ tier, studyId, provider, addons = [], coupon = '' }) {
    const { supabase, ok, error: clientError } = await getSupabaseClient();
    if (!ok || !supabase) return { ok: false, error: clientError || 'Supabase غير مهيأ' };

    const { user } = await getAuthUser();
    if (!user) return { ok: false, error: 'سجّل الدخول أولاً لإتمام الدفع' };

    try {
        const body = { tier, studyId, provider };
        if (addons.length) body.addons = addons;
        if (coupon) body.coupon = coupon;
        const { data, error } = await supabase.functions.invoke('create-checkout', {
            body,
        });
        if (error) {
            // تدقيق 2026-08-31: FunctionsHttpError (@supabase/functions-js) يجعل .message
            // نصاً ثابتاً عاماً بالإنجليزية دوماً ('Edge Function returned a non-2xx status
            // code') بصرف النظر عن السبب الفعلي — السبب الحقيقي (invalid_tier/invalid_provider/
            // rate_limited/study_not_owned/order_creation_failed/checkout_creation_failed، انظر
            // supabase/functions/create-checkout/index.ts) موجود فقط بجسم استجابة create-checkout
            // نفسه عبر error.context (كائن Response خام لم يُقرأ بعد)، تماماً كنمط error.context
            // في ReviewerService.js.claimOrder. fallback آمن لو تعذّرت القراءة أو context مفقود.
            let message = error.message || 'فشل إنشاء جلسة الدفع';
            try {
                const body = await error.context?.json();
                if (body && typeof body.error === 'string') message = body.error;
            } catch {
                // جسم غير JSON أو تعذّر القراءة — يبقى fallback الرسالة العامة أعلاه.
            }
            return { ok: false, error: message };
        }
        // تحويل بنكي: لا رابط دفع خارجي — يُعاد رقم الطلب والمبلغ لعرض بيانات الحساب.
        if (data?.bankTransfer) return { ok: true, bankTransfer: true, orderId: data.orderId, amount: data.amount };
        // كوبون خصم 100%: الطلب أُكِّد paid فوراً خادمياً بلا مزوّد دفع (لا شيء للتحصيل).
        if (data?.freeViaCoupon) return { ok: true, freeViaCoupon: true, orderId: data.orderId };
        if (!data?.checkoutUrl) return { ok: false, error: 'لم يُعِد الخادم رابط دفع صالحاً' };
        return { ok: true, checkoutUrl: data.checkoutUrl, orderId: data.orderId };
    } catch (e) {
        // استثناء اتصال حقيقي (لا رفض منطقي من create-checkout، ذاك يُعاد أعلاه كـerror
        // عادي) — كان يُعاد للمستدعي بلا أي أثر يصل لأي مراقبة.
        monitoring.captureException(e, { source: 'PaymentService.startCheckout', studyId, tier, provider });
        return { ok: false, error: e?.message || 'خطأ في الاتصال بخادم الدفع' };
    }
}

/**
 * حالة طلب محدد (لصفحة العودة بعد الدفع — الـwebhook قد يصل بعد إعادة التوجيه
 * مباشرة، فتحتاج الواجهة لاستطلاع الحالة لثوانٍ قليلة بدل افتراض النجاح فوراً).
 * @param {string} orderId
 * @returns {Promise<'pending'|'paid'|'failed'|'refunded'|null>}
 */
export async function getOrderStatus(orderId) {
    if (!orderId) return null;
    const { supabase, ok } = await getSupabaseClient();
    if (!ok || !supabase) return null;

    const { data, error } = await supabase
        .from('orders')
        .select('status')
        .eq('id', orderId)
        .single();

    // تدقيق حي 2026-07-22: كان أي خطأ (بما فيه 500 من حلقة RLS بين orders/reviewers،
    // انظر supabase/migrations/20260722092000_*) يُبتلَع بصمت ويُعاد null — فلا يفرّق
    // PaymentReturnView.js بين "لا رد بعد" و"خطأ خادم حقيقي"، ويستمر بالاستطلاع 20 ثانية
    // كاملة حتى لمعرّف غير موجود إطلاقاً أو عطل خادمي. نرمي الخطأ الآن ليوقف الاستطلاع
    // فوراً ويعرض المستدعي فشلاً واضحاً بدل انتظار عبثي.
    if (error) throw new Error(error.message || 'تعذّر التحقق من حالة الطلب');
    if (!data) return null;
    return data.status;
}

/**
 * كل طلبات الدفع الخاصة بالمستخدم الحالي (لصفحة سجل الفواتير) — بالاعتماد على
 * RLS وحدها (سياسة orders_select_own) تماماً كـgetOrderStatus/hasActivePayment
 * أعلاه، لا فلترة user_id يدوية مكرِّرة لما تضمنه السياسة أصلاً.
 * @returns {Promise<Array<{id:string, tier:string, amount_sar:number, currency:string, status:string, study_id:string|null, created_at:string, paid_at:string|null}>>}
 */
export async function listOrders() {
    const { supabase, ok } = await getSupabaseClient();
    if (!ok || !supabase) return [];

    const { user } = await getAuthUser();
    if (!user) return [];

    // تنظيف ضمني: طلبات pending قديمة (>24 ساعة، غير تحويل بنكي) صارت متروكة —
    // بلا cron خارجي، فأول مرة يفتح المستخدم سجل فواتيره ننهي صلاحيتها فعلياً
    // (RPC مقيّدة بـauth.uid() ضمن الدالة نفسها، انظر migration
    // 20260721200000_expire_stale_pending_orders.sql). فشلها لا يمنع عرض السجل.
    const { error: expireError } = await supabase.rpc('expire_stale_pending_orders');
    if (expireError) console.warn('[PaymentService] فشل تنظيف الطلبات المنتهية:', expireError.message);

    const { data, error } = await supabase
        .from('orders')
        .select('id, tier, amount_sar, subtotal_sar, discount_sar, vat_sar, total_sar, amount_paid_sar, amount_due_sar, coupon_code, items, currency, status, study_id, created_at, paid_at')
        .order('created_at', { ascending: false });

    // تدقيق 2026-08-26: كان يُبتلَع ويُعاد [] — فجلسة سليمة يفشل استعلامها تسقط في فرع
    // «لا توجد عمليات دفع حتى الآن»، أي فشلُ وصولٍ يُقدَّم للعميل كحقيقة عن حسابه. نرمي
    // الآن كما تفعل getOrderStatus أعلاه ليفرّق المستدعي بين «فارغ» و«تعذّر الوصول».
    if (error) {
        // بخلاف getOrderStatus (مستدعيها PaymentReturnView.js يُبلِّغ المراقبة فعلياً عند
        // الرمي)، لا مستدعٍ حالي لـlistOrders (BillingHistoryView.js/DashboardView.js)
        // يستدعي المراقبة عند التقاط هذا الرمي — فنُبلِّغ هنا كي لا يبقى الفشل بلا أثر.
        const e = new Error(error.message || 'تعذّر جلب سجل الطلبات');
        monitoring.captureException(e, { source: 'PaymentService.listOrders' });
        throw e;
    }
    return Array.isArray(data) ? data : [];
}

/**
 * حالة مراجعة الخبير لهذه الدراسة (إن وُجد طلب tier='reviewed' لها) — تُستخدم
 * لعرض ReviewStatusBadge للعميل بدل تركه ينتظر بلا أي مؤشّر داخل الموقع.
 * أحدث طلب "مراجَع بخبير" لهذه الدراسة فقط (قد تتكرر الدراسة بين عدة طلبات
 * قديمة/ملغاة، فنعرض الأحدث حسب created_at).
 * @param {string} studyId
 * @returns {Promise<{reviewStatus: string, certificateId: string|null, reviewedAt: string|null, reviewerNotes: string|null}|null>}
 */
export async function getReviewStatus(studyId) {
    if (!studyId) return null;
    const { supabase, ok } = await getSupabaseClient();
    if (!ok || !supabase) return null;

    const { user } = await getAuthUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('orders')
        .select('review_status, certificate_id, reviewed_at, reviewer_notes')
        .eq('study_id', studyId)
        .eq('tier', 'reviewed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error || !data) return null;
    return {
        reviewStatus: data.review_status,
        certificateId: data.certificate_id,
        reviewedAt: data.reviewed_at,
        reviewerNotes: data.reviewer_notes,
    };
}
