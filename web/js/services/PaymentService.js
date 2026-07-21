/**
 * PaymentService — واجهة العميل لأتمتة الدفع (2026-07-09).
 * لا يحسب أي سعر هنا ولا يثق بأي حالة دفع محفوظة محلياً — كل تحقق فعلي من
 * "هل دُفع هذا؟" يمر عبر جدول orders المحمي بـRLS (قراءة فقط للمالك)، وكل
 * إنشاء طلب دفع يمر عبر Edge Function create-checkout (السعر يُشتقّ خادمياً).
 */
import { getSupabaseClient, getAuthUser } from '../../supabaseClient.js';

/**
 * هل يوجد طلب مدفوع فعلياً (status='paid') لهذه الدراسة تحديداً؟
 * يُستخدم لفتح بوابة تصدير التقرير النهائي دون تكرار الدفع لكل صيغة تصدير.
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
        .limit(1);

    if (error) {
        console.warn('[PaymentService] فشل التحقق من حالة الدفع:', error.message);
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
        if (error) return { ok: false, error: error.message || 'فشل إنشاء جلسة الدفع' };
        // تحويل بنكي: لا رابط دفع خارجي — يُعاد رقم الطلب والمبلغ لعرض بيانات الحساب.
        if (data?.bankTransfer) return { ok: true, bankTransfer: true, orderId: data.orderId, amount: data.amount };
        // كوبون خصم 100%: الطلب أُكِّد paid فوراً خادمياً بلا مزوّد دفع (لا شيء للتحصيل).
        if (data?.freeViaCoupon) return { ok: true, freeViaCoupon: true, orderId: data.orderId };
        if (!data?.checkoutUrl) return { ok: false, error: 'لم يُعِد الخادم رابط دفع صالحاً' };
        return { ok: true, checkoutUrl: data.checkoutUrl, orderId: data.orderId };
    } catch (e) {
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

    if (error || !data) return null;
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

    if (error) {
        console.warn('[PaymentService] فشل جلب سجل الطلبات:', error.message);
        return [];
    }
    return Array.isArray(data) ? data : [];
}

/**
 * حالة مراجعة الخبير لهذه الدراسة (إن وُجد طلب tier='reviewed' لها) — تُستخدم
 * لعرض ReviewStatusBadge للعميل بدل تركه ينتظر بلا أي مؤشّر داخل الموقع.
 * أحدث طلب "مراجَع بخبير" لهذه الدراسة فقط (قد تتكرر الدراسة بين عدة طلبات
 * قديمة/ملغاة، فنعرض الأحدث حسب created_at).
 * @param {string} studyId
 * @returns {Promise<{reviewStatus: string, certificateId: string|null, reviewedAt: string|null}|null>}
 */
export async function getReviewStatus(studyId) {
    if (!studyId) return null;
    const { supabase, ok } = await getSupabaseClient();
    if (!ok || !supabase) return null;

    const { user } = await getAuthUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('orders')
        .select('review_status, certificate_id, reviewed_at')
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
    };
}
