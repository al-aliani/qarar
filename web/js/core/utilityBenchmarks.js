/**
 * معايير استهلاك المرافق (كهرباء/مياه) لكل م² شهرياً — على غرار sectorBenchmarks.js.
 * تُستخدم لتقدير تكلفة مرافق تقريبية بضرب المساحة (projectInfo.areaSize) في نطاق
 * القطاع، لا لعرضها كرقم فاتورة فعلي.
 *
 * المصدر: لا عدّاد استهلاك حي متاح لمشروع لم يُفتتح بعد — الأرقام أدناه تقديرات
 * تقريبية (ASSUMPTION، بلا مصدر رسمي سعودي منشور بدقة القطاع) مبنية على:
 *  - دراسات كثافة استهلاك مكاتب سعودية (EUI ~120-315 kWh/م²/سنة، Mostadam ~120 كأفضل ممارسة)
 *  - معايير تجزئة عالمية (~27-140 kWh/م²/سنة) مرفوعة قليلاً لمناخ التبريد السعودي
 *  - دراسات استهلاك مطاعم أمريكية (~470-800 kWh/م²/سنة) مخفّضة تحفظياً للمقاهي/المطاعم الصغيرة
 * تعرفة الكهرباء التجارية التقريبية 0.32 ريال/ك.و.س (سعر ثابت مبسّط — التعرفة الفعلية متدرجة).
 * عدّل هذه الأرقام بحذر وبمصدر عند توفره؛ الواجهة تُفصح دوماً عن طبيعتها التقديرية.
 */

import { detectSectorBenchmark, SECTOR_BENCHMARKS } from './sectorBenchmarks.js';

/** ريال/ك.و.س — تقريب لتعرفة الكهرباء التجارية الثابتة (SERA). */
export const ELECTRICITY_SAR_PER_KWH = 0.32;

export const UTILITY_BENCHMARKS = {
    fnb: { kwhPerM2Month: [25, 45], waterSarPerM2Month: [3, 6] },
    retailHighMargin: { kwhPerM2Month: [12, 20], waterSarPerM2Month: [0.5, 1.5] },
    retail: { kwhPerM2Month: [12, 20], waterSarPerM2Month: [0.5, 1.5] },
    service: { kwhPerM2Month: [15, 25], waterSarPerM2Month: [1, 2] },
    industrial: { kwhPerM2Month: [8, 15], waterSarPerM2Month: [1, 3] },
    logistics: { kwhPerM2Month: [8, 15], waterSarPerM2Month: [1, 3] },
    saas: { kwhPerM2Month: [15, 25], waterSarPerM2Month: [1, 2] }
};

/** معيار عام حين يتعذّر اكتشاف القطاع — نطاق محافظ يغطي أغلب الأنشطة التجارية الصغيرة. */
export const GENERIC_UTILITY_BENCHMARK = { kwhPerM2Month: [12, 25], waterSarPerM2Month: [1, 3] };
const GENERIC_BENCHMARK_LABEL = 'عام (غير مصنّف)';

/**
 * يقدّر مدى التكلفة الشهرية للمرافق (كهرباء + مياه) بضرب المساحة في معيار القطاع.
 * يعيد null إن لم تُدخَل مساحة بعد (لا معنى لتقدير بلا مساحة).
 * @param {object} state
 * @returns {{lowSar:number, highSar:number, areaSize:number, sectorLabel:string, isGeneric:boolean}|null}
 */
export function estimateMonthlyUtilityCost(state) {
    const areaSize = Number(state?.projectInfo?.areaSize) || 0;
    if (areaSize <= 0) return null;

    const sectorText = state?.projectInfo?.sector || state?.projectInfo?.concept || state?.projectInfo?.activity;
    const bench = detectSectorBenchmark(sectorText);
    const sectorKey = bench ? Object.keys(SECTOR_BENCHMARKS).find(k => SECTOR_BENCHMARKS[k] === bench) : null;
    const util = (sectorKey && UTILITY_BENCHMARKS[sectorKey]) || GENERIC_UTILITY_BENCHMARK;

    const [kwhLo, kwhHi] = util.kwhPerM2Month;
    const [waterLo, waterHi] = util.waterSarPerM2Month;

    const lowSar = Math.round(areaSize * (kwhLo * ELECTRICITY_SAR_PER_KWH + waterLo));
    const highSar = Math.round(areaSize * (kwhHi * ELECTRICITY_SAR_PER_KWH + waterHi));

    return {
        lowSar,
        highSar,
        areaSize,
        sectorLabel: bench ? bench.label : GENERIC_BENCHMARK_LABEL,
        isGeneric: !bench
    };
}
