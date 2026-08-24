/**
 * WhatsAppVerifyModal — تحقق واتساب حقيقي بعد وجود رقم على الحساب (يُفتح من
 * سلسلة AuthGuard.js حين profile.phone موجود لكن profile.phone_verified
 * لا يزال false). لا زر إغلاق/ESC/نقر-خلفي عمداً — نفس مبدأ CompletePhoneModal.js
 * تماماً: طالما الرقم غير مُتحقَّق فعلياً، هذه الخطوة إلزامية.
 */
import { sendWhatsAppOtp, verifyWhatsAppOtp } from '../services/WhatsAppOtpService.js';

const ERROR_MESSAGES = {
    no_phone_on_file: 'لا يوجد رقم جوال مسجَّل على حسابك.',
    cooldown_active: 'يرجى الانتظار قليلاً قبل طلب رمز جديد.',
    daily_limit_reached: 'تجاوزت الحد المسموح لطلب رمز التحقق اليوم — حاول لاحقاً.',
    send_failed: 'تعذّر إرسال رمز التحقق عبر واتساب. حاول مرة أخرى.',
    no_active_challenge: 'انتهت صلاحية الرمز — اطلب رمزاً جديداً.',
    code_mismatch: 'الرمز غير صحيح.',
    too_many_attempts: 'محاولات كثيرة خاطئة — اطلب رمزاً جديداً.',
};

function friendlyError(code) {
    return ERROR_MESSAGES[code] || 'حدث خطأ غير متوقع، حاول مرة أخرى.';
}

export class WhatsAppVerifyModal {
    constructor(options = {}) {
        this.overlay = null;
        this.options = options;
        this._prevFocus = null;
        this._onTrap = null;
        this._resendTimer = null;
        this._resendAvailableAt = null;
    }

    async open() {
        if (this.overlay) return;
        this.overlay = document.createElement('div');
        this.overlay.id = 'whatsappVerifyModalOverlay';
        this.overlay.className = 'modal-overlay is-open';
        this.overlay.innerHTML = `
            <div class="modal-card" style="max-width: 400px;" role="dialog" aria-modal="true" aria-labelledby="whatsappVerifyModalTitle">
                <div class="modal-header">
                    <h3 id="whatsappVerifyModalTitle">تحقق من رقم الجوال</h3>
                </div>
                <div class="modal-body">
                    <p class="text-muted text-sm mb-3">جارٍ إرسال رمز التحقق عبر واتساب...</p>
                </div>
            </div>
        `;
        document.body.appendChild(this.overlay);
        document.body.style.overflow = 'hidden';

        this._prevFocus = document.activeElement;
        this._onTrap = (e) => {
            if (e.key !== 'Tab' || !this.overlay) return;
            const f = Array.from(this.overlay.querySelectorAll('input, button, [tabindex]:not([tabindex="-1"])'))
                .filter((el) => !el.disabled && el.offsetParent !== null);
            if (!f.length) return;
            const first = f[0], last = f[f.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        };
        this.overlay.addEventListener('keydown', this._onTrap);

        await this._sendAndRenderForm();
    }

    async _sendAndRenderForm() {
        const result = await sendWhatsAppOtp();
        if (!result.ok) {
            this._renderSendError(result.error);
            return;
        }
        this._resendAvailableAt = result.resendAvailableAt ? new Date(result.resendAvailableAt).getTime() : null;
        this._renderCodeForm();
    }

    _renderSendError(errorCode) {
        if (!this.overlay) return;
        const body = this.overlay.querySelector('.modal-body');
        body.innerHTML = `
            <div id="whatsappVerifyError" class="text-danger text-sm mb-3" role="alert">${friendlyError(errorCode)}</div>
            <button type="button" id="whatsappVerifyRetry" class="btn btn--primary w-full">إعادة المحاولة</button>
        `;
        body.querySelector('#whatsappVerifyRetry').addEventListener('click', () => this._sendAndRenderForm());
    }

    _renderCodeForm() {
        if (!this.overlay) return;
        const body = this.overlay.querySelector('.modal-body');
        body.innerHTML = `
            <p class="text-muted text-sm mb-3">أرسلنا رمزاً مكوَّناً من 6 أرقام عبر واتساب لرقمك المسجَّل.</p>
            <div id="whatsappVerifyError" class="text-danger text-sm mb-2" role="alert" style="display:none;"></div>
            <form id="whatsappVerifyForm">
                <div class="mb-3">
                    <label class="block text-sm mb-1" for="whatsappVerifyCodeInput">رمز التحقق</label>
                    <input type="text" id="whatsappVerifyCodeInput" class="input w-full" placeholder="000000" inputmode="numeric" maxlength="6" dir="ltr" autocomplete="one-time-code" required>
                </div>
                <button type="submit" id="whatsappVerifySubmit" class="btn btn--primary w-full mb-2">تحقق</button>
                <button type="button" id="whatsappVerifyResend" class="btn btn--ghost w-full">إعادة الإرسال</button>
            </form>
        `;

        setTimeout(() => { this.overlay?.querySelector('#whatsappVerifyCodeInput')?.focus(); }, 30);

        const form = body.querySelector('#whatsappVerifyForm');
        const errEl = body.querySelector('#whatsappVerifyError');
        const showErr = (msg) => { errEl.textContent = msg || ''; errEl.style.display = msg ? 'block' : 'none'; };

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const code = body.querySelector('#whatsappVerifyCodeInput').value.trim();
            if (!/^\d{6}$/.test(code)) { showErr('أدخل رمزاً من 6 أرقام.'); return; }
            showErr('');
            const btn = body.querySelector('#whatsappVerifySubmit');
            btn.disabled = true;
            btn.textContent = 'جارٍ التحقق...';
            const result = await verifyWhatsAppOtp(code);
            if (result.ok) {
                this.options.onVerified?.();
                this.close();
                return;
            }
            showErr(friendlyError(result.error));
            btn.disabled = false;
            btn.textContent = 'تحقق';
        });

        const resendBtn = body.querySelector('#whatsappVerifyResend');
        resendBtn.addEventListener('click', async () => {
            resendBtn.disabled = true;
            const result = await sendWhatsAppOtp();
            if (!result.ok) {
                showErr(friendlyError(result.error));
                resendBtn.disabled = false;
                return;
            }
            showErr('');
            this._resendAvailableAt = result.resendAvailableAt ? new Date(result.resendAvailableAt).getTime() : null;
            this._startResendCountdown(resendBtn);
        });

        this._startResendCountdown(resendBtn);
    }

    _startResendCountdown(resendBtn) {
        if (this._resendTimer) clearInterval(this._resendTimer);
        if (!this._resendAvailableAt) return;

        const tick = () => {
            if (!this.overlay) { clearInterval(this._resendTimer); this._resendTimer = null; return; }
            const remaining = Math.ceil((this._resendAvailableAt - Date.now()) / 1000);
            if (remaining <= 0) {
                resendBtn.disabled = false;
                resendBtn.textContent = 'إعادة الإرسال';
                clearInterval(this._resendTimer);
                this._resendTimer = null;
                return;
            }
            resendBtn.disabled = true;
            resendBtn.textContent = `إعادة الإرسال (${remaining})`;
        };
        tick();
        this._resendTimer = setInterval(tick, 1000);
    }

    close() {
        if (this._resendTimer) { clearInterval(this._resendTimer); this._resendTimer = null; }
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
