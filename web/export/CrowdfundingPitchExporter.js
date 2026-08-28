/**
 * عرض لمشروع تمويل جماعي — صفحة واحدة (أو اثنتين) جاهزة للرفع على منصة تمويل جماعي
 * يشمل: ملخص، الطلب، الاستخدامات، الجدول الزمني، المكافآت أو العوائد (منصات التمويل الجماعي العربية)
 */
import { formatCurrency } from '../js/utils/formatters.js';
import { calculateStudy as runFullModel } from '../js/core/engine.js';
import { SECTIONS } from '../js/core/schema.js';
import { escapeHtml } from '../js/utils/escape.js';

export class CrowdfundingPitchExporter {

    /**
     * @param {object} store - Store instance
     */
    static generateHTML(store) {
        const state = store.getState ? store.getState() : store.get();
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
        const timeline = state[SECTIONS.TIMELINE] || {};
        const activities = (timeline.activities || []).sort((a, b) => (a.startMonth || 1) - (b.startMonth || 1));
        const projTimeline = info.timeline || {};
        const currency = state.assumptions?.currency || 'SAR';

        const esc = escapeHtml;
        const summaryLine = (exec.projectOverview || exec.problemStatement || info.concept || info.description || '—').toString().slice(0, 200);
        const problemLine = (exec.problemStatement || info.startupHypothesis?.problem || '—').toString().slice(0, 100);
        const solutionLine = (exec.solutionStatement || info.startupHypothesis?.solution || '—').toString().slice(0, 100);

        const askAmount = financing.totalInvestment || capex.total || (financing.sources?.equity?.amount || 0) + (financing.sources?.bankLoan?.amount || 0);
        const useOfFunds = escapeHtml(financing.useOfFunds || 'استثمار وتشغيل المشروع (تجهيزات، رأس مال عامل، تسويق).');

        // لا بيانات = لا قسم — «يُضاف يدوياً» داخل ملف موسوم «جاهز للرفع» يفضح عدم الاكتمال
        const timelineText = activities.length > 0
            ? activities.map(a => `${esc(a.name || '')} (الشهر ${a.startMonth || 1}–${(a.startMonth || 1) + (a.duration || 1) - 1})`).join(' • ')
            : (projTimeline.projectStart || projTimeline.operationStart)
                ? `بدء المشروع: ${esc(projTimeline.projectStart || projTimeline.operationStart)} — التشغيل: ${esc(projTimeline.operationStart || '—')}`
                : '';

        const rewardsRaw = financing.investorBenefits || financing.rewards || exec.keyMilestones || '';
        const rewardsText = rewardsRaw.toString().trim()
            ? escapeHtml(rewardsRaw)
            : '';
        const ind = results.indicators || {};
        const paybackStr = ind.paybackPeriod != null ? (ind.paybackPeriod.toFixed(1) + ' سنة') : '—';

        return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>عرض تمويل جماعي — ${esc(info.name || 'المشروع')}</title>
    <link href="/fonts/fonts.css" rel="stylesheet">
    <style>
        :root { --gold: #C9A227; --dark: #1a202c; --blue: #2c5282; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page { size: A4; margin: 1.5cm; }
        body { font-family: 'IBM Plex Sans Arabic', sans-serif; font-size: 11pt; line-height: 1.6; color: var(--dark); background: #fff; padding: 24px; max-width: 21cm; margin: 0 auto; }
        h1 { font-size: 20pt; color: var(--dark); margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid var(--gold); }
        .block { margin-bottom: 20px; }
        .block h3 { font-size: 10pt; color: var(--blue); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
        .block p { font-size: 11pt; }
        .highlight { background: #f7fafc; border-right: 4px solid var(--gold); padding: 14px; border-radius: 6px; }
        .timeline-list { list-style: none; padding: 0; }
        .timeline-list li { padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
        .footer { margin-top: 28px; padding-top: 14px; border-top: 1px solid #e2e8f0; font-size: 9pt; color: #718096; text-align: center; }
        @media print { body { padding: 0; } .block { page-break-inside: avoid; } }
    </style>
</head>
<body>
    <h1>عرض تمويل جماعي: ${esc(info.name || 'عرض المشروع')}</h1>

    <div class="block">
        <h3>ملخص المشروع</h3>
        <p>${esc(summaryLine)}</p>
    </div>

    <div class="block">
        <h3>الفكرة — المشكلة والحل</h3>
        <p><strong>المشكلة:</strong> ${esc(problemLine)}</p>
        <p><strong>الحل:</strong> ${esc(solutionLine)}</p>
    </div>

    <div class="block highlight">
        <h3>الطلب والاستخدامات</h3>
        <p><strong>المبلغ المطلوب:</strong> ${formatCurrency(askAmount, currency)}</p>
        <p>${useOfFunds}</p>
    </div>

    ${timelineText ? `<div class="block">
        <h3>الجدول الزمني</h3>
        <p>${timelineText}</p>
    </div>` : ''}

    ${(rewardsText || paybackStr !== '—') ? `<div class="block">
        <h3>ما يقدمه الداعم/المستثمر — المكافآت أو العوائد</h3>
        ${rewardsText ? `<p>${rewardsText}</p>` : ''}
        ${paybackStr !== '—' ? `<p class="text-muted mt-2">فترة الاسترداد المتوقعة: ${paybackStr}</p>` : ''}
    </div>` : ''}

    <div class="footer">
        تم إنشاء هذا العرض بواسطة محاكي الجدوى — ${new Date().toLocaleDateString('ar-SA')} | جاهز للرفع على منصة تمويل جماعي.
    </div>
    <script>setTimeout(function(){ window.print(); }, 600);</script>
</body>
</html>`;
    }
}
