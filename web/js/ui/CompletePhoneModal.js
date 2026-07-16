/**
 * CompletePhoneModal — يُطلب رقم الجوال (واتساب) بعد الدخول لأول مرة حين لا يوجد
 * على الحساب (بالأخص حسابات Google OAuth، التي لا تُرجع رقم جوال إطلاقاً؛ حسابات
 * البريد/كلمة المرور تجمعه أصلاً عند إنشاء الحساب في AuthModalStub.js). لا يوجد
 * زر إغلاق/ESC/نقر-خلفي عمداً — رقم الجوال مطلوب لكل حساب (انظر AuthGuard.js).
 */
export class CompletePhoneModal {
    constructor(options = {}) {
        this.overlay = null;
        this.options = options;
        this._prevFocus = null;
    }

    open() {
        if (this.overlay) return;
        this.overlay = document.createElement('div');
        this.overlay.id = 'completePhoneModalOverlay';
        this.overlay.className = 'modal-overlay is-open';
        this.overlay.innerHTML = `
            <div class="modal-card" style="max-width: 400px;" role="dialog" aria-modal="true" aria-labelledby="completePhoneModalTitle">
                <div class="modal-header">
                    <h3 id="completePhoneModalTitle">أكمل حسابك</h3>
                </div>
                <div class="modal-body">
                    <p class="text-muted text-sm mb-3">رقم جوالك على واتساب مطلوب لإكمال الحساب والتواصل معك بخصوص طلباتك.</p>
                    <div id="completePhoneError" class="text-danger text-sm mb-2" style="display:none;"></div>
                    <form id="completePhoneForm">
                        <div class="mb-3">
                            <label class="block text-sm mb-1" for="completePhoneInput">رقم الجوال (واتساب)</label>
                            <input type="tel" id="completePhoneInput" class="input w-full" placeholder="05xxxxxxxx" autocomplete="tel" dir="ltr" inputmode="numeric" required>
                        </div>
                        <button type="submit" id="completePhoneSubmit" class="btn btn--primary w-full">حفظ ومتابعة</button>
                    </form>
                </div>
            </div>
        `;
        document.body.appendChild(this.overlay);
        document.body.style.overflow = 'hidden';

        this._prevFocus = document.activeElement;
        setTimeout(() => { this.overlay?.querySelector('#completePhoneInput')?.focus(); }, 30);
        this._onTrap = (e) => {
            if (e.key !== 'Tab' || !this.overlay) return;
            const f = Array.from(this.overlay.querySelectorAll('input, button, [tabindex]:not([tabindex="-1"])'))
                .filter(el => !el.disabled && el.offsetParent !== null);
            if (!f.length) return;
            const first = f[0], last = f[f.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        };
        this.overlay.addEventListener('keydown', this._onTrap);

        const form = this.overlay.querySelector('#completePhoneForm');
        const errEl = this.overlay.querySelector('#completePhoneError');
        const showErr = (msg) => { errEl.textContent = msg || ''; errEl.style.display = msg ? 'block' : 'none'; };

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const { normalizeSaudiPhone } = await import('../utils/phoneUtils.js');
            const raw = this.overlay.querySelector('#completePhoneInput').value;
            const e164 = normalizeSaudiPhone(raw);
            if (!e164) { showErr('أدخل رقم جوال سعودي صحيح (مثال: 0512345678)'); return; }
            showErr('');
            const btn = this.overlay.querySelector('#completePhoneSubmit');
            btn.disabled = true;
            btn.textContent = 'جاري الحفظ...';
            try {
                const { updateUserProfile } = await import('../../supabaseClient.js');
                const { ok, error } = await updateUserProfile({ phone: e164 });
                if (ok) {
                    this.options.onSaved?.();
                    this.close();
                } else {
                    showErr(error || 'فشل حفظ رقم الجوال');
                    btn.disabled = false;
                    btn.textContent = 'حفظ ومتابعة';
                }
            } catch (err) {
                showErr(err?.message || 'خطأ في الاتصال');
                btn.disabled = false;
                btn.textContent = 'حفظ ومتابعة';
            }
        });
    }

    close() {
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
