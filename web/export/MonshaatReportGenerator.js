/**
 * تقرير بهيكل متوافق مع متطلبات منشآت (أقسام وعناوين مطابقة قدر الإمكان للنموذج الاسترشادي الرسمي).
 * مع إخلاء مسؤولية: "يُوصى بمراجعة المتطلبات الحالية على بوابة منشآت." — لا ادعاء اعتماد رسمي إلا بموجب اتفاق.
 * ترتيب الأقسام: يُطبَّق state.reportSectionOrder عند وجوده (المهمة 69 — توحيد مع ReportGenerator).
 */
import { formatCurrency } from '../js/utils/formatters.js';
import { calculateStudy as runFullModel } from '../js/core/engine.js';
import { validateStudy } from '../js/utils/validation.js';
import { SAFE } from './utils.js';

/** أقسام تقرير منشآت (معرّفات قابلة للربط مع reportSectionOrder). */
const MONSHAAT_SECTION_IDS = [
    'executive_summary',
    'market',
    'technical',
    'financial_kpis',
    'risks',
    'recommendation'
];

export class MonshaatReportGenerator {

    static calculateResults(state) {
        try {
            return runFullModel(state);
        } catch (e) {
            console.error('Monshaat report calc error', e);
            return {};
        }
    }

    static generateHTML(store) {
        const state = store.getState ? store.getState() : store.get();
        const info = state.projectInfo || {};

        let results;
        try {
            results = this.calculateResults(state);
            if (store && typeof store.update === 'function') {
                store.update('results', results);
            }
        } catch (e) {
            results = state.results || {};
        }

        const date = new Date().toLocaleDateString('ar-SA', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const v = validateStudy(state);
        const validationNotice = !v.valid && v.errors?.length
            ? `<div class="monshaat-notice" style="background:#fef5e7;border:1px solid #f59e0b;border-radius:6px;padding:12px 20px;margin:0 20px 20px;font-size:10pt;color:#92400e;"><strong>تنبيه:</strong> يفضّل مراجعة البيانات قبل الاعتماد. ${v.errors.slice(0, 2).join('؛ ')}</div>`
            : '';

        const currency = state.assumptions?.currency || 'SAR';
        const _fmt = (v) => formatCurrency(v, currency);
        const ind = results.indicators || {};
        const cap = results.capex || {};
        const incomeY1 = results.incomeStatement?.[0];
        const financing = state.financing || {};

        const finalOrder = this._getMonshaatSectionOrder(state);
        const sectionsHtml = finalOrder
            .map((id, i) => this._renderMonshaatSection(id, state, results, info, financing, ind, cap, incomeY1, i + 1, _fmt))
            .filter(Boolean)
            .join('\n        ');

        return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>دراسة جدوى — ${info.name || 'مشروع مقترح'} — هيكل متوافق مع متطلبات منشآت</title>
    <link href="/fonts/fonts.css" rel="stylesheet">
    <style>
        :root { --gold: #C9A227; --dark: #1a365d; --blue: #2c5282; --green: #276749; --red: #c53030; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page { size: A4; margin: 2cm; }
        body { font-family: 'IBM Plex Sans Arabic', sans-serif; font-size: 11pt; line-height: 1.6; color: #1a202c; background: #fff; }
        .monshaat-container { max-width: 21cm; margin: 0 auto; padding: 24px; }
        .monshaat-header { text-align: center; padding: 24px 0; border-bottom: 3px solid var(--gold); margin-bottom: 24px; }
        .monshaat-header h1 { font-size: 22pt; color: var(--dark); margin-bottom: 8px; }
        .monshaat-header h2 { font-size: 14pt; color: #4a5568; font-weight: 500; }
        .monshaat-section { margin-bottom: 28px; page-break-inside: avoid; }
        .monshaat-section-title { font-size: 14pt; font-weight: 700; color: var(--blue); padding: 10px 0; border-bottom: 2px solid var(--gold); margin-bottom: 12px; }
        .monshaat-table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 10pt; }
        .monshaat-table th, .monshaat-table td { padding: 10px 14px; text-align: right; border: 1px solid #e2e8f0; }
        .monshaat-table th { background: var(--dark); color: #fff; font-weight: 600; }
        .monshaat-table .total-row { background: #edf2f7; font-weight: 700; }
        .monshaat-kpi { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0; }
        .monshaat-kpi-card { background: #f7fafc; border: 1px solid #e2e8f0; border-right: 4px solid var(--gold); padding: 16px; border-radius: 6px; text-align: center; }
        .monshaat-kpi-card .label { font-size: 9pt; color: #718096; margin-bottom: 6px; }
        .monshaat-kpi-card .value { font-size: 16pt; font-weight: 700; color: var(--blue); }
        .monshaat-kpi-card .value.positive { color: var(--green); }
        .monshaat-kpi-card .value.negative { color: var(--red); }
        .monshaat-footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #e2e8f0; text-align: center; font-size: 9pt; color: #718096; }
        .monshaat-recommendation { padding: 16px; background: #f0fff4; border: 1px solid #9ae6b4; border-radius: 6px; margin: 16px 0; }
        .monshaat-recommendation.no-go { background: #fff5f5; border-color: #feb2b2; }
        .monshaat-recommendation.revise { background: #fffbeb; border-color: #fbd38d; }
        .monshaat-disclaimer { background: #edf2f7; border: 1px solid #cbd5e0; border-radius: 6px; padding: 12px 16px; margin: 20px 0; font-size: 9pt; color: #4a5568; }
        @media print { .monshaat-section { page-break-inside: avoid; } }
    </style>
</head>
<body>
    <div class="monshaat-container">
        <div class="monshaat-header">
            <h1>دراسة جدوى — هيكل متوافق مع متطلبات منشآت</h1>
            <h2>${info.name || 'مشروع مقترح'}</h2>
            <p style="margin-top:12px;font-size:10pt;color:#718096;">أقسام وعناوين مطابقة قدر الإمكان للنموذج الاسترشادي | ${date}</p>
        </div>
        ${validationNotice}

        ${sectionsHtml}

        <div class="monshaat-disclaimer">
            <strong>إخلاء مسؤولية:</strong> يُوصى بمراجعة المتطلبات الحالية على بوابة منشآت. لا ادعاء اعتماد رسمي من منشآت إلا بموجب اتفاق.
        </div>

        <div class="monshaat-footer">
            <p><strong>محاكي الجدوى</strong> — تم إنشاء هذا التقرير بهيكل متوافق مع متطلبات منشآت قدر الإمكان.</p>
            <p style="margin-top:4px;">© ${new Date().getFullYear()} | جميع الحقوق محفوظة</p>
        </div>
    </div>
</body>
</html>`;
    }

    /** ترتيب أقسام تقرير منشآت: يتبع reportSectionOrder إن وُجد، مع إلحاق أي قسم غير مذكور. */
    static _getMonshaatSectionOrder(state) {
        const userOrder = (state.reportSectionOrder && state.reportSectionOrder.length) ? state.reportSectionOrder : [];
        const ordered = userOrder.filter(id => MONSHAAT_SECTION_IDS.includes(id));
        for (const id of MONSHAAT_SECTION_IDS) {
            if (!ordered.includes(id)) ordered.push(id);
        }
        return ordered;
    }

    /** عناوين أقسام منشآت (مطابقة للنموذج الاسترشادي). */
    static _getMonshaatSectionTitle(id) {
        const titles = {
            executive_summary: 'تعريف المشروع والملخص التنفيذي',
            market: 'دراسة السوق',
            technical: 'الدراسة الفنية والتشغيلية',
            financial_kpis: 'الدراسة المالية والتمويل',
            risks: 'تحليل المخاطر وخطط المواجهة',
            recommendation: 'التوصية والقرار النهائي'
        };
        return titles[id] || id;
    }

    /** يُرجع HTML لقسم واحد من تقرير منشآت؛ يُرجع '' إن كان القسم اختيارياً ولا توجد بيانات. */
    static _renderMonshaatSection(id, state, results, info, financing, ind, cap, incomeY1, num, _fmt) {
        const arNum = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'][num] || String(num);
        const title = this._getMonshaatSectionTitle(id);
        const wrap = (html) => `<div class="monshaat-section"><div class="monshaat-section-title">${arNum}. ${title}</div>${html}</div>`;

        switch (id) {
            case 'executive_summary':
                return wrap(`<p>${state.executiveSummary?.projectOverview || state.executiveSummary?.aiGeneratedText || `يهدف مشروع «${info.name || 'المشروع'}» إلى ${info.concept || 'تنفيذ نشاط تجاري'} في ${info.city || 'الموقع المحدد'}. تم إعداد هذه الدراسة بهيكل متوافق مع متطلبات منشآت قدر الإمكان.`}</p>`);
            case 'market': {
                const ma = state.marketing?.marketAnalysis || {};
                const text = ma.summary || ma.description || state.marketSizing?.tam?.description || state.marketSizing?.targetDistrict || '';
                // لا بيانات سوق = لا قسم — أربع كلمات حشو («يُحدد حسب النشاط والمنطقة»)
                // في تقرير موسوم بتوافق منشآت أسوأ من غياب القسم
                if (!String(text).trim()) return '';
                return wrap(`<p>${text}</p>`);
            }
            case 'technical': {
                const tech = state.technical || {};
                const area = info.areaSize || tech.areaSize || '—';
                const timeline = info.timeline?.constructionMonths ?? tech.constructionMonths ?? '—';
                return wrap(`<table class="monshaat-table">
                <tr><th>البند</th><th>القيمة</th></tr>
                <tr><td>المساحة / الحجم</td><td>${area}</td></tr>
                <tr><td>مدة الإنشاء (شهر)</td><td>${timeline}</td></tr>
                <tr><td>بدء التشغيل</td><td>${info.timeline?.operationStart || '—'}</td></tr>
                ${results?.saudization?.totalHeads > 0 ? `<tr><td>الوظائف ونسبة التوطين</td><td>${results.saudization.totalHeads} وظيفة — توطين ${Math.round((results.saudization.rate || 0) * 100)}% (${results.saudization.saudiHeads} سعودي)</td></tr>` : ''}
                </table>`);
            }
            case 'financial_kpis': {
                const sources = financing.sources || {};
                const total = financing.totalInvestment || (sources.equity?.amount || 0) + (sources.bankLoan?.amount || 0) + (sources.investors?.amount || 0) + (sources.governmentSupport?.amount || 0) || 1;
                const rows = [
                    { key: 'equity', label: 'تمويل ذاتي', amount: sources.equity?.amount },
                    { key: 'bankLoan', label: 'قرض بنكي', amount: sources.bankLoan?.amount },
                    { key: 'investors', label: 'مستثمرون', amount: sources.investors?.amount },
                    { key: 'governmentSupport', label: 'دعم حكومي', amount: sources.governmentSupport?.amount }
                ].filter(r => r.amount > 0).map(r => `<tr><td>${r.label}</td><td>${_fmt(r.amount)}</td><td>${total ? ((r.amount / total) * 100).toFixed(1) : '0'}%</td></tr>`).join('');
                return wrap(`
                <div class="monshaat-kpi">
                    <div class="monshaat-kpi-card"><div class="label">صافي القيمة الحالية</div><div class="value ${(ind.npv || 0) > 0 ? 'positive' : 'negative'}">${_fmt(ind.npv || 0)}</div></div>
                    <div class="monshaat-kpi-card"><div class="label">معدل العائد الداخلي</div><div class="value">${SAFE.pctText(ind.irr)}</div></div>
                    <div class="monshaat-kpi-card"><div class="label">فترة الاسترداد</div><div class="value">${SAFE.payback(ind.paybackPeriod ?? ind.payback)}</div></div>
                    <div class="monshaat-kpi-card"><div class="label">نقطة التعادل (ريال)</div><div class="value">${_fmt(ind.breakEvenPointValue || 0)}</div></div>
                </div>
                <table class="monshaat-table">
                <tr><th>مصدر التمويل</th><th>المبلغ</th><th>النسبة</th></tr>
                ${rows}
                <tr class="total-row"><td>الإجمالي</td><td>${_fmt(cap.total || total)}</td><td>100%</td></tr>
                </table>`);
            }
            case 'risks':
                if (!(state.riskAnalysis?.risks || []).length) return '';
                return wrap(`<table class="monshaat-table">
                <tr><th>المخاطر</th><th>الاحتمالية</th><th>التأثير</th><th>خطة المواجهة</th></tr>
                ${(state.riskAnalysis.risks || []).slice(0, 6).map(r => `
                <tr>
                    <td>${(r.name || r.risk || r.description || '—')}</td>
                    <td>${r.probability || '—'}</td>
                    <td>${r.impact || '—'}</td>
                    <td>${(r.mitigation || '—').toString().slice(0, 80)}${(r.mitigation || '').length > 80 ? '...' : ''}</td>
                </tr>
                `).join('')}
                </table>`);
            case 'recommendation':
                return wrap(this._renderRecommendation(results));
            default:
                return '';
        }
    }

    static _renderRecommendation(results) {
        const decision = results.decision || 'REVISE';
        const reasons = results.decisionReasons || [];
        const reasonStr = Array.isArray(reasons) && reasons.length ? reasons.slice(0, 2).map(r => typeof r === 'string' ? r : (r?.text || r?.reason || '')).filter(Boolean).join('؛ ') : '';
        const cls = decision === 'GO' ? '' : decision === 'NO-GO' ? 'no-go' : 'revise';
        const msg = decision === 'GO'
            ? `بناءً على التحليل المالي، المشروع يحقق مؤشرات إيجابية. يُوصى بالمضي قدماً مع مراعاة المخاطر.`
            : decision === 'NO-GO'
                ? `المؤشرات المالية لا تحقق الحدود الدنيا. لا يُوصى بالمضي في ظل الافتراضات الحالية. ${reasonStr}`
                : `بعض المؤشرات دون المستوى. يُوصى بمراجعة الافتراضات قبل الاعتماد. ${reasonStr}`;
        return `<div class="monshaat-recommendation ${cls}"><p>${msg}</p></div>`;
    }
}
