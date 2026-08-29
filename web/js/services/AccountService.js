import { getSupabaseClient, getAuthUser } from '../../supabaseClient.js';

export async function requestAccountDeletion() {
    const { user } = await getAuthUser();
    if (!user) return { ok: false, error: 'سجّل الدخول أولاً.' };
    const { supabase, ok, error } = await getSupabaseClient();
    if (!ok || !supabase) return { ok: false, error };
    const { error: insertError } = await supabase.from('account_deletion_requests').upsert({ user_id: user.id, status: 'requested' }, { onConflict: 'user_id,status' });
    return insertError ? { ok: false, error: insertError.message } : { ok: true };
}

/**
 * طلب حذف الحساب المعلَّق للمستخدم الحالي (status='requested') إن وُجد —
 * تُستخدَم لإظهار زر "إلغاء طلب الحذف" في صفحة حسابي (UserProfileView.js).
 * @returns {Promise<{ok: boolean, request?: {id: string, created_at: string}|null, error?: string}>}
 */
export async function getPendingAccountDeletionRequest() {
    const { user } = await getAuthUser();
    if (!user) return { ok: false, error: 'سجّل الدخول أولاً.' };
    const { supabase, ok, error } = await getSupabaseClient();
    if (!ok || !supabase) return { ok: false, error };
    const { data, error: selectError } = await supabase
        .from('account_deletion_requests')
        .select('id, created_at')
        .eq('user_id', user.id)
        .eq('status', 'requested')
        .maybeSingle();
    if (selectError) return { ok: false, error: selectError.message };
    return { ok: true, request: data || null };
}

/**
 * إلغاء طلب حذف حساب معلَّق خلال فترة السماح (7 أيام) — تحويل الحالة إلى
 * 'cancelled' (لا حذف الصف، للاحتفاظ بأثر تدقيق) عبر سياسة RLS
 * deletion_cancel_own (20260829010000) التي تسمح فقط بانتقال
 * requested → cancelled لصاحب الطلب. طلب صار بالفعل 'processing'/'completed'
 * لن يتأثر (شرط .eq('status','requested') لا يطابقه، وRLS ترفضه أصلاً).
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function cancelAccountDeletionRequest() {
    const { user } = await getAuthUser();
    if (!user) return { ok: false, error: 'سجّل الدخول أولاً.' };
    const { supabase, ok, error } = await getSupabaseClient();
    if (!ok || !supabase) return { ok: false, error };
    const { error: updateError } = await supabase
        .from('account_deletion_requests')
        .update({ status: 'cancelled' })
        .eq('user_id', user.id)
        .eq('status', 'requested');
    return updateError ? { ok: false, error: updateError.message } : { ok: true };
}
