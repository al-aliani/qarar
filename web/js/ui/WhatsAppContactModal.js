/**
 * WhatsAppContactModal — يُطلب من العميل فتح واتساب والتواصل مع صاحب الموقع
 * بدل رمز تحقق آلي عبر ميتا (قرار 2026-07-17 — انظر migration
 * 20260717020000_whatsapp_manual_confirm.sql). قابلة للتخطي عمداً (بخلاف
 * CompletePhoneModal وباقي خطوات السلسلة): "التحقق" هنا يعتمد على تأكيد
 * يدوي لاحق من الأدمن قد يستغرق وقتاً — حجب المستخدم عن التطبيق لحينه تجربة
 * سيئة. تُعرَض مرة واحدة فقط: whatsapp_contact_prompted يُضبط true عند
 * الفتح أو التخطي، بصرف النظر هل أرسل العميل الرسالة فعلياً أم لا.
 */
import { buildWhatsAppLink } from '../config.js';
import { updateUserProfile } from '../../supabaseClient.js';

export class WhatsAppContactModal {
    constructor(options = {}) {
        this.overlay = null;
        this.options = options;
        this._prevFocus = null;
        this._onTrap = null;
        this._onEscape = null;
    }

    open() {
        if (this.overlay) return;
        const waLink = buildWhatsAppLink('مرحباً، سجّلت حساباً جديداً في قرار وأحب أتواصل معكم.');

        this.overlay = document.createElement('div');
        this.overlay.id = 'whatsappContactModalOverlay';
        this.overlay.className = 'modal-overlay is-open';
        this.overlay.innerHTML = `
            <div class="modal-card" style="max-width: 400px;" role="dialog" aria-modal="true" aria-labelledby="whatsappContactModalTitle">
                <div class="modal-header">
                    <h3 id="whatsappContactModalTitle">تواصل معنا عبر واتساب</h3>
                    <button type="button" class="btn-close" aria-label="تخطّي">×</button>
                </div>
                <div class="modal-body">
                    <p class="text-muted text-sm mb-3">راسلنا عبر واتساب لتأكيد رقم جوالك والتواصل بخصوص طلباتك — خطوة اختيارية، تقدر تتخطاها وتكمل الآن.</p>
                    ${waLink
                        ? `<a href="${waLink}" target="_blank" rel="noopener noreferrer" id="whatsappContactOpenLink" class="btn btn--primary w-full">فتح واتساب</a>`
                        : `<p class="text-danger text-sm">قناة واتساب غير متاحة حالياً.</p>`}
                    <button type="button" id="whatsappContactSkip" class="btn btn--ghost w-full mt-2">تخطّي الآن</button>
                </div>
            </div>
        `;
        document.body.appendChild(this.overlay);
        document.body.style.overflow = 'hidden';

        this._prevFocus = document.activeElement;
        this._onTrap = (e) => {
            if (e.key !== 'Tab' || !this.overlay) return;
            const f = Array.from(this.overlay.querySelectorAll('a, input, button, [tabindex]:not([tabindex="-1"])'))
                .filter((el) => !el.disabled && el.offsetParent !== null);
            if (!f.length) return;
            const first = f[0], last = f[f.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        };
        this.overlay.addEventListener('keydown', this._onTrap);

        this._onEscape = (e) => { if (e.key === 'Escape') this._dismiss(); };
        document.addEventListener('keydown', this._onEscape);

        this.overlay.querySelector('.btn-close').addEventListener('click', () => this._dismiss());
        this.overlay.addEventListener('click', (e) => { if (e.target === this.overlay) this._dismiss(); });
        this.overlay.querySelector('#whatsappContactSkip').addEventListener('click', () => this._dismiss());
        this.overlay.querySelector('#whatsappContactOpenLink')?.addEventListener('click', () => this._dismiss());
    }

    async _dismiss() {
        try {
            await updateUserProfile({ whatsapp_contact_prompted: true });
        } catch (_) {}
        this.options.onDismissed?.();
        this.close();
    }

    close() {
        if (this._onEscape) document.removeEventListener('keydown', this._onEscape);
        this._onEscape = null;
        if (this.overlay) {
            if (this._onTrap) this.overlay.removeEventListener('keydown', this._onTrap);
            this._onTrap = null;
            this.overlay.classList.remove('is-open');
            this.overlay.remove();
            this.overlay = null;
        }
        document.body.style.overflow = '';
        try { this._prevFocus?.focus?.(); } catch (_) {}
    }
}
