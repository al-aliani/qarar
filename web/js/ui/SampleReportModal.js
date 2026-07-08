/**
 * نافذة "اطلع على عينة تقرير" — توضيح الفرق في الجودة بيننا وبين المنافسين.
 * المهمة 1 من خطة التفوق: عرض عينة تقرير بجانب زر "ابدأ".
 * الأنماط معرّفة في css/onboarding-polish.css (سبق أن كانت تعتمد أصناف Tailwind غير موجودة).
 */
import { toast } from '../utils/toast.js';

export class SampleReportModal {
    constructor(options = {}) {
        this.overlay = document.getElementById('sampleReportModalOverlay') || this.createOverlay();
        this.onDownloadSample = options.onDownloadSample || (() => {});
    }

    createOverlay() {
        const el = document.createElement('div');
        el.id = 'sampleReportModalOverlay';
        el.className = 'modal-overlay';
        document.body.appendChild(el);
        return el;
    }

    open() {
        this.render();
        this.overlay.classList.add('is-open');
        document.body.style.overflow = 'hidden';
        this._onEscape = (e) => { if (e.key === 'Escape') this.close(); };
        document.addEventListener('keydown', this._onEscape);
        // نقل التركيز إلى النافذة لإتاحة لوحة المفاتيح فوراً
        this.overlay.querySelector('.btn-close')?.focus();
    }

    close() {
        this.overlay.classList.remove('is-open');
        document.body.style.overflow = '';
        if (this._onEscape) {
            document.removeEventListener('keydown', this._onEscape);
            this._onEscape = null;
        }
    }

    render() {
        this.overlay.innerHTML = `
            <div class="modal-card sample-report-modal animate-scale-in" role="dialog" aria-modal="true" aria-labelledby="sample-report-modal-title">
                <div class="modal-header">
                    <h3 id="sample-report-modal-title">
                        <svg class="ic" aria-hidden="true"><use href="#i-doc"/></svg>
                        اطلع على عينة تقرير
                    </h3>
                    <button type="button" class="btn-close sample-report-close" aria-label="إغلاق النافذة">×</button>
                </div>
                <div class="modal-body" dir="rtl">
                    <p class="sample-report-lead">لاحظ الفرق في الجودة — تقريرنا مفصّل وجاهز للتقديم للتمويل.</p>

                    <div class="sample-report-panel sample-report-panel--gold">
                        <h4 class="sample-report-panel__title">
                            <svg class="ic" aria-hidden="true"><use href="#i-clipboard"/></svg>
                            ما يشمل تقريرنا
                        </h4>
                        <ul class="sample-report-list">
                            <li>ملخص تنفيذي ووصف المشروع</li>
                            <li>مؤشرات مالية (NPV، IRR، فترة الاسترداد، نقطة التعادل)</li>
                            <li>سيناريوهات متعدّدة (متحفّظ / أساسي / متفائل)</li>
                            <li>تحليل حساسية وتوصية واضحة (ابدأ / راجع / لا تبدأ)</li>
                            <li>هيكل متوافق مع متطلبات البنك ومنشآت</li>
                        </ul>
                    </div>

                    <div class="sample-report-panel sample-report-panel--muted">
                        <strong class="sample-report-compare__label">مقارنة سريعة</strong>
                        <p class="sample-report-compare__text">منصات أخرى قد تخرج ملفاً بسيطاً (صفحة واحدة أو قالب عام). نحن نخرج تقريراً كاملاً بجودة تدعم التقديم للبنك والمسرّعات.</p>
                    </div>

                    <div class="sample-report-actions">
                        <button type="button" class="btn btn--primary sample-report-actions__primary" id="sampleReportDownloadPdf">
                            <svg class="ic" aria-hidden="true"><use href="#i-download"/></svg>
                            تحميل عينة PDF كاملة
                        </button>
                        <button type="button" class="btn btn--ghost" id="sampleReportClose">إغلاق</button>
                    </div>
                </div>
            </div>
        `;

        this.overlay.querySelector('.sample-report-close')?.addEventListener('click', () => this.close());
        this.overlay.querySelector('#sampleReportClose')?.addEventListener('click', () => this.close());
        this.overlay.addEventListener('click', (e) => { if (e.target === this.overlay) this.close(); });

        this.overlay.querySelector('#sampleReportDownloadPdf')?.addEventListener('click', async () => {
            const btn = this.overlay.querySelector('#sampleReportDownloadPdf');
            if (btn) {
                const orig = btn.innerHTML;
                btn.textContent = 'جاري التحضير...';
                btn.disabled = true;
                try {
                    await this.onDownloadSample?.();
                } finally {
                    btn.innerHTML = orig;
                    btn.disabled = false;
                }
            }
        });
    }
}
