/**
 * SaudiMarketEngine — تحليل واقعية السوق للوحة القرار.
 *
 * توحيد 2026-07-13: كان هذا المحرك يحسب TAM بصيغة خاصة به
 * (سكان من نسخة يدوية في CITY_STATS × «اختراق × إنفاق سنوي × قوة شرائية» بلا مصدر)
 * فيعرض للعميل رقماً يناقض اقتراح العصا 🪄 لنفس المدينة والقطاع. الآن يشتق
 * حصرياً عبر marketSizingModel (لقطة GASTAT + افتراضات معلنة موحّدة) — نفس
 * الأرقام حرفياً في كل الواجهات، وقيم المستخدم المدخلة تتقدم دائماً على المشتق.
 */
import { SECTIONS } from './schema.js';
import {
    buildSectorText,
    detectSectorKey,
    resolveSectorShare,
    getCitySnapshot,
    nationalPopulation,
    sizingRatesFor
} from './marketSizingModel.js';

const num = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
};

export function analyzeSaudiMarket(study = {}, results = {}) {
    const info = study[SECTIONS.PROJECT_INFO] || {};
    const marketSizing = study[SECTIONS.MARKET_SIZING] || {};
    const city = info.city || 'الرياض';
    const sectorText = buildSectorText(info, marketSizing);
    const sectorKey = detectSectorKey(sectorText);
    const isDigital = sectorKey === 'saas';
    const snapshot = getCitySnapshot(city);
    // الأنشطة الرقمية سوقها وطني لا مديني — إجمالي المملكة من اللقطة (تعداد 2022)
    const population = isDigital ? nationalPopulation() : (snapshot.population || 1_000_000);
    const sectorShare = resolveSectorShare(sectorText);
    const rates = sizingRatesFor(sectorKey);

    // قيمة المستخدم تتقدم دائماً؛ والمشتق يتسلسل من آخر قيمة معتمدة (لو أدخل
    // المستخدم TAM فقط، يُشتق SAM من قيمته هو لا من تقديرنا) — نفس ترتيب
    // التقريب في deriveMarketSizing حرفياً عند غياب أي إدخال.
    const tam = num(marketSizing.tam?.value) > 0
        ? num(marketSizing.tam.value)
        : Math.round(population * snapshot.perCapitaIncomeSAR * sectorShare);
    const sam = num(marketSizing.sam?.value) > 0
        ? num(marketSizing.sam.value)
        : Math.round(tam * rates.samRate);
    const som = num(marketSizing.som?.value) > 0
        ? num(marketSizing.som.value)
        : Math.round(sam * rates.somRate);
    const y1Revenue = num(results?.incomeStatement?.[0]?.revenue);

    const warnings = [];
    if (y1Revenue > 0 && som > 0 && y1Revenue > som * 1.2) {
        warnings.push({
            code: 'REVENUE_EXCEEDS_SOM',
            message: 'إيرادات السنة الأولى أعلى من الحصة السوقية المتاحة المتوقعة؛ راجع العملاء/السعر أو وثّق مصدر SOM.',
            path: 'revenue.streams'
        });
    }
    if (!marketSizing.tam?.source && !marketSizing.populationDemographics?.source) {
        warnings.push({
            code: 'MARKET_SOURCE_MISSING',
            message: 'تحجيم السوق تقديري؛ أضف مصدر TAM/SAM/SOM أو مصدر السكان قبل العرض الرسمي.',
            path: 'marketSizing.tam.source'
        });
    }

    return {
        city,
        sectorKey,
        population,
        sectorShare,
        tam: Math.round(tam),
        sam: Math.round(sam),
        som: Math.round(som),
        y1Revenue,
        captureRateOfSom: som > 0 ? y1Revenue / som : null,
        source: num(marketSizing.tam?.value) > 0 ? 'user_input' : 'gastat_snapshot_derived',
        // وسم المصدر لكل مكوّن — ما يميّز «دراسة قابلة للدفاع» عن أرقام عارية
        sources: {
            population: isDigital
                ? { provenance: 'sourced', source: `${snapshot.populationSource} — إجمالي المملكة`, year: snapshot.year, url: snapshot.url }
                : { provenance: 'sourced', source: snapshot.populationSource, year: snapshot.year, url: snapshot.url },
            incomePerCapita: { provenance: 'assumption', source: snapshot.incomeSource },
            sectorShare: { provenance: 'assumption', note: `نسبة استهلاك القطاع من الدخل: ${(sectorShare * 100).toFixed(1)}%` },
            samSom: { provenance: 'assumption', note: `SAM=${(rates.samRate * 100).toFixed(1)}% من TAM، SOM=${(rates.somRate * 100).toFixed(1)}% من SAM (جدول قطاعي معلن)` }
        },
        warnings
    };
}
