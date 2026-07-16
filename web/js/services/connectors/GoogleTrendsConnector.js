/**
 * GoogleTrendsConnector — اتجاه الطلب (البحث) لقطاع/منتج معيّن بمرور الوقت.
 *
 * لا توجد واجهة Google Trends API رسمية مجانية اليوم — البدائل هي إمّا أدوات
 * غير رسمية (تنتهك ToS ولا تُوثَّق كمصدر) أو مزوّدون خارجيون مدفوعون (مثل
 * SerpApi) يتطلّبون قراراً تجارياً ومفتاحاً. لذلك هذا الموصّل مُهيَّأ بالكامل
 * (مسجَّل وجاهز للاستهلاك عبر suggest()) لكنه يُعيد unavailable دائماً إلى أن
 * يُختار مزوّد ويُضاف مفتاحه على الخادم (بنفس نمط GooglePlacesConnector.js —
 * لا مفتاح في العميل أبداً عند التفعيل لاحقاً).
 *
 * يسجّل المفتاح 'market.demandTrend'.
 */

import { unavailable, registerConnector } from '../DataConnectors.js';

/** المفتاح الذي يسجّله هذا الموصّل. */
const KEY = 'market.demandTrend';

/** نص التعذّر الموحّد — الحالة الحالية المتوقّعة (غير مُهيَّأ بعد). */
const NOT_CONFIGURED_NOTE = 'يحتاج مزوّد بيانات اتجاهات البحث (مثل SerpApi) لم يُهيَّأ بعد';

/**
 * موصّل «اتجاه الطلب» — غير مُفعّل حالياً بانتظار قرار مزوّد.
 * @param {Object} [_context]
 * @returns {Promise<import('../DataConnectors.js').Datum>}
 */
async function googleTrendsConnector(_context = {}) {
    return unavailable(NOT_CONFIGURED_NOTE);
}

// تسجيل ذاتي عند تحميل الوحدة.
registerConnector(KEY, googleTrendsConnector);

export default googleTrendsConnector;
