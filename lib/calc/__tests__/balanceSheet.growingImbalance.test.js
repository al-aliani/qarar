/**
 * تدقيق ٢٠٢٦-٠٧-٠٩ — اختلال متنامٍ عاماً بعد عام في الميزانية العمومية (بعد فترة سماح).
 *
 * العلة الأصلية: computeBalanceSheet كان يحسب النقدية بـ Math.max(0, rawCash) فقط، فحين
 * تنتهي فترة سماح السداد (grace period) ويقفز أصل القرض السنوي المستحق فوق ما تراكم من
 * أرباح محتجزة + رأس مال عامل + إهلاك مضاف مرة أخرى، يصبح rawCash سالباً فيُطرَح الفرق
 * صمتاً بلا مقابل في جانب الخصوم — وهذا الفرق يتراكم مع كل سنة سداد إضافية (لأن أصل القرض
 * المُسدَّد تراكمي)، فتنمو فجوة (الأصول − (الخصوم + حقوق الملكية)) عاماً بعد عام رغم توازن
 * السنة الأولى (قبل انتهاء السماح). الإصلاح: rawCash السالب يُنقل بأمانة إلى خصم متداول
 * صريح («عجز سيولة تراكمي» / تمويل قصير أجل ضمني) بدل طرحه صمتاً، فتبقى الهوية المحاسبية
 * (Assets = Liabilities + Equity + fundingGap) صحيحة بنيوياً لكل سنوات الإسقاط.
 *
 * هذا هو الاختبار الذي كان سيكشف العلة قبل الإصلاغ: دراسة مقهى صغير بقرض بنكي عليه فترة
 * سماح 6 أشهر (٨٪ فائدة، ٥ سنوات)، وهامش ربح رقيق كفاية بحيث تقفز أقساط الأصل بعد السماح
 * فوق ما تراكم من سيولة تقديرية — تماماً السيناريو المُبلَّغ عنه من المستخدم.
 */
import { describe, it, expect } from 'vitest';
import { calculateStudy } from '../../../web/js/core/engine.js';
import { SECTIONS } from '../../../web/js/core/schema.js';

function makeThinMarginCafeWithGracePeriod(bankLoanAmount = 433320) {
    return {
        [SECTIONS.PROJECT_INFO]: { name: 'كافيه صغير', sector: 'مقهى', businessModel: 'Independent' },
        assumptions: {
            projectionYears: 5,
            discountRate: 0.10,
            inflationRate: 0.02,
            taxRate: 0.20,
            hiddenOverheadsRate: 0
        },
        [SECTIONS.TECHNICAL]: {
            equipment: [{ name: 'معدات مقهى', price: 300000, quantity: 1 }],
            buildings: [{ name: 'تجهيزات محل', price: 200000, quantity: 1 }],
            furniture: [{ name: 'أثاث', price: 80000, quantity: 1 }],
            establishmentCosts: [{ name: 'تأسيس', amount: 40000 }],
            capacityUtilization: [],
            openingInventory: 20000
        },
        [SECTIONS.HR]: {
            positions: [
                { position: 'مدير', count: 1, salary: 8000, months: 12, nationality: 'saudi' },
                { position: 'باريستا', count: 3, salary: 4000, months: 12, nationality: 'non-saudi' }
            ]
        },
        [SECTIONS.LOGISTICS]: { logistics: [{ name: 'توصيل', monthly: 3000 }] },
        [SECTIONS.ADMINISTRATIVE]: { administrative: [{ name: 'إيجار', monthly: 15000 }] },
        [SECTIONS.MARKETING]: { campaigns: [] },
        [SECTIONS.REVENUE]: {
            // هامش رقيق عمداً كي تقفز أقساط الأصل بعد نهاية السماح فوق السيولة المتراكمة
            // (لا خسارة تشغيلية — صافي الربح موجب لكنه غير كافٍ لتغطية سداد الأصل بمفرده)
            streams: [{ service: 'مشروبات ومأكولات', type: 'operating', customersPerMonth: 2600, avgPrice: 22, variableCostRate: 0.32, growthRate: 0.03 }]
        },
        [SECTIONS.SERVICES]: { items: [] },
        [SECTIONS.FINANCING]: {
            sources: {
                equity: { amount: 300000, percentage: 40.9 },
                bankLoan: {
                    amount: bankLoanAmount,
                    percentage: 59.1,
                    interestRate: 0.08,
                    termYears: 5,
                    gracePeriodMonths: 6,
                    repaymentType: 'equal'
                }
            }
        },
        [SECTIONS.TECH_RESOURCES]: { techResources: [] },
        [SECTIONS.LEGAL]: { licenses: [] }
    };
}

describe('balanceSheet — لا اختلال متنامٍ بعد نهاية فترة سماح القرض', () => {
    it('كل سنوات الإسقاط الخمس متوازنة (isBalanced=true, |imbalance| <= 5) رغم أن صافي الربح لا يكفي لتغطية قفزة سداد الأصل بعد السماح', () => {
        const r = calculateStudy(makeThinMarginCafeWithGracePeriod());

        expect(r.balanceSheets.length).toBe(5);

        // تأكيد أن السيناريو يُفعِّل فعلاً الحالة المعنية: صافي ربح موجب لكن النقدية الخام
        // (قبل القيد الصريح لعجز السيولة) تصبح سالبة بعد السماح — أي أن cashShortfall > 0
        // في سنة واحدة على الأقل (وإلا فالاختبار لا يغطي المسار المُصلَح فعلياً).
        const anyShortfall = r.balanceSheets.some(bs => (bs.liabilities?.current?.cashShortfall || 0) > 0);
        expect(anyShortfall).toBe(true);

        r.balanceSheets.forEach(bs => {
            expect(bs.isBalanced, `السنة ${bs.year} غير متوازنة بفرق ${bs.imbalance}`).toBe(true);
            expect(Math.abs(bs.imbalance)).toBeLessThanOrEqual(5);
            // الأصول = الخصوم + حقوق الملكية + فجوة التمويل الصريحة (الهوية المحاسبية الكاملة)
            expect(Math.abs(bs.assets.total - bs.totalLiabilitiesAndEquity)).toBeLessThanOrEqual(5);
        });

        // لا نمو تراكمي في الاختلال عبر السنوات (كان ينمو من ~12,000 إلى ~440,000 قبل الإصلاح)
        const imbalances = r.balanceSheets.map(bs => Math.abs(bs.imbalance));
        imbalances.forEach(im => expect(im).toBeLessThanOrEqual(5));
    });

    it('القسط الحالي من القرض + الرصيد طويل الأجل = الرصيد المتبقي فعلياً بدون تضخيم أو نقص (كل سنوات القرض)', () => {
        const r = calculateStudy(makeThinMarginCafeWithGracePeriod());
        const annualSummary = r.loanSchedule?.annualSummary || [];

        r.balanceSheets.forEach(bs => {
            const yearLoanData = annualSummary.find(s => s.year === bs.year);
            const endingBalance = yearLoanData?.endingBalance || 0;
            const totalDebt = (bs.liabilities?.current?.currentPortionOfDebt || 0) + (bs.liabilities?.longTerm?.bankLoan || 0);
            expect(Math.abs(totalDebt - endingBalance)).toBeLessThanOrEqual(1);
        });
    });
});

describe('balanceSheet — فجوة التمويل الصريحة (financingCheck) لا تتعارض مع سلامة الميزانية', () => {
    it('حين لا تغطي مصادر التمويل المُدخلة إجمالي الاستثمار المطلوب، تظهر fundingGap صراحة وتبقى الميزانية متوازنة رغم ذلك', () => {
        // قرض أقل عمداً من الاستثمار المطلوب (فجوة تمويل حقيقية موجبة) — يجب أن تُحسب
        // financingCheck.fundingGap > 0 وأن تبقى كل سنوات الميزانية متوازنة (الفجوة بند
        // صريح ضمن الهوية المحاسبية، لا تكسرها).
        const underfundedLoan = 300000; // أقل بكثير من الاستثمار المطلوب الفعلي
        const r = calculateStudy(makeThinMarginCafeWithGracePeriod(underfundedLoan));

        expect(r.financingCheck?.totalInvestment).toBeGreaterThan(0);
        expect(r.financingCheck?.fundingGap).toBeGreaterThan(0);

        r.balanceSheets.forEach(bs => {
            expect(bs.isBalanced, `السنة ${bs.year} غير متوازنة بفرق ${bs.imbalance} رغم فجوة تمويل مُعلَنة`).toBe(true);
        });
    });
});
