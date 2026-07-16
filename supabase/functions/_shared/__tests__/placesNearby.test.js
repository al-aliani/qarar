/**
 * اختبار منطق places-nearby عبر Vitest (Node) — نفس مبدأ nameAvailability.test.js:
 * الملف المصدر بلا أي API خاص بـDeno، فيعمل بلا تعديل رغم أن الوجهة الفعلية
 * Edge Function/Deno.
 */
import { describe, it, expect } from 'vitest';
import { clampRadius, buildNearbySearchUrl, parsePlacesCount } from '../placesNearby.ts';

describe('clampRadius', () => {
    it('يُبقي قيمة صالحة ضمن المدى كما هي', () => {
        expect(clampRadius(2000)).toBe(2000);
    });

    it('يحصر قيمة أكبر من الحد الأقصى عند 50000', () => {
        expect(clampRadius(999999)).toBe(50000);
    });

    it('يحصر قيمة أصغر من الحد الأدنى عند 50', () => {
        expect(clampRadius(5)).toBe(50);
    });

    it('قيمة غير صالحة/صفر/سالبة → الافتراضي 1500', () => {
        expect(clampRadius(0)).toBe(1500);
        expect(clampRadius(-100)).toBe(1500);
        expect(clampRadius(NaN)).toBe(1500);
    });
});

describe('buildNearbySearchUrl', () => {
    it('يبني رابطاً يحوي الإحداثيات ونصف القطر المحصور ونوع restaurant والمفتاح', () => {
        const url = buildNearbySearchUrl(24.7136, 46.6753, 2000, 'TEST_KEY');
        expect(url).toContain('https://maps.googleapis.com/maps/api/place/nearbysearch/json?');
        expect(url).toContain('location=24.7136%2C46.6753');
        expect(url).toContain('radius=2000');
        expect(url).toContain('type=restaurant');
        expect(url).toContain('key=TEST_KEY');
    });

    it('يستخدم نصف القطر الافتراضي المحصور عند قيمة غير صالحة', () => {
        const url = buildNearbySearchUrl(24.7, 46.6, -5, 'TEST_KEY');
        expect(url).toContain('radius=1500');
    });
});

describe('parsePlacesCount', () => {
    it('status=OK مع نتائج → عدد النتائج', () => {
        const count = parsePlacesCount({ status: 'OK', results: [{}, {}, {}] });
        expect(count).toBe(3);
    });

    it('status=ZERO_RESULTS → 0 (وليس null)', () => {
        expect(parsePlacesCount({ status: 'ZERO_RESULTS' })).toBe(0);
    });

    it('status مرفوض/خطأ (مثال REQUEST_DENIED) → null', () => {
        expect(parsePlacesCount({ status: 'REQUEST_DENIED' })).toBeNull();
    });

    it('مدخل غير صالح (null/غير كائن) → null', () => {
        expect(parsePlacesCount(null)).toBeNull();
        expect(parsePlacesCount(undefined)).toBeNull();
        expect(parsePlacesCount('x')).toBeNull();
    });

    it('status=OK بلا مصفوفة results → null', () => {
        expect(parsePlacesCount({ status: 'OK' })).toBeNull();
    });
});
