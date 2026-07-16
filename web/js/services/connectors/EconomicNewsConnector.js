/**
 * EconomicNewsConnector — أخبار اقتصادية/تنظيمية ذات صلة بالقطاع أو المدينة.
 *
 * يتطلّب مزوّد أخبار مُفتاحاً (مثل NewsAPI) لم يُحسم بعد. هذا الموصّل مُهيَّأ
 * بالكامل (مسجَّل وجاهز للاستهلاك عبر suggest()) لكنه يُعيد unavailable دائماً
 * إلى أن يُختار مزوّد ويُضاف مفتاحه على الخادم (بنفس نمط GooglePlacesConnector.js
 * — لا مفتاح في العميل أبداً عند التفعيل لاحقاً).
 *
 * يسجّل المفتاح 'market.economicNews'.
 */

import { unavailable, registerConnector } from '../DataConnectors.js';

/** المفتاح الذي يسجّله هذا الموصّل. */
const KEY = 'market.economicNews';

/** نص التعذّر الموحّد — الحالة الحالية المتوقّعة (غير مُهيَّأ بعد). */
const NOT_CONFIGURED_NOTE = 'يحتاج مزوّد أخبار اقتصادية (مثل NewsAPI) لم يُهيَّأ بعد';

/**
 * موصّل «الأخبار الاقتصادية» — غير مُفعّل حالياً بانتظار قرار مزوّد.
 * @param {Object} [_context]
 * @returns {Promise<import('../DataConnectors.js').Datum>}
 */
async function economicNewsConnector(_context = {}) {
    return unavailable(NOT_CONFIGURED_NOTE);
}

// تسجيل ذاتي عند تحميل الوحدة.
registerConnector(KEY, economicNewsConnector);

export default economicNewsConnector;
