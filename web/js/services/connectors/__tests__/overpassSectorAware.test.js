/**
 * تدقيق 2026-09-04 — رحلة عميل صالون حلاقة: زر «اكتشف المنافسين» كان يبني استعلاماً
 * مثبَّتاً على amenity=restaurant|fast_food|cafe لأي مشروع مهما كان نشاطه، بلا أي
 * تفريع قطاعي. النتيجة أن صاحب صالون أو عيادة يحصل على مطاعم الحي في مصفوفة
 * منافسيه — وتُعرض له برسالة تؤكد أنها «منشآت قريبة فعلياً (OpenStreetMap)»، ثم
 * تُصدَّر في الدراسة التي يقرؤها الممول.
 */
import { describe, it, expect } from 'vitest';
import {
    buildOverpassQuery,
    detectOsmSectorKey,
    overpassCompetitorsConnector,
} from '../OverpassConnector.js';
import { isUsable, PROVENANCE } from '../../DataConnectors.js';

describe('اكتشاف المنافسين: وسوم OSM تتبع قطاع المشروع', () => {
    it('الصالون يبحث عن صالونات ومراكز تجميل لا مطاعم', () => {
        const q = buildOverpassQuery(24.7136, 46.6753, 1500, 'صالون / مركز تجميل');
        expect(q).toContain('hairdresser');
        expect(q).toContain('beauty');
        expect(q).not.toContain('restaurant');
        expect(q).not.toContain('cafe');
    });

    it('العيادة تبحث عن منشآت صحية', () => {
        const q = buildOverpassQuery(24.7, 46.6, 1500, 'رعاية صحية / عيادة');
        expect(q).toMatch(/clinic|doctors|dentist|healthcare/);
        expect(q).not.toContain('restaurant');
    });

    it('لا انحدار: المطعم ما زال يبحث عن مطاعم ومقاهٍ', () => {
        const q = buildOverpassQuery(24.7, 46.6, 1500, 'مطعم');
        expect(q).toContain('restaurant');
        expect(q).toContain('cafe');
    });

    it.each([
        ['صالون / مركز تجميل', 'beauty'],
        ['رعاية صحية / عيادة', 'health'],
        ['رياضة ولياقة / صالة رياضية', 'fitness'],
        ['تعليم وتدريب', 'education'],
        ['مغسلة ملابس', 'laundry'],
        ['كافيه/مقهى مختص', 'fnb'],
        ['متجر تجزئة / بقالة / سوبرماركت', 'retail'],
    ])('«%s» ⟶ %s', (concept, key) => {
        expect(detectOsmSectorKey(concept)).toBe(key);
    });

    it('نشاط غير معروف ⟶ لا مفتاح (فلا نعرض مطاعم كمنافسين افتراضاً)', () => {
        expect(detectOsmSectorKey('فن الخط العربي')).toBeNull();
        expect(detectOsmSectorKey('')).toBeNull();
    });

    it('الموصّل يمتنع عن الاستدعاء بلا نشاط معروف بدل إرجاع مطاعم', async () => {
        const result = await overpassCompetitorsConnector({ city: 'الرياض' });
        expect(isUsable(result)).toBe(false);
        expect(result.provenance).toBe(PROVENANCE.UNAVAILABLE);
        expect(String(result.note || '')).toMatch(/نشاط/);
    });
});
