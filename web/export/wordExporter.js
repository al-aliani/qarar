/**
 * Word (DOCX) Exporter
 * تصدير دراسة الجدوى كتقرير نصي احترافي بصيغة DOCX
 * يستخدم مكتبة 'docx'
 * ترتيب الأقسام: يُطبَّق state.reportSectionOrder عند وجوده (المهمة 70 — توحيد مع ReportGenerator).
 *
 * إصلاحات تدقيق 2026-07-04:
 * - خط عربي معرَّف على مستوى المستند (كان يسقط إلى Calibri).
 * - bold على TextRun لا على Paragraph (خاصية bold على Paragraph لا تعمل في مكتبة docx).
 * - فترة استرداد غير محققة لا تُعرض «0.0 سنة».
 * - أقسام بلا بيانات تُحذف بدل طباعة «—» تحت كل عنوان.
 */

import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel } from 'docx';
import { calculateStudy as runFullModel } from '../js/core/engine.js';
import { calculateProjectScore } from '../js/core/scoring.js';
import { formatPayback } from '../js/utils/formatters.js';
import { t } from '../js/i18n/reportStrings.js';

/** أقسام تقرير Word (معرّفات قابلة للربط مع reportSectionOrder). */
const WORD_SECTION_IDS = ['executive_summary', 'market', 'revenue_breakdown', 'financial_kpis', 'income_statement', 'cash_flow', 'balance_sheet', 'competitors', 'asset_schedule', 'working_capital', 'payroll_growth', 'marketing_growth', 'recommendation'];

/** الخط العربي الموحد للمستند — نفس هوية المنصة */
const AR_FONT = 'IBM Plex Sans Arabic';

function formatCurrency(n, lang = 'ar') {
    if (!n && n !== 0) return '0';
    if (lang === 'en') {
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M SAR';
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(n);
    }
    if (n >= 1000000) return (n / 1000000).toFixed(1) + ' مليون ريال';
    return new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(n);
}

function hasText(s) {
    return String(s || '').trim().length > 0;
}

/** نسبة كمضاعف (Nx) — نسب السيولة/دوران؛ null/غير محقَّق يبقى «—» لا 0 */
function formatRatioMultiple(v) {
    return (v === null || v === undefined || !Number.isFinite(Number(v))) ? '—' : `${Number(v).toFixed(2)}x`;
}

/** نسبة كنسبة مئوية — الدين/العائد على الأصول والملكية؛ null/غير محقَّق يبقى «—» لا 0 */
function formatRatioPercent(v) {
    return (v === null || v === undefined || !Number.isFinite(Number(v))) ? '—' : `${(Number(v) * 100).toFixed(1)}%`;
}

export class WordExporter {
    constructor(store, options = {}) {
        this.store = store;
        // ثنائي اللغة (المهمة: تصدير إنجليزي) — النطاق مقصود على القوائم المالية والمؤشرات
        // الكمّية فقط (financial_kpis/income_statement/cash_flow/balance_sheet/ratios)،
        // بنفس نطاق النسخة الإنجليزية الفعلية لمنافس حقيقي (جدوى كلاود) — لا الأقسام
        // النصية/الاستراتيجية التي يكتبها المستخدم بلغته، فتلك لا تُترجَم بقاموس تسميات.
        this.lang = options.lang === 'en' ? 'en' : 'ar';
        const state = store.getState ? store.getState() : store;
        this.state = state;
        this.results = null;
        try {
            this.results = runFullModel(state);
        } catch (_) {
            this.results = {};
        }
        this.score = calculateProjectScore(state, this.results);
    }

    /** ترتيب أقسام تقرير Word: يتبع reportSectionOrder إن وُجد، مع إلحاق أي قسم غير مذكور. */
    getWordSectionOrder() {
        const state = this.state;
        const userOrder = (state.reportSectionOrder && state.reportSectionOrder.length) ? state.reportSectionOrder : [];
        const ordered = userOrder.filter(id => WORD_SECTION_IDS.includes(id));
        for (const id of WORD_SECTION_IDS) {
            if (!ordered.includes(id)) ordered.push(id);
        }
        return ordered;
    }

    /** يُرجع مصفوفة عناصر docx لقسم واحد — الأقسام الفارغة تُحذف بدل «—» */
    buildSectionBlocks(sectionId) {
        const project = this.state.projectInfo || {};
        const exec = this.state.executiveSummary || {};
        switch (sectionId) {
            case 'executive_summary': {
                const blocks = [this.createHeading("الملخص التنفيذي")];
                // النص المولَّد/المكتوب أولاً؛ ثم العناصر الجزئية المتوفرة فقط
                if (hasText(exec.projectOverview)) {
                    blocks.push(this.createParagraph(exec.projectOverview));
                }
                const parts = [
                    ["المشكلة", exec.problemStatement],
                    ["الحل المقترح", project.concept || exec.solutionStatement],
                    ["القيمة المميزة", exec.uniqueValueProposition]
                ];
                parts.forEach(([title, text]) => {
                    if (hasText(text)) {
                        blocks.push(this.createSubHeading(title));
                        blocks.push(this.createParagraph(text));
                    }
                });
                return blocks.length > 1 ? blocks : [];
            }
            case 'market': {
                const market = this.state.marketSizing || {};
                const hasAny = [market.tam?.value, market.sam?.value, market.som?.value]
                    .some(v => Number(v) > 0);
                if (!hasAny) return []; // لا نطبع جدول سوق بقيم صفرية
                return [
                    this.createHeading("حجم السوق"),
                    this.createMarketTable()
                ];
            }
            case 'revenue_breakdown': {
                const streams = this.state.revenue?.streams || [];
                if (!streams.length) return []; // لا نطبع قسماً بلا مصادر إيراد
                return [
                    this.createHeading("تفصيل مصادر الإيراد (السنة الأولى)"),
                    this.createRevenueStreamsTable(streams),
                    new Paragraph({
                        children: [new TextRun({
                            text: "ملاحظة: الأرقام أعلاه لكل مصدر إيراد تخص السنة الأولى فقط، إذ يُطبِّق محرك الحسابات نمو الإيرادات على الإجمالي الكلي وليس على كل مصدر على حدة، وعليه لا تُعرض أرقام متعددة السنوات لكل مصدر تفادياً لأي تقدير غير محقَّق.",
                            italics: true,
                            size: 20
                        })],
                        alignment: AlignmentType.RIGHT,
                        bidirectional: true,
                        spacing: { after: 200 }
                    })
                ];
            }
            case 'financial_kpis': {
                const blocks = [
                    this.createHeading(t('financial_kpis_title', this.lang)),
                    this.createFinancialTable()
                ];
                if ((this.results?.ratios || []).length > 0) {
                    blocks.push(this.createRatiosTable());
                }
                return blocks;
            }
            case 'income_statement': {
                const rows = this.results?.incomeStatement || [];
                // calculateStudy يعيد صفاً لكل سنة حتى بلا أي إيراد فعلي — لا نطبع قائمة دخل صفرية بالكامل
                const hasAny = rows.some(r => Number(r.revenue) > 0);
                if (!hasAny) return [];
                return [
                    this.createHeading(t('income_statement_title', this.lang)),
                    this.createIncomeStatementTable()
                ];
            }
            case 'cash_flow': {
                const rows = this.results?.cashFlow || [];
                const hasAny = rows.some(r => Number(r.cashFlow || 0) !== 0 || Number(r.investment || 0) !== 0);
                if (!hasAny) return [];
                return [
                    this.createHeading(t('cash_flow_title', this.lang)),
                    this.createCashFlowTable()
                ];
            }
            case 'balance_sheet': {
                const rows = this.results?.balanceSheets || [];
                const hasAny = rows.some(r => Number(r.assets?.total) > 0);
                if (!hasAny) return [];
                return [
                    this.createHeading(t('balance_sheet_title', this.lang)),
                    this.createBalanceSheetTable()
                ];
            }
            case 'competitors': {
                const competitors = (this.state.marketing?.competitors || [])
                    .filter(c => c && (c.name || c.strengths || c.weaknesses));
                if (!competitors.length) return [];
                return [
                    this.createHeading("تحليل المنافسين"),
                    this.createCompetitorsTable(competitors)
                ];
            }
            case 'asset_schedule': {
                const assets = this.results?.assetSchedule || [];
                if (!assets.length) return [];
                return [
                    this.createHeading("جدول إهلاك الأصول"),
                    this.createAssetScheduleTable(assets)
                ];
            }
            case 'working_capital': {
                const operating = this.results?.capex?.capitalStructure?.operating;
                if (!operating?.total) return [];
                return [
                    this.createHeading("تفصيل رأس المال العامل"),
                    this.createWorkingCapitalTable(operating)
                ];
            }
            case 'payroll_growth': {
                const rows = this.results?.payrollByPosition || [];
                if (!rows.length) return [];
                return [
                    this.createHeading("خطة نمو الرواتب متعددة السنوات"),
                    this.createPayrollGrowthTable()
                ];
            }
            case 'marketing_growth': {
                const rows = this.results?.marketingByChannel || [];
                if (!rows.length) return [];
                return [
                    this.createHeading("خطة نمو التسويق حسب القناة"),
                    this.createMarketingGrowthTable()
                ];
            }
            case 'recommendation':
                return [
                    this.createHeading("التوصية النهائية"),
                    new Paragraph({
                        children: [new TextRun({
                            text: this.score?.recommendationLabel || "يحتاج مراجعة",
                            bold: true,
                            size: 28
                        })],
                        alignment: AlignmentType.CENTER,
                        bidirectional: true,
                        spacing: { before: 200, after: 200 }
                    })
                ];
            default:
                return [];
        }
    }

    async export() {
        try {
            const project = this.state.projectInfo || {};

            const headerBlocks = [
                new Paragraph({
                    children: [new TextRun({ text: String(project.name || 'دراسة جدوى').trim(), bold: true })],
                    heading: HeadingLevel.TITLE,
                    alignment: AlignmentType.CENTER,
                    bidirectional: true
                }),
                new Paragraph({
                    children: [new TextRun({ text: "تقرير دراسة الجدوى الاقتصادية" })],
                    alignment: AlignmentType.CENTER,
                    bidirectional: true,
                    spacing: { after: 400 }
                }),
                new Paragraph({
                    children: [new TextRun({ text: `تاريخ التقرير: ${new Date().toLocaleDateString('ar-SA')}` })],
                    alignment: AlignmentType.CENTER,
                    bidirectional: true,
                    spacing: { after: 800 }
                })
            ];

            const sectionOrder = this.getWordSectionOrder();
            const sectionBlocks = sectionOrder.flatMap(id => this.buildSectionBlocks(id));

            const doc = new Document({
                // خط عربي افتراضي لكل الأنماط — بدونه يسقط المستند إلى Calibri
                styles: {
                    default: {
                        document: { run: { font: AR_FONT, size: 24 } },
                        heading1: { run: { font: AR_FONT, bold: true } },
                        heading2: { run: { font: AR_FONT, bold: true } },
                        title: { run: { font: AR_FONT, bold: true } }
                    }
                },
                sections: [{
                    properties: {
                        page: {
                            margin: {
                                top: 1440,
                                right: 1440,
                                bottom: 1440,
                                left: 1440
                            }
                        }
                    },
                    children: [...headerBlocks, ...sectionBlocks]
                }]
            });

            // Pack to Blob
            const blob = await Packer.toBlob(doc);
            const projName = (project.name || 'study').replace(/[/\\*?:[\]<>|]/g, '_');
            const fileName = `${projName}_تقرير_دراسة.docx`;

            return { success: true, fileName, blob };
        } catch (error) {
            console.error('[Word Export]', error);
            return { success: false, error: error?.message || 'فشل التصدير' };
        }
    }

    createHeading(text) {
        return new Paragraph({
            children: [new TextRun({ text, bold: true })],
            heading: HeadingLevel.HEADING_1,
            bidirectional: true,
            spacing: { before: 400, after: 200 }
        });
    }

    createSubHeading(text) {
        return new Paragraph({
            children: [new TextRun({ text, bold: true })],
            heading: HeadingLevel.HEADING_2,
            bidirectional: true,
            spacing: { before: 200, after: 100 }
        });
    }

    createParagraph(text) {
        return new Paragraph({
            children: [new TextRun({ text: String(text || '').trim(), size: 24 })], // size is half-points (24 = 12pt)
            bidirectional: true,
            alignment: AlignmentType.RIGHT,
            spacing: { after: 200 }
        });
    }

    createMarketTable() {
        const market = this.state.marketSizing || {};
        return new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
                this.createTableRow(["الوصف", "القيمة", "المؤشر"], true),
                this.createTableRow(["إجمالي السوق المتاح", formatCurrency(market.tam?.value), "TAM"]),
                this.createTableRow(["السوق المستهدف", formatCurrency(market.sam?.value), "SAM"]),
                this.createTableRow(["الحصة السوقية", formatCurrency(market.som?.value), "SOM"])
            ]
        });
    }

    createRevenueStreamsTable(streams) {
        const rows = [
            this.createTableRow(['مصدر الإيراد', 'العملاء شهرياً', 'متوسط السعر', 'إيراد السنة الأولى'], true)
        ];
        streams.forEach(stream => {
            const label = stream.name || stream.service || 'مصدر إيراد';
            const customersPerMonth = Number(stream.customersPerMonth) || 0;
            const avgPrice = Number(stream.avgPrice) || 0;
            const year1Revenue = customersPerMonth * 12 * avgPrice;
            rows.push(this.createTableRow([
                label,
                String(customersPerMonth),
                formatCurrency(avgPrice),
                formatCurrency(year1Revenue)
            ], false));
        });
        return new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows
        });
    }

    createFinancialTable() {
        const ind = this.results?.indicators || {};
        const lang = this.lang;
        return new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
                this.createTableRow([t('value_column', lang), t('indicator_column', lang)], true),
                this.createTableRow([formatCurrency(ind.npv, lang), t('npv', lang)]),
                this.createTableRow([`${((ind.irr ?? 0) * 100).toFixed(1)}%`, t('irr', lang)]),
                this.createTableRow([formatPayback(ind.paybackPeriod), t('payback_period', lang)]),
                this.createTableRow([`${((ind.roi ?? 0) * 100).toFixed(1)}%`, t('roi', lang)])
            ]
        });
    }

    createIncomeStatementTable() {
        const rows = this.results?.incomeStatement || [];
        const lang = this.lang;
        const header = [t('item_column', lang), ...rows.map(r => `${t('year_prefix', lang)} ${r.year}`)];
        const lineItems = [
            [t('revenue', lang), 'revenue'],
            [t('variable_costs', lang), 'variableCosts'],
            [t('gross_profit', lang), 'grossProfit'],
            [t('fixed_costs', lang), 'fixedCosts'],
            ['EBITDA', 'ebitda'],
            [t('depreciation', lang), 'depreciation'],
            [t('interest', lang), 'interest'],
            [t('zakat', lang), 'zakat'],
            [t('net_income', lang), 'netIncome']
        ];
        const tableRows = [this.createTableRow(header, true)];
        lineItems.forEach(([label, key]) => {
            tableRows.push(this.createTableRow([label, ...rows.map(r => formatCurrency(r[key], lang))]));
        });
        return new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: tableRows
        });
    }

    createCashFlowTable() {
        const rows = this.results?.cashFlow || [];
        const lang = this.lang;
        const header = [t('item_column', lang), ...rows.map(r => `${t('year_prefix', lang)} ${r.year}`)];
        const lineItems = [
            [t('capex_investment', lang), 'investment'],
            [t('loan_inflow', lang), 'loanInflow'],
            [t('net_income', lang), 'netIncome'],
            [t('depreciation', lang), 'depreciation'],
            [t('loan_principal_paid', lang), 'loanPrincipalPaid'],
            [t('asset_replacement_cost', lang), 'replacementCost'],
            [t('vat_net_payable', lang), 'vatNetPayable'],
            [t('net_cash_flow', lang), 'cashFlow'],
            [t('cash_flow_after_vat', lang), 'cashFlowAfterVat'],
            [t('cumulative_cash_flow', lang), 'cumulative']
        ];
        const tableRows = [this.createTableRow(header, true)];
        lineItems.forEach(([label, key]) => {
            tableRows.push(this.createTableRow([label, ...rows.map(r => formatCurrency(r[key], lang))]));
        });
        return new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: tableRows
        });
    }

    createBalanceSheetTable() {
        const rows = this.results?.balanceSheets || [];
        const lang = this.lang;
        const header = [t('item_column', lang), ...rows.map(r => `${t('year_prefix', lang)} ${r.year}`)];
        const lineItems = [
            [t('cash', lang), r => r.assets?.current?.cash],
            [t('accounts_receivable', lang), r => r.assets?.current?.accountsReceivable],
            [t('inventory', lang), r => r.assets?.current?.inventory],
            [t('total_current_assets', lang), r => r.assets?.current?.total],
            [t('net_fixed_assets', lang), r => r.assets?.fixed?.net],
            [t('total_assets', lang), r => r.assets?.total],
            [t('current_liabilities', lang), r => r.liabilities?.current?.total],
            [t('long_term_liabilities', lang), r => r.liabilities?.longTerm?.total],
            [t('total_liabilities', lang), r => r.liabilities?.total],
            [t('share_capital', lang), r => r.equity?.paidInCapital],
            [t('retained_earnings', lang), r => r.equity?.retainedEarnings],
            [t('total_equity', lang), r => r.equity?.total]
        ];
        const tableRows = [this.createTableRow(header, true)];
        lineItems.forEach(([label, getter]) => {
            tableRows.push(this.createTableRow([label, ...rows.map(r => formatCurrency(getter(r), lang))]));
        });
        return new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: tableRows
        });
    }

    createRatiosTable() {
        const rows = this.results?.ratios || [];
        const lang = this.lang;
        const header = [t('item_column', lang), ...rows.map(r => `${t('year_prefix', lang)} ${r.year}`)];
        const lineItems = [
            [t('current_ratio', lang), r => r.currentRatio, formatRatioMultiple],
            [t('quick_ratio', lang), r => r.quickRatio, formatRatioMultiple],
            [t('cash_ratio', lang), r => r.cashRatio, formatRatioMultiple],
            [t('debt_ratio', lang), r => r.debtRatio, formatRatioPercent],
            [t('debt_to_equity', lang), r => r.debtToEquity, formatRatioPercent],
            [t('asset_turnover', lang), r => r.assetTurnover, formatRatioMultiple],
            [t('fixed_asset_turnover', lang), r => r.fixedAssetTurnover, formatRatioMultiple],
            [t('roa', lang), r => r.roa, formatRatioPercent],
            [t('roe', lang), r => r.roe, formatRatioPercent]
        ];
        const tableRows = [this.createTableRow(header, true)];
        lineItems.forEach(([label, getter, fmt]) => {
            tableRows.push(this.createTableRow([label, ...rows.map(r => fmt(getter(r)))]));
        });
        return new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: tableRows
        });
    }

    createCompetitorsTable(competitors) {
        const rows = [
            this.createTableRow(["المنافس", "الحصة السوقية", "نقاط القوة", "نقاط الضعف", "عملاء/يوم", "متوسط الفاتورة"], true)
        ];
        competitors.forEach(c => {
            rows.push(this.createTableRow([
                c.name || '—',
                c.marketShare ? `${Number(c.marketShare).toLocaleString('ar-SA')}%` : '—',
                c.strengths || '—',
                c.weaknesses || '—',
                c.estimatedDailyCustomers ? Number(c.estimatedDailyCustomers).toLocaleString('ar-SA') : '—',
                c.estimatedAvgTicket ? formatCurrency(c.estimatedAvgTicket) : '—'
            ]));
        });
        return new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows
        });
    }

    createAssetScheduleTable(assets) {
        const rows = [
            this.createTableRow(["الأصل", "الفئة", "الإهلاك السنوي", "العمر الافتراضي"], true)
        ];
        assets.forEach(a => {
            rows.push(this.createTableRow([
                a.name || '—',
                a.category || '—',
                formatCurrency(a.annualDepreciation),
                a.usefulLifeYears ? `${a.usefulLifeYears} سنة` : '—'
            ]));
        });
        return new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows
        });
    }

    createWorkingCapitalTable(operating) {
        const breakdown = operating.breakdown || {};
        const labels = [
            ["الإيجار", 'rent'],
            ["الرواتب", 'salaries'],
            ["التسويق", 'marketing'],
            ["تكلفة البضاعة", 'cogs'],
            ["المخزون الافتتاحي", 'openingInventory']
        ];
        const rows = [this.createTableRow(["البند", "القيمة"], true)];
        labels.forEach(([label, key]) => {
            rows.push(this.createTableRow([label, formatCurrency(breakdown[key])]));
        });
        rows.push(this.createTableRow(["الإجمالي", formatCurrency(operating.total)], true));
        return new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows
        });
    }

    createPayrollGrowthTable() {
        const rows = this.results?.payrollByPosition || [];
        const yearsCount = rows.reduce((max, r) => Math.max(max, (r.byYear || []).length), 0);
        const header = ["الوظيفة", "الجنسية", "معدل النمو المستخدم", ...Array.from({ length: yearsCount }, (_, i) => `السنة ${i + 1}`)];
        const tableRows = [this.createTableRow(header, true)];
        rows.forEach(r => {
            const nationality = r.nationality === 'saudi' ? 'سعودي' : (r.nationality === 'expat' ? 'غير سعودي' : '—');
            tableRows.push(this.createTableRow([
                r.position || '—',
                nationality,
                formatRatioPercent(r.growthRateUsed),
                ...Array.from({ length: yearsCount }, (_, i) => formatCurrency((r.byYear || [])[i]))
            ]));
        });
        return new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: tableRows
        });
    }

    createMarketingGrowthTable() {
        const rows = this.results?.marketingByChannel || [];
        const yearsCount = rows.reduce((max, r) => Math.max(max, (r.byYear || []).length), 0);
        const header = ["القناة", "الحملة", "معدل النمو المستخدم", ...Array.from({ length: yearsCount }, (_, i) => `السنة ${i + 1}`)];
        const tableRows = [this.createTableRow(header, true)];
        rows.forEach(r => {
            tableRows.push(this.createTableRow([
                hasText(r.channel) ? r.channel : '—',
                r.name || '—',
                formatRatioPercent(r.growthRateUsed),
                ...Array.from({ length: yearsCount }, (_, i) => formatCurrency((r.byYear || [])[i]))
            ]));
        });
        return new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: tableRows
        });
    }

    createTableRow(cells, isHeader = false) {
        return new TableRow({
            children: cells.map(text => new TableCell({
                children: [new Paragraph({
                    children: [new TextRun({ text: String(text), bold: isHeader })],
                    alignment: AlignmentType.CENTER,
                    bidirectional: true
                })],
                // Simple styling
                shading: isHeader ? { fill: "F3F4F6", color: "auto", val: "clear" } : undefined
            }))
        });
    }
}
