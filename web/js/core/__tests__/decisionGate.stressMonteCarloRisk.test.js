/**
 * تدقيق 2026-07-08 (ملاحظة عالية #34، أُنجزت جزئياً سابقاً): قرار GO/NO-GO كان يدمج
 * فقط السيناريو المتشائم، متجاهلاً تماماً اختبار التحمل ومحاكاة مونت كارلو وسجل
 * المخاطر — فمشروع قد يحصل GO رغم تحذير سيولة حرج في اختبار التحمل، أو احتمالية
 * فشل عالية في مونت كارلو، أو خطر حرج بلا خطة مواجهة. هذا يثبّت 3 بوابات جديدة في
 * computeDecision (engine.js)، كل واحدة على حدة، بدراسات حقيقية عبر calculateStudy
 * الفعلي (لا نتائج مصطنعة) — مع فصل كل بوابة عن الأخرى (سيناريو متشائم مخفَّف يدوياً
 * حتى لا يتداخل مع بوابة اختبار التحمل تحديداً).
 */
import { describe, it, expect } from 'vitest';
import { calculateStudy } from '../engine.js';
import { computeStressSurvival } from '../financial/stressTestMath.js';
import { createEmptyStudy, SECTIONS } from '../schema.js';

// دراسة هامشية عمداً: مطعم صغير (460 عميلاً/شهر)، هامش متغير رفيع (42%، قرب الحد
// الأعلى الواقعي لقطاع fnb)، نمو سريع (35%) يرفع القيمة الحالية الإجمالية رغم ربح
// سنة أولى ضئيل. السيناريو المتشائم يُستبدَل يدوياً بتخفيف معتدل (-2%/+1%) كي يبقى
// موجباً بوضوح، فلا يتداخل مع بوابة اختبار التحمل الجديدة (الأخيرة تستخدم صدمة
// -50%/+20% ثابتة بصرف النظر عن سيناريو المستخدم).
function marginalGrowthStudy({ workingCapitalMonths }) {
    const data = createEmptyStudy();
    data[SECTIONS.PROJECT_INFO] = { ...data[SECTIONS.PROJECT_INFO], businessModel: 'Independent' };
    data.assumptions = {
        ...data.assumptions, projectionYears: 5, discountRate: 0.10, inflationRate: 0.02, taxRate: 0,
        workingCapitalMonths
    };
    data[SECTIONS.TECHNICAL] = { equipment: [{ price: 300000, quantity: 1 }], buildings: [], furniture: [{ price: 50000, quantity: 1 }], establishmentCosts: [], capacityUtilization: [] };
    data[SECTIONS.HR] = { positions: [{ position: 'شيف', count: 3, salary: 5000, months: 12, nationality: 'saudi' }] };
    data[SECTIONS.LOGISTICS] = { logistics: [] };
    data[SECTIONS.ADMINISTRATIVE] = { administrative: [{ name: 'إيجار', monthly: 3000 }] };
    data[SECTIONS.MARKETING] = { campaigns: [] };
    data[SECTIONS.REVENUE] = { streams: [{ type: 'operating', customersPerMonth: 460, avgPrice: 100, variableCostRate: 0.42, growthRate: 0.35 }] };
    data[SECTIONS.SERVICES] = { items: [] };
    data[SECTIONS.FINANCING] = {
        sources: {
            equity: { amount: workingCapitalMonths <= 1 ? 248800 : 357900 },
            bankLoan: { amount: 150000, interestRate: 0.07, termYears: 5, gracePeriodMonths: 0, repaymentType: 'equal' }
        }
    };
    data[SECTIONS.TECH_RESOURCES] = { techResources: [] };
    data[SECTIONS.LEGAL] = { licenses: [] };
    data[SECTIONS.SCENARIOS] = { pessimistic: { revenueChange: -0.02, costChange: 0.01 } };
    return data;
}

describe('بوابة القرار — اختبار التحمل (صدمة -50%/+20% ثابتة)', () => {
    it('احتياطي نقدي رقيق (workingCapitalMonths=0.02): يخفّض GO إلى REVISE بسبب أشهر بقاء أقل من 3 تحت أزمة حادة', () => {
        const study = marginalGrowthStudy({ workingCapitalMonths: 0.02 });
        const results = calculateStudy(study);

        // إعادة اشتقاق مستقلة لنفس أساس اختبار التحمل الذي تقرأه البوابة داخلياً —
        // إثبات رقمي حقيقي (لا مجرد مطابقة نص) أن أشهر البقاء فعلاً أقل من 3.
        const stressBase = {
            monthlyRevenue: results.incomeStatement[0].revenue / 12,
            monthlyFixed: results.opex.fixedAnnual / 12,
            monthlyVariable: results.opex.variableAnnual / 12,
            monthlyDebt: (results.loanSchedule?.annualSummary?.find(s => s.year === 1)?.totalPayment || 0) / 12,
            cashReserve: Math.max(Number(results.capex.workingCapital) || 0, Number(results.balanceSheets?.[0]?.assets?.current?.cash) || 0)
        };
        const { months } = computeStressSurvival(stressBase, 50, 20);
        expect(months).toBeLessThan(3);

        expect(results.decision).toBe('REVISE');
        expect(results.decisionReasons.some(r => r.includes('أزمة حادة') && r.includes('خطر سيولة حرج'))).toBe(true);

        // تأكيد أن هذه البوابة تحديداً هي السبب — لا فجوة تمويل ولا سيناريو متشائم ولا DSCR
        expect(results.financingCheck.fundingGap).toBeLessThanOrEqual(1);
        expect(results.scenarios?.pessimistic?.kpis?.npv).toBeGreaterThan(0);
        expect(results.indicators.dscr).toBeGreaterThanOrEqual(1.25);
        expect(results.indicators.npv).toBeGreaterThan(0);
    });

    it('نفس المشروع باحتياطي نقدي طبيعي (workingCapitalMonths=3، الافتراضي): يبقى GO — البوابة لا تُفعَّل زوراً على مشروع سليم', () => {
        const study = marginalGrowthStudy({ workingCapitalMonths: 3 });
        const results = calculateStudy(study);

        const stressBase = {
            monthlyRevenue: results.incomeStatement[0].revenue / 12,
            monthlyFixed: results.opex.fixedAnnual / 12,
            monthlyVariable: results.opex.variableAnnual / 12,
            monthlyDebt: (results.loanSchedule?.annualSummary?.find(s => s.year === 1)?.totalPayment || 0) / 12,
            cashReserve: Math.max(Number(results.capex.workingCapital) || 0, Number(results.balanceSheets?.[0]?.assets?.current?.cash) || 0)
        };
        const { months } = computeStressSurvival(stressBase, 50, 20);
        expect(months).toBeGreaterThanOrEqual(3); // تأكيد أن الفارق الوحيد بين الاختبارين هو الاحتياطي

        expect(results.decision).toBe('GO');
        expect(results.decisionReasons).toHaveLength(0);
    });
});

describe('بوابة القرار — محاكاة مونت كارلو (آخر تشغيل محفوظ)', () => {
    function baseGoStudy() {
        return marginalGrowthStudy({ workingCapitalMonths: 3 }); // GO نظيف مؤكَّد أعلاه
    }

    it('احتمالية نجاح محفوظة أقل من 50%: تخفّض GO إلى REVISE', () => {
        const study = baseGoStudy();
        study[SECTIONS.MONTE_CARLO] = { lastRun: { successProbability: 0.3 } };
        const results = calculateStudy(study);

        expect(results.decision).toBe('REVISE');
        expect(results.decisionReasons.some(r => r.includes('مونت كارلو') && r.includes('30%'))).toBe(true);
    });

    it('احتمالية نجاح محفوظة عالية (85%): تبقى GO', () => {
        const study = baseGoStudy();
        study[SECTIONS.MONTE_CARLO] = { lastRun: { successProbability: 0.85 } };
        const results = calculateStudy(study);

        expect(results.decision).toBe('GO');
        expect(results.decisionReasons).toHaveLength(0);
    });

    it('لا تشغيل محفوظ إطلاقاً (lastRun غائب): استشارية فقط — لا تخفّض القرار لمجرد عدم التشغيل', () => {
        const study = baseGoStudy();
        // بلا study[SECTIONS.MONTE_CARLO] إطلاقاً — يحاكي مستخدماً لم يفتح خطوة مونت كارلو بعد
        const results = calculateStudy(study);

        expect(results.decision).toBe('GO');
        expect(results.decisionReasons.some(r => r.includes('مونت كارلو'))).toBe(false);
    });

    // تدقيق 2026-07-12: كان سبب «احتمالية منخفضة» يُضاف فقط حين القرار GO أصلاً (نفس شرط
    // تخفيضه) — فمشروع REVISE من سبب آخر (هنا: اختبار التحمل) لا يُظهر هذا السبب رغم صحته،
    // فيبدو التقرير ناقص الشفافية عن مشروع يحمل خطرين حقيقيين لا خطراً واحداً.
    it('احتمالية نجاح منخفضة على مشروع REVISE أصلاً بسبب آخر: السبب يُضاف رغم أن القرار لم يتغيّر (يبقى REVISE)', () => {
        const study = marginalGrowthStudy({ workingCapitalMonths: 0.02 }); // REVISE مؤكَّد أعلاه (اختبار التحمل)
        study[SECTIONS.MONTE_CARLO] = { lastRun: { successProbability: 0.25 } };
        const results = calculateStudy(study);

        expect(results.decision).toBe('REVISE');
        expect(results.decisionReasons.some(r => r.includes('أزمة حادة'))).toBe(true);
        expect(results.decisionReasons.some(r => r.includes('مونت كارلو') && r.includes('25%'))).toBe(true);
    });
});

describe('بوابة القرار — سجل المخاطر (خطر حرج بلا خطة مواجهة)', () => {
    // تعديل طفيف على التمويل هنا لأن حساب علاوة مخاطرة SWOT/المخاطر يغيّر بنداً
    // صغيراً في فجوة التمويل — أُعيد ضبط equity ليطابق فجوة صفرية مع سجل المخاطر تحديداً.
    function baseGoStudyForRisk() {
        const study = marginalGrowthStudy({ workingCapitalMonths: 3 });
        study[SECTIONS.FINANCING].sources.equity.amount = 360100;
        return study;
    }

    it('خطر حرج (احتمالية×أثر ≥9) بلا خطة مواجهة موثَّقة: يخفّض GO إلى REVISE', () => {
        const study = baseGoStudyForRisk();
        study[SECTIONS.RISK_ANALYSIS] = {
            risks: [{ name: 'اعتماد كلي على مورد واحد', probability: 'high', impact: 'high', mitigation: '' }]
        };
        const results = calculateStudy(study);

        expect(results.decision).toBe('REVISE');
        expect(results.decisionReasons.some(r => r.includes('خطر حرج') && r.includes('اعتماد كلي على مورد واحد'))).toBe(true);
    });

    it('نفس الخطر الحرج لكن بخطة مواجهة موثَّقة: يبقى GO — خطر مُدار لا يوقف القرار', () => {
        const study = baseGoStudyForRisk();
        study[SECTIONS.RISK_ANALYSIS] = {
            risks: [{ name: 'اعتماد كلي على مورد واحد', probability: 'high', impact: 'high', mitigation: 'عقود مع 3 موردين بديلين' }]
        };
        const results = calculateStudy(study);

        expect(results.decision).toBe('GO');
        expect(results.decisionReasons.some(r => r.includes('خطر حرج'))).toBe(false);
    });

    it('خطر متوسط (احتمالية×أثر متوسط = 2×3 = 6، أقل من 9) بلا خطة مواجهة: لا يوقف القرار — ليس حرجاً', () => {
        const study = baseGoStudyForRisk();
        study[SECTIONS.RISK_ANALYSIS] = {
            risks: [{ name: 'تأخر توريد بسيط', probability: 'medium', impact: 'medium', mitigation: '' }]
        };
        const results = calculateStudy(study);

        expect(results.decision).toBe('GO');
        expect(results.decisionReasons).toHaveLength(0);
    });

    it('لا مخاطر مسجَّلة إطلاقاً: لا يرمي خطأً ولا يخفّض القرار', () => {
        const study = baseGoStudyForRisk();
        // بلا study[SECTIONS.RISK_ANALYSIS] إطلاقاً
        expect(() => calculateStudy(study)).not.toThrow();
        const results = calculateStudy(study);
        expect(results.decision).toBe('GO');
    });
});
