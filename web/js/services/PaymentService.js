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
export async function startCheckout({ tier, studyId, provider }) {
    const { supabase, ok, error: clientError } = await getSupabaseClient();
    if (!ok || !supabase) return { ok: false, error: clientError || 'Supabase غير مهيأ' };

    const { user } = await getAuthUser();
    if (!user) return { ok: false, error: 'سجّل الدخول أولاً لإتمام الدفع' };

    try {
        const { data, error } = await supabase.functions.invoke('create-checkout', {
            body: { tier, studyId, provider },
        });
        if (error) return { ok: false, error: error.message || 'فشل إنشاء جلسة الدفع' };
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
