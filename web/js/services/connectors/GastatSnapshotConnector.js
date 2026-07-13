/**
 * GastatSnapshotConnector — يُطوّع لقطة GASTAT المُجمّعة (web/data/SaudiDemographics.json)
 * إلى عقد provenance الخاص بطبقة DataConnectors.
 *
 * مبدأ صارم: لا نُلفّق أي إحصائية جديدة هنا — نغلّف فقط ما هو موجود أصلاً في
 * SaudiDemographicsService، ونوسمه بأمانة:
 *  - 'demographics.city' → السكان والمنطقة مصدرها GASTAT (PROVENANCE.SOURCED)،
 *                          أمّا دخل الفرد (perCapitaIncomeSAR) فتقدير داخلي لا تنشره الهيئة،
 *                          فيُعلَن صراحةً ضمن assumptionFields ولا يُنسب لـ GASTAT.
 *  - 'market.tam'        → TAM محسوب (سكان × دخل × نسبة) فمصدره مُشتقّ (PROVENANCE.DERIVED)،
 *                          ونِسب SAM/SOM قطاعية من جدول SECTOR_SIZING_RATES الموحّد
 *                          (core/marketSizingModel.js) — افتراضات مُعلنة لا بيانات.
 *
 * دفاعي: SaudiDemographicsService يحرس typeof window ويرجع FALLBACK_DATA عند التعذّر،
 * لكن أي throw هنا يُترجَم إلى unavailable(...) — لا نرمي أبداً ولا نُخمّن رقماً.
 */

import { datum, unavailable, PROVENANCE, registerConnector } from '../DataConnectors.js';
import { getCityData, getTAMSuggestion } from '../SaudiDemographicsService.js';

const SOURCE_URL = 'https://www.stats.gov.sa';
const SOURCE_LABEL = 'GASTAT (الهيئة العامة للإحصاء)';

/**
 * 'demographics.city' — بيانات مدينة مصدرها لقطة GASTAT مباشرةً.
 * context: { city }
 * @param {{city?: string}} context
 */
async function demographicsCity(context = {}) {
    try {
        const city = context && context.city;
        if (!city) return unavailable('لم تُحدَّد المدينة (city مطلوب).');

        const cityData = await getCityData(city);
        if (!cityData || !(cityData.population > 0)) {
            return unavailable(`لا توجد بيانات ديموغرافية للمدينة: ${city}`);
        }

        return datum(
            {
                population: cityData.population,
                perCapitaIncomeSAR: cityData.perCapitaIncomeSAR,
                region: cityData.region
            },
            {
                unit: 'نسمة',
                source: SOURCE_LABEL,
                sourceUrl: SOURCE_URL,
                year: cityData.year,
                provenance: PROVENANCE.SOURCED,
                // السكان والمنطقة رسميّان (GASTAT)؛ دخل الفرد تقدير داخلي لا تنشره الهيئة —
                // يُعلَن في note (ما تعرضه الواجهة) كي لا يُنسب الدخل زوراً لـ GASTAT.
                note: 'السكان والمنطقة من GASTAT؛ أمّا perCapitaIncomeSAR فتقدير داخلي (ASSUMPTION) لا رقم رسمي.'
            }
        );
    } catch (e) {
        return unavailable(e && e.message ? e.message : 'تعذّر جلب بيانات المدينة.');
    }
}

/**
 * 'market.tam' — TAM/SAM/SOM. TAM مُشتقّ (سكان × دخل الفرد × نسبة استهلاك القطاع)،
 * وSAM/SOM عوامل افتراضية مُعلنة صراحةً.
 * context: { city, sector }
 * @param {{city?: string, sector?: string}} context
 */
async function marketTam(context = {}) {
    try {
        const city = context && context.city;
        const sector = context && context.sector;
        if (!city) return unavailable('لم تُحدَّد المدينة (city مطلوب لحساب TAM).');

        const result = await getTAMSuggestion(city, sector);
        if (!result || !(result.tam > 0)) {
            return unavailable(`تعذّر اشتقاق TAM للمدينة: ${city}`);
        }

        return datum(
            {
                tam: result.tam,
                sam: result.sam,
                som: result.som,
                population: result.population,
                sectorShare: result.sectorShare
            },
            {
                unit: 'ريال/سنة',
                source: result.source,
                sourceUrl: SOURCE_URL,
                year: result.year,
                provenance: PROVENANCE.DERIVED,
                note: 'TAM مُشتقّ (سكان × دخل الفرد × نسبة استهلاك القطاع)؛ نِسب SAM/SOM قطاعية معلنة من الجدول الموحّد (عدّلها بمصدر).'
            }
        );
    } catch (e) {
        return unavailable(e && e.message ? e.message : 'تعذّر اشتقاق TAM.');
    }
}

registerConnector('demographics.city', demographicsCity);
registerConnector('market.tam', marketTam);
