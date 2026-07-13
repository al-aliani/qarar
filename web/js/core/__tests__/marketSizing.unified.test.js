/**
 * حارس توحيد تحجيم السوق (2026-07-13) — يمنع عودة مرض «المسارين المتضاربين»:
 * كان اقتراح العصا 🪄 (SaudiDemographicsService) ولوحة القرار (SaudiMarketEngine)
 * يحسبان TAM/SAM/SOM بصيغتين مختلفتين وبنسختي سكان مختلفتين (انحراف حتى +40%
 * للخبر) — فيرى العميل رقمين متناقضين لنفس المدينة والقطاع في نفس الدراسة.
 * الآن كلاهما يشتق عبر core/marketSizingModel.js حصراً.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { analyzeSaudiMarket } from '../SaudiMarketEngine.js';
import { getTAMSuggestion } from '../../services/SaudiDemographicsService.js';
import { CITY_STATS } from '../../data/SaudiCityStats.js';
import { SECTOR_SIZING_RATES, deriveMarketSizing, nationalPopulation } from '../marketSizingModel.js';
import demographicsJson from '../../../data/SaudiDemographics.json';
import { SECTIONS } from '../schema.js';

// لا شبكة في الاختبار — يقارن اللقطة المستوردة وقت البناء بنفسها (المسار الحتمي)
beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('no network in test'))));
});

const study = (info = {}, marketSizing = {}) => ({
    [SECTIONS.PROJECT_INFO]: info,
    [SECTIONS.MARKET_SIZING]: marketSizing
});

describe('توحيد المسارين: العصا 🪄 ولوحة القرار يعطيان نفس الأرقام حرفياً', () => {
    const cases = [
        { city: 'الرياض', sector: 'مطعم' },
        { city: 'جدة', sector: 'قهوة' },
        { city: 'الدمام', sector: 'تجزئة' },
        { city: 'الخبر', sector: 'عيادة' } // الخبر = المدينة التي انحرف سكانها +40% سابقاً
    ];

    for (const { city, sector } of cases) {
        it(`${city} / ${sector}: TAM وSAM وSOM والسكان متطابقة في المسارين`, async () => {
            const engine = analyzeSaudiMarket(study({ city, concept: sector }), {});
            const wand = await getTAMSuggestion(city, sector);
            expect(engine.tam).toBe(wand.tam);
            expect(engine.sam).toBe(wand.sam);
            expect(engine.som).toBe(wand.som);
            expect(engine.population).toBe(wand.population);
        });
    }
});

describe('مصدر السكان الوحيد هو لقطة GASTAT — لا نسخ يدوية', () => {
    it('سكان المحرك = أرقام web/data/SaudiDemographics.json بالضبط (لا 7.5M اليدوية القديمة)', () => {
        const engine = analyzeSaudiMarket(study({ city: 'الرياض', concept: 'مطعم' }), {});
        expect(engine.population).toBe(demographicsJson.cities['الرياض'].population);
        expect(engine.population).toBe(7676654); // رقم التعداد، وليس 7,500,000 القديم
    });

    it('حارس: CITY_STATS لم يعد يحمل أي حقل population (النسخة الثالثة أُزيلت)', () => {
        for (const [name, entry] of Object.entries(CITY_STATS)) {
            expect(entry, `CITY_STATS['${name}'] يجب ألا يحمل population`).not.toHaveProperty('population');
        }
    });

    it('النشاط الرقمي (saas) يستخدم إجمالي المملكة من اللقطة — تعداد 2022 الرسمي', () => {
        const engine = analyzeSaudiMarket(study({ city: 'الرياض', concept: 'منصة برمجية SaaS اشتراكات' }), {});
        expect(engine.sectorKey).toBe('saas');
        expect(engine.population).toBe(32175224);
        expect(engine.population).toBe(nationalPopulation());
    });
});

describe('قيم المستخدم تتقدم دائماً على المشتق', () => {
    it('TAM المدخل يدوياً يُحترم ويتسلسل إلى SAM المشتق', () => {
        const engine = analyzeSaudiMarket(
            study({ city: 'الرياض', concept: 'مطعم' }, { tam: { value: 1_000_000_000 } }),
            {}
        );
        expect(engine.tam).toBe(1_000_000_000);
        expect(engine.source).toBe('user_input');
        // SAM يُشتق من قيمة المستخدم لا من تقديرنا (fnb: samRate=6%)
        expect(engine.sam).toBe(Math.round(1_000_000_000 * SECTOR_SIZING_RATES.fnb.samRate));
    });

    it('بلا إدخال يدوي يكون المصدر مشتقاً من اللقطة', () => {
        const engine = analyzeSaudiMarket(study({ city: 'الرياض', concept: 'مطعم' }), {});
        expect(engine.source).toBe('gastat_snapshot_derived');
    });
});

describe('وسم المصدر (provenance) على مخرجات المحرك', () => {
    it('السكان موسومون sourced والدخل والنِّسب assumption — لا رقم عارٍ', () => {
        const engine = analyzeSaudiMarket(study({ city: 'جدة', concept: 'مطعم' }), {});
        expect(engine.sources.population.provenance).toBe('sourced');
        expect(engine.sources.population.source).toMatch(/GASTAT|الإحصاء/);
        expect(engine.sources.population.year).toBe('2022');
        expect(engine.sources.incomePerCapita.provenance).toBe('assumption');
        expect(engine.sources.sectorShare.provenance).toBe('assumption');
        expect(engine.sources.samSom.provenance).toBe('assumption');
    });
});

describe('الاشتقاق الموحّد نفسه حتمي وثابت الترتيب', () => {
    it('deriveMarketSizing: تقريب كل مستوى قبل التالي (SOM من SAM المقرَّب)', () => {
        const r = deriveMarketSizing({
            population: 1000, incomeSAR: 333, sectorShare: 0.0333,
            samRate: 0.0777, somRate: 0.0333
        });
        expect(r.tam).toBe(Math.round(1000 * 333 * 0.0333));
        expect(r.sam).toBe(Math.round(r.tam * 0.0777));
        expect(r.som).toBe(Math.round(r.sam * 0.0333));
    });
});
