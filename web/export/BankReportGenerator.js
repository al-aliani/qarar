/**
 * تقرير تمويل بنكي مخصص — مُؤكّد الاستخدام
 * متوافق مع متطلبات بنك التنمية الاجتماعية وبرامج التمويل (تمويل رواد الأعمال، ريادة، كفالة).
 * المصطلحات والألوان مطابقة لنماذج بنك التنمية الاجتماعية ومنشآت — ليبدو التقرير صادراً من جهة رسمية.
 * ترتيب الأقسام: يُطبَّق state.reportSectionOrder عند وجوده (المهمة 66 — توحيد مع ReportGenerator).
 */

import { formatCurrency } from '../js/utils/formatters.js';
import { SAFE } from './utils.js';
import { calculateStudy as runFullModel } from '../js/core/engine.js';
import { validateStudy } from '../js/utils/validation.js';
import { getLabelSDB } from '../js/core/regulatoryLabels.js';
import { BANK_COMPLIANCE_SENTENCE } from '../js/config.js';

/** أقسام تقرير البنك (معرّفات قابلة للربط مع reportSectionOrder). */
const BANK_SECTION_IDS = [
    'executive_summary',
    'financial_kpis',
    'financing_structure',
    'income_statement',
    'loan_schedule',
    'risks',
    'recommendation'
];

export class BankReportGenerator {

    static calculateResults(state) {
        try {
            return runFullModel(state);
        } catch (e) {
            console.error('Bank report calc error', e);
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
            ? `<div class="bank-notice" style="background:#fef5e7;border:1px solid #f59e0b;border-radius:6px;padding:12px 20px;margin:0 20px 20px;font-size:10pt;color:#92400e;"><strong>تنبيه:</strong> يفضّل مراجعة البيانات قبل التقديم. ${v.errors.slice(0, 2).join('؛ ')}</div>`
            : '';

        const currency = state.assumptions?.currency || 'SAR';
        const _fmt = (v) => formatCurrency(v, currency);
        const L = getLabelSDB;
        const ind = results.indicators || {};
        const cap = results.capex || {};
        const loan = results.loanSchedule || {};
        const incomeY1 = results.incomeStatement?.[0];
        const financing = state.financing || {};

        const finalOrder = this._getBankSectionOrder(state);
        const sectionsHtml = finalOrder
            .map((id, i) => this._renderBankSection(id, state, results, info, financing, ind, cap, loan, incomeY1, i + 1, _fmt, L))
            .filter(Boolean)
            .join('\n        ');

        return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>طلب تمويل — ${info.name || 'مشروع مقترح'} — دراسة جدوى</title>
    <link href="/fonts/fonts.css" rel="stylesheet">
    <style>
        /* ألوان وخطوط معتمدة — بنك التنمية الاجتماعية / منشآت */
        :root { --sdb-gold: #C9A227; --sdb-dark: #1a365d; --sdb-blue: #2c5282; --sdb-green: #276749; --sdb-red: #c53030; --gold: var(--sdb-gold); --dark: var(--sdb-dark); --blue: var(--sdb-blue); --green: var(--sdb-green); --red: var(--sdb-red); }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page { size: A4; margin: 2cm; }
        body { font-family: 'IBM Plex Sans Arabic', 'Simplified Arabic', sans-serif; font-size: 11pt; line-height: 1.6; color: #1a202c; background: #fff; }
        .bank-container { max-width: 21cm; margin: 0 auto; padding: 24px; }
        .bank-header { text-align: center; padding: 24px 0; border-bottom: 3px solid var(--gold); margin-bottom: 24px; }
        .bank-header h1 { font-size: 22pt; color: var(--dark); margin-bottom: 8px; }
        .bank-header h2 { font-size: 14pt; color: #4a5568; font-weight: 500; }
        .bank-section { margin-bottom: 28px; page-break-inside: avoid; }
        .bank-section-title { font-size: 14pt; font-weight: 700; color: var(--blue); padding: 10px 0; border-bottom: 2px solid var(--gold); margin-bottom: 12px; }
        .bank-table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 10pt; }
        .bank-table th, .bank-table td { padding: 10px 14px; text-align: right; border: 1px solid #e2e8f0; }
        .bank-table th { background: var(--dark); color: #fff; font-weight: 600; }
        .bank-table .total-row { background: #edf2f7; font-weight: 700; }
        .bank-kpi { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0; }
        .bank-kpi-card { background: #f7fafc; border: 1px solid #e2e8f0; border-right: 4px solid var(--gold); padding: 16px; border-radius: 6px; text-align: center; }
        .bank-kpi-card .label { font-size: 9pt; color: #718096; margin-bottom: 6px; }
        .bank-kpi-card .value { font-size: 16pt; font-weight: 700; color: var(--blue); }
        .bank-kpi-card .value.positive { color: var(--green); }
        .bank-kpi-card .value.negative { color: var(--red); }
        .bank-footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #e2e8f0; text-align: center; font-size: 9pt; color: #718096; }
        .bank-recommendation { padding: 16px; background: #f0fff4; border: 1px solid #9ae6b4; border-radius: 6px; margin: 16px 0; }
        .bank-recommendation.no-go { background: #fff5f5; border-color: #feb2b2; }
        .bank-recommendation.revise { background: #fffbeb; border-color: #fbd38d; }
        @media print { .bank-section { page-break-inside: avoid; } }
        @media (max-width: 600px) { .bank-kpi { grid-template-columns: 1fr 1fr; } }
    </style>
</head>
<body>
    <div class="bank-container">
        <!-- غلاف التقرير -->
        <div class="bank-header">
            <h1>طلب تمويل — دراسة جدوى اقتصادية</h1>
            <h2>${info.name || 'مشروع مقترح'}</h2>
            <p style="margin-top:12px;font-size:10pt;color:#718096;">أُعدّ باتباع الهيكل الاسترشادي لجهات التمويل المحلية (بنك التنمية الاجتماعية، منشآت) | ${date}</p>
            <p style="margin-top:6px;font-size:9pt;color:#4a5568;">بنية التقرير مناسبة للإقراض: ملخص تنفيذي، استخدام التمويل، القوائم المالية، الضمانات.</p>
        </div>
        ${validationNotice}

        ${sectionsHtml}

        <!-- تذييل -->
        <div class="bank-footer">
            <p><strong>محاكي الجدوى</strong> — تم إنشاء هذا التقرير بواسطة منصة دراسة الجدوى الذكية</p>
            <p style="margin-top:8px; color:#B8860B; font-weight:500;">✓ ${BANK_COMPLIANCE_SENTENCE}</p>
            <p style="margin-top:8px;">هذه الدراسة مُنشأة بمعايير دراسات جدوى قابلة للمراجعة والتدقيق.</p>
            <p style="margin-top:4px;">هذا التقرير معد لأغراض طلب التمويل. يُفضّل التعبئة من الحاسوب ومراجعة البيانات قبل التقديم للبنك.</p>
            <p style="margin-top:4px;">© ${new Date().getFullYear()} | جميع الحقوق محفوظة</p>
        </div>
    </div>
</body>
</html>`;
    }

    /** ترتيب أقسام تقرير البنك: يتبع reportSectionOrder إن وُجد، مع إلحاق أي قسم بنكي غير مذكور. */
    static _getBankSectionOrder(state) {
        const userOrder = (state.reportSectionOrder && state.reportSectionOrder.length) ? state.reportSectionOrder : [];
        const ordered = userOrder.filter(id => BANK_SECTION_IDS.includes(id));
        for (const id of BANK_SECTION_IDS) {
            if (!ordered.includes(id)) ordered.push(id);
        }
        return ordered;
    }

    /** يُرجع HTML لقسم واحد من تقرير البنك؛ يُرجع '' إن كان القسم اختيارياً ولا توجد بيانات. */
    static _renderBankSection(id, state, results, info, financing, ind, cap, loan, incomeY1, num, _fmt, L) {
        const n = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'][num] || String(num);
        switch (id) {
            case 'executive_summary':
                return `<div class="bank-section">
            <div class="bank-section-title">${n}. الملخص التنفيذي</div>
            <p>${state.executiveSummary?.projectOverview || state.executiveSummary?.aiGeneratedText || `يهدف مشروع «${info.name || 'المشروع'}» إلى ${info.concept || 'تنفيذ نشاط تجاري'} في ${info.city || 'الموقع المحدد'}. تم إعداد هذه الدراسة وفق منهجيات احترافية لتقديم طلب التمويل.`}</p>
        </div>`;
            case 'financial_kpis':
                return `<div class="bank-section">
            <div class="bank-section-title">${n}. المؤشرات المالية الرئيسية</div>
            <div class="bank-kpi">
                <div class="bank-kpi-card"><div class="label">${L('npv')}</div><div class="value ${(ind.npv || 0) > 0 ? 'positive' : 'negative'}">${_fmt(ind.npv || 0)}</div></div>
                <div class="bank-kpi-card"><div class="label">${L('irr')}</div><div class="value">${((ind.irr || 0) * 100).toFixed(1)}%</div></div>
                <div class="bank-kpi-card"><div class="label">${L('paybackPeriod')}</div><div class="value">${SAFE.payback(ind.paybackPeriod ?? ind.payback)}</div></div>
                <div class="bank-kpi-card"><div class="label">${L('breakEvenPointValue')}</div><div class="value">${_fmt(ind.breakEvenPointValue || 0)}</div></div>
            </div>
            <table class="bank-table">
                <tr><th>المؤشر</th><th>القيمة</th><th>ملاحظة</th></tr>
                <tr><td>${L('npv')}</td><td>${_fmt(ind.npv || 0)}</td><td>${(ind.npv || 0) > 0 ? 'إيجابي ✓' : 'يحتاج مراجعة'}</td></tr>
                <tr><td>${L('irr')}</td><td>${((ind.irr || 0) * 100).toFixed(2)}%</td><td>${(ind.irr || 0) >= 0.15 ? 'مقبول للتمويل' : 'تحت الحد المفضل'}</td></tr>
                <tr><td>${L('paybackPeriod')}</td><td>${SAFE.payback(ind.paybackPeriod ?? ind.payback)}</td><td>${(() => { const p = ind.paybackPeriod ?? ind.payback; if (p == null || !Number.isFinite(p) || p <= 0) return 'غير محقق — يحتاج مراجعة'; return p < 5 ? 'مناسب' : 'طويل نسبياً'; })()}</td></tr>
                <tr><td>${L('totalCapex')}</td><td>${_fmt(cap.total || financing.totalInvestment || 0)}</td><td>ريال</td></tr>
            </table>
        </div>`;
            case 'financing_structure':
                return `<div class="bank-section">
            <div class="bank-section-title">${n}. هيكل التمويل المطلوب</div>
            <table class="bank-table">
                <tr><th>المصدر</th><th>المبلغ (ريال)</th><th>النسبة</th></tr>
                ${this._renderFinancingRows(financing, cap.total)}
                <tr class="total-row"><td>الإجمالي</td><td>${_fmt(cap.total || financing.totalInvestment || 0)}</td><td>100%</td></tr>
            </table>
        </div>`;
            case 'income_statement':
                if (!incomeY1) return '';
                return `<div class="bank-section">
            <div class="bank-section-title">${n}. قائمة الدخل المتوقعة (السنة الأولى)</div>
            <table class="bank-table">
                <tr><th>البند</th><th>المبلغ (ريال)</th></tr>
                <tr><td>إجمالي الإيرادات</td><td>${_fmt(incomeY1.revenue || 0)}</td></tr>
                <tr><td>(-) تكلفة المبيعات</td><td>${_fmt(incomeY1.variableCosts || 0)}</td></tr>
                <tr><td>(=) مجمل الربح</td><td>${_fmt(incomeY1.grossProfit || 0)}</td></tr>
                <tr><td>(-) المصاريف التشغيلية</td><td>${_fmt(incomeY1.fixedCosts || 0)}</td></tr>
                <tr><td>(-) الاستهلاك</td><td>${_fmt(incomeY1.depreciation || 0)}</td></tr>
                ${incomeY1.interest ? `<tr><td>(-) فوائد التمويل</td><td>${_fmt(incomeY1.interest)}</td></tr>` : ''}
                <tr><td>(-) الزكاة</td><td>${_fmt(incomeY1.zakat || 0)}</td></tr>
                ${incomeY1.tax ? `<tr><td>(-) ضريبة الدخل (حصة الأجانب)</td><td>${_fmt(incomeY1.tax)}</td></tr>` : ''}
                <tr class="total-row"><td>(=) صافي الربح</td><td>${_fmt(incomeY1.netIncome || 0)}</td></tr>
            </table>
        </div>`;
            case 'loan_schedule':
                if (!loan || loan.loanAmount <= 0) return '';
                return `<div class="bank-section">
            <div class="bank-section-title">${n}. جدول سداد القرض المقترح</div>
            <p style="margin-bottom:12px;"><strong>مبلغ القرض:</strong> ${_fmt(loan.loanAmount)} | <strong>المعدل:</strong> ${((loan.annualRate || 0) * 100).toFixed(1)}% | <strong>المدة:</strong> ${loan.termYears || 0} سنة | <strong>القسط الشهري:</strong> ${_fmt(loan.monthlyPayment || 0)}</p>
            <table class="bank-table">
                <tr><th>السنة</th><th>الرصيد الافتتاحي</th><th>إجمالي المدفوعات</th><th>الفائدة</th><th>الأصل</th><th>الرصيد المتبقي</th></tr>
                ${(loan.annualSummary || []).map(y => `
                <tr>
                    <td>${y.year}</td>
                    <td>${_fmt(y.beginningBalance)}</td>
                    <td>${_fmt(y.totalPayment)}</td>
                    <td>${_fmt(y.totalInterest)}</td>
                    <td>${_fmt(y.totalPrincipal)}</td>
                    <td>${_fmt(y.endingBalance)}</td>
                </tr>
                `).join('')}
            </table>
        </div>`;
            case 'risks':
                if (!(state.riskAnalysis?.risks || []).length) return '';
                return `<div class="bank-section">
            <div class="bank-section-title">${n}. أبرز المخاطر وخطط المواجهة</div>
            <table class="bank-table">
                <tr><th>المخاطر</th><th>الاحتمالية</th><th>التأثير</th><th>خطة المواجهة</th></tr>
                ${(state.riskAnalysis.risks || []).slice(0, 5).map(r => `
                <tr>
                    <td>${(r.name || r.risk || r.description || '-')}</td>
                    <td>${r.probability || '-'}</td>
                    <td>${r.impact || '-'}</td>
                    <td>${(r.mitigation || '-').toString().slice(0, 80)}${(r.mitigation || '').length > 80 ? '...' : ''}</td>
                </tr>
                `).join('')}
            </table>
        </div>`;
            case 'recommendation':
                return `<div class="bank-section">
            <div class="bank-section-title">${n}. التوصية النهائية لطلب التمويل</div>
            ${this._renderRecommendation(results)}
        </div>`;
            default:
                return '';
        }
    }

    static _renderFinancingRows(financing, capTotal) {
        const sources = financing.sources || {};
        // النسب تُحسب على نفس الإجمالي المطبوع في صف «الإجمالي» (إجمالي المحرك أولاً) —
        // كانت تُحسب على مدخل المستخدم فتظهر نسب لا تساوي 100% من الرقم المطبوع
        const total = (Number(capTotal) > 0 ? Number(capTotal) : 0) || financing.totalInvestment ||
            (sources.equity?.amount || 0) + (sources.bankLoan?.amount || 0) + (sources.investors?.amount || 0) + (sources.governmentSupport?.amount || 0) || 1;
        const rows = [];
        const map = [
            { key: 'equity', label: 'تمويل ذاتي (رأس المال)', amount: sources.equity?.amount },
            { key: 'bankLoan', label: 'قرض بنكي مطلوب', amount: sources.bankLoan?.amount },
            { key: 'investors', label: 'مستثمرون', amount: sources.investors?.amount },
            { key: 'governmentSupport', label: 'دعم حكومي', amount: sources.governmentSupport?.amount },
        ];
        map.forEach(({ label, amount }) => {
            const amt = Number(amount) || 0;
            if (amt > 0) {
                const pct = total > 0 ? ((amt / total) * 100).toFixed(1) : 0;
                rows.push(`<tr><td>${label}</td><td>${new Intl.NumberFormat('ar-SA').format(amt)}</td><td>${pct}%</td></tr>`);
            }
        });
        if (rows.length === 0) {
            const amt = Number(financing.totalInvestment) || 0;
            rows.push(`<tr><td>تمويل ذاتي</td><td>${new Intl.NumberFormat('ar-SA').format(amt)}</td><td>100%</td></tr>`);
        }
        return rows.join('');
    }

    static _renderRecommendation(results) {
        const decision = results.decision || 'REVISE';
        const reasons = results.decisionReasons || [];
        const reasonStr = Array.isArray(reasons) && reasons.length ? reasons.slice(0, 2).map(r => typeof r === 'string' ? r : (r?.text || r?.reason || '')).filter(Boolean).join('؛ ') : '';

        const cls = decision === 'GO' ? '' : decision === 'NO-GO' ? 'no-go' : 'revise';
        const msg = decision === 'GO'
            ? `بناءً على التحليل المالي، المشروع يحقق مؤشرات إيجابية (NPV موجب، IRR مقبول). يُوصى بالموافقة على طلب التمويل مع مراعاة الضمانات والشروط المعتادة.`
            : decision === 'NO-GO'
                ? `المؤشرات المالية لا تحقق الحدود الدنيا. لا يُوصى بالموافقة على التمويل في ظل الافتراضات الحالية. ${reasonStr}`
                : `بعض المؤشرات دون المستوى. يُوصى بمراجعة الافتراضات (التكاليف، الإيرادات، الهيكل التمويلي) قبل التقديم. ${reasonStr}`;

        return `<div class="bank-recommendation ${cls}"><p>${msg}</p></div>`;
    }
}
