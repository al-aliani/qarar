/**
 * Balance Sheet Generator
 * Creates projected balance sheet based on CAPEX, financing, and P&L
 */

export function computeBalanceSheet(data, year) {
    const {
        capex = { total: 0, items: [] },
        depreciation = 0,
        loanSchedule = null,
        netIncomeHistory = [],
        workingCapital = 0,
        equityAmount = 0,
        // المخزون الافتتاحي — أصل متداول ثابت القيمة عبر سنوات الإسقاط (تبسيط: يتجدد بالشراء
        // المستمر المحسوب ضمن التكاليف المتغيرة)، يوازن جانب التمويل الذي موّله عند التأسيس
        openingInventory = 0,
        // فجوة تمويل صريحة: مصادر التمويل المُدخلة أقل من الاستثمار المطلوب.
        // كانت تُخفى بجعل «رأس المال المدفوع» رقماً مشتقاً يوازن الميزانية صمتاً —
        // الآن تظهر سطراً مستقلاً يراه المستخدم (والممول) ويُطالَب بسدّه.
        fundingGap = 0
    } = data;

    // ═══════════════════════════════════════════════════════════════
    // ASSETS (الأصول)
    // ═══════════════════════════════════════════════════════════════

    // جدول قائمة الدخل حتى السنة الحالية — مصدر الإهلاك الفعلي المتناقص والإحلال
    const incomeStatements = data.incomeStatements || [];
    const rowsToDate = incomeStatements.slice(0, year);

    // Fixed Assets (الأصول الثابتة)
    // مجمع الإهلاك من جدول الإهلاك الفعلي المتناقص (لا معدل السنة الأولى الثابت × السنة) —
    // بدونه ينفصل مجمع الإهلاك عن قائمة الدخل بعد استنفاد أعمار الأصول فتنكسر الميزانية بعد السنة 5.
    const accumulatedDepreciation = rowsToDate.length
        ? rowsToDate.reduce((sum, st) => sum + (Number(st.depreciation) || 0), 0)
        : depreciation * year; // احتياط للتوافق الخلفي عند غياب جدول قائمة الدخل

    // الإنفاق الرأسمالي للإحلال (replacement CAPEX) يُرسمَل في الأصول الثابتة ويخرج من النقدية —
    // قائمة التدفقات تخصمه فعلاً، فتجاهله هنا كان يضخّم النقدية بلا مقابل في الأصول.
    const cumulativeReplacement = rowsToDate.reduce((sum, st) => sum + (Number(st.replacementCost) || 0), 0);

    const fixedAssetsGross = (capex.subtotal || capex.total || 0) + cumulativeReplacement;
    const fixedAssetsNet = Math.max(0, fixedAssetsGross - accumulatedDepreciation);

    // Current Assets (الأصول المتداولة)
    const cumulativeNetIncome = netIncomeHistory
        .slice(0, year)
        .reduce((sum, ni) => sum + ni, 0);

    // إجمالي أصل القرض المُسدَّد من السنة 1 حتى السنة الحالية (لتقريب النقدية)
    const cumulativePrincipalPaid = (loanSchedule?.annualSummary || [])
        .filter(s => s.year >= 1 && s.year <= year)
        .reduce((sum, s) => sum + (s.totalPrincipal || 0), 0);

    // Cash ≈ رأس مال عامل + أرباح محتجزة − أصل مُسدَّد (تقدير: صرف السداد يخرج من النقدية)
    // ملاحظة: نضيف الإهلاك المتراكم لأن صافي الربح خُصم منه الإهلاك وهو مصروف غير نقدي —
    // بدونها يُخصم الإهلاك مرتين من جانب الأصول ولا تتوازن الميزانية (Assets = L + E).
    const cash = Math.max(0, workingCapital + cumulativeNetIncome + accumulatedDepreciation
        - cumulativePrincipalPaid - cumulativeReplacement);
    const accountsReceivable = 0; // Simplified
    const inventory = Math.max(0, openingInventory); // بضاعة أول المدة — كانت صفراً دائماً حتى لدراسات التجزئة
    const currentAssets = cash + accountsReceivable + inventory;

    const totalAssets = fixedAssetsNet + currentAssets;

    // ═══════════════════════════════════════════════════════════════
    // LIABILITIES (الخصوم)
    // ═══════════════════════════════════════════════════════════════

    // Long-term Debt & Current Portion
    // الرصيد المتبقي نهاية السنة = المبلغ المتبقي بعد خصم أصل السنة.
    // القسط الحالي = الجزء المستحق خلال الـ 12 شهراً القادمة = أصل السنة التالية.
    // إجمالي الدين = الرصيد المتبقي = طويل الأجل + القسط الحالي (لا يُضاف القسط المُسدَّد في السنة نفسها مرة ثانية).
    let longTermDebt = 0;
    let currentPortionOfDebt = 0;
    if (loanSchedule?.annualSummary) {
        const yearData = loanSchedule.annualSummary.find(s => s.year === year);
        const endingBalance = yearData?.endingBalance || 0;
        const nextYearData = loanSchedule.annualSummary.find(s => s.year === year + 1);
        currentPortionOfDebt = nextYearData?.totalPrincipal || 0; // أصل السنة التالية = المستحق خلال 12 شهراً
        longTermDebt = Math.max(0, endingBalance - currentPortionOfDebt); // الباقي طويل الأجل
    }

    // Current Liabilities (simplified)
    const accountsPayable = 0;
    const currentLiabilities = accountsPayable + currentPortionOfDebt;

    const totalLiabilities = longTermDebt + currentLiabilities;

    // ═══════════════════════════════════════════════════════════════
    // EQUITY (حقوق الملكية)
    // ═══════════════════════════════════════════════════════════════

    const paidInCapital = equityAmount;
    const retainedEarnings = cumulativeNetIncome;
    const totalEquity = paidInCapital + retainedEarnings;

    // Verify balance (Assets = Liabilities + Equity + فجوة التمويل الصريحة)
    const imbalance = totalAssets - (totalLiabilities + totalEquity + fundingGap);
    // تسامح ≤ 5 ريالات لفروق تدوير جدول القرض الشهري (Math.round لكل شهر)
    const isBalanced = Math.abs(imbalance) <= 5;

    return {
        year,
        assets: {
            current: {
                cash: Math.round(cash),
                accountsReceivable: Math.round(accountsReceivable),
                inventory: Math.round(inventory),
                total: Math.round(currentAssets)
            },
            fixed: {
                gross: Math.round(fixedAssetsGross),
                accumulatedDepreciation: Math.round(accumulatedDepreciation),
                net: Math.round(fixedAssetsNet)
            },
            total: Math.round(totalAssets)
        },
        liabilities: {
            current: {
                accountsPayable: Math.round(accountsPayable),
                currentPortionOfDebt: Math.round(currentPortionOfDebt),
                total: Math.round(currentLiabilities)
            },
            longTerm: {
                bankLoan: Math.round(longTermDebt),
                total: Math.round(longTermDebt)
            },
            total: Math.round(totalLiabilities)
        },
        equity: {
            paidInCapital: Math.round(paidInCapital),
            retainedEarnings: Math.round(retainedEarnings),
            total: Math.round(totalEquity)
        },
        fundingGap: Math.round(fundingGap),
        totalLiabilitiesAndEquity: Math.round(totalLiabilities + totalEquity + fundingGap),
        isBalanced,
        imbalance: Math.round(imbalance)
    };
}

/**
 * Generate balance sheets for all projection years
 */
export function generateBalanceSheets(data, years = 5) {
    const sheets = [];
    const netIncomeHistory = data.incomeStatements?.map(s => s.netIncome) || [];

    for (let year = 1; year <= years; year++) {
        sheets.push(computeBalanceSheet({
            ...data,
            netIncomeHistory
        }, year));
    }

    return sheets;
}
