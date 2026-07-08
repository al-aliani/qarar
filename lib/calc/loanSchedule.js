/**
 * Loan Schedule Calculator
 * Computes monthly/annual loan repayment with grace period support
 */

export function computeLoanSchedule(loanAmount, annualRate, termYears, gracePeriodMonths = 0, repaymentType = 'equal') {
    if (!loanAmount || loanAmount <= 0) {
        return { monthlyPayment: 0, schedule: [], annualSummary: [] };
    }

    const monthlyRate = annualRate / 12;
    const totalMonths = termYears * 12;
    const paymentMonths = totalMonths - gracePeriodMonths;

    // PMT Formula: Monthly payment after grace period (متساوي الأقساط — النمط الافتراضي)
    let monthlyPayment = 0;
    if (paymentMonths > 0 && monthlyRate > 0) {
        monthlyPayment = loanAmount *
            (monthlyRate * Math.pow(1 + monthlyRate, paymentMonths)) /
            (Math.pow(1 + monthlyRate, paymentMonths) - 1);
    } else if (paymentMonths > 0) {
        // Zero interest case
        monthlyPayment = loanAmount / paymentMonths;
    }

    // متناقص (declining): أصل شهري ثابت = القرض ÷ عدد أشهر السداد؛ الفائدة تتناقص مع الرصيد
    // فيكون القسط الشهري أعلى بداية وأقل تدريجياً، وإجمالي الفوائد أقل من متساوي الأقساط.
    const decliningPrincipal = repaymentType === 'declining' && paymentMonths > 0
        ? loanAmount / paymentMonths
        : 0;

    const schedule = [];
    let balance = loanAmount;

    for (let month = 1; month <= totalMonths; month++) {
        const interest = balance * monthlyRate;
        let principal = 0;
        let payment = 0;
        const inGrace = month <= gracePeriodMonths;
        const isLastMonth = month === totalMonths;

        if (!inGrace && repaymentType === 'bullet') {
            // دفعة أخيرة (bullet): فوائد فقط طوال المدة، وأصل القرض كاملاً في آخر شهر
            if (isLastMonth) {
                principal = balance;
                payment = interest + principal;
            } else {
                principal = 0;
                payment = interest;
            }
            balance = Math.max(0, balance - principal);
        } else if (!inGrace && repaymentType === 'declining') {
            principal = Math.min(decliningPrincipal, balance);
            payment = principal + interest;
            balance = Math.max(0, balance - principal);
        } else if (!inGrace) {
            // متساوي الأقساط (equal/amortizing) — الافتراضي
            payment = monthlyPayment;
            principal = payment - interest;
            balance = Math.max(0, balance - principal);
        } else {
            // Grace period: interest-only or full deferral
            payment = interest; // Interest-only during grace
            principal = 0;
        }

        schedule.push({
            month,
            year: Math.ceil(month / 12),
            payment: Math.round(payment),
            principal: Math.round(principal),
            interest: Math.round(interest),
            balance: Math.max(0, Math.round(balance))
        });
    }

    // Annual Summary
    const annualSummary = [];
    for (let year = 1; year <= termYears; year++) {
        const yearData = schedule.filter(s => s.year === year);
        if (yearData.length === 0) continue;

        annualSummary.push({
            year,
            totalPayment: yearData.reduce((sum, m) => sum + m.payment, 0),
            totalPrincipal: yearData.reduce((sum, m) => sum + m.principal, 0),
            totalInterest: yearData.reduce((sum, m) => sum + m.interest, 0),
            endingBalance: yearData[yearData.length - 1]?.balance || 0
        });
    }

    return {
        loanAmount,
        annualRate,
        termYears,
        gracePeriodMonths,
        repaymentType,
        monthlyPayment: Math.round(monthlyPayment),
        schedule,
        annualSummary,
        totalInterest: schedule.reduce((sum, m) => sum + m.interest, 0),
        totalPayment: schedule.reduce((sum, m) => sum + m.payment, 0)
    };
}

/**
 * Get interest expense for a specific year
 */
export function getYearlyInterest(loanSchedule, year) {
    if (!loanSchedule?.annualSummary) return 0;
    const yearData = loanSchedule.annualSummary.find(s => s.year === year);
    return yearData?.totalInterest || 0;
}

/**
 * Get remaining balance at end of year
 */
export function getYearEndBalance(loanSchedule, year) {
    if (!loanSchedule?.annualSummary) return 0;
    const yearData = loanSchedule.annualSummary.find(s => s.year === year);
    return yearData?.endingBalance || 0;
}
