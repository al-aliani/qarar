import { CITY_STATS, getCityStats } from '../data/SaudiCityStats.js';
import { detectSectorBenchmark, SECTOR_BENCHMARKS } from './sectorBenchmarks.js';
import { SECTIONS } from './schema.js';

const num = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
};

const SECTOR_MARKET_DEFAULTS = {
    fnb: { penetration: 0.62, annualSpend: 1800, samRate: 0.06, somRate: 0.03 },
    retailHighMargin: { penetration: 0.35, annualSpend: 1300, samRate: 0.07, somRate: 0.025 },
    retail: { penetration: 0.82, annualSpend: 2400, samRate: 0.06, somRate: 0.025 },
    service: { penetration: 0.38, annualSpend: 1600, samRate: 0.06, somRate: 0.03 },
    industrial: { penetration: 0.04, annualSpend: 50000, samRate: 0.12, somRate: 0.02 },
    logistics: { penetration: 0.16, annualSpend: 9000, samRate: 0.10, somRate: 0.02 },
    saas: { penetration: 0.08, annualSpend: 1200, samRate: 0.35, somRate: 0.04 },
    default: { penetration: 0.30, annualSpend: 1500, samRate: 0.06, somRate: 0.025 }
};

function detectSectorKey(text) {
    const benchmark = detectSectorBenchmark(text);
    if (!benchmark) return 'default';
    return Object.entries(SECTOR_BENCHMARKS).find(([, value]) => value === benchmark)?.[0] || 'default';
}

function estimateSaudiPopulation() {
    const totalKnown = Object.entries(CITY_STATS)
        .filter(([key]) => key !== 'default')
        .reduce((sum, [, city]) => sum + num(city.population), 0);
    return Math.max(totalKnown, 18_000_000);
}

export function analyzeSaudiMarket(study = {}, results = {}) {
    const info = study[SECTIONS.PROJECT_INFO] || {};
    const marketSizing = study[SECTIONS.MARKET_SIZING] || {};
    const city = info.city || 'الرياض';
    const concept = `${info.concept || ''} ${info.description || ''} ${info.sector || ''}`;
    const sectorKey = detectSectorKey(concept);
    const defaults = SECTOR_MARKET_DEFAULTS[sectorKey] || SECTOR_MARKET_DEFAULTS.default;
    const cityStats = getCityStats(city);
    const isDigital = sectorKey === 'saas';
    const population = isDigital ? estimateSaudiPopulation() : num(cityStats.population || 1_000_000);
    const purchasingPowerFactor = Math.max(0.6, num(cityStats.purchasing_power || 5) / 8);

    const tam = num(marketSizing.tam?.value) > 0
        ? num(marketSizing.tam.value)
        : population * defaults.penetration * defaults.annualSpend * purchasingPowerFactor;
    const sam = num(marketSizing.sam?.value) > 0
        ? num(marketSizing.sam.value)
        : tam * defaults.samRate;
    const som = num(marketSizing.som?.value) > 0
        ? num(marketSizing.som.value)
        : sam * defaults.somRate;
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
        purchasingPowerFactor,
        tam: Math.round(tam),
        sam: Math.round(sam),
        som: Math.round(som),
        y1Revenue,
        captureRateOfSom: som > 0 ? y1Revenue / som : null,
        source: num(marketSizing.tam?.value) > 0 ? 'user_input' : 'saudi_city_estimate',
        warnings
    };
}
