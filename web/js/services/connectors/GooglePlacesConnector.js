/**
 * GooglePlacesConnector — المصدر المُفتاح (keyed) البوّابي «الآخر» لـ«قرار».
 *
 * ⚠️ حاسم — لا مفتاح Google في العميل أبداً:
 *   هذا الموصّل لا يحمل ولا يقرأ أي مفتاح Google API إطلاقاً. المفتاح يبقى
 *   على الخادم فقط. يتصل هذا الموصّل بـ proxy خادمي على نفس الأصل (same-origin)
 *   عبر '/api/places/nearby' — والخادم هو الذي يحمل المفتاح ويستدعي Google.
 *
 * ⚠️ حاسم — الامتثال لشروط استخدام Google Places (ToS):
 *   سياسة Google Places تمنع «تخزين» محتوى المكان (الأسماء، التقييمات، القوائم).
 *   لذلك هذا الموصّل يُرجع فقط قيمة «عدد مُشتقّ» (count) — وربما كثافة —
 *   ولا يُرجع أبداً قائمة خام مُخزّنة من الأماكن (أسماء/تقييمات/عناوين).
 *   الخادم (proxy) هو المسؤول عن اشتقاق العدد فوراً دون تخزين المحتوى الخام.
 *
 *   ملاحظة مقصودة: «عدد العملاء اليومي المُقدّر» / «الأوقات الشائعة» (Popular Times)
 *   ليس له أي واجهة API قانونية من Google — ولذلك لا يُقدّمه هذا الموصّل عمداً.
 *   أي رقم من هذا النوع سيكون تخميناً/مخالفة، والمسار الأمين هو عدم تقديمه.
 *
 * الحالة الافتراضية اليوم: الـ proxy غير مُفعّل (المرحلة 2) → يُرجع unavailable.
 * هذا هو السلوك المتوقّع، لا خطأ.
 */

import { datum, unavailable, PROVENANCE, registerConnector } from '../DataConnectors.js';

/** المفتاح الذي يسجّله هذا الموصّل. */
const KEY = 'market.competitorsPrecise';

/** مسار الـ proxy الخادمي على نفس الأصل — الخادم يحمل المفتاح. */
const PROXY_PATH = '/api/places/nearby';

/** نص التعذّر الموحّد — الحالة الافتراضية المتوقّعة اليوم. */
const NOT_CONFIGURED_NOTE =
    'Google Places غير مُفعّل — يتطلب proxy خادمياً يحمل المفتاح (المرحلة 2)';

/**
 * حساب أصل الطلب (base URL) — من window.location.origin إن توفّر، وإلا ''.
 * في بيئة node (الاختبارات) لا يوجد window → نستخدم '' (مسار نسبي).
 * @returns {string}
 */
function baseUrl() {
    try {
        if (typeof window !== 'undefined' && window.location && window.location.origin) {
            return window.location.origin;
        }
    } catch (_) { /* تجاهل — بيئة بلا window */ }
    return '';
}

/**
 * الجلب المعزول من الـ proxy — مفصول في دالة مساعدة لسهولة الاختبار.
 * لا يرمي أبداً: يُرجع { ok, data } أو { ok:false } عند أي فشل/غياب fetch.
 * @param {{lat:number,lng:number}} coords
 * @param {number} radiusMeters
 * @returns {Promise<{ok:boolean, data?:any}>}
 */
async function fetchNearby(coords, radiusMeters) {
    // حارس node/بيئة بلا fetch — لا proxy يعني الحالة الافتراضية (غير مُفعّل).
    if (typeof fetch !== 'function') return { ok: false };

    try {
        const res = await fetch(`${baseUrl()}${PROXY_PATH}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ coords, radiusMeters })
        });
        // 404 (proxy غير منشور) أو أي حالة غير ناجحة → غير مُفعّل.
        if (!res || !res.ok) return { ok: false };
        const data = await res.json();
        return { ok: true, data };
    } catch (_) {
        // فشل الشبكة/التحليل → غير مُفعّل. لا نرمي، لا نُخمّن.
        return { ok: false };
    }
}

/**
 * موصّل «المنافسون بدقّة» — عبر proxy خادمي فقط.
 * @param {{coords?:{lat:number,lng:number}, radiusMeters?:number}} [context]
 * @returns {Promise<import('../DataConnectors.js').Datum>}
 */
async function googlePlacesConnector(context = {}) {
    const coords = context && context.coords;
    // بلا إحداثيات لا يمكن الاستعلام — أعلن التعذّر بدل التخمين.
    if (!coords || typeof coords.lat !== 'number' || typeof coords.lng !== 'number') {
        return unavailable(NOT_CONFIGURED_NOTE);
    }

    const radiusMeters = typeof context.radiusMeters === 'number' && context.radiusMeters > 0
        ? context.radiusMeters
        : 1500;

    const { ok, data } = await fetchNearby(coords, radiusMeters);

    // proxy غير مُفعّل (fetch فشل / 404 / غير ناجح) → الحالة الافتراضية المتوقّعة.
    if (!ok) return unavailable(NOT_CONFIGURED_NOTE);

    // الـ proxy يُرجع { count } فقط — عدد مُشتقّ، لا قائمة خام (امتثال ToS).
    const count = data && typeof data.count === 'number' ? data.count : null;
    if (count === null) return unavailable(NOT_CONFIGURED_NOTE);

    return datum({ count }, {
        unit: 'منشأة',
        source: 'Google Places (عبر proxy)',
        sourceUrl: 'https://developers.google.com/maps/documentation/places',
        provenance: PROVENANCE.SOURCED,
        note: 'عدد مُشتقّ فقط — لا تُخزّن القائمة الخام (قيد ToS)'
    });
}

// تسجيل ذاتي عند تحميل الوحدة.
registerConnector(KEY, googlePlacesConnector);

export default googlePlacesConnector;
