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
import { attachModalA11y } from '../utils/modalA11y.js';

export class WhatsAppContactModal {
    constructor(options = {}) {
        this.overlay = null;
        this.options = options;
        this._a11y = null;
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

        this._a11y = attachModalA11y({
            container: this.overlay,
            labelledBy: 'whatsappContactModalTitle',
            onEscape: () => this._dismiss()
        });

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
        if (this.overlay) {
            this.overlay.classList.remove('is-open');
            this.overlay.remove();
            this.overlay = null;
        }
        document.body.style.overflow = '';
        this._a11y?.release();
        this._a11y = null;
    }
}
