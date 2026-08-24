/**
 * تدقيق حي 2026-07-22 (تقرير go/no-go)، مُصلَح 2026-08-21: رصيد القرض المتبقي عند
 * نهاية أفق الدراسة (حين مدة القرض تتجاوز أفق الإسقاط) لم يكن يُخصم من npv/irr/
 * profitabilityIndex الأساسيين — التزام حقيقي على المالك يبقى قائماً حتى لو توقفت
 * التدفقات المحسوبة عند نهاية السنة الأخيرة (لا استمرارية مُفترَضة، خلافاً لـ
 * npvWithTerminal الاسترشادي الذي كان يخصمه بالفعل داخل calculateTerminalValue فقط).
 * الأثر: تمديد مدة القرض وحده — بلا أي تغيير تشغيلي حقيقي — كان يرفع NPV/IRR وهماً
 * ويمرّ لبوابة القرار GO/REVISE/NO-GO ولكل التقارير المصدَّرة.
 */
import { describe, it, expect } from 'vitest';
import { calculateStudy } from '../engine.js';
import { calculateNPV } from '../financial/cashflow.js';
import { createEmptyStudy, SECTIONS } from '../schema.js';

function studyWithLoanTerm(termYears) {
    const data = createEmptyStudy();
    data[SECTIONS.PROJECT_INFO] = { ...data[SECTIONS.PROJECT_INFO], name: 'اختبار رصيد القرض المتبقي', businessModel: 'Independent' };
    // أفق دراسة قصير (3 سنوات) عمداً — مدة قرض أطول منه تضمن رصيداً متبقياً عند السنة 3.
    data.assumptions = { ...data.assumptions, projectionYears: 3, discountRate: 0.10, inflationRate: 0.02, taxRate: 0 };
    data[SECTIONS.TECHNICAL] = { equipment: [{ price: 300000, quantity: 1 }], buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: [] };
    data[SECTIONS.HR] = { positions: [{ position: 'موظف', count: 2, salary: 5000, months: 12, nationality: 'saudi' }] };
    data[SECTIONS.LOGISTICS] = { logistics: [] };
    data[SECTIONS.ADMINISTRATIVE] = { administrative: [{ name: 'إيجار', monthly: 8000 }] };
    data[SECTIONS.MARKETING] = { campaigns: [] };
    data[SECTIONS.REVENUE] = { streams: [{ type: 'operating', customersPerMonth: 3000, avgPrice: 40, variableCostRate: 0.3, growthRate: 0.02 }] };
    data[SECTIONS.SERVICES] = { items: [] };
    data[SECTIONS.FINANCING] = {
        sources: {
            equity: { amount: 200000, percentage: 40 },
            bankLoan: { amount: 300000, interestRate: 0.08, termYears, gracePeriodMonths: 0, repaymentType: 'equal' }
        }
    };
    data[SECTIONS.TECH_RESOURCES] = { techResources: [] };
    data[SECTIONS.LEGAL] = { licenses: [] };
    return data;
}

describe('engine.calculateStudy — رصيد القرض المتبقي عند نهاية الأفق يُخصم من NPV/IRR الأساسيين', () => {
    it('قرض مدته أطول من أفق الدراسة (10 سنوات مقابل أفق 3) يترك رصيداً متبقياً فعلياً', () => {
        const results = calculateStudy(studyWithLoanTerm(10));
        const remaining = results.loanSchedule?.annualSummary?.find(s => s.year === 3)?.endingBalance ?? 0;
        expect(remaining).toBeGreaterThan(0);
    });

    it('NPV الأساسي = NPV التشغيلي (بلا خصم) ناقص القيمة الحالية لرصيد القرض المتبقي', () => {
        const study = studyWithLoanTerm(10);
        const results = calculateStudy(study);
        const discountRate = 0.10;
        const years = 3;

        const remaining = results.loanSchedule.annualSummary.find(s => s.year === years)?.endingBalance ?? 0;
        expect(remaining).toBeGreaterThan(0); // شرط الاختبار

        const equityOutlay = results.capex.total - results.loanSchedule.loanAmount;
        const operatingCashFlows = [-equityOutlay, ...results.incomeStatement.map(y => y.cashFlow)];
        const npvOperating = calculateNPV(discountRate, operatingCashFlows);
        const expectedNpv = npvOperating - remaining / Math.pow(1 + discountRate, years);

        expect(results.indicators.npv).toBeCloseTo(expectedNpv, 0);
        expect(results.indicators.npv).toBeLessThan(npvOperating);
    });

    it('قرض يُسدَّد بالكامل ضمن أفق الدراسة (رصيد متبقٍّ = 0) لا يتأثر NPV فيه بالتصحيح', () => {
        // مدة القرض تساوي أفق الدراسة نفسه (3 سنوات) ⇒ الرصيد المتبقي عند السنة 3 صفر
        // (أو قريب من الصفر) ⇒ npv يجب أن يطابق npvOperating تماماً — لا فارق ولا "عقوبة"
        // كاذبة حين لا يوجد التزام فعلي متبقٍّ. يضمن أن التصحيح لا يُطبَّق إلا عند الحاجة.
        const study = studyWithLoanTerm(3);
        const results = calculateStudy(study);
        const discountRate = 0.10;
        const remaining = results.loanSchedule.annualSummary.find(s => s.year === 3)?.endingBalance ?? 0;
        expect(remaining).toBeLessThan(1); // مسدَّد بالكامل تقريباً

        const equityOutlay = results.capex.total - results.loanSchedule.loanAmount;
        const operatingCashFlows = [-equityOutlay, ...results.incomeStatement.map(y => y.cashFlow)];
        const npvOperating = calculateNPV(discountRate, operatingCashFlows);
        expect(results.indicators.npv).toBeCloseTo(npvOperating, 2);
    });

    it('npvWithTerminal (الاسترشادي) يُبنى من npvOperating لا npv المصحَّح — لا يتكرر خصم رصيد القرض المتبقي مرتين', () => {
        // calculateTerminalValue تطرح remainingDebtAtHorizon داخلياً بالفعل عند بناء tvEquity؛
        // لو استُخدم npv (المصحَّح أيضاً بنفس الخصم) كأساس لـnpvWithTerminal بدل npvOperating،
        // لتكرر خصم نفس الدين مرتين. هذا اختبار انحدار صريح يقفل الصيغة الصحيحة (مُصلَح 2026-08-24).
        const study = studyWithLoanTerm(10);
        const results = calculateStudy(study);
        const discountRate = 0.10;
        const years = 3;

        const remaining = results.loanSchedule.annualSummary.find(s => s.year === years)?.endingBalance ?? 0;
        expect(remaining).toBeGreaterThan(0); // شرط الاختبار

        const equityOutlay = results.capex.total - results.loanSchedule.loanAmount;
        const operatingCashFlows = [-equityOutlay, ...results.incomeStatement.map(y => y.cashFlow)];
        const npvOperating = calculateNPV(discountRate, operatingCashFlows);
        const terminalValue = results.indicators.terminalValue ?? 0;

        expect(terminalValue).toBeGreaterThan(0); // شرط الاختبار — يجب وجود قيمة نهائية فعلية لكي يكون الاختبار ذا معنى

        // الصحيح: npvOperating + terminalValue (بلا خصم إضافي لرصيد القرض، لأن terminalValue نفسها خصمته)
        expect(results.indicators.npvWithTerminal).toBeCloseTo(npvOperating + terminalValue, 0);

        // الخطأ القديم (قبل إصلاح 2026-08-24): كان يستخدم npv المصحَّح بدل npvOperating، فيخصم نفس الدين مرتين.
        const oldBuggyValue = results.indicators.npv + terminalValue;
        expect(results.indicators.npvWithTerminal).not.toBeCloseTo(oldBuggyValue, 0);
    });
});
