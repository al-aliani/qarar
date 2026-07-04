/**
 * AuthModal — واجهة تسجيل الدخول والتسجيل عبر Supabase.
 * يحافظ على توافق (containerId, options) مع الاستدعاء في Sidebar و DashboardView.
 */

export class AuthModal {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.onSuccess = options.onSuccess || null;
        this.overlay = null;
    }

    open() {
        if (this.overlay) return;
        this.overlay = document.createElement('div');
        this.overlay.id = 'authModalOverlay';
        this.overlay.className = 'modal-overlay is-open';
        this.overlay.innerHTML = `
            <div class="modal-card" style="max-width: 400px;">
                <div class="modal-header">
                    <h3>دخول / تسجيل</h3>
                    <button type="button" class="btn-close" aria-label="إغلاق">×</button>
                </div>
                <div class="modal-body">
                    <p class="text-muted text-sm mb-3">تسجيل الدخول يمكّنك من حفظ الدراسة في السحابة ومزامنتها بين الأجهزة.</p>
                    <div id="authModalError" class="text-danger text-sm mb-2" style="display:none;"></div>
                    <div id="authModalResendBlock" class="mb-2 p-2 rounded text-sm" style="display:none;background:var(--c-danger-subtle);border:1px solid var(--c-danger);">
                        <p class="text-danger mb-1">البريد غير مفعّل. تحقق من صندوق الوارد أو البريد المزعج.</p>
                        <button type="button" id="authBtnResendConfirm" class="btn btn--ghost text-sm">إعادة إرسال رابط التأكيد</button>
                    </div>
                    <div id="authModalNotConfigured" class="p-3 bg-warning/10 border border-warning/30 rounded text-sm" style="display:none;"></div>
                    <form id="authModalForm" style="display:block;">
                        <div class="mb-3">
                            <label class="block text-sm mb-1" for="authEmail">البريد الإلكتروني</label>
                            <input type="email" id="authEmail" class="input w-full" placeholder="you@example.com" required>
                        </div>
                        <div class="mb-3">
                            <label class="block text-sm mb-1" for="authPassword">كلمة المرور</label>
                            <input type="password" id="authPassword" class="input w-full" placeholder="••••••••" required minlength="8" title="8+ أحرف، رقم واحد على الأقل، رمز واحد على الأقل">
                            <div id="authPasswordStrength" class="text-xs mt-1" style="display:none;"></div>
                        </div>
                        <div class="flex gap-2 mb-2">
                            <button type="submit" id="authBtnSignIn" class="btn btn--primary flex-1">دخول</button>
                            <button type="button" id="authBtnSignUp" class="btn btn--secondary flex-1">إنشاء حساب</button>
                        </div>
                        <div class="text-center mb-2">
                            <button type="button" id="authBtnForgotPassword" class="btn--text text-sm text-muted">نسيت كلمة المرور؟</button>
                        </div>
                        <div class="border-t border-solid mt-3 pt-3" style="border-color:var(--c-border);">
                            <p class="text-xs text-muted text-center mb-2">أو</p>
                            <button type="button" id="authBtnGoogle" class="btn btn--ghost w-full flex items-center justify-center gap-2" title="تسجيل الدخول بحساب Google">
                                <span>🔐</span> تسجيل الدخول بـ Google
                            </button>
                        </div>
                    </form>
                    <div id="authModalForgotPanel" class="mb-3" style="display:none;">
                        <label class="block text-sm mb-1" for="authForgotEmail">أدخل بريدك لإرسال رابط إعادة التعيين</label>
                        <input type="email" id="authForgotEmail" class="input w-full mb-2" placeholder="you@example.com">
                        <div class="flex gap-2">
                            <button type="button" id="authBtnSendReset" class="btn btn--primary flex-1">إرسال الرابط</button>
                            <button type="button" id="authBtnBackToLogin" class="btn btn--secondary">رجوع</button>
                        </div>
                        <p id="authForgotMessage" class="text-sm mt-2" style="display:none;"></p>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(this.overlay);
        document.body.style.overflow = 'hidden';

        const onEscape = (e) => { if (e.key === 'Escape') this.close(); };
        document.addEventListener('keydown', onEscape);
        this._onEscape = onEscape;

        this.overlay.querySelector('.btn-close').addEventListener('click', () => this.close());
        this.overlay.addEventListener('click', (e) => { if (e.target === this.overlay) this.close(); });

        const form = this.overlay.querySelector('#authModalForm');
        const errEl = this.overlay.querySelector('#authModalError');
        const notCfg = this.overlay.querySelector('#authModalNotConfigured');

        const showErr = (msg) => { errEl.textContent = msg || ''; errEl.style.display = msg ? 'block' : 'none'; };

        const validatePassword = (p) => {
            if (p.length < 8) return 'كلمة المرور 8 أحرف على الأقل';
            if (!/[0-9]/.test(p)) return 'أضف رقماً واحداً على الأقل';
            if (!/[^A-Za-z0-9]/.test(p)) return 'أضف رمزاً واحداً على الأقل (مثل !@#$%)';
            return '';
        };
        const passInput = this.overlay.querySelector('#authPassword');
        const strengthEl = this.overlay.querySelector('#authPasswordStrength');
        if (passInput && strengthEl) {
            passInput.addEventListener('input', () => {
                const p = passInput.value;
                if (p.length === 0) { strengthEl.style.display = 'none'; return; }
                strengthEl.style.display = 'block';
                let s = 0;
                if (p.length >= 8) s++;
                if (p.length >= 12) s++;
                if (/[0-9]/.test(p)) s++;
                if (/[^A-Za-z0-9]/.test(p)) s++;
                const label = s <= 1 ? 'ضعيفة' : s <= 2 ? 'متوسطة' : s <= 3 ? 'جيدة' : 'قوية';
                strengthEl.textContent = 'قوة كلمة المرور: ' + label;
                strengthEl.style.color = s <= 1 ? 'var(--c-danger)' : s <= 2 ? '#d4af37' : 'var(--c-success)';
            });
        }

        const runAuth = async (isSignUp) => {
            const email = this.overlay.querySelector('#authEmail').value.trim();
            const pass = this.overlay.querySelector('#authPassword').value;
            if (!email || !pass) { showErr('أدخل البريد وكلمة المرور'); return; }
            if (isSignUp) {
                const pErr = validatePassword(pass);
                if (pErr) { showErr(pErr); return; }
            }
            showErr('');
            const btn = isSignUp ? this.overlay.querySelector('#authBtnSignUp') : this.overlay.querySelector('#authBtnSignIn');
            const orig = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'جاري...';
            try {
                const { signIn, signUp, getSupabaseClient } = await import('../../supabaseClient.js');
                const { ok } = await getSupabaseClient();
                if (!ok) { showErr('Supabase غير مهيأ. لا يمكن الدخول أو إنشاء حساب.'); return; }
                const fn = isSignUp ? signUp : signIn;
                const { ok: authOk, error } = await fn(email, pass);
                if (authOk) {
                    if (this.onSuccess) this.onSuccess({ success: true });
                    this.close();
                } else {
                    const isEmailNotConfirmed = (error || '').toLowerCase().includes('email not confirmed');
                    showErr(isEmailNotConfirmed ? 'البريد غير مفعّل. استخدم الزر أدناه لإعادة إرسال رابط التأكيد.' : (error || 'فشل تسجيل الدخول أو إنشاء الحساب.'));
                    const resendBlock = this.overlay.querySelector('#authModalResendBlock');
                    if (resendBlock) resendBlock.style.display = isEmailNotConfirmed ? 'block' : 'none';
                }
            } catch (e) {
                showErr(e?.message || 'خطأ في الاتصال.');
            } finally {
                btn.disabled = false;
                btn.textContent = orig;
            }
        };

        form.addEventListener('submit', (e) => { e.preventDefault(); runAuth(false); });
        this.overlay.querySelector('#authBtnSignUp').addEventListener('click', (e) => { e.preventDefault(); runAuth(true); });

        // إعادة إرسال رابط تأكيد البريد
        this.overlay.querySelector('#authBtnResendConfirm')?.addEventListener('click', async () => {
            const email = this.overlay.querySelector('#authEmail')?.value?.trim();
            if (!email) return;
            const btn = this.overlay.querySelector('#authBtnResendConfirm');
            const block = this.overlay.querySelector('#authModalResendBlock');
            btn.disabled = true;
            btn.textContent = 'جاري الإرسال...';
            const { resendConfirmationEmail } = await import('../../supabaseClient.js');
            const res = await resendConfirmationEmail(email);
            if (res.ok) { showErr(''); if (block) block.style.display = 'none'; btn.textContent = 'تم الإرسال. تحقق من بريدك.'; } else { showErr(res.error || 'فشل الإرسال'); }
            btn.disabled = false;
            btn.textContent = 'إعادة إرسال رابط التأكيد';
        });

        // تسجيل الدخول بـ Google (OAuth)
        this.overlay.querySelector('#authBtnGoogle')?.addEventListener('click', async () => {
            showErr('');
            try {
                const { signInWithOAuth, getSupabaseClient } = await import('../../supabaseClient.js');
                const { ok } = await getSupabaseClient();
                if (!ok) { showErr('Supabase غير مهيأ. لا يمكن الدخول بـ Google.'); return; }
                const result = await signInWithOAuth('google');
                if (result.ok && result.data?.url) {
                    window.location.href = result.data.url;
                    return;
                }
                if (!result.ok) {
                    showErr(result.error || 'فشل تسجيل الدخول بـ Google. تأكد من تفعيل Google في لوحة Supabase.');
                } else {
                    showErr('لم يُرجَع رابط الدخول. فعّل Google في Supabase → Authentication → Providers.');
                }
            } catch (e) {
                showErr(e?.message || 'خطأ في الاتصال.');
            }
        });

        // نسيت كلمة المرور
        const forgotPanel = this.overlay.querySelector('#authModalForgotPanel');
        const forgotMessage = this.overlay.querySelector('#authForgotMessage');
        this.overlay.querySelector('#authBtnForgotPassword')?.addEventListener('click', () => {
            form.style.display = 'none';
            if (forgotPanel) forgotPanel.style.display = 'block';
        });
        this.overlay.querySelector('#authBtnBackToLogin')?.addEventListener('click', () => {
            if (forgotPanel) forgotPanel.style.display = 'none';
            if (forgotMessage) { forgotMessage.style.display = 'none'; forgotMessage.textContent = ''; }
            form.style.display = 'block';
        });
        this.overlay.querySelector('#authBtnSendReset')?.addEventListener('click', async () => {
            const emailInput = this.overlay.querySelector('#authForgotEmail');
            const email = emailInput?.value?.trim();
            if (!email) { if (forgotMessage) { forgotMessage.textContent = 'أدخل البريد الإلكتروني'; forgotMessage.style.display = 'block'; forgotMessage.className = 'text-sm text-danger mt-2'; } return; }
            try {
                const { resetPassword } = await import('../../supabaseClient.js');
                const { ok, error } = await resetPassword(email);
                if (ok && forgotMessage) {
                    forgotMessage.textContent = 'تم إرسال رابط إعادة التعيين إلى بريدك. راجع صندوق الوارد أو البريد المزعج.';
                    forgotMessage.style.display = 'block';
                    forgotMessage.className = 'text-sm text-success mt-2';
                } else if (forgotMessage) {
                    forgotMessage.textContent = error || 'فشل إرسال الرابط';
                    forgotMessage.style.display = 'block';
                    forgotMessage.className = 'text-sm text-danger mt-2';
                }
            } catch (e) {
                if (forgotMessage) { forgotMessage.textContent = e?.message || 'خطأ في الاتصال'; forgotMessage.style.display = 'block'; forgotMessage.className = 'text-sm text-danger mt-2'; }
            }
        });

        // تحقق من تهيئة Supabase
        (async () => {
            try {
                const { getSupabaseClient } = await import('../../supabaseClient.js');
                const { ok, error } = await getSupabaseClient();
                if (!ok) {
                    form.style.display = 'none';
                    notCfg.style.display = 'block';
                    notCfg.innerHTML = 'لم يُعد الحفظ السحابي. أضف SUPABASE_URL و SUPABASE_ANON_KEY (في localStorage أو window) لتفعيل الدخول.<br><span class="text-muted mt-2 block">يمكنك العمل محلياً بدون تسجيل؛ المسودة تُحفظ على جهازك.</span>';
                }
            } catch (_) {}
        })();
    }

    close() {
        if (this._onEscape) document.removeEventListener('keydown', this._onEscape);
        this._onEscape = null;
        if (this.overlay) {
            this.overlay.classList.remove('is-open');
            this.overlay.remove();
            this.overlay = null;
        }
        document.body.style.overflow = '';
    }

    render() {}
    attachEvents() {}
    populateSettings() {}
}
