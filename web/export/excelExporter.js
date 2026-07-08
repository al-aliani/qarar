/**
 * Excel Exporter (Enhanced)
 * Generates downloadable Excel file with all financial data.
 * Uses SheetJS (xlsx) — npm package مُجمَّع، يُستورد ديناميكياً عبر loadXLSX() (utils.js) عند أول استخدام؛ لا يعتمد على CDN. Null-safe, supports engine + extended results.
 * ترتيب الأوراق: يُطبَّق state.reportSectionOrder عند وجوده (المهمة 71 — توحيد مع ReportGenerator).
 */

import { sanitizeSheetName, sanitizeFilename, loadXLSX, formatExportDateTime, exportDateISO, SAFE, formatDscr } from './utils.js';

/** معرّفات أوراق المحتوى (بعد ورقة الفهرس) — قابلة للربط مع reportSectionOrder. */
const EXCEL_SHEET_IDS = [
    'summary', 'key_people', 'capex', 'opex', 'revenue', 'income_statement', 'cash_flow',
    'balance_sheet', 'loan_schedule', 'indicators', 'market', 'location_geo', 'risks', 'timeline', 'scenarios', 'sensitivity'
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
    constructor(studyData, financialResults) {
        this.data = studyData;
        this.results = financialResults;
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
        workbook.SheetNames.unshift(workbook.SheetNames.pop());

        const outFilename = `${baseName}_${exportDateISO()}.xlsx`;
        XLSX.writeFile(workbook, outFilename);
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
            ['معدل العائد الداخلي', (SAFE.pct(ind.irr) || 0).toFixed(1) + '%'],
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
        const projection = this.results?.revenueProjection || [];
        const isList = this.results?.incomeStatement || [];

        const years = Math.max(1, projection.length || isList.length);
        const totals = projection.length
            ? projection.map((p) => SAFE.num(p.total ?? p.revenue))
            : (isList || []).map((s) => SAFE.num(s.revenue));
        while (totals.length < years) totals.push(0);

        const data = [
            ['توقعات الإيرادات', '', '', '', '', ''],
            ['السنة', 'إجمالي الإيرادات', ...Array.from({ length: years }, (_, i) => `السنة ${i + 1}`)],
            ['الإيرادات', '', ...totals],
        ];

        if (projection[0]?.streams?.length) {
            projection[0].streams.forEach((stream, idx) => {
                data.push([
                    stream.name ?? '',
                    '',
                    ...projection.map((p) => SAFE.num(p.streams?.[idx]?.revenue)),
                ]);
            });
        }

        const ws = XLSX.utils.aoa_to_sheet(data);
        XLSX.utils.book_append_sheet(workbook, ws, sanitizeSheetName('الإيرادات'));
    }

    addIncomeStatementSheet(workbook) {
        const statements = this.results?.incomeStatement || [];
        const headers = ['البند', ...statements.map((s) => `السنة ${s.year}`)];

        const data = [
            ['قائمة الدخل التقديرية'],
            headers,
            ['الإيرادات', ...statements.map((s) => SAFE.num(s.revenue))],
            ['(-) التكاليف المتغيرة', ...statements.map((s) => -SAFE.num(s.variableCosts))],
            ['مجمل الربح', ...statements.map((s) => SAFE.num(s.grossProfit))],
            ['(-) التكاليف الثابتة', ...statements.map((s) => -SAFE.num(s.fixedCosts))],
            ['EBITDA', ...statements.map((s) => SAFE.num(s.ebitda))],
            ['(-) الاستهلاك', ...statements.map((s) => -SAFE.num(s.depreciation))],
            ['EBIT', ...statements.map((s) => SAFE.num(s.ebit))],
            ['(-) مصروفات الفوائد', ...statements.map((s) => -SAFE.num(s.interestExpense ?? s.interest))],
            ['EBT', ...statements.map((s) => SAFE.num(s.ebt ?? s.ebit))],
            // الزكاة والضريبة صفان منفصلان — كان صف واحد يعرض الضريبة فقط
            // فلا يُجمَع العمود إلى صافي الربح أمام محلل الائتمان
            ['(-) الزكاة', ...statements.map((s) => -SAFE.num(s.zakat))],
            ['(-) ضريبة الدخل (حصة الأجانب)', ...statements.map((s) => -SAFE.num(s.tax))],
            ['صافي الربح', ...statements.map((s) => SAFE.num(s.netIncome))],
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

        const headers = ['البند', ...list.map((c) => (c.year === 0 ? 'السنة 0' : `السنة ${c.year}`))];
        const data = [
            ['التدفقات النقدية'],
            headers,
            ['صافي الربح', ...list.map((c) => SAFE.num(c.netIncome))],
            ['(+) الاستهلاك', ...list.map((c) => SAFE.num(c.depreciation))],
            ['التدفق النقدي', ...list.map((c) => SAFE.num(c.cashFlow))],
            ['التدفق التراكمي', ...cum],
        ];

        const ws = XLSX.utils.aoa_to_sheet(data);
        XLSX.utils.book_append_sheet(workbook, ws, sanitizeSheetName('التدفقات النقدية'));
    }

    addBalanceSheetSheet(workbook) {
        const sheets = this.results?.balanceSheets || [];
        if (sheets.length === 0) return;

        const headers = ['البند', ...sheets.map((s) => `السنة ${s.year}`)];
        const data = [
            ['الميزانية العمومية التقديرية'],
            headers,
            ['الأصول', ...sheets.map(() => '')],
            ['  الأصول المتداولة', ...sheets.map((s) => SAFE.num(s.assets?.current?.total))],
            ['  صافي الأصول الثابتة', ...sheets.map((s) => SAFE.num(s.assets?.fixed?.net))],
            ['إجمالي الأصول', ...sheets.map((s) => SAFE.num(s.assets?.total))],
            ['', ...sheets.map(() => '')],
            ['الخصوم', ...sheets.map(() => '')],
            ['  الخصوم المتداولة', ...sheets.map((s) => SAFE.num(s.liabilities?.current?.total))],
            ['  الخصوم طويلة الأجل', ...sheets.map((s) => SAFE.num(s.liabilities?.longTerm?.total))],
            ['إجمالي الخصوم', ...sheets.map((s) => SAFE.num(s.liabilities?.total))],
            ['', ...sheets.map(() => '')],
            ['حقوق الملكية', ...sheets.map((s) => SAFE.num(s.equity?.total))],
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

        const irrVal = SAFE.pct(ind.irr);
        const roiVal = SAFE.pct(ind.roi);
        const marginVal = SAFE.pct(ind.profitMargin);
        // المحرك يعيد التعادل بوحدات سنوية — البند معنون «وحدات/شهر» فنقسم على 12.
        // (كان يسقط إلى breakEvenPointValue وهو مبلغ بالريال لا وحدات!)
        const breakevenMonthly = Number.isFinite(Number(ind.breakevenUnitsPerMonth))
            ? Number(ind.breakevenUnitsPerMonth)
            : (Number.isFinite(Number(ind.breakEvenUnits)) ? Number(ind.breakEvenUnits) / 12 : 0);

        const data = [
            ['مؤشرات التقييم المالي'],
            ['', ''],
            ['المؤشرات الأساسية', ''],
            ['صافي القيمة الحالية', SAFE.num(ind.npv)],
            ['معدل العائد الداخلي', irrVal.toFixed(1) + '%'],
            ['فترة الاسترداد', SAFE.payback(ind.paybackPeriod ?? ind.payback)],
            ['العائد على الاستثمار', roiVal.toFixed(1) + '%'],
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
                ? dscr.map((d) => [`السنة ${d.year}`, formatDscr(d.dscr) + (d.status ? ' - ' + d.status : '')])
                : [['—', 'لا توجد بيانات']]),
        ];

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
        const sc = this.data?.scenarios || {};
        const p = sc.pessimistic || { revenueChange: 0, costChange: 0, description: '—' };
        const b = sc.base || { revenueChange: 0, costChange: 0, description: '—' };
        const o = sc.optimistic || { revenueChange: 0, costChange: 0, description: '—' };
        const payback = (entry) => SAFE.payback(entry?.results?.indicators?.paybackPeriod ?? entry?.results?.indicators?.payback);

        const data = [
            ['السيناريوهات'],
            ['', ''],
            ['السيناريو', 'تغيّر الإيراد', 'تغيّر التكلفة', 'الوصف', 'NPV', 'IRR %', 'فترة الاسترداد'],
            [
                'متشائم',
                (SAFE.num(p.revenueChange) * 100).toFixed(0) + '%',
                (SAFE.num(p.costChange) * 100).toFixed(0) + '%',
                (p.description || '—').toString(),
                SAFE.num(p.results?.indicators?.npv),
                (SAFE.pct(p.results?.indicators?.irr) || 0).toFixed(1),
                payback(p),
            ],
            [
                'أساسي',
                (SAFE.num(b.revenueChange) * 100).toFixed(0) + '%',
                (SAFE.num(b.costChange) * 100).toFixed(0) + '%',
                (b.description || '—').toString(),
                SAFE.num(b.results?.indicators?.npv),
                (SAFE.pct(b.results?.indicators?.irr) || 0).toFixed(1),
                payback(b),
            ],
            [
                'متفائل',
                (SAFE.num(o.revenueChange) * 100).toFixed(0) + '%',
                (SAFE.num(o.costChange) * 100).toFixed(0) + '%',
                (o.description || '—').toString(),
                SAFE.num(o.results?.indicators?.npv),
                (SAFE.pct(o.results?.indicators?.irr) || 0).toFixed(1),
                payback(o),
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
export async function exportToExcel(studyData, financialResults, filename) {
    const exporter = new ExcelExporter(studyData, financialResults);
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
        ['معدل العائد الداخلي %', (SAFE.pct(ind.irr) || 0).toFixed(1) + '%'],
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
    XLSX.writeFile(workbook, filename);
    return filename;
}
