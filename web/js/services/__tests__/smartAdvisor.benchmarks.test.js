import { describe, it, expect } from 'vitest';
import { SmartAdvisor } from '../SmartAdvisor.js';
import { resolveSectorBenchmark, checkDriversAgainstBenchmarks } from '../../core/sectorBenchmarks.js';

/**
 * حارس ضد عودة «مصدرَي بنشمارك متناقضين»:
 * سابقاً كان SmartAdvisor يملك جدولاً مثبّتاً (F&B فقط: COGS سقفه 35%) يُطبَّق على
 * كل قطاع، فيوصم تكلفة بضاعة تجزئة 60% (سليمة) بأنها «مرتفعة جداً» بينما
 * checkDriversAgainstBenchmarks (القطاعي) يعتبرها سليمة — حكمان متضادّان لنفس الرقم.
 * الآن كلاهما يقرأ من sectorBenchmarks.js نفسه.
 */

// نتائج على شكل مخرجات المحرك التي يقرؤها SmartAdvisor.analyze
function buildResults({ revenue, variableCosts, netIncome }) {
    return { incomeStatement: [{ revenue, variableCosts, netIncome }] };
}
// حالة إدخال بعمالة/إيجار منخفضين حتى لا تتلوّث بإنذارات أخرى
function buildInputs(sector) {
    return {
        projectInfo: { sector },
        hr: { positions: [{ count: 1, salary: 5000, months: 12 }] }, // 60k
        administrative: [{ name: 'إيجار', monthly: 5000 }],           // 60k
        marketing: { monthlyAdBudget: 0 }
    };
}
const cogsInsight = (r) => r.insights.find(i => i.category === 'COGS');

describe('توحيد بنشمارك SmartAdvisor على sectorBenchmarks', () => {
    it('تجزئة بتكلفة بضاعة 60% لا تُوصَم خطأً (كانت تُوصَم بالجدول المثبّت F&B)', () => {
        const res = SmartAdvisor.analyze(
            buildResults({ revenue: 1_000_000, variableCosts: 600_000, netIncome: 50_000 }),
            buildInputs('متجر تجزئة')
        );
        const c = cogsInsight(res);
        // 60% ضمن نطاق التجزئة [55%,75%] ⇒ لا إنذار COGS
        expect(c).toBeUndefined();
    });

    it('مطعم بتكلفة طعام 40% لا يُوصَم (ضمن نطاق F&B ‏28-45% لا سقف 35% القديم)', () => {
        const res = SmartAdvisor.analyze(
            buildResults({ revenue: 1_000_000, variableCosts: 400_000, netIncome: 120_000 }),
            buildInputs('مطعم')
        );
        expect(cogsInsight(res)).toBeUndefined();
    });

    it('لا يفقد أنيابه: مطعم بتكلفة طعام 55% يُوصَم بالخطر', () => {
        const res = SmartAdvisor.analyze(
            buildResults({ revenue: 1_000_000, variableCosts: 550_000, netIncome: 50_000 }),
            buildInputs('مطعم')
        );
        const c = cogsInsight(res);
        expect(c).toBeDefined();
        expect(c.type).toBe('danger');
    });

    it('SmartAdvisor وبوابة QA يتفقان على نفس نطاق القطاع (لا تناقض)', () => {
        const inputs = buildInputs('متجر تجزئة');
        const bench = resolveSectorBenchmark(inputs);
        // نفس النطاق الذي تستخدمه بوابة الجودة
        expect(bench.variableCostRate).toEqual([0.55, 0.75]);
        // تكلفة 60% لا تُنتج تحذيراً في أيٍّ من الجهتين
        const results = buildResults({ revenue: 1_000_000, variableCosts: 600_000, netIncome: 50_000 });
        const qaWarnings = checkDriversAgainstBenchmarks(inputs, results)
            .filter(w => w.code.startsWith('BENCH_VC_RATE'));
        expect(qaWarnings.length).toBe(0);
        expect(cogsInsight(SmartAdvisor.analyze(results, inputs))).toBeUndefined();
    });

    it('قطاع غير معروف يسقط إلى المعيار العام دون انهيار', () => {
        const bench = resolveSectorBenchmark({ projectInfo: { sector: 'قطاع غريب لا يطابق' } });
        expect(bench.isGeneric).toBe(true);
        const res = SmartAdvisor.analyze(
            buildResults({ revenue: 1_000_000, variableCosts: 400_000, netIncome: 100_000 }),
            buildInputs('قطاع غريب لا يطابق')
        );
        expect(Array.isArray(res.insights)).toBe(true);
    });
});
