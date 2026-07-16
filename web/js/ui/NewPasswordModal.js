/**
 * NewPasswordModal — تعيين كلمة مرور جديدة بعد نقر رابط "نسيت كلمة المرور".
 * تُفتح تلقائياً عند حدث PASSWORD_RECOVERY من Supabase (انظر AuthGuard.js).
 * نفس اتفاقيات AuthModalStub.js (overlay/escape/focus-trap) لتوحيد تجربة المصادقة.
 */
export class NewPasswordModal {
    /**
     * @param {object} options
     * @param {string} [options.description] - نص توضيحي أعلى النموذج. الافتراضي
     * يخص سياق "نسيت كلمة المرور" (الاستخدام الأصلي)؛ استدعاء من "حسابي" (تغيير
     * استباقي بلا رابط بريد) يمرّر نصاً مختلفاً كي لا يظهر سياق غير صحيح للمستخدم.
     */
    constructor(options = {}) {
        this.overlay = null;
        this._prevFocus = null;
        this.description = options.description || 'وصلت هنا عبر رابط استعادة كلمة المرور. أدخل كلمة مرور جديدة لإكمال الدخول.';
    }

    open() {
        if (this.overlay) return;
        this.overlay = document.createElement('div');
        this.overlay.id = 'newPasswordModalOverlay';
        this.overlay.className = 'modal-overlay is-open';
        this.overlay.innerHTML = `
            <div class="modal-card" style="max-width: 400px;" role="dialog" aria-modal="true" aria-labelledby="newPasswordModalTitle">
                <div class="modal-header">
                    <h3 id="newPasswordModalTitle">تعيين كلمة مرور جديدة</h3>
                    <button type="button" class="btn-close" aria-label="إغلاق">×</button>
                </div>
                <div class="modal-body">
                    <p class="text-muted text-sm mb-3">${this.description}</p>
                    <div id="newPasswordError" class="text-danger text-sm mb-2" style="display:none;"></div>
                    <form id="newPasswordForm">
                        <div class="mb-3">
                            <label class="block text-sm mb-1" for="newPassword1">كلمة المرور الجديدة</label>
                            <input type="password" id="newPassword1" class="input w-full" placeholder="••••••••" required minlength="8" title="8+ أحرف، رقم واحد على الأقل، رمز واحد على الأقل" autocomplete="new-password">
                            <div id="newPasswordStrength" class="text-xs mt-1" style="display:none;"></div>
                        </div>
                        <div class="mb-3">
                            <label class="block text-sm mb-1" for="newPassword2">تأكيد كلمة المرور</label>
                            <input type="password" id="newPassword2" class="input w-full" placeholder="••••••••" required minlength="8" autocomplete="new-password">
                        </div>
                        <button type="submit" id="newPasswordSubmit" class="btn btn--primary w-full">تحديث كلمة المرور</button>
                    </form>
                </div>
            </div>
        `;
        document.body.appendChild(this.overlay);
        document.body.style.overflow = 'hidden';

        const onEscape = (e) => { if (e.key === 'Escape') this.close(); };
        document.addEventListener('keydown', onEscape);
        this._onEscape = onEscape;

        this._prevFocus = document.activeElement;
        setTimeout(() => { this.overlay?.querySelector('#newPassword1')?.focus(); }, 30);
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

        this.overlay.querySelector('.btn-close').addEventListener('click', () => this.close());
        this.overlay.addEventListener('click', (e) => { if (e.target === this.overlay) this.close(); });

        const form = this.overlay.querySelector('#newPasswordForm');
        const errEl = this.overlay.querySelector('#newPasswordError');
        const showErr = (msg) => { errEl.textContent = msg || ''; errEl.style.display = msg ? 'block' : 'none'; };

        const validatePassword = (p) => {
            if (p.length < 8) return 'كلمة المرور 8 أحرف على الأقل';
            if (!/[0-9]/.test(p)) return 'أضف رقماً واحداً على الأقل';
            if (!/[^A-Za-z0-9]/.test(p)) return 'أضف رمزاً واحداً على الأقل (مثل !@#$%)';
            return '';
        };

        const pass1 = this.overlay.querySelector('#newPassword1');
        const strengthEl = this.overlay.querySelector('#newPasswordStrength');
        pass1.addEventListener('input', () => {
            const p = pass1.value;
            if (p.length === 0) { strengthEl.style.display = 'none'; return; }
            strengthEl.style.display = 'block';
            let s = 0;
            if (p.length >= 8) s++;
            if (p.length >= 12) s++;
            if (/[0-9]/.test(p)) s++;
            if (/[^A-Za-z0-9]/.test(p)) s++;
            const label = s <= 1 ? 'ضعيفة' : s <= 2 ? 'متوسطة' : s <= 3 ? 'جيدة' : 'قوية';
            strengthEl.textContent = 'قوة كلمة المرور: ' + label;
            strengthEl.style.color = s <= 1 ? 'var(--c-danger)' : s <= 2 ? 'var(--c-warning)' : 'var(--c-success)';
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const p1 = pass1.value;
            const p2 = this.overlay.querySelector('#newPassword2').value;
            if (p1 !== p2) { showErr('كلمتا المرور غير متطابقتين'); return; }
            const pErr = validatePassword(p1);
            if (pErr) { showErr(pErr); return; }
            showErr('');
            const btn = this.overlay.querySelector('#newPasswordSubmit');
            btn.disabled = true;
            btn.textContent = 'جاري التحديث...';
            try {
                const { updatePassword } = await import('../../supabaseClient.js');
                const { ok, error } = await updatePassword(p1);
                if (ok) {
                    const { toast } = await import('../utils/toast.js');
                    toast.success('تم تحديث كلمة المرور بنجاح.');
                    this._succeeded = true;
                    this.close();
                } else {
                    showErr(error || 'فشل تحديث كلمة المرور');
                    btn.disabled = false;
                    btn.textContent = 'تحديث كلمة المرور';
                }
            } catch (err) {
                showErr(err?.message || 'خطأ في الاتصال');
                btn.disabled = false;
                btn.textContent = 'تحديث كلمة المرور';
            }
        });
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
