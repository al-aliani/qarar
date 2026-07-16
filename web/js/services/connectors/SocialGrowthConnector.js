/**
 * SocialGrowthConnector — نمو متابعين/تفاعل حسابات التواصل الاجتماعي للقطاع.
 *
 * يتطلّب تسجيل تطبيق على منصة تواصل اجتماعي (Instagram/X Graph API) وموافقة
 * OAuth من كل حساب — لم يتم بعد. هذا الموصّل مُهيَّأ بالكامل (مسجَّل وجاهز
 * للاستهلاك عبر suggest()) لكنه يُعيد unavailable دائماً إلى أن يُنجَز تسجيل
 * التطبيق (بنفس نمط GooglePlacesConnector.js — لا مفتاح/توكن في العميل أبداً
 * عند التفعيل لاحقاً).
 *
 * يسجّل المفتاح 'market.socialGrowth'.
 */

import { unavailable, registerConnector } from '../DataConnectors.js';

/** المفتاح الذي يسجّله هذا الموصّل. */
const KEY = 'market.socialGrowth';

/** نص التعذّر الموحّد — الحالة الحالية المتوقّعة (غير مُهيَّأ بعد). */
const NOT_CONFIGURED_NOTE = 'يحتاج تسجيل تطبيق على منصة تواصل اجتماعي (Instagram/X Graph API) لم يتم بعد';

/**
 * موصّل «نمو التواصل الاجتماعي» — غير مُفعّل حالياً بانتظار تسجيل التطبيق.
 * @param {Object} [_context]
 * @returns {Promise<import('../DataConnectors.js').Datum>}
 */
async function socialGrowthConnector(_context = {}) {
    return unavailable(NOT_CONFIGURED_NOTE);
}

// تسجيل ذاتي عند تحميل الوحدة.
registerConnector(KEY, socialGrowthConnector);

export default socialGrowthConnector;
