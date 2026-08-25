/**
 * نافذة "سياسة الاسترداد" — ضمان استرداد واضح (المهمة 2 — خطة التفوق).
 * استنساخ لنقاط قوة LivePlan: "35-day money-back guarantee"
 */
import { REFUND_POLICY } from '../config.js';
import { attachModalA11y } from '../utils/modalA11y.js';

export class RefundPolicyModal {
    constructor() {
        this.overlay = document.getElementById('refundPolicyModalOverlay') || this.createOverlay();
    }

    createOverlay() {
        const el = document.createElement('div');
        el.id = 'refundPolicyModalOverlay';
        el.className = 'modal-overlay';
        document.body.appendChild(el);
        return el;
    }

    open() {
        this.render();
        this.overlay.classList.add('is-open');
        document.body.style.overflow = 'hidden';
        this._a11y = attachModalA11y({
            container: this.overlay,
            labelledBy: 'refund-policy-title',
            initialFocus: '.refund-policy-close',
            onEscape: () => this.close()
        });
    }

    close() {
        this.overlay.classList.remove('is-open');
        document.body.style.overflow = '';
        this._a11y?.release();
        this._a11y = null;
    }

    render() {
        const policy = REFUND_POLICY || { shortTitle: 'ضمان الاسترداد', fullText: 'ضمان استرداد خلال 15 يوم على كل الباقات المدفوعة.' };

        this.overlay.innerHTML = `
            <div class="modal-card refund-policy-modal animate-scale-in" role="dialog" aria-modal="true" aria-labelledby="refund-policy-title" style="max-width: 500px;">
                <div class="modal-header">
                    <h3 id="refund-policy-title" class="text-gold"><svg class="ic" aria-hidden="true"><use href="#i-shield"/></svg> ${policy.shortTitle || 'سياسة الاسترداد'}</h3>
                    <button type="button" class="btn-close refund-policy-close" aria-label="إغلاق">×</button>
                </div>
                <div class="modal-body text-sm" dir="rtl" style="white-space: pre-line;">
                    ${typeof policy.fullText === 'string' ? policy.fullText : policy.fullText}
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn--primary" id="refundPolicyCloseBtn">فهمت</button>
                </div>
            </div>
        `;

        this.overlay.querySelector('.refund-policy-close')?.addEventListener('click', () => this.close());
        this.overlay.querySelector('#refundPolicyCloseBtn')?.addEventListener('click', () => this.close());
        this.overlay.addEventListener('click', (e) => { if (e.target === this.overlay) this.close(); });
    }
}
