/**
 * NotificationService — إشعارات حقيقية (جدول public.notifications، انظر
 * migration 20260716000002_dashboard_experience.sql). نفس أسلوب
 * PaymentService.js: RLS وحدها تحدد ما يراه المستخدم، بلا فلترة user_id
 * يدوية مكرِّرة لما تضمنه سياسة notifications_select_own أصلاً.
 */
import { getSupabaseClient, getAuthUser } from '../../supabaseClient.js';

/**
 * آخر إشعارات المستخدم الحالي (الأحدث أولاً).
 * @param {number} limit
 * @returns {Promise<Array<{id:string, type:string, title:string, body:string|null, study_id:string|null, read_at:string|null, created_at:string}>>}
 */
export async function listNotifications(limit = 20) {
    const { supabase, ok } = await getSupabaseClient();
    if (!ok || !supabase) return [];

    const { user } = await getAuthUser();
    if (!user) return [];

    const { data, error } = await supabase
        .from('notifications')
        .select('id, type, title, body, study_id, read_at, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.warn('[NotificationService] فشل جلب الإشعارات:', error.message);
        return [];
    }
    return Array.isArray(data) ? data : [];
}

/**
 * عدد الإشعارات غير المقروءة — لشارة الجرس في اللوحة الرئيسية.
 * @returns {Promise<number>}
 */
export async function unreadCount() {
    const { supabase, ok } = await getSupabaseClient();
    if (!ok || !supabase) return 0;

    const { user } = await getAuthUser();
    if (!user) return 0;

    const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .is('read_at', null);

    if (error) return 0;
    return count || 0;
}

/**
 * تعليم إشعار كمقروء.
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function markRead(id) {
    if (!id) return false;
    const { supabase, ok } = await getSupabaseClient();
    if (!ok || !supabase) return false;

    const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id);

    return !error;
}

/**
 * تعليم كل الإشعارات كمقروءة دفعة واحدة (زر "تعليم الكل كمقروء").
 * @returns {Promise<boolean>}
 */
export async function markAllRead() {
    const { supabase, ok } = await getSupabaseClient();
    if (!ok || !supabase) return false;

    const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .is('read_at', null);

    return !error;
}
