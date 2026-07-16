/**
 * utilityBenchmarks.js — تقدير تكلفة المرافق (كهرباء/مياه) الشهرية من المساحة والقطاع.
 * أرقام تقديرية (ASSUMPTION) موثّقة أعلى الملف — الاختبار هنا يغطي المنطق الحسابي
 * (لا صحة الأرقام الفعلية بحد ذاتها، وهي غير قابلة للتحقق الآلي).
 */
import { describe, it, expect } from 'vitest';
import { estimateMonthlyUtilityCost, UTILITY_BENCHMARKS, GENERIC_UTILITY_BENCHMARK, ELECTRICITY_SAR_PER_KWH } from '../utilityBenchmarks.js';

describe('estimateMonthlyUtilityCost', () => {
    it('يُرجع null بلا مساحة مُدخلة', () => {
        expect(estimateMonthlyUtilityCost({ projectInfo: { concept: 'مطعم' } })).toBeNull();
        expect(estimateMonthlyUtilityCost({ projectInfo: { areaSize: 0, concept: 'مطعم' } })).toBeNull();
    });

    it('يحسب مدى موجباً لقطاع مكتشَف (مطعم) بمعيار fnb', () => {
        const est = estimateMonthlyUtilityCost({ projectInfo: { areaSize: 100, concept: 'مطعم صغير' } });
        expect(est).not.toBeNull();
        expect(est.isGeneric).toBe(false);
        expect(est.sectorLabel).toBe('مطاعم ومقاهي');
        expect(est.lowSar).toBeGreaterThan(0);
        expect(est.highSar).toBeGreaterThan(est.lowSar);

        const [kwhLo, kwhHi] = UTILITY_BENCHMARKS.fnb.kwhPerM2Month;
        const [waterLo, waterHi] = UTILITY_BENCHMARKS.fnb.waterSarPerM2Month;
        expect(est.lowSar).toBe(Math.round(100 * (kwhLo * ELECTRICITY_SAR_PER_KWH + waterLo)));
        expect(est.highSar).toBe(Math.round(100 * (kwhHi * ELECTRICITY_SAR_PER_KWH + waterHi)));
    });

    it('يستخدم المعيار العام حين يتعذّر اكتشاف القطاع', () => {
        const est = estimateMonthlyUtilityCost({ projectInfo: { areaSize: 50, concept: 'فكرة غير مصنّفة تماماً xyz' } });
        expect(est.isGeneric).toBe(true);
        expect(est.sectorLabel).toBe('عام (غير مصنّف)');
        const [kwhLo] = GENERIC_UTILITY_BENCHMARK.kwhPerM2Month;
        const [waterLo] = GENERIC_UTILITY_BENCHMARK.waterSarPerM2Month;
        expect(est.lowSar).toBe(Math.round(50 * (kwhLo * ELECTRICITY_SAR_PER_KWH + waterLo)));
    });

    it('مساحة أكبر تُنتج تقديراً أعلى لنفس القطاع', () => {
        const small = estimateMonthlyUtilityCost({ projectInfo: { areaSize: 50, concept: 'متجر تجزئة' } });
        const large = estimateMonthlyUtilityCost({ projectInfo: { areaSize: 500, concept: 'متجر تجزئة' } });
        expect(large.lowSar).toBeGreaterThan(small.lowSar);
        expect(large.highSar).toBeGreaterThan(small.highSar);
    });
});
