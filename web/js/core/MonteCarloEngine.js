/**
 * Monte Carlo Simulation Engine
 * Runs thousands of scenarios to assess risk
 */
import { calculateStudy as runFullModel } from './engine.js';

export class MonteCarloEngine {
    /**
     * Run simulation
     * @param {Object} baseState - The base study state
     * @param {number} iterations - Number of runs (default 1000)
     * @param {number} volatility - Standard deviation for variations (default 0.15 or 15%)
     */
    static runSimulation(baseState, iterations = 1000, volatility = 0.15, seed = 0x9e3779b9) {
        const results = [];
        let successCount = 0; // NPV > 0
        let failureCount = 0; // تكرارات فشلت (throw أو مخرجات فارغة)
        let firstError = null; // أول رسالة خطأ — لتمييز «عقد overrides مكسور» عن «بيانات غير كافية»

        // مولّد أرقام شبه عشوائية قابل للبذر (mulberry32) — بدل Math.random غير القابل للتكرار.
        // نفس المدخلات + نفس البذرة ⇒ نفس النتيجة (مبدأ الدستور «نفس المدخلات = نفس النتائج»).
        let s = seed >>> 0;
        const rand = () => {
            s |= 0; s = (s + 0x6D2B79F5) | 0;
            let t = Math.imul(s ^ (s >>> 15), 1 | s);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };

        // Helper: Random normal distribution (Box-Muller transform) — يستخدم RNG المبذور
        const randNormal = (mean, stdDev) => {
            const u = 1 - rand();
            const v = rand();
            const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
            return mean + z * stdDev;
        };

        for (let i = 0; i < iterations; i++) {
            // Generate random variations for key drivers
            // We assume Independent Log-Normal distributions for factors to avoid negative multipliers easily? 
            // Or simple Normal distribution around 0 for percentage change.
            // Using Normal distribution around 0 (no change) with volatility as StdDev.

            const revenueChange = randNormal(0, volatility);
            const costChange = randNormal(0, volatility * 0.8); // Costs usually less volatile than revenue?
            const capexChange = randNormal(0, volatility * 0.5); // CAPEX usually more fixed once planned

            try {
                // Run model with these overrides
                const output = runFullModel(baseState, {
                    revenueChange,
                    costChange,
                    capexChange
                });

                const kpis = output && output.indicators;
                if (!kpis) {
                    // مخرجات فارغة (baseState غير صالح/ناقص) — لا throw لكنه فشل فعلي، لا يُبتلع.
                    failureCount++;
                    if (!firstError) firstError = 'runFullModel returned no indicators (invalid baseState)';
                    continue;
                }
                results.push({
                    npv: kpis.npv,
                    irr: kpis.irr,
                    roi: kpis.roi,
                    revenueChange,
                    costChange
                });

                if (kpis.npv > 0) successCount++;
            } catch (err) {
                // لا نبتلع الفشل بصمت: نعدّه ونحتفظ بأول رسالة خطأ لنُميّز في النتيجة
                // «عقد overrides مكسور» (خطأ فعلي) عن «بيانات غير كافية» (baseState فارغ).
                failureCount++;
                if (!firstError) firstError = (err && err.message) ? err.message : String(err);
                console.warn('Simulation run failed', err);
            }
        }

        // Guard: if every iteration failed (e.g. invalid/empty baseState where
        // runFullModel returns null), do NOT emit NaN/undefined stats. Return a
        // well-defined "insufficient data" result the dashboard can render as
        // "could not simulate" rather than a fake 0% success / NaN range.
        if (results.length === 0) {
            return {
                ok: false,
                error: 'insufficient_data',
                failedRuns: failureCount,
                failureReason: firstError, // أول سبب فشل حقيقي بدل الابتلاع الصامت
                iterations,
                completedRuns: 0,
                results: [],
                stats: {
                    minNPV: 0,
                    maxNPV: 0,
                    avgNPV: 0,
                    p10: 0,
                    p50: 0,
                    p90: 0,
                    successProbability: 0
                },
                histogram: []
            };
        }

        // Aggregate statistics
        const npvValues = results.map(r => r.npv).sort((a, b) => a - b);

        const calcPercentile = (arr, p) => {
            const index = Math.floor(p * arr.length);
            return arr[Math.min(index, arr.length - 1)];
        };

        const minNPV = npvValues[0];
        const maxNPV = npvValues[npvValues.length - 1];
        const avgNPV = npvValues.reduce((a, b) => a + b, 0) / npvValues.length;

        // Key Risk Indicators
        const p10 = calcPercentile(npvValues, 0.10); // Pessimistic (90% chance to be higher)
        const p50 = calcPercentile(npvValues, 0.50); // Median / Base
        const p90 = calcPercentile(npvValues, 0.90); // Optimistic (10% chance to be higher)

        // القسمة على التكرارات المكتملة (results.length) لا الإجمالي — كي لا تنحاز الاحتمالية
        // للأسفل عند فشل بعض التكرارات، وتتسق مع p10/p50/p90 المحسوبة من المكتمل فقط.
        const successProbability = successCount / results.length;

        // Generate Histogram Data (20 bins)
        const binCount = 20;
        const range = maxNPV - minNPV;
        // Guard: when all NPVs are identical (range === 0) avoid div-by-zero → NaN bins.
        const binSize = range > 0 ? range / binCount : 1;
        const histogram = new Array(binCount).fill(0).map((_, i) => ({
            binStart: minNPV + (i * binSize),
            binEnd: minNPV + ((i + 1) * binSize),
            count: 0
        }));

        npvValues.forEach(val => {
            let binIdx = Math.floor((val - minNPV) / binSize);
            // Clamp into [0, binCount-1] to guard against NaN / out-of-range indices.
            if (!Number.isFinite(binIdx) || binIdx < 0) binIdx = 0;
            if (binIdx >= binCount) binIdx = binCount - 1; // Handle max value
            histogram[binIdx].count++;
        });

        return {
            ok: true,
            iterations,
            completedRuns: results.length,
            failedRuns: failureCount,
            failureReason: firstError, // null عند نجاح كل التكرارات
            results, // Raw data (optional, can be heavy)
            stats: {
                minNPV,
                maxNPV,
                avgNPV,
                p10,
                p50,
                p90,
                successProbability
            },
            histogram // For UI Chart
        };
    }
}
