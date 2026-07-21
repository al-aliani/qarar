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

export function getProductFunnelStats(days = 30) {
    return callAdminRpc('admin_product_funnel_stats', { days });
}

/** التحويلات البنكية المعلّقة بانتظار تأكيد وصول الحوالة (قناة الدفع اليدوية). */
export function getPendingBankTransfers() {
    return callAdminRpc('admin_list_pending_bank_transfers');
}

/** تأكيد وصول حوالة بنكية → الطلب paid ويُفتح التصدير للعميل. @param {string} orderId */
export function confirmBankTransfer(orderId) {
    return callAdminRpc('admin_confirm_bank_transfer', { target_order_id: orderId });
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

/**
 * قائمة العملاء اللي عندهم جوال مُدخَل لكن بانتظار تأكيد يدوي (تواصل واتساب
 * — انظر migration 20260717020000_whatsapp_manual_confirm.sql). دالة ضيّقة
 * النطاق عمداً — تُرجع أعمدة دنيا فقط (لا صف profiles كاملاً).
 */
export function getUnverifiedPhones() {
    return callAdminRpc('admin_list_unverified_phones');
}

/**
 * تأكيد جوال مستخدم واحد محدَّد يدوياً (بعد استلام رسالة واتساب فعلية منه).
 * @param {string} userId
 */
export function confirmPhoneVerified(userId) {
    return callAdminRpc('admin_confirm_phone_verified', { target_user_id: userId });
}
