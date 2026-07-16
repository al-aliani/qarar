/**
 * توحيد وتحقق رقم الجوال السعودي (المصدر الوحيد لهذا المنطق — كان مكرراً
 * سابقاً داخل supabaseClient.js في signInWithOtpPhone/verifyOtpPhone).
 */

const SAUDI_MOBILE_E164 = /^\+9665\d{8}$/;

/**
 * يحوّل أي صيغة شائعة (05XXXXXXXX، 5XXXXXXXX، 9665XXXXXXXX، +9665XXXXXXXX)
 * إلى E.164 (+9665XXXXXXXX). لا يتحقق من الصحة — انظر isValidSaudiPhone.
 */
export function toE164SaudiPhone(raw) {
    let v = (raw || '').trim().replace(/[\s-]/g, '');
    if (v.startsWith('05')) v = '+966' + v.slice(1);
    else if (v.startsWith('5') && v.length <= 10) v = '+966' + v;
    else if (!v.startsWith('+')) v = '+' + v;
    return v;
}

/** true فقط لجوال سعودي صحيح الصيغة بعد التوحيد (+966 5XXXXXXXX). */
export function isValidSaudiPhone(raw) {
    return SAUDI_MOBILE_E164.test(toE164SaudiPhone(raw));
}

/** يُرجع E.164 صحيحاً أو null إن كانت الصيغة غير صالحة. */
export function normalizeSaudiPhone(raw) {
    const e164 = toE164SaudiPhone(raw);
    return SAUDI_MOBILE_E164.test(e164) ? e164 : null;
}
