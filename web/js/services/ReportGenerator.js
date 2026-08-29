/**
 * Premium Report Generator Service
 * Generates professional, Big 4-style PDF reports with perfect Arabic support.
 * ترتيب الأقسام: يُخزَّن في state.reportSectionOrder من صفحة «بناء التقرير» (سحب وإفلات)؛
 * يُطبَّق عند التصدير — التقرير يتبع ترتيب المستخدم.
 */

import { formatCurrency } from '../utils/formatters.js';
import { calculateStudy as runFullModel } from '../core/engine.js';
import { validateStudy } from '../utils/validation.js';
import { DEFAULT_REPORT_SECTION_ORDER } from '../core/schema.js';
import { BANK_COMPLIANCE_SENTENCE } from '../config.js';
import { getOptionLabel } from '../core/fieldOptions.js';
import { t, yearColumnLabel } from '../i18n/reportStrings.js';
import { buildFinancingDiagnostics } from '../utils/financingDiagnostics.js';
import { formatRatio } from '../../export/ratioUnits.js';
import { SAFE } from '../../export/utils.js';
import { escapeHtml } from '../utils/escape.js';

/** عناوين الأقسام (لفهرس المحتويات وترتيب التصدير) */
const REPORT_SECTION_LABELS = {
    executive_summary: 'الملخص التنفيذي',
    preliminary: 'الدراسة المبدئية',
    project_alternatives: 'مقارنة أفكار المشاريع',
    project_info: 'معلومات المشروع الأساسية',
    market: 'تحليل السوق',
    intro_feasibility: 'مقدمة الجدوى',
    marketing: 'التحليل التسويقي',
    financial_kpis: 'الملخص المالي (المؤشرات المالية)',
    swot: 'التحليل الاستراتيجي (التحليل الرباعي)',
    pestel: 'تحليل البيئة الكلية (PESTEL)',
    porter: 'تحليل قوى بورتر الخمس',
    tows: 'مصفوفة الاستراتيجيات (TOWS)',
    partner_needs: 'نوع الشريك الاستراتيجي المطلوب',
    capex: 'الاستثمارات الرأسمالية',
    legal: 'الدراسة القانونية والتراخيص',
    income_statement: 'قائمة الدخل',
    cash_flow: 'قائمة التدفقات النقدية',
    loan_schedule: 'جدول سداد القرض',
    balance_sheet: 'الميزانية العمومية التقديرية',
    business_model: 'نموذج العمل',
    org_structure: 'الهيكل التنظيمي وخطة التوطين',
    risks: 'سجل المخاطر وخطط التخفيف',
    appendices: 'الملاحق والمصادر وعروض الأسعار',
    scenarios: 'مقارنة السيناريوهات',
    sensitivity: 'تحليل الحساسية',
    recommendation: 'التوصية النهائية والقرار الاستثماري'
};

export class ReportGenerator {

    static calculateResults(state) {
        try {
            return runFullModel(state);
        } catch (e) {
            console.error("Report calc error", e);
            return {};
        }
    }

    static getFinancingDiagnostics(state, results) {
        return buildFinancingDiagnostics(state, results);
    }

    static renderFinancingDiagnostics(d, fmt) {
        const gapThreshold = d?.fundingGapThreshold ?? 1;
        if (!d || (!d.alerts?.length && !d.isSaas && Math.abs(Number(d.fundingGap || 0)) <= gapThreshold && !d.loanAmount)) return '';
        const gapText = d.fundingGap > gapThreshold
            ? fmt(d.fundingGap)
            : d.fundingGap < -gapThreshold
                ? 'فائض ' + fmt(Math.abs(d.fundingGap))
                : 'متوازن';
        const dscrText = d.dscr == null ? 'غير قابل للحساب' : Number(d.dscr).toFixed(2) + 'x';
        const y1Text = Number.isFinite(d.y1Ebitda) ? fmt(d.y1Ebitda) : 'غير متاح';
        const title = d.bankReady ? 'جاهزية التمويل: جاهز بنكياً مبدئياً' : 'جاهزية التمويل: مراجعة مطلوبة قبل البنك';
        return `
            <div style="border:1px solid ${d.bankReady ? '#38a169' : '#f59e0b'}; background:${d.bankReady ? '#f0fff4' : '#fffbeb'}; border-radius:6px; padding:12px 14px; margin:14px 0;">
                <h4 style="margin:0 0 8px; color:${d.bankReady ? '#276749' : '#92400e'};">${title}</h4>
                <table style="margin:8px 0;"><thead><tr><th>المؤشر</th><th>القيمة</th><th>القراءة</th></tr></thead><tbody>
                    <tr><td>فجوة التمويل</td><td>${gapText}</td><td>${d.fundingGap > gapThreshold ? 'غير مغطاة' : 'مقبولة'}</td></tr>
                    <tr><td>DSCR السنة الأولى</td><td>${dscrText}</td><td>${d.dscrBlocked ? 'دون الحد المستهدف ' + d.targetDSCR.toFixed(2) + 'x' : 'مقبول مبدئياً'}</td></tr>
                    <tr><td>EBITDA السنة الأولى</td><td>${y1Text}</td><td>${d.y1Ebitda < 0 ? 'سالب؛ يحتاج تمويل/سماح أطول' : 'موجب'}</td></tr>
                </tbody></table>
                ${d.alerts?.length ? `<ul>${d.alerts.map(a => `<li><strong>${escapeHtml(a.title)}:</strong> ${escapeHtml(a.text)}</li>`).join('')}</ul>` : ''}
            </div>
        `;
    }

    /** يُترجم مفتاحاً من قاموس reportStrings عند lang='en'؛ يُبقي النص العربي الأصلي حرفياً دون تغيير لـ'ar' (توافق رجعي صارم — لا نعتمد على تطابق قاموس reportStrings حرفياً مع كل نص موجود مسبقاً). */
    static _lbl(lang, key, arText) {
        return lang === 'en' ? t(key, 'en') : arText;
    }

    static generateHTML(store, options = {}) {
        const lang = options.lang === 'en' ? 'en' : 'ar';
        const state = store.getState ? store.getState() : store.get();
        const info = state.projectInfo || {};
        const studyTypeLabel = getOptionLabel('studyType', info.studyType);
        const studyRecipientLabel = getOptionLabel('studyRecipientType', info.studyRecipientType);

        // تحديث state.results دائماً من runFullModel قبل إنشاء التقرير
        let results;
        try {
            results = this.calculateResults(state);
            if (store && typeof store.update === 'function') {
                store.update('results', results);
            }
        } catch (e) {
            console.warn('Could not calculate fresh results for report:', e);
            results = state.results || {};
        }
        const date = new Date().toLocaleDateString('ar-SA', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const exportVersion = '1.0';
        const studyVersion = String(state.version || '4.0.0');
        const exportDateTime = new Date().toLocaleString('ar-SA');

        const v = validateStudy(state);
        const validationNotice = !v.valid && v.errors?.length
            ? `<div class="validation-notice" style="background:#fef5e7;border:1px solid #f59e0b;border-radius:6px;padding:12px 20px;margin:0 20px 20px;font-size:10pt;color:#92400e;"><strong>تحذير:</strong> توجد أخطاء في صحة البيانات قد تؤثر على دقة النتائج. يُفضّل مراجعتها قبل الاعتماد على هذا التقرير.<ul style="margin:8px 0 0 20px;">${v.errors.slice(0, 3).map(e => '<li>' + escapeHtml(e) + '</li>').join('')}</ul></div>`
            : '';

        const body = this._renderBodyWithOrder(state, results, info, lang);

        return `
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>دراسة جدوى - ${escapeHtml(info.name || 'مشروع جديد')}</title>
                <link href="/fonts/fonts.css" rel="stylesheet">
                <style>
                    /* ═══════════════════════════════════════════════════════════════
                       PREMIUM FINANCIAL REPORT CSS - ARABIC OPTIMIZED
                       ═══════════════════════════════════════════════════════════════ */
                    
                    :root {
                        --primary-gold: #8a5f1c;
                        --primary-dark: #1a1f2e;
                        --accent-blue: #2c5282;
                        --text-main: #1a202c;
                        --text-muted: #718096;
                        --border-light: #e2e8f0;
                        --bg-highlight: #f7fafc;
                        --success-green: #38a169;
                        --danger-red: #e53e3e;
                    }

                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }

                    /* Page Setup for A4 Print */
                    @page {
                        size: A4;
                        margin: 2cm 1.5cm;
                    }

                    body {
                        font-family: 'IBM Plex Sans Arabic', -apple-system, BlinkMacSystemFont, sans-serif;
                        font-size: 11pt;
                        line-height: 1.7;
                        color: var(--text-main);
                        background: white;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }

                    /* Report Container */
                    .report-container {
                        max-width: 21cm;
                        margin: 0 auto;
                        background: white;
                    }

                    /* Header Styling */
                    .report-header {
                        text-align: center;
                        padding: 30px 0 20px;
                        border-bottom: 3px solid var(--primary-gold);
                        margin-bottom: 40px;
                        background: linear-gradient(135deg, var(--primary-dark) 0%, #2d3748 100%);
                        color: white;
                        padding: 40px 30px;
                        border-radius: 8px 8px 0 0;
                    }

                    .report-header h1 {
                        font-family: 'IBM Plex Sans Arabic', sans-serif;
                        font-size: 28pt;
                        font-weight: 700;
                        margin-bottom: 10px;
                        color: var(--primary-gold);
                        text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
                    }

                    .report-header h2 {
                        font-size: 20pt;
                        font-weight: 500;
                        margin-bottom: 15px;
                        color: white;
                    }

                    .report-meta {
                        display: flex;
                        justify-content: space-around;
                        margin-top: 20px;
                        padding-top: 20px;
                        border-top: 1px solid rgba(138, 95, 28, 0.3);
                        font-size: 10pt;
                        color: #cbd5e0;
                    }

                    .report-meta-item {
                        text-align: center;
                    }

                    .report-meta-item strong {
                        display: block;
                        color: var(--primary-gold);
                        margin-bottom: 5px;
                    }

                    /* Section Styling */
                    .section {
                        margin-bottom: 40px;
                        page-break-inside: avoid;
                    }

                    .section-title {
                        font-family: 'IBM Plex Sans Arabic', sans-serif;
                        font-size: 16pt;
                        font-weight: 700;
                        color: var(--accent-blue);
                        padding: 12px 20px;
                        background: linear-gradient(to left, var(--bg-highlight), white);
                        border-right: 4px solid var(--primary-gold);
                        margin-bottom: 20px;
                        display: flex;
                        align-items: center;
                    }

                    .section-number {
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        width: 32px;
                        height: 32px;
                        background: var(--primary-gold);
                        color: white;
                        border-radius: 50%;
                        margin-left: 15px;
                        font-size: 14pt;
                        font-weight: 700;
                    }

                    .section-content {
                        padding: 0 20px;
                        line-height: 1.8;
                    }

                    /* Premium Table Styling */
                    table {
                        width: 100%;
                        border-collapse: separate;
                        border-spacing: 0;
                        margin: 20px 0;
                        font-size: 10pt;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                        border-radius: 6px;
                        overflow: hidden;
                    }

                    thead {
                        background: linear-gradient(135deg, var(--accent-blue), #3182ce);
                        color: white;
                    }

                    th {
                        padding: 14px 16px;
                        text-align: right;
                        font-weight: 600;
                        font-size: 11pt;
                        border-bottom: 2px solid var(--primary-gold);
                    }

                    td {
                        padding: 12px 16px;
                        text-align: right;
                        border-bottom: 1px solid var(--border-light);
                    }

                    tbody tr {
                        background: white;
                        transition: background 0.2s;
                    }

                    tbody tr:nth-child(even) {
                        background: var(--bg-highlight);
                    }

                    tbody tr:hover {
                        background: #edf2f7;
                    }

                    .financial-highlight {
                        background: linear-gradient(to left, #fef5e7, white) !important;
                        font-weight: 700;
                        color: var(--accent-blue);
                        border-top: 2px solid var(--primary-gold);
                    }

                    .status-positive {
                        color: var(--success-green);
                        font-weight: 600;
                    }

                    .status-negative {
                        color: var(--danger-red);
                        font-weight: 600;
                    }

                    /* List Styling */
                    ul {
                        list-style: none;
                        padding-right: 0;
                    }

                    ul li {
                        padding: 8px 0;
                        padding-right: 30px;
                        position: relative;
                    }

                    ul li:before {
                        content: "◆";
                        color: var(--primary-gold);
                        position: absolute;
                        right: 10px;
                        font-size: 8pt;
                    }

                    ul li strong {
                        color: var(--accent-blue);
                    }

                    /* KPI Cards */
                    .kpi-grid {
                        display: grid;
                        grid-template-columns: repeat(2, 1fr);
                        gap: 15px;
                        margin: 25px 0;
                    }

                    .kpi-card {
                        background: var(--bg-highlight);
                        border: 1px solid var(--border-light);
                        border-right: 3px solid var(--primary-gold);
                        padding: 20px;
                        border-radius: 6px;
                    }

                    .kpi-label {
                        font-size: 9pt;
                        color: var(--text-muted);
                        margin-bottom: 8px;
                        font-weight: 500;
                    }

                    .kpi-value {
                        font-size: 18pt;
                        font-weight: 700;
                        color: var(--accent-blue);
                    }

                    .kpi-value.positive {
                        color: var(--success-green);
                    }

                    .kpi-value.negative {
                        color: var(--danger-red);
                    }

                    /* SWOT Table */
                    .swot-table {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 15px;
                        margin: 25px 0;
                    }

                    .swot-box {
                        background: white;
                        border: 2px solid var(--border-light);
                        border-radius: 6px;
                        padding: 20px;
                    }

                    .swot-box h4 {
                        font-size: 12pt;
                        font-weight: 700;
                        margin-bottom: 12px;
                        padding-bottom: 8px;
                        border-bottom: 2px solid var(--primary-gold);
                    }

                    .swot-box.strengths h4 { color: var(--success-green); }
                    .swot-box.weaknesses h4 { color: #dd6b20; }
                    .swot-box.opportunities h4 { color: #3182ce; }
                    .swot-box.threats h4 { color: var(--danger-red); }

                    .swot-box ul {
                        font-size: 10pt;
                    }

                    .swot-box li:before {
                        content: "•";
                        font-size: 12pt;
                    }

                    /* Footer */
                    .report-footer {
                        margin-top: 60px;
                        padding-top: 20px;
                        border-top: 2px solid var(--border-light);
                        text-align: center;
                        color: var(--text-muted);
                        font-size: 9pt;
                    }

                    .report-footer .logo {
                        font-size: 14pt;
                        font-weight: 700;
                        color: var(--primary-gold);
                        margin-bottom: 10px;
                    }

                    /* Page Break Control */
                    .page-break {
                        page-break-after: always;
                    }

                    /* Print-specific adjustments */
                    @media print {
                        body {
                            background: white;
                        }

                        .report-header {
                            background: var(--primary-dark) !important;
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                        }

                        table {
                            box-shadow: none;
                            border: 1px solid var(--border-light);
                        }

                        thead {
                            background: var(--accent-blue) !important;
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                        }

                        .section {
                            page-break-inside: avoid;
                        }

                        .kpi-grid {
                            page-break-inside: avoid;
                        }
                    }

                    /* Responsive for screen preview */
                    @media screen and (max-width: 800px) {
                        .kpi-grid {
                            grid-template-columns: 1fr;
                        }

                        .swot-table {
                            grid-template-columns: 1fr;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="report-container">
                    <!-- HEADER -->
                    <div class="report-header">
                        <h1>📊 دراسة جدوى اقتصادية شاملة</h1>
                        <h2>${escapeHtml(info.name || 'مشروع مقترح')}</h2>
                        ${(info.clientName || '').trim() ? `<p style="font-size: 12pt; margin: 6px 0 0;">أُعدت هذه الدراسة لصالح: <strong>${escapeHtml(info.clientName)}</strong></p>` : ''}
                        ${(info.preparedBy || '').trim() ? `<p style="font-size: 10pt; margin: 2px 0 0; color: #718096;">إعداد: ${escapeHtml(info.preparedBy)}</p>` : ''}
                        <div class="report-meta">
                            <div class="report-meta-item">
                                <strong>تاريخ الإعداد</strong>
                                <span>${date}</span>
                            </div>
                            <div class="report-meta-item">
                                <strong>رقم إصدار الدراسة</strong>
                                <span>${escapeHtml(studyVersion)} • قالب التصدير ${exportVersion}</span>
                            </div>
                            <div class="report-meta-item">
                                <strong>تاريخ ووقت التصدير</strong>
                                <span>${escapeHtml(exportDateTime)}</span>
                            </div>
                            <div class="report-meta-item">
                                <strong>النشاط</strong>
                                <span>${escapeHtml(info.activity || 'غير محدد')}</span>
                            </div>
                            <div class="report-meta-item">
                                <strong>نوع الدراسة</strong>
                                <span>${studyTypeLabel || 'غير محدد'}</span>
                            </div>
                            <div class="report-meta-item">
                                <strong>لمن تُعد</strong>
                                <span>${studyRecipientLabel || 'غير محدد'}</span>
                            </div>
                            <div class="report-meta-item">
                                <strong>المنصة</strong>
                                <span>محاكي الجدوى</span>
                            </div>
                        </div>
                    </div>
                    ${validationNotice}

                    ${body.tocHtml}
                    ${body.sectionsHtml}

                    <!-- FOOTER -->
                    <div class="report-footer">
                        <div class="logo">⚡ محاكي الجدوى</div>
                        <p>تم إنشاء هذا التقرير بواسطة منصة الجدوى الذكية | جميع الحقوق محفوظة © ${new Date().getFullYear()}</p>
                        <p style="margin-top: 8px; font-size: 9pt; color: var(--primary-gold); font-weight: 500;">✓ ${BANK_COMPLIANCE_SENTENCE}</p>
                        ${/^https?:\/\//i.test((state.consultationBookingUrl || '').trim()) ? `<p style="margin-top: 8px; font-size: 9pt;"><a href="${escapeHtml(state.consultationBookingUrl.trim())}" target="_blank" rel="noopener">📞 احجز استشارة مع خبير</a></p>` : ''}
                        <p style="margin-top: 10px; font-size: 8pt; color: #a0aec0;">
                            هذا التقرير معد لأغراض التخطيط الداخلي. الأرقام الفعلية قد تختلف بناءً على ظروف السوق والتنفيذ.
                        </p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    /** يبني فهرس المحتويات وأقسام التقرير حسب ترتيب المستخدم (reportSectionOrder). */
    static _renderBodyWithOrder(state, results, info, lang = 'ar') {
        const baseOrder = (state.reportSectionOrder && state.reportSectionOrder.length)
            ? state.reportSectionOrder
            : [...DEFAULT_REPORT_SECTION_ORDER];
        const order = [...baseOrder];
        for (const id of DEFAULT_REPORT_SECTION_ORDER) {
            if (!order.includes(id)) order.push(id);
        }
        const ordered = [];
        let num = 1;
        for (const id of order) {
            const out = this._renderSection(id, state, results, info, num, lang);
            if (out) {
                ordered.push(out);
                num++;
            }
        }
        const tocHtml = `<div class="section" style="background: var(--bg-highlight); padding: 20px; border-radius: 8px; margin-bottom: 24px;">
                        <h3 class="section-title" style="margin-bottom: 12px;">
                            <span class="section-number">0</span>
                            فهرس المحتويات
                        </h3>
                        <ol style="padding-right: 24px; line-height: 2;">
                            ${ordered.map(o => `<li>${escapeHtml(o.title)}</li>`).join('')}
                        </ol>
                    </div>`;
        const sectionsHtml = ordered.map(o => o.html).join('\n                    ');
        return { tocHtml, sectionsHtml };
    }

    /** يُرجع قسماً واحداً من التقرير أو null إن كان اختيارياً ولا توجد بيانات. */
    static _renderSection(id, state, results, info, num, lang = 'ar') {
        const title = REPORT_SECTION_LABELS[id] || id;
        const fmt = (v) => formatCurrency(v, state.assumptions?.currency || 'SAR');
        const financingDiagnostics = this.getFinancingDiagnostics(state, results);
        let html = '';
        switch (id) {
            case 'executive_summary': {
                // بطاقة أرقام بارزة تُشتق من نتائج المحرك — الملخص التنفيذي يقدّم القرار والأرقام أولاً
                const exIn = results.indicators || {};
                const exDecision = results.decision === 'GO' ? '<span class="status-positive">المضي قدماً</span>'
                    : (results.decision === 'NO-GO' || results.decision === 'NOGO') ? '<span class="status-negative">عدم المضي</span>'
                    : results.decision === 'REVISE' ? '<span style="color:#b45309;font-weight:700;">مراجعة مطلوبة</span>' : '—';
                const exHighlights = `
                            <table style="margin-bottom:14px;"><thead><tr>
                                <th>الاستثمار المطلوب</th><th>NPV</th><th>IRR</th><th>الاسترداد</th><th>التوصية</th>
                            </tr></thead><tbody><tr>
                                <td><strong>${fmt(results.capex?.total || 0)}</strong></td>
                                <td class="${(exIn.npv || 0) > 0 ? 'status-positive' : 'status-negative'}">${fmt(exIn.npv || 0)}</td>
                                <td>${exIn.irr == null ? 'غير محقق' : (exIn.irr * 100).toFixed(1) + '%'}</td>
                                <td>${exIn.paybackPeriod ? exIn.paybackPeriod.toFixed(1) + ' سنة' : '—'}</td>
                                <td>${exDecision}</td>
                            </tr></tbody></table>`;
                // القيمة النهائية (استرشادية) + مصالحة الطاقة — إجابتان مسبقتان على سؤالي المدقق:
                // «لماذا مشروعك بلا قيمة بعد سنوات الدراسة؟» و«هل المبيعات قابلة للتحقيق مادياً؟»
                const exFootnotes = [];
                if ((exIn.terminalValue || 0) > 0) {
                    exFootnotes.push(`القرار أعلاه مبني على NPV المتحفظ (بلا قيمة نهائية). استرشادياً، بافتراض استمرار المشروع بنمو مستدام بعد فترة الدراسة، تُقدَّر القيمة النهائية المخصومة بـ ${fmt(exIn.terminalValue)} ويصبح NPV الشامل ${fmt(exIn.npvWithTerminal)}.`);
                }
                if (results.capacityCheck && !results.capacityCheck.exceeded) {
                    exFootnotes.push(`مصالحة الطاقة: المبيعات المخططة (${results.capacityCheck.plannedUnitsPerMonth.toLocaleString('ar-SA')} عميل/شهر) تعادل ${Math.round((results.capacityCheck.utilizationOfMax || 0) * 100)}% من الطاقة القصوى الفعلية (${results.capacityCheck.maxUnitsPerMonth.toLocaleString('ar-SA')}) — قابلة للتحقيق مادياً.`);
                }
                if (financingDiagnostics.fundingGap > (financingDiagnostics.fundingGapThreshold ?? 1)) {
                    exFootnotes.push(`حاجز تمويلي: توجد فجوة تمويل قدرها ${fmt(financingDiagnostics.fundingGap)} يجب تغطيتها قبل اعتماد الدراسة.`);
                }
                if (financingDiagnostics.dscrBlocked) {
                    const dscrText = financingDiagnostics.dscr == null ? 'غير قابل للحساب' : financingDiagnostics.dscr.toFixed(2) + 'x';
                    exFootnotes.push(`حاجز بنكي: DSCR السنة الأولى ${dscrText} دون الحد المستهدف ${financingDiagnostics.targetDSCR.toFixed(2)}x.`);
                }
                if (financingDiagnostics.isSaas && financingDiagnostics.loanAmount > 0 && financingDiagnostics.y1Ebitda <= 0) {
                    exFootnotes.push('قراءة المستثمر والقراءة البنكية مختلفتان: مشروع SaaS قد يكون مقبولاً استثمارياً مع إثبات النمو، لكنه يحتاج هيكلة تمويل أخف أو سماح أطول قبل التقديم للبنك.');
                }
                const exFootnotesHtml = exFootnotes.length
                    ? `<div style="font-size:9pt; color:#6C766E; line-height:1.8; margin-top:8px;">${exFootnotes.map(f => `• ${f}`).join('<br>')}</div>`
                    : '';
                html = `<div class="section">
                        <h3 class="section-title"><span class="section-number">${num}</span>الملخص التنفيذي</h3>
                        <div class="section-content">
                            ${exHighlights}
                            ${exFootnotesHtml}
                            <p>${state.executiveSummary?.projectOverview ? escapeHtml(state.executiveSummary.projectOverview) : (state.executiveSummary?.aiGeneratedText ? escapeHtml(state.executiveSummary.aiGeneratedText) : `يعرض هذا التقرير دراسة جدوى مشروع «${escapeHtml(info.name || 'المشروع')}»${info.city ? ' في ' + escapeHtml(info.city) : ''}، شاملةً الجوانب الفنية والتسويقية والمالية، مع تحليل حساسية وسيناريوهات وقرار استثماري مبني على مؤشرات مالية محسوبة من مدخلات الدراسة.`)}</p>
                        </div>
                    </div>`;
                break;
            }
            case 'preliminary':
                if (!(state.preliminaryCheck?.isProjectFeasible || state.preliminaryCheck?.suitableForEnvironment || state.preliminaryCheck?.hasInitialResources || state.preliminaryCheck?.readyForDetailedStudy)) return null;
                html = `<div class="section">
                        <h3 class="section-title"><span class="section-number">${num}</span>الدراسة المبدئية</h3>
                        <div class="section-content"><ul>
                            ${state.preliminaryCheck?.isProjectFeasible ? `<li><strong>هل المشروع ممكن؟</strong> ${(state.preliminaryCheck.isProjectFeasible || '-')}</li>` : ''}
                            ${state.preliminaryCheck?.suitableForEnvironment ? `<li><strong>مناسب للبيئة؟</strong> ${(state.preliminaryCheck.suitableForEnvironment || '-')}</li>` : ''}
                            ${state.preliminaryCheck?.hasInitialResources ? `<li><strong>موارد أولية؟</strong> ${(state.preliminaryCheck.hasInitialResources || '-')}</li>` : ''}
                            ${state.preliminaryCheck?.readyForDetailedStudy ? `<li><strong>جاهز للتفصيل؟</strong> ${(state.preliminaryCheck.readyForDetailedStudy || '-')}</li>` : ''}
                        </ul></div>
                    </div>`;
                break;
            case 'project_alternatives':
                if (!((state.projectAlternatives?.ideas || []).length > 0)) return null;
                html = `<div class="section">
                        <h3 class="section-title"><span class="section-number">${num}</span>مقارنة أفكار المشاريع (قبل التفصيل)</h3>
                        <div class="section-content">
                            <table style="width:100%; border-collapse:collapse; margin-top:8px;"><thead><tr><th>اسم الفكرة</th><th>تكلفة تقريبية</th><th>عائد متوقع/سنة</th><th>المخاطرة</th><th>الاسترداد (سنة)</th><th>ملاحظة</th></tr></thead><tbody>
                            ${(state.projectAlternatives.ideas || []).filter(idea => idea.name || idea.estimatedCost || idea.estimatedReturn || idea.notes).map(idea => {
                                const cost = Number(idea.estimatedCost) || 0, ret = Number(idea.estimatedReturn) || 0;
                                const payback = cost > 0 && ret > 0 ? (cost / ret).toFixed(1) : '-';
                                const riskAr = { low: 'منخفضة', medium: 'متوسطة', high: 'عالية' }[idea.risk] || '-';
                                return `<tr><td>${escapeHtml(idea.name || '-')}</td><td>${new Intl.NumberFormat('ar-SA').format(cost)}</td><td>${new Intl.NumberFormat('ar-SA').format(ret)}</td><td>${riskAr}</td><td>${payback}</td><td>${escapeHtml(idea.notes || '-')}</td></tr>`;
                            }).join('')}
                            </tbody></table>
                            ${state.projectAlternatives.selectedIndex != null && state.projectAlternatives.ideas?.[state.projectAlternatives.selectedIndex] ? `<p style="margin-top:12px;"><strong>الفكرة المختارة للمتابعة:</strong> ${escapeHtml(state.projectAlternatives.ideas[state.projectAlternatives.selectedIndex].name || '-')}</p>` : ''}
                        </div>
                    </div>`;
                break;
            case 'project_info':
                html = `<div class="section">
                        <h3 class="section-title"><span class="section-number">${num}</span>معلومات المشروع الأساسية</h3>
                        <div class="section-content">
                            <ul>
                                <li><strong>اسم المشروع:</strong> ${escapeHtml(info.name || '-')}</li>
                                <li><strong>النشاط التجاري:</strong> ${escapeHtml(info.concept || info.activity || '-')}</li>
                                <li><strong>الموقع:</strong> ${escapeHtml(info.city || info.location || '-')} ${info.district ? '، ' + escapeHtml(info.district) : ''}</li>
                                <li><strong>الهوية:</strong> ${escapeHtml((info.identityStatement || '-').toString().slice(0, 200))}${(info.identityStatement || '').length > 200 ? '...' : ''}</li>
                                <li><strong>القيمة المقترحة:</strong> ${escapeHtml((info.valueProposition || '-').toString().slice(0, 200))}${(info.valueProposition || '').length > 200 ? '...' : ''}</li>
                            </ul>
                            ${(info.dataGatheringChecklist || []).length > 0 ? `<h4 style="margin-top:16px;">خطوات جمع المعلومات (زيارات ميدانية)</h4><table style="margin-top:8px;"><thead><tr><th>الخطوة</th><th>تم؟</th><th>ملاحظات</th></tr></thead><tbody>${(info.dataGatheringChecklist || []).map(c => `<tr><td>${escapeHtml(c.step || '-')}</td><td>${c.done ? 'نعم' : 'لا'}</td><td>${escapeHtml(c.notes || '-')}</td></tr>`).join('')}</tbody></table>` : ''}
                        </div>
                    </div>`;
                break;
            case 'market': {
                // نعرض الصفوف التي لها بيانات فعلية فقط — لا نصوص placeholder تضعف مصداقية التقرير
                const mRows = [];
                const seg = state.marketSizing?.tam?.description || state.marketSizing?.targetDistrict || state.marketing?.marketAnalysis?.targetSegment;
                if (seg) mRows.push(['الشريحة المستهدفة', seg]);
                const tamV = Number(state.marketSizing?.tam?.value || state.marketSizing?.tam || 0);
                const samV = Number(state.marketSizing?.sam?.value || state.marketSizing?.sam || 0);
                const somV = Number(state.marketSizing?.som?.value || state.marketSizing?.som || 0);
                if (tamV > 0 || samV > 0 || somV > 0) {
                    mRows.push(['حجم السوق (TAM / SAM / SOM)',
                        [tamV > 0 ? 'إجمالي السوق: ' + fmt(tamV) : null,
                         samV > 0 ? 'القابل للخدمة: ' + fmt(samV) : null,
                         somV > 0 ? 'الحصة الممكنة: ' + fmt(somV) : null].filter(Boolean).join(' · ')]);
                }
                const competitors = state.marketing?.competitors || [];
                const comps = competitors.map(c => typeof c === 'string' ? c : (c.name || '')).filter(Boolean);
                if (comps.length) mRows.push(['المنافسون الرئيسيون', comps.join('؛ ')]);
                const loc = info.locationAnalysis?.address || info.city;
                if (loc) mRows.push(['الموقع والوصول', loc]);
                if (state.marketing?.marketingMix?.price) mRows.push(['استراتيجية التسعير', state.marketing.marketingMix.price]);
                if (mRows.length === 0) return null;
                const segments = state.marketSizing?.segments || [];
                html = `<div class="section">
                        <h3 class="section-title"><span class="section-number">${num}</span>تحليل السوق</h3>
                        <div class="section-content">
                            <table style="width:100%; border-collapse:collapse;">
                                ${mRows.map(([k, v]) => `<tr><td style="padding:8px 0; vertical-align:top; width:28%;"><strong>${k}</strong></td><td style="padding:8px 0;">${v}</td></tr>`).join('')}
                            </table>
                            ${segments.length ? `<h4 style="margin-top:16px;">شرائح العملاء المستهدفة</h4>${this.renderMarketSegments(segments)}` : ''}
                            ${competitors.length ? `<h4 style="margin-top:16px;">مصفوفة المنافسين</h4>${this.renderCompetitors(competitors)}` : ''}
                        </div>
                    </div>`;
                break;
            }
            case 'intro_feasibility':
                if (!(state.keyPeople?.keyPeople?.length > 0 || state.keyPeople?.partnershipContracts?.length > 0 || info.products?.length > 0 || info.introServices?.length > 0 || info.customerValues?.length > 0 || info.locationAnalysis?.selectionFactors || info.investorProfile || (info.startupHypothesis?.problem || info.startupHypothesis?.solution) || (info.unfairAdvantage?.types?.length > 0 || info.unfairAdvantage?.insightText))) return null;
                html = `<div class="section">
                        <h3 class="section-title"><span class="section-number">${num}</span>مقدمة الجدوى</h3>
                        <div class="section-content">
                            ${state.keyPeople?.keyPeople?.length > 0 ? `<h4 style="margin-bottom:8px;">الأشخاص الرئيسون</h4><table style="margin-bottom:16px;"><thead><tr><th>الاسم</th><th>الدور</th><th>الخبرة</th><th>المؤهلات</th></tr></thead><tbody>${(state.keyPeople.keyPeople || []).map(p => `<tr><td>${escapeHtml(p.name || '-')}</td><td>${escapeHtml(p.role || '-')}</td><td>${escapeHtml(p.experience || '-')}</td><td>${escapeHtml(p.qualifications || '-')}</td></tr>`).join('')}</tbody></table>` : ''}
                            ${state.keyPeople?.partnershipContracts?.length > 0 ? `<h4 style="margin-bottom:8px;">عقود الشراكة</h4><table style="margin-bottom:16px;"><thead><tr><th>اسم الشريك</th><th>الدور/المسؤولية</th><th>النسبة %</th><th>ملاحظات</th></tr></thead><tbody>${(state.keyPeople.partnershipContracts || []).map(p => `<tr><td>${escapeHtml(p.partnerName || '-')}</td><td>${escapeHtml(p.role || '-')}</td><td>${p.sharePercent != null ? escapeHtml(String(p.sharePercent)) + '%' : '-'}</td><td>${escapeHtml(p.notes || '-')}</td></tr>`).join('')}</tbody></table>` : ''}
                            ${info.products?.length > 0 ? `<h4 style="margin-bottom:8px;">المنتجات</h4><table style="margin-bottom:12px;"><thead><tr><th>النوع</th><th>المنتج</th><th>الوصف</th><th>الميزة الفريدة / القيمة المضافة</th></tr></thead><tbody>${(info.products || []).map(p => `<tr><td>${p.type === 'primary' ? 'أولي' : p.type === 'semi' ? 'نصف مصنع' : 'نهائي'}</td><td>${escapeHtml(p.name || '-')}</td><td>${escapeHtml(p.description || '-')}</td><td>${escapeHtml([p.uniqueFeatures, p.valueAdded].filter(v => v && String(v).trim()).join(' — ') || '-')}</td></tr>`).join('')}</tbody></table>` : ''}
                            ${(info.startupHypothesis?.problem || info.startupHypothesis?.solution || info.unfairAdvantage?.insightText) ? `<h4 style="margin-bottom:8px;">الفرضية وتقييم الفكرة</h4><ul>${info.startupHypothesis?.problem ? `<li><strong>المشكلة:</strong> ${escapeHtml(info.startupHypothesis.problem)}</li>` : ''}${info.startupHypothesis?.solution ? `<li><strong>الحل:</strong> ${escapeHtml(info.startupHypothesis.solution)}</li>` : ''}${info.unfairAdvantage?.insightText ? `<li><strong>الاستبصار:</strong> ${escapeHtml(info.unfairAdvantage.insightText)}</li>` : ''}</ul>` : ''}
                        </div>
                    </div>`;
                break;
            case 'marketing':
                {
                const ma = state.marketing?.marketAnalysis || {};
                const mix = state.marketing?.marketingMix || {};
                if (!((state.marketSizing?.vision2030?.alignment) || (state.marketSizing?.nationalEconomy?.gdpGrowth) || (mix.product || mix.price || mix.place || mix.promotion) || ma.summary || ma.description || ma.trends || ma.marketGap || ma.pricingStrategy || ma.distributionStrategy || ma.marketSize || ma.growthRate || (ma.historicalData || []).length > 0 || (state.marketing?.supplyDemandBalance || []).length > 0 || ma.demandElasticity)) return null;
                const marketFacts = [
                    ma.marketSize ? ['حجم السوق المقدر', ma.marketSize] : null,
                    ma.growthRate ? ['معدل النمو', ma.growthRate] : null,
                    ma.trends ? ['اتجاهات السوق', ma.trends] : null,
                    ma.marketGap ? ['الفجوة السوقية', ma.marketGap] : null,
                    ma.pricingStrategy ? ['استراتيجية التسعير', ma.pricingStrategy] : null,
                    ma.distributionStrategy ? ['استراتيجية التوزيع', ma.distributionStrategy] : null,
                    ma.demandElasticity ? ['مرونة الطلب السعرية', ma.demandElasticity] : null
                ].filter(Boolean);
                html = `<div class="section">
                        <h3 class="section-title"><span class="section-number">${num}</span>الدراسة التسويقية</h3>
                        <div class="section-content">
                            ${(ma.summary || ma.description) ? `<h4>ملخص السوق</h4><p>${escapeHtml(ma.summary || ma.description)}</p>` : ''}
                            ${marketFacts.length ? `<h4>مؤشرات واتجاهات السوق</h4><table><thead><tr><th>البند</th><th>التفصيل</th></tr></thead><tbody>${marketFacts.map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`).join('')}</tbody></table>` : ''}
                            ${state.marketSizing?.vision2030?.alignment ? `<h4>مواءمة رؤية 2030</h4><p>${(state.marketSizing.vision2030.alignment || '')}</p>` : ''}
                            ${(mix.product || mix.price || mix.place || mix.promotion) ? `<h4>المزيج التسويقي (4P)</h4><ul><li><strong>المنتج:</strong> ${escapeHtml(mix.product || '-')}</li><li><strong>السعر:</strong> ${escapeHtml(mix.price || '-')}</li><li><strong>المكان:</strong> ${escapeHtml(mix.place || '-')}</li><li><strong>الترويج:</strong> ${escapeHtml(mix.promotion || '-')}</li></ul>` : ''}
                            ${(ma.historicalData || []).length ? `<h4>اتجاهات الطلب التاريخية</h4>${this.renderHistoricalDemand(ma.historicalData)}` : ''}
                            ${(state.marketing?.supplyDemandBalance || []).length ? `<h4>توازن العرض والطلب</h4>${this.renderSupplyDemand(state.marketing.supplyDemandBalance)}` : ''}
                        </div>
                    </div>`;
                }
                break;
            case 'financial_kpis': {
                // النسب المالية (results.ratios): إضافة بحتة من المحرك، صف واحد لكل سنة —
                // نتبع نفس نمط isRow المستخدم في 'income_statement' (closure على مصفوفة السنوات).
                const kpiRatios = results.ratios || [];
                // الوحدة (x أم %) تأتي من ratioUnits.js لا من هذا الملف — مصدر واحد
                // تشترك فيه ملفات PDF وWord وExcel لنفس الدراسة.
                const ratioRow = (label, key) => `<tr><td>${label}</td>${kpiRatios.map(r => `<td>${formatRatio(key, r[key])}</td>`).join('')}</tr>`;
                const ratiosTableHtml = kpiRatios.length === 0 ? '' : `
                            <h4 style="margin-top:16px;">${t('ratios_section_title', lang)}</h4>
                            <table><thead><tr><th>النسبة</th>${kpiRatios.map(r => `<th>${yearColumnLabel(r.year, lang)}</th>`).join('')}</tr></thead><tbody>
                                ${ratioRow(t('current_ratio', lang), 'currentRatio')}
                                ${ratioRow(t('quick_ratio', lang), 'quickRatio')}
                                ${ratioRow(t('cash_ratio', lang), 'cashRatio')}
                                ${ratioRow(t('debt_ratio', lang), 'debtRatio')}
                                ${ratioRow(t('debt_to_equity', lang), 'debtToEquity')}
                                ${ratioRow(t('asset_turnover', lang), 'assetTurnover')}
                                ${ratioRow(t('fixed_asset_turnover', lang), 'fixedAssetTurnover')}
                                ${ratioRow(t('roa', lang), 'roa')}
                                ${ratioRow(t('roe', lang), 'roe')}
                            </tbody></table>`;
                html = `<div class="section">
                        <h3 class="section-title"><span class="section-number">${num}</span>${t('financial_kpis_title', lang)}</h3>
                        <div class="section-content">
                            <div class="kpi-grid">
                                <div class="kpi-card"><div class="kpi-label">${this._lbl(lang, 'npv', 'صافي القيمة الحالية')}</div><div class="kpi-value ${(results.indicators?.npv || 0) > 0 ? 'positive' : 'negative'}">${formatCurrency(results.indicators?.npv || 0)}</div></div>
                                <div class="kpi-card"><div class="kpi-label">${this._lbl(lang, 'irr', 'معدل العائد الداخلي (IRR)')}</div><div class="kpi-value ${(results.indicators?.irr || 0) > 0.15 ? 'positive' : ''}">${results.indicators?.irr == null ? 'غير محقق' : (results.indicators.irr * 100).toFixed(1) + '%'}</div></div>
                                <div class="kpi-card"><div class="kpi-label">${this._lbl(lang, 'payback_period', 'فترة الاسترداد')}</div><div class="kpi-value">${(() => { const p = results.indicators?.paybackPeriod ?? results.indicators?.payback; return Number.isFinite(p) && p > 0 ? p.toFixed(1) + ' سنة' : 'غير محقق'; })()}</div></div>
                                <div class="kpi-card"><div class="kpi-label">نقطة التعادل</div><div class="kpi-value">${SAFE.breakeven(results.indicators, formatCurrency, () => (results.indicators?.breakevenUnitsPerMonth != null ? Math.round(results.indicators.breakevenUnitsPerMonth) + ' وحدة/شهر' : '—'))}</div></div>
                                <div class="kpi-card"><div class="kpi-label">نسبة تغطية خدمة الدين (DSCR)</div><div class="kpi-value">${results.indicators?.dscr != null ? (results.indicators.dscr.toFixed(2) + 'x') : '—'}</div></div>
                                <div class="kpi-card"><div class="kpi-label">فجوة التمويل</div><div class="kpi-value ${financingDiagnostics.fundingGap > (financingDiagnostics.fundingGapThreshold ?? 1) ? 'negative' : 'positive'}">${financingDiagnostics.fundingGap > (financingDiagnostics.fundingGapThreshold ?? 1) ? fmt(financingDiagnostics.fundingGap) : financingDiagnostics.fundingGap < -(financingDiagnostics.fundingGapThreshold ?? 1) ? 'فائض ' + fmt(Math.abs(financingDiagnostics.fundingGap)) : 'متوازن'}</div></div>
                            </div>
                            ${this.renderFinancingDiagnostics(financingDiagnostics, fmt)}
                            <table><thead><tr><th>المؤشر المالي</th><th>القيمة</th><th>التقييم</th></tr></thead><tbody>
                                <tr><td>${this._lbl(lang, 'npv', 'صافي القيمة الحالية')}</td><td>${formatCurrency(results.indicators?.npv || 0)}</td><td class="${(results.indicators?.npv || 0) > 0 ? 'status-positive' : 'status-negative'}">${(results.indicators?.npv || 0) > 0 ? '✓ موجب' : '✗ سالب'}</td></tr>
                                <tr><td>${this._lbl(lang, 'irr', 'معدل العائد الداخلي')}</td><td>${results.indicators?.irr == null ? 'غير محقق' : (results.indicators.irr * 100).toFixed(2) + '%'}</td><td>${results.indicators?.irr == null ? '—' : (results.indicators.irr > 0.15 ? '✓ مرتفع' : 'متوسط')}</td></tr>
                                <tr><td>${this._lbl(lang, 'payback_period', 'فترة الاسترداد')}</td><td>${(() => { const p = results.indicators?.paybackPeriod ?? results.indicators?.payback; return Number.isFinite(p) && p > 0 ? p.toFixed(1) + ' سنة' : 'غير محقق'; })()}</td><td>${(() => { const p = results.indicators?.paybackPeriod ?? results.indicators?.payback; if (!Number.isFinite(p) || p <= 0) return 'غير محقق'; return p < 3 ? 'سريع' : 'طويل نسبياً'; })()}</td></tr>
                                <tr><td>فجوة التمويل</td><td>${financingDiagnostics.fundingGap > (financingDiagnostics.fundingGapThreshold ?? 1) ? fmt(financingDiagnostics.fundingGap) : financingDiagnostics.fundingGap < -(financingDiagnostics.fundingGapThreshold ?? 1) ? 'فائض ' + fmt(Math.abs(financingDiagnostics.fundingGap)) : 'متوازن'}</td><td class="${financingDiagnostics.fundingGap > (financingDiagnostics.fundingGapThreshold ?? 1) ? 'status-negative' : 'status-positive'}">${financingDiagnostics.fundingGap > (financingDiagnostics.fundingGapThreshold ?? 1) ? 'يجب سدها قبل الاعتماد' : 'مقبولة'}</td></tr>
                                <tr><td>DSCR السنة الأولى</td><td>${financingDiagnostics.dscr == null ? 'غير قابل للحساب' : financingDiagnostics.dscr.toFixed(2) + 'x'}</td><td class="${financingDiagnostics.dscrBlocked ? 'status-negative' : 'status-positive'}">${financingDiagnostics.dscrBlocked ? 'دون الحد البنكي المستهدف' : 'مقبول مبدئياً'}</td></tr>
                            </tbody></table>
                            ${ratiosTableHtml}
                        </div>
                    </div>`;
                break;
            }
            case 'swot':
                html = `<div class="section">
                        <h3 class="section-title"><span class="section-number">${num}</span>التحليل الاستراتيجي (التحليل الرباعي)</h3>
                        <div class="section-content">${this.renderSWOT(state.strategic?.swot || state.strategicAnalysis?.swot)}</div>
                    </div>`;
                break;
            case 'pestel': {
                const pestel = state.strategic?.pestel;
                if (!Array.isArray(pestel) || !pestel.some(f => (f.description || '').trim())) return null;
                html = `<div class="section">
                        <h3 class="section-title"><span class="section-number">${num}</span>تحليل البيئة الكلية (PESTEL)</h3>
                        <div class="section-content">${this.renderPESTEL(pestel)}</div>
                    </div>`;
                break;
            }
            case 'porter': {
                const porter = state.strategic?.porter;
                const hasData = porter && Object.values(porter).some(f => (f?.description || '').trim());
                if (!hasData) return null;
                html = `<div class="section">
                        <h3 class="section-title"><span class="section-number">${num}</span>تحليل قوى بورتر الخمس</h3>
                        <div class="section-content">${this.renderPorter(porter)}</div>
                    </div>`;
                break;
            }
            case 'tows': {
                const tows = state.marketing?.towsMatrix;
                if (!tows || !['so', 'wo', 'st', 'wt'].some(k => (tows[k] || '').trim())) return null;
                html = `<div class="section">
                        <h3 class="section-title"><span class="section-number">${num}</span>مصفوفة الاستراتيجيات (TOWS)</h3>
                        <div class="section-content">${this.renderTOWS(tows)}</div>
                    </div>`;
                break;
            }
            case 'partner_needs': {
                const needs = results.partnerNeeds;
                if (!Array.isArray(needs) || needs.length === 0) return null;
                html = `<div class="section">
                        <h3 class="section-title"><span class="section-number">${num}</span>نوع الشريك الاستراتيجي المطلوب</h3>
                        <div class="section-content">${this.renderPartnerNeeds(needs)}</div>
                    </div>`;
                break;
            }
            case 'capex': {
                const assetScheduleRows = results.assetSchedule || [];
                const operatingWC = results.capex?.capitalStructure?.operating;
                // بنود هذا الجدول تُشتق من مجموعَي المحرك (subtotal/total) بالطرح، فتجمع إلى
                // «إجمالي الاستثمار المطلوب» بحكم البناء مهما تغيّرت مكوّنات capexBreakdown.
                // كان صف «التراخيص» يقرأ capex.items — مفتاح لا ينتجه calculateStudy إطلاقاً —
                // فيطبع ٠ دائماً بينما المبلغ مندسّ داخل subtotal المُعنون «التجهيزات والمعدات».
                const capexSubtotal = results.capex?.subtotal || 0;
                const capexTotal = results.capex?.total || 0;
                const establishmentCosts = results.capex?.capitalStructure?.establishment?.total || 0;
                html = `<div class="section">
                        <h3 class="section-title"><span class="section-number">${num}</span>الدراسة الفنية (التكاليف الاستثمارية)</h3>
                        <div class="section-content">
                            <table><thead><tr><th>بند التكلفة</th><th>القيمة التقديرية</th></tr></thead><tbody>
                                <tr><td>الأصول والتجهيزات</td><td>${formatCurrency(capexSubtotal - establishmentCosts)}</td></tr>
                                <tr><td>مصاريف التأسيس والتراخيص</td><td>${formatCurrency(establishmentCosts)}</td></tr>
                                <tr><td>رأس المال العامل</td><td>${formatCurrency(capexTotal - capexSubtotal)}</td></tr>
                                <tr class="financial-highlight"><td>إجمالي الاستثمار المطلوب</td><td>${formatCurrency(capexTotal)}</td></tr>
                            </tbody></table>
                            ${this.renderAssetSchedule(assetScheduleRows, fmt)}
                            ${operatingWC?.total ? this.renderOperatingWorkingCapital(operatingWC, fmt) : ''}
                            ${this.renderPayrollGrowth(results.payrollByPosition, fmt)}
                            ${this.renderMarketingGrowth(results.marketingByChannel, fmt)}
                        </div>
                    </div>`;
                break;
            }
            case 'legal': {
                const licenses = state.legal?.licenses || [];
                if (!licenses.length) return null;
                html = `<div class="section">
                        <h3 class="section-title"><span class="section-number">${num}</span>الدراسة القانونية والتراخيص</h3>
                        <div class="section-content">${this.renderLicenses(licenses)}</div>
                    </div>`;
                break;
            }
            case 'income_statement': {
                // قائمة دخل كاملة لكل سنوات الدراسة (كانت تعرض السنة الأولى فقط وتُهمل الباقي)
                const isYears = results.incomeStatement || [];
                if (isYears.length === 0) return null;
                const isRow = (label, key, opts = {}) => `<tr class="${opts.highlight ? 'financial-highlight' : ''}"><td>${label}</td>${isYears.map(y => `<td>${formatCurrency(y[key] || 0)}</td>`).join('')}</tr>`;
                // تدقيق 2026-07-08 (ملاحظة عالية #30): "المصاريف التشغيلية الثابتة" كانت تُعرض
                // كرقم مجمّع واحد رغم أن المحرك يحسب تفصيلها فعلياً (fixedCostsBreakdown لكل
                // سنة: رواتب/إيجار وإداري/تسويق/تكاليف خدمات ثابتة) — التقرير لم يكن يقرأه.
                const bdRow = (label, bdKey, opts = {}) => `<tr class="${opts.sub ? 'report-subrow' : ''}"><td>${opts.sub ? '&nbsp;&nbsp;↳ ' : ''}${label}</td>${isYears.map(y => `<td>${formatCurrency((y.fixedCostsBreakdown || {})[bdKey] || 0)}</td>`).join('')}</tr>`;
                const hasHiddenOverheads = isYears.some(y => (y.fixedCostsBreakdown?.hiddenOverheads || 0) > 0);
                const hasServicesFixed = isYears.some(y => (y.fixedCostsBreakdown?.servicesFixed || 0) > 0);
                html = `<div class="section">
                        <h3 class="section-title"><span class="section-number">${num}</span>${t('income_statement_title', lang)} (${isYears.length} ${lang === 'en' ? 'Years' : 'سنوات'})</h3>
                        <div class="section-content">
                            ${this.renderIncomeChart(isYears, lang)}
                            ${this.renderRevenueStreamsBreakdown(state.revenue?.streams)}
                            <table><thead><tr><th>${t('item_column', lang)}</th>${isYears.map(y => `<th>${yearColumnLabel(y.year, lang)}</th>`).join('')}</tr></thead><tbody>
                                ${isRow(this._lbl(lang, 'revenue', 'إجمالي الإيرادات'), 'revenue')}
                                ${isRow(`(-) ${t('variable_costs', lang)}`, 'variableCosts')}
                                ${isRow(`(=) ${t('gross_profit', lang)}`, 'grossProfit')}
                                ${isRow(`(-) ${lang === 'en' ? 'Operating ' : ''}${this._lbl(lang, 'fixed_costs', 'المصاريف التشغيلية الثابتة')}`, 'fixedCosts')}
                                ${bdRow('رواتب وأجور (شامل التأمينات ورسوم العمالة)', 'payroll', { sub: true })}
                                ${bdRow('إيجار ولوجستيات وإداري', 'rentAndAdmin', { sub: true })}
                                ${bdRow('تسويق', 'marketing', { sub: true })}
                                ${hasServicesFixed ? bdRow('تكاليف ثابتة لكل خدمة', 'servicesFixed', { sub: true }) : ''}
                                ${hasHiddenOverheads ? bdRow('طوارئ تشغيلية مخفية', 'hiddenOverheads', { sub: true }) : ''}
                                ${isYears.some(y => (y.franchiseFees || 0) > 0) ? isRow(`(-) ${t('franchise_fees', lang)}`, 'franchiseFees') : ''}
                                ${isRow(`(=) ${this._lbl(lang, 'ebitda', 'الأرباح قبل الفوائد والضرائب والإهلاك والإطفاء (EBITDA)')}`, 'ebitda')}
                                ${isYears.some(y => (y.builderSuccessFee || 0) > 0) ? isRow(`(-) ${t('builder_success_fee', lang)}`, 'builderSuccessFee') : ''}
                                ${isRow(`(-) ${this._lbl(lang, 'depreciation', 'الإهلاك والإطفاء')}${lang === 'en' ? ' & Amortization' : ''}`, 'depreciation')}
                                ${isRow(`(-) ${t('interest', lang)}`, 'interest')}
                                ${isRow(`(-) ${t('zakat', lang)}`, 'zakat')}
                                ${isYears.some(y => (y.tax || 0) > 0) ? isRow(`(-) ${this._lbl(lang, 'tax', 'ضريبة الدخل')} ${lang === 'en' ? "(Foreign Partners' Share)" : '(حصة الأجانب)'}`, 'tax') : ''}
                                ${isRow(`(=) ${t('net_income', lang)}`, 'netIncome', { highlight: true })}
                            </tbody></table>
                        </div>
                    </div>`;
                break;
            }
            case 'cash_flow':
                html = `<div class="section">
                        <h3 class="section-title"><span class="section-number">${num}</span>${lang === 'en' ? t('cash_flow_title', 'en') : `الدراسة المالية (${t('cash_flow_title', 'ar')})`}</h3>
                        <div class="section-content">
                            ${this.renderCumulativeCashChart(results.cashFlow || [])}
                            ${this.renderCashFlow(results.cashFlow || [], lang)}
                        </div>
                    </div>`;
                break;
            case 'balance_sheet': {
                if (!(results.balanceSheets && results.balanceSheets.length > 0)) return null;
                html = `<div class="section">
                        <h3 class="section-title"><span class="section-number">${num}</span>${t('balance_sheet_title', lang)}</h3>
                        <div class="section-content">${this.renderBalanceSheets(results.balanceSheets, lang)}</div>
                    </div>`;
                break;
            }
            case 'risks': {
                const riskRows = (state.riskAnalysis?.risks || []).filter(r => r && (r.name || r.description));
                if (riskRows.length === 0) return null;
                html = `<div class="section">
                        <h3 class="section-title"><span class="section-number">${num}</span>سجل المخاطر وخطط التخفيف</h3>
                        <div class="section-content">${this.renderRisks(riskRows)}</div>
                    </div>`;
                break;
            }
            case 'appendices': {
                const appendices = state.appendices || {};
                const hasAppendix = (appendices.references || []).length
                    || (appendices.reviewers || []).length
                    || (appendices.surveys || []).length
                    || (appendices.priceQuotes || []).length
                    || String(appendices.investorProfile || '').trim();
                if (!hasAppendix) return null;
                html = `<div class="section">
                        <h3 class="section-title"><span class="section-number">${num}</span>الملاحق والمصادر وعروض الأسعار</h3>
                        <div class="section-content">${this.renderAppendices(appendices)}</div>
                    </div>`;
                break;
            }
            case 'loan_schedule':
                if (!(results.loanSchedule && results.loanSchedule.loanAmount > 0)) return null;
                html = `<div class="section">
                        <h3 class="section-title"><span class="section-number">${num}</span>جدول سداد القرض</h3>
                        <div class="section-content">${this.renderLoanSchedule(results.loanSchedule)}</div>
                    </div>`;
                break;
            case 'business_model':
                html = `<div class="section">
                        <h3 class="section-title"><span class="section-number">${num}</span>نموذج العمل</h3>
                        <div class="section-content">${this.renderBusinessModel(state.businessModel || {})}</div>
                    </div>`;
                break;
            case 'org_structure': {
                const orgStructure = state.orgStructure;
                const hasDepts = Array.isArray(orgStructure?.departments) && orgStructure.departments.some(d => (d.name || '').trim());
                const saud = orgStructure?.saudization;
                // targetPercentage/currentPercentage الافتراضيان كلاهما 0 (createEmptyStudy) —
                // لا يميّزان «لم يُدخَل شيء» عن «أدخل المستخدم صفراً فعلاً». targetPercentage>0
                // أو نص خطة فعلي هما الإشارتان الوحيدتان اللتان لا تظهران صدفة في دراسة بكر.
                const hasSaud = !!(saud && (saud.targetPercentage > 0 || (saud.plan || '').trim()));
                if (!hasDepts && !hasSaud) return null;
                html = `<div class="section">
                        <h3 class="section-title"><span class="section-number">${num}</span>الهيكل التنظيمي وخطة التوطين</h3>
                        <div class="section-content">${this.renderOrgStructure(orgStructure)}</div>
                    </div>`;
                break;
            }
            case 'scenarios':
                if (!(results.scenarios && Object.keys(results.scenarios).length > 0)) return null;
                html = `<div class="section">
                        <h3 class="section-title"><span class="section-number">${num}</span>مقارنة السيناريوهات</h3>
                        <div class="section-content">${this.renderScenarios(results.scenarios)}</div>
                    </div>`;
                break;
            case 'sensitivity':
                if (!(results.sensitivity && results.sensitivity.length > 0)) return null;
                html = `<div class="section">
                        <h3 class="section-title"><span class="section-number">${num}</span>تحليل الحساسية</h3>
                        <div class="section-content">
                            ${this.renderTornado(results.tornado)}
                            ${this.renderSensitivity(results.sensitivity)}
                        </div>
                    </div>`;
                break;
            case 'recommendation':
                html = `<div class="section">
                        <h3 class="section-title"><span class="section-number">${num}</span>تقييم المشروع والمخاطر (التوصية والقرار الاستثماري)</h3>
                        <div class="section-content">
                            ${this.renderFinancingDiagnostics(financingDiagnostics, fmt)}
                            <p style="font-size: 11pt; line-height: 1.9;">
                                ${state.decisionDashboard?.finalAssessment ||
                    (results.decision === 'GO'
                        ? '<strong>التوصية: المضي قدماً في المشروع.</strong><br>بناءً على التحليل المالي الشامل، تشير المؤشرات إلى جدوى المشروع.'
                        : results.decision === 'NO-GO' || results.decision === 'NOGO'
                            ? '<strong>التوصية: عدم المضي.</strong><br>المؤشرات المالية لا تحقق الحدود الدنيا. ' + ((results.decisionReasons && results.decisionReasons.length) ? 'بنود للإصلاح: ' + results.decisionReasons.join('؛ ') + '.' : '')
                            : '<strong>التوصية: مراجعة مطلوبة.</strong><br>بعض المؤشرات دون المستوى. ' + ((results.decisionReasons && results.decisionReasons.length) ? 'بنود للإصلاح: ' + results.decisionReasons.join('؛ ') + '. ' : ''))}
                            </p>
                        </div>
                    </div>`;
                break;
            default:
                return null;
        }
        return { title, html };
    }

    /** رسم أعمدة SVG داخلي (يعمل في الطباعة بلا مكتبات): الإيرادات وصافي الربح عبر السنوات. */
    static renderIncomeChart(years, lang = 'ar') {
        if (!years || years.length === 0) return '';
        const W = 640, H = 200, padX = 40, padB = 26, padT = 16;
        const vals = years.flatMap(y => [Number(y.revenue) || 0, Number(y.netIncome) || 0]);
        const maxV = Math.max(...vals, 1);
        const minV = Math.min(...vals, 0);
        const span = (maxV - minV) || 1;
        const plotH = H - padB - padT;
        const zeroY = padT + (maxV / span) * plotH;
        const groupW = (W - padX * 2) / years.length;
        const barW = Math.min(34, groupW / 2.6);
        const yOf = (v) => padT + ((maxV - v) / span) * plotH;
        const kFmt = (v) => Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1) + 'م' : Math.abs(v) >= 1e3 ? Math.round(v / 1e3) + 'ك' : String(Math.round(v));
        const bars = years.map((y, i) => {
            const cx = padX + groupW * i + groupW / 2;
            const rv = Number(y.revenue) || 0, ni = Number(y.netIncome) || 0;
            const rY = yOf(Math.max(rv, 0)), rH = Math.abs(yOf(0) - yOf(rv)) || 1;
            const nY = ni >= 0 ? yOf(ni) : zeroY, nH = Math.abs(yOf(0) - yOf(ni)) || 1;
            return `
                <rect x="${(cx - barW - 3).toFixed(1)}" y="${rY.toFixed(1)}" width="${barW}" height="${rH.toFixed(1)}" fill="#0E5B44" rx="2"/>
                <rect x="${(cx + 3).toFixed(1)}" y="${nY.toFixed(1)}" width="${barW}" height="${nH.toFixed(1)}" fill="${ni >= 0 ? '#B07D2C' : '#B4453B'}" rx="2"/>
                <text x="${cx.toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="10" fill="#666">س${y.year}</text>`;
        }).join('');
        return `<div style="margin:6px 0 14px;">
            <svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:${W}px;height:auto;direction:ltr;" role="img" aria-label="تطور الإيرادات وصافي الربح">
                <line x1="${padX}" y1="${zeroY.toFixed(1)}" x2="${W - padX}" y2="${zeroY.toFixed(1)}" stroke="#bbb" stroke-width="1"/>
                <text x="${padX}" y="${padT - 3}" font-size="10" fill="#666">${kFmt(maxV)} ريال</text>
                ${bars}
            </svg>
            <div style="font-size:9pt;color:#555;display:flex;gap:18px;justify-content:center;">
                <span><span style="display:inline-block;width:10px;height:10px;background:#0E5B44;border-radius:2px;margin-inline-end:4px;"></span>${t('revenue', lang)}</span>
                <span><span style="display:inline-block;width:10px;height:10px;background:#B07D2C;border-radius:2px;margin-inline-end:4px;"></span>${t('net_income', lang)}</span>
            </div>
        </div>`;
    }

    /**
     * تفصيل مصادر الإيراد (السنة الأولى) — إصلاح فجوة جودة بيانات: كانت قائمة الدخل
     * تعرض إجمالي الإيرادات السنوي المجمّع فقط، بينما بيانات المستخدم الخام
     * (state.revenue.streams) تتضمن تفصيلاً فعلياً لكل مصدر إيراد (عملاء شهرياً × متوسط
     * السعر) لا يظهر في التقرير النهائي إطلاقاً. لا نعرض إلا سنة أولى — لأن المحرك يطبّق
     * النمو على الإجمالي المجمّع لكل السنوات وليس لكل مصدر على حدة، فلا رقم متعدد السنوات
     * لكل مصدر بمفرده يمكن اشتقاقه دون افتراض مصطنع.
     */
    static renderRevenueStreamsBreakdown(streams) {
        const rows = (streams || []).filter(Boolean);
        if (rows.length === 0) return '';
        const streamRow = (s) => {
            const label = s.name || s.service || 'مصدر إيراد';
            const customers = Number(s.customersPerMonth) || 0;
            const price = Number(s.avgPrice) || 0;
            const yearOneRevenue = customers * 12 * price;
            return `<tr>
                <td>${escapeHtml(label)}</td>
                <td>${customers}</td>
                <td>${formatCurrency(price)}</td>
                <td>${formatCurrency(yearOneRevenue)}</td>
            </tr>`;
        };
        return `
            <h4>تفصيل مصادر الإيراد (السنة الأولى)</h4>
            <table>
                <thead><tr><th>مصدر الإيراد</th><th>العملاء شهرياً</th><th>متوسط السعر</th><th>إيراد السنة الأولى</th></tr></thead>
                <tbody>${rows.map(streamRow).join('')}</tbody>
            </table>
            <p style="font-size:9pt;color:#666;margin-top:4px;">الأرقام أعلاه لكل مصدر إيراد تمثّل السنة الأولى فقط، لأن النموذج المالي يطبّق معدل النمو السنوي على إجمالي الإيرادات المجمّع لا على كل مصدر منفرد — تفادياً لعرض رقم متعدد السنوات مفبرك لكل مصدر على حدة.</p>`;
    }

    /** منحنى التدفق النقدي التراكمي — نقطة عبور الصفر = الاسترداد البصري. */
    static renderCumulativeCashChart(cashFlow) {
        const rows = (cashFlow || []).filter(c => c && typeof c.cumulative === 'number');
        if (rows.length < 2) return '';
        const W = 640, H = 190, padX = 40, padB = 24, padT = 14;
        const vals = rows.map(r => r.cumulative);
        const maxV = Math.max(...vals, 0), minV = Math.min(...vals, 0);
        const span = (maxV - minV) || 1;
        const plotH = H - padB - padT;
        const xOf = (i) => padX + (i / (rows.length - 1)) * (W - padX * 2);
        const yOf = (v) => padT + ((maxV - v) / span) * plotH;
        const zeroY = yOf(0);
        const pts = rows.map((r, i) => `${xOf(i).toFixed(1)},${yOf(r.cumulative).toFixed(1)}`).join(' ');
        const kFmt = (v) => Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1) + 'م' : Math.abs(v) >= 1e3 ? Math.round(v / 1e3) + 'ك' : String(Math.round(v));
        const labels = rows.map((r, i) => `<text x="${xOf(i).toFixed(1)}" y="${H - 6}" text-anchor="middle" font-size="10" fill="#666">${r.year === 0 ? 'البداية' : 'س' + r.year}</text>`).join('');
        return `<div style="margin:6px 0 14px;">
            <svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:${W}px;height:auto;direction:ltr;" role="img" aria-label="التدفق النقدي التراكمي">
                <line x1="${padX}" y1="${zeroY.toFixed(1)}" x2="${W - padX}" y2="${zeroY.toFixed(1)}" stroke="#bbb" stroke-width="1" stroke-dasharray="4 3"/>
                <polyline points="${pts}" fill="none" stroke="#0E5B44" stroke-width="2.5" stroke-linejoin="round"/>
                ${rows.map((r, i) => `<circle cx="${xOf(i).toFixed(1)}" cy="${yOf(r.cumulative).toFixed(1)}" r="3.2" fill="${r.cumulative >= 0 ? '#0E5B44' : '#B4453B'}"/>`).join('')}
                <text x="${padX}" y="${padT - 2}" font-size="10" fill="#666">${kFmt(maxV)} ريال</text>
                ${labels}
            </svg>
            <div style="font-size:9pt;color:#555;text-align:center;">التدفق النقدي التراكمي — عبور خط الصفر يمثّل نقطة استرداد رأس المال</div>
        </div>`;
    }

    /** الميزانية العمومية التقديرية — جدول متعدد السنوات (الأصول = الخصوم + حقوق الملكية). */
    static renderBalanceSheets(sheets, lang = 'ar') {
        const ys = sheets || [];
        if (ys.length === 0) return '';
        const row = (label, get, opts = {}) => `<tr class="${opts.highlight ? 'financial-highlight' : ''}"><td>${label}</td>${ys.map(b => `<td>${formatCurrency(get(b) || 0)}</td>`).join('')}</tr>`;
        return `
            <table>
                <thead><tr><th>${t('item_column', lang)}</th>${ys.map(b => `<th>${yearColumnLabel(b.year, lang)}</th>`).join('')}</tr></thead>
                <tbody>
                    <tr><td colspan="${ys.length + 1}" style="background:#f3f4f0;font-weight:700;">الأصول</td></tr>
                    ${row(this._lbl(lang, 'cash', 'النقدية وما في حكمها'), b => b.assets.current.cash)}
                    ${row(this._lbl(lang, 'accounts_receivable', 'ذمم العملاء'), b => b.assets.current.accountsReceivable)}
                    ${row(this._lbl(lang, 'inventory', 'المخزون'), b => b.assets.current.inventory)}
                    ${row(t('net_fixed_assets', lang), b => b.assets.fixed.net)}
                    ${row(t('total_assets', lang), b => b.assets.total, { highlight: true })}
                    <tr><td colspan="${ys.length + 1}" style="background:#f3f4f0;font-weight:700;">الخصوم</td></tr>
                    ${row('الجزء المتداول من القرض', b => b.liabilities.current.currentPortionOfDebt)}
                    ${row(this._lbl(lang, 'long_term_liabilities', 'قرض طويل الأجل'), b => b.liabilities.longTerm.bankLoan)}
                    ${row(this._lbl(lang, 'total_liabilities', 'إجمالي الخصوم'), b => b.liabilities.total)}
                    <tr><td colspan="${ys.length + 1}" style="background:#f3f4f0;font-weight:700;">حقوق الملكية</td></tr>
                    ${row(this._lbl(lang, 'share_capital', 'رأس المال المدفوع'), b => b.equity.paidInCapital)}
                    ${row(this._lbl(lang, 'retained_earnings', 'الأرباح المحتجزة'), b => b.equity.retainedEarnings)}
                    ${row(t('total_equity', lang), b => b.equity.total)}
                    ${row('فجوة تمويل غير مغطاة', b => b.fundingGap)}
                    ${row(lang === 'en' ? `${t('total_liabilities', 'en')} and ${t('total_equity', 'en')}` : 'إجمالي الخصوم وحقوق الملكية', b => b.totalLiabilitiesAndEquity, { highlight: true })}
                </tbody>
            </table>
            <p style="font-size:9pt;color:#666;margin-top:8px;">ميزانية تقديرية مبسطة مشتقة من النموذج المالي (حقوق الملكية = إجمالي الاستثمار − التمويل البنكي).</p>`;
    }

    /**
     * سجل المخاطر: احتمال × أثر × أثر مالي مقدَّر × أفق زمني × خطة تخفيف × خطر متبقٍّ × إنذار مبكر.
     * تدقيق 2026-07-08 (ملاحظة متوسطة #31): كانت هذه الدالة تطبع 5 حقول فقط بينما
     * سجل المخاطر (RiskMatrix.js) يجمع 4 حقول تحليلية إضافية (estimatedFinancialImpact/
     * timeHorizon/residualRisk/earlyWarning) تختفي تماماً من التقرير النهائي المُصدَّر
     * رغم أن المستخدم يُدخلها فعلياً — أُضيفت هنا لتظهر في المُخرَج المدفوع نفسه.
     */
    static renderRisks(risks) {
        const lvl = (v) => v === 'high' ? '<span class="status-negative">مرتفع</span>' : v === 'low' ? '<span class="status-positive">منخفض</span>' : 'متوسط';
        const typeLabel = { operational: 'تشغيلي', financial: 'مالي', market: 'سوقي', legal: 'قانوني', technical: 'تقني' };
        const horizonLabel = { immediate: 'فوري', short: 'قصير (< سنة)', medium: 'متوسط (1-3 سنوات)', long: 'طويل (> 3 سنوات)' };
        const totalFinancialImpact = risks.reduce((sum, r) => sum + (Number(r.estimatedFinancialImpact) || 0), 0);
        return `
            <table>
                <thead><tr><th>الخطر</th><th>النوع</th><th>الاحتمال</th><th>الأثر</th><th>الأثر المالي المقدّر (ريال/سنة)</th><th>الأفق الزمني</th><th>خطة التخفيف</th><th>الخطر المتبقي</th><th>مؤشر إنذار مبكر</th></tr></thead>
                <tbody>
                    ${risks.map(r => `<tr>
                        <td>${escapeHtml(r.name || r.description || '-')}</td>
                        <td>${typeLabel[r.type] || escapeHtml(r.type || '-')}</td>
                        <td>${lvl(r.probability)}</td>
                        <td>${lvl(r.impact)}</td>
                        <td>${(r.estimatedFinancialImpact != null && r.estimatedFinancialImpact !== '') ? formatCurrency(Number(r.estimatedFinancialImpact) || 0) : '—'}</td>
                        <td>${horizonLabel[r.timeHorizon] || '—'}</td>
                        <td>${escapeHtml(r.mitigation || '—')}</td>
                        <td>${lvl(r.residualRisk)}</td>
                        <td>${escapeHtml(r.earlyWarning || '—')}</td>
                    </tr>`).join('')}
                </tbody>
                ${totalFinancialImpact > 0 ? `<tfoot><tr><td colspan="4" style="text-align:end;font-weight:600;">إجمالي الأثر المالي المقدّر (ريال/سنة)</td><td style="font-weight:700;">${formatCurrency(totalFinancialImpact)}</td><td colspan="4"></td></tr></tfoot>` : ''}
            </table>
            <p style="font-size:9pt;color:#666;margin-top:8px;">الأثر المالي المقدّر أعلاه بيان تخطيطي لكل خطر على حدة، ولا يُخصَم مباشرة من صافي القيمة الحالية — احتمالية وأثر كل خطر مُحتسبان فعلياً ضمن علاوة المخاطر المضافة لمعدل الخصم في النموذج المالي (تفادياً لاحتساب نفس الخطر مرتين).</p>`;
    }

    static renderCashFlow(cashFlow, lang = 'ar') {
        if (!cashFlow || cashFlow.length === 0) return '<p>لا توجد بيانات للتدفقات النقدية.</p>';

        // تدقيق 2026-07-09: كانت هذه الدالة تقتصر على أول 5 سنوات فقط كسقف تعسفي،
        // بينما قائمة الدخل والميزانية أعلاه/أسفلها تعرضان كل سنوات الدراسة (حتى 7) —
        // ما يجعل التدفقات النقدية لا تتطابق مع بقية التقرير لدى أي ممول أو مدقق.
        // نعرض هنا كل السنوات (باستثناء السنة صفر — الاستثمار المبدئي قبل التشغيل، وهو استبعاد مقصود).
        const displayFlows = cashFlow.filter(c => c.year > 0);

        return `
            <table>
                <thead>
                    <tr>
                        <th>${t('item_column', lang)}</th>
                        ${displayFlows.map(c => `<th>${yearColumnLabel(c.year, lang)}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>${t('net_income', lang)}</td>
                        ${displayFlows.map(c => `<td>${formatCurrency(c.netIncome)}</td>`).join('')}
                    </tr>
                    <tr>
                        <td>(+) ${this._lbl(lang, 'depreciation', 'الاستهلاك')}</td>
                        ${displayFlows.map(c => `<td>${formatCurrency(c.depreciation)}</td>`).join('')}
                    </tr>
                    <tr class="financial-highlight">
                        <td>تدفقات نقدية تشغيلية</td>
                        ${displayFlows.map(c => `<td>${formatCurrency(c.cashFlow)}</td>`).join('')}
                    </tr>
                    <tr>
                        <td>${t('cumulative_cash_flow', lang)}</td>
                        ${displayFlows.map(c => `<td class="${c.cumulative >= 0 ? 'status-positive' : 'status-negative'}">${formatCurrency(c.cumulative)}</td>`).join('')}
                    </tr>
                </tbody>
            </table>
        `;
    }

    static renderScenarios(scenarios) {
        if (!scenarios) return '';
        const labels = { 'optimistic': 'متفائل', 'pessimistic': 'متشائم', 'base': 'أساسي' };

        return `
            <table>
                <thead>
                    <tr>
                        <th>السيناريو</th>
                        <th>صافي القيمة الحالية (NPV)</th>
                        <th>العائد الداخلي (IRR)</th>
                        <th>فترة الاسترداد</th>
                        <th>نقطة التعادل</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(scenarios).map(([key, val]) => `
                        <tr>
                            <td><strong>${labels[key] || key}</strong></td>
                            <td class="${val.kpis.npv > 0 ? 'status-positive' : ''}">${formatCurrency(val.kpis.npv)}</td>
                            <td>${val.kpis.irr == null ? 'غير محقق' : (val.kpis.irr * 100).toFixed(1) + '%'}</td>
                            <td>${Number.isFinite(val.kpis.payback) && val.kpis.payback > 0 ? val.kpis.payback.toFixed(1) + ' سنة' : 'غير محقق'}</td>
                            <td>${Math.round(val.breakeven?.ordersPerDay || 0)}/يوم</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    /**
     * رسم Tornado: أشرطة أفقية HTML خالصة (تعمل في الطباعة بلا مكتبات) —
     * تُري القارئ أي متغير يهيمن على NPV فيعرف أين يركّز دقته وتفاوضه.
     */
    static renderTornado(tornado) {
        if (!Array.isArray(tornado) || tornado.length === 0) return '';
        const maxSwing = Math.max(...tornado.map(t => t.swing), 1);
        const bars = tornado.map(t => {
            const width = Math.max(4, Math.round((t.swing / maxSwing) * 100));
            return `
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:7px;">
                    <div style="width:150px; font-size:9.5pt; text-align:left; flex-shrink:0;">${t.variable}</div>
                    <div style="flex:1; background:#f1f0e9; border-radius:4px; height:18px; position:relative;">
                        <div style="width:${width}%; height:100%; background:linear-gradient(90deg, #0e5b44, #3ecf9a); border-radius:4px;"></div>
                    </div>
                    <div style="width:130px; font-size:8.5pt; color:#6C766E; flex-shrink:0;">±10% → تأرجح ${formatCurrency(t.swing)}</div>
                </div>`;
        }).join('');
        return `
            <div style="margin-bottom: 22px;">
                <h4 style="margin-bottom: 8px; color: var(--accent-blue);">المتغيرات الأكثر تأثيراً على صافي القيمة الحالية (Tornado)</h4>
                <p style="font-size: 9pt; color: #6C766E; margin-bottom: 10px;">أثر تغيّر كل متغير منفرداً بنسبة ±10% — الأعلى تأرجحاً هو ما يستحق أعلى دقة في التقدير والتفاوض.</p>
                ${bars}
            </div>`;
    }

    static renderSensitivity(sensitivity) {
        if (!sensitivity) return '';

        return sensitivity.map(dim => `
            <div style="margin-bottom: 20px;">
                <h4 style="margin-bottom: 8px; color: var(--accent-blue);">${dim.dim}</h4>
                <table>
                    <thead>
                        <tr>
                            <th>الحالة</th>
                            <th>NPV</th>
                            <th>IRR</th>
                            <th>الاسترداد</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${dim.cases.map(c => `
                            <tr>
                                <td>${c.value}</td>
                                <td>${formatCurrency(c.kpis.npv)}</td>
                                <td>${c.kpis.irr == null ? 'غير محقق' : (c.kpis.irr * 100).toFixed(1) + '%'}</td>
                                <td>${c.kpis.payback?.toFixed(1) || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `).join('');
    }

    static renderLoanSchedule(loan) {
        if (!loan || !loan.annualSummary) return '';

        return `
            <div style="margin-bottom: 20px;">
                <ul>
                    <li><strong>مبلغ القرض:</strong> ${formatCurrency(loan.loanAmount)}</li>
                    <li><strong>معدل الفائدة السنوي:</strong> ${(loan.annualRate * 100).toFixed(1)}%</li>
                    <li><strong>مدة السداد:</strong> ${loan.termYears} سنوات</li>
                    <li><strong>القسط الشهري:</strong> ${formatCurrency(loan.monthlyPayment)}</li>
                </ul>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>السنة</th>
                        <th>الرصيد الافتتاحي</th>
                        <th>إجمالي المدفوعات</th>
                        <th>الفائدة</th>
                        <th>الأصل</th>
                        <th>الرصيد المتبقي</th>
                    </tr>
                </thead>
                <tbody>
                    ${loan.annualSummary.map(y => `
                        <tr>
                            <td>السنة ${y.year}</td>
                            <td>${formatCurrency(y.beginningBalance)}</td>
                            <td>${formatCurrency(y.totalPayment)}</td>
                            <td>${formatCurrency(y.totalInterest)}</td>
                            <td>${formatCurrency(y.totalPrincipal)}</td>
                            <td>${formatCurrency(y.endingBalance)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    static renderBusinessModel(bm) {
        if (!bm || typeof bm !== 'object') {
            return '<p style="color: #a0aec0; font-style: italic;">لم يتم تعبئة نموذج العمل بعد.</p>';
        }
        const blocks = [
            { key: 'valueProposition', label: 'عرض القيمة' },
            { key: 'customerSegments', label: 'شرائح العملاء' },
            { key: 'channels', label: 'قنوات الوصول' },
            { key: 'customerRelationships', label: 'علاقات العملاء' },
            { key: 'revenueStreams', label: 'مصادر الإيرادات' },
            { key: 'keyResources', label: 'الموارد الأساسية' },
            { key: 'keyActivities', label: 'الأنشطة الأساسية' },
            { key: 'keyPartners', label: 'الشراكات الأساسية' },
            { key: 'costStructure', label: 'هيكل التكاليف' }
        ];
        const filled = blocks.filter(b => bm[b.key] && String(bm[b.key]).trim());
        if (filled.length === 0) {
            return '<p style="color: #a0aec0; font-style: italic;">لم يتم تعبئة نموذج العمل بعد.</p>';
        }
        return `
            <table style="width:100%; border-collapse: collapse; margin-top: 8px;">
                <tbody>
                    ${filled.map(b => `
                        <tr>
                            <td style="width: 140px; padding: 8px 12px; font-weight: 600; color: #4a5568; border-bottom: 1px solid #e2e8f0;">${b.label}</td>
                            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${String(bm[b.key]).trim()}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    /**
     * تدقيق 2026-07-08 (ملاحظة عالية #16): خطوة «الهيكل التنظيمي والحوكمة» كانت
     * تجمع المخطط التنظيمي (departments) وخطة التوطين (saudization) دون أن يظهر
     * أي منهما في التقرير النهائي المُصدَّر — يعرض هنا فقط ما دخله المستخدم فعلياً
     * (لا حدّ أدنى مفترض، ولا نسبة سعودة مُختلَقة عند غياب البيانات).
     */
    static renderOrgStructure(orgStructure) {
        const depts = Array.isArray(orgStructure?.departments) ? orgStructure.departments.filter(d => (d.name || '').trim()) : [];
        const saud = orgStructure?.saudization || {};
        const hasSaud = saud.targetPercentage > 0 || (saud.plan || '').trim();

        if (!depts.length && !hasSaud) {
            return '<p style="color: #a0aec0; font-style: italic;">لم يُدخَل مخطط تنظيمي أو خطة توطين بعد.</p>';
        }

        const deptsById = new Map(depts.map(d => [d.id, d]));
        const parentName = (d) => (d.parentId != null && deptsById.has(d.parentId)) ? (deptsById.get(d.parentId).name || '') : '—';

        const orgTable = depts.length ? `
            <h4 style="margin: 12px 0 6px;">المخطط التنظيمي</h4>
            <table><thead><tr><th>القسم/المنصب</th><th>المسؤول</th><th>المسؤوليات</th><th>يتبع لـ</th></tr></thead><tbody>
                ${depts.map(d => `<tr><td>${escapeHtml(d.name)}</td><td>${escapeHtml(d.head || '—')}</td><td>${escapeHtml(d.responsibilities || '—')}</td><td>${escapeHtml(parentName(d))}</td></tr>`).join('')}
            </tbody></table>
        ` : '';

        const saudTable = hasSaud ? `
            <h4 style="margin: 16px 0 6px;">خطة التوطين (السعودة)</h4>
            <table><tbody>
                ${saud.currentPercentage != null ? `<tr><td style="width:180px;font-weight:600;">النسبة الحالية</td><td>${escapeHtml(saud.currentPercentage)}%</td></tr>` : ''}
                ${saud.targetPercentage ? `<tr><td style="font-weight:600;">النسبة المستهدفة</td><td>${escapeHtml(saud.targetPercentage)}%</td></tr>` : ''}
                ${(saud.plan || '').trim() ? `<tr><td style="font-weight:600;vertical-align:top;">خطة التحقيق</td><td>${escapeHtml(saud.plan)}</td></tr>` : ''}
            </tbody></table>
        ` : '';

        return orgTable + saudTable;
    }

    static renderMarketSegments(segments) {
        const rows = (segments || []).filter(s => s && (s.name || s.segment || s.demographics || s.needs || s.size));
        if (!rows.length) return '';
        return `
            <table>
                <thead><tr><th>الشريحة</th><th>الديموغرافيا/الوصف</th><th>الاحتياج</th><th>الحجم/الأولوية</th></tr></thead>
                <tbody>
                    ${rows.map(s => `<tr>
                        <td>${escapeHtml(s.name || s.segment || '-')}</td>
                        <td>${escapeHtml(s.demographics || s.description || '-')}</td>
                        <td>${escapeHtml(s.needs || '-')}</td>
                        <td>${s.size ? formatCurrency(Number(s.size) || 0) : escapeHtml(s.priority || '-')}</td>
                    </tr>`).join('')}
                </tbody>
            </table>`;
    }

    static renderCompetitors(competitors) {
        const rows = (competitors || []).filter(c => c && (typeof c === 'string' || c.name || c.strengths || c.weaknesses));
        if (!rows.length) return '';
        return `
            <table>
                <thead><tr><th>المنافس</th><th>نقاط القوة</th><th>نقاط الضعف</th><th>الحصة/العملاء</th><th>ملاحظة</th></tr></thead>
                <tbody>
                    ${rows.map(c => {
                        if (typeof c === 'string') {
                            return `<tr><td>${escapeHtml(c)}</td><td>-</td><td>-</td><td>-</td><td>-</td></tr>`;
                        }
                        const share = c.marketShare ? `${escapeHtml(c.marketShare)}%` : '';
                        const customers = c.estimatedDailyCustomers ? `${Number(c.estimatedDailyCustomers).toLocaleString('ar-SA')} عميل/يوم` : '';
                        return `<tr>
                            <td>${escapeHtml(c.name || '-')}</td>
                            <td>${escapeHtml(c.strengths || '-')}</td>
                            <td>${escapeHtml(c.weaknesses || '-')}</td>
                            <td>${escapeHtml([share, customers].filter(Boolean).join(' - ') || '-')}</td>
                            <td>${escapeHtml(c.advantage || c.notes || '-')}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>`;
    }

    static renderAssetSchedule(assetSchedule, fmt) {
        const rows = (assetSchedule || []).filter(a => a && a.name);
        if (!rows.length) return '';
        const categoryLabels = { Equipment: 'معدات', Furniture: 'أثاث', TechResources: 'موارد تقنية', Buildings: 'مبانٍ', Vehicles: 'مركبات' };
        return `
            <h4 style="margin-top:16px;">جدول إهلاك الأصول</h4>
            <table>
                <thead><tr><th>الأصل</th><th>الفئة</th><th>الإهلاك السنوي</th><th>العمر الافتراضي</th></tr></thead>
                <tbody>
                    ${rows.map(a => `<tr>
                        <td>${escapeHtml(a.name)}</td>
                        <td>${escapeHtml(categoryLabels[a.category] || a.category || '-')}</td>
                        <td>${fmt(a.annualDepreciation || 0)}</td>
                        <td>${a.usefulLifeYears ? escapeHtml(String(a.usefulLifeYears)) + ' سنة' : '—'}</td>
                    </tr>`).join('')}
                </tbody>
            </table>`;
    }

    static renderOperatingWorkingCapital(operating, fmt) {
        if (!operating || !operating.total) return '';
        const bd = operating.breakdown || {};
        const labels = [
            ['rent', 'الإيجار'],
            ['salaries', 'الرواتب'],
            ['marketing', 'التسويق'],
            ['cogs', 'تكلفة البضاعة'],
            ['openingInventory', 'المخزون الافتتاحي']
        ];
        return `
            <h4 style="margin-top:16px;">تفصيل رأس المال العامل</h4>
            <table>
                <thead><tr><th>البند</th><th>القيمة</th></tr></thead>
                <tbody>
                    ${labels.map(([key, label]) => `<tr><td>${label}</td><td>${fmt(bd[key] || 0)}</td></tr>`).join('')}
                    <tr class="financial-highlight"><td>الإجمالي</td><td>${fmt(operating.total)}</td></tr>
                </tbody>
            </table>`;
    }

    static renderPayrollGrowth(payrollByPosition, fmt) {
        const rows = (payrollByPosition || []).filter(p => p && p.byYear?.length);
        if (!rows.length) return '';
        const nationalityLabels = { saudi: 'سعودي', expat: 'غير سعودي' };
        const maxYears = Math.max(...rows.map(r => (r.byYear || []).length));
        return `
            <h4 style="margin-top:16px;">خطة نمو الرواتب متعددة السنوات</h4>
            <table>
                <thead><tr><th>الوظيفة</th><th>الجنسية</th><th>معدل النمو المستخدم</th>${Array.from({ length: maxYears }, (_, i) => `<th>السنة ${i + 1}</th>`).join('')}</tr></thead>
                <tbody>
                    ${rows.map(p => `<tr>
                        <td>${escapeHtml(p.position || '-')}</td>
                        <td>${escapeHtml(nationalityLabels[p.nationality] || '—')}</td>
                        <td>${((Number(p.growthRateUsed) || 0) * 100).toFixed(1)}%</td>
                        ${(p.byYear || []).map(v => `<td>${fmt(v || 0)}</td>`).join('')}
                    </tr>`).join('')}
                </tbody>
            </table>`;
    }

    static renderMarketingGrowth(marketingByChannel, fmt) {
        const rows = (marketingByChannel || []).filter(c => c && c.byYear?.length);
        if (!rows.length) return '';
        const maxYears = Math.max(...rows.map(r => (r.byYear || []).length));
        return `
            <h4 style="margin-top:16px;">خطة نمو التسويق حسب القناة</h4>
            <table>
                <thead><tr><th>القناة</th><th>الحملة</th><th>معدل النمو المستخدم</th>${Array.from({ length: maxYears }, (_, i) => `<th>السنة ${i + 1}</th>`).join('')}</tr></thead>
                <tbody>
                    ${rows.map(c => `<tr>
                        <td>${escapeHtml(c.channel || '—')}</td>
                        <td>${escapeHtml(c.name || '-')}</td>
                        <td>${((Number(c.growthRateUsed) || 0) * 100).toFixed(1)}%</td>
                        ${(c.byYear || []).map(v => `<td>${fmt(v || 0)}</td>`).join('')}
                    </tr>`).join('')}
                </tbody>
            </table>`;
    }

    static renderHistoricalDemand(rows) {
        const clean = (rows || []).filter(r => r && (r.year || r.demand || r.notes));
        if (!clean.length) return '';
        return `
            <table>
                <thead><tr><th>السنة</th><th>الطلب/الحجم</th><th>ملاحظات</th></tr></thead>
                <tbody>
                    ${clean.map(r => `<tr><td>${escapeHtml(r.year || '-')}</td><td>${escapeHtml(r.demand || '-')}</td><td>${escapeHtml(r.notes || '-')}</td></tr>`).join('')}
                </tbody>
            </table>`;
    }

    static renderSupplyDemand(rows) {
        const clean = (rows || []).filter(r => r && (r.factor || r.estimatedSupply || r.estimatedDemand || r.notes));
        if (!clean.length) return '';
        const label = { opportunity: 'فرصة (الطلب أكبر من العرض)', risk: 'خطر (العرض أكبر من الطلب)', neutral: 'محايد' };
        return `
            <table>
                <thead><tr><th>العامل</th><th>العرض المقدر</th><th>الطلب المقدر</th><th>الخلاصة</th><th>ملاحظات</th></tr></thead>
                <tbody>
                    ${clean.map(r => `<tr>
                        <td>${escapeHtml(r.factor || '-')}</td>
                        <td>${escapeHtml(r.estimatedSupply || '-')}</td>
                        <td>${escapeHtml(r.estimatedDemand || '-')}</td>
                        <td>${escapeHtml(label[r.balanceConclusion] || r.balanceConclusion || '-')}</td>
                        <td>${escapeHtml(r.notes || '-')}</td>
                    </tr>`).join('')}
                </tbody>
            </table>`;
    }

    static renderLicenses(licenses) {
        const rows = (licenses || []).filter(l => l && (l.name || l.price || l.notes));
        if (!rows.length) return '';
        return `
            <table>
                <thead><tr><th>الترخيص/الرسم</th><th>الكمية</th><th>التكلفة</th><th>الإجمالي</th><th>ملاحظات/جهة الإصدار</th></tr></thead>
                <tbody>
                    ${rows.map(l => {
                        const quantity = Number(l.quantity || 1);
                        const price = Number(l.price || 0);
                        const total = Number(l.total || (quantity * price));
                        return `<tr>
                            <td>${escapeHtml(l.name || l.license || '-')}</td>
                            <td>${quantity.toLocaleString('ar-SA')}</td>
                            <td>${formatCurrency(price)}</td>
                            <td>${formatCurrency(total)}</td>
                            <td>${escapeHtml(l.notes || l.authority || '-')}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>`;
    }

    static renderAppendices(appendices) {
        const references = appendices.references || [];
        const reviewers = appendices.reviewers || [];
        const surveys = appendices.surveys || [];
        const priceQuotes = appendices.priceQuotes || [];
        const blockList = (items) => `<ul>${items.map(item => `<li>${escapeHtml(typeof item === 'string' ? item : (item.notes || item.title || item.name || JSON.stringify(item)))}</li>`).join('')}</ul>`;
        const refTable = references.length ? `
            <h4>المصادر والمراجع</h4>
            <table><thead><tr><th>العنوان</th><th>المؤلف/الناشر</th><th>السنة</th><th>ملاحظات</th></tr></thead><tbody>
                ${references.map(r => `<tr><td>${escapeHtml(r.title || '-')}</td><td>${escapeHtml([r.author, r.publisher].filter(Boolean).join(' - ') || '-')}</td><td>${escapeHtml(r.year || '-')}</td><td>${escapeHtml(r.notes || '-')}</td></tr>`).join('')}
            </tbody></table>` : '';
        const reviewerTable = reviewers.length ? `
            <h4>المراجعون والمختصون</h4>
            <table><thead><tr><th>الاسم</th><th>الدور</th><th>المؤهلات</th></tr></thead><tbody>
                ${reviewers.map(r => `<tr><td>${escapeHtml(r.name || '-')}</td><td>${escapeHtml(r.role || '-')}</td><td>${escapeHtml(r.qualifications || '-')}</td></tr>`).join('')}
            </tbody></table>` : '';
        return `
            ${appendices.investorProfile ? `<h4>نبذة المستثمر/الشركة</h4><p>${escapeHtml(appendices.investorProfile)}</p>` : ''}
            ${refTable}
            ${priceQuotes.length ? `<h4>عروض الأسعار والتقارير الفنية</h4>${blockList(priceQuotes)}` : ''}
            ${surveys.length ? `<h4>الاستبيانات والاستطلاعات</h4>${blockList(surveys)}` : ''}
            ${reviewerTable}
        `;
    }

    static renderSWOT(swot) {
        if (!swot) {
            return '<p style="color: #a0aec0; font-style: italic;">لم يتم إجراء تحليل SWOT بعد.</p>';
        }

        // Handle if swot is a string
        if (typeof swot === 'string') {
            return `<p>${swot}</p>`;
        }

        return `
            <div class="swot-table">
                <div class="swot-box strengths">
                    <h4>نقاط القوة (Strengths)</h4>
                    <ul>
                        ${(swot.strengths || ['لم يتم تحديد نقاط القوة']).map(s => `<li>${escapeHtml(s)}</li>`).join('')}
                    </ul>
                </div>
                <div class="swot-box weaknesses">
                    <h4>نقاط الضعف (Weaknesses)</h4>
                    <ul>
                        ${(swot.weaknesses || ['لم يتم تحديد نقاط الضعف']).map(s => `<li>${escapeHtml(s)}</li>`).join('')}
                    </ul>
                </div>
                <div class="swot-box opportunities">
                    <h4>الفرص (Opportunities)</h4>
                    <ul>
                        ${(swot.opportunities || ['لم يتم تحديد الفرص']).map(s => `<li>${escapeHtml(s)}</li>`).join('')}
                    </ul>
                </div>
                <div class="swot-box threats">
                    <h4>التهديدات (Threats)</h4>
                    <ul>
                        ${(swot.threats || ['لم يتم تحديد التهديدات']).map(s => `<li>${escapeHtml(s)}</li>`).join('')}
                    </ul>
                </div>
            </div>
        `;
    }

    /** تحليل PESTEL — كان يُكتَب في المعالج ولا يصل إطلاقاً إلى التقرير (تدقيق 2026-07-08) */
    static renderPESTEL(pestel) {
        const rows = Array.isArray(pestel) ? pestel.filter(f => (f.description || '').trim()) : [];
        if (!rows.length) {
            return '<p style="color: #a0aec0; font-style: italic;">لم يُدخَل تحليل PESTEL بعد.</p>';
        }
        const impactLabel = { positive: '✅ إيجابي', negative: '❌ سلبي', neutral: '➖ محايد' };
        return `
            <table><thead><tr><th>العامل</th><th>الأثر</th><th>الوصف</th></tr></thead><tbody>
                ${rows.map(f => `<tr><td>${escapeHtml(f.label || f.factor)}</td><td>${impactLabel[f.impact] || escapeHtml(f.impact || '')}</td><td>${escapeHtml(f.description)}</td></tr>`).join('')}
            </tbody></table>
        `;
    }

    /** تحليل بورتر للقوى الخمس — نفس مصير PESTEL: مكتوب ولا يظهر في التقرير */
    static renderPorter(porter) {
        if (!porter) {
            return '<p style="color: #a0aec0; font-style: italic;">لم يُدخَل تحليل بورتر بعد.</p>';
        }
        const FORCES = [
            { key: 'newEntrants', label: 'تهديد الداخلين الجدد' },
            { key: 'supplierPower', label: 'قوة الموردين' },
            { key: 'buyerPower', label: 'قوة المشترين' },
            { key: 'substitutes', label: 'تهديد البدائل' },
            { key: 'rivalry', label: 'التنافس في الصناعة' },
        ];
        const levelLabel = { low: 'منخفضة', medium: 'متوسطة', high: 'عالية' };
        const rows = FORCES.map(f => ({ ...f, data: porter[f.key] || {} })).filter(f => (f.data.description || '').trim() || f.data.level);
        if (!rows.length) {
            return '<p style="color: #a0aec0; font-style: italic;">لم يُدخَل تحليل بورتر بعد.</p>';
        }
        return `
            <table><thead><tr><th>القوة التنافسية</th><th>الشدة</th><th>الوصف</th></tr></thead><tbody>
                ${rows.map(f => `<tr><td>${f.label}</td><td>${levelLabel[f.data.level] || '—'}</td><td>${escapeHtml(f.data.description)}</td></tr>`).join('')}
            </tbody></table>
        `;
    }

    /** مصفوفة TOWS (الاستراتيجيات المُشتقة من SWOT) — مخزَّنة في marketing.towsMatrix */
    static renderTOWS(tows) {
        const QUADRANTS = [
            { key: 'so', label: 'SO — هجومية (قوة + فرص)' },
            { key: 'wo', label: 'WO — تطويرية (ضعف + فرص)' },
            { key: 'st', label: 'ST — دفاعية (قوة + تهديدات)' },
            { key: 'wt', label: 'WT — انكماشية (ضعف + تهديدات)' },
        ];
        const rows = QUADRANTS.filter(q => (tows?.[q.key] || '').trim());
        if (!rows.length) {
            return '<p style="color: #a0aec0; font-style: italic;">لم تُشتَق استراتيجيات TOWS بعد.</p>';
        }
        return `
            <div class="swot-table">
                ${rows.map(q => `<div class="swot-box"><h4>${q.label}</h4><p>${escapeHtml(tows[q.key]).replace(/\n/g, '<br>')}</p></div>`).join('')}
            </div>
        `;
    }

    /** نوع الشريك الاستراتيجي المطلوب — مصفوفة محسوبة حياً في results.partnerNeeds (partnerNeeds.js) */
    static renderPartnerNeeds(needs) {
        return `
            <table><thead><tr><th>نوع الشريك</th><th>الأولوية</th><th>السبب</th></tr></thead><tbody>
                ${needs.map(n => `<tr><td>${escapeHtml(n.label)}</td><td>${n.priority === 'high' ? 'عالية' : 'متوسطة'}</td><td>${escapeHtml(n.reason)}</td></tr>`).join('')}
            </tbody></table>
        `;
    }
}
