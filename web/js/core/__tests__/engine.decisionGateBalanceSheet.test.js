/**
 * بوابة القرار تقرأ اختلال الميزانية العمومية بدل أن ترميه.
 *
 * العيب (2026-08-25): المحرك يحسب `isBalanced`/`imbalance` لكل سنة إسقاط ثم لا يقرؤهما
 * أحد — `computeDecision` وكل البوابات المُلحقة به لا تلمسهما إطلاقاً. فدراسة أصولها لا
 * تساوي خصومها + حقوق ملكيتها (بملايين الريالات) كانت قادرة على الخروج بقرار «امضِ»،
 * رغم أن كل مؤشر مبني على تلك القوائم (NPV/IRR/DSCR) يستند حينها إلى أرقام لا تتطابق
 * مع نفسها.
 *
 * الاختلال غير قابل للتوليد من مُدخَلات المستخدم اليوم (الهوية المحاسبية مُغلقة بنيوياً
 * في lib/calc/balanceSheet.js بعد إصلاحات سابقة) — ولهذا بالضبط يجب أن تُختبر البوابة
 * بحقن مُخرَج مُختلّ من وحدة الميزانية نفسها: ما يُختبر هو **عقد البوابة** (ماذا تفعل
 * حين تصلها سنة غير متوازنة)، لا قدرتنا على كسر الميزانية. الحقن على حدود الوحدة
 * (generateBalanceSheets) لا على نص المصدر.
 *
 * ثلاث حالات متعاكسة عمداً:
 *  1) اختلال حقيقي (isBalanced=false, hasNoData=false) ⟹ القرار يُصعَّد ولا يمرّ كـGO،
 *     مع سبب صريح يذكر مقدار الاختلال والسنة.
 *  2) العكس المباشر — `hasNoData=true` (ميزانية بلا بيانات تُبلّغ isBalanced=false
 *     بالتصميم) ⟹ **لا** تصعيد ولا سبب: ليست اختلالاً حقيقياً.
 *  3) العكس الثاني — ميزانية متوازنة ⟹ لا سبب ولا تصعيد (البوابة لا تطلق إنذاراً دائماً).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEmptyStudy, SECTIONS } from '../schema.js';

// حقن على حدود الوحدة: كل شيء آخر في lib/calc/balanceSheet.js يبقى حقيقياً.
const sheetsRef = { value: null };
vi.mock('../../../../lib/calc/balanceSheet.js', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        generateBalanceSheets: (data, years) => {
            const real = actual.generateBalanceSheets(data, years);
            return sheetsRef.value ? sheetsRef.value(real) : real;
        }
    };
});

const { calculateStudy } = await import('../engine.js');

// دراسة مربحة بوضوح مبنية على createEmptyStudy() الحقيقي (hiddenOverheadsRate = 5،
// الافتراض الإنتاجي) — تخرج GO بلا أي بوابة أخرى تُخفّضها، فأي تخفيض لاحق يُنسب حصراً
// لبوابة الميزانية.
function makeProfitableStudy() {
    const s = createEmptyStudy();
    s[SECTIONS.PROJECT_INFO] = { ...s[SECTIONS.PROJECT_INFO], name: 'مصنع', sector: 'تجارة', businessModel: 'Independent' };
    s.assumptions.projectionYears = 5;
    s.assumptions.discountRate = 0.10;
    s.assumptions.inflationRate = 0.02;
    s[SECTIONS.TECHNICAL] = {
        ...s[SECTIONS.TECHNICAL],
        equipment: [{ name: 'معدات', price: 400000, quantity: 1 }],
        buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: []
    };
    s[SECTIONS.HR] = { ...s[SECTIONS.HR], positions: [{ position: 'مدير', count: 1, salary: 10000, months: 12, nationality: 'saudi' }] };
    s[SECTIONS.ADMINISTRATIVE] = { ...s[SECTIONS.ADMINISTRATIVE], administrative: [{ name: 'إيجار', monthly: 10000 }] };
    s[SECTIONS.REVENUE] = {
        ...s[SECTIONS.REVENUE],
        streams: [{ service: 'بيع', type: 'operating', customersPerMonth: 3000, avgPrice: 25, variableCostRate: 0.30, growthRate: 0.05 }]
    };
    return s;
}

const imbalanceReason = (r) => r.decisionReasons.find(x => x.includes('الميزانية العمومية غير متوازنة'));

beforeEach(() => { sheetsRef.value = null; });

describe('بوابة القرار — اختلال الميزانية', () => {
    it('خط الأساس: الدراسة متوازنة فعلاً وتخرج GO بلا سبب اختلال (وإلا كانت الحالات التالية بلا معنى)', () => {
        const r = calculateStudy(makeProfitableStudy());
        expect(r.balanceSheets.every(b => b.isBalanced && !b.hasNoData)).toBe(true);
        expect(r.decision).toBe('GO');
        expect(imbalanceReason(r)).toBeUndefined();
    });

    it('سنة واحدة مختلّة فعلياً (isBalanced=false، hasNoData=false) ⟹ لا تمرّ كـGO، والسبب يذكر السنة والمقدار', () => {
        sheetsRef.value = (real) => real.map((b, i) =>
            i === 2 ? { ...b, isBalanced: false, hasNoData: false, imbalance: -1500000 } : b);

        const r = calculateStudy(makeProfitableStudy());
        expect(r.decision).not.toBe('GO');
        const reason = imbalanceReason(r);
        expect(reason).toBeDefined();
        expect(reason).toContain('السنة 3');
        // المقدار يُعرض بقيمته المطلقة بأرقام عربية-سعودية (نفس نمط بقية أسباب البوابة)
        expect(reason).toContain((1500000).toLocaleString('ar-SA'));
    });

    it('العكس — hasNoData=true مع isBalanced=false (ميزانية بلا بيانات، بالتصميم) ⟹ لا تصعيد ولا سبب', () => {
        sheetsRef.value = (real) => real.map(b => ({ ...b, isBalanced: false, hasNoData: true, imbalance: 0 }));

        const r = calculateStudy(makeProfitableStudy());
        expect(imbalanceReason(r)).toBeUndefined();
        expect(r.decision).toBe('GO');
    });

    it('العكس الثاني — كل السنوات متوازنة رغم اختلال معلن في حقل imbalance وحده ⟹ لا سبب (البوابة تقرأ isBalanced لا الرقم الخام)', () => {
        sheetsRef.value = (real) => real.map(b => ({ ...b, isBalanced: true, hasNoData: false, imbalance: 9999999 }));

        const r = calculateStudy(makeProfitableStudy());
        expect(imbalanceReason(r)).toBeUndefined();
        expect(r.decision).toBe('GO');
    });

    it('أكثر من سنة مختلّة ⟹ السبب يذكر السنة الأسوأ (أكبر اختلال مطلقاً) لا أولها', () => {
        sheetsRef.value = (real) => real.map((b, i) => {
            if (i === 0) return { ...b, isBalanced: false, hasNoData: false, imbalance: 20000 };
            if (i === 3) return { ...b, isBalanced: false, hasNoData: false, imbalance: -880000 };
            return b;
        });

        const r = calculateStudy(makeProfitableStudy());
        const reason = imbalanceReason(r);
        expect(reason).toBeDefined();
        expect(reason).toContain('السنة 4');
        expect(reason).toContain((880000).toLocaleString('ar-SA'));
        expect(r.decision).not.toBe('GO');
    });
});
