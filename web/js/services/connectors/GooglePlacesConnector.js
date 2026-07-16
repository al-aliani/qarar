/**
 * GooglePlacesConnector — المصدر المُفتاح (keyed) البوّابي «الآخر» لـ«قرار».
 *
 * ⚠️ حاسم — لا مفتاح Google في العميل أبداً:
 *   هذا الموصّل لا يحمل ولا يقرأ أي مفتاح Google API إطلاقاً. المفتاح يبقى
 *   على الخادم فقط. يستدعي هذا الموصّل Supabase Edge Function باسم
 *   'places-nearby' (عبر supabase.functions.invoke) — والخادم هو الذي يحمل
 *   المفتاح (GOOGLE_PLACES_API_KEY) ويستدعي Google.
 *
 * ⚠️ حاسم — الامتثال لشروط استخدام Google Places (ToS):
 *   سياسة Google Places تمنع «تخزين» محتوى المكان (الأسماء، التقييمات، القوائم).
 *   لذلك هذا الموصّل يُرجع فقط قيمة «عدد مُشتقّ» (count) — وربما كثافة —
 *   ولا يُرجع أبداً قائمة خام مُخزّنة من الأماكن (أسماء/تقييمات/عناوين).
 *   الخادم (Edge Function) هو المسؤول عن اشتقاق العدد فوراً دون تخزين المحتوى الخام.
 *
 *   ملاحظة مقصودة: «عدد العملاء اليومي المُقدّر» / «الأوقات الشائعة» (Popular Times)
 *   ليس له أي واجهة API قانونية من Google — ولذلك لا يُقدّمه هذا الموصّل عمداً.
 *   أي رقم من هذا النوع سيكون تخميناً/مخالفة، والمسار الأمين هو عدم تقديمه.
 *
 * الحالة الافتراضية عند أي عائق (لا جلسة مستخدم، لا مفتاح مضبوط على الخادم،
 * فشل شبكة): unavailable — لا نُخمّن أبداً، هذا سلوك متوقّع وليس خللاً.
 */

import { datum, unavailable, PROVENANCE, registerConnector } from '../DataConnectors.js';
import { getSupabaseClient } from '../../../supabaseClient.js';

/** المفتاح الذي يسجّله هذا الموصّل. */
const KEY = 'market.competitorsPrecise';

/** اسم Supabase Edge Function التي تحمل مفتاح Google وتستدعيه فعلياً. */
const FUNCTION_NAME = 'places-nearby';

/** نص التعذّر الموحّد — يُستخدم لأي عائق (بلا تمييز السبب للمستهلك). */
const NOT_CONFIGURED_NOTE =
    'Google Places غير مُتاح الآن — تعذّر الاتصال بخدمة البحث القريب (تحقق من تسجيل الدخول)';

/**
 * الاستدعاء المعزول لدالة Edge — مفصول في دالة مساعدة لسهولة الاختبار.
 * لا يرمي أبداً: يُرجع { ok, data } أو { ok:false } عند أي فشل/غياب جلسة/عميل.
 * @param {{lat:number,lng:number}} coords
 * @param {number} radiusMeters
 * @returns {Promise<{ok:boolean, data?:any}>}
 */
async function fetchNearby(coords, radiusMeters) {
    const { supabase, ok: clientOk } = await getSupabaseClient();
    if (!clientOk || !supabase) return { ok: false };

    try {
        const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
            body: { lat: coords.lat, lng: coords.lng, radiusMeters }
        });
        if (error || !data) return { ok: false };
        return { ok: true, data };
    } catch (_) {
        // فشل الشبكة/الاتصال → غير مُتاح. لا نرمي، لا نُخمّن.
        return { ok: false };
    }
}

/**
 * موصّل «المنافسون بدقّة» — عبر Supabase Edge Function فقط.
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

    // فشل الاستدعاء (لا جلسة/شبكة/الدالة أعادت خطأ) → الحالة الافتراضية الآمنة.
    if (!ok) return unavailable(NOT_CONFIGURED_NOTE);

    // الدالة تُرجع { count } فقط — عدد مُشتقّ، لا قائمة خام (امتثال ToS).
    const count = data && typeof data.count === 'number' ? data.count : null;
    if (count === null) return unavailable(NOT_CONFIGURED_NOTE);

    return datum({ count }, {
        unit: 'منشأة',
        source: 'Google Places (عبر Supabase Edge Function)',
        sourceUrl: 'https://developers.google.com/maps/documentation/places',
        provenance: PROVENANCE.SOURCED,
        note: 'عدد مُشتقّ فقط — لا تُخزّن القائمة الخام (قيد ToS)'
    });
}

// تسجيل ذاتي عند تحميل الوحدة.
registerConnector(KEY, googlePlacesConnector);

export default googlePlacesConnector;
