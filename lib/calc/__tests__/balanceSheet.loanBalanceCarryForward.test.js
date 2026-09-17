/**
 * تدقيق شامل ٢٠٢٦-٠٩-١٦ — الميزانية تُسقط رصيد القرض غير المسدَّد بمجرد أن تتجاوز
 * السنة المعروضة مدة القرض الاسمية (termYears)، حتى لو لم يُسدَّد أي جزء من الأصل
 * فعلياً (فترة سماح تغطي كامل المدة) — فتنكسر Assets = Liabilities + Equity بمقدار
 * رصيد القرض بالضبط. العلة: computeBalanceSheet كان يبحث عن صف مطابق تماماً للسنة
 * (annualSummary.find(s => s.year === year))، وjدول القرض (loanSchedule.js) يبني صفوفاً
 * فقط حتى termYears بصرف النظر عن اكتمال السداد من عدمه — فحين year > termYears لا صف
 * مطابق، ويسقط الرصيد إلى 0 بدل ترحيله. الإصلاح: ترحيل آخر رصيد معروف (نفس نمط
 * outstandingDebtAtHorizon المُثبَت في web/js/core/financial/cashflow.js، المستخدم هناك
 * لنفس الفجوة بالضبط عند حساب NPV/IRR).
 *
 * السيناريو أدناه واقعي بالكامل: مدة قرض سنتان وسماح 24 شهراً (كلتا القيمتين ضمن حدود
 * حقلي الإدخال نفسيهما في FinancingStructure.js: max="20" سنة، max="24" شهر سماح) —
 * لا حاجة لأي قيمة متطرفة خارج ما تسمح به الواجهة.
 */
import { describe, it, expect } from 'vitest';
import { calculateStudy } from '../../../web/js/core/engine.js';
import { SECTIONS } from '../../../web/js/core/schema.js';

function makeStudyWithGracePeriodCoveringFullTerm() {
    return {
        [SECTIONS.PROJECT_INFO]: { name: 'مصنع صغير', sector: 'صناعة', businessModel: 'Independent' },
        assumptions: {
            projectionYears: 5,
            discountRate: 0.10,
            inflationRate: 0.02,
            taxRate: 0.20,
            hiddenOverheadsRate: 0
        },
        [SECTIONS.TECHNICAL]: {
            equipment: [{ name: 'معدات', price: 250000, quantity: 1 }],
            buildings: [], furniture: [], establishmentCosts: [],
            capacityUtilization: [], openingInventory: 0
        },
        [SECTIONS.HR]: {
            positions: [{ position: 'مدير', count: 1, salary: 9000, months: 12, nationality: 'saudi' }]
        },
        [SECTIONS.LOGISTICS]: { logistics: [] },
        [SECTIONS.ADMINISTRATIVE]: { administrative: [{ name: 'إيجار', monthly: 8000 }] },
        [SECTIONS.MARKETING]: { campaigns: [] },
        [SECTIONS.REVENUE]: {
            streams: [{ service: 'تصنيع', type: 'operating', customersPerMonth: 1200, avgPrice: 40, variableCostRate: 0.35, growthRate: 0.04 }]
        },
        [SECTIONS.SERVICES]: { items: [] },
        [SECTIONS.FINANCING]: {
            sources: {
                equity: { amount: 150000, percentage: 60 },
                // مدة سنتان + سماح 24 شهراً = فترة السماح تغطي كامل مدة القرض المُدخلة،
                // فلا يُسدَّد أي جزء من الأصل خلالها إطلاقاً (فائدة فقط طوال السنتين).
                bankLoan: {
                    amount: 100000,
                    percentage: 40,
                    interestRate: 0.08,
                    termYears: 2,
                    gracePeriodMonths: 24,
                    repaymentType: 'equal'
                }
            }
        },
        [SECTIONS.TECH_RESOURCES]: { techResources: [] },
        [SECTIONS.LEGAL]: { licenses: [] }
    };
}

describe('balanceSheet — رصيد القرض لا يسقط بعد انتهاء مدته الاسمية إن لم يُسدَّد فعلياً', () => {
    it('يثبت أن السيناريو يُفعِّل فعلاً الحالة المعنية: القرض لا يزال بكامل قيمته بعد نهاية termYears', () => {
        const r = calculateStudy(makeStudyWithGracePeriodCoveringFullTerm());
        const annualSummary = r.loanSchedule?.annualSummary || [];
        // جدول القرض نفسه يتوقف عند termYears=2 (لا صفوف بعدها) بينما لم يُسدَّد أي أصل
        expect(annualSummary.length).toBe(2);
        expect(annualSummary.every(row => row.totalPrincipal === 0)).toBe(true);
        expect(annualSummary[annualSummary.length - 1].endingBalance).toBeCloseTo(100000, 0);
    });

    it('كل سنوات الإسقاط الخمس متوازنة (isBalanced=true) — القرض يبقى ظاهراً كخصم طويل الأجل بعد السنة 2 لا يختفي', () => {
        const r = calculateStudy(makeStudyWithGracePeriodCoveringFullTerm());

        expect(r.balanceSheets.length).toBe(5);
        r.balanceSheets.forEach((bs) => {
            expect(bs.isBalanced, `السنة ${bs.year} غير متوازنة بفرق ${bs.imbalance}`).toBe(true);
            expect(Math.abs(bs.imbalance)).toBeLessThanOrEqual(5);
        });

        // السنوات 3-5 (بعد نهاية termYears=2): الرصيد الكامل يبقى ظاهراً، لا يسقط إلى صفر.
        r.balanceSheets.slice(2).forEach((bs) => {
            const totalDebt = (bs.liabilities?.current?.currentPortionOfDebt || 0) + (bs.liabilities?.longTerm?.bankLoan || 0);
            expect(totalDebt).toBeCloseTo(100000, 0);
        });
    });

    it('لا يظهر أي سبب اختلال ميزانية في بوابة القرار لهذا السيناريو الواقعي', () => {
        const r = calculateStudy(makeStudyWithGracePeriodCoveringFullTerm());
        const imbalanceReason = r.decisionReasons.find((x) => x.includes('الميزانية العمومية غير متوازنة'));
        expect(imbalanceReason).toBeUndefined();
    });
});
