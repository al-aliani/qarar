/**
 * WhatsAppOtpService — واجهة العميل لتحقق واتساب الحقيقي (2026-07-17).
 * لا يولّد ولا يتحقق من أي رمز محلياً — كل المنطق الحسّاس (توليد الرمز،
 * إرسال رسالة واتساب فعلية، مقارنة الهاش) يمر عبر Edge Functions بمفتاح
 * service_role (whatsapp-otp-send/verify)، بنفس مبدأ PaymentService.js.
 * رموز الخطأ تُمرَّر كما وصلت من الخادم بلا ترجمة هنا (نفس نمط startCheckout
 * مع create-checkout) — الترجمة لنص عربي مسؤولية طبقة الواجهة.
 */
import { getSupabaseClient, getAuthUser } from '../../supabaseClient.js';

/**
 * يرسل رمز تحقق واتساب حقيقي لجوال المستخدم الحالي المسجَّل بحسابه (الخادم
 * يقرأ الرقم من profiles.phone، لا يُرسَل من هنا).
 * @returns {Promise<{ok: boolean, expiresAt?: string, resendAvailableAt?: string, error?: string}>}
 */
export async function sendWhatsAppOtp() {
    const { supabase, ok, error: clientError } = await getSupabaseClient();
    if (!ok || !supabase) return { ok: false, error: clientError || 'Supabase غير مهيأ' };

    const { user } = await getAuthUser();
    if (!user) return { ok: false, error: 'سجّل الدخول أولاً' };

    try {
        const { data, error } = await supabase.functions.invoke('whatsapp-otp-send', { body: {} });
        if (error) return { ok: false, error: error.message || 'فشل إرسال رمز التحقق' };
        if (!data?.ok) return { ok: false, error: data?.error || 'فشل إرسال رمز التحقق' };
        return { ok: true, expiresAt: data.expiresAt, resendAvailableAt: data.resendAvailableAt };
    } catch (e) {
        return { ok: false, error: e?.message || 'خطأ في الاتصال' };
    }
}

/**
 * يتحقق من الرمز الذي أدخله المستخدم مقابل آخر تحدٍّ فعّال له.
 * @param {string} code
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function verifyWhatsAppOtp(code) {
    const { supabase, ok, error: clientError } = await getSupabaseClient();
    if (!ok || !supabase) return { ok: false, error: clientError || 'Supabase غير مهيأ' };

    const { user } = await getAuthUser();
    if (!user) return { ok: false, error: 'سجّل الدخول أولاً' };

    try {
        const { data, error } = await supabase.functions.invoke('whatsapp-otp-verify', { body: { code } });
        if (error) return { ok: false, error: error.message || 'فشل التحقق من الرمز' };
        if (!data?.ok) return { ok: false, error: data?.error || 'رمز غير صحيح' };
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e?.message || 'خطأ في الاتصال' };
    }
}
