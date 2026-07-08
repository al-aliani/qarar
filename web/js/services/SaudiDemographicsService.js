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
            source: 'الهيئة العامة للإحصاء (GASTAT) — للسكان فقط',
            sourceLabel: 'السكان: تعداد GASTAT — الدخل ونِسب الاستهلاك: تقديرية',
            year: '2022',
            description: 'لم تُحدد مدينة أو لا توجد بيانات للمدينة المختارة.',
            population: 0,
            sectorShare: 0
        };
    }

    // افتراضات (ليست بيانات مصدرية) — موحّدة منهجياً مع SaudiMarketEngine:
    // SAM = نسبة من TAM (الشريحة القابلة للخدمة)، وSOM = نسبة من SAM (لا من TAM).
    // كان SOM = 8% من TAM يعطي ≈907 مليون ريال لمطعم واحد بالرياض (فرق ×48 عن منهجية المحرك).
    const SAM_OF_TAM = 0.10;  // الشريحة القابلة للخدمة من السوق الكلي
    const SOM_OF_SAM = 0.05;  // ما يمكن لمنشأة جديدة واحدة التقاطه من السوق القابل للخدمة (تقدير مبكر)

    const data = await loadDemographics();
    const share = getSectorShare(sector, data.sectorConsumptionShare);
    const pop = cityData.population;
    const income = cityData.perCapitaIncomeSAR;
    const tam = Math.round(pop * income * share);
    const sam = Math.round(tam * SAM_OF_TAM);
    const som = Math.round(sam * SOM_OF_SAM); // نسبة من SAM لا TAM

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
