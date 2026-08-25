import { calculateStudy } from '../core/engine.js';
import { runQAChecks } from '../utils/qaChecks.js';
import { buildDecisionQualityGate } from '../utils/decisionQuality.js';
import { buildIndicatorInsights } from '../utils/indicatorInsights.js';
import { escapeHtml } from '../utils/escape.js';
import { formatIrrPct } from '../utils/indicatorFormat.js';
import { attachModalA11y } from '../utils/modalA11y.js';

const money = (value) => new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(Number(value) || 0);

export class ReportPreviewModal {
    constructor(store, overlayId = 'reportPreviewOverlay', onClose = null) {
        this.store = store;
        this.onClose = typeof onClose === 'function' ? onClose : null;
        this.overlay = document.getElementById(overlayId) || document.createElement('div');
        this.overlay.id = overlayId;
        this.overlay.classList.add('modal-overlay', 'report-preview-overlay');
        if (!this.overlay.isConnected) document.body.appendChild(this.overlay);
    }

    async open(formatLabel = 'التقرير الاحترافي') {
        const state = this.store?.getState?.() || {};
        let results = state.results || {};
        try { results = calculateStudy(state); } catch {}
        let qa = { hardErrors: [], softWarnings: [], validationErrors: [], validationWarnings: [] };
        try { qa = await runQAChecks(state, results); } catch {}
        const gate = buildDecisionQualityGate(qa);
        const insights = buildIndicatorInsights(results, state);
        const ind = results?.indicators || {};
        const projectName = state?.projectInfo?.name || 'مشروعك';

        this.overlay.innerHTML = `<div class="modal-card report-preview-modal animate-scale-in" role="dialog" aria-modal="true" aria-labelledby="report-preview-title">
            <div class="modal-header">
                <div><span class="report-preview-kicker">معاينة مجانية قبل الشراء</span><h3 id="report-preview-title">${escapeHtml(formatLabel)}</h3></div>
                <button type="button" class="btn-close report-preview-close" aria-label="إغلاق المعاينة">×</button>
            </div>
            <div class="modal-body report-preview-body">
                <section class="report-preview-page report-preview-cover">
                    <span class="report-preview-watermark">معاينة</span>
                    <div class="report-preview-logo">قرار</div>
                    <h2>دراسة جدوى — ${escapeHtml(projectName)}</h2>
                    <p>نسخة توضيحية بعلامة مائية تعرض شكل التقرير وبعض بيانات دراستك.</p>
                    <div class="report-preview-readiness"><strong>${gate.score}%</strong><span>جاهزية البيانات</span></div>
                </section>
                <section class="report-preview-page">
                    <span class="report-preview-watermark">معاينة</span>
                    <h3>صفحة نموذجية: المؤشرات المالية</h3>
                    <div class="report-preview-kpis">
                        <div><span>صافي القيمة الحالية</span><strong>${money(ind.npv)}</strong></div>
                        <div><span>العائد الداخلي</span><strong>${formatIrrPct(ind.irr)}</strong></div>
                        <div><span>فترة الاسترداد</span><strong>${Number.isFinite(ind.paybackPeriod) && ind.paybackPeriod > 0 ? Number(ind.paybackPeriod).toFixed(1) + ' سنة' : 'غير محقق'}</strong></div>
                    </div>
                    ${insights.slice(0, 2).map(item => `<article class="report-preview-insight"><strong>${escapeHtml(item.label)}</strong><p>${escapeHtml(item.meaning)}</p><small>مصدر الرقم: ${escapeHtml(item.source)}</small></article>`).join('')}
                </section>
                <section class="report-preview-page report-preview-locked">
                    <span class="report-preview-watermark">معاينة</span>
                    <h3>ما تتضمنه النسخة الكاملة</h3>
                    <ul><li>الملخص التنفيذي والقرار المفسر</li><li>القوائم المالية والتدفقات والميزانية</li><li>تحليل الحساسية والسيناريوهات</li><li>طلب التمويل واستخدام الأموال وDSCR</li><li>المخاطر والمصادر والمرفقات</li></ul>
                    <div class="report-preview-lock">تُفتح الصفحات الكاملة بلا علامة مائية بعد اختيار الباقة المناسبة.</div>
                </section>
            </div>
            <div class="modal-footer report-preview-footer"><span>هذه المعاينة لا تُعد تقريراً نهائياً للتقديم.</span><button type="button" class="btn btn--primary report-preview-close">العودة للباقات</button></div>
        </div>`;
        this._previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        this.overlay.classList.add('is-open');
        this.overlay.querySelectorAll('.report-preview-close').forEach(btn => btn.addEventListener('click', () => this.close()));
        this.overlay.onclick = (event) => { if (event.target === this.overlay) this.close(); };
        this._a11y = attachModalA11y({
            container: this.overlay,
            labelledBy: 'report-preview-title',
            initialFocus: '.report-preview-close',
            onEscape: () => this.close()
        });
    }

    close() {
        if (!this.overlay.classList.contains('is-open')) return;
        this.overlay.classList.remove('is-open');
        document.body.style.overflow = this._previousOverflow || '';
        this._a11y?.release();
        this._a11y = null;
        this.onClose?.();
    }
}
