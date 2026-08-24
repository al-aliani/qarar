/**
 * ΔNWC السنوي + استرداد رأس المال العامل في آخر سنة (2026-08-24، قرارات مالك المنتج).
 *
 * المبدأ الحاكم: `cashCycle` (الحقل القياسي على مستوى نتيجة calculateStudy) لا يتغيّر
 * دلالياً — يبقى الدورة النقدية التأسيسية (سنة 1) المستخدمة في totalInvestment، تماماً
 * كما كان. كل شيء جديد (deltaNWC السنوي، nwcRecapture، cashCycleByYear) حقول/مصفوفة
 * منفصلة تماماً لا تستبدل شيئاً قديماً.
 *
 * ثلاثة اختبارات:
 *  1) دراسة بلا workingCapitalPolicy (hasCashCycle=false) ⇒ deltaNWC/nwcRecapture صفر
 *     لكل سنة، وnetCashFlow يبقى بالضبط operatingCF + financingCF - replacementCost
 *     (الصيغة القديمة قبل هذا التعديل) — يحمي الغالبية العظمى من الدراسات التي لا تملأ
 *     DSO/DPO/DIO من أي تغيير في netCashFlow/npv/irr.
 *  2) دراسة B2B (workingCapitalPolicy مملوءة، نمو إيراد فعلي) ⇒ nwcRecapture يحدث فقط في
 *     السنة الأخيرة، يرفع netCashFlow لتلك السنة، ولا يدخل إطلاقاً حساب cfads/DSCR لأي سنة
 *     (بما فيها السنة الأخيرة نفسها).
 *  3) نفس نوع الدراسة ⇒ الميزانية تبقى متوازنة (isBalanced=true, |imbalance|<=5) لكل
 *     سنوات الأفق، وaccountsPayable لم يعد صفراً حين dpoDays > 0.
 */
import { describe, it, expect } from 'vitest';
import { calculateStudy } from '../../../web/js/core/engine.js';
import { SECTIONS } from '../../../web/js/core/schema.js';

// دراسة بلا سياسة دورة نقدية إطلاقاً (dsoDays/dpoDays/dioDays كلها غائبة) — hasCashCycle=false.
function makeStudyWithoutCashCyclePolicy() {
    return {
        [SECTIONS.PROJECT_INFO]: { name: 'كافيه', sector: 'مقهى', businessModel: 'Independent' },
        assumptions: { projectionYears: 5, discountRate: 0.10, inflationRate: 0.02, hiddenOverheadsRate: 0 },
        [SECTIONS.TECHNICAL]: {
            equipment: [{ name: 'معدات', price: 100000, quantity: 1 }],
            buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: []
        },
        [SECTIONS.HR]: { positions: [{ position: 'مدير', count: 1, salary: 6000, months: 12, nationality: 'saudi' }] },
        [SECTIONS.LOGISTICS]: { logistics: [] },
        [SECTIONS.ADMINISTRATIVE]: { administrative: [{ name: 'إيجار', monthly: 10000 }] },
        [SECTIONS.MARKETING]: { campaigns: [] },
        [SECTIONS.REVENUE]: {
            streams: [{ service: 'مشروبات', type: 'operating', customersPerMonth: 3000, avgPrice: 22, variableCostRate: 0.32, growthRate: 0.05 }]
        },
        [SECTIONS.SERVICES]: { items: [] },
        [SECTIONS.FINANCING]: { sources: {} },
        [SECTIONS.TECH_RESOURCES]: { techResources: [] },
        [SECTIONS.LEGAL]: { licenses: [] }
    };
}

// دراسة B2B: workingCapitalPolicy مملوءة (DSO/DPO/DIO > 0) + قرض بنكي يغطي كل أفق الإسقاط
// (termYears = projectionYears) كي تُحسب dscrAnalysis لكل السنوات الخمس بما فيها الأخيرة.
function makeB2BStudyWithLoanAndCashCyclePolicy() {
    return {
        [SECTIONS.PROJECT_INFO]: { name: 'شركة توزيع B2B', sector: 'تجارة جملة', businessModel: 'Independent' },
        assumptions: {
            projectionYears: 5, discountRate: 0.10, inflationRate: 0.02, taxRate: 0.20, hiddenOverheadsRate: 0,
            workingCapitalPolicy: { dsoDays: 60, dpoDays: 30, dioDays: 15 }
        },
        [SECTIONS.TECHNICAL]: {
            equipment: [{ name: 'معدات', price: 300000, quantity: 1 }],
            buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: [],
            openingInventory: 20000
        },
        [SECTIONS.HR]: {
            positions: [
                { position: 'مدير', count: 1, salary: 10000, months: 12, nationality: 'saudi' },
                { position: 'مندوب مبيعات', count: 2, salary: 6000, months: 12, nationality: 'non-saudi' }
            ]
        },
        [SECTIONS.LOGISTICS]: { logistics: [{ name: 'شحن', monthly: 5000 }] },
        [SECTIONS.ADMINISTRATIVE]: { administrative: [{ name: 'إيجار مستودع', monthly: 12000 }] },
        [SECTIONS.MARKETING]: { campaigns: [] },
        [SECTIONS.REVENUE]: {
            streams: [{ service: 'توزيع بضائع', type: 'operating', customersPerMonth: 3000, avgPrice: 30, variableCostRate: 0.32, growthRate: 0.05 }]
        },
        [SECTIONS.SERVICES]: { items: [] },
        [SECTIONS.FINANCING]: {
            sources: {
                equity: { amount: 300000, percentage: 50 },
                bankLoan: {
                    amount: 300000,
                    percentage: 50,
                    interestRate: 0.08,
                    termYears: 5,
                    gracePeriodMonths: 0,
                    repaymentType: 'equal'
                }
            }
        },
        [SECTIONS.TECH_RESOURCES]: { techResources: [] },
        [SECTIONS.LEGAL]: { licenses: [] }
    };
}

describe('ΔNWC — دراسة بلا سياسة دورة نقدية لا يتغيّر فيها شيء', () => {
    it('hasCashCycle=false ⇒ cashCycle=null، deltaNWC/nwcRecapture صفر لكل سنة، وcashFlow = netIncome + depreciation - loanPrincipalPaid - replacementCost بالضبط (الصيغة القديمة)', () => {
        const r = calculateStudy(makeStudyWithoutCashCyclePolicy());

        expect(r.cashCycle).toBeNull();
        expect(r.incomeStatement.length).toBeGreaterThan(0);

        r.incomeStatement.forEach(stmt => {
            expect(stmt.deltaNWC).toBe(0);
            expect(stmt.nwcRecapture).toBe(0);
            // الصيغة القديمة (قبل ΔNWC/nwcRecapture) كانت: netCashFlow = operatingCF + financingCF - replacementCost
            // = (netIncome + depreciation) + (-loanPrincipalPaid) - replacementCost
            const expectedCashFlow = stmt.netIncome + stmt.depreciation - stmt.loanPrincipalPaid - stmt.replacementCost;
            expect(stmt.cashFlow).toBeCloseTo(expectedCashFlow, 6);
        });

        // npv/irr يُشتقان من نفس سلسلة cashFlow — لا حاجة لإعادة حسابهما هنا؛ إثبات أن كل
        // deltaNWC/nwcRecapture صفر وcashFlow مطابق للصيغة القديمة يضمن عدم تغيّرهما إطلاقاً.
        expect(Number.isFinite(r.indicators?.npv)).toBe(true);
    });
});

describe('ΔNWC — استرداد رأس المال العامل في آخر سنة فقط، وخارج CFADS/DSCR كلياً', () => {
    it('nwcRecapture > 0 في آخر سنة فقط، يرفع cashFlow لتلك السنة، ولا يدخل حساب cfads/dscrAnalysis لأي سنة', () => {
        const r = calculateStudy(makeB2BStudyWithLoanAndCashCyclePolicy());
        const years = r.incomeStatement.length;
        expect(years).toBe(5);
        expect(r.cashCycle).toBeTruthy();

        // 1) الاسترداد يحدث في آخر سنة فقط
        r.incomeStatement.forEach((stmt, idx) => {
            const isLast = idx === years - 1;
            if (isLast) {
                expect(stmt.nwcRecapture).toBeGreaterThan(0);
            } else {
                expect(stmt.nwcRecapture).toBe(0);
            }
        });

        const lastStmt = r.incomeStatement[years - 1];

        // 2) يرفع netCashFlow لتلك السنة: cashFlow يطابق الصيغة الكاملة بما فيها +nwcRecapture،
        //    وهو أعلى مما كان سيكون بدونه بالضبط بمقدار nwcRecapture.
        const cashFlowWithoutRecapture = lastStmt.netIncome + lastStmt.depreciation
            - lastStmt.loanPrincipalPaid - lastStmt.replacementCost - lastStmt.deltaNWC;
        const cashFlowWithRecapture = cashFlowWithoutRecapture + lastStmt.nwcRecapture;
        expect(lastStmt.cashFlow).toBeCloseTo(cashFlowWithRecapture, 6);
        expect(lastStmt.cashFlow).toBeGreaterThan(cashFlowWithoutRecapture);

        // 3) لا يدخل cfads/DSCR إطلاقاً — نعيد بناء cfads يدوياً من نفس حقول stmt العلنية
        //    (ebitda/levy/replacementCost/deltaNWC فقط، بلا nwcRecapture) ونقارنه بـdscrAnalysis
        //    الفعلي المُصدَّر، ثم نثبت أن تضمين nwcRecapture خطأً كان سيرفع DSCR (لإثبات أن
        //    استبعاده حقيقي وليس تطابقاً صدفة).
        expect(r.dscrAnalysis.length).toBe(years); // القرض يغطي كل الأفق (termYears=5)
        const lastDscrEntry = r.dscrAnalysis[years - 1];
        const debtServiceLast = r.loanSchedule.annualSummary.find(s => s.year === years)?.totalPayment || 0;
        expect(debtServiceLast).toBeGreaterThan(0);

        const cfadsExcludingRecapture = Math.max(0,
            lastStmt.ebitda - lastStmt.levy - lastStmt.replacementCost - lastStmt.deltaNWC);
        const cfadsIfRecaptureWereIncluded = Math.max(0,
            lastStmt.ebitda - lastStmt.levy - lastStmt.replacementCost - lastStmt.deltaNWC + lastStmt.nwcRecapture);

        const expectedDscr = cfadsExcludingRecapture > 0
            ? Number((cfadsExcludingRecapture / debtServiceLast).toFixed(2))
            : null;
        const dscrIfRecaptureWereIncluded = cfadsIfRecaptureWereIncluded > 0
            ? Number((cfadsIfRecaptureWereIncluded / debtServiceLast).toFixed(2))
            : null;

        expect(lastDscrEntry.dscr).toBe(expectedDscr);
        // إثبات أن الاستبعاد حقيقي: لو كان nwcRecapture مُدرَجاً خطأً في CFADS لارتفع DSCR
        // (لأن nwcRecapture > 0)، والقيمة الفعلية المُصدَّرة أقل من تلك القيمة الخاطئة.
        expect(dscrIfRecaptureWereIncluded).toBeGreaterThan(expectedDscr);
    });
});

describe('ΔNWC — الميزانية تبقى متوازنة، وaccountsPayable لم يعد صفراً', () => {
    it('isBalanced=true و|imbalance|<=5 لكل سنوات الأفق، وaccountsPayable > 0 حين dpoDays > 0', () => {
        const r = calculateStudy(makeB2BStudyWithLoanAndCashCyclePolicy());

        expect(r.balanceSheets.length).toBe(5);
        r.balanceSheets.forEach(bs => {
            expect(bs.isBalanced, `السنة ${bs.year} غير متوازنة بفرق ${bs.imbalance}`).toBe(true);
            expect(Math.abs(bs.imbalance)).toBeLessThanOrEqual(5);
            // ذمم الموردين لم تعد مقفلة على صفر (العلة الأصلية) — موجبة فعلياً لكل سنة
            expect(bs.liabilities.current.accountsPayable).toBeGreaterThan(0);
        });
    });
});
