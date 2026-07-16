/**
 * Unit tests لـ ChamberSuppliersConnector — يماثل بنية اختبار OverpassConnector في
 * dataConnectors.test.js: يعمل في node بلا شبكة حقيقية (vi.stubGlobal('fetch', ...)).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';

import { PROVENANCE, isUsable, suggest } from '../../DataConnectors.js';

import {
    buildSuppliersQuery,
    parseSuppliersResult,
    chamberSuppliersConnector
} from '../ChamberSuppliersConnector.js';

// استيراد فهرس الموصّلات لأثر التسجيل الذاتي (يسجّل كل المفاتيح في السجل، بما فيها market.suppliers).
import '../index.js';

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('ChamberSuppliersConnector — المحلّل وبناء الاستعلام', () => {
    it('buildSuppliersQuery يبني Overpass QL يحوي الإحداثيات ونصف القطر ووسوم shop/office/craft', () => {
        const q = buildSuppliersQuery(24.7136, 46.6753, 1200);
        expect(q).toContain('around:1200,24.7136,46.6753');
        expect(q).toContain('"shop"="wholesale"');
        expect(q).toContain('"office"');
        expect(q).toContain('"craft"');
        expect(q).toContain('[out:json]');
    });

    it('buildSuppliersQuery يستخدم نصف القطر الافتراضي عند قيمة غير صالحة', () => {
        const q = buildSuppliersQuery(24.7136, 46.6753, -5);
        expect(q).toContain('around:1500,24.7136,46.6753');
    });

    it('parseSuppliersResult يعدّ العناصر ويلتقط الأسماء فقط', () => {
        const json = {
            elements: [
                { tags: { name: 'مؤسسة الجملة الحديثة', shop: 'wholesale' } },
                { tags: { name: 'مكتب الخليج التجاري', office: 'company' } },
                { tags: { name: 'ورشة النجارة العربية', craft: 'carpenter' } },
                {} // بلا تاغات/اسم — يُتجاهل
            ]
        };
        const { count, sample } = parseSuppliersResult(json);
        expect(count).toBe(4);
        expect(sample).toHaveLength(3);
        expect(sample.map(s => s.name)).toEqual([
            'مؤسسة الجملة الحديثة',
            'مكتب الخليج التجاري',
            'ورشة النجارة العربية'
        ]);
    });

    it('parseSuppliersResult يشتق kind من الوسم المطابق (shop/office/craft)', () => {
        const json = {
            elements: [
                { tags: { name: 'أ', shop: 'wholesale' } },
                { tags: { name: 'ب', office: 'yes' } },
                { tags: { name: 'ج', craft: 'electrician' } }
            ]
        };
        const { sample } = parseSuppliersResult(json);
        expect(sample.map(s => s.kind)).toEqual(['shop', 'office', 'craft']);
    });

    it('parseSuppliersResult يلتقط lat/lng حين تتوفر (node مباشرة أو center لـ way/relation)', () => {
        const json = {
            elements: [
                { tags: { name: 'أ', shop: 'wholesale' }, lat: 24.71, lon: 46.67 },
                { tags: { name: 'ب', office: 'yes' }, center: { lat: 24.72, lon: 46.68 } }
            ]
        };
        const { sample } = parseSuppliersResult(json);
        expect(sample[0]).toMatchObject({ lat: 24.71, lng: 46.67 });
        expect(sample[1]).toMatchObject({ lat: 24.72, lng: 46.68 });
    });

    it('parseSuppliersResult يتعامل مع مدخل غير صالح دون رمي', () => {
        expect(parseSuppliersResult(null)).toEqual({ count: 0, sample: [] });
        expect(parseSuppliersResult({})).toEqual({ count: 0, sample: [] });
        expect(parseSuppliersResult({ elements: 'x' })).toEqual({ count: 0, sample: [] });
    });

    it('sample محدودة بـ8 عناصر كحد أقصى', () => {
        const json = {
            elements: Array.from({ length: 12 }, (_, i) => ({ tags: { name: `مورد ${i}`, shop: 'wholesale' } }))
        };
        const { count, sample } = parseSuppliersResult(json);
        expect(count).toBe(12);
        expect(sample).toHaveLength(8);
    });

    it("suggest('market.suppliers') مع fetch مرفوض يعيد unavailable دون رمي", async () => {
        vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network down'))));
        const d = await suggest('market.suppliers', { city: 'الرياض' });
        expect(d.provenance).toBe(PROVENANCE.UNAVAILABLE);
        expect(d.value).toBeNull();
    });

    it('chamberSuppliersConnector مع fetch ناجح يعيد Datum SOURCED بالعدّ والعيّنة', async () => {
        const json = {
            elements: [
                { tags: { name: 'مؤسسة الجملة الحديثة', shop: 'wholesale' } },
                { tags: { name: 'مكتب الخليج التجاري', office: 'company' } },
                {}
            ]
        };
        vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve(json)
        })));
        const d = await chamberSuppliersConnector({ city: 'الرياض' });
        expect(d.provenance).toBe(PROVENANCE.SOURCED);
        expect(d.value.count).toBe(3);
        expect(d.value.sample).toHaveLength(2);
        expect(d.source).toBe('OpenStreetMap (Overpass)');
        expect(isUsable(d)).toBe(true);
    });

    it('chamberSuppliersConnector بلا مدينة/إحداثيات يعيد unavailable', async () => {
        vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })));
        const d = await chamberSuppliersConnector({});
        expect(d.provenance).toBe(PROVENANCE.UNAVAILABLE);
    });

    it('chamberSuppliersConnector مع استجابة غير ناجحة (ok:false) يعيد unavailable', async () => {
        vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false })));
        const d = await chamberSuppliersConnector({ city: 'الرياض' });
        expect(d.provenance).toBe(PROVENANCE.UNAVAILABLE);
    });

    it("موصّل 'market.suppliers' مسجّل في السجل الموحّد (لا 'لا يوجد موصّل')", async () => {
        vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network down'))));
        const d = await suggest('market.suppliers', { city: 'الرياض' });
        expect(d.note).not.toMatch(/لا يوجد موصّل/);
    });
});
