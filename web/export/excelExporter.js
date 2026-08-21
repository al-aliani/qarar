/**
 * Excel Exporter (Enhanced)
 * Generates downloadable Excel file with all financial data.
 * Uses SheetJS (xlsx) — npm package مُجمَّع، يُستورد ديناميكياً عبر loadXLSX() (utils.js) عند أول استخدام؛ لا يعتمد على CDN. Null-safe, supports engine + extended results.
 * ترتيب الأوراق: يُطبَّق state.reportSectionOrder عند وجوده (المهمة 71 — توحيد مع ReportGenerator).
 */

import { sanitizeSheetName, sanitizeFilename, loadXLSX, formatExportDateTime, exportDateISO, SAFE, formatDscr } from './utils.js';
import { t, yearColumnLabel } from '../js/i18n/reportStrings.js';

/** معرّفات أوراق المحتوى (بعد ورقة الفهرس) — قابلة للربط مع reportSectionOrder. */
const EXCEL_SHEET_IDS = [
    'summary', 'key_people', 'capex', 'opex', 'revenue', 'income_statement', 'cash_flow',
    'balance_sheet', 'loan_schedule', 'indicators', 'market', 'competitors', 'growth_plans', 'location_geo', 'risks', 'timeline', 'scenarios', 'sensitivity'
];

/** ربط معرّف قسم التقرير بورقة Excel. */
const REPORT_SECTION_TO_EXCEL_SHEET = {
    executive_summary: 'summary',
    project_info: 'key_people',
    market: 'market',
    financial_kpis: 'indicators',
    capex: 'capex',
    income_statement: 'income_statement',
    cash_flow: 'cash_flow',
    loan_schedule: 'loan_schedule',
    risks: 'risks',
    scenarios: 'scenarios',
    sensitivity: 'sensitivity'
};

function formatWaccPct(v) {
    if (v == null || !Number.isFinite(Number(v))) return '—';
    const n = Number(v);
    const pct = n > 1 ? n : n * 100;
    return pct.toFixed(1) + '%';
}

export class ExcelExporter {
    constructor(studyData, financialResults, options = {}) {
        this.data = studyData;
        this.results = financialResults;
        // ثنائي اللغة (المهمة: تصدير إنجليزي) — النطاق مقصود على القوائم المالية والمؤشرات
        // الكمّية فقط (indicators/income_statement/cash_flow/balance_sheet)، بنفس نطاق
        // النسخة الإنجليزية الفعلية لمنافس حقيقي (جدوى كلاود) — لا الأقسام النصية/
        // الاستراتيجية التي يكتبها المستخدم بلغته، فتلك لا تُترجَم بقاموس تسميات.
        this.lang = options.lang === 'en' ? 'en' : 'ar';
    }

    /** ترتيب أوراق المحتوى: يتبع reportSectionOrder إن وُجد، مع إلحاق أي ورقة غير مذكورة. */
    getExcelSheetOrder() {
        const userOrder = (this.data?.reportSectionOrder && this.data.reportSectionOrder.length) ? this.data.reportSectionOrder : [];
        const ordered = [];
        for (const sectionId of userOrder) {
            const sheetId = REPORT_SECTION_TO_EXCEL_SHEET[sectionId];
            if (sheetId && !ordered.includes(sheetId)) ordered.push(sheetId);
        }
        for (const sheetId of EXCEL_SHEET_IDS) {
            if (!ordered.includes(sheetId)) ordered.push(sheetId);
        }
        return ordered;
    }

    /** إضافة ورقة واحدة حسب المعرّف. */
    addSheetById(workbook, sheetId) {
        switch (sheetId) {
            case 'summary': return this.addSummarySheet(workbook);
            case 'key_people': return this.addKeyPeopleSheet(workbook);
            case 'capex': return this.addCapexSheet(workbook);
            case 'opex': return this.addOpexSheet(workbook);
            case 'revenue': return this.addRevenueSheet(workbook);
            case 'income_statement': return this.addIncomeStatementSheet(workbook);
            case 'cash_flow': return this.addCashFlowSheet(workbook);
            case 'balance_sheet': return this.addBalanceSheetSheet(workbook);
            case 'loan_schedule': return this.addLoanScheduleSheet(workbook);
            case 'indicators': return this.addIndicatorsSheet(workbook);
            case 'market': return this.addMarketSheet(workbook);
            case 'competitors': return this.addCompetitorsSheet(workbook);
            case 'growth_plans': return this.addGrowthPlansSheet(workbook);
            case 'location_geo': return this.addLocationGeoSheet(workbook);
            case 'risks': return this.addRisksSheet(workbook);
            case 'timeline': return this.addTimelineSheet(workbook);
            case 'scenarios': return this.addScenariosSheet(workbook);
            case 'sensitivity': return this.addSensitivitySheet(workbook);
            default: break;
        }
    }

    async export(filename = 'feasibility_study') {
        await loadXLSX();

        const workbook = XLSX.utils.book_new();
        // مصنّف عربي: اتجاه الأوراق من اليمين لليسار (كان يُفتح بأعمدة من اليسار)
        workbook.Workbook = workbook.Workbook || {};
        workbook.Workbook.Views = [{ RTL: true }];
        const projectName = this.data?.projectInfo?.name || '';
        const baseName = sanitizeFilename(projectName || filename);

        const sheetOrder = this.getExcelSheetOrder();
        for (const sheetId of sheetOrder) {
            this.addSheetById(workbook, sheetId);
        }
        // الفهرس يُبنى بعد إضافة الأوراق من أسمائها الفعلية —
        // كان قائمة مصمتة تعِد بأوراق (جدول القرض، التحليل الجغرافي…) قد لا تكون موجودة
        this.addIndexSheet(workbook);
        XLSX.utils.move_last_sheet_to_front(workbook);

        const outFilename = `${baseName}_${exportDateISO()}.xlsx`;
        let blob = null;
        try {
            const buffer = await workbook._wb.xlsx.writeBuffer();
            blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            if (typeof window !== 'undefined' && typeof document !== 'undefined') {
                const { trackExport } = await import('./exportTracking.js');
                trackExport(blob, { fileType: 'excel', fileName: outFilename, studyId: this.data?.projectInfo?.id, studyName: projectName });
            }
        } catch (_) { /* لا يمنع نجاح التصدير المحلي أعلاه */ }

        if (typeof window === 'undefined' || typeof document === 'undefined') {
            return { success: true, blob, fileName: outFilename };
        }

        await XLSX.writeFile(workbook, outFilename);
        return outFilename;
    }

    addIndexSheet(workbook) {
        const exportedAt = formatExportDateTime();
        const DESCRIPTIONS = {
            'الملخص': 'ملخص المؤشرات والبيانات الأساسية',
            'الأشخاص الرئيسون': 'الفريق المؤسس والأدوار',
            'CAPEX': 'التكاليف الرأسمالية',
            'OPEX': 'التكاليف التشغيلية',
            'الإيرادات': 'توقعات الإيرادات',
            'قائمة الدخل': 'قائمة الدخل التقديرية',
            'التدفقات النقدية': 'التدفقات النقدية',
            'الميزانية': 'الميزانية العمومية',
            'جدول القرض': 'جدول سداد القرض',
            'المؤشرات': 'مؤشرات التقييم المالي',
            'تحليل السوق': 'تحليل السوق TAM/SAM/SOM',
            'مقارنة المنافسين': 'مقارنة تنافسية مع أبرز المنافسين',
            'خطط النمو': 'خطة نمو الرواتب والتسويق حسب البند/القناة',
            'التحليل الجغرافي': 'الإحداثيات والمواقع البديلة',
            'المخاطر': 'تحليل المخاطر',
            'الجدول الزمني': 'الجدول الزمني',
            'السيناريوهات': 'السيناريوهات (متشائم/أساسي/متفائل)',
            'الحساسية': 'تحليل الحساسية',
        };
        // من الأوراق الموجودة فعلاً في المصنّف — الفهرس لا يعِد بما لا يوجد
        const rows = workbook.SheetNames.map(name => [name, DESCRIPTIONS[name] || '']);
        const data = [
            ['فهرس محتويات التصدير'],
            ['', ''],
            ['الورقة', 'الوصف'],
            ...rows,
            ['', ''],
            ['رقم إصدار الدراسة', String(this.data?.version || '4.0.0')],
            ['تاريخ ووقت التصدير', exportedAt],
            ['مُنشأ بواسطة', 'محاكي الجدوى | دراسة الجدوى الذكية'],
            ['', ''],
            ['تنبيه', 'هذا التصدير للمراجعة ولا يغني عن المراجعة المهنية المحاسبية أو القانونية.'],
        ];
        const ws = XLSX.utils.aoa_to_sheet(data);
        ws['!cols'] = [{ wch: 22 }, { wch: 52 }];
        XLSX.utils.book_append_sheet(workbook, ws, sanitizeSheetName('فهرس'));
    }

    addSummarySheet(workbook) {
        const ind = this.results?.indicators || {};
        const cap = this.results?.capex || {};
        const op = this.results?.opex || {};
        const proj = this.results?.revenueProjection?.[0] || this.results?.incomeStatement?.[0];

        const exportedAt = formatExportDateTime();
        const data = [
            ['ملخص دراسة الجدوى', ''],
            ['', ''],
            ['اسم المشروع', this.data?.projectInfo?.name || 'غير محدد'],
            ['المدينة', this.data?.projectInfo?.city || 'غير محدد'],
            ['تاريخ الدراسة', new Date().toLocaleDateString('ar-SA')],
            ['تاريخ ووقت التصدير', exportedAt],
            ['', ''],
            ['المؤشرات المالية الرئيسية', ''],
            ['إجمالي الاستثمار', SAFE.num(cap.total)],
            ['التكاليف التشغيلية السنوية', SAFE.num(op.totalAnnual)],
            ['الإيرادات السنة الأولى', SAFE.num(proj?.total ?? proj?.revenue)],
            ['صافي القيمة الحالية', SAFE.num(ind.npv)],
            ['معدل العائد الداخلي', SAFE.pctText(ind.irr)],
            ['فترة الاسترداد', SAFE.payback(ind.paybackPeriod ?? ind.payback)],
            ['نسبة DSCR', formatDscr(this.results?.indicators?.dscr)],
            ['', ''],
            ['القرار', this.results?.decision || 'غير محدد'],
            ['', ''],
            ['ملاحظة', 'جميع المبالغ بالريال السعودي (SAR) إلا إن ذُكر غير ذلك.'],
            ['مُنشأ بواسطة', 'محاكي الجدوى | دراسة الجدوى الذكية'],
        ];

        const ws = XLSX.utils.aoa_to_sheet(data);
        ws['!cols'] = [{ wch: 30 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(workbook, ws, sanitizeSheetName('الملخص'));
    }

    addKeyPeopleSheet(workbook) {
        const kp = this.data?.keyPeople?.keyPeople || [];
        const data = [
            ['الأشخاص الرئيسون (الفريق المؤسس)'],
            ['', ''],
            ['الاسم', 'الدور/المسمى', 'الخبرة', 'المؤهلات'],
            ...kp.map((p) => [
                (p.name || '').toString(),
                (p.role || '').toString(),
                (p.experience || '').toString(),
                (p.qualifications || '').toString(),
            ]),
        ];
        const ws = XLSX.utils.aoa_to_sheet(data);
        ws['!cols'] = [{ wch: 18 }, { wch: 20 }, { wch: 30 }, { wch: 30 }];
        XLSX.utils.book_append_sheet(workbook, ws, sanitizeSheetName('الأشخاص الرئيسون'));
    }

    addCapexSheet(workbook) {
        const cap = this.results?.capex || {};
        let items = cap.items;

        if (!Array.isArray(items) || items.length === 0) {
            const b = cap.breakdown || {};
            items = Object.entries(b).map(([k, v]) => ({
                source: k,
                name: k,
                amount: SAFE.num(v),
                depreciationRate: '',
                category: '',
            }));
        }

        const data = [
            ['التكاليف الرأسمالية', '', '', '', ''],
            ['المصدر', 'البند', 'المبلغ', 'نسبة الاستهلاك', 'الفئة'],
            ...items.map((i) => [i.source ?? '', i.name ?? '', SAFE.num(i.amount), i.depreciationRate ?? '', i.category ?? '']),
            ['', '', '', '', ''],
            ['الإجمالي الفرعي', '', SAFE.num(cap.subtotal), '', ''],
            ['الاحتياطي (10%)', '', SAFE.num(cap.contingency), '', ''],
            ['رأس المال العامل', '', SAFE.num(cap.workingCapital), '', ''],
            ['الإجمالي الكلي', '', SAFE.num(cap.total), '', ''],
        ];

        // جدول إهلاك الأصول
        const assetSchedule = Array.isArray(this.results?.assetSchedule) ? this.results.assetSchedule : [];
        data.push(['', '', '', '', '']);
        data.push(['جدول إهلاك الأصول', '', '', '', '']);
        data.push(['اسم الأصل', 'الفئة', 'الإهلاك السنوي', 'العمر الإنتاجي (سنوات)', '']);
        assetSchedule.forEach((a) => {
            data.push([(a.name ?? '').toString(), (a.category ?? '').toString(), SAFE.num(a.annualDepreciation), a.usefulLifeYears ?? '—', '']);
        });

        // رأس المال العامل — التفصيل
        const operating = this.results?.capex?.capitalStructure?.operating;
        if (operating?.total) {
            const b = operating.breakdown || {};
            const labels = {
                rent: 'الإيجار',
                salaries: 'الرواتب',
                marketing: 'التسويق',
                cogs: 'تكلفة البضاعة',
                openingInventory: 'المخزون الافتتاحي',
            };
            data.push(['', '', '', '', '']);
            data.push(['رأس المال العامل — التفصيل', '', '', '', '']);
            data.push(['البند', 'المبلغ', '', '', '']);
            Object.entries(b).forEach(([k, v]) => {
                data.push([labels[k] || k, SAFE.num(v), '', '', '']);
            });
            data.push(['الإجمالي', SAFE.num(operating.total), '', '', '']);
        }

        const ws = XLSX.utils.aoa_to_sheet(data);
        ws['!cols'] = [{ wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(workbook, ws, sanitizeSheetName('CAPEX'));
    }

    addOpexSheet(workbook) {
        const op = this.results?.opex || {};
        let fixed = op.fixed;
        let variable = op.variable;

        if (!Array.isArray(fixed)) fixed = [];
        if (!Array.isArray(variable)) variable = [];

        if (fixed.length === 0 && SAFE.num(op.fixedAnnual) > 0) {
            fixed = [{ source: '—', name: 'إجمالي الثابتة', monthly: op.fixedAnnual / 12, annual: op.fixedAnnual }];
        }
        if (variable.length === 0 && SAFE.num(op.variableAnnual) > 0) {
            variable = [{ source: '—', name: 'إجمالي المتغيرة', monthly: op.variableAnnual / 12, annual: op.variableAnnual }];
        }

        const data = [
            ['التكاليف التشغيلية', '', '', ''],
            ['', '', '', ''],
            ['التكاليف الثابتة', '', '', ''],
            ['المصدر', 'البند', 'شهري', 'سنوي'],
            ...fixed.map((i) => [i.source ?? '', i.name ?? '', SAFE.num(i.monthly), SAFE.num(i.annual)]),
            ['إجمالي الثابتة', '', SAFE.num(op.fixedMonthly ?? op.fixedAnnual / 12), SAFE.num(op.fixedAnnual)],
            ['', '', '', ''],
            ['التكاليف المتغيرة', '', '', ''],
            ...variable.map((i) => [i.source ?? '', i.name ?? '', SAFE.num(i.monthly), SAFE.num(i.annual)]),
            ['إجمالي المتغيرة', '', SAFE.num(op.variableMonthly ?? op.variableAnnual / 12), SAFE.num(op.variableAnnual)],
            ['', '', '', ''],
            ['الإجمالي الكلي', '', SAFE.num(op.totalMonthly ?? op.totalAnnual / 12), SAFE.num(op.totalAnnual)],
        ];

        const ws = XLSX.utils.aoa_to_sheet(data);
        ws['!cols'] = [{ wch: 20 }, { wch: 22 }, { wch: 14 }, { wch: 14 }];
        XLSX.utils.book_append_sheet(workbook, ws, sanitizeSheetName('OPEX'));
    }

    addRevenueSheet(workbook) {
        const isList = this.results?.incomeStatement || [];

        const years = Math.max(1, isList.length);
        const totals = (isList || []).map((s) => SAFE.num(s.revenue));
        while (totals.length < years) totals.push(0);

        const data = [
            ['توقعات الإيرادات', '', '', '', '', ''],
            ['السنة', 'إجمالي الإيرادات', ...Array.from({ length: years }, (_, i) => `السنة ${i + 1}`)],
            ['الإيرادات', '', ...totals],
        ];

        // ملاحظة: الكود السابق كان يعتمد على `this.results.revenueProjection`، وهو مفتاح
        // لا يُنتجه calculateStudy() أبداً (تم التأكد تجريبياً)، ما جعل قسم تفصيل
        // الإيرادات حسب كل مصدر ميتاً بالكامل ولا يُنفَّذ إطلاقاً في الإنتاج.
        // البديل الصحيح هو قراءة بيانات الإدخال الخام لكل مصدر إيراد من `this.data.revenue.streams`
        // (تماماً كما يفعل excel.js). نعرض هنا إيراد السنة الأولى فقط لكل مصدر لأن محرك
        // التمويل لا يحسب توقعاً مستقلاً متعدد السنوات لكل مصدر على حدة — النمو يُطبَّق على
        // إجمالي الإيرادات ككل وليس على كل مصدر منفرد، فتفادينا اختلاق أرقام سنوات لاحقة لكل مصدر.
        const streams = this.data?.revenue?.streams || [];
        if (streams.length) {
            streams.forEach((stream, idx) => {
                const label = stream.name || stream.service || `مصدر إيراد ${idx + 1}`;
                const year1Revenue = (Number(stream.customersPerMonth) || 0) * 12 * (Number(stream.avgPrice) || 0);
                data.push([label, '', SAFE.num(year1Revenue)]);
            });
        }

        const ws = XLSX.utils.aoa_to_sheet(data);
        XLSX.utils.book_append_sheet(workbook, ws, sanitizeSheetName('الإيرادات'));
    }

    addIncomeStatementSheet(workbook) {
        const statements = this.results?.incomeStatement || [];
        const lang = this.lang;
        const headers = [t('item_column', lang), ...statements.map((s) => yearColumnLabel(s.year, lang))];

        // رسوم الامتياز/نجاح الحاضنة صفّان صريحان فقط حين ذات قيمة فعلية — بدونهما كان
        // "مجمل الربح − المصاريف الثابتة" لا يساوي EBITDA المعروض لأن الخصم يقع صمتاً
        // داخل احتساب EBITDA نفسه (انظر engine.js) بلا أي بند ظاهر يفسّر الفرق للقارئ.
        const hasFranchiseFees = statements.some((s) => (s.franchiseFees || 0) > 0);
        const hasBuilderFee = statements.some((s) => (s.builderSuccessFee || 0) > 0);

        const data = [
            [t('income_statement_title', lang)],
            headers,
            [t('revenue', lang), ...statements.map((s) => SAFE.num(s.revenue))],
            [`(-) ${t('variable_costs', lang)}`, ...statements.map((s) => -SAFE.num(s.variableCosts))],
            [t('gross_profit', lang), ...statements.map((s) => SAFE.num(s.grossProfit))],
            [`(-) ${t('fixed_costs', lang)}`, ...statements.map((s) => -SAFE.num(s.fixedCosts))],
            ...(hasFranchiseFees ? [[`(-) ${t('franchise_fees', lang)}`, ...statements.map((s) => -SAFE.num(s.franchiseFees || 0))]] : []),
            [t('ebitda', lang), ...statements.map((s) => SAFE.num(s.ebitda))],
            ...(hasBuilderFee ? [[`(-) ${t('builder_success_fee', lang)}`, ...statements.map((s) => -SAFE.num(s.builderSuccessFee || 0))]] : []),
            [`(-) ${t('depreciation', lang)}`, ...statements.map((s) => -SAFE.num(s.depreciation))],
            ['EBIT', ...statements.map((s) => SAFE.num(s.ebit))],
            [`(-) ${t('interest', lang)}`, ...statements.map((s) => -SAFE.num(s.interestExpense ?? s.interest))],
            ['EBT', ...statements.map((s) => SAFE.num(s.ebt ?? s.ebit))],
            // الزكاة والضريبة صفان منفصلان — كان صف واحد يعرض الضريبة فقط
            // فلا يُجمَع العمود إلى صافي الربح أمام محلل الائتمان
            [`(-) ${t('zakat', lang)}`, ...statements.map((s) => -SAFE.num(s.zakat))],
            [`(-) ${t('tax', lang)}${lang === 'en' ? ' (Non-Saudi Share)' : ' (حصة الأجانب)'}`, ...statements.map((s) => -SAFE.num(s.tax))],
            [t('net_income', lang), ...statements.map((s) => SAFE.num(s.netIncome))],
            ['', ...statements.map(() => '')],
            [
                'هامش الربح الصافي',
                ...statements.map((s) => {
                    const m = s.netMargin ?? (s.revenue ? s.netIncome / s.revenue : 0);
                    return (SAFE.pct(m) || 0).toFixed(1) + '%';
                }),
            ],
        ];

        const ws = XLSX.utils.aoa_to_sheet(data);
        XLSX.utils.book_append_sheet(workbook, ws, sanitizeSheetName('قائمة الدخل'));
    }

    addCashFlowSheet(workbook) {
        const cashFlows = this.results?.cashFlow || [];
        const isList = this.results?.incomeStatement || [];
        const lang = this.lang;

        let list = cashFlows;
        if (list.length === 0 && isList.length > 0) {
            list = [
                { year: 0, cashFlow: -SAFE.num(this.results?.capex?.total), netIncome: 0, depreciation: 0 },
                ...isList.map((s) => ({
                    year: s.year,
                    cashFlow: SAFE.num(s.cashFlow ?? s.netIncome + (s.depreciation || 0)),
                    netIncome: s.netIncome,
                    depreciation: s.depreciation,
                })),
            ];
        }

        let cumulative = 0;
        const cum = list.map((c) => {
            cumulative += SAFE.num(c.cashFlow);
            return cumulative;
        });

        const headers = [t('item_column', lang), ...list.map((c) => yearColumnLabel(c.year, lang))];
        const data = [
            [t('cash_flow_title', lang)],
            headers,
            [t('net_income', lang), ...list.map((c) => SAFE.num(c.netIncome))],
            [`(+) ${t('depreciation', lang)}`, ...list.map((c) => SAFE.num(c.depreciation))],
            [t('net_cash_flow', lang), ...list.map((c) => SAFE.num(c.cashFlow))],
            [t('cumulative_cash_flow', lang), ...cum],
        ];

        const ws = XLSX.utils.aoa_to_sheet(data);
        XLSX.utils.book_append_sheet(workbook, ws, sanitizeSheetName('التدفقات النقدية'));
    }

    addBalanceSheetSheet(workbook) {
        const sheets = this.results?.balanceSheets || [];
        if (sheets.length === 0) return;
        const lang = this.lang;

        const headers = [t('item_column', lang), ...sheets.map((s) => yearColumnLabel(s.year, lang))];
        const data = [
            [t('balance_sheet_title', lang)],
            headers,
            ['الأصول', ...sheets.map(() => '')],
            [`  ${t('total_current_assets', lang)}`, ...sheets.map((s) => SAFE.num(s.assets?.current?.total))],
            [`  ${t('net_fixed_assets', lang)}`, ...sheets.map((s) => SAFE.num(s.assets?.fixed?.net))],
            [t('total_assets', lang), ...sheets.map((s) => SAFE.num(s.assets?.total))],
            ['', ...sheets.map(() => '')],
            ['الخصوم', ...sheets.map(() => '')],
            [`  ${t('current_liabilities', lang)}`, ...sheets.map((s) => SAFE.num(s.liabilities?.current?.total))],
            [`  ${t('long_term_liabilities', lang)}`, ...sheets.map((s) => SAFE.num(s.liabilities?.longTerm?.total))],
            [t('total_liabilities', lang), ...sheets.map((s) => SAFE.num(s.liabilities?.total))],
            ['', ...sheets.map(() => '')],
            [t('total_equity', lang), ...sheets.map((s) => SAFE.num(s.equity?.total))],
            // تصحيح (تدقيق 2026-08-21): totalLiabilitiesAndEquity يضمّ fundingGap صمتاً
            // (lib/calc/balanceSheet.js) بلا أي صفّ ظاهر هنا — فمجموع الخصوم + حقوق الملكية
            // الظاهرين لا يطابق الإجمالي المعروض كلما وُجدت فجوة تمويل. نُظهرها صراحةً.
            ['  فجوة تمويل غير مغطاة', ...sheets.map((s) => SAFE.num(s.fundingGap))],
            ['', ...sheets.map(() => '')],
            ['الخصوم + حقوق الملكية', ...sheets.map((s) => SAFE.num(s.totalLiabilitiesAndEquity))],
        ];

        const ws = XLSX.utils.aoa_to_sheet(data);
        XLSX.utils.book_append_sheet(workbook, ws, sanitizeSheetName('الميزانية'));
    }

    addLoanScheduleSheet(workbook) {
        const loan = this.results?.loanSchedule;
        if (!loan?.annualSummary?.length) return;

        const rate = SAFE.num(loan.annualRate);
        const data = [
            ['جدول سداد القرض'],
            ['', ''],
            ['مبلغ القرض', SAFE.num(loan.loanAmount)],
            ['معدل الفائدة', (rate * 100).toFixed(1) + '%'],
            ['مدة السداد', (loan.termYears ?? 0) + ' سنوات'],
            ['القسط الشهري', SAFE.num(loan.monthlyPayment)],
            ['', ''],
            ['السنة', 'إجمالي الأقساط', 'الأصل', 'الفوائد', 'الرصيد المتبقي'],
            ...loan.annualSummary.map((y) => [
                `السنة ${y.year}`,
                SAFE.num(y.totalPayment),
                SAFE.num(y.totalPrincipal),
                SAFE.num(y.totalInterest),
                SAFE.num(y.endingBalance),
            ]),
            ['', ''],
            ['إجمالي الفوائد', SAFE.num(loan.totalInterest), '', '', ''],
            ['إجمالي المدفوعات', SAFE.num(loan.totalPayment), '', '', ''],
        ];

        const ws = XLSX.utils.aoa_to_sheet(data);
        XLSX.utils.book_append_sheet(workbook, ws, sanitizeSheetName('جدول القرض'));
    }

    addIndicatorsSheet(workbook) {
        const ind = this.results?.indicators || {};
        const wacc = this.results?.wacc || {};
        const dscr = this.results?.dscrAnalysis || [];
        const lang = this.lang;

        const marginVal = SAFE.pct(ind.profitMargin);
        // المحرك يعيد التعادل بوحدات سنوية — البند معنون «وحدات/شهر» فنقسم على 12.
        // (كان يسقط إلى breakEvenPointValue وهو مبلغ بالريال لا وحدات!)
        const breakevenMonthly = Number.isFinite(Number(ind.breakevenUnitsPerMonth))
            ? Number(ind.breakevenUnitsPerMonth)
            : (Number.isFinite(Number(ind.breakEvenUnits)) ? Number(ind.breakEvenUnits) / 12 : 0);

        const data = [
            [t('financial_kpis_title', lang)],
            ['', ''],
            ['المؤشرات الأساسية', ''],
            [t('npv', lang), SAFE.num(ind.npv)],
            [t('irr', lang), SAFE.pctText(ind.irr)],
            [t('payback_period', lang), SAFE.payback(ind.paybackPeriod ?? ind.payback)],
            [t('roi', lang), SAFE.pctText(ind.roi)],
            ['هامش الربح الصافي', marginVal.toFixed(1) + '%'],
            ['نقطة التعادل (وحدات/شهر)', Math.round(breakevenMonthly)],
            ['', ''],
            ['تكلفة رأس المال المرجح', ''],
            ['وزن حقوق الملكية', formatWaccPct(wacc.equityWeight)],
            ['وزن الدين', formatWaccPct(wacc.debtWeight)],
            ['تكلفة حقوق الملكية', formatWaccPct(wacc.costOfEquity)],
            ['تكلفة الدين (بعد الضريبة)', formatWaccPct(wacc.costOfDebtPostTax)],
            ['تكلفة رأس المال المرجح', formatWaccPct(wacc.wacc)],
            ['', ''],
            ['نسبة تغطية خدمة الدين (DSCR)', ''],
            ...(Array.isArray(dscr) && dscr.length
                ? dscr.map((d) => [yearColumnLabel(d.year, lang), formatDscr(d.dscr) + (d.status ? ' - ' + d.status : '')])
                : [['—', 'لا توجد بيانات']]),
        ];

        // النسب المالية — صف لكل نسبة، عمود لكل سنة (نفس نمط عمود-لكل-سنة في قائمة الدخل/التدفقات النقدية)
        const ratios = Array.isArray(this.results?.ratios) ? this.results.ratios : [];
        const pct = (v) => (v == null || !Number.isFinite(Number(v))) ? '—' : (Number(v) * 100).toFixed(1) + '%';
        const mult = (v) => (v == null || !Number.isFinite(Number(v))) ? '—' : Number(v).toFixed(2) + 'x';
        data.push(['', '']);
        data.push([t('ratios_section_title', lang), '']);
        if (ratios.length) {
            data.push([t('item_column', lang), ...ratios.map((r) => yearColumnLabel(r.year, lang))]);
            data.push([t('current_ratio', lang), ...ratios.map((r) => mult(r.currentRatio))]);
            data.push([t('quick_ratio', lang), ...ratios.map((r) => mult(r.quickRatio))]);
            data.push([t('cash_ratio', lang), ...ratios.map((r) => mult(r.cashRatio))]);
            data.push([t('debt_ratio', lang), ...ratios.map((r) => pct(r.debtRatio))]);
            data.push([t('debt_to_equity', lang), ...ratios.map((r) => pct(r.debtToEquity))]);
            data.push([t('asset_turnover', lang), ...ratios.map((r) => mult(r.assetTurnover))]);
            data.push([t('fixed_asset_turnover', lang), ...ratios.map((r) => mult(r.fixedAssetTurnover))]);
            data.push([t('roa', lang), ...ratios.map((r) => pct(r.roa))]);
            data.push([t('roe', lang), ...ratios.map((r) => pct(r.roe))]);
        } else {
            data.push(['—', 'لا توجد بيانات']);
        }

        const ws = XLSX.utils.aoa_to_sheet(data);
        ws['!cols'] = [{ wch: 32 }, { wch: 22 }];
        XLSX.utils.book_append_sheet(workbook, ws, sanitizeSheetName('المؤشرات'));
    }

    addMarketSheet(workbook) {
        const ms = this.data?.marketSizing || {};
        const m = this.data?.marketing || {};
        const tam = ms.tam || m.tam || {};
        const sam = ms.sam || m.sam || {};
        const som = ms.som || m.som || {};
        const segments = ms.segments || m.segments || [];

        const v2030 = ms.vision2030 || {};
        const economy = ms.nationalEconomy || {};

        const data = [
            ['تحليل السوق'],
            ['', ''],
            ['TAM (السوق الكلي)', SAFE.num(tam.value ?? tam), (tam.description || '').toString()],
            ['SAM (السوق المتاح)', SAFE.num(sam.value ?? sam), (sam.description || '').toString()],
            ['SOM (الحصة المستهدفة)', SAFE.num(som.value ?? som), (som.description || '').toString()],
            ['', ''],
        ];

        if (ms.sectorAnalysis || ms.industryAnalysis) {
            data.push(['تحليل القطاع والصناعة', '', '']);
            if (ms.sectorAnalysis) data.push(['تحليل القطاع', (ms.sectorAnalysis || '—').toString(), '']);
            if (ms.industryAnalysis) data.push(['تحليل الصناعة', (ms.industryAnalysis || '—').toString(), '']);
            data.push(['', '', '']);
        }

        const mix = this.data?.marketing?.marketingMix || {};
        if (mix.product || mix.price || mix.place || mix.promotion) {
            data.push(['المزيج التسويقي (4P)', '', '']);
            data.push(['المنتج', (mix.product || '—').toString(), '']);
            data.push(['السعر', (mix.price || '—').toString(), '']);
            data.push(['المكان', (mix.place || '—').toString(), '']);
            data.push(['الترويج', (mix.promotion || '—').toString(), '']);
            data.push(['', '', '']);
        }

        if (v2030.alignment || v2030.relevantPrograms || v2030.impact) {
            data.push(['مواءمة رؤية 2030', '', '']);
            data.push(['ربط المشروع بالرؤية', (v2030.alignment || '—').toString(), '']);
            data.push(['البرامج ذات الصلة', (v2030.relevantPrograms || '—').toString(), '']);
            data.push(['الأثر المتوقع', (v2030.impact || '—').toString(), '']);
            data.push(['', '', '']);
        }

        if (economy.gdpGrowth || economy.sectorGrowth || economy.keyIndicators || economy.trends) {
            data.push(['دراسة اقتصاد الدولة', '', '']);
            data.push(['النمو والاتجاه الاقتصادي', (economy.gdpGrowth || '—').toString(), '']);
            data.push(['نمو القطاع المستهدف', (economy.sectorGrowth || '—').toString(), '']);
            data.push(['مؤشرات وطنية ذات صلة', (economy.keyIndicators || '—').toString(), '']);
            data.push(['الاتجاهات المؤثرة', (economy.trends || '—').toString(), '']);
            data.push(['', '', '']);
        }

        if (segments.length) {
            data.push(['شرائح العملاء', '', '']);
            data.push(['الشريحة', 'الحجم', 'الوصف']);
            segments.forEach((s) => {
                data.push([(s.name || s.segment || '').toString(), SAFE.num(s.size ?? s.percentage), (s.description || '').toString()]);
            });
            data.push(['', '']);
        }

        const ws = XLSX.utils.aoa_to_sheet(data);
        ws['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 40 }];
        XLSX.utils.book_append_sheet(workbook, ws, sanitizeSheetName('تحليل السوق'));
    }

    addCompetitorsSheet(workbook) {
        const competitors = Array.isArray(this.data?.marketing?.competitors) ? this.data.marketing.competitors : [];

        const data = [
            ['مقارنة المنافسين'],
            ['', ''],
            ['الاسم', 'الحصة السوقية', 'نقاط القوة', 'نقاط الضعف', 'العملاء يومياً (تقديري)', 'متوسط الفاتورة (تقديري)'],
        ];

        if (competitors.length) {
            competitors.forEach((c) => {
                data.push([
                    (c.name || '').toString(),
                    SAFE.num(c.marketShare) + '%',
                    (c.strengths || '').toString(),
                    (c.weaknesses || '').toString(),
                    SAFE.num(c.estimatedDailyCustomers),
                    SAFE.num(c.estimatedAvgTicket),
                ]);
            });
        } else {
            data.push(['لا يوجد منافسون مضافون بعد', '', '', '', '', '']);
        }

        const ws = XLSX.utils.aoa_to_sheet(data);
        ws['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 30 }, { wch: 30 }, { wch: 20 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(workbook, ws, sanitizeSheetName('مقارنة المنافسين'));
    }

    addGrowthPlansSheet(workbook) {
        const payroll = Array.isArray(this.results?.payrollByPosition) ? this.results.payrollByPosition : [];
        const marketing = Array.isArray(this.results?.marketingByChannel) ? this.results.marketingByChannel : [];
        const pctFmt = (v) => (v == null || !Number.isFinite(Number(v))) ? '—' : (Number(v) * 100).toFixed(1) + '%';

        if (!payroll.length && !marketing.length) {
            const data = [
                ['خطط النمو'],
                ['', ''],
                ['لا توجد بيانات نمو مُدخلة', ''],
            ];
            const ws = XLSX.utils.aoa_to_sheet(data);
            XLSX.utils.book_append_sheet(workbook, ws, sanitizeSheetName('خطط النمو'));
            return;
        }

        const data = [['خطط النمو'], ['', '']];

        const payrollYears = Math.max(0, ...payroll.map((p) => (Array.isArray(p.byYear) ? p.byYear.length : 0)));
        data.push(['خطة نمو الرواتب']);
        data.push(['الوظيفة', 'الجنسية', 'معدل النمو', ...Array.from({ length: payrollYears }, (_, i) => `سنة ${i + 1}`)]);
        payroll.forEach((p) => {
            const byYear = Array.isArray(p.byYear) ? p.byYear : [];
            data.push([
                (p.position || '').toString(),
                (p.nationality || '—').toString(),
                pctFmt(p.growthRateUsed),
                ...Array.from({ length: payrollYears }, (_, i) => SAFE.num(byYear[i])),
            ]);
        });

        data.push(['', '']);

        const marketingYears = Math.max(0, ...marketing.map((c) => (Array.isArray(c.byYear) ? c.byYear.length : 0)));
        data.push(['خطة نمو التسويق حسب القناة']);
        data.push(['القناة', 'الحملة', 'معدل النمو', ...Array.from({ length: marketingYears }, (_, i) => `سنة ${i + 1}`)]);
        marketing.forEach((c) => {
            const byYear = Array.isArray(c.byYear) ? c.byYear : [];
            data.push([
                (c.channel || '—').toString(),
                (c.name || '').toString(),
                pctFmt(c.growthRateUsed),
                ...Array.from({ length: marketingYears }, (_, i) => SAFE.num(byYear[i])),
            ]);
        });

        const ws = XLSX.utils.aoa_to_sheet(data);
        ws['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
        XLSX.utils.book_append_sheet(workbook, ws, sanitizeSheetName('خطط النمو'));
    }

    addLocationGeoSheet(workbook) {
        const la = this.data?.projectInfo?.locationAnalysis || {};
        const coords = la.coordinates || {};
        const alts = la.locationAlternatives || [];
        const hasData = la.address || (coords.lat != null && coords.lng != null) || la.selectionFactors || la.chosenReason || alts.length > 0;
        if (!hasData) return;

        const data = [
            ['التحليل الجغرافي المكاني للموقع'],
            ['', ''],
            ['الموقع المختار', ''],
            ['العنوان', (la.address || '—').toString()],
            ['خط العرض', coords.lat != null ? coords.lat : '—'],
            ['خط الطول', coords.lng != null ? coords.lng : '—'],
            ['عوامل اختيار الموقع', (la.selectionFactors || '—').toString()],
            ['سبب اختيار الموقع', (la.chosenReason || '—').toString()],
            ['', ''],
        ];
        if (alts.length > 0) {
            data.push(['المواقع البديلة', '', '']);
            data.push(['اسم الموقع', 'العنوان', 'الإحداثيات', 'ملاحظات']);
            alts.forEach((a) => {
                const coordStr = (a.lat && a.lng) ? `${a.lat}, ${a.lng}` : '—';
                data.push([(a.name || '—').toString(), (a.address || '—').toString(), coordStr, (a.notes || '—').toString()]);
            });
        }
        const ws = XLSX.utils.aoa_to_sheet(data);
        ws['!cols'] = [{ wch: 20 }, { wch: 35 }, { wch: 25 }, { wch: 30 }];
        XLSX.utils.book_append_sheet(workbook, ws, sanitizeSheetName('التحليل الجغرافي'));
    }

    addRisksSheet(workbook) {
        const risks = this.data?.riskAnalysis?.risks || this.data?.risks || [];
        if (!Array.isArray(risks) || risks.length === 0) return;

        const data = [
            ['تحليل المخاطر'],
            ['', ''],
            ['المخاطرة', 'التأثير', 'الاحتمال', 'خطة المواجهة'],
            ...risks.map((r) => [
                (r.name || r.risk || '').toString(),
                (r.impact || r.level || '—').toString(),
                (r.probability || '—').toString(),
                (r.mitigation || r.plan || '').toString(),
            ]),
        ];

        const ws = XLSX.utils.aoa_to_sheet(data);
        ws['!cols'] = [{ wch: 24 }, { wch: 12 }, { wch: 12 }, { wch: 36 }];
        XLSX.utils.book_append_sheet(workbook, ws, sanitizeSheetName('المخاطر'));
    }

    addTimelineSheet(workbook) {
        const tl = this.data?.timeline || this.data?.projectInfo?.timeline || {};
        const data = [
            ['الجدول الزمني'],
            ['', ''],
            ['البند', 'القيمة'],
            ['بداية المشروع', (tl.projectStart ?? '—').toString()],
            ['بداية التشغيل', (tl.operationStart ?? '—').toString()],
            ['مدة الإنشاء (شهر)', tl.constructionMonths != null ? SAFE.num(tl.constructionMonths) : '—'],
        ];

        const activities = tl.activities || [];
        if (activities.length) {
            data.push(['', '']);
            data.push(['الأنشطة']);
            data.push(['النشاط', 'الشهر', 'المدة (شهر)', 'الفئة']);
            activities.forEach((a) => {
                data.push([
                    (a.name || '').toString(),
                    a.startMonth ?? '—',
                    a.duration ?? '—',
                    (a.category ?? '—').toString(),
                ]);
            });
        }

        const ws = XLSX.utils.aoa_to_sheet(data);
        ws['!cols'] = activities.length ? [{ wch: 20 }, { wch: 12 }, { wch: 14 }, { wch: 16 }] : [{ wch: 28 }, { wch: 22 }];
        XLSX.utils.book_append_sheet(workbook, ws, sanitizeSheetName('الجدول الزمني'));
    }

    addScenariosSheet(workbook) {
        // تصحيح (تدقيق 2026-08-21): كانت تقرأ NPV/IRR من this.data.scenarios (مدخلات
        // الإيراد/التكلفة الخام فقط، بلا نتائج) بمسار غير موجود أصلاً (.results.indicators)
        // فتُقرأ undefined ⟶ SAFE.num تُحوّلها 0 لكل سيناريو بما فيه الأساسي. النتائج
        // الفعلية المحسوبة (npv/irr/payback) موجودة في this.results.scenarios[key].kpis
        // (انظر engine.js buildScenarios/runCase) — مصدر منفصل عن مدخلات السيناريو الخام.
        const sc = this.data?.scenarios || {};
        const scRes = this.results?.scenarios || {};
        const p = sc.pessimistic || { revenueChange: 0, costChange: 0, description: '—' };
        const b = sc.base || { revenueChange: 0, costChange: 0, description: '—' };
        const o = sc.optimistic || { revenueChange: 0, costChange: 0, description: '—' };
        const pRes = scRes.pessimistic?.kpis || {};
        const bRes = scRes.base?.kpis || {};
        const oRes = scRes.optimistic?.kpis || {};
        const payback = (kpis) => SAFE.payback(kpis?.payback);

        const data = [
            ['السيناريوهات'],
            ['', ''],
            ['السيناريو', 'تغيّر الإيراد', 'تغيّر التكلفة', 'الوصف', 'NPV', 'IRR', 'فترة الاسترداد'],
            [
                'متشائم',
                (SAFE.num(p.revenueChange) * 100).toFixed(0) + '%',
                (SAFE.num(p.costChange) * 100).toFixed(0) + '%',
                (p.description || '—').toString(),
                SAFE.num(pRes.npv),
                SAFE.pctText(pRes.irr),
                payback(pRes),
            ],
            [
                'أساسي',
                (SAFE.num(b.revenueChange) * 100).toFixed(0) + '%',
                (SAFE.num(b.costChange) * 100).toFixed(0) + '%',
                (b.description || '—').toString(),
                SAFE.num(bRes.npv),
                SAFE.pctText(bRes.irr),
                payback(bRes),
            ],
            [
                'متفائل',
                (SAFE.num(o.revenueChange) * 100).toFixed(0) + '%',
                (SAFE.num(o.costChange) * 100).toFixed(0) + '%',
                (o.description || '—').toString(),
                SAFE.num(oRes.npv),
                SAFE.pctText(oRes.irr),
                payback(oRes),
            ],
        ];

        const ws = XLSX.utils.aoa_to_sheet(data);
        ws['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 14 }, { wch: 10 }, { wch: 14 }];
        XLSX.utils.book_append_sheet(workbook, ws, sanitizeSheetName('السيناريوهات'));
    }

    addSensitivitySheet(workbook) {
        const sen = this.data?.scenarios?.sensitivity || {};
        const vars = Array.isArray(sen.variables) ? sen.variables : ['revenue', 'costs', 'price', 'volume'];
        const range = Array.isArray(sen.range) ? sen.range : [-0.3, 0.3];

        const data = [
            ['تحليل الحساسية'],
            ['', ''],
            ['المتغير المختار', (sen.selectedVariable || '—').toString()],
            ['نطاق التحليل', `${(SAFE.num(range[0]) * 100).toFixed(0)}% .. ${(SAFE.num(range[1]) * 100).toFixed(0)}%`],
            ['', ''],
            ['المتغيرات المدعومة', ''],
            ...vars.map((v) => [typeof v === 'string' ? v : (v?.key ?? v), '']),
        ];

        const ws = XLSX.utils.aoa_to_sheet(data);
        ws['!cols'] = [{ wch: 24 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(workbook, ws, sanitizeSheetName('الحساسية'));
    }
}

/**
 * تصدير سريع إلى Excel
 * @returns {Promise<string>} اسم الملف المُصدَّر
 */
export async function exportToExcel(studyData, financialResults, filename, options = {}) {
    const exporter = new ExcelExporter(studyData, financialResults, options);
    const base = (studyData?.projectInfo?.name || filename || 'feasibility_study').toString();
    return exporter.export(base);
}

/**
 * تصدير بطاقة المنح (متوافق مع متطلبات بنك التنمية وغيره)
 * نموذج مبسط: اسم المشروع، موقع، أهداف، تكاليف، إيرادات، مدة استرداد
 * @returns {Promise<string>} اسم الملف المُصدَّر
 */
export async function exportGrantCard(studyData, financialResults) {
    const { loadXLSX, sanitizeSheetName, sanitizeFilename, formatExportDateTime, exportDateISO, SAFE } = await import('./utils.js');
    await loadXLSX();

    const ind = financialResults?.indicators || {};
    const cap = financialResults?.capex || {};
    const proj = financialResults?.revenueProjection?.[0] || financialResults?.incomeStatement?.[0];
    const pi = studyData?.projectInfo || {};
    const goals = (studyData?.smartGoals?.goals || []).slice(0, 5).map(g => g.specific || g.description || '').filter(Boolean);

    const data = [
        ['بطاقة المنح — نموذج مبسط لجهات التمويل'],
        ['', ''],
        ['تنبيه', 'يفضّل التعبئة من الحاسوب ومراجعة البيانات قبل الإرسال.'],
        ['', ''],
        ['البند', 'القيمة'],
        ['اسم المشروع', pi.name || pi.projectName || '—'],
        ['المدينة / الموقع', [pi.city, pi.district].filter(Boolean).join(' — ') || '—'],
        ['وصف المشروع', (pi.description || pi.concept || '').toString().slice(0, 200)],
        ['أبرز الأهداف', goals.join('؛ ') || '—'],
        ['إجمالي الاستثمار (ريال)', SAFE.num(cap.total)],
        ['الإيرادات السنة الأولى (ريال)', SAFE.num(proj?.total ?? proj?.revenue)],
        ['صافي القيمة الحالية (ريال)', SAFE.num(ind.npv)],
        ['معدل العائد الداخلي %', SAFE.pctText(ind.irr)],
        ['فترة الاسترداد', SAFE.payback(ind.paybackPeriod ?? ind.payback)],
        ['', ''],
        ['تاريخ التصدير', formatExportDateTime()],
        ['مُنشأ بواسطة', 'محاكي الجدوى | دراسة الجدوى الذكية'],
    ];

    const workbook = XLSX.utils.book_new();
    workbook.Workbook = { Views: [{ RTL: true }] };
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 35 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(workbook, ws, sanitizeSheetName('بطاقة المنح'));

    const base = sanitizeFilename(pi.name || 'بطاقة_منح');
    const filename = `${base}_${exportDateISO()}.xlsx`;
    await XLSX.writeFile(workbook, filename);
    return filename;
}
