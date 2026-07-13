/**
 * SaudiDemographicsService — اقتراح TAM بناءً على بيانات هيئة الإحصاء
 * عند اختيار المدينة والقطاع: حجم السوق = عدد السكان × نسبة الاستهلاك للقطاع، مع ذكر المصدر.
 *
 * تدقيق 2026-07-08: كان هناك نسختان يدويتان من نفس بيانات GASTAT — كائن FALLBACK_DATA
 * هنا (مكتوب يدوياً) وweb/data/SaudiDemographics.json — واختلفتا فعلياً بنسبة 19-25% لجدة
 * ومكة المكرمة رغم ادّعاء كلتيهما نفس المصدر. الحل الجذري: استيراد ملف JSON مباشرة
 * كوحدة (Vite يدعم هذا أصلاً) بدل نسخ يدوي عرضة للانحراف — الآن مصدر واحد فعلي؛
 * fetch() يبقى كمحاولة أولى لتحديث حي مستقبلي دون إعادة نشر، وfallback الحقيقي هو
 * نفس ملف JSON المستورد وقت البناء، لا نسخة منفصلة قد تنحرف عنه صامتة.
 */
import demographicsJson from '../../data/SaudiDemographics.json';
import {
    detectSectorKey,
    resolveSectorShare,
    sizingRatesFor,
    deriveMarketSizing
} from '../core/marketSizingModel.js';

let _cache = null;

/**
 * تحميل بيانات السعودية الديموغرافية (من JSON عبر fetch حي، أو من نفس ملف JSON
 * المُستورَد وقت البناء كاحتياط — لا نسخة مكتوبة يدوياً بعد الآن)
 */
export async function loadDemographics() {
    if (_cache) return _cache;
    try {
        const base = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
        const res = await fetch(`${base}/data/SaudiDemographics.json`);
        if (res.ok) {
            _cache = await res.json();
            return _cache;
        }
    } catch (_) {}
    _cache = demographicsJson;
    return _cache;
}

/**
 * بيانات مدينة واحدة (سكان، متوسط دخل الفرد، المصدر)
 * @param {string} city - اسم المدينة (مثلاً الرياض، جدة)
 * @returns {Promise<{ population: number, perCapitaIncomeSAR: number, source: string, year: string, region: string }|null>}
 */
export async function getCityData(city) {
    const data = await loadDemographics();
    const key = (city || '').trim();
    if (!key) return null;
    const raw = data.cities[key] || data.cities['أخرى'];
    if (!raw) return null;
    return {
        population: Number(raw.population) || 0,
        perCapitaIncomeSAR: Number(raw.perCapitaIncomeSAR) || 70000,
        // مصدر السكان رسمي (تعداد GASTAT)؛ مصدر دخل الفرد تقديري (ASSUMPTION)
        populationSource: data.meta?.populationSource || data.meta?.source || 'الهيئة العامة للإحصاء (GASTAT) — تعداد 2022',
        incomeSource: data.meta?.incomeSource || 'تقدير داخلي (ASSUMPTION) — ليس رقماً رسمياً منشوراً',
        year: String(data.meta?.year || '2022'),
        url: data.meta?.populationUrl || data.meta?.url || 'https://www.stats.gov.sa',
        region: raw.region || ''
    };
}

/**
 * اقتراح TAM (وSAM، SOM) بناءً على المدينة والقطاع — عدد السكان × نسبة الاستهلاك للقطاع، مع المصدر
 * @param {string} city - المدينة المستهدفة
 * @param {string} sector - القطاع أو النشاط (مثلاً مطعم، قهوة، تجزئة)
 * @returns {Promise<{ tam: number, sam: number, som: number, source: string, sourceLabel: string, year: string, description: string, population: number, sectorShare: number }>}
 */
export async function getTAMSuggestion(city, sector) {
    const cityData = await getCityData(city);
    if (!cityData || cityData.population <= 0) {
        return {
            tam: 0,
            sam: 0,
            som: 0,
            source: 'الهيئة العامة للإحصاء (GASTAT) — للسكان فقط',
            sourceLabel: 'السكان: تعداد GASTAT — الدخل ونِسب الاستهلاك: تقديرية',
            year: '2022',
            description: 'لم تُحدد مدينة أو لا توجد بيانات للمدينة المختارة.',
            population: 0,
            sectorShare: 0
        };
    }

    // الحساب كله عبر marketSizingModel — نفس الاشتقاق الذي تستخدمه لوحة القرار
    // (analyzeSaudiMarket) حرفياً، فلا يمكن أن يرى العميل رقمين مختلفين لنفس
    // المدينة والقطاع. النِّسب قطاعية من جدول SECTOR_SIZING_RATES الموحّد
    // (كانت هنا 10%/5% ثابتة والمحرك يستخدم جدولاً آخر — مصدر التناقض).
    const data = await loadDemographics();
    const share = resolveSectorShare(sector, data.sectorConsumptionShare);
    const rates = sizingRatesFor(detectSectorKey(sector));
    const pop = cityData.population;
    const income = cityData.perCapitaIncomeSAR;
    const { tam, sam, som } = deriveMarketSizing({
        population: pop,
        incomeSAR: income,
        sectorShare: share,
        samRate: rates.samRate,
        somRate: rates.somRate
    });

    const cityName = (city || '').trim() || 'المدينة';
    const description = `السوق الكلي (TAM) المقدر لـ ${cityName}: عدد السكان ${pop.toLocaleString('ar-SA')} نسمة (مصدر رسمي: ${cityData.populationSource}) × متوسط دخل الفرد ${income.toLocaleString('ar-SA')} ريال/سنوياً (تقديري — ${cityData.incomeSource}) × نسبة استهلاك القطاع (${(share * 100).toFixed(1)}% — تقديرية) ≈ ${tam.toLocaleString('ar-SA')} ريال سنوياً. راجع الأرقام التقديرية وعدّلها بمصدر عند توفره.`;

    return {
        tam,
        sam,
        som,
        samIsAssumption: true,
        somIsAssumption: true,
        incomeIsAssumption: true,
        sectorShareIsAssumption: true,
        source: cityData.populationSource,
        sourceLabel: `السكان: ${cityData.populationSource} — الدخل ونِسب الاستهلاك: تقديرية (ASSUMPTION). SOM سقف مدينة — طابِقه بطاقتك التشغيلية الفعلية`,
        year: cityData.year,
        description,
        population: pop,
        sectorShare: share
    };
}
