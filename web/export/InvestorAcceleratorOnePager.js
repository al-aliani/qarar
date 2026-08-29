/**
 * عرض للمستثمر/المسرّعة — صفحة واحدة (أو صفحتين) جاهزة للطباعة PDF
 * يشمل: اسم المشروع، المشكلة والحل، الطلب (مبلغ + استخدامات)، أهم 3 مؤشرات مالية، أبرز مخاطرين وتخفيف، جهة اتصال.
 */
import { formatCurrency } from '../js/utils/formatters.js';
import { calculateStudy as runFullModel } from '../js/core/engine.js';
import { escapeHtml } from '../js/utils/escape.js';

/** @typedef {'investor'|'accelerator'|'incubator'} AudienceType */

export class InvestorAcceleratorOnePager {

    /**
     * @param {object} store - Store instance
     * @param {{ audience?: AudienceType }} [options] - audience: 'investor' | 'accelerator' | 'incubator' لتخصيص العنوان والتذييل
     */
    static generateHTML(store, options = {}) {
        const state = store.getState ? store.getState() : store.get();
        const audience = options.audience || 'investor';
        const audienceLabels = {
            investor: { title: 'عرض للمستثمر', footer: 'للاستخدام في التقديم للمستثمرين والمسرّعات.' },
            accelerator: { title: 'عرض للمسرّعة', footer: 'للاستخدام في التقديم للمسرّعات.' },
            incubator: { title: 'عرض للحاضنة', footer: 'للاستخدام في التقديم للحاضنات.' }
        };
        const label = audienceLabels[audience] || audienceLabels.investor;
        let results;
        try {
            results = runFullModel(state);
        } catch (e) {
            results = {};
        }

        const info = state.projectInfo || {};
        const exec = state.executiveSummary || {};
        const financing = state.financing || {};
        const capex = results.capex || {};
        const ind = results.indicators || {};
        const risks = (state.riskAnalysis?.risks || []).filter(r => r.name || r.description);
        const keyPeople = (state.keyPeople?.keyPeople || []).slice(0, 1);

        // ملاحظة: القص (slice) قبل التهريب لا بعده — تهريب ثم قص قد يقطع كيان HTML
        // بمنتصفه (مثال: "&lt;" تصير "&l") وينتج نصاً مشوَّهاً معروضاً حرفياً.
        const problemLine = escapeHtml((exec.problemStatement || info.startupHypothesis?.problem || '—').toString().slice(0, 120));
        const solutionLine = escapeHtml((exec.solutionStatement || info.concept || info.startupHypothesis?.solution || '—').toString().slice(0, 120));

        const currency = state.assumptions?.currency || 'SAR';
        const askAmount = financing.totalInvestment || capex.total || (financing.sources?.equity?.amount || 0) + (financing.sources?.bankLoan?.amount || 0);
        const useOfFunds = escapeHtml(financing.useOfFunds || 'استثمار وتشغيل المشروع (تجهيزات، رأس مال عامل، تسويق).');

        const topRisks = risks
            .sort((a, b) => { const h = (x) => (x.impact === 'high' ? 2 : x.impact === 'medium' ? 1 : 0) + (x.probability === 'high' ? 2 : x.probability === 'medium' ? 1 : 0); return h(b) - h(a); })
            .slice(0, 2);

        const contactLine = keyPeople.length && (keyPeople[0].name || keyPeople[0].email)
            ? `${escapeHtml(keyPeople[0].name || '')}${keyPeople[0].email ? ' — ' + escapeHtml(keyPeople[0].email) : ''}`
            : 'جهة اتصال: يُضاف يدوياً';

        const npvStr = ind.npv != null ? formatCurrency(ind.npv, currency) : '—';
        const paybackStr = ind.paybackPeriod != null ? (ind.paybackPeriod.toFixed(1) + ' سنة') : '—';
        const breakevenStr = ind.breakEvenPointValue != null ? formatCurrency(ind.breakEvenPointValue, currency) : (ind.breakEvenUnits != null ? ind.breakEvenUnits + ' وحدة' : '—');

        return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(label.title)} — ${escapeHtml(info.name || 'المشروع')}</title>
    <link href="/fonts/fonts.css" rel="stylesheet">
    <style>
        :root { --gold: #C9A227; --dark: #1a202c; --blue: #2c5282; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page { size: A4; margin: 1.5cm; }
        body { font-family: 'IBM Plex Sans Arabic', sans-serif; font-size: 11pt; line-height: 1.6; color: var(--dark); background: #fff; padding: 24px; max-width: 21cm; margin: 0 auto; }
        h1 { font-size: 20pt; color: var(--dark); margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid var(--gold); }
        .row { display: flex; gap: 24px; margin-bottom: 20px; flex-wrap: wrap; }
        .block { flex: 1; min-width: 200px; }
        .block h3 { font-size: 10pt; color: var(--blue); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
        .block p { font-size: 11pt; }
        .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 20px 0; }
        .kpi { background: #f7fafc; border-right: 4px solid var(--gold); padding: 14px; border-radius: 6px; text-align: center; }
        .kpi .label { font-size: 9pt; color: #718096; margin-bottom: 4px; }
        .kpi .value { font-size: 16pt; font-weight: 700; color: var(--dark); }
        .risk-item { margin-bottom: 12px; padding: 10px 14px; background: #fffaf0; border: 1px solid #ed8936; border-radius: 6px; }
        .risk-item strong { display: block; margin-bottom: 4px; }
        .footer { margin-top: 28px; padding-top: 14px; border-top: 1px solid #e2e8f0; font-size: 9pt; color: #718096; text-align: center; }
        @media print { body { padding: 0; } .block { page-break-inside: avoid; } }
    </style>
</head>
<body>
    <h1>${escapeHtml(label.title)}: ${escapeHtml(info.name || 'عرض المشروع')}</h1>

    <div class="row">
        <div class="block">
            <h3>المشكلة</h3>
            <p>${problemLine}</p>
        </div>
        <div class="block">
            <h3>الحل</h3>
            <p>${solutionLine}</p>
        </div>
    </div>

    <div class="row">
        <div class="block">
            <h3>الطلب (مبلغ + استخدامات)</h3>
            <p><strong>${formatCurrency(askAmount, currency)}</strong></p>
            <p>${useOfFunds}</p>
        </div>
    </div>

    <h3 style="font-size: 11pt; color: var(--blue); margin: 20px 0 10px;">أهم المؤشرات المالية</h3>
    <div class="kpi-grid">
        <div class="kpi"><div class="label">صافي القيمة الحالية (NPV)</div><div class="value">${npvStr}</div></div>
        <div class="kpi"><div class="label">فترة الاسترداد</div><div class="value">${paybackStr}</div></div>
        <div class="kpi"><div class="label">نقطة التعادل</div><div class="value">${breakevenStr}</div></div>
    </div>

    <h3 style="font-size: 11pt; color: var(--blue); margin: 20px 0 10px;">أبرز مخاطرين وإجراء التخفيف</h3>
    ${topRisks.length ? topRisks.map(r => `
    <div class="risk-item">
        <strong>${escapeHtml(r.name || r.description || '—')}</strong>
        <span>${escapeHtml(r.mitigation || '—')}</span>
    </div>
    `).join('') : '<p class="text-muted">لم تُدرج مخاطر بعد. يُوصى بإكمال تحليل المخاطر في الدراسة.</p>'}

    <div class="row" style="margin-top: 24px;">
        <div class="block">
            <h3>جهة اتصال</h3>
            <p>${contactLine}</p>
        </div>
    </div>

    <div class="footer">
        تم إنشاء هذا العرض بواسطة محاكي الجدوى — ${new Date().toLocaleDateString('ar-SA')} | ${label.footer}
    </div>
    <script>setTimeout(function(){ window.print(); }, 600);</script>
</body>
</html>`;
    }
}
