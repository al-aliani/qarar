/**
 * نسخة احترافية للمراجعة — مكاتب استشارات (Big4 عربي)
 * هيكل أقسام مرقّم، فهرس، بدون إعلانات، إخلاء مسؤولية: "هذه المسودة قابلة للمراجعة من قبل جهة مستقلة."
 * ترتيب الأقسام: يُطبَّق state.reportSectionOrder عند وجوده (المهمة 67 — توحيد مع ReportGenerator/BankReportGenerator).
 */
import { formatCurrency } from '../js/utils/formatters.js';
import { calculateStudy as runFullModel } from '../js/core/engine.js';
import { getLabelSDB } from '../js/core/regulatoryLabels.js';
import { BankReportGenerator } from './BankReportGenerator.js';
import { SAFE } from './utils.js';
import { escapeHtml } from '../js/utils/escape.js';

function L(key) {
    try { return getLabelSDB(key) || key; } catch (_) { return key; }
}

/** أقسام نسخة المراجعة الاحترافية (معرّفات قابلة للربط مع reportSectionOrder). */
const PRO_REVIEW_SECTION_IDS = [
    'executive_summary',
    'methodology',
    'financial',
    'risks',
    'appendices'
];

const PRO_REVIEW_SECTION_TITLES = {
    executive_summary: 'الملخص التنفيذي',
    methodology: 'المنهجية',
    financial: 'الجانب المالي',
    risks: 'تحليل المخاطر',
    appendices: 'الملاحق'
};

export class ProfessionalReviewReportGenerator {

    static generateHTML(store) {
        const state = store.getState ? store.getState() : store.get();
        const info = state.projectInfo || {};
        let results;
        try {
            results = runFullModel(state);
            if (store && typeof store.update === 'function') store.update('results', results);
        } catch (e) {
            results = state.results || {};
        }

        const date = new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
        const currency = state.assumptions?.currency || 'SAR';
        const _fmt = (v) => formatCurrency(v, currency);
        const ind = results.indicators || {};
        const cap = results.capex || {};
        const loan = results.loanSchedule || {};
        const incomeY1 = results.incomeStatement?.[0];
        const financing = state.financing || {};
        const risks = (state.riskAnalysis?.risks || []).slice(0, 8);

        const finalOrder = this._getProReviewSectionOrder(state);
        const toc = finalOrder.map((id, i) => ({
            id: `sec${i + 1}`,
            num: ['١', '٢', '٣', '٤', '٥', '٦', '٧'][i] || String(i + 1),
            title: PRO_REVIEW_SECTION_TITLES[id] || id
        }));

        const execText = state.executiveSummary?.projectOverview || state.executiveSummary?.aiGeneratedText
            || `يهدف مشروع «${info.name || 'المشروع'}» إلى ${info.concept || 'تنفيذ نشاط تجاري'} في ${info.city || 'الموقع المحدد'}. تم إعداد هذه الدراسة وفق منهجيات احترافية قابلة للمراجعة من قبل جهة مستقلة.`;

        const methodologyText = `اعتمدت الدراسة على: (أ) افتراضات مالية من مقدم الطلب ومراجع داخلية، (ب) معايير تقييم استثمارية (صافي القيمة الحالية، معدل العائد الداخلي، فترة الاسترداد، نقطة التعادل)، (ج) نطاق الدراسة يشمل الجانب المالي والتشغيلي والمخاطر. هذه المسودة قابلة للمراجعة والتدقيق من قبل جهة مستقلة.`;

        const recommendationHtml = BankReportGenerator._renderRecommendation(results);

        const appendixRows = [];
        if (state.keyPeople?.keyPeople?.length) {
            state.keyPeople.keyPeople.slice(0, 3).forEach((p, i) => {
                appendixRows.push(`<tr><td>${i + 1}</td><td>${escapeHtml(p.name || '—')}</td><td>${escapeHtml(p.role || '—')}</td><td>${escapeHtml(p.email || '—')}</td></tr>`);
            });
        }
        const appendixTable = appendixRows.length
            ? `<table class="pr-table"><tr><th>#</th><th>الاسم</th><th>الدور</th><th>البريد</th></tr>${appendixRows.join('')}</table>`
            : '<p>لم تُدرج بيانات فريق أو ملاحق إضافية. يمكن إضافتها يدوياً بعد المراجعة.</p>';

        const sectionsHtml = finalOrder
            .map((id, i) => this._renderProReviewSection(id, state, results, info, financing, ind, cap, incomeY1, risks, recommendationHtml, appendixTable, i + 1, _fmt, L))
            .filter(Boolean)
            .join('\n        ');

        return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>نسخة للمراجعة — ${escapeHtml(info.name || 'مشروع مقترح')} — دراسة جدوى</title>
    <link href="/fonts/fonts.css" rel="stylesheet">
    <style>
        :root { --gold: #C9A227; --dark: #1a365d; --blue: #2c5282; --green: #276749; --red: #c53030; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page { size: A4; margin: 2cm; }
        body { font-family: 'IBM Plex Sans Arabic', sans-serif; font-size: 11pt; line-height: 1.6; color: #1a202c; background: #fff; }
        .pr-container { max-width: 21cm; margin: 0 auto; padding: 24px; }
        .pr-header { text-align: center; padding: 20px 0; border-bottom: 3px solid var(--gold); margin-bottom: 20px; }
        .pr-header h1 { font-size: 20pt; color: var(--dark); margin-bottom: 8px; }
        .pr-header h2 { font-size: 13pt; color: #4a5568; font-weight: 500; }
        .pr-disclaimer { background: #f0f4f8; border: 1px solid #2c5282; padding: 12px 20px; margin: 16px 0; text-align: center; font-size: 10pt; font-weight: 600; color: #1a365d; border-radius: 6px; }
        .pr-toc { margin: 24px 0; padding: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; }
        .pr-toc h3 { font-size: 12pt; color: var(--blue); margin-bottom: 12px; }
        .pr-toc ol { list-style: none; padding: 0; }
        .pr-toc li { margin: 8px 0; }
        .pr-toc a { color: var(--dark); text-decoration: none; }
        .pr-toc a:hover { text-decoration: underline; color: var(--blue); }
        .pr-section { margin-bottom: 28px; page-break-inside: avoid; }
        .pr-section-title { font-size: 14pt; font-weight: 700; color: var(--blue); padding: 10px 0; border-bottom: 2px solid var(--gold); margin-bottom: 12px; }
        .pr-table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 10pt; }
        .pr-table th, .pr-table td { padding: 10px 14px; text-align: right; border: 1px solid #e2e8f0; }
        .pr-table th { background: var(--dark); color: #fff; font-weight: 600; }
        .pr-table .total-row { background: #edf2f7; font-weight: 700; }
        .pr-kpi { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0; }
        .pr-kpi-card { background: #f7fafc; border-right: 4px solid var(--gold); padding: 14px; border-radius: 6px; text-align: center; }
        .pr-kpi-card .label { font-size: 9pt; color: #718096; }
        .pr-kpi-card .value { font-size: 14pt; font-weight: 700; color: var(--blue); }
        .pr-recommendation { padding: 16px; background: #f0fff4; border: 1px solid #9ae6b4; border-radius: 6px; margin: 16px 0; }
        .pr-recommendation.no-go { background: #fff5f5; border-color: #feb2b2; }
        .pr-recommendation.revise { background: #fffbeb; border-color: #fbd38d; }
        .pr-footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 9pt; color: #718096; }
        @media print { .pr-section { page-break-inside: avoid; } }
    </style>
</head>
<body>
    <div class="pr-container">
        <div class="pr-header">
            <h1>نسخة احترافية للمراجعة</h1>
            <h2>${escapeHtml(info.name || 'مشروع مقترح')}</h2>
            <p style="margin-top:10px;font-size:10pt;color:#718096;">دراسة جدوى اقتصادية | ${date}</p>
        </div>

        <div class="pr-disclaimer">هذه المسودة قابلة للمراجعة من قبل جهة مستقلة.</div>

        <div class="pr-toc" id="toc">
            <h3>فهرس المحتويات</h3>
            <ol>
                ${toc.map(t => `<li><a href="#${t.id}">${t.num}. ${t.title}</a></li>`).join('')}
            </ol>
        </div>

        ${sectionsHtml}

        <div class="pr-footer">
            <p>هذه المسودة قابلة للمراجعة من قبل جهة مستقلة. تم إنشاؤها بواسطة محاكي الجدوى — بدون إعلانات. © ${new Date().getFullYear()}</p>
        </div>
    </div>
</body>
</html>`;
    }

    /** ترتيب أقسام نسخة المراجعة: يتبع reportSectionOrder إن وُجد، مع إلحاق أي قسم غير مذكور. */
    static _getProReviewSectionOrder(state) {
        const userOrder = (state.reportSectionOrder && state.reportSectionOrder.length) ? state.reportSectionOrder : [];
        const ordered = userOrder.filter(id => PRO_REVIEW_SECTION_IDS.includes(id));
        for (const id of PRO_REVIEW_SECTION_IDS) {
            if (!ordered.includes(id)) ordered.push(id);
        }
        return ordered;
    }

    /** يُرجع HTML لقسم واحد من نسخة المراجعة الاحترافية. */
    static _renderProReviewSection(id, state, results, info, financing, ind, cap, incomeY1, risks, recommendationHtml, appendixTable, num, _fmt, L) {
        const n = ['١', '٢', '٣', '٤', '٥', '٦', '٧'][num - 1] || String(num);
        const title = PRO_REVIEW_SECTION_TITLES[id] || id;
        const secId = `sec${num}`;
        switch (id) {
            case 'executive_summary': {
                const execText = state.executiveSummary?.projectOverview || state.executiveSummary?.aiGeneratedText
                    || `يهدف مشروع «${info.name || 'المشروع'}» إلى ${info.concept || 'تنفيذ نشاط تجاري'} في ${info.city || 'الموقع المحدد'}. تم إعداد هذه الدراسة وفق منهجيات احترافية قابلة للمراجعة من قبل جهة مستقلة.`;
                return `<section class="pr-section" id="${secId}">
            <div class="pr-section-title">${n}. ${title}</div>
            <p>${escapeHtml(execText || '')}</p>
        </section>`;
            }
            case 'methodology': {
                const methodologyText = `اعتمدت الدراسة على: (أ) افتراضات مالية من مقدم الطلب ومراجع داخلية، (ب) معايير تقييم استثمارية (صافي القيمة الحالية، معدل العائد الداخلي، فترة الاسترداد، نقطة التعادل)، (ج) نطاق الدراسة يشمل الجانب المالي والتشغيلي والمخاطر. هذه المسودة قابلة للمراجعة والتدقيق من قبل جهة مستقلة.`;
                return `<section class="pr-section" id="${secId}">
            <div class="pr-section-title">${n}. ${title}</div>
            <p>${escapeHtml(methodologyText || '')}</p>
        </section>`;
            }
            case 'financial':
                return `<section class="pr-section" id="${secId}">
            <div class="pr-section-title">${n}. ${title}</div>
            <div class="pr-kpi">
                <div class="pr-kpi-card"><div class="label">${L('npv')}</div><div class="value">${_fmt(ind.npv || 0)}</div></div>
                <div class="pr-kpi-card"><div class="label">${L('irr')}</div><div class="value">${SAFE.pctText(ind.irr)}</div></div>
                <div class="pr-kpi-card"><div class="label">${L('paybackPeriod')}</div><div class="value">${SAFE.payback(ind.paybackPeriod ?? ind.payback)}</div></div>
                <div class="pr-kpi-card"><div class="label">${L('breakEvenPointValue')}</div><div class="value">${SAFE.breakeven(ind, _fmt)}</div></div>
            </div>
            <p><strong>هيكل التمويل:</strong></p>
            <table class="pr-table">
                <tr><th>المصدر</th><th>المبلغ (ريال)</th><th>النسبة</th></tr>
                ${BankReportGenerator._renderFinancingTable(financing, cap.total, _fmt)}
            </table>
            ${incomeY1 ? `
            <p style="margin-top:16px;"><strong>قائمة الدخل (السنة الأولى):</strong></p>
            <table class="pr-table">
                <tr><th>البند</th><th>المبلغ (ريال)</th></tr>
                <tr><td>إجمالي الإيرادات</td><td>${_fmt(incomeY1.revenue || 0)}</td></tr>
                <tr><td>صافي الربح</td><td>${_fmt(incomeY1.netIncome || 0)}</td></tr>
            </table>
            ` : ''}
            <p style="margin-top:16px;"><strong>التوصية المالية:</strong></p>
            ${recommendationHtml}
        </section>`;
            case 'risks':
                return `<section class="pr-section" id="${secId}">
            <div class="pr-section-title">${n}. ${title}</div>
            ${risks.length ? `
            <table class="pr-table">
                <tr><th>المخاطر</th><th>الاحتمالية</th><th>التأثير</th><th>خطة المواجهة</th></tr>
                ${risks.map(r => `
                <tr>
                    <td>${escapeHtml(r.name || r.risk || r.description || '—')}</td>
                    <td>${escapeHtml(r.probability || '—')}</td>
                    <td>${escapeHtml(r.impact || '—')}</td>
                    <td>${escapeHtml((r.mitigation || '—').toString().slice(0, 100))}${(r.mitigation || '').length > 100 ? '...' : ''}</td>
                </tr>
                `).join('')}
            </table>
            ` : '<p>لم تُدرج مخاطر في المسودة الحالية. يُوصى بإكمال تحليل المخاطر قبل إحالة المراجعة.</p>'}
        </section>`;
            case 'appendices':
                return `<section class="pr-section" id="${secId}">
            <div class="pr-section-title">${n}. ${title}</div>
            <p><strong>الفريق / جهات الاتصال:</strong></p>
            ${appendixTable}
        </section>`;
            default:
                return '';
        }
    }
}
