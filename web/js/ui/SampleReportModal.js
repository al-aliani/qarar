/**
 * نافذة "اطلع على عينة تقرير" — توضيح الفرق في الجودة بيننا وبين المنافسين.
 * المهمة 1 من خطة التفوق: عرض عينة تقرير بجانب زر "ابدأ".
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
            <div class="modal-card sample-report-modal animate-scale-in" role="dialog" aria-modal="true" aria-labelledby="sample-report-modal-title" style="max-width: 560px;">
                <div class="modal-header">
                    <h3 id="sample-report-modal-title" class="text-gold">📄 اطلع على عينة تقرير</h3>
                    <button type="button" class="btn-close sample-report-close" aria-label="إغلاق">×</button>
                </div>
                <div class="modal-body text-sm" dir="rtl">
                    <p class="text-muted mb-4">لاحظ الفرق في الجودة — تقريرنا مفصّل وجاهز للتقديم للتمويل.</p>

                    <div class="card p-4 mb-4 bg-gold/5 border border-gold/20">
                        <h4 class="font-bold text-gold mb-2">ما يشمل تقريرنا:</h4>
                        <ul class="space-y-1 text-muted">
                            <li>✓ ملخص تنفيذي ووصف المشروع</li>
                            <li>✓ مؤشرات مالية (NPV، IRR، فترة الاسترداد، نقطة التعادل)</li>
                            <li>✓ سيناريوهات Base / Best / Worst</li>
                            <li>✓ تحليل حساسية وتوصية واضحة (ابدأ / راجع / لا تبدأ)</li>
                            <li>✓ هيكل متوافق مع متطلبات البنك ومنشآت</li>
                        </ul>
                    </div>

                    <div class="p-3 rounded bg-white/5 border border-white/10 mb-4 text-xs">
                        <strong class="text-muted">مقارنة سريعة:</strong>
                        <p class="mt-1 text-muted">منصات أخرى قد تخرج ملفاً بسيطاً (صفحة واحدة أو قالب عام). نحن نخرج تقريراً كاملاً بجودة تدعم التقديم للبنك والمسرّعات.</p>
                    </div>

                    <div class="flex flex-col sm:flex-row gap-3">
                        <button type="button" class="btn btn--primary flex-1" id="sampleReportDownloadPdf">
                            📥 تحميل عينة PDF كاملة
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
                const orig = btn.textContent;
                btn.textContent = 'جاري التحضير...';
                btn.disabled = true;
                try {
                    await this.onDownloadSample?.();
                } finally {
                    btn.textContent = orig;
                    btn.disabled = false;
                }
            }
        });
    }
}
