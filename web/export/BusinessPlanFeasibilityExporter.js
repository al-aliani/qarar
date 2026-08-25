/**
 * تقرير جدوى + ملخص خطة عمل (مشروعك / Mashrouak)
 * مخرج واحد: صفحة واحدة (أو اثنتين) ملخص خطة عمل ثم التقرير الكامل للجدوى.
 * الملخص يتضمن: اسم المشروع، الرؤية، الأهداف (3–5)، المنتج/الخدمة، السوق والمنافسون، الملخص المالي، الطلب إن وُجد.
 * ترتيب أقسام الملخص: يُطبَّق state.reportSectionOrder عند وجوده (المهمة 73 — توحيد مع ReportGenerator).
 */
import { formatCurrency, formatPercent } from '../js/utils/formatters.js';
import { calculateStudy as runFullModel } from '../js/core/engine.js';
import { ReportGenerator } from '../js/services/ReportGenerator.js';

/** أقسام ملخص خطة العمل (معرّفات قابلة للربط مع reportSectionOrder). */
const BP_SUMMARY_SECTION_IDS = ['vision', 'goals', 'product', 'market', 'financial_summary', 'request'];

/** ربط معرّف قسم التقرير بقسم ملخص خطة العمل. */
const REPORT_SECTION_TO_BP_SUMMARY = {
    executive_summary: 'vision',
    market: 'market',
    financial_kpis: 'financial_summary',
    recommendation: 'request'
};

function esc(s) {
    if (s == null || s === '') return '—';
    return String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export class BusinessPlanFeasibilityExporter {

    /** ترتيب أقسام ملخص خطة العمل: يتبع reportSectionOrder إن وُجد، مع إلحاق أي قسم غير مذكور. */
    static _getBPSummarySectionOrder(state) {
        const userOrder = (state.reportSectionOrder && state.reportSectionOrder.length) ? state.reportSectionOrder : [];
        const ordered = [];
        for (const sectionId of userOrder) {
            const bpId = REPORT_SECTION_TO_BP_SUMMARY[sectionId];
            if (bpId && !ordered.includes(bpId)) ordered.push(bpId);
        }
        for (const id of BP_SUMMARY_SECTION_IDS) {
            if (!ordered.includes(id)) ordered.push(id);
        }
        return ordered;
    }

    /** يُرجع HTML لقسم واحد من ملخص خطة العمل. */
    static _renderBPSummarySection(id, content) {
        const { vision, objectivesHtml, productLine, productLine2, marketTwoLines, financialHtml, requestHtml } = content;
        switch (id) {
            case 'vision':
                return `<section class="bp-section"><h2 class="bp-h2">الرؤية</h2><p>${vision}</p></section>`;
            case 'goals':
                return `<section class="bp-section"><h2 class="bp-h2">الأهداف (3–5)</h2><ol class="bp-list">${objectivesHtml}</ol></section>`;
            case 'product':
                return `<section class="bp-section"><h2 class="bp-h2">المنتج / الخدمة</h2><p>${productLine}</p><p>${productLine2}</p></section>`;
            case 'market':
                return `<section class="bp-section"><h2 class="bp-h2">السوق المستهدف والمنافسون</h2><p>${marketTwoLines}</p></section>`;
            case 'financial_summary':
                return `<section class="bp-section"><h2 class="bp-h2">الملخص المالي</h2>${financialHtml}</section>`;
            case 'request':
                return `<section class="bp-section"><h2 class="bp-h2">الطلب (تمويل أو شريك)</h2><p>${requestHtml}</p></section>`;
            default:
                return '';
        }
    }

    /**
     * يُرجع HTML كامل: ملخص خطة عمل (صفحة واحدة) ثم التقرير الكامل للجدوى.
     * @param {object} store
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
        const smartGoals = state.smartGoals || {};
        const goals = (smartGoals.goals || []).slice(0, 5);
        const marketing = state.marketing || {};
        const financing = state.financing || {};
        const ind = results?.indicators || {};
        const incomeStatement = results?.incomeStatement || [];
        const year1 = Array.isArray(incomeStatement) && incomeStatement.length > 0 ? incomeStatement[0] : {};
        const currency = state.assumptions?.currency || 'SAR';

        const name = esc(info.name || 'المشروع');
        const vision = esc(info.identityStatement || exec.projectOverview || info.valueProposition || info.concept || '—');
        const objectivesHtml = goals.length
            ? goals.map((g, i) => `<li>${esc(g.specific || g.measurable || g.relevant || 'هدف ' + (i + 1))}</li>`).join('')
            : '<li>يُضاف من قسم الأهداف الذكية</li>';

        const productLine = esc(exec.proposedSolution || info.concept || info.description || '—').slice(0, 200);
        const productLine2 = esc(info.valueProposition || exec.uniqueValueProposition || '').slice(0, 200) || '—';

        const marketLine = (marketing.marketAnalysis?.summary || marketing.marketAnalysis?.description || '').toString().slice(0, 150);
        const comps = (marketing.competitors || []).slice(0, 3).map(c => typeof c === 'string' ? c : (c.name || c)).filter(Boolean);
        const competitorsLine = comps.length ? comps.join('، ') : 'يُضاف من تحليل المنافسين';
        const marketTwoLines = esc(marketLine || 'السوق المستهدف: يُضاف من تحليل السوق.') + ' المنافسون: ' + esc(competitorsLine);

        const rev = year1.revenue || 0;
        // «—» أصدق من «٠»: صافٍ غير منتهٍ (NaN/±Infinity) يعني فشل حساب لا ربحاً صفرياً،
        // و`|| 0` كان يطبعه صفراً متوازناً يُخفي الفشل. المفقود (null/undefined) وحده صفر.
        const net = year1.netIncome == null ? 0 : year1.netIncome;
        // التكلفة تُشتقّ من الإيراد والصافي كي يتوازن السطر المطبوع بحكم البناء
        // (إيراد − تكلفة = صافي دائماً). الجمع اليدوي للبنود كان يُسقط بنوداً صامتاً:
        // كان يقرأ year1.totalVariableCosts وهو اسم متغيّر داخل المحرك لا مفتاح في صف
        // قائمة الدخل (المفتاح الفعلي variableCosts) ⟶ undefined ⟶ 0، كما كان يُسقط
        // الفوائد والزكاة والضريبة أصلاً. الرقم الآن = كل التكاليف والأعباء حتى صافي الربح.
        const cost = rev - net;
        const npvStr = ind.npv != null ? formatCurrency(ind.npv, currency) : '—';
        const irrStr = ind.irr != null ? formatPercent(ind.irr) : '—';
        const paybackStr = ind.paybackPeriod != null ? (ind.paybackPeriod.toFixed(1) + ' سنة') : '—';

        const askAmount = financing.totalInvestment || (financing.sources?.equity?.amount || 0) + (financing.sources?.bankLoan?.amount || 0);
        const useOfFunds = (financing.useOfFunds || '').toString().trim() || 'استثمار وتشغيل المشروع.';
        const requestHtml = askAmount > 0
            ? `<strong>الطلب:</strong> ${formatCurrency(askAmount, currency)} — ${esc(useOfFunds).slice(0, 120)}`
            : 'الطلب: يُضاف من هيكل التمويل إن وُجد (تمويل أو شريك).';

        const financialHtml = `<p>إيراد متوقع: ${formatCurrency(rev, currency)} — إجمالي التكاليف والأعباء: ${formatCurrency(cost, currency)} — صافي: ${formatCurrency(net, currency)}.</p><p>مؤشرات: NPV ${npvStr}، IRR ${irrStr}، فترة استرداد ${paybackStr}.</p>`;

        const bpContent = { vision, objectivesHtml, productLine, productLine2, marketTwoLines, financialHtml, requestHtml };
        const summaryOrder = this._getBPSummarySectionOrder(state);
        const summarySectionsHtml = summaryOrder.map(id => this._renderBPSummarySection(id, bpContent)).filter(Boolean).join('\n                ');

        const summaryPart = `
            <div class="bp-summary" style="page-break-after: always;">
                <h1 class="bp-title">ملخص خطة عمل</h1>
                <p class="bp-subtitle">${name}</p>

                ${summarySectionsHtml}
            </div>
        `;

        const fullReportHtml = ReportGenerator.generateHTML(store);
        const bodyMatch = fullReportHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
        const fullBodyContent = bodyMatch ? bodyMatch[1].trim() : fullReportHtml;
        const styleMatch = fullReportHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/);
        const reportStyles = styleMatch ? styleMatch[1] : '';

        return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>تقرير جدوى + ملخص خطة عمل — ${name}</title>
    <link href="/fonts/fonts.css" rel="stylesheet">
    <style>
        :root { --gold: #C9A227; --dark: #1a202c; --blue: #2c5282; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page { size: A4; margin: 1.5cm; }
        body { font-family: 'IBM Plex Sans Arabic', sans-serif; font-size: 11pt; line-height: 1.6; color: var(--dark); background: #fff; padding: 24px; max-width: 21cm; margin: 0 auto; }
        .bp-summary { padding: 16px 0; }
        .bp-title { font-size: 18pt; color: var(--dark); margin-bottom: 8px; padding-bottom: 8px; border-bottom: 2px solid var(--gold); }
        .bp-subtitle { font-size: 14pt; color: var(--blue); margin-bottom: 20px; }
        .bp-section { margin-bottom: 18px; }
        .bp-h2 { font-size: 12pt; color: var(--blue); margin-bottom: 6px; }
        .bp-list { margin-right: 20px; }
        .page-break-after { page-break-after: always; }
        .full-report-div { margin-top: 24px; }
        @media print { .bp-summary { page-break-after: always; } }
        ${reportStyles ? `/* أنماط التقرير الكامل */\n${reportStyles}` : ''}
    </style>
</head>
<body>
    ${summaryPart}
    <div class="full-report-div">
        <h1 style="font-size: 18pt; margin-bottom: 16px; border-bottom: 2px solid var(--gold);">التقرير الكامل للجدوى</h1>
        ${fullBodyContent}
    </div>
</body>
</html>`;
    }
}
