/**
 * تقرير تمويل بنكي مخصص — مُؤكّد الاستخدام
 * متوافق مع متطلبات بنك التنمية الاجتماعية وبرامج التمويل (تمويل رواد الأعمال، ريادة، كفالة).
 * المصطلحات والألوان مطابقة لنماذج بنك التنمية الاجتماعية ومنشآت — ليبدو التقرير صادراً من جهة رسمية.
 * ترتيب الأقسام: يُطبَّق state.reportSectionOrder عند وجوده (المهمة 66 — توحيد مع ReportGenerator).
 */

import { formatCurrency } from '../js/utils/formatters.js';
import { SAFE } from './utils.js';
import { formatIrrPct } from '../js/utils/indicatorFormat.js';
import { calculateStudy as runFullModel } from '../js/core/engine.js';
import { validateStudy } from '../js/utils/validation.js';
import { getLabelSDB } from '../js/core/regulatoryLabels.js';
import { BANK_COMPLIANCE_SENTENCE } from '../js/config.js';
import { getOptionLabel } from '../js/core/fieldOptions.js';
import { buildFinancingDiagnostics } from '../js/utils/financingDiagnostics.js';
import { buildIndicatorInsights } from '../js/utils/indicatorInsights.js';

/** أقسام تقرير البنك (معرّفات قابلة للربط مع reportSectionOrder). */
const BANK_SECTION_IDS = [
    'executive_summary',
    'loan_request',
    'market_evidence',
    'financial_kpis',
    'indicator_explanations',
    'financing_structure',
    'collateral',
    'income_statement',
    'loan_schedule',
    'legal_readiness',
    'risks',
    'application_checklist',
    'recommendation'
];

/** تسمية جهة التمويل على غلاف التقرير حسب البنك المختار في هيكل التمويل. */
const BANK_VARIANT_LABELS = {
    rajhi: 'مصرف الراجحي',
    ncb: 'البنك الأهلي السعودي (SNB)',
    riyad: 'بنك الرياض',
    other: 'جهة التمويل',
};

const GUARANTEE_TYPE_LABELS = {
    mortgage: 'رهن عقار/معدات',
    personal: 'كفالة شخصية',
    kafalah: 'كفالة صندوق الكفالة',
    salaryAssignment: 'تحويل راتب',
    other: 'أخرى',
};

function bankEsc(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export class BankReportGenerator {

    static calculateResults(state) {
        try {
            return runFullModel(state);
        } catch {
            console.error('Bank report calc error', e);
            return {};
        }
    }

    static _getFinancingDiagnostics(state, results) {
        return buildFinancingDiagnostics(state, results);
    }

    static _renderFinancingGate(state, results, _fmt) {
        const d = this._getFinancingDiagnostics(state, results);
        const gapThreshold = d.fundingGapThreshold ?? 1;
        if (d.bankReady && !d.loanAmount && Math.abs(d.fundingGap) <= gapThreshold) return '';
        const gapText = d.fundingGap > gapThreshold
            ? _fmt(d.fundingGap)
            : d.fundingGap < -gapThreshold
                ? 'فائض ' + _fmt(Math.abs(d.fundingGap))
                : 'متوازن';
        const dscrText = d.dscr == null
            ? (d.dscrReason === 'no_debt_service' ? 'لا توجد خدمة دين في السنة الأولى' : 'CFADS صفر أو سالب')
            : Number(d.dscr).toFixed(2) + 'x';
        const cls = d.bankReady ? 'bank-recommendation' : 'bank-recommendation revise';
        const bankText = d.bankReady
            ? 'جاهز بنكياً مبدئياً حسب التمويل وDSCR.'
            : 'مراجعة مطلوبة قبل تقديم الملف للبنك.';
        const saasText = d.isSaas
            ? '<p style="margin-top:8px;">قراءة المستثمر في مشاريع SaaS قد تقبل خسارة سنة أولى إذا وُجد نمو مثبت، لكن البنك يركز على تغطية خدمة الدين والتدفقات المبكرة.</p>'
            : '';
        return `<div class="${cls}">
            <p><strong>حاجز التمويل:</strong> ${bankText}</p>
            <table class="bank-table">
                <tr><th>المؤشر</th><th>القيمة</th><th>القراءة البنكية</th></tr>
                <tr><td>فجوة التمويل</td><td>${gapText}</td><td>${Math.abs(d.fundingGap) > gapThreshold ? 'يجب مطابقتها مع الاستثمار' : 'مقبولة'}</td></tr>
                <tr><td>DSCR السنة الأولى</td><td>${dscrText}</td><td>${d.dscrBlocked ? 'دون الحد المستهدف ' + d.targetDSCR.toFixed(2) + 'x' : 'مقبول مبدئياً'}</td></tr>
                <tr><td>EBITDA السنة الأولى</td><td>${Number.isFinite(d.y1Ebitda) ? _fmt(d.y1Ebitda) : 'غير متاح'}</td><td>${d.y1Ebitda < 0 ? 'سالب؛ راجع فترة السماح أو التمويل الذاتي' : 'موجب'}</td></tr>
            </table>
            ${saasText}
        </div>`;
    }

    /**
     * @param {object} store - Store instance
     * @param {{ certification?: {reviewerName: string, certificateId: string, certifiedAt: string}, bankVariant?: 'rajhi'|'ncb'|'riyad'|'other' }} [options]
     *   certification: تمرَّر فقط إن وُجد طلب "مراجَع بخبير" معتمَد فعلياً لهذه الدراسة
     *   (انظر ReviewerService.getCertificationForStudy) — بدونها تُعرض خانة الاعتماد فارغة.
     *   bankVariant: افتراضياً من state.financing.sources.bankLoan.bank إن لم يُمرَّر صراحة.
     */
    static generateHTML(store, options = {}) {
        const state = store.getState ? store.getState() : store.get();
        const info = state.projectInfo || {};
        const studyTypeLabel = getOptionLabel('studyType', info.studyType);
        const studyRecipientLabel = getOptionLabel('studyRecipientType', info.studyRecipientType);
        const { certification = null } = options;
        const bankVariant = options.bankVariant || state.financing?.sources?.bankLoan?.bank || 'other';
        const bankLabel = BANK_VARIANT_LABELS[bankVariant] || BANK_VARIANT_LABELS.other;

        let results;
        try {
            results = this.calculateResults(state);
            if (store && typeof store.update === 'function') {
                store.update('results', results);
            }
        } catch {
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
            ${(info.clientName || '').trim() ? `<p style="margin-top:8px;font-size:12pt;">أُعدت هذه الدراسة لصالح: <strong>${String(info.clientName).replace(/</g, '&lt;')}</strong></p>` : ''}
            ${(info.preparedBy || '').trim() ? `<p style="margin-top:2px;font-size:10pt;color:#718096;">إعداد: ${String(info.preparedBy).replace(/</g, '&lt;')}</p>` : ''}
            <p style="margin-top:8px;font-size:10pt;color:#4a5568;">نوع الدراسة: <strong>${studyTypeLabel || 'غير محدد'}</strong> | لمن تُعد: <strong>${studyRecipientLabel || 'غير محدد'}</strong></p>
            <p style="margin-top:12px;font-size:10pt;color:#718096;">أُعدّ باتباع الهيكل الاسترشادي لجهات التمويل المحلية (${bankLabel}، منشآت) | ${date}</p>
            <p style="margin-top:6px;font-size:9pt;color:#4a5568;">بنية التقرير مناسبة للإقراض: ملخص تنفيذي، استخدام التمويل، القوائم المالية، الضمانات.</p>
            <p style="margin-top:4px;font-size:8.5pt;color:#718096;">مصدر الأرقام: محرك قرار المالي — نسخة الحساب الحالية — وبيانات المستخدم حتى لحظة إنشاء التقرير.</p>
        </div>
        ${validationNotice}

        ${sectionsHtml}

        ${this._renderCertificationBlock(certification)}

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

    /** خانة توثيق/اعتماد — فارغة افتراضياً؛ تُملأ فقط عند تمرير certification فعلي. */
    static _renderCertificationBlock(certification) {
        if (!certification || !certification.certificateId) {
            return `<div class="bank-section" style="border:1px dashed #cbd5e0;padding:16px;text-align:center;color:#a0aec0;">
                <p>لم تتم مراجعة هذه الدراسة من خبير معتمد بعد.</p>
            </div>`;
        }
        const certifiedDate = certification.certifiedAt
            ? new Date(certification.certifiedAt).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })
            : '-';
        return `<div class="bank-section" style="border:2px solid var(--sdb-green,#276749);border-radius:8px;padding:16px;background:#f0fff4;">
            <div class="bank-section-title" style="color:var(--sdb-green,#276749);border-bottom-color:var(--sdb-green,#276749);">✓ معتمدة من مراجع خبير</div>
            <table class="bank-table">
                <tr><th>المراجع</th><td>${bankEsc(certification.reviewerName || 'مراجع معتمد')}</td></tr>
                <tr><th>رقم الشهادة</th><td>${bankEsc(certification.certificateId)}</td></tr>
                <tr><th>تاريخ الاعتماد</th><td>${bankEsc(certifiedDate)}</td></tr>
            </table>
        </div>`;
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
            case 'loan_request': {
                const structure = cap?.capitalStructure || {};
                const uses = [
                    ['التأسيس والتراخيص وما قبل الافتتاح', structure.establishment?.total],
                    ['الأصول والمعدات والتجهيزات', structure.investment?.total],
                    ['رأس المال العامل والمخزون الافتتاحي', structure.operating?.total]
                ].filter(([, value]) => Number(value) > 0);
                return `<div class="bank-section">
            <div class="bank-section-title">${n}. طلب التمويل واستخدام الأموال</div>
            <p><strong>مبلغ القرض المطلوب:</strong> ${_fmt(Number(financing?.sources?.bankLoan?.amount || loan?.loanAmount || 0))}</p>
            <p><strong>مساهمة المالك:</strong> ${_fmt(Number(financing?.sources?.equity?.amount || 0))}</p>
            <table class="bank-table">
                <tr><th>استخدام الاستثمار</th><th>المبلغ</th><th>مصدر الرقم</th></tr>
                ${uses.map(([label, value]) => `<tr><td>${label}</td><td>${_fmt(value)}</td><td>محسوب من بنود الدراسة المدخلة</td></tr>`).join('') || '<tr><td colspan="3">لم تُدرج بنود استخدام الأموال بعد.</td></tr>'}
                <tr class="total-row"><td>إجمالي الاستثمار المطلوب</td><td>${_fmt(cap?.total || 0)}</td><td>محرك الحساب المالي</td></tr>
            </table>
        </div>`;
            }
            case 'market_evidence': {
                const ms = state.marketSizing || {};
                const ma = state.marketing?.marketAnalysis || {};
                const competitors = state.marketing?.competitors || [];
                const hasMarket = ma.summary || ma.description || ma.trends || ms.tam?.value || ms.sam?.value || ms.som?.value || competitors.length;
                if (!hasMarket) return '';
                const marketRows = [
                    ma.summary || ma.description ? ['ملخص السوق', ma.summary || ma.description] : null,
                    ma.trends ? ['اتجاهات السوق', ma.trends] : null,
                    ms.targetDistrict || ms.targetNeighborhood || info.district ? ['النطاق الجغرافي', [ms.targetDistrict, ms.targetNeighborhood, info.district].filter(Boolean).join(' - ')] : null,
                    ms.tam?.value ? ['TAM', [_fmt(ms.tam.value), ms.tam.description].filter(Boolean).join(' - ')] : null,
                    ms.sam?.value ? ['SAM', [_fmt(ms.sam.value), ms.sam.description].filter(Boolean).join(' - ')] : null,
                    ms.som?.value ? ['SOM', [_fmt(ms.som.value), ms.som.description].filter(Boolean).join(' - ')] : null
                ].filter(Boolean);
                const competitorRows = competitors.length ? `
                    <p style="margin-top:12px;"><strong>المنافسون الرئيسيون:</strong></p>
                    <table class="bank-table">
                        <tr><th>المنافس</th><th>القوة</th><th>الضعف</th><th>مؤشر حجمه</th></tr>
                        ${competitors.slice(0, 6).map(c => {
                            if (typeof c === 'string') return `<tr><td>${bankEsc(c)}</td><td>-</td><td>-</td><td>-</td></tr>`;
                            const size = c.marketShare ? `${bankEsc(c.marketShare)}%` : (c.estimatedDailyCustomers ? `${Number(c.estimatedDailyCustomers).toLocaleString('ar-SA')} عميل/يوم` : '-');
                            return `<tr><td>${bankEsc(c.name || '-')}</td><td>${bankEsc(c.strengths || '-')}</td><td>${bankEsc(c.weaknesses || '-')}</td><td>${bankEsc(size)}</td></tr>`;
                        }).join('')}
                    </table>` : '<p style="margin-top:12px;color:#92400e;">تنبيه: لم تُدرج قائمة منافسين محليين بعد. يوصى بإضافتها قبل تقديم الطلب التمويلي.</p>';
                return `<div class="bank-section">
            <div class="bank-section-title">${n}. أدلة السوق والمنافسة</div>
            ${marketRows.length ? `<table class="bank-table"><tr><th>البند</th><th>التفصيل</th></tr>${marketRows.map(([k, v]) => `<tr><td>${bankEsc(k)}</td><td>${bankEsc(v)}</td></tr>`).join('')}</table>` : ''}
            ${competitorRows}
        </div>`;
            }
            case 'financial_kpis':
                {
                const financingGate = this._getFinancingDiagnostics(state, results);
                const gapThreshold = financingGate.fundingGapThreshold ?? 1;
                return `<div class="bank-section">
            <div class="bank-section-title">${n}. المؤشرات المالية الرئيسية</div>
            <div class="bank-kpi">
                <div class="bank-kpi-card"><div class="label">${L('npv')}</div><div class="value ${(ind.npv || 0) > 0 ? 'positive' : 'negative'}">${_fmt(ind.npv || 0)}</div></div>
                <div class="bank-kpi-card"><div class="label">${L('irr')}</div><div class="value">${formatIrrPct(ind.irr)}</div></div>
                <div class="bank-kpi-card"><div class="label">${L('paybackPeriod')}</div><div class="value">${SAFE.payback(ind.paybackPeriod ?? ind.payback)}</div></div>
                <div class="bank-kpi-card"><div class="label">${L('breakEvenPointValue')}</div><div class="value">${_fmt(ind.breakEvenPointValue || 0)}</div></div>
                <div class="bank-kpi-card"><div class="label">فجوة التمويل</div><div class="value ${Math.abs(financingGate.fundingGap) > gapThreshold ? 'negative' : 'positive'}">${financingGate.fundingGap > gapThreshold ? _fmt(financingGate.fundingGap) : financingGate.fundingGap < -gapThreshold ? 'فائض ' + _fmt(Math.abs(financingGate.fundingGap)) : 'متوازن'}</div></div>
                <div class="bank-kpi-card"><div class="label">DSCR السنة الأولى</div><div class="value ${financingGate.dscrBlocked ? 'negative' : 'positive'}">${financingGate.dscr == null ? 'غير قابل للحساب' : Number(financingGate.dscr).toFixed(2) + 'x'}</div></div>
            </div>
            <table class="bank-table">
                <tr><th>المؤشر</th><th>القيمة</th><th>ملاحظة</th></tr>
                <tr><td>${L('npv')}</td><td>${_fmt(ind.npv || 0)}</td><td>${(ind.npv || 0) > 0 ? 'إيجابي ✓' : 'يحتاج مراجعة'}</td></tr>
                <tr><td>${L('irr')}</td><td>${formatIrrPct(ind.irr, 2)}</td><td>${(ind.irr || 0) >= 0.15 ? 'مقبول للتمويل' : 'تحت الحد المفضل'}</td></tr>
                <tr><td>${L('paybackPeriod')}</td><td>${SAFE.payback(ind.paybackPeriod ?? ind.payback)}</td><td>${(() => { const p = ind.paybackPeriod ?? ind.payback; if (p == null || !Number.isFinite(p) || p <= 0) return 'غير محقق — يحتاج مراجعة'; return p < 5 ? 'مناسب' : 'طويل نسبياً'; })()}</td></tr>
                <tr><td>${L('totalCapex')}</td><td>${_fmt(cap.total || financing.totalInvestment || 0)}</td><td>ريال</td></tr>
                <tr><td>فجوة التمويل</td><td>${financingGate.fundingGap > gapThreshold ? _fmt(financingGate.fundingGap) : financingGate.fundingGap < -gapThreshold ? 'فائض ' + _fmt(Math.abs(financingGate.fundingGap)) : 'متوازن'}</td><td>${Math.abs(financingGate.fundingGap) > gapThreshold ? 'يجب مطابقتها مع الاستثمار قبل التقديم' : 'مقبولة'}</td></tr>
                <tr><td>DSCR السنة الأولى</td><td>${financingGate.dscr == null ? 'غير قابل للحساب' : Number(financingGate.dscr).toFixed(2) + 'x'}</td><td>${financingGate.dscrBlocked ? 'دون الحد البنكي المستهدف' : 'مقبول مبدئياً'}</td></tr>
                ${results?.saudization?.totalHeads > 0 ? `<tr><td>نسبة التوطين (سعودة)</td><td>${Math.round((results.saudization.rate || 0) * 100)}% (${results.saudization.saudiHeads} من ${results.saudization.totalHeads})</td><td>${(results.saudization.rate || 0) > 0 ? 'يدعم متطلبات نطاقات' : 'راجع متطلبات نطاقات'}</td></tr>` : ''}
            </table>
        </div>`;
                }
            case 'indicator_explanations': {
                const insights = buildIndicatorInsights(results, state);
                return `<div class="bank-section">
            <div class="bank-section-title">${n}. كيف تُقرأ المؤشرات ومصدر كل رقم</div>
            <table class="bank-table">
                <tr><th>المؤشر</th><th>القراءة المبسطة</th><th>مصدر الرقم</th><th>الإجراء المقترح</th></tr>
                ${insights.map(item => `<tr><td>${bankEsc(item.label)}</td><td>${bankEsc(item.meaning)}</td><td>${bankEsc(item.source)}</td><td>${bankEsc(item.action)}</td></tr>`).join('')}
            </table>
        </div>`;
            }
            case 'financing_structure':
                return `<div class="bank-section">
            <div class="bank-section-title">${n}. هيكل التمويل المطلوب</div>
            ${this._renderFinancingGate(state, results, _fmt)}
            <table class="bank-table">
                <tr><th>المصدر</th><th>المبلغ (ريال)</th><th>النسبة</th></tr>
                ${this._renderFinancingRows(financing, cap.total)}
                <tr class="total-row"><td>الإجمالي</td><td>${_fmt(cap.total || financing.totalInvestment || 0)}</td><td>100%</td></tr>
            </table>
        </div>`;
            case 'collateral':
                return this._renderCollateralSection(state, results, _fmt, n);
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
                ${(incomeY1.interestExpense ?? incomeY1.interest) ? `<tr><td>(-) فوائد التمويل</td><td>${_fmt(incomeY1.interestExpense ?? incomeY1.interest)}</td></tr>` : ''}
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
            case 'legal_readiness': {
                const licenses = state.legal?.licenses || [];
                const appendices = state.appendices || {};
                const refs = appendices.references || [];
                const quotes = appendices.priceQuotes || [];
                if (!licenses.length && !refs.length && !quotes.length) return '';
                const licenseTable = licenses.length ? `
                    <p><strong>التراخيص والرسوم:</strong></p>
                    <table class="bank-table">
                        <tr><th>البند</th><th>الكمية</th><th>التكلفة</th><th>الإجمالي</th><th>ملاحظات</th></tr>
                        ${licenses.map(l => {
                            const quantity = Number(l.quantity || 1);
                            const price = Number(l.price || 0);
                            const total = Number(l.total || (quantity * price));
                            return `<tr><td>${bankEsc(l.name || l.license || '-')}</td><td>${quantity.toLocaleString('ar-SA')}</td><td>${_fmt(price)}</td><td>${_fmt(total)}</td><td>${bankEsc(l.notes || '-')}</td></tr>`;
                        }).join('')}
                    </table>` : '<p style="color:#92400e;">لم تُدرج التراخيص بعد. أضف التراخيص المطلوبة قبل تقديم الطلب.</p>';
                const quotesList = quotes.length ? `<p style="margin-top:12px;"><strong>عروض الأسعار:</strong></p><ul>${quotes.slice(0, 6).map(q => `<li>${bankEsc(typeof q === 'string' ? q : (q.title || q.notes || q.name || JSON.stringify(q)))}</li>`).join('')}</ul>` : '<p style="margin-top:12px;color:#92400e;">لا توجد عروض أسعار مرفقة للمعدات والتجهيزات.</p>';
                const refsList = refs.length ? `<p style="margin-top:12px;"><strong>المصادر والمراجع:</strong></p><ul>${refs.slice(0, 6).map(r => `<li>${bankEsc([r.title, r.publisher, r.year].filter(Boolean).join(' - ') || r.notes || JSON.stringify(r))}</li>`).join('')}</ul>` : '<p style="margin-top:12px;color:#92400e;">لا توجد مصادر سوقية موثقة في الملاحق.</p>';
                return `<div class="bank-section">
            <div class="bank-section-title">${n}. التراخيص والمرفقات الداعمة</div>
            ${licenseTable}
            ${quotesList}
            ${refsList}
        </div>`;
            }
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
            case 'application_checklist': {
                const diagnostics = this._getFinancingDiagnostics(state, results);
                const checks = [
                    ['اسم المشروع والمدينة والنشاط', Boolean(info.name && (info.city || info.region) && (info.concept || info.sector))],
                    ['تحليل السوق والمنافسين', Boolean((state.marketing?.competitors || []).length >= 2 && (state.marketing?.marketAnalysis?.summary || state.marketSizing?.som?.value))],
                    ['مصادر ومراجع سوقية', Boolean((state.appendices?.references || []).length)],
                    ['عروض أسعار للأصول', Boolean((state.appendices?.priceQuotes || []).length || Number(cap?.subtotal || 0) === 0)],
                    ['التراخيص المطلوبة', Boolean((state.legal?.licenses || []).length)],
                    ['خطة مخاطر وتخفيف', Boolean((state.riskAnalysis?.risks || []).filter(r => r?.mitigation).length >= 5)],
                    ['تطابق التمويل مع الاستثمار', Math.abs(diagnostics.fundingGap) <= diagnostics.fundingGapThreshold],
                    ['تغطية خدمة الدين', !diagnostics.dscrBlocked]
                ];
                const complete = checks.filter(([, ok]) => ok).length;
                return `<div class="bank-section">
            <div class="bank-section-title">${n}. قائمة جاهزية التقديم للممول</div>
            <p><strong>الجاهزية الحالية:</strong> ${complete} من ${checks.length} بنود.</p>
            <table class="bank-table"><tr><th>المتطلب</th><th>الحالة</th></tr>
                ${checks.map(([label, ok]) => `<tr><td>${label}</td><td style="color:${ok ? 'var(--green)' : 'var(--red)'};font-weight:700;">${ok ? 'مكتمل' : 'ناقص'}</td></tr>`).join('')}
            </table>
        </div>`;
            }
            case 'recommendation':
                return `<div class="bank-section">
            <div class="bank-section-title">${n}. التوصية النهائية لطلب التمويل</div>
            ${this._renderFinancingGate(state, results, _fmt)}
            ${this._renderRecommendation(results)}
        </div>`;
            default:
                return '';
        }
    }

    /** قسم الضمانات — يقرأ state.financing.guarantees (موجودة أصلاً عبر FinancingStructure.js)
     *  ويحسب "نسبة تغطية الضمانات" = مجموع قيم الضمانات ÷ مبلغ القرض المطلوب. */
    static _renderCollateralSection(state, results, _fmt, n) {
        const financing = state?.financing || {};
        const guarantees = Array.isArray(financing.guarantees) ? financing.guarantees : [];
        if (!guarantees.length) return '';

        const loanAmount = Number(financing.sources?.bankLoan?.amount || results?.loanSchedule?.loanAmount || 0);
        const totalGuaranteeValue = guarantees.reduce((sum, g) => sum + (Number(g.value) || 0), 0);
        const coverageRatio = loanAmount > 0 ? totalGuaranteeValue / loanAmount : null;
        const coverageText = coverageRatio == null ? 'غير قابل للحساب (لا يوجد مبلغ قرض)' : `${(coverageRatio * 100).toFixed(0)}%`;
        const coverageNote = coverageRatio == null ? '' : coverageRatio >= 1 ? 'تغطية كاملة أو أعلى من قيمة القرض' : 'تغطية جزئية — دون قيمة القرض المطلوب';

        return `<div class="bank-section">
            <div class="bank-section-title">${n}. الضمانات المقدَّمة</div>
            <table class="bank-table">
                <tr><th>نوع الضمان</th><th>الوصف</th><th>القيمة (ريال)</th></tr>
                ${guarantees.map(g => `<tr><td>${bankEsc(GUARANTEE_TYPE_LABELS[g.type] || GUARANTEE_TYPE_LABELS.other)}</td><td>${bankEsc(g.description || '-')}</td><td>${_fmt(Number(g.value) || 0)}</td></tr>`).join('')}
                <tr class="total-row"><td colspan="2">الإجمالي</td><td>${_fmt(totalGuaranteeValue)}</td></tr>
            </table>
            <p style="margin-top:8px;"><strong>نسبة تغطية الضمانات لمبلغ القرض:</strong> ${coverageText} ${coverageNote ? `— ${coverageNote}` : ''}</p>
        </div>`;
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
