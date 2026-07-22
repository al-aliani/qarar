/**
 * قاموس ثنائي اللغة لتسميات الأقسام المالية الأساسية في التصديرات (Word/Excel/PDF).
 * النطاق مقصود: القوائم المالية والمؤشرات الكمّية فقط (نفس ما فعله منافس حقيقي —
 * جدوى كلاود — في نسخته الإنجليزية: قوائم الدخل/المركز المالي/التدفق النقدي والمؤشرات،
 * لا الأقسام الاستراتيجية/النصية التي يكتبها المستخدم بلغته الخاصة ولا يمكن "ترجمتها"
 * بقاموس تسميات). لا تُضِف هنا نصاً حراً كتبه المستخدم — فقط تسميات بنيوية ثابتة.
 */
const STRINGS = {
    // عناوين الأقسام
    financial_kpis_title: { ar: 'الدراسة المالية (المؤشرات الرئيسية)', en: 'Financial Study (Key Indicators)' },
    ratios_section_title: { ar: 'النسب المالية (5 سنوات)', en: 'Financial Ratios (5-Year)' },
    income_statement_title: { ar: 'قائمة الدخل التقديرية', en: 'Projected Income Statement' },
    cash_flow_title: { ar: 'قائمة التدفقات النقدية', en: 'Cash Flow Statement' },
    balance_sheet_title: { ar: 'الميزانية العمومية التقديرية', en: 'Projected Balance Sheet' },

    // رأس الجدول العام
    item_column: { ar: 'البند', en: 'Item' },
    year_prefix: { ar: 'السنة', en: 'Year' },
    value_column: { ar: 'القيمة', en: 'Value' },
    indicator_column: { ar: 'المؤشر', en: 'Indicator' },

    // المؤشرات المالية الرئيسية
    npv: { ar: 'صافي القيمة الحالية (NPV)', en: 'Net Present Value (NPV)' },
    irr: { ar: 'معدل العائد الداخلي (IRR)', en: 'Internal Rate of Return (IRR)' },
    payback_period: { ar: 'فترة الاسترداد', en: 'Payback Period' },
    roi: { ar: 'العائد على الاستثمار (ROI)', en: 'Return on Investment (ROI)' },

    // قائمة الدخل
    revenue: { ar: 'الإيرادات', en: 'Revenue' },
    variable_costs: { ar: 'التكاليف المتغيرة', en: 'Variable Costs' },
    gross_profit: { ar: 'مجمل الربح', en: 'Gross Profit' },
    fixed_costs: { ar: 'المصاريف الثابتة', en: 'Fixed Costs' },
    franchise_fees: { ar: 'رسوم الامتياز (إتاوات وتسويق)', en: 'Franchise Fees (Royalty & Marketing)' },
    ebitda: { ar: 'EBITDA', en: 'EBITDA' },
    builder_success_fee: { ar: 'رسوم نجاح الحاضنة', en: 'Venture Builder Success Fee' },
    depreciation: { ar: 'الإهلاك', en: 'Depreciation' },
    interest: { ar: 'الفوائد', en: 'Interest' },
    zakat: { ar: 'الزكاة', en: 'Zakat' },
    tax: { ar: 'ضريبة الدخل', en: 'Income Tax' },
    net_income: { ar: 'صافي الربح', en: 'Net Income' },

    // التدفق النقدي
    capex_investment: { ar: 'الاستثمار الرأسمالي', en: 'Capital Investment' },
    loan_inflow: { ar: 'دخول القرض', en: 'Loan Inflow' },
    loan_principal_paid: { ar: 'سداد أصل القرض', en: 'Loan Principal Paid' },
    asset_replacement_cost: { ar: 'تكلفة إحلال الأصول', en: 'Asset Replacement Cost' },
    vat_net_payable: { ar: 'صافي ضريبة القيمة المضافة المستحقة', en: 'Net VAT Payable' },
    net_cash_flow: { ar: 'صافي التدفق النقدي', en: 'Net Cash Flow' },
    cash_flow_after_vat: { ar: 'التدفق النقدي بعد ضريبة القيمة المضافة', en: 'Cash Flow After VAT' },
    cumulative_cash_flow: { ar: 'التدفق النقدي التراكمي', en: 'Cumulative Cash Flow' },

    // الميزانية العمومية
    cash: { ar: 'النقد', en: 'Cash' },
    accounts_receivable: { ar: 'الذمم المدينة', en: 'Accounts Receivable' },
    inventory: { ar: 'المخزون', en: 'Inventory' },
    total_current_assets: { ar: 'إجمالي الأصول المتداولة', en: 'Total Current Assets' },
    net_fixed_assets: { ar: 'صافي الأصول الثابتة', en: 'Net Fixed Assets' },
    total_assets: { ar: 'إجمالي الأصول', en: 'Total Assets' },
    current_liabilities: { ar: 'الالتزامات المتداولة', en: 'Current Liabilities' },
    long_term_liabilities: { ar: 'الالتزامات طويلة الأجل', en: 'Long-Term Liabilities' },
    total_liabilities: { ar: 'إجمالي الالتزامات', en: 'Total Liabilities' },
    share_capital: { ar: 'رأس المال', en: 'Share Capital' },
    retained_earnings: { ar: 'الأرباح المبقاة', en: 'Retained Earnings' },
    total_equity: { ar: 'إجمالي حقوق الملكية', en: 'Total Equity' },

    // النسب المالية
    current_ratio: { ar: 'نسبة التداول', en: 'Current Ratio' },
    quick_ratio: { ar: 'نسبة السيولة السريعة', en: 'Quick Ratio' },
    cash_ratio: { ar: 'نسبة النقدية', en: 'Cash Ratio' },
    debt_ratio: { ar: 'نسبة الدين إلى الأصول', en: 'Debt Ratio' },
    debt_to_equity: { ar: 'نسبة الدين إلى حقوق الملكية', en: 'Debt-to-Equity Ratio' },
    asset_turnover: { ar: 'معدل دوران الأصول', en: 'Asset Turnover' },
    fixed_asset_turnover: { ar: 'معدل دوران الأصول الثابتة', en: 'Fixed Asset Turnover' },
    roa: { ar: 'العائد على الأصول (ROA)', en: 'Return on Assets (ROA)' },
    roe: { ar: 'العائد على حقوق الملكية (ROE)', en: 'Return on Equity (ROE)' }
};

/**
 * @param {string} key - مفتاح من STRINGS أعلاه
 * @param {'ar'|'en'} [lang] - افتراضياً عربي (يطابق السلوك الحالي حرفياً)
 * @returns {string} التسمية باللغة المطلوبة؛ عربي كاحتياط إن غاب المفتاح أو ترجمته
 */
export function t(key, lang = 'ar') {
    const entry = STRINGS[key];
    if (!entry) return key;
    return entry[lang] || entry.ar;
}

/** عنوان عمود سنوي: "السنة 2" أو "Year 2". */
export function yearColumnLabel(yearNum, lang = 'ar') {
    return `${t('year_prefix', lang)} ${yearNum}`;
}
