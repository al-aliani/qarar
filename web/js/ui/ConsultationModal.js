/**
 * نافذة طلب استشارة مع خبير
 * نموذج يجمع ملخص الدراسة + رابط للحجز (Calendly/Cal.com)
 */
import { APP_CONFIG } from '../config.js';
import { toast } from '../utils/toast.js';

export class ConsultationModal {
    constructor(overlayId, store) {
        this.overlay = document.getElementById(overlayId);
        if (!this.overlay) {
            this.overlay = document.createElement('div');
            this.overlay.id = overlayId || 'consultationModalOverlay';
            this.overlay.className = 'modal-overlay';
            document.body.appendChild(this.overlay);
        }
        this.store = store;
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

    getSummary(state) {
        const pi = state?.projectInfo || {};
        const ind = state?.indicators || {};
        const name = pi.name || 'المشروع';
        const concept = pi.concept || '';
        const city = pi.city || '';
        const npv = ind.npv != null ? Number(ind.npv).toLocaleString('ar-SA') : '—';
        const irr = ind.irr != null ? (Number(ind.irr) * 100).toFixed(1) + '%' : '—';
        const inv = state?.financing?.totalInvestment ?? state?.capex?.total ?? 0;
        const invStr = inv ? Number(inv).toLocaleString('ar-SA') + ' ريال' : '—';
        return { name, concept, city, npv, irr, invStr };
    }

    render() {
        const state = this.store.getState();
        const s = this.getSummary(state);
        const url = (state?.consultationBookingUrl || APP_CONFIG.consultationBookingUrl || '').trim();
        const hasBookingUrl = url.length > 0;

        this.overlay.innerHTML = `
            <div class="modal-card consultation-modal animate-scale-in" role="dialog" aria-modal="true" aria-labelledby="consultation-modal-title">
                <div class="modal-header">
                    <h3 id="consultation-modal-title">📞 احجز استشارة مع خبير</h3>
                    <button type="button" class="btn-close consultation-close" aria-label="إغلاق">×</button>
                </div>
                <div class="modal-body">
                    <p class="text-muted mb-4">اجتماع Zoom مع محللين ذوي خبرة في السوق السعودي لمراجعة دراستك وإجابة أسئلتك.</p>
                    <div class="consultation-summary card mb-4">
                        <h4 class="card-title">ملخص الدراسة (للمشاركة مع الخبير)</h4>
                        <ul class="consultation-list">
                            <li><strong>المشروع:</strong> ${escapeHtml(s.name)}</li>
                            <li><strong>النشاط:</strong> ${escapeHtml(s.concept) || '—'}</li>
                            <li><strong>الموقع:</strong> ${escapeHtml(s.city) || '—'}</li>
                            <li><strong>الاستثمار المتوقع:</strong> ${s.invStr}</li>
                            <li><strong>NPV:</strong> ${s.npv} ريال</li>
                            <li><strong>IRR:</strong> ${s.irr}</li>
                        </ul>
                        <button type="button" class="btn btn--sm btn--ghost btn-copy-summary mt-2">نسخ الملخص</button>
                    </div>
                    ${hasBookingUrl
                        ? `<div class="flex gap-2 items-center">
                            <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="btn btn--primary btn-block btn-book-consultation">📅 الذهاب لجدولة الموعد</a>
                            <button type="button" class="btn btn--ghost btn--sm btn-edit-consultation-url" title="تعديل الرابط">✏️</button>
                           </div>`
                        : `<div class="consultation-url-setup">
                            <label class="text-sm font-medium mb-2 block">أدخل رابط جدولة المواعيد (Calendly / Cal.com)</label>
                            <input type="url" id="consultation-url-input" class="input mb-2" placeholder="https://calendly.com/..." value="">
                            <button type="button" class="btn btn--primary btn--sm btn-save-consultation-url">حفظ الرابط</button>
                        </div>`}
                </div>
            </div>
        `;

        this.overlay.querySelector('.consultation-close')?.addEventListener('click', () => this.close());
        this.overlay.addEventListener('click', (e) => { if (e.target === this.overlay) this.close(); });

        this.overlay.querySelector('.btn-copy-summary')?.addEventListener('click', () => {
            const text = `المشروع: ${s.name}\nالنشاط: ${s.concept || '—'}\nالموقع: ${s.city || '—'}\nالاستثمار: ${s.invStr}\nNPV: ${s.npv} ريال\nIRR: ${s.irr}`;
            navigator.clipboard?.writeText(text).then(() => toast.success('تم نسخ الملخص')).catch(() => toast.error('فشل النسخ'));
        });

        const editBtn = this.overlay.querySelector('.btn-edit-consultation-url');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                this.store.state.consultationBookingUrl = '';
                if (typeof this.store.save === 'function') this.store.save();
                if (typeof this.store.notify === 'function') this.store.notify();
                this.render();
            });
        }

        const saveBtn = this.overlay.querySelector('.btn-save-consultation-url');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                const input = this.overlay.querySelector('#consultation-url-input');
                const val = (input?.value || '').trim();
                if (!val) { toast.warning('أدخل الرابط أولاً'); return; }
                if (!/^https?:\/\//i.test(val)) { toast.warning('الرابط يجب أن يبدأ بـ http:// أو https://'); return; }
                this.store.state.consultationBookingUrl = val;
                if (typeof this.store.save === 'function') this.store.save();
                if (typeof this.store.notify === 'function') this.store.notify();
                toast.success('تم حفظ رابط الحجز.');
                this.render();
            });
        }
    }
}

function escapeHtml(str) {
    if (str == null) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
