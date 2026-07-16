/**
 * منطق نقي (بلا Deno/شبكة) لوسيط places-nearby: بناء رابط استعلام Google Places
 * Nearby Search (Legacy) وتحليل استجابته إلى عدد مُشتقّ فقط. مفصول عن index.ts
 * بنفس نمط nameAvailability.ts ليُختبر عبر Vitest مباشرة دون Deno/شبكة حقيقية.
 *
 * type='restaurant' ثابت عمداً — يطابق نطاق قرار الحالي (مطاعم/مقاهي سعودية،
 * نفس تركيز فلتر OverpassConnector)، لا حاجة لبارامتر سياق إضافي اليوم.
 */

const DEFAULT_RADIUS_M = 1500;
const MIN_RADIUS_M = 50;
const MAX_RADIUS_M = 50000; // الحد الأقصى الذي تقبله Google لـ Nearby Search

/** يحصر نصف القطر ضمن مدى Google المقبول؛ قيمة غير صالحة/سالبة → الافتراضي. */
export function clampRadius(radiusMeters: number): number {
    const r = Number(radiusMeters);
    if (!Number.isFinite(r) || r <= 0) return DEFAULT_RADIUS_M;
    return Math.min(MAX_RADIUS_M, Math.max(MIN_RADIUS_M, r));
}

/** يبني رابط Google Places Nearby Search (Legacy) — لا يُرسل الطلب، فقط يبنيه. */
export function buildNearbySearchUrl(lat: number, lng: number, radiusMeters: number, apiKey: string): string {
    const params = new URLSearchParams({
        location: `${lat},${lng}`,
        radius: String(clampRadius(radiusMeters)),
        type: 'restaurant',
        key: apiKey,
    });
    return `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params.toString()}`;
}

/** يحلّل استجابة Nearby Search إلى عدد نتائج فقط — null عند استجابة غير صالحة/مرفوضة. */
export function parsePlacesCount(json: unknown): number | null {
    if (!json || typeof json !== 'object') return null;
    const body = json as { status?: unknown; results?: unknown };
    if (body.status === 'ZERO_RESULTS') return 0;
    if (body.status !== 'OK') return null;
    return Array.isArray(body.results) ? body.results.length : null;
}
