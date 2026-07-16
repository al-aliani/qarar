/**
 * marketSizingModel — المصدر الوحيد لاشتقاق تحجيم السوق (TAM/SAM/SOM) في «قرار».
 *
 * لماذا وُجد (توحيد 2026-07-13): كان هناك مساران متوازيان يحسبان TAM لنفس الدراسة
 * بنتيجتين مختلفتين أمام العميل نفسه:
 *  - SaudiDemographicsService (اقتراح العصا 🪄): سكان GASTAT × دخل × نسبة استهلاك،
 *    وSAM=10%/SOM=5% ثابتة.
 *  - SaudiMarketEngine (لوحة القرار): سكان من نسخة يدوية ثالثة في CITY_STATS
 *    (انحرفت حتى +40% للخبر) × «اختراق × إنفاق سنوي × قوة شرائية» مخترعة بلا مصدر.
 * نفس مرض «النسختين اليدويتين» الذي أصلحه تدقيق 2026-07-08 في طبقة JSON.
 *
 * العقد الآن: كل من يحتاج تحجيم السوق يمرّ من هنا —
 *  - السكان: لقطة GASTAT المُجمّعة (web/data/SaudiDemographics.json) حصراً. (SOURCED)
 *  - الدخل ونسبة استهلاك القطاع: تقديرات داخلية معلنة من نفس اللقطة. (ASSUMPTION)
 *  - نِسب SAM/SOM: جدول قطاعي واحد معلن أدناه؛ SAM من TAM، وSOM من SAM لا من TAM
 *    (درس فرق ×48 الموثق في SaudiDemographicsService). (ASSUMPTION)
 * لا أرقام سوق مكتوبة يدوياً خارج هذا الملف واللقطة — أي إضافة هنا يجب أن تكون
 * إمّا من اللقطة الموسومة أو افتراضاً معلناً provenance:'assumption'.
 */
import demographicsJson from '../../data/SaudiDemographics.json';
import { detectSectorBenchmark, SECTOR_BENCHMARKS } from './sectorBenchmarks.js';
import { datum, PROVENANCE } from '../services/DataConnectors.js';

const num = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
};

/** ميتا اللقطة (مصدر/سنة/رابط) — لعرض شارة المصدر في الواجهات. */
export const SNAPSHOT_META = Object.freeze({
    source: demographicsJson.meta?.source || 'الهيئة العامة للإحصاء (GASTAT)',
    year: String(demographicsJson.meta?.year || '2022'),
    url: demographicsJson.meta?.url || 'https://www.stats.gov.sa'
});

/**
 * نِسب SAM/SOM القطاعية — الجدول الوحيد المعتمد (افتراضات معلنة، ليست بيانات).
 * SAM: الشريحة القابلة للخدمة من TAM. SOM: ما تلتقطه منشأة جديدة واحدة من SAM.
 * ورثت القيم من SECTOR_MARKET_DEFAULTS السابق في SaudiMarketEngine (الأغنى قطاعياً)،
 * وحلّت محل 10%/5% الثابتة في SaudiDemographicsService — قيمة واحدة لكل قطاع في
 * كل الواجهات، قابلة للتعديل بمصدر عند توفره.
 */
export const SECTOR_SIZING_RATES = Object.freeze({
    fnb: Object.freeze({ samRate: 0.06, somRate: 0.03 }),
    retailHighMargin: Object.freeze({ samRate: 0.07, somRate: 0.025 }),
    retail: Object.freeze({ samRate: 0.06, somRate: 0.025 }),
    service: Object.freeze({ samRate: 0.06, somRate: 0.03 }),
    industrial: Object.freeze({ samRate: 0.12, somRate: 0.02 }),
    logistics: Object.freeze({ samRate: 0.10, somRate: 0.02 }),
    saas: Object.freeze({ samRate: 0.35, somRate: 0.04 }),
    default: Object.freeze({ samRate: 0.06, somRate: 0.025 })
});

/** نِسب القطاع المطلوب (أو default) — لا ترمي أبداً. */
export function sizingRatesFor(sectorKey) {
    return SECTOR_SIZING_RATES[sectorKey] || SECTOR_SIZING_RATES.default;
}

/**
 * نص القطاع الموحّد الذي تُبنى عليه كل الاستدلالات (كشف القطاع + نسبة الاستهلاك).
 * المسبب: كان المحرك يبني نصاً من (concept+description+sector) والعصا تمرر حقلاً
 * واحداً فقط — فيكشفان قطاعين مختلفين لنفس الدراسة. مدخل واحد = استدلال واحد.
 */
export function buildSectorText(info = {}, marketSizing = {}) {
    return [info.concept, info.description, info.sector, info.activity, marketSizing.sectorAnalysis]
        .filter(Boolean)
        .join(' ')
        .trim();
}

/** مفتاح القطاع (fnb/retail/…) من نص حر — عبر معايير sectorBenchmarks الموحّدة. */
export function detectSectorKey(text) {
    const benchmark = detectSectorBenchmark(text || '');
    if (!benchmark) return 'default';
    return Object.entries(SECTOR_BENCHMARKS).find(([, value]) => value === benchmark)?.[0] || 'default';
}

/**
 * نسبة استهلاك القطاع من الدخل (لحساب TAM) — مطابقة سلوكياً لدالة getSectorShare
 * التاريخية في SaudiDemographicsService (مطابقة substring على مفاتيح عربية).
 * @param {string} text  نص القطاع (من buildSectorText)
 * @param {Object} [shares]  جدول النسب — افتراضياً من اللقطة المستوردة وقت البناء؛
 *                           تمرّره الخدمة من نسختها الحيّة (fetch) وهما نفس الملف عملياً.
 */
export function resolveSectorShare(text, shares = demographicsJson.sectorConsumptionShare) {
    if (!text || !shares) return shares?.default ?? 0.02;
    const s = String(text).trim();
    for (const [key, val] of Object.entries(shares)) {
        if (key === 'default') continue;
        if (s.includes(key)) return Number(val) ?? 0.02;
    }
    return shares.default ?? 0.02;
}

/**
 * بيانات مدينة من لقطة GASTAT — قراءة متزامنة (المحرك المالي متزامن بالكامل).
 * نفس دلالات getCityData في SaudiDemographicsService: fallback إلى «أخرى» ثم دخل 70000.
 */
export function getCitySnapshot(city) {
    const key = (city || '').trim();
    const raw = demographicsJson.cities[key] || demographicsJson.cities['أخرى'] || {};
    return {
        population: num(raw.population),
        perCapitaIncomeSAR: num(raw.perCapitaIncomeSAR) || 70000,
        region: raw.region || '',
        populationSource: `${SNAPSHOT_META.source} — تعداد ${SNAPSHOT_META.year}`,
        incomeSource: 'تقدير داخلي (ASSUMPTION) — ليس رقماً رسمياً منشوراً',
        year: SNAPSHOT_META.year,
        url: SNAPSHOT_META.url
    };
}

/** إجمالي سكان المملكة (للأنشطة الرقمية وطنية النطاق) — من اللقطة، لا من جمع يدوي. */
export function nationalPopulation() {
    return num(demographicsJson.national?.population) || 18_000_000;
}

/**
 * الاشتقاق الموحّد: TAM = سكان × دخل الفرد × نسبة استهلاك القطاع،
 * SAM = نسبة من TAM، SOM = نسبة من SAM (لا من TAM).
 * ترتيب التقريب مقصود وثابت (تقريب كل مستوى قبل التالي) — أي مستهلك يعيد
 * الحساب بنفس المدخلات يحصل على نفس الأرقام حرفياً.
 */
export function deriveMarketSizing({ population, incomeSAR, sectorShare, samRate, somRate }) {
    const tam = Math.round(num(population) * num(incomeSAR) * num(sectorShare));
    const sam = Math.round(tam * num(samRate));
    const som = Math.round(sam * num(somRate));
    return { tam, sam, som };
}

/**
 * معدل نمو سكاني وطني معلن (GASTAT، لقطة web/data/SaudiDemographics.json → populationGrowth) —
 * نمو السعوديين وحدهم لا الإجمالي (الإجمالي مضخّم بالهجرة الوافدة ومتقلب). يُستخدم حصراً
 * كافتراض توقع (ASSUMPTION) في forecastDemandTrend أدناه حين لا تتوفر بيانات سكان
 * متعددة السنوات لمدينة بعينها — وهو الحال حالياً (اللقطة سنة واحدة فقط).
 */
export const NATIONAL_POPULATION_GROWTH_RATE = Object.freeze({
    rate: num(demographicsJson.populationGrowth?.annualGrowthRateSaudiOnly) || 0.02,
    source: demographicsJson.populationGrowth?.source || 'الهيئة العامة للإحصاء (GASTAT)',
    year: String(demographicsJson.populationGrowth?.year || '2024'),
    url: demographicsJson.populationGrowth?.url || 'https://www.stats.gov.sa'
});

/**
 * توقع طلب/سكان بسيط لمدينة عبر سنوات قادمة — اتجاه مركّب بمعدل نمو واحد ثابت
 * (لا بيانات سكان متعددة السنوات فعلية متاحة حالياً لكل مدينة، فاللقطة سنة واحدة).
 * نقطة الأساس (offset=0) موسومة SOURCED من لقطة GASTAT نفسها؛ كل نقطة توقّع لاحقة
 * موسومة ASSUMPTION صراحة (تطبيق معدل نمو معلن على المستقبل ليس رقماً مقاساً).
 * @param {string} city
 * @param {number} [years=3]  عدد سنوات التوقع بعد سنة الأساس
 * @returns {{city:string, years:number, baseYear:string, growthRatePct:number, growthRateSource:object, points: Array<Object>}}
 *          points[i] = Datum (من DataConnectors) + yearOffset؛ points[0] هو سنة الأساس.
 */
export function forecastDemandTrend(city, years = 3) {
    const snapshot = getCitySnapshot(city);
    const n = Math.max(1, Math.round(num(years)) || 3);
    const rate = NATIONAL_POPULATION_GROWTH_RATE.rate;
    const baseYearNum = Number(snapshot.year) || Number(SNAPSHOT_META.year);

    const points = [];
    for (let i = 0; i <= n; i++) {
        const population = Math.round(snapshot.population * Math.pow(1 + rate, i));
        const meta = i === 0
            ? {
                unit: 'نسمة',
                source: SNAPSHOT_META.source,
                sourceUrl: SNAPSHOT_META.url,
                year: snapshot.year,
                provenance: PROVENANCE.SOURCED,
                note: 'سنة الأساس — من لقطة GASTAT نفسها (لا توقع).'
            }
            : {
                unit: 'نسمة',
                source: NATIONAL_POPULATION_GROWTH_RATE.source,
                sourceUrl: NATIONAL_POPULATION_GROWTH_RATE.url,
                year: String(baseYearNum + i),
                provenance: PROVENANCE.ASSUMPTION,
                note: `توقع مركّب بمعدل نمو سكاني وطني ${(rate * 100).toFixed(1)}% سنوياً (${NATIONAL_POPULATION_GROWTH_RATE.source} ${NATIONAL_POPULATION_GROWTH_RATE.year}) — تقدير مستقبلي لا رقم سكان مديني مقاس فعلياً.`
            };
        points.push({ yearOffset: i, ...datum(population, meta) });
    }

    return {
        city: (city || '').trim(),
        years: n,
        baseYear: snapshot.year,
        growthRatePct: rate,
        growthRateSource: NATIONAL_POPULATION_GROWTH_RATE,
        points
    };
}
