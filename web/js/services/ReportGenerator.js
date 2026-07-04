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
    capex: 'الاستثمارات الرأسمالية',
    income_statement: 'قائمة الدخل',
    cash_flow: 'قائمة التدفقات النقدية',
    loan_schedule: 'جدول سداد القرض',
    balance_sheet: 'الميزانية العمومية التقديرية',
    business_model: 'نموذج العمل',
    risks: 'سجل المخاطر وخطط التخفيف',
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

    static generateHTML(store) {
        const state = store.getState ? store.getState() : store.get();
        const info = state.projectInfo || {};

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

        const v = validateStudy(state);
        const validationNotice = !v.valid && v.errors?.length
            ? `<div class="validation-notice" style="background:#fef5e7;border:1px solid #f59e0b;border-radius:6px;padding:12px 20px;margin:0 20px 20px;font-size:10pt;color:#92400e;"><strong>تحذير:</strong> توجد أخطاء في صحة البيانات قد تؤثر على دقة النتائج. يُفضّل مراجعتها قبل الاعتماد على هذا التقرير.<ul style="margin:8px 0 0 20px;">${v.errors.slice(0, 3).map(e => '<li>' + e + '</li>').join('')}</ul></div>`
            : '';

        const body = this._renderBodyWithOrder(state, results, info);

        return `
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>دراسة جدوى - ${info.name || 'مشروع جديد'}</title>
                <link href="/fonts/fonts.css" rel="stylesheet">
                <style>
                    /* ═══════════════════════════════════════════════════════════════
                       PREMIUM FINANCIAL REPORT CSS - ARABIC OPTIMIZED
                       ═══════════════════════════════════════════════════════════════ */
                    
                    :root {
                        --primary-gold: #D4AF37;
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
                        border-top: 1px solid rgba(212, 175, 55, 0.3);
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
                        <h2>${info.name || 'مشروع مقترح'}</h2>
                        <div class="report-meta">
                            <div class="report-meta-item">
                                <strong>تاريخ الإعداد</strong>
                                <span>${date}</span>
                            </div>
                            <div class="report-meta-item">
                                <strong>النشاط</strong>
                                <span>${info.activity || 'غير محدد'}</span>
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
                        ${(state.consultationBookingUrl || '').trim() ? `<p style="margin-top: 8px; font-size: 9pt;"><a href="${String(state.consultationBookingUrl).replace(/"/g, '&quot;')}" target="_blank" rel="noopener">📞 احجز استشارة مع خبير</a></p>` : ''}
                        <p style="margin-top: 10px; font-size: 8pt; color: #a0aec0;">
                            هذا التقرير معد لأغراض التخطيط الداخلي. الأرقام الفعلية قد تختلف بناءً على ظروف السوق والتنفيذ.
                        </p>
                    </div>
                </div>

                <script>
                    // Auto-print after a short delay to ensure styles are loaded
                    setTimeout(() => {
                        window.print();
                    }, 500);
                </script>
            </body>
            </html>
        `;
    }

    /** يبني فهرس المحتويات وأقسام التقرير حسب ترتيب المستخدم (reportSectionOrder). */
    static _renderBodyWithOrder(state, results, info) {
        const order = (state.reportSectionOrder && state.reportSectionOrder.length)
            ? state.reportSectionOrder
            : [...DEFAULT_REPORT_SECTION_ORDER];
        const ordered = [];
        let num = 1;
        for (const id of order) {
            const out = this._renderSection(id, state, results, info, num);
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
                            ${ordered.map(o => `<li>${o.title}</li>`).join('')}
                        </ol>
                    </div>`;
        const sectionsHtml = ordered.map(o => o.html).join('\n                    ');
        return { tocHtml, sectionsHtml };
    }

    /** يُرجع قسماً واحداً من التقرير أو null إن كان اختيارياً ولا توجد بيانات. */
    static _renderSection(id, state, results, info, num) {
        const title = REPORT_SECTION_LABELS[id] || id;
        const fmt = (v) => formatCurrency(v, state.assumptions?.currency || 'SAR');
        let html = '';
        switch (id) {
            case 'executive_summary': {
                // بطاقة أرقام بارزة تُشتق من نتائج المحرك — الملخص التنفيذي يقدّم القرار والأرقام أولاً
                const exIn = results.indicators || {};
                const exDecision = results.decision === 'GO' ? '<span class="status-positive">المضي قدماً (GO)</span>'
                    : (results.decision === 'NO-GO' || results.decision === 'NOGO') ? '<span class="status-negative">عدم المضي (NO-GO)</span>'
                    : results.decision === 'REVISE' ? '<span style="color:#b45309;font-weight:700;">مراجعة مطلوبة (REVISE)</span>' : '—';
                const exHighlights = `
                            <table style="margin-bottom:14px;"><thead><tr>
                                <th>الاستثمار المطلوب</th><th>NPV</th><th>IRR</th><th>الاسترداد</th><th>التوصية</th>
                            </tr></thead><tbody><tr>
                                <td><strong>${fmt(results.capex?.total || 0)}</strong></td>
                                <td class="${(exIn.npv || 0) > 0 ? 'status-positive' : 'status-negative'}">${fmt(exIn.npv || 0)}</td>
                                <td>${((exIn.irr || 0) * 100).toFixed(1)}%</td>
                                <td>${exIn.paybackPeriod ? exIn.paybackPeriod.toFixed(1) + ' سنة' : '—'}</td>
                                <td>${exDecision}</td>
                            </tr></tbody></table>`;
                html = `<div class="section">
                        <h3 class="section-title"><span class="section-number">${num}</span>الملخص التنفيذي</h3>
                        <div class="section-content">
                            ${exHighlights}
                            <p>${state.executiveSummary?.aiGeneratedText || `يعرض هذا التقرير دراسة جدوى مشروع «${info.name || 'المشروع'}»${info.city ? ' في ' + info.city : ''}، شاملةً الجوانب الفنية والتسويقية والمالية، مع تحليل حساسية وسيناريوهات وقرار استثماري مبني على مؤشرات مالية محسوبة من مدخلات الدراسة.`}</p>
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
                            <table style="width:100%; border-collapse:collapse; margin-top:8px;"><thead><tr><th>اسم الفكرة</th><th>تكلفة تقريبية</th><th>عائد متوقع/سنة</th><th>ملاحظة</th></tr></thead><tbody>
                            ${(state.projectAlternatives.ideas || []).map(idea => `<tr><td>${(idea.name || '-')}</td><td>${new Intl.NumberFormat('ar-SA').format(idea.estimatedCost ?? 0)}</td><td>${new Intl.NumberFormat('ar-SA').format(idea.estimatedReturn ?? 0)}</td><td>${(idea.notes || '-')}</td></tr>`).join('')}
                            </tbody></table>
                            ${state.projectAlternatives.selectedIndex != null && state.projectAlternatives.ideas?.[state.projectAlternatives.selectedIndex] ? `<p style="margin-top:12px;"><strong>الفكرة المختارة للمتابعة:</strong> ${(state.projectAlternatives.ideas[state.projectAlternatives.selectedIndex].name || '-')}</p>` : ''}
                        </div>
                    </div>`;
                break;
            case 'project_info':
                html = `<div class="section">
                        <h3 class="section-title"><span class="section-number">${num}</span>معلومات المشروع الأساسية</h3>
                        <div class="section-content">
                            <ul>
                                <li><strong>اسم المشروع:</strong> ${info.name || '-'}</li>
                                <li><strong>النشاط التجاري:</strong> ${info.concept || info.activity || '-'}</li>
                                <li><strong>الموقع:</strong> ${info.city || info.location || '-'} ${info.district ? '، ' + info.district : ''}</li>
                                <li><strong>الهوية:</strong> ${(info.identityStatement || '-').toString().slice(0, 200)}${(info.identityStatement || '').length > 200 ? '...' : ''}</li>
                                <li><strong>القيمة المقترحة:</strong> ${(info.valueProposition || '-').toString().slice(0, 200)}${(info.valueProposition || '').length > 200 ? '...' : ''}</li>
                            </ul>
                            ${(info.dataGatheringChecklist || []).length > 0 ? `<h4 style="margin-top:16px;">خطوات جمع المعلومات (زيارات ميدانية)</h4><table style="margin-top:8px;"><thead><tr><th>الخطوة</th><th>تم؟</th><th>ملاحظات</th></tr></thead><tbody>${(info.dataGatheringChecklist || []).map(c => `<tr><td>${(c.step || '-')}</td><td>${c.done ? 'نعم' : 'لا'}</td><td>${(c.notes || '-')}</td></tr>`).join('')}</tbody></table>` : ''}
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
                const comps = (state.marketing?.competitors || []).map(c => typeof c === 'string' ? c : (c.name || '')).filter(Boolean);
                if (comps.length) mRows.push(['المنافسون الرئيسيون', comps.join('؛ ')]);
                const loc = info.locationAnalysis?.address || info.city;
                if (loc) mRows.push(['الموقع والوصول', loc]);
                if (state.marketing?.marketingMix?.price) mRows.push(['استراتيجية التسعير', state.marketing.marketingMix.price]);
                if (mRows.length === 0) return null;
                html = `<div class="section">
                        <h3 class="section-title"><span class="section-number">${num}</span>تحليل السوق</h3>
                        <div class="section-content">
                            <table style="width:100%; border-collapse:collapse;">
                                ${mRows.map(([k, v]) => `<tr><td style="padding:8px 0; vertical-align:top; width:28%;"><strong>${k}</strong></td><td style="padding:8px 0;">${v}</td></tr>`).join('')}
                            </table>
                        </div>
                    </div>`;
                break;
            }
            case 'intro_feasibility':
                if (!(state.keyPeople?.keyPeople?.length > 0 || info.products?.length > 0 || info.introServices?.length > 0 || info.customerValues?.length > 0 || info.locationAnalysis?.selectionFactors || info.investorProfile || (info.startupHypothesis?.problem || info.startupHypothesis?.solution) || (info.unfairAdvantage?.types?.length > 0 || info.unfairAdvantage?.insightText))) return null;
                html = `<div class="section">
                        <h3 class="section-title"><span class="section-number">${num}</span>مقدمة الجدوى</h3>
                        <div class="section-content">
                            ${state.keyPeople?.keyPeople?.length > 0 ? `<h4 style="margin-bottom:8px;">الأشخاص الرئيسون</h4><table style="margin-bottom:16px;"><thead><tr><th>الاسم</th><th>الدور</th><th>الخبرة</th></tr></thead><tbody>${(state.keyPeople.keyPeople || []).map(p => `<tr><td>${(p.name || '-')}</td><td>${(p.role || '-')}</td><td>${(p.experience || '-')}</td></tr>`).join('')}</tbody></table>` : ''}
                            ${info.products?.length > 0 ? `<h4 style="margin-bottom:8px;">المنتجات</h4><table style="margin-bottom:12px;"><thead><tr><th>النوع</th><th>المنتج</th><th>الوصف</th></tr></thead><tbody>${(info.products || []).map(p => `<tr><td>${p.type === 'primary' ? 'أولي' : p.type === 'semi' ? 'نصف مصنع' : 'نهائي'}</td><td>${(p.name || '-')}</td><td>${(p.description || '-')}</td></tr>`).join('')}</tbody></table>` : ''}
                            ${(info.startupHypothesis?.problem || info.startupHypothesis?.solution || info.unfairAdvantage?.insightText) ? `<h4 style="margin-bottom:8px;">الفرضية وتقييم الفكرة</h4><ul>${info.startupHypothesis?.problem ? `<li><strong>المشكلة:</strong> ${String(info.startupHypothesis.problem).replace(/</g, '&lt;')}</li>` : ''}${info.startupHypothesis?.solution ? `<li><strong>الحل:</strong> ${String(info.startupHypothesis.solution).replace(/</g, '&lt;')}</li>` : ''}${info.unfairAdvantage?.insightText ? `<li><strong>الاستبصار:</strong> ${String(info.unfairAdvantage.insightText).replace(/</g, '&lt;')}</li>` : ''}</ul>` : ''}
                        </div>
                    </div>`;
                break;
            case 'marketing':
                if (!((state.marketSizing?.vision2030?.alignment) || (state.marketSizing?.nationalEconomy?.gdpGrowth) || (state.marketing?.marketingMix?.product) || (state.marketing?.marketAnalysis?.historicalData || []).length > 0 || (state.marketing?.supplyDemandBalance || []).length > 0 || (state.marketing?.marketAnalysis?.demandElasticity))) return null;
                html = `<div class="section">
                        <h3 class="section-title"><span class="section-number">${num}</span>الدراسة التسويقية</h3>
                        <div class="section-content">
                            ${state.marketSizing?.vision2030?.alignment ? `<h4>مواءمة رؤية 2030</h4><p>${(state.marketSizing.vision2030.alignment || '')}</p>` : ''}
                            ${(state.marketing?.marketingMix?.product || state.marketing?.marketingMix?.price) ? `<h4>المزيج التسويقي (4P)</h4><ul><li><strong>المنتج:</strong> ${(state.marketing?.marketingMix?.product || '-')}</li><li><strong>السعر:</strong> ${(state.marketing?.marketingMix?.price || '-')}</li></ul>` : ''}
                        </div>
                    </div>`;
                break;
            case 'financial_kpis':
                html = `<div class="section">
                        <h3 class="section-title"><span class="section-number">${num}</span>الدراسة المالية (المؤشرات الرئيسية)</h3>
                        <div class="section-content">
                            <div class="kpi-grid">
                                <div class="kpi-card"><div class="kpi-label">صافي القيمة الحالية</div><div class="kpi-value ${(results.indicators?.npv || 0) > 0 ? 'positive' : 'negative'}">${formatCurrency(results.indicators?.npv || 0)}</div></div>
                                <div class="kpi-card"><div class="kpi-label">معدل العائد الداخلي (IRR)</div><div class="kpi-value ${(results.indicators?.irr || 0) > 0.15 ? 'positive' : ''}">${((results.indicators?.irr || 0) * 100).toFixed(1)}%</div></div>
                                <div class="kpi-card"><div class="kpi-label">فترة الاسترداد</div><div class="kpi-value">${(results.indicators?.paybackPeriod || 0).toFixed(1)} سنة</div></div>
                                <div class="kpi-card"><div class="kpi-label">نقطة التعادل</div><div class="kpi-value">${results.indicators?.breakEvenPointValue != null ? formatCurrency(results.indicators.breakEvenPointValue) : (results.indicators?.breakevenUnitsPerMonth != null ? Math.round(results.indicators.breakevenUnitsPerMonth) + ' وحدة/شهر' : '—')}</div></div>
                                <div class="kpi-card"><div class="kpi-label">نسبة تغطية خدمة الدين (DSCR)</div><div class="kpi-value">${results.indicators?.dscr != null ? (results.indicators.dscr.toFixed(2) + 'x') : '—'}</div></div>
                            </div>
                            <table><thead><tr><th>المؤشر المالي</th><th>القيمة</th><th>التقييم</th></tr></thead><tbody>
                                <tr><td>صافي القيمة الحالية</td><td>${formatCurrency(results.indicators?.npv || 0)}</td><td class="${(results.indicators?.npv || 0) > 0 ? 'status-positive' : 'status-negative'}">${(results.indicators?.npv || 0) > 0 ? '✓ موجب' : '✗ سالب'}</td></tr>
                                <tr><td>معدل العائد الداخلي</td><td>${((results.indicators?.irr || 0) * 100).toFixed(2)}%</td><td>${(results.indicators?.irr || 0) > 0.15 ? '✓ مرتفع' : 'متوسط'}</td></tr>
                                <tr><td>فترة الاسترداد</td><td>${(results.indicators?.paybackPeriod || 0).toFixed(1)} سنة</td><td>${(results.indicators?.paybackPeriod || 999) < 3 ? 'سريع' : 'طويل نسبياً'}</td></tr>
                            </tbody></table>
                        </div>
                    </div>`;
                break;
            case 'swot':
                html = `<div class="section">
                        <h3 class="section-title"><span class="section-number">${num}</span>التحليل الاستراتيجي (التحليل الرباعي)</h3>
                        <div class="section-content">${this.renderSWOT(state.strategic?.swot || state.strategicAnalysis?.swot)}</div>
                    </div>`;
                break;
            case 'capex':
                html = `<div class="section">
                        <h3 class="section-title"><span class="section-number">${num}</span>الدراسة الفنية (التكاليف الاستثمارية)</h3>
                        <div class="section-content">
                            <table><thead><tr><th>بند التكلفة</th><th>القيمة التقديرية</th></tr></thead><tbody>
                                <tr><td>التجهيزات والمعدات</td><td>${formatCurrency(results.capex?.subtotal || 0)}</td></tr>
                                <tr><td>مصاريف التأسيس والتراخيص</td><td>${formatCurrency(results.capex?.items?.filter(i => i.category === 'legal').reduce((s, x) => s + x.amount, 0) || 0)}</td></tr>
                                <tr><td>رأس المال العامل</td><td>${formatCurrency(results.capex?.workingCapital || 0)}</td></tr>
                                <tr class="financial-highlight"><td>إجمالي الاستثمار المطلوب</td><td>${formatCurrency(results.capex?.total || 0)}</td></tr>
                            </tbody></table>
                        </div>
                    </div>`;
                break;
            case 'income_statement': {
                // قائمة دخل كاملة لكل سنوات الدراسة (كانت تعرض السنة الأولى فقط وتُهمل الباقي)
                const isYears = (results.incomeStatement || []).slice(0, 7);
                if (isYears.length === 0) return null;
                const isRow = (label, key, opts = {}) => `<tr class="${opts.highlight ? 'financial-highlight' : ''}"><td>${label}</td>${isYears.map(y => `<td>${formatCurrency(y[key] || 0)}</td>`).join('')}</tr>`;
                html = `<div class="section">
                        <h3 class="section-title"><span class="section-number">${num}</span>قائمة الدخل التقديرية (${isYears.length} سنوات)</h3>
                        <div class="section-content">
                            ${this.renderIncomeChart(isYears)}
                            <table><thead><tr><th>البند</th>${isYears.map(y => `<th>السنة ${y.year}</th>`).join('')}</tr></thead><tbody>
                                ${isRow('إجمالي الإيرادات', 'revenue')}
                                ${isRow('(-) التكاليف المتغيرة', 'variableCosts')}
                                ${isRow('(=) مجمل الربح', 'grossProfit')}
                                ${isRow('(-) المصاريف التشغيلية الثابتة', 'fixedCosts')}
                                ${isRow('(=) الربح قبل الفوائد والإهلاك (EBITDA)', 'ebitda')}
                                ${isRow('(-) الاستهلاك والإطفاء', 'depreciation')}
                                ${isRow('(-) الفوائد', 'interest')}
                                ${isRow('(-) الزكاة', 'zakat')}
                                ${isRow('(=) صافي الربح', 'netIncome', { highlight: true })}
                            </tbody></table>
                        </div>
                    </div>`;
                break;
            }
            case 'cash_flow':
                html = `<div class="section">
                        <h3 class="section-title"><span class="section-number">${num}</span>الدراسة المالية (قائمة التدفقات النقدية)</h3>
                        <div class="section-content">
                            ${this.renderCumulativeCashChart(results.cashFlow || [])}
                            ${this.renderCashFlow(results.cashFlow || [])}
                        </div>
                    </div>`;
                break;
            case 'balance_sheet': {
                if (!(results.balanceSheets && results.balanceSheets.length > 0)) return null;
                html = `<div class="section">
                        <h3 class="section-title"><span class="section-number">${num}</span>الميزانية العمومية التقديرية</h3>
                        <div class="section-content">${this.renderBalanceSheets(results.balanceSheets)}</div>
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
                        <div class="section-content">${this.renderSensitivity(results.sensitivity)}</div>
                    </div>`;
                break;
            case 'recommendation':
                html = `<div class="section">
                        <h3 class="section-title"><span class="section-number">${num}</span>تقييم المشروع والمخاطر (التوصية والقرار الاستثماري)</h3>
                        <div class="section-content">
                            <p style="font-size: 11pt; line-height: 1.9;">
                                ${state.decisionDashboard?.finalAssessment ||
                    (results.decision === 'GO'
                        ? '<strong>التوصية: المضي قدماً في المشروع (GO).</strong><br>بناءً على التحليل المالي الشامل، تشير المؤشرات إلى جدوى المشروع.'
                        : results.decision === 'NO-GO' || results.decision === 'NOGO'
                            ? '<strong>التوصية: عدم المضي (NO-GO).</strong><br>المؤشرات المالية لا تحقق الحدود الدنيا. ' + ((results.decisionReasons && results.decisionReasons.length) ? 'بنود للإصلاح: ' + results.decisionReasons.join('؛ ') + '.' : '')
                            : '<strong>التوصية: مراجعة مطلوبة (REVISE).</strong><br>بعض المؤشرات دون المستوى. ' + ((results.decisionReasons && results.decisionReasons.length) ? 'بنود للإصلاح: ' + results.decisionReasons.join('؛ ') + '. ' : ''))}
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
    static renderIncomeChart(years) {
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
                <span><span style="display:inline-block;width:10px;height:10px;background:#0E5B44;border-radius:2px;margin-inline-end:4px;"></span>الإيرادات</span>
                <span><span style="display:inline-block;width:10px;height:10px;background:#B07D2C;border-radius:2px;margin-inline-end:4px;"></span>صافي الربح</span>
            </div>
        </div>`;
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
    static renderBalanceSheets(sheets) {
        const ys = (sheets || []).slice(0, 7);
        if (ys.length === 0) return '';
        const row = (label, get, opts = {}) => `<tr class="${opts.highlight ? 'financial-highlight' : ''}"><td>${label}</td>${ys.map(b => `<td>${formatCurrency(get(b) || 0)}</td>`).join('')}</tr>`;
        return `
            <table>
                <thead><tr><th>البند</th>${ys.map(b => `<th>السنة ${b.year}</th>`).join('')}</tr></thead>
                <tbody>
                    <tr><td colspan="${ys.length + 1}" style="background:#f3f4f0;font-weight:700;">الأصول</td></tr>
                    ${row('النقدية وما في حكمها', b => b.assets.current.cash)}
                    ${row('صافي الأصول الثابتة', b => b.assets.fixed.net)}
                    ${row('إجمالي الأصول', b => b.assets.total, { highlight: true })}
                    <tr><td colspan="${ys.length + 1}" style="background:#f3f4f0;font-weight:700;">الخصوم</td></tr>
                    ${row('الجزء المتداول من القرض', b => b.liabilities.current.currentPortionOfDebt)}
                    ${row('قرض طويل الأجل', b => b.liabilities.longTerm.bankLoan)}
                    ${row('إجمالي الخصوم', b => b.liabilities.total)}
                    <tr><td colspan="${ys.length + 1}" style="background:#f3f4f0;font-weight:700;">حقوق الملكية</td></tr>
                    ${row('رأس المال المدفوع', b => b.equity.paidInCapital)}
                    ${row('الأرباح المحتجزة', b => b.equity.retainedEarnings)}
                    ${row('إجمالي حقوق الملكية', b => b.equity.total)}
                    ${row('إجمالي الخصوم وحقوق الملكية', b => b.totalLiabilitiesAndEquity, { highlight: true })}
                </tbody>
            </table>
            <p style="font-size:9pt;color:#666;margin-top:8px;">ميزانية تقديرية مبسطة مشتقة من النموذج المالي (حقوق الملكية = إجمالي الاستثمار − التمويل البنكي).</p>`;
    }

    /** سجل المخاطر: احتمال × أثر × خطة تخفيف. */
    static renderRisks(risks) {
        const lvl = (v) => v === 'high' ? '<span class="status-negative">مرتفع</span>' : v === 'low' ? '<span class="status-positive">منخفض</span>' : 'متوسط';
        const typeLabel = { operational: 'تشغيلي', financial: 'مالي', market: 'سوقي', legal: 'قانوني', technical: 'تقني' };
        return `
            <table>
                <thead><tr><th>الخطر</th><th>النوع</th><th>الاحتمال</th><th>الأثر</th><th>خطة التخفيف</th></tr></thead>
                <tbody>
                    ${risks.map(r => `<tr>
                        <td>${(r.name || r.description || '-')}</td>
                        <td>${typeLabel[r.type] || r.type || '-'}</td>
                        <td>${lvl(r.probability)}</td>
                        <td>${lvl(r.impact)}</td>
                        <td>${(r.mitigation || '—')}</td>
                    </tr>`).join('')}
                </tbody>
            </table>`;
    }

    static renderCashFlow(cashFlow) {
        if (!cashFlow || cashFlow.length === 0) return '<p>لا توجد بيانات للتدفقات النقدية.</p>';

        // Take first 5 years if more exist
        const displayFlows = cashFlow.filter(c => c.year > 0).slice(0, 5);

        return `
            <table>
                <thead>
                    <tr>
                        <th>البند</th>
                        ${displayFlows.map(c => `<th>السنة ${c.year}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>صافي الربح</td>
                        ${displayFlows.map(c => `<td>${formatCurrency(c.netIncome)}</td>`).join('')}
                    </tr>
                    <tr>
                        <td>(+) الاستهلاك</td>
                        ${displayFlows.map(c => `<td>${formatCurrency(c.depreciation)}</td>`).join('')}
                    </tr>
                    <tr class="financial-highlight">
                        <td>تدفقات نقدية تشغيلية</td>
                        ${displayFlows.map(c => `<td>${formatCurrency(c.cashFlow)}</td>`).join('')}
                    </tr>
                    <tr>
                        <td>التدفق النقدي التراكمي</td>
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
                            <td>${(val.kpis.irr * 100).toFixed(1)}%</td>
                            <td>${val.kpis.payback?.toFixed(1) || '-'} سنة</td>
                            <td>${Math.round(val.breakeven?.ordersPerDay || 0)}/يوم</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
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
                                <td>${(c.kpis.irr * 100).toFixed(1)}%</td>
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
                        ${(swot.strengths || ['لم يتم تحديد نقاط القوة']).map(s => `<li>${s}</li>`).join('')}
                    </ul>
                </div>
                <div class="swot-box weaknesses">
                    <h4>نقاط الضعف (Weaknesses)</h4>
                    <ul>
                        ${(swot.weaknesses || ['لم يتم تحديد نقاط الضعف']).map(s => `<li>${s}</li>`).join('')}
                    </ul>
                </div>
                <div class="swot-box opportunities">
                    <h4>الفرص (Opportunities)</h4>
                    <ul>
                        ${(swot.opportunities || ['لم يتم تحديد الفرص']).map(s => `<li>${s}</li>`).join('')}
                    </ul>
                </div>
                <div class="swot-box threats">
                    <h4>التهديدات (Threats)</h4>
                    <ul>
                        ${(swot.threats || ['لم يتم تحديد التهديدات']).map(s => `<li>${s}</li>`).join('')}
                    </ul>
                </div>
            </div>
        `;
    }
}
