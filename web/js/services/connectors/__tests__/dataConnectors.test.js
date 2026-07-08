/**
 * Unit tests لطبقة موصّلات البيانات (DataConnectors + connectors/*).
 *
 * يعمل في node بلا شبكة حقيقية: نُبدّل global.fetch عبر vi.stubGlobal / vi.fn.
 * يغطّي: عقد Datum/unavailable + PROVENANCE، السجل (registerConnector/suggest)،
 * ومحلّلات Overpass / World Bank، والسلوك الافتراضي لـ Google Places (بلا proxy).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
    datum,
    unavailable,
    PROVENANCE,
    isUsable,
    suggest,
    registerConnector,
    availableKeys
} from '../../DataConnectors.js';

import {
    buildOverpassQuery,
    parseOverpassCount,
    overpassCompetitorsConnector
} from '../OverpassConnector.js';

import {
    parseWorldBankLatest,
    worldBankInflationConnector,
    worldBankGdpGrowthConnector
} from '../WorldBankConnector.js';

// استيراد فهرس الموصّلات لأثر التسجيل الذاتي (يسجّل كل المفاتيح في السجل).
import '../index.js';

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

// ── (أ) عقد datum()/unavailable() + قيم PROVENANCE ────────────────────────────
describe('DataConnectors — عقد Datum و PROVENANCE', () => {
    it('PROVENANCE يحمل القيم الأربع المتوقّعة', () => {
        expect(PROVENANCE.SOURCED).toBe('sourced');
        expect(PROVENANCE.DERIVED).toBe('derived');
        expect(PROVENANCE.ASSUMPTION).toBe('assumption');
        expect(PROVENANCE.UNAVAILABLE).toBe('unavailable');
    });

    it('datum() يعيد الشكل الموحّد بقيم افتراضية آمنة', () => {
        const d = datum(42, { unit: 'ريال', source: 'GASTAT', year: 2024 });
        expect(d).toEqual({
            value: 42,
            unit: 'ريال',
            source: 'GASTAT',
            sourceUrl: '',
            year: '2024',
            provenance: PROVENANCE.SOURCED,
            note: ''
        });
        // القيمة الافتراضية للـ provenance هي SOURCED حين لا تُمرَّر.
        expect(datum(1).provenance).toBe(PROVENANCE.SOURCED);
        // value=null عند تمرير null/undefined.
        expect(datum(null).value).toBeNull();
        expect(datum(undefined).value).toBeNull();
    });

    it('unavailable() يعلن التعذّر: value=null و provenance=unavailable', () => {
        const u = unavailable('تعذّر الجلب');
        expect(u.value).toBeNull();
        expect(u.provenance).toBe(PROVENANCE.UNAVAILABLE);
        expect(u.note).toBe('تعذّر الجلب');
        expect(isUsable(u)).toBe(false);
    });
});

// ── (ب) suggest لمفتاح غير موجود ─────────────────────────────────────────────
describe('suggest() — مفتاح غير موجود', () => {
    it("suggest('nonexistent.key') يعيد provenance=unavailable ولا يرمي", async () => {
        const d = await suggest('nonexistent.key');
        expect(d.provenance).toBe(PROVENANCE.UNAVAILABLE);
        expect(d.value).toBeNull();
        expect(isUsable(d)).toBe(false);
    });
});

// ── (ج) registerConnector + suggest roundtrip ────────────────────────────────
describe('registerConnector + suggest — رحلة ذهاب وإياب', () => {
    it('يسجّل موصّلاً ويعيد suggest نفس الـ Datum', async () => {
        const key = 'test.roundtrip';
        const expected = datum(123, { unit: 'وحدة', source: 'اختبار', provenance: PROVENANCE.SOURCED });
        registerConnector(key, () => expected);

        expect(availableKeys()).toContain(key);

        const got = await suggest(key, { any: 'ctx' });
        expect(got).toEqual(expected);
        expect(got.value).toBe(123);
        expect(isUsable(got)).toBe(true);
    });

    it('يمرّر السياق إلى الموصّل المسجّل', async () => {
        const spy = vi.fn(() => datum('ok'));
        registerConnector('test.ctx', spy);
        await suggest('test.ctx', { city: 'الرياض' });
        expect(spy).toHaveBeenCalledWith({ city: 'الرياض' });
    });
});

// ── (د) Overpass — محلّل + بناء الاستعلام + سلوك رفض fetch ────────────────────
describe('OverpassConnector — المحلّل وبناء الاستعلام', () => {
    it('parseOverpassCount يعدّ العناصر ويلتقط الأسماء فقط', () => {
        const json = { elements: [{ tags: { name: 'مطعم أ' } }, { tags: { name: 'كافيه ب' } }, {}] };
        const { count, sample } = parseOverpassCount(json);
        expect(count).toBe(3);
        expect(sample).toHaveLength(2);
        expect(sample.map(s => s.name)).toEqual(['مطعم أ', 'كافيه ب']);
    });

    it('parseOverpassCount يتعامل مع مدخل غير صالح دون رمي', () => {
        expect(parseOverpassCount(null)).toEqual({ count: 0, sample: [] });
        expect(parseOverpassCount({})).toEqual({ count: 0, sample: [] });
        expect(parseOverpassCount({ elements: 'x' })).toEqual({ count: 0, sample: [] });
    });

    it('buildOverpassQuery يبني Overpass QL يحوي الإحداثيات ونصف القطر ووسوم F&B', () => {
        const q = buildOverpassQuery(24.7136, 46.6753, 1200);
        expect(q).toContain('around:1200,24.7136,46.6753');
        expect(q).toContain('restaurant|fast_food|cafe');
        expect(q).toContain('[out:json]');
    });

    it("suggest('market.competitors') مع fetch مرفوض يعيد unavailable دون رمي", async () => {
        vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network down'))));
        const d = await suggest('market.competitors', { city: 'الرياض' });
        expect(d.provenance).toBe(PROVENANCE.UNAVAILABLE);
        expect(d.value).toBeNull();
    });

    it('overpassCompetitorsConnector مع fetch ناجح يعيد Datum SOURCED بالعدّ', async () => {
        const json = { elements: [{ tags: { name: 'مطعم أ' } }, { tags: { name: 'كافيه ب' } }, {}] };
        vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve(json)
        })));
        const d = await overpassCompetitorsConnector({ city: 'الرياض' });
        expect(d.provenance).toBe(PROVENANCE.SOURCED);
        expect(d.value.count).toBe(3);
        expect(d.value.sample).toHaveLength(2);
    });

    it("overpassCompetitorsConnector بلا مدينة/إحداثيات يعيد unavailable", async () => {
        vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })));
        const d = await overpassCompetitorsConnector({});
        expect(d.provenance).toBe(PROVENANCE.UNAVAILABLE);
    });
});

// ── (هـ) World Bank — المحلّل + تحويل التضخّم لكسر ────────────────────────────
describe('WorldBankConnector — المحلّل والتحويل', () => {
    it('parseWorldBankLatest يستخرج آخر قيمة عددية غير null', () => {
        const json = [{ page: 1 }, [{ date: '2024', value: 2.3 }]];
        expect(parseWorldBankLatest(json)).toEqual({ pct: 2.3, year: '2024' });
    });

    it('parseWorldBankLatest يتخطّى null ويرجع null لمدخل غير صالح', () => {
        expect(parseWorldBankLatest([{}, [{ date: '2024', value: null }, { date: '2023', value: 1.1 }]]))
            .toEqual({ pct: 1.1, year: '2023' });
        expect(parseWorldBankLatest(null)).toBeNull();
        expect(parseWorldBankLatest([{}])).toBeNull();
        expect(parseWorldBankLatest([{}, []])).toBeNull();
    });

    it('مفتاح التضخّم يحوّل النسبة إلى كسر (2.3% → 0.023)', async () => {
        const json = [{ page: 1 }, [{ date: '2024', value: 2.3 }]];
        vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve(json)
        })));
        const d = await worldBankInflationConnector();
        expect(d.provenance).toBe(PROVENANCE.SOURCED);
        expect(d.value).toBeCloseTo(0.023, 6);
        expect(d.year).toBe('2024');
    });

    it('مفتاح نمو الناتج يُبقي النسبة المئوية كما هي', async () => {
        const json = [{ page: 1 }, [{ date: '2024', value: 4.1 }]];
        vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve(json)
        })));
        const d = await worldBankGdpGrowthConnector();
        expect(d.provenance).toBe(PROVENANCE.SOURCED);
        expect(d.value).toBeCloseTo(4.1, 6);
        expect(d.unit).toBe('%');
    });

    it('fetch مرفوض يعيد unavailable دون رمي', async () => {
        vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('down'))));
        const d = await worldBankInflationConnector();
        expect(d.provenance).toBe(PROVENANCE.UNAVAILABLE);
    });
});

// ── (و) Google Places — الحالة الافتراضية (بلا proxy) ────────────────────────
describe('GooglePlacesConnector — الحالة الافتراضية بلا proxy', () => {
    it("suggest('market.competitorsPrecise') مع 404 يعيد unavailable (متوقّع)", async () => {
        vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 404 })));
        const d = await suggest('market.competitorsPrecise', { coords: { lat: 24.7, lng: 46.6 } });
        expect(d.provenance).toBe(PROVENANCE.UNAVAILABLE);
        expect(d.value).toBeNull();
    });

    it("suggest('market.competitorsPrecise') مع fetch مرفوض يعيد unavailable", async () => {
        vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('down'))));
        const d = await suggest('market.competitorsPrecise', { coords: { lat: 24.7, lng: 46.6 } });
        expect(d.provenance).toBe(PROVENANCE.UNAVAILABLE);
    });
});
