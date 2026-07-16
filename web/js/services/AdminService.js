/**
 * AdminService — لوحة تحكم الأدمن (2026-07-16). كل دالة تستدعي دالة RPC
 * مقابلة (security definer) مباشرة عبر supabase.rpc — بلا طبقة تجريد إضافية،
 * بنفس نمط ShareService.js/getSharedStudy(). الحماية الفعلية داخل كل دالة
 * SQL نفسها (تتحقق من admins وترفض غير الأدمن) — انظر
 * supabase/migrations/20260716000000_admin_dashboard.sql.
 */
import { getSupabaseClient } from '../../supabaseClient.js';

/**
 * @returns {Promise<{ok: boolean, data?: object, error?: string}>}
 */
async function callAdminRpc(fnName, args = {}) {
    const { supabase, ok, error: clientError } = await getSupabaseClient();
    if (!ok || !supabase) return { ok: false, error: clientError || 'Supabase غير مهيأ' };

    const { data, error } = await supabase.rpc(fnName, args);
    if (error) return { ok: false, error: error.message || 'فشل جلب الإحصائيات' };
    return { ok: true, data };
}

export function getOverview() {
    return callAdminRpc('admin_overview_stats');
}

export function getStudiesStats() {
    return callAdminRpc('admin_studies_stats');
}

export function getUsersStats() {
    return callAdminRpc('admin_users_stats');
}

export function getRevenueStats() {
    return callAdminRpc('admin_revenue_stats');
}

export function getReviewerStats() {
    return callAdminRpc('admin_reviewer_stats');
}

export function getSharingStats() {
    return callAdminRpc('admin_sharing_stats');
}

/**
 * @param {string|null} eventName - فلترة حسب اسم حدث معيّن، أو null لكل الأحداث
 * @param {number} days - نافذة زمنية بالأيام (افتراضي 30)
 * @param {string|null} groupByPropKey - مفتاح داخل props للتجميع حسبه (مثال: 'stepId'، 'format'، 'type')
 */
export function getEventsStats(eventName = null, days = 30, groupByPropKey = null) {
    return callAdminRpc('admin_events_stats', {
        event_name_filter: eventName,
        days,
        group_by_prop_key: groupByPropKey,
    });
}
