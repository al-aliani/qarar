/**
 * ShareService — مشاركة فعلية بصلاحيات (2026-07-14)، بديل رابط "المشاركة"
 * الوهمي السابق في ShareView.js (كان يعرض حالة المتصفح المحلية فقط بلا أي
 * جلب فعلي). يبني فوق جدول study_shares الموجود أصلاً (docs/supabase_setup.sql)
 * بعد توسيعه برمز مشاركة مجهول (share_token) — انظر migration
 * 20260714020000_share_tokens.sql.
 *
 * نطاق هذه الجولة: صلاحية 'view' فقط (لا تعديل مجهول لدراسة طرف آخر).
 */
import { getSupabaseClient, getAuthUser } from '../../supabaseClient.js';

/**
 * إنشاء رابط مشاركة جديد لدراسة (المالك المصادَق عليه فقط — سياسة RLS
 * "Study owners can manage shares" القائمة أصلاً تسمح بذلك).
 * @param {string} studyId
 * @param {{expiresInDays?: number}} [options]
 * @returns {Promise<{ok: boolean, shareToken?: string, error?: string}>}
 */
export async function createShareLink(studyId, options = {}) {
    if (!studyId) return { ok: false, error: 'لا يوجد معرّف دراسة صالح' };
    const { supabase, ok, error: clientError } = await getSupabaseClient();
    if (!ok || !supabase) return { ok: false, error: clientError || 'Supabase غير مهيأ' };

    const { user } = await getAuthUser();
    if (!user) return { ok: false, error: 'سجّل الدخول أولاً لإنشاء رابط مشاركة' };

    const expiresAt = options.expiresInDays
        ? new Date(Date.now() + options.expiresInDays * 86400000).toISOString()
        : null;

    const { data, error } = await supabase
        .from('study_shares')
        .insert({ study_id: studyId, permission: 'view', expires_at: expiresAt })
        .select('share_token')
        .single();

    if (error || !data) return { ok: false, error: error?.message || 'فشل إنشاء رابط المشاركة' };
    return { ok: true, shareToken: data.share_token };
}

/**
 * قائمة روابط المشاركة النشطة لدراسة (للمالك — لإدارتها/إلغائها).
 * @param {string} studyId
 * @returns {Promise<Array<{id: string, shareToken: string, createdAt: string, expiresAt: string|null, revoked: boolean}>>}
 */
export async function listShares(studyId) {
    if (!studyId) return [];
    const { supabase, ok } = await getSupabaseClient();
    if (!ok || !supabase) return [];

    const { data, error } = await supabase
        .from('study_shares')
        .select('id, share_token, created_at, expires_at, revoked')
        .eq('study_id', studyId)
        .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map((row) => ({
        id: row.id,
        shareToken: row.share_token,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        revoked: row.revoked,
    }));
}

/**
 * كل روابط المشاركة التي أنشأها المستخدم الحالي، عبر كل دراساته (للوحة
 * الرئيسية — "روابط المشاركة التي أنشأتها"، انظر migration
 * 20260716000002_dashboard_experience.sql دالة list_my_share_links). بخلاف
 * listShares أعلاه (دراسة واحدة محدَّدة)، هذه تحتاج JOIN عبر كل دراساتك.
 * @returns {Promise<Array<{id:string, shareToken:string, studyId:string, studyTitle:string, permission:string, revoked:boolean, expiresAt:string|null, createdAt:string}>>}
 */
export async function listAllMyShares() {
    const { supabase, ok } = await getSupabaseClient();
    if (!ok || !supabase) return [];

    const { data, error } = await supabase.rpc('list_my_share_links');
    if (error || !data) return [];
    return data.map((row) => ({
        id: row.id,
        shareToken: row.share_token,
        studyId: row.study_id,
        studyTitle: row.study_title,
        permission: row.permission,
        revoked: row.revoked,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
    }));
}

/**
 * إلغاء رابط مشاركة (لا يحذفه — يُبقي الأثر للتدقيق، فقط يمنع الوصول).
 * @param {string} shareId
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function revokeShare(shareId) {
    if (!shareId) return { ok: false, error: 'معرّف مشاركة غير صالح' };
    const { supabase, ok } = await getSupabaseClient();
    if (!ok || !supabase) return { ok: false, error: 'Supabase غير مهيأ' };

    const { error } = await supabase.from('study_shares').update({ revoked: true }).eq('id', shareId);
    if (error) return { ok: false, error: error.message || 'فشل إلغاء الرابط' };
    return { ok: true };
}

/**
 * جلب دراسة عبر رمز مشاركة — بلا حاجة مصادقة (يُستخدم من ShareView.js).
 * @param {string} shareToken
 * @returns {Promise<{title: string, sector: string, data: object, permission: string}|null>}
 */
export async function getSharedStudy(shareToken) {
    if (!shareToken) return null;
    const { supabase, ok } = await getSupabaseClient();
    if (!ok || !supabase) return null;

    const { data, error } = await supabase
        .rpc('get_study_by_share_token', { p_token: shareToken })
        .single();

    if (error || !data) return null;
    return { title: data.title, sector: data.sector, data: data.data, permission: data.permission };
}
