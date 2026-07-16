/**
 * siteComparison — أداة مقارنة تقريبية بين مواقع/مدن مرشحة لمشروع واحد.
 *
 * ليست خوارزمية اختيار موقع حاسمة — فقط ترتيب استرشادي يجمع:
 *  - الطلب: سكان × دخل الفرد لكل مدينة (getCitySnapshot، لقطة GASTAT عبر marketSizingModel).
 *  - تقريب عبء الإيجار: دخل الفرد × منتصف نسبة rentToRevenue القطاعية من sectorBenchmarks.js
 *    (لا جدول إيجار مدينة صريح متاح هنا؛ الدخل يُستخدم كمقياس تقريبي لتفاوت تكلفة
 *    المواقع بين المدن — مؤشر نسبي لا رقم إيجار فعلي).
 *  - الكثافة التنافسية (اختياري): يمرّرها المستدعي بعد جلبها بنفسه من موصّل Overpass —
 *    هذا الملف لا يستدعي أي موصّل شبكي مباشرة.
 */
import { getCitySnapshot } from './marketSizingModel.js';
import { SECTOR_BENCHMARKS, GENERIC_BENCHMARK } from './sectorBenchmarks.js';

const num = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
};

const rangeMid = ([lo, hi]) => (num(lo) + num(hi)) / 2;

/** تطبيع خطي إلى 0–100؛ إن تساوت كل القيم يُعاد 50 لكل المرشحين (لا فرق بينهم). */
function normalize(values) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (!(max > min)) return values.map(() => 50);
    return values.map(v => ((v - min) / (max - min)) * 100);
}

/**
 * يقارن مدناً/مواقع مرشحة لمشروع بقطاع واحد ويعيد ترتيباً استرشادياً.
 * @param {Array<{city: string, coords?: {lat:number, lng:number}}>} candidates
 * @param {string} [sectorKey='default']  مفتاح قطاع من SECTOR_BENCHMARKS (fnb/retail/service/…)
 * @param {Object<string, number>} [competitorCounts]  عدد منافسين لكل مدينة (اختياري، من موصّل خارجي يجلبه المستدعي)
 * @returns {{sectorKey: string, method: string, candidates: Array<Object>}}
 */
export function compareSiteOptions(candidates, sectorKey = 'default', competitorCounts = {}) {
    if (!Array.isArray(candidates) || candidates.length === 0) {
        return { sectorKey, method: 'أداة مقارنة تقريبية — لا مرشحين لمقارنتهم.', candidates: [] };
    }

    const bench = SECTOR_BENCHMARKS[sectorKey] || GENERIC_BENCHMARK;
    const rentRatioMid = rangeMid(bench.rentToRevenue);

    const rows = candidates.map((c) => {
        const city = (c?.city || '').trim();
        const snapshot = getCitySnapshot(city);
        const demandIndex = snapshot.population * snapshot.perCapitaIncomeSAR;
        const rentCostProxy = snapshot.perCapitaIncomeSAR * rentRatioMid;
        const hasCompetitorData = Object.prototype.hasOwnProperty.call(competitorCounts || {}, city);
        const competitorCount = hasCompetitorData ? num(competitorCounts[city]) : null;
        return {
            city,
            coords: c?.coords || null,
            population: snapshot.population,
            perCapitaIncomeSAR: snapshot.perCapitaIncomeSAR,
            demandIndex,
            rentToRevenueRange: bench.rentToRevenue,
            rentCostProxy,
            competitorCount
        };
    });

    // بلا بيانات منافسين لأي مرشّح: عامل التنافس محايد (0 للجميع) فلا يزيح الترتيب.
    const demandScores = normalize(rows.map(r => r.demandIndex));
    const rentPenalties = normalize(rows.map(r => r.rentCostProxy)); // أعلى = عبء إيجار أثقل نسبياً
    const competitorValues = rows.map(r => (r.competitorCount ?? 0));
    const competitorPenalties = rows.some(r => r.competitorCount !== null) ? normalize(competitorValues) : rows.map(() => 0);

    const scored = rows.map((r, i) => ({
        ...r,
        demandScore: Math.round(demandScores[i]),
        rentScore: Math.round(100 - rentPenalties[i]),
        competitorScore: Math.round(100 - competitorPenalties[i]),
        score: Math.round(demandScores[i] * 0.5 + (100 - rentPenalties[i]) * 0.25 + (100 - competitorPenalties[i]) * 0.25)
    }));

    scored.sort((a, b) => b.score - a.score);
    scored.forEach((r, i) => { r.rank = i + 1; });

    return {
        sectorKey,
        method: 'أداة مقارنة تقريبية (رتبة استرشادية) — تجمع مؤشر الطلب (سكان×دخل)، وتقريب عبء الإيجار القطاعي، وكثافة المنافسين إن تُوفرت؛ ليست خوارزمية اختيار موقع حاسمة.',
        candidates: scored
    };
}
