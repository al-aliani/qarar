/**
 * ═══ التدفقات النقدية والمؤشرات المالية ═══
 * حساب NPV و IRR و MIRR والقيمة النهائية (Terminal Value)
 */

export function calculateNPV(rate, cashflows) {
    return cashflows.reduce((acc, val, i) => acc + val / Math.pow(1 + rate, i), 0);
}

export function calculateIRR(cashflows, guess = 0.1) {
    // null = غير قابل للحساب (نفس اصطلاح calculatePaybackPeriod أدناه)، وليس 0% —
    // فرق جوهري: صفر تدفقات سالبة يعني "لا يوجد استثمار مسجَّل بعد"، لا "عائد صفري".
    if (!Array.isArray(cashflows) || cashflows.length < 2) return null;
    if (!cashflows.some(v => v > 0) || !cashflows.some(v => v < 0)) return null;

    const maxIter = 1000;
    const precision = 1e-7;
    let rate = guess;

    for (let i = 0; i < maxIter; i++) {
        const npv = calculateNPV(rate, cashflows);
        if (Math.abs(npv) < precision) break;

        const derivative = cashflows.reduce((acc, val, t) => {
            if (t === 0) return acc;
            return acc - t * val * Math.pow(1 + rate, -t - 1);
        }, 0);

        if (derivative === 0) break;
        const newRate = rate - npv / derivative;
        if (!Number.isFinite(newRate) || newRate <= -0.9999 || newRate > 1e4) break;
        if (Math.abs(newRate - rate) < precision) { rate = newRate; break; }
        rate = newRate;
    }
    if (!Number.isFinite(rate)) return null;

    const finalNpv = calculateNPV(rate, cashflows);
    const scale = 1 + Math.abs(cashflows[0]);
    if (Math.abs(finalNpv) > 1e-3 * scale) return null;
    if (rate > 5) return null;
    if (rate < -0.9999) return -0.9999;
    return rate;
}

// عدد مرات تغيّر الإشارة بين القيم غير الصفرية في متتالية تدفقات نقدية (قاعدة ديكارت
// للجذور — تعدد التغيّرات يعني احتمال تعدد جذور IRR رياضياً). الأصفار تُتجاهَل تماماً
// ولا تُعامَل كإشارة، فلا تُحتسَب كتغيّر مقابل القيمة السابقة/التالية غير الصفرية.
export function countSignChanges(cashflows) {
    if (!Array.isArray(cashflows)) return 0;
    let changes = 0;
    let lastSign = 0;
    for (const v of cashflows) {
        const sign = Math.sign(v);
        if (sign === 0) continue;
        if (lastSign !== 0 && sign !== lastSign) changes++;
        lastSign = sign;
    }
    return changes;
}

// الاسترداد لا يُعتمد إلا إن بقي التراكمي ≥ 0 من لحظة العبور حتى نهاية السلسلة — نفس منطق
// engine.js حرفياً (تصحيح 2026-08-25). قبل ذلك كان **أول** عبور يُرجَع فوراً (return داخل
// الحلقة)، فمشروعٌ يعبر مبكراً ثم ينهار إلى السالب بنهاية الأفق كان يعرض «0.8 سنة» في بطاقة
// كل خدمة (ServiceAnalysis.js). عبورٌ جديد بعد الانتكاس يُسجَّل من جديد.
// المخرجات: رقم = استرداد معتمَد، Infinity = لم يعبر الصفر قط (سلوك قائم لم يتغيّر،
// تعرضه الشاشة «∞»)، null = مدخلات غير صالحة أو عبورٌ انتكس ولم يتعافَ (اصطلاح المحرك).
export function calculatePaybackPeriod(cashflows) {
    if (!Array.isArray(cashflows) || cashflows.length === 0 || cashflows[0] >= 0) return null;
    let cumulative = 0;
    let payback = Infinity;
    let reverted = false;
    for (let i = 0; i < cashflows.length; i++) {
        const previous = cumulative;
        const current = Number(cashflows[i]) || 0;
        cumulative += current;
        if (previous < 0 && cumulative >= 0 && current > 0) {
            payback = (i - 1) + (-previous / current);
        } else if (cumulative < 0 && Number.isFinite(payback)) {
            payback = Infinity;
            reverted = true;
        }
    }
    if (Number.isFinite(payback)) return payback;
    return reverted ? null : Infinity;
}

export function calculateMIRR(cashflows, financeRate, reinvestRate) {
    if (!cashflows?.length) return 0;
    const n = cashflows.length;
    let pvNeg = 0;
    let fvPos = 0;
    for (let i = 0; i < n; i++) {
        const cf = cashflows[i];
        if (cf < 0) pvNeg += cf / Math.pow(1 + financeRate, i);
        else if (cf > 0) fvPos += cf * Math.pow(1 + reinvestRate, n - 1 - i);
    }
    if (pvNeg >= 0 || fvPos <= 0) return 0;
    return Math.pow(-fvPos / pvNeg, 1 / (n - 1)) - 1;
}

/**
 * رصيد القرض غير المسدَّد عند نهاية أفق الدراسة.
 *
 * تدقيق 2026-08-25: كان `annualSummary.find(s => s.year === years)?.endingBalance ?? 0`
 * في موضعين متوازيين. و`computeLoanSchedule` يبني صفوفاً لـ`1..termYears` **فقط**، فحين
 * تكون مدة القرض **أقصر** من الأفق ويبقى رصيد غير مسدَّد (قرض سنة واحدة مع فترة سماح
 * 12 شهراً مثلاً — وكلاهما داخل حدود حقول الواجهة) لا يوجد صف للسنة `years` فيصير الرصيد
 * صفراً صمتاً **ويختفي القرض كلياً من التقييم**.
 *
 * قياس فعلي على مشروع واحد: بالعيب NPV = +508,872 والقرار «امضِ»؛ وبقرض يُسدَّد فعلاً
 * NPV = −781,040 والقرار «لا تمضِ». فارق 1.29 مليون ريال من حقلين في نموذج.
 *
 * التصحيح السابق (2026-07-22) عالج الاتجاه المعاكس فقط (قرض **أطول** من الأفق) —
 * ولهذا بقي هذا الاتجاه مكشوفاً: الاختبار كُتب من زاوية العيب الذي فُكِّر فيه.
 *
 * الصواب: رصيد **آخر** صف عند أو قبل الأفق. القرض لا يُسدَّد بانتهاء مدته الاسمية؛
 * الرصيد الذي بقي عند آخر سنة مجدولة يبقى التزاماً قائماً عند الأفق.
 */
export function outstandingDebtAtHorizon(loanScheduleData, years) {
    const rows = loanScheduleData?.annualSummary;
    if (!Array.isArray(rows) || rows.length === 0) return 0;
    let balance = 0;
    let bestYear = -Infinity;
    for (const row of rows) {
        const y = Number(row?.year);
        if (!Number.isFinite(y) || y > years) continue;
        if (y > bestYear) {
            bestYear = y;
            balance = Number(row?.endingBalance) || 0;
        }
    }
    return Math.max(0, balance);
}

export function calculateTerminalValue({
    tvCfg,
    lastYearIncomeStatement,
    discountRate,
    years,
    loanScheduleData
}) {
    let terminalValueDiscounted = 0;
    let tvEquity = 0;

    if ((tvCfg.method || 'gordon') !== 'none') {
        const ebitLast = Number(lastYearIncomeStatement.ebit || 0);
        const ebtLast = Number(lastYearIncomeStatement.ebt || 0);
        const levyLast = Number(lastYearIncomeStatement.zakat || 0) + Number(lastYearIncomeStatement.tax || 0);
        const effLevyRate = ebtLast > 0 ? Math.min(1, levyLast / ebtLast) : 0;
        
        // FCFF مقرَّب: NOPAT + إعادة إضافة الإهلاك - الاستثمار الإحلالي (بدون ΔNWC — قرار منفصل)
        const depreciationLast = Number(lastYearIncomeStatement.depreciation || 0);
        const replacementCostLast = Number(lastYearIncomeStatement.replacementCost || 0);
        const normalizedFCF = ebitLast * (1 - effLevyRate) + depreciationLast - replacementCostLast;
        const g = Math.min(Number(tvCfg.growthRate ?? 0.02), Math.max(0, discountRate - 0.02));
        
        if (normalizedFCF > 0 && discountRate > g) {
            const tvEnterprise = (normalizedFCF * (1 + g)) / (discountRate - g);
            const remainingDebtAtHorizon = outstandingDebtAtHorizon(loanScheduleData, years);
            tvEquity = Math.max(0, tvEnterprise - remainingDebtAtHorizon);
            terminalValueDiscounted = tvEquity / Math.pow(1 + discountRate, years);
        }
    }

    return { tvEquity, terminalValueDiscounted };
}
