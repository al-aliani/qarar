/**
 * PDF Report Generator
 * Generates feasibility study reports via window.print() for proper Arabic/RTL support.
 * Uses ReportGenerator for HTML; user saves as PDF from print dialog.
 */

import { ReportGenerator } from '../js/services/ReportGenerator.js';
import { sanitizeFilename, exportDateISO } from './utils.js';

export class PDFGenerator {
    constructor(store) {
        this.store = store;
    }

    _getState() {
        const s = this.store;
        return (typeof s.getState === 'function' ? s.getState() : null) ?? (typeof s.get === 'function' ? s.get() : null) ?? {};
    }

    /**
     * Open print-ready report in new window (user chooses "Save as PDF").
     * @param {{lang?: 'ar'|'en'}} [options] - lang يُمرَّر لـReportGenerator (النطاق: القوائم
     * المالية والمؤشرات فقط تُصدَّر بعناوين إنجليزية عند 'en' — لا الأقسام النصية للمستخدم).
     *
     * تدقيق 2026-07-17: أُعيد هذا الأسلوب بعد تجربة استبداله بـhtml2pdf.js (raster عبر
     * html2canvas). ذاك الاستبدال كان يفقد أمرين حقيقيين لتقرير رسمي مدفوع: (1) نص
     * قابل للتحديد/البحث/النسخ يتحول لصورة JPEG مضمّنة، (2) قواعد `page-break-inside:
     * avoid`/`.page-break` الموجودة أصلاً في ReportGenerator.js (مصمَّمة لمحرك الطباعة
     * الأصلي) لا معنى لها إطلاقاً لـhtml2canvas — يُقصّ الجدول الطويل من المنتصف عند
     * حد الصفحة بلا أي احترام لهذه القواعد لأن html2pdf().set() هنا لم يُفعّل خيار
     * pagebreak أصلاً. الطباعة الأصلية تحترم هذه القواعد فعلياً عبر محرك المتصفح.
     */
    async generate(options = {}) {
        const state = this._getState();
        const projectName = state?.projectInfo?.name || 'دراسة جدوى';

        const html = ReportGenerator.generateHTML(this.store, options);
        const win = window.open('', '_blank');

        if (!win) {
            alert('تعذر فتح نافذة جديدة للطباعة. يرجى السماح بالنوافذ المنبثقة.');
            return null;
        }

        win.document.write(html);
        win.document.close();
        win.focus();

        setTimeout(() => win.print(), 250);

        const base = sanitizeFilename(projectName || 'study');
        return `${base}_${exportDateISO()}.pdf`;
    }

    /**
     * Same as generate(); full report. Summary-only variant could use a separate ReportGenerator method later.
     */
    async generateSummary() {
        return this.generate();
    }
}
