/**
 * استرداد رأس المال العامل عند نهاية الأفق لم يعد مشروطاً بوجود «سياسة دورة نقدية».
 *
 * العيب (قياس 2026-08-25): `nwcRecapture` كان `(isLastYear && hasCashCycle) ? nwc : 0`.
 * فمشروع لا يملأ DSO/DPO/DIO — الغالبية العظمى من الدراسات — **لا يسترد رأس ماله العامل
 * إطلاقاً**، بينما إدخال `dsoDays = 1` (يوم واحد) يمنحه الاسترداد كاملاً. على دراسة مقهى
 * نموذجية مبنية على `createEmptyStudy()` كان الفارق بين «بلا سياسة» و«يوم واحد» يقفز
 * بـ131,554 ريالاً في NPV — منحدر قادر على قلب إشارة القرار بمدخل واحد لا أثر اقتصادي له.
 *
 * الإصلاح: رأس المال العامل المُقيَّد عند التأسيس (`capex.workingCapital`) يُحرَّر عند
 * نهاية الأفق بصرف النظر عن مسار إدخاله (تغطية أشهر أو دورة نقدية)، إضافةً إلى كل زيادة
 * سنوية احتُجزت لاحقاً (Σ deltaNWC).
 *
 * الحالتان المتعاكستان مقصودتان: «بلا سياسة» (المسار الذي كان محروماً) و«بسياسة» (المسار
 * الذي كان مُفضَّلاً). الثابت المشترك المُهاجَم في كليهما هو **الصافي صفر عبر العمر**:
 *     −capex.workingCapital − Σ deltaNWC + Σ nwcRecapture = 0
 * وهو يفشل في المسار الأول بالكود القديم (الاسترداد صفر) وفي أي إصلاح يسترد أكثر أو أقل
 * مما احتُجز فعلاً.
 */
import { describe, it, expect } from 'vitest';
import { calculateStudy } from '../engine.js';
import { createEmptyStudy, SECTIONS } from '../schema.js';

// كل الحالات تبدأ من createEmptyStudy() الحقيقي — hiddenOverheadsRate يبقى 5 (الافتراض
// الإنتاجي) عمداً، لا صفراً مريحاً.
function makeCafe(workingCapitalPolicy) {
    const s = createEmptyStudy();
    s[SECTIONS.PROJECT_INFO] = { ...s[SECTIONS.PROJECT_INFO], name: 'كافيه', sector: 'مقهى', businessModel: 'Independent' };
    s.assumptions.projectionYears = 5;
    s.assumptions.discountRate = 0.10;
    s.assumptions.inflationRate = 0.02;
    if (workingCapitalPolicy) s.assumptions.workingCapitalPolicy = workingCapitalPolicy;
    s[SECTIONS.TECHNICAL] = {
        ...s[SECTIONS.TECHNICAL],
        equipment: [{ name: 'معدات', price: 400000, quantity: 1 }],
        buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: []
    };
    s[SECTIONS.HR] = {
        ...s[SECTIONS.HR],
        positions: [
            { position: 'مدير', count: 1, salary: 15000, months: 12, nationality: 'saudi' },
            { position: 'باريستا', count: 6, salary: 4500, months: 12, nationality: 'expat' }
        ]
    };
    s[SECTIONS.ADMINISTRATIVE] = { ...s[SECTIONS.ADMINISTRATIVE], administrative: [{ name: 'إيجار', monthly: 20000 }] };
    s[SECTIONS.MARKETING] = { ...s[SECTIONS.MARKETING], campaigns: [{ name: 'سوشال', monthly: 8000 }] };
    s[SECTIONS.REVENUE] = {
        ...s[SECTIONS.REVENUE],
        streams: [{ service: 'مشروبات', type: 'operating', customersPerMonth: 5000, avgPrice: 24, variableCostRate: 0.34, growthRate: 0.05 }]
    };
    return s;
}

const lifecycleNet = (r) => -r.capex.workingCapital
    + r.incomeStatement.reduce((acc, y) => acc - y.deltaNWC + y.nwcRecapture, 0);

describe('استرداد رأس المال العامل — المسار بلا سياسة دورة نقدية (كان محروماً)', () => {
    it('بلا DSO/DPO/DIO: الاسترداد يقع في السنة الأخيرة فقط ويساوي رأس المال العامل التأسيسي، وصافي دورة الحياة صفر', () => {
        const r = calculateStudy(makeCafe(null));

        expect(r.cashCycle).toBeNull();
        expect(r.capex.workingCapital).toBeGreaterThan(0);

        const last = r.incomeStatement.length;
        r.incomeStatement.forEach(y => {
            expect(y.deltaNWC).toBe(0);
            if (y.year === last) {
                expect(y.nwcRecapture).toBeCloseTo(r.capex.workingCapital, 6);
            } else {
                expect(y.nwcRecapture).toBe(0);
            }
        });

        expect(lifecycleNet(r)).toBeCloseTo(0, 6);
        // التدفق النقدي للسنة الأخيرة يحمل الاسترداد فعلياً (لا حقل مُعلن بلا أثر)
        const lastStmt = r.incomeStatement[last - 1];
        expect(lastStmt.cashFlow).toBeCloseTo(
            lastStmt.netIncome + lastStmt.depreciation - lastStmt.loanPrincipalPaid
            - lastStmt.replacementCost - lastStmt.deltaNWC + lastStmt.nwcRecapture, 6);
    });
});

describe('استرداد رأس المال العامل — المسار المعاكس: بسياسة دورة نقدية (كان مُفضَّلاً)', () => {
    it('مع dsoDays=1: الاسترداد لا يزال في السنة الأخيرة فقط، ويغطي غطاء الأشهر + الدورة النقدية معاً، وصافي دورة الحياة صفر', () => {
        const r = calculateStudy(makeCafe({ dsoDays: 1 }));

        expect(r.cashCycle).not.toBeNull();
        const last = r.incomeStatement.length;
        r.incomeStatement.forEach(y => {
            if (y.year !== last) expect(y.nwcRecapture).toBe(0);
        });

        const lastStmt = r.incomeStatement[last - 1];
        // أكبر من رأس المال العامل التأسيسي بمقدار ما تراكم من ΔNWC (نمو الإيراد يرفع الذمم)
        const sumDelta = r.incomeStatement.reduce((acc, y) => acc + y.deltaNWC, 0);
        expect(lastStmt.nwcRecapture).toBeCloseTo(r.capex.workingCapital + sumDelta, 6);
        expect(lifecycleNet(r)).toBeCloseTo(0, 6);
    });

    it('مع سياسة كاملة (DSO/DIO/DPO): نفس الثابت — صافي دورة الحياة صفر ولا استرداد قبل السنة الأخيرة', () => {
        const r = calculateStudy(makeCafe({ dsoDays: 60, dioDays: 15, dpoDays: 30 }));
        const last = r.incomeStatement.length;
        r.incomeStatement.forEach(y => {
            if (y.year !== last) expect(y.nwcRecapture).toBe(0);
        });
        expect(r.incomeStatement[last - 1].nwcRecapture).toBeGreaterThan(0);
        expect(lifecycleNet(r)).toBeCloseTo(0, 6);
    });
});

describe('منحدر يوم DSO الواحد: انكمش لكنه لم يختفِ', () => {
    it('فجوة NPV بين «بلا سياسة» و«dsoDays=1» أقل من نصف ما كانت قبل الإصلاح (131,554 ريالاً)', () => {
        const none = calculateStudy(makeCafe(null));
        const oneDay = calculateStudy(makeCafe({ dsoDays: 1 }));

        const gap = oneDay.indicators.npv - none.indicators.npv;
        // قبل الإصلاح: 131,554 (المحرّكان معاً). بعده: ~55,553 — الباقي من المحرّك (أ)
        // وحده (wcCOGS يستبدل تغطية الأشهر بالدورة النقدية) وهو فرق نمذجة مبرَّر جزئياً
        // ومتروك عمداً. الحاجز هنا يمنع عودة المحرّك (ب) صامتاً.
        expect(gap).toBeGreaterThan(0);
        expect(gap).toBeLessThan(131554 / 2);
    });
});
