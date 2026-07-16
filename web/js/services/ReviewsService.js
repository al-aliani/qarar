/**
 * ReviewsService — قراءة/كتابة تقييمات العملاء (2026-07-16).
 * نمط استدعاء مباشر لـsupabase.from('reviews') (يشبه PersistenceService.js) —
 * ليس عبر Edge Function كـReviewerService.js، لأن أسباب التزامن التي استدعت
 * ذلك (ادّعاء طلب من طابور مشترك) لا تنطبق هنا: مشرف واحد يدير محتوى مباشرة.
 * RLS (20260716000001_customer_reviews.sql) هو الحارس الفعلي في كل الحالات؛
 * هذا الملف لا يفترض صلاحية المستخدم، فقط ينقل النتيجة/الخطأ كما وصل.
 */
import { getSupabaseClient } from '../../supabaseClient.js';

const TABLE = 'reviews';

/**
 * تقييمات منشورة فقط (لصفحة الهبوط — قراءة عامة بلا مصادقة).
 * @returns {Promise<{ok: boolean, reviews?: Array, error?: string}>}
 */
export async function getPublishedReviews() {
    const { supabase, ok, error: clientError } = await getSupabaseClient();
    if (!ok || !supabase) return { ok: false, error: clientError || 'Supabase غير مهيأ' };

    const { data, error } = await supabase
        .from(TABLE)
        .select('id, customer_name, review_text, rating, sector_label')
        .eq('published', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

    if (error) return { ok: false, error: error.message || 'فشل جلب التقييمات' };
    return { ok: true, reviews: data || [] };
}

/**
 * كل التقييمات (منشورة ومسودات) — للوحة الأدمن. RLS يقصرها فعلياً على مشرف.
 * @returns {Promise<{ok: boolean, reviews?: Array, error?: string}>}
 */
export async function getAllReviews() {
    const { supabase, ok, error: clientError } = await getSupabaseClient();
    if (!ok || !supabase) return { ok: false, error: clientError || 'Supabase غير مهيأ' };

    const { data, error } = await supabase
        .from(TABLE)
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

    if (error) return { ok: false, error: error.message || 'فشل جلب التقييمات' };
    return { ok: true, reviews: data || [] };
}

/**
 * @param {{customer_name: string, review_text: string, rating: number, sector_label?: string, published?: boolean, sort_order?: number}} input
 * @returns {Promise<{ok: boolean, review?: object, error?: string}>}
 */
export async function createReview(input) {
    const { supabase, ok, error: clientError } = await getSupabaseClient();
    if (!ok || !supabase) return { ok: false, error: clientError || 'Supabase غير مهيأ' };

    const customerName = String(input.customer_name || '').trim();
    const reviewText = String(input.review_text || '').trim();
    const rating = Number(input.rating);
    // فحص دفاعي في الواجهة قبل الإرسال — التحقق الحقيقي عبر CHECK constraint
    // في قاعدة البيانات (rating between 1 and 5)، هذا فقط لتفادي رحلة شبكة
    // بلا فائدة على خطأ واضح محلياً.
    if (!customerName || !reviewText) return { ok: false, error: 'الاسم ونص التقييم مطلوبان' };
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { ok: false, error: 'التقييم يجب أن يكون رقماً صحيحاً من 1 إلى 5' };

    const { data, error } = await supabase
        .from(TABLE)
        .insert({
            customer_name: customerName,
            review_text: reviewText,
            rating,
            sector_label: input.sector_label?.trim() || null,
            published: !!input.published,
            sort_order: Number.isFinite(Number(input.sort_order)) ? Number(input.sort_order) : 0
        })
        .select()
        .single();

    if (error) return { ok: false, error: error.message || 'فشل إضافة التقييم' };
    return { ok: true, review: data };
}

/**
 * @param {string} id
 * @param {Partial<{customer_name: string, review_text: string, rating: number, sector_label: string, published: boolean, sort_order: number}>} patch
 * @returns {Promise<{ok: boolean, review?: object, error?: string}>}
 */
export async function updateReview(id, patch) {
    const { supabase, ok, error: clientError } = await getSupabaseClient();
    if (!ok || !supabase) return { ok: false, error: clientError || 'Supabase غير مهيأ' };

    const { data, error } = await supabase
        .from(TABLE)
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

    if (error) return { ok: false, error: error.message || 'فشل تعديل التقييم' };
    return { ok: true, review: data };
}

/**
 * @param {string} id
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function deleteReview(id) {
    const { supabase, ok, error: clientError } = await getSupabaseClient();
    if (!ok || !supabase) return { ok: false, error: clientError || 'Supabase غير مهيأ' };

    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) return { ok: false, error: error.message || 'فشل حذف التقييم' };
    return { ok: true };
}
