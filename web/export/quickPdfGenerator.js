/**
 * تقرير PDF مختصر لمسار "جدوى سريعة": غلاف، ملخص تنفيذي، جدول مالي أساسي، توصية.
 * يُفتح في نافذة جديدة للطباعة (حفظ كـ PDF).
 * ترتيب الأقسام: يُطبَّق state.reportSectionOrder عند وجوده (المهمة 72 — توحيد مع ReportGenerator).
 */
import { sanitizeFilename, exportDateISO } from './utils.js';

/** أقسام تقرير الجدوى السريعة (قابلة للربط مع reportSectionOrder). */
const QUICK_PDF_SECTION_IDS = ['executive_summary', 'financial_kpis', 'recommendation'];

function fmtNum(n) {
    if (n == null || !Number.isFinite(n)) return '—';
    return new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 0 }).format(n);
}

function fmtCur(n) {
    if (n == null || !Number.isFinite(n)) return '—';
    return new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(n);
}

export class QuickPDFGenerator {
    constructor(quickData, result, storeOrSectionOrder = null, options = {}) {
        this.quickData = quickData;
        this.result = result;
        this.storeOrSectionOrder = storeOrSectionOrder;
        this.warnings = Array.isArray(options.warnings) ? options.warnings : [];
    }

    /** ترتيب أقسام تقرير الجدوى السريعة: يتبع reportSectionOrder إن وُجد، مع إلحاق أي قسم غير مذكور. */
    getQuickSectionOrder() {
        let userOrder = [];
        if (this.storeOrSectionOrder) {
            if (Array.isArray(this.storeOrSectionOrder)) {
                userOrder = this.storeOrSectionOrder;
            } else {
                const state = typeof this.storeOrSectionOrder.getState === 'function' ? this.storeOrSectionOrder.getState() : (this.storeOrSectionOrder.get && this.storeOrSectionOrder.get());
                userOrder = (state?.reportSectionOrder && state.reportSectionOrder.length) ? state.reportSectionOrder : [];
            }
        }
        const ordered = userOrder.filter(id => QUICK_PDF_SECTION_IDS.includes(id));
        for (const id of QUICK_PDF_SECTION_IDS) {
            if (!ordered.includes(id)) ordered.push(id);
        }
        return ordered;
    }

    /** يُرجع HTML لقسم واحد حسب المعرّف. */
    renderSection(sectionId) {
        const d = this.quickData;
        const r = this.result;
        const projectName = d.projectName || 'مشروع جديد';
        const recLabel = r.recommendationLabel || '—';
        const recClass = r.recommendation === 'go' ? '#38a169' : r.recommendation === 'revise' ? '#d69e2e' : '#e53e3e';

        switch (sectionId) {
            case 'executive_summary':
                return `<div class="section">
            <div class="section-title">الملخص التنفيذي</div>
            <p>تم تقييم المشروع <strong>${projectName}</strong> بناءً على المدخلات الأساسية (الإيراد الشهري المتوقع، التكاليف التشغيلية، الاستثمار الأولي، ومصدر التمويل). النتائج المالية المبسطة والتوصية أدناه تُعد مؤشراً أولياً فقط ولا تغني عن دراسة جدوى تفصيلية عند التقديم للتمويل أو الجهات المعنية.</p>
        </div>`;
            case 'financial_kpis':
                return `<div class="section">
            <div class="section-title">الجدول المالي الأساسي</div>
            <table>
                <tr><th>البند</th><th>القيمة</th></tr>
                <tr><td>الإيراد السنوي المتوقع</td><td>${fmtCur(r.annualRevenue)}</td></tr>
                <tr><td>التكاليف التشغيلية السنوية</td><td>${fmtCur(r.annualCosts)}</td></tr>
                <tr><td>صافي التدفق السنوي (بعد التكاليف والتمويل)</td><td>${fmtCur(r.annualNet)}</td></tr>
                <tr><td>صافي القيمة الحالية (NPV) — 5 سنوات، خصم 10%</td><td>${fmtCur(r.npv)}</td></tr>
                <tr><td>فترة الاسترداد (سنوات)</td><td>${r.paybackYears != null ? r.paybackYears + ' سنة' : '—'}</td></tr>
                <tr><td>نقطة التعادل (ريال/شهر)</td><td>${fmtCur(r.breakevenMonthly)}</td></tr>
            </table>
        </div>`;
            case 'recommendation':
                return `<div class="section">
            <div class="section-title">التوصية</div>
            <div class="recommendation" style="background: ${recClass}22; color: ${recClass}; border: 2px solid ${recClass};">
                ${recLabel}
            </div>
        </div>`;
            default:
                return '';
        }
    }

    /** قسم «ملاحظات وتنبيهات» — يُدرج تحذيرات بوابة الجودة في التقرير كي لا يخرج «GO» أعمى. */
    renderWarnings() {
        if (!this.warnings.length) return '';
        const items = this.warnings.map(w => `<li>${(w.text || w).toString()}</li>`).join('');
        return `<div class="caveats">
            <h3>ملاحظات مهمة قبل الاعتماد على هذه النتيجة</h3>
            <ul>${items}</ul>
        </div>`;
    }

    generateHTML() {
        const d = this.quickData;
        const r = this.result;
        const date = new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
        const projectName = d.projectName || 'مشروع جديد';
        const sector = d.sector || '—';
        const city = d.city || '—';

        const sectionOrder = this.getQuickSectionOrder();
        const sectionsHtml = sectionOrder.map(id => this.renderSection(id)).filter(Boolean).join('\n        ');
        const warningsHtml = this.renderWarnings();

        // ملاحظة: لا نُدرج <link> لخط خارجي — عند الطباعة من نافذة about:blank كان مسار
        // "/fonts/fonts.css" يفشل في التحميل فيعلّق المتصفح (النافذة البيضاء + التجمّد 40ث).
        // نعتمد خطوطاً موجودة في النظام (Segoe UI/Tahoma) لعرض عربي سليم فوراً.
        return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>جدوى سريعة - ${projectName}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page { size: A4; margin: 2cm 1.5cm; }
        body {
            font-family: 'IBM Plex Sans Arabic', 'Segoe UI', Tahoma, Arial, sans-serif;
            font-size: 11pt;
            line-height: 1.7;
            color: #1a202c;
            background: #fff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        .report-container { max-width: 21cm; margin: 0 auto; padding: 20px; }
        .report-header {
            text-align: center;
            padding: 40px 30px;
            background: linear-gradient(135deg, #1a1f2e 0%, #2d3748 100%);
            color: #fff;
            border-radius: 8px 8px 0 0;
            border-bottom: 3px solid #d9a84e;
            margin-bottom: 30px;
        }
        .report-header h1 { font-size: 26pt; color: #d9a84e; margin-bottom: 8px; }
        .report-header h2 { font-size: 14pt; font-weight: 500; color: #cbd5e0; }
        .report-meta { margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(217,168,78,0.3); font-size: 10pt; color: #a0aec0; }
        .section { margin-bottom: 28px; page-break-inside: avoid; }
        .section-title { font-size: 14pt; font-weight: 700; color: #2c5282; padding: 8px 0; border-bottom: 2px solid #e2e8f0; margin-bottom: 12px; }
        table { width: 100%; border-collapse: collapse; margin: 12px 0; }
        th, td { padding: 10px 14px; text-align: right; border: 1px solid #e2e8f0; }
        th { background: #f7fafc; font-weight: 600; }
        .recommendation { padding: 16px; border-radius: 8px; text-align: center; font-size: 14pt; font-weight: 700; margin: 16px 0; }
        .caveats { margin: 20px 0; padding: 14px 18px; background: #fffaf0; border: 1px solid #dd9b3c; border-right: 4px solid #dd9b3c; border-radius: 6px; page-break-inside: avoid; }
        .caveats h3 { font-size: 12pt; color: #b7791f; margin-bottom: 8px; }
        .caveats ul { margin: 0; padding-inline-start: 20px; }
        .caveats li { font-size: 10pt; color: #744210; margin-bottom: 6px; line-height: 1.6; }
        .disclaimer { font-size: 9pt; color: #718096; margin-top: 24px; padding: 12px; background: #f7fafc; border-radius: 6px; }
    </style>
</head>
<body>
    <div class="report-container">
        <div class="report-header">
            <h1>تقرير جدوى سريعة</h1>
            <h2>${projectName}</h2>
            <div class="report-meta">${date} | القطاع: ${sector} | الموقع: ${city}</div>
        </div>

        ${sectionsHtml}
        ${warningsHtml}

        <div class="disclaimer">
            هذا التقرير مبني على معايير دراسات جدوى متوافقة مع أفضل الممارسات المحلية (رؤية 2030، منشآت، بنك التنمية السعودي). لا يُعد اعتماداً رسمياً من أي جهة إلا بموجب اتفاق. للدراسة التفصيلية استخدم المسار الكامل في المنصة.
        </div>
    </div>
</body>
</html>`;
    }

    async generate() {
        const html = this.generateHTML();
        const base = sanitizeFilename(this.quickData.projectName || 'جدوى_سريعة');
        const fileName = `${base}_${exportDateISO()}.pdf`;

        const win = window.open('', '_blank');
        if (!win) {
            throw new Error('تعذر فتح نافذة الطباعة. يرجى السماح بالنوافذ المنبثقة لهذا الموقع ثم إعادة المحاولة.');
        }
        win.document.open();
        win.document.write(html);
        win.document.close();

        // اطبع بعد اكتمال تحميل المستند (لا مهلة ثابتة قد تسبق الجاهزية) — مع حارس ضد الطباعة المزدوجة.
        let printed = false;
        const triggerPrint = () => {
            if (printed) return;
            printed = true;
            try { win.focus(); win.print(); } catch (_) { /* بعض المتصفحات تمنع، نتجاهل */ }
        };
        if (win.document.readyState === 'complete') {
            setTimeout(triggerPrint, 200);
        } else {
            win.addEventListener('load', () => setTimeout(triggerPrint, 150));
            setTimeout(triggerPrint, 1200); // احتياط إن لم يُطلق load
        }
        return fileName;
    }
}
