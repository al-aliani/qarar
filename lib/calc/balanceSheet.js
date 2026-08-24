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
        fundingGap = 0,
        // الدورة النقدية الفعلية (DSO/DIO/DPO) المحسوبة في المحرك — كانت ذمم العملاء
        // صفراً دائماً («Simplified») حتى مع سياسة تحصيل آجل صريحة من المستخدم.
        cashCycle = null
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

    // ذمم العملاء (AR) = رقم الدورة النقدية الفعلي من المحرك (إيراد × DSO ÷ 365)، لا صفراً ثابتاً —
    // كانت «Simplified» تُخفي التحصيل الآجل حتى مع سياسة DSO صريحة من المستخدم.
    const accountsReceivable = Math.max(0, Number(cashCycle?.receivables) || 0);

    // المخزون: من الدورة النقدية الفعلية لهذه السنة (DIO × التكلفة المتغيرة التشغيلية) إن
    // وُجدت سياسة دورة نقدية، وإلا سقوط رجوعاً للمخزون الافتتاحي الثابت كما كان (توافق خلفي).
    // ذمم الموردين (AP): من نفس الدورة النقدية (DPO) — كانت مقفلة على صفر دائماً («simplified»)
    // حتى مع سياسة سداد آجل صريحة من المستخدم (قرار مالك المنتج 2026-08-24، رقم 2).
    // يُعرَّفان هنا (قبل الاستخدام في rawCash أدناه) بدل مكانيهما القديمين لاحقاً في الدالة.
    const inventory = cashCycle
        ? Math.max(0, Number(cashCycle.inventory) || 0)
        : Math.max(0, openingInventory);
    const accountsPayable = Math.max(0, Number(cashCycle?.payables) || 0);

    // Cash ≈ رأس مال عامل + أرباح محتجزة − أصل مُسدَّد (تقدير: صرف السداد يخرج من النقدية)
    // ملاحظة: نضيف الإهلاك المتراكم لأن صافي الربح خُصم منه الإهلاك وهو مصروف غير نقدي —
    // بدونها يُخصم الإهلاك مرتين من جانب الأصول ولا تتوازن الميزانية (Assets = L + E).
    // نطرح ذمم العملاء لأن جزءاً من رأس المال العامل الممول عند التأسيس مُقيَّد فعلياً في AR
    // (غير سائل) لا نقداً في البنك — بدون هذا الطرح تُحتسب AR مرتين (ضمن النقد وكسطر مستقل)
    // فتختل معادلة الميزانية (Assets ≠ L + E).
    // تحديث 2026-08-24: نطرح أيضاً (inventory − openingInventory) لأن أي زيادة في المخزون
    // عن الرصيد الافتتاحي الممول عند التأسيس هي نقد إضافي محتجز في مخزون غير سائل، ونضيف
    // accountsPayable لأنه تمويل مجاني من المورد يرفع النقدية المتاحة فعلياً (لا يُحتسب مرتين:
    // AP يظهر أيضاً كخصم متداول مستقل أدناه، وهذه الإضافة هنا توازيها من جانب الأصول/النقدية
    // تماماً كما تُطرح AR أعلاه لتوازن ظهورها كسطر أصول مستقل).
    const rawCash = workingCapital + cumulativeNetIncome + accumulatedDepreciation
        - cumulativePrincipalPaid - cumulativeReplacement - accountsReceivable
        - (inventory - openingInventory)
        + accountsPayable;
    // تدقيق (اختلال متنامٍ عاماً بعد عام): كانت Math.max(0, rawCash) وحدها تُطبَّق هنا فتُطرح
    // أي قيمة سالبة صمتاً بلا مقابل في جانب الخصوم — وهذا يحدث فعلاً حين ينتهي إعفاء السداد
    // (grace period) فيقفز أصل القرض السنوي فوق ما تراكم من أرباح محتجزة + رأس المال العامل +
    // الإهلاك المضاف مرة أخرى. الفرق المطروح صمتاً كان هو بالضبط مقدار اختلال الميزانية
    // المُبلَّغ عنه، وهو يتراكم مع كل سنة سداد إضافية. النقدية المعروضة لا يمكن أن تكون سالبة
    // فعلياً؛ لكن حين يكون الرصيد الحقيقي (rawCash) سالباً فهذا يعني أن المشروع يحتاج فعلياً
    // تمويلاً قصير الأجل إضافياً (سحب على المكشوف) ليغطي هذا العجز ويستمر بالسداد حسب جدول
    // القرض المُدخل — فنُظهره صراحةً كخصم متداول («عجز سيولة تراكمي»)، لا نخفيه. هذا ليس رقماً
    // مُختلَقاً موازِناً للميزانية بالقوة؛ هو نفس المبلغ الذي كان يُطرح صمتاً من النقدية، منقولاً
    // بأمانة إلى جانب الخصوم كي تبقى الهوية المحاسبية صحيحة بنيوياً لا مفروضة قسراً.
    const cash = Math.max(0, rawCash);
    const cashShortfall = Math.max(0, -rawCash);
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
        // القسط الحالي محدود بالرصيد المتبقي فعلياً (لا أصل السنة التالية وحده) — كانت
        // Math.max(0, endingBalance - currentPortionOfDebt) تُخفي أي فائض حين يتجاوز أصل
        // السنة التالية الرصيد المتبقي، فتُحسب حينها الخصوم (طويل الأجل + قصير الأجل) أعلى من
        // الرصيد المتبقي الفعلي وتختل الميزانية بلا سبب اقتصادي حقيقي. التقييد هنا يضمن أن
        // longTermDebt + currentPortionOfDebt === endingBalance دائماً، بلا حاجة لأي Math.max
        // على longTermDebt (غير سالب بالبناء).
        currentPortionOfDebt = Math.min(nextYearData?.totalPrincipal || 0, endingBalance); // أصل السنة التالية = المستحق خلال 12 شهراً
        longTermDebt = endingBalance - currentPortionOfDebt; // الباقي طويل الأجل
    }

    // Current Liabilities
    // accountsPayable مُعرَّف أعلاه (قبل rawCash) من الدورة النقدية الفعلية — لم يعد مقفلاً
    // على صفر دائماً (قرار مالك المنتج 2026-08-24، رقم 2).
    // عجز السيولة التراكمي (انظر تعليق rawCash أعلاه) خصم متداول حقيقي — تمويل قصير أجل
    // ضمني لازم لاستمرار سداد القرض حسب جدوله المُدخل، لا رقم مختلَق.
    const currentLiabilities = accountsPayable + currentPortionOfDebt + cashShortfall;

    const totalLiabilities = longTermDebt + currentLiabilities;

    // ═══════════════════════════════════════════════════════════════
    // EQUITY (حقوق الملكية)
    // ═══════════════════════════════════════════════════════════════

    const paidInCapital = equityAmount;
    const retainedEarnings = cumulativeNetIncome;
    const totalEquity = paidInCapital + retainedEarnings;

    // Verify balance (Assets = Liabilities + Equity + فجوة التمويل الصريحة)
    const imbalance = totalAssets - (totalLiabilities + totalEquity + fundingGap);
    // لا بيانات مُدخلة بعد (الأصول والخصوم وحقوق الملكية كلها صفر معاً) — الفرق يكون 0
    // صدفة فقط لأن الطرفين صفر، لا لأن الميزانية متوازنة فعلياً؛ بدون هذا الاستثناء تُعرض
    // كـ«متوازنة» (نجاح) قبل إدخال أي بيانات.
    const hasNoData = totalAssets === 0 && totalLiabilities === 0 && totalEquity === 0;
    // تسامح ≤ 5 ريالات لفروق تدوير جدول القرض الشهري (Math.round لكل شهر)
    const isBalanced = !hasNoData && Math.abs(imbalance) <= 5;

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
                // عجز سيولة تراكمي (تمويل قصير أجل ضمني مطلوب لتغطية سداد القرض) — 0 في الحالة
                // السليمة (الأرباح المحتجزة + الإهلاك المضاف تكفي سداد الأصل)، وموجب فقط حين
                // لا تكفي، وعندها يُفصح عنه بدل طرحه صمتاً من النقدية (انظر تعليق rawCash).
                cashShortfall: Math.round(cashShortfall),
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
        hasNoData,
        imbalance: Math.round(imbalance)
    };
}

/**
 * Generate balance sheets for all projection years
 */
export function generateBalanceSheets(data, years = 5) {
    const sheets = [];
    const netIncomeHistory = data.incomeStatements?.map(s => s.netIncome) || [];
    // الدورة النقدية الفعلية لكل سنة (2026-08-24) — تتبع نمو الإيراد الحقيقي بدل تجميد رقم
    // سنة 1؛ سقوط رجوعاً إلى data.cashCycle السكالر القديم حين تغيب المصفوفة (توافق خلفي كامل).
    const cashCycleByYear = data.cashCycleByYear || [];

    for (let year = 1; year <= years; year++) {
        sheets.push(computeBalanceSheet({
            ...data,
            netIncomeHistory,
            cashCycle: cashCycleByYear[year - 1] ?? data.cashCycle ?? null
        }, year));
    }

    return sheets;
}
