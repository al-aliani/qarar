/**
 * MfaRecoveryService — واجهة العميل لرموز استرداد 2FA (2026-08-24).
 * لا يولّد ولا يتحقق من أي رمز محلياً — كل المنطق الحسّاس (توليد الرموز،
 * هاشها، حذف عامل TOTP إدارياً) يمر عبر Edge Functions بمفتاح service_role
 * (mfa-recovery-generate/mfa-recovery-unenroll)، بنفس مبدأ WhatsAppOtpService.js
 * وPaymentService.js. رموز الخطأ تُمرَّر كما وصلت من الخادم بلا ترجمة هنا —
 * الترجمة لنص عربي مسؤولية طبقة الواجهة (نفس نمط الخدمتين أعلاه).
 */
import { getSupabaseClient, getAuthUser } from '../../supabaseClient.js';

/**
 * يولّد دفعة جديدة من 10 رموز استرداد لعامل TOTP الموثَّق للمستخدم الحالي —
 * تُبطل أي دفعة سابقة بالكامل. يتطلب جلسة aal2 فعلية على الخادم (يُتحقَّق
 * منها هناك، لا هنا).
 * @returns {Promise<{ok: boolean, codes?: string[], error?: string}>}
 */
export async function generateMfaRecoveryCodes() {
    const { supabase, ok, error: clientError } = await getSupabaseClient();
    if (!ok || !supabase) return { ok: false, error: clientError || 'Supabase غير مهيأ' };

    const { user } = await getAuthUser();
    if (!user) return { ok: false, error: 'سجّل الدخول أولاً' };

    try {
        const { data, error } = await supabase.functions.invoke('mfa-recovery-generate', { body: {} });
        if (error) return { ok: false, error: error.message || 'فشل توليد رموز الاسترداد' };
        if (!data?.ok) return { ok: false, error: data?.error || 'فشل توليد رموز الاسترداد' };
        return { ok: true, codes: data.codes };
    } catch (e) {
        return { ok: false, error: e?.message || 'خطأ في الاتصال' };
    }
}

/**
 * يستهلك رمز استرداد واحداً غير مستخدَم لإلغاء كل عوامل TOTP الموثَّقة
 * للمستخدم الحالي إدارياً — يُستخدَم عند فقدان جهاز المصادقة. النجاح يُسقط
 * كل جلسات المستخدم النشطة (بما فيها الجلسة التي أرسلت هذا الطلب نفسه).
 * @param {string} recoveryCode
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function redeemMfaRecoveryCode(recoveryCode) {
    const { supabase, ok, error: clientError } = await getSupabaseClient();
    if (!ok || !supabase) return { ok: false, error: clientError || 'Supabase غير مهيأ' };

    const { user } = await getAuthUser();
    if (!user) return { ok: false, error: 'سجّل الدخول أولاً' };

    try {
        const { data, error } = await supabase.functions.invoke('mfa-recovery-unenroll', { body: { recoveryCode } });
        if (error) return { ok: false, error: error.message || 'فشل التحقق من رمز الاسترداد' };
        if (!data?.ok) return { ok: false, error: data?.error || 'رمز استرداد غير صحيح' };
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e?.message || 'خطأ في الاتصال' };
    }
}
