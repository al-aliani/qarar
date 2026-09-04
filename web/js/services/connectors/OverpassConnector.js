/**
 * OverpassConnector — عدّ منشآت الأغذية والمشروبات المنافِسة القريبة من موقع المشروع.
 *
 * البديل الحقيقي والحيّ لـ«CompetitorScout» المزيّف: يستعلم واجهة OpenStreetMap
 * Overpass API المجانية (بلا مفتاح) ويعدّ عُقَد/مسارات المطاعم والوجبات السريعة
 * والمقاهي ضمن نصف قطر حول الإحداثيات المُعطاة.
 *
 * يسجّل المفتاح 'market.competitors'.
 *
 * ملاحظة عن التغطية: بيانات OSM شحيحة في الأحياء الجديدة — لذا عند count=0 لا نُخمّن
 * غياب المنافسة، بل نُنبّه إلى احتمال نقص التغطية في الملاحظة (note).
 */

import { datum, unavailable, PROVENANCE, registerConnector } from '../DataConnectors.js';

/** نقطة مركز المدينة (lat,lng) للمدن السعودية الكبرى — تُستخدم حين تغيب الإحداثيات. */
export const CITY_CENTROIDS = Object.freeze({
    'الرياض': { lat: 24.7136, lng: 46.6753 },
    'جدة': { lat: 21.4858, lng: 39.1925 },
    'مكة': { lat: 21.3891, lng: 39.8579 },
    'مكة المكرمة': { lat: 21.3891, lng: 39.8579 },
    'المدينة': { lat: 24.5247, lng: 39.5692 },
    'المدينة المنورة': { lat: 24.5247, lng: 39.5692 },
    'الدمام': { lat: 26.4207, lng: 50.0888 },
    'الخبر': { lat: 26.2794, lng: 50.2083 },
    'الطائف': { lat: 21.2703, lng: 40.4158 },
    'تبوك': { lat: 28.3838, lng: 36.5550 },
    'بريدة': { lat: 26.3260, lng: 43.9750 },
    'أبها': { lat: 18.2164, lng: 42.5053 },
    'خميس مشيط': { lat: 18.3000, lng: 42.7333 },
    'حائل': { lat: 27.5219, lng: 41.6907 },
    'جازان': { lat: 16.8892, lng: 42.5511 },
    'نجران': { lat: 17.4924, lng: 44.1277 },
    'القطيف': { lat: 26.5196, lng: 49.9962 }
});

const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';
const DEFAULT_RADIUS_M = 1500;

/**
 * وسوم OpenStreetMap لكل قطاع. تدقيق 2026-09-04 (رحلة عميل صالون حلاقة): كان
 * الاستعلام مثبَّتاً على amenity=restaurant|fast_food|cafe لأي مشروع مهما كان نشاطه —
 * فيضغط صاحب الصالون/العيادة «اكتشف المنافسين» فتُحقن مطاعم الحي في مصفوفة منافسيه،
 * بنصّ يؤكد أنها «منشآت قريبة فعلياً (OpenStreetMap)»، ثم تُصدَّر في الدراسة التي
 * يقرؤها الممول. كل مجموعة هنا مقاطع Overpass QL جاهزة (بلا around — يُضاف عند البناء).
 */
const SECTOR_OSM_FILTERS = Object.freeze({
    fnb: ['["amenity"~"^(restaurant|fast_food|cafe)$"]'],
    beauty: ['["shop"~"^(hairdresser|beauty)$"]', '["leisure"="spa"]'],
    health: ['["amenity"~"^(clinic|doctors|dentist|pharmacy)$"]', '["healthcare"]'],
    fitness: ['["leisure"="fitness_centre"]', '["sport"="fitness"]'],
    education: ['["amenity"~"^(school|college|language_school|driving_school)$"]'],
    laundry: ['["shop"~"^(laundry|dry_cleaning)$"]'],
    carRepair: ['["shop"~"^(car_repair|tyres|car_parts)$"]'],
    retail: ['["shop"~"^(supermarket|convenience|clothes|department_store|mall)$"]'],
});

/** يستنتج مفتاح القطاع من نص النشاط. أول مطابقة تفوز — الخدمي قبل التجزئة عمداً. */
export function detectOsmSectorKey(conceptText) {
    const t = String(conceptText || '');
    if (!t.trim()) return null;
    if (/صالون|تجميل|حلاق|مشغل|سبا|spa/i.test(t)) return 'beauty';
    if (/عيادة|صحي|طبي|أسنان|صيدلي|مختبر/i.test(t)) return 'health';
    if (/رياض|لياقة|نادي|جيم|صالة رياضية/i.test(t)) return 'fitness';
    if (/تعليم|تدريب|مدرسة|حضانة|روضة|معهد/i.test(t)) return 'education';
    if (/مغسلة|غسيل|تنظيف جاف|كوي/i.test(t)) return 'laundry';
    if (/ورشة|صيانة سيارات|كهرباء سيارات|إطارات/i.test(t)) return 'carRepair';
    if (/مطعم|مقهى|كافيه|قهوة|مخبز|حلويات|وجبات|طعام|مطبخ|عربة طعام|ضيافة/i.test(t)) return 'fnb';
    if (/تجزئة|بقالة|متجر|سوبرماركت|بوتيك|أزياء|ملابس|عطور/i.test(t)) return 'retail';
    return null;
}

/**
 * بناء استعلام Overpass QL يعدّ المنشآت المنافِسة حول نقطة ضمن نصف قطر، بوسوم
 * القطاع المطابق. مُصدَّر ليتمكّن الاختبار من التحقق منه دون شبكة.
 * @param {number} lat
 * @param {number} lng
 * @param {number} [radiusMeters=1500]
 * @param {string} [conceptText] نشاط المشروع — يحدّد وسوم OSM المستخدَمة
 * @returns {string} نص الاستعلام
 */
export function buildOverpassQuery(lat, lng, radiusMeters = DEFAULT_RADIUS_M, conceptText = '') {
    const r = Number(radiusMeters) > 0 ? Number(radiusMeters) : DEFAULT_RADIUS_M;
    // بلا قطاع معروف نبقى على F&B (السلوك التاريخي) — الموصّل نفسه يمتنع عن الاستدعاء
    // عند غياب القطاع كي لا يعرض مطاعم كمنافسين لنشاط آخر.
    const key = detectOsmSectorKey(conceptText) || 'fnb';
    const filters = SECTOR_OSM_FILTERS[key];
    // nwr = node|way|relation. out tags center = وسوم (للأسماء) + مركز إحداثي لكل عنصر
    // (nodes تملكه أصلاً، وways/relations يُحتسب لها بـ"center") — لازم لعرض خريطة
    // المنافسين، ببيانات أخفّ من geometry كاملة.
    const body = filters.map(f => `  nwr${f}(around:${r},${lat},${lng});`).join('\n');
    return `[out:json][timeout:25];
(
${body}
);
out tags center;`;
}

/**
 * تحليل استجابة Overpass JSON إلى عدد وعيّنة أسماء + إحداثيات (حين تتوفر).
 * مُصدَّر ليتمكّن الاختبار من تمريره كائناً وهمياً دون شبكة.
 * @param {Object} json  جسم استجابة Overpass المُحلَّل
 * @returns {{ count:number, sample:Array<{name:string, lat?:number, lng?:number}> }}
 */
export function parseOverpassCount(json) {
    const elements = Array.isArray(json?.elements) ? json.elements : [];
    const count = elements.length;
    const sample = [];
    for (const el of elements) {
        if (sample.length >= 8) break;
        const name = el?.tags?.name;
        if (typeof name === 'string' && name.trim()) {
            // nodes: lat/lon مباشرة على العنصر. ways/relations: center.lat/center.lon (بفضل "out center").
            const lat = Number(el?.lat ?? el?.center?.lat);
            const lng = Number(el?.lon ?? el?.center?.lon);
            const entry = { name: name.trim() };
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
                entry.lat = lat;
                entry.lng = lng;
            }
            sample.push(entry);
        }
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
 * الموصّل: يعيد Datum يحوي عدد المنافسين وعيّنة — لا يرمي أبداً.
 * @param {{coords?:{lat:number,lng:number}, city?:string, radiusMeters?:number}} context
 * @returns {Promise<import('../DataConnectors.js').Datum>}
 */
export async function overpassCompetitorsConnector(context = {}) {
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

    // بلا نشاط معروف لا نُخمّن: عرض مطاعم كمنافسين لنشاط غير غذائي أسوأ من عدم العرض،
    // لأن الواجهة تصف النتيجة بأنها منشآت «قريبة فعلياً» وتُصدَّر في الدراسة للممول.
    const sectorKey = detectOsmSectorKey(context?.concept);
    if (!sectorKey) {
        return unavailable('حدّد نشاط المشروع أولاً لاكتشاف منافسين من نفس القطاع');
    }

    const query = buildOverpassQuery(coords.lat, coords.lng, radiusMeters, context.concept);

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
        const { count, sample } = parseOverpassCount(json);

        const coverageCaveat = count === 0
            ? ' — لم تُرصد منشآت؛ قد يعود ذلك لشحّ تغطية OSM في الأحياء الجديدة وليس بالضرورة غياب المنافسة'
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
registerConnector('market.competitors', overpassCompetitorsConnector);

export default overpassCompetitorsConnector;
