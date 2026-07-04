/**
 * SaudiDemographicsService — اقتراح TAM بناءً على بيانات هيئة الإحصاء
 * عند اختيار المدينة والقطاع: حجم السوق = عدد السكان × نسبة الاستهلاك للقطاع، مع ذكر المصدر.
 */

let _cache = null;

const FALLBACK_DATA = {
    meta: { source: 'الهيئة العامة للإحصاء (GASTAT)', url: 'https://www.stats.gov.sa', year: 2022 },
    cities: {
        'الرياض': { population: 7676654, perCapitaIncomeSAR: 98500, region: 'منطقة الرياض' },
        'جدة': { population: 4685000, perCapitaIncomeSAR: 92000, region: 'منطقة مكة المكرمة' },
        'مكة المكرمة': { population: 2042000, perCapitaIncomeSAR: 78000, region: 'منطقة مكة المكرمة' },
        'مكة': { population: 2042000, perCapitaIncomeSAR: 78000, region: 'منطقة مكة المكرمة' },
        'المدينة المنورة': { population: 1481000, perCapitaIncomeSAR: 82000, region: 'منطقة المدينة المنورة' },
        'المدينة': { population: 1481000, perCapitaIncomeSAR: 82000, region: 'منطقة المدينة المنورة' },
        'الدمام': { population: 1208000, perCapitaIncomeSAR: 95000, region: 'المنطقة الشرقية' },
        'الخبر': { population: 573000, perCapitaIncomeSAR: 102000, region: 'المنطقة الشرقية' },
        'الطائف': { population: 993000, perCapitaIncomeSAR: 72000, region: 'منطقة مكة المكرمة' },
        'تبوك': { population: 569797, perCapitaIncomeSAR: 68000, region: 'منطقة تبوك' },
        'بريدة': { population: 614093, perCapitaIncomeSAR: 75000, region: 'منطقة القصيم' },
        'خميس مشيط': { population: 512599, perCapitaIncomeSAR: 71000, region: 'منطقة عسير' },
        'أبها': { population: 366551, perCapitaIncomeSAR: 74000, region: 'منطقة عسير' },
        'القطيف': { population: 524182, perCapitaIncomeSAR: 88000, region: 'المنطقة الشرقية' },
        'حائل': { population: 412758, perCapitaIncomeSAR: 70000, region: 'منطقة حائل' },
        'جازان': { population: 173569, perCapitaIncomeSAR: 65000, region: 'منطقة جازان' },
        'نجران': { population: 329112, perCapitaIncomeSAR: 66000, region: 'منطقة نجران' },
        'أخرى': { population: 5000000, perCapitaIncomeSAR: 70000, region: 'مختلف المناطق' }
    },
    sectorConsumptionShare: {
        default: 0.02,
        مطعم: 0.025, قهوة: 0.015, كافي: 0.015, مشروبات: 0.01,
        تجزئة: 0.05, بقالة: 0.04, متجر: 0.04, بيع: 0.04,
        تعليم: 0.03, تدريب: 0.02, صحي: 0.04, عيادة: 0.035,
        استشار: 0.015, خدمي: 0.02, لوجستي: 0.025, شحن: 0.02, نقل: 0.02,
        صناع: 0.03, إنتاج: 0.03
    }
};

/**
 * تحميل بيانات السعودية الديموغرافية (من JSON أو من الذاكرة المؤقتة)
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
    _cache = FALLBACK_DATA;
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
        source: data.meta?.source || 'الهيئة العامة للإحصاء (GASTAT)',
        year: String(data.meta?.year || '2022'),
        url: data.meta?.url || 'https://www.stats.gov.sa',
        region: raw.region || ''
    };
}

/**
 * نسبة استهلاك القطاع من الدخل (لحساب TAM)
 */
function getSectorShare(sector, shares) {
    if (!sector || !shares) return shares?.default ?? 0.02;
    const s = (sector || '').trim();
    for (const [key, val] of Object.entries(shares)) {
        if (key === 'default') continue;
        if (s.includes(key)) return Number(val) ?? 0.02;
    }
    return shares.default ?? 0.02;
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
            source: 'الهيئة العامة للإحصاء (GASTAT)',
            sourceLabel: 'بيانات هيئة الإحصاء',
            year: '2022',
            description: 'لم تُحدد مدينة أو لا توجد بيانات للمدينة المختارة.',
            population: 0,
            sectorShare: 0
        };
    }

    const data = await loadDemographics();
    const share = getSectorShare(sector, data.sectorConsumptionShare);
    const pop = cityData.population;
    const income = cityData.perCapitaIncomeSAR;
    const tam = Math.round(pop * income * share);
    const sam = Math.round(tam * 0.4);
    const som = Math.round(tam * 0.08);

    const cityName = (city || '').trim() || 'المدينة';
    const description = `السوق الكلي (TAM) المقدر لـ ${cityName}: عدد السكان ${pop.toLocaleString('ar-SA')} نسمة × متوسط دخل الفرد ${income.toLocaleString('ar-SA')} ريال/سنوياً × نسبة استهلاك القطاع (${(share * 100).toFixed(1)}%) ≈ ${tam.toLocaleString('ar-SA')} ريال سنوياً.`;

    return {
        tam,
        sam,
        som,
        source: cityData.source,
        sourceLabel: `الهيئة العامة للإحصاء — تعداد ${cityData.year}`,
        year: cityData.year,
        description,
        population: pop,
        sectorShare: share
    };
}
