/**
 * ReviewerService — واجهة العميل لبوابة مراجعي الخبراء (2026-07-13).
 * كل استدعاء يمر عبر Edge Function (reviewer-queue/claim/submit) التي تتحقق
 * فعلياً من عضوية المراجع (جدول reviewers) — هذا الملف لا يفترض صلاحية
 * المستخدم، فقط ينقل الاستجابة/الخطأ كما وصلت من الخادم.
 */
import { getSupabaseClient, getAuthUser } from '../../supabaseClient.js';

/**
 * قائمة الطابور غير المُدّعى + قائمة "قيد المراجعة عندي".
 * @returns {Promise<{ok: boolean, queue?: Array, myClaims?: Array, error?: string}>}
 */
export async function fetchQueue() {
    const { supabase, ok, error: clientError } = await getSupabaseClient();
    if (!ok || !supabase) return { ok: false, error: clientError || 'Supabase غير مهيأ' };

    const { user } = await getAuthUser();
    if (!user) return { ok: false, error: 'سجّل الدخول أولاً' };

    try {
        const { data, error } = await supabase.functions.invoke('reviewer-queue', { body: {} });
        if (error) return { ok: false, error: error.message || 'فشل جلب الطابور' };
        return { ok: true, queue: data?.queue || [], myClaims: data?.myClaims || [] };
    } catch (e) {
        return { ok: false, error: e?.message || 'خطأ في الاتصال بخادم المراجعة' };
    }
}

/**
 * ادّعاء طلب من الطابور (409 إن سبق مراجع آخر لادّعائه — تعامل مع هذا كنتيجة
 * متوقعة، ليست خطأ نظام، وأعد جلب الطابور بعدها).
 * @param {string} orderId
 * @returns {Promise<{ok: boolean, error?: string, alreadyClaimed?: boolean}>}
 */
export async function claimOrder(orderId) {
    const { supabase, ok, error: clientError } = await getSupabaseClient();
    if (!ok || !supabase) return { ok: false, error: clientError || 'Supabase غير مهيأ' };

    try {
        const { data, error } = await supabase.functions.invoke('reviewer-claim', { body: { orderId } });
        if (error) {
            const alreadyClaimed = error.context?.status === 409;
            return { ok: false, alreadyClaimed, error: alreadyClaimed ? 'تم ادّعاء هذا الطلب من مراجع آخر' : (error.message || 'فشل الادّعاء') };
        }
        return { ok: true, reviewStatus: data?.reviewStatus };
    } catch (e) {
        return { ok: false, error: e?.message || 'خطأ في الاتصال بخادم المراجعة' };
    }
}

/**
 * إنهاء المراجعة (اعتماد أو رفض) لطلب أدّعاه المستخدم الحالي فعلاً.
 * @param {string} orderId
 * @param {'certified'|'rejected'} decision
 * @param {string} [notes]
 * @returns {Promise<{ok: boolean, certificateId?: string|null, error?: string}>}
 */
export async function submitReview(orderId, decision, notes = '') {
    const { supabase, ok, error: clientError } = await getSupabaseClient();
    if (!ok || !supabase) return { ok: false, error: clientError || 'Supabase غير مهيأ' };

    try {
        const { data, error } = await supabase.functions.invoke('reviewer-submit', {
            body: { orderId, decision, notes },
        });
        if (error) return { ok: false, error: error.message || 'فشل إرسال المراجعة' };
        return { ok: true, certificateId: data?.certificateId ?? null };
    } catch (e) {
        return { ok: false, error: e?.message || 'خطأ في الاتصال بخادم المراجعة' };
    }
}

/**
 * توثيق الاعتماد (إن وُجد) لدراسة معيّنة — يُستخدم عند تصدير التقرير البنكي
 * ليظهر اسم المراجع الحقيقي ورقم الشهادة بدل حقول فارغة (انظر
 * BankReportGenerator._renderCertificationBlock). لا يُستخدم جدول reviewers
 * مباشرة من الواجهة (RLS يقيّده لصف المراجع نفسه)؛ الاسم يُقرأ عبر join خفيف
 * هنا فقط إذا كان المستخدم الحالي هو صاحب الدراسة (orders_select_own) أو
 * مراجعها (orders_select_reviewer_queue) — غير ذلك يعود null بصمت.
 * @param {string} studyId
 * @returns {Promise<{reviewerName: string, certificateId: string, certifiedAt: string}|null>}
 */
export async function getCertificationForStudy(studyId) {
    if (!studyId) return null;
    const { supabase, ok } = await getSupabaseClient();
    if (!ok || !supabase) return null;

    const { data, error } = await supabase
        .from('orders')
        .select('certificate_id, reviewed_at, reviewer_id, reviewers(display_name)')
        .eq('study_id', studyId)
        .eq('tier', 'reviewed')
        .eq('review_status', 'certified')
        .order('reviewed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error || !data || !data.certificate_id) return null;
    return {
        reviewerName: data.reviewers?.display_name || 'مراجع معتمد',
        certificateId: data.certificate_id,
        certifiedAt: data.reviewed_at,
    };
}
