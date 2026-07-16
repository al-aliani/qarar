/**
 * ChamberSuppliersConnector — بحث حيّ عن موردين محتملين قريبين من موقع المشروع.
 *
 * البديل الحقيقي (لا اختراع غرفة تجارية إلكترونية غير موجودة): يستعلم نفس واجهة
 * OpenStreetMap Overpass API المجانية المستخدمة في OverpassConnector، لكن بوسوم
 * منشآت توريد/تجارة بالجملة بدل وسوم الأغذية والمشروبات: shop=wholesale، office=*،
 * craft=* — منشآت يُرجَّح أنها تلعب دور مورّد محلي (تجارة جملة، مكاتب تجارية، حرفيون).
 *
 * يسجّل المفتاح 'market.suppliers'.
 *
 * ملاحظة عن التغطية: كما في OverpassConnector — عند count=0 لا نُخمّن غياب الموردين،
 * بل نُنبّه لاحتمال نقص تغطية OSM في الملاحظة (note).
 */

import { datum, unavailable, PROVENANCE, registerConnector } from '../DataConnectors.js';
import { CITY_CENTROIDS } from './OverpassConnector.js';

const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';
const DEFAULT_RADIUS_M = 1500;

/**
 * بناء استعلام Overpass QL يعدّ منشآت توريد/تجارة محتملة حول نقطة ضمن نصف قطر.
 * مُصدَّر ليتمكّن الاختبار من التحقق منه دون شبكة.
 * @param {number} lat
 * @param {number} lng
 * @param {number} [radiusMeters=1500]
 * @returns {string} نص الاستعلام
 */
export function buildSuppliersQuery(lat, lng, radiusMeters = DEFAULT_RADIUS_M) {
    const r = Number(radiusMeters) > 0 ? Number(radiusMeters) : DEFAULT_RADIUS_M;
    // shop=wholesale: تجارة جملة صريحة. office=* (أي قيمة): مكاتب تجارية/تجارية عامة
    // قد تعمل كمورّد. craft=* (أي قيمة): حرفيون (نجارة، حدادة...) قد يكونون مورّداً
    // محلياً لمواد/خدمات تصنيع صغيرة. out tags center كما في OverpassConnector.
    return `[out:json][timeout:25];
(
  nwr["shop"="wholesale"](around:${r},${lat},${lng});
  nwr["office"](around:${r},${lat},${lng});
  nwr["craft"](around:${r},${lat},${lng});
);
out tags center;`;
}

/**
 * تحليل استجابة Overpass JSON إلى عدد وعيّنة أسماء + إحداثيات ونوع المنشأة (kind).
 * مُصدَّر ليتمكّن الاختبار من تمريره كائناً وهمياً دون شبكة.
 * @param {Object} json  جسم استجابة Overpass المُحلَّل
 * @returns {{ count:number, sample:Array<{name:string, lat?:number, lng?:number, kind?:string}> }}
 */
export function parseSuppliersResult(json) {
    const elements = Array.isArray(json?.elements) ? json.elements : [];
    const count = elements.length;
    const sample = [];
    for (const el of elements) {
        if (sample.length >= 8) break;
        const tags = el?.tags || {};
        const name = tags.name;
        if (typeof name !== 'string' || !name.trim()) continue;

        let kind;
        if (tags.shop === 'wholesale') kind = 'shop';
        else if (tags.office) kind = 'office';
        else if (tags.craft) kind = 'craft';

        const entry = { name: name.trim() };
        if (kind) entry.kind = kind;

        // nodes: lat/lon مباشرة على العنصر. ways/relations: center.lat/center.lon.
        const lat = Number(el?.lat ?? el?.center?.lat);
        const lng = Number(el?.lon ?? el?.center?.lon);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
            entry.lat = lat;
            entry.lng = lng;
        }
        sample.push(entry);
    }
    return { count, sample };
}

/**
 * حلّ الإحداثيات من السياق: coords صريحة أولاً، وإلا مركز المدينة المعروفة.
 * @param {Object} context
 * @returns {{lat:number,lng:number}|null}
 */
function resolveCoords(context) {
    const c = context?.coords;
    if (c && Number.isFinite(Number(c.lat)) && Number.isFinite(Number(c.lng))) {
        return { lat: Number(c.lat), lng: Number(c.lng) };
    }
    const city = typeof context?.city === 'string' ? context.city.trim() : '';
    if (city && CITY_CENTROIDS[city]) {
        return { ...CITY_CENTROIDS[city] };
    }
    return null;
}

/**
 * الموصّل: يعيد Datum يحوي عدد الموردين المحتملين وعيّنة — لا يرمي أبداً.
 * @param {{coords?:{lat:number,lng:number}, city?:string, radiusMeters?:number}} context
 * @returns {Promise<import('../DataConnectors.js').Datum>}
 */
export async function chamberSuppliersConnector(context = {}) {
    // حارس بيئة node/الاختبارات: لا fetch → لا نُخمّن، نعلن التعذّر.
    if (typeof fetch === 'undefined') {
        return unavailable('تعذّر الاتصال بـ Overpass');
    }

    const coords = resolveCoords(context);
    if (!coords) {
        return unavailable('لم تُحدد إحداثيات أو مدينة معروفة');
    }

    const radiusMeters = Number(context?.radiusMeters) > 0
        ? Number(context.radiusMeters)
        : DEFAULT_RADIUS_M;

    const query = buildSuppliersQuery(coords.lat, coords.lng, radiusMeters);

    try {
        const response = await fetch(OVERPASS_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Qarar-FeasibilityStudy/1.0 (data-connector)'
            },
            body: 'data=' + encodeURIComponent(query)
        });

        if (!response || !response.ok) {
            return unavailable('تعذّر الاتصال بـ Overpass');
        }

        const json = await response.json();
        const { count, sample } = parseSuppliersResult(json);

        const coverageCaveat = count === 0
            ? ' — لم تُرصد منشآت؛ قد يعود ذلك لشحّ تغطية OSM في الأحياء الجديدة وليس بالضرورة غياب موردين فعليين'
            : '';

        return datum(
            { count, sample, radiusMeters, center: coords },
            {
                unit: 'منشأة',
                source: 'OpenStreetMap (Overpass)',
                sourceUrl: 'https://www.openstreetmap.org/copyright',
                provenance: PROVENANCE.SOURCED,
                note: '© OpenStreetMap contributors (ODbL) — عدّ حيّ وقت الدراسة' + coverageCaveat
            }
        );
    } catch (e) {
        return unavailable('تعذّر الاتصال بـ Overpass');
    }
}

// تسجيل ذاتي عند تحميل الوحدة.
registerConnector('market.suppliers', chamberSuppliersConnector);

export default chamberSuppliersConnector;
