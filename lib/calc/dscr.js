/**
 * DSCR Calculator (Debt Service Coverage Ratio)
 * Key metric for bank loan approval
 */

export function computeDSCR(ebitda, annualDebtService) {
    if (!annualDebtService || annualDebtService <= 0) {
        return {
            dscr: Infinity,
            dscrFormatted: 'N/A (لا يوجد قرض)',
            status: 'جيد',
            color: 'green',
            meetsRequirement: true,
            description: 'لا توجد التزامات قروض'
        };
    }

    const dscr = ebitda / annualDebtService;

    let status, color, description;

    if (dscr >= 2.0) {
        status = 'ممتاز';
        color = 'green';
        description = 'قدرة سداد عالية جداً - مؤهل للقروض الكبيرة';
    } else if (dscr >= 1.5) {
        status = 'جيد جداً';
        color = 'green';
        description = 'قدرة سداد قوية - مقبول لدى معظم البنوك';
    } else if (dscr >= 1.25) {
        status = 'جيد';
        color = 'blue';
        description = 'الحد الأدنى المطلوب من معظم البنوك السعودية';
    } else if (dscr >= 1.0) {
        status = 'مقبول';
        color = 'yellow';
        description = 'يغطي الالتزامات بالكاد - قد يطلب البنك ضمانات إضافية';
    } else {
        status = 'خطر';
        color = 'red';
        description = 'غير قادر على تغطية أقساط القرض - إعادة هيكلة مطلوبة';
    }

    return {
        dscr: dscr.toFixed(2),
        dscrFormatted: dscr.toFixed(2) + 'x',
        ebitda: Math.round(ebitda),
        annualDebtService: Math.round(annualDebtService),
        status,
        color,
        meetsRequirement: dscr >= 1.25,
        description
    };
}

/**
 * Compute DSCR for all projection years
 */
export function computeMultiYearDSCR(incomeStatements, loanSchedule) {
    if (!loanSchedule?.annualSummary) return [];

    return incomeStatements.map((stmt, idx) => {
        const yearDebtService = loanSchedule.annualSummary[idx]?.totalPayment || 0;
        return {
            year: stmt.year,
            ...computeDSCR(stmt.ebitda, yearDebtService)
        };
    });
}
