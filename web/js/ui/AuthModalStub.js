/**
 * AuthModal — واجهة تسجيل الدخول والتسجيل عبر Supabase.
 * يحافظ على توافق (containerId, options) مع الاستدعاء في Sidebar و DashboardView.
 */

export class AuthModal {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.onSuccess = options.onSuccess || null;
        this.onClose = options.onClose || null; // يُستدعى عند الإغلاق بلا نجاح (يعامله الحارس كتخطٍّ)
        this.overlay = null;
        this._succeeded = false;
        this._prevFocus = null;
    }

    open() {
        if (this.overlay) return;
        this.overlay = document.createElement('div');
        this.overlay.id = 'authModalOverlay';
        this.overlay.className = 'modal-overlay is-open';
        this.overlay.innerHTML = `
            <div class="modal-card" style="max-width: 400px;" role="dialog" aria-modal="true" aria-labelledby="authModalTitle">
                <div class="modal-header">
                    <h3 id="authModalTitle">دخول / تسجيل</h3>
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
                            <input type="email" id="authEmail" class="input w-full" placeholder="you@example.com" required autocomplete="username" dir="ltr">
                        </div>
                        <div class="mb-3">
                            <label class="block text-sm mb-1" for="authPassword">كلمة المرور</label>
                            <input type="password" id="authPassword" class="input w-full" placeholder="••••••••" required minlength="8" title="8+ أحرف، رقم واحد على الأقل، رمز واحد على الأقل" autocomplete="current-password">
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
                        <input type="email" id="authForgotEmail" class="input w-full mb-2" placeholder="you@example.com" autocomplete="email" dir="ltr">
                        <div class="flex gap-2">
                            <button type="button" id="authBtnSendReset" class="btn btn--primary flex-1">إرسال الرابط</button>
                            <button type="button" id="authBtnBackToLogin" class="btn btn--secondary">رجوع</button>
                        </div>
                        <p id="authForgotMessage" class="text-sm mt-2" style="display:none;"></p>
                    </div>
                    <div id="authModalMfaPanel" class="mb-3" style="display:none;">
                        <p class="text-muted text-sm mb-3">حسابك محمي بمصادقة ثنائية. أدخل رمز تطبيق المصادقة (6 أرقام).</p>
                        <div id="authMfaError" class="text-danger text-sm mb-2" style="display:none;"></div>
                        <form id="authMfaForm">
                            <div class="mb-3">
                                <input type="text" id="authMfaCode" class="input w-full" placeholder="رمز التحقق" maxlength="6" inputmode="numeric" pattern="[0-9]*" autocomplete="one-time-code" dir="ltr" style="text-align:center;letter-spacing:4px;font-size:18px;">
                            </div>
                            <button type="submit" id="authBtnMfaVerify" class="btn btn--primary w-full">تأكيد</button>
                        </form>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(this.overlay);
        document.body.style.overflow = 'hidden';

        const onEscape = (e) => { if (e.key === 'Escape') this.close(); };
        document.addEventListener('keydown', onEscape);
        this._onEscape = onEscape;

        // إدارة التركيز: احفظ العنصر السابق، ركّز أول حقل، واحبس Tab داخل النافذة (a11y)
        this._prevFocus = document.activeElement;
        setTimeout(() => { this.overlay?.querySelector('#authEmail')?.focus(); }, 30);
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
                strengthEl.style.color = s <= 1 ? 'var(--c-danger)' : s <= 2 ? 'var(--c-warning)' : 'var(--c-success)';
            });
        }

        // تدقيق 2026-07-09 (توحيد المصادقة): تحدي 2FA (AAL) بعد نجاح كلمة المرور — كان
        // هذا المنطق موجوداً فقط داخل AuthComponent.js الميت (حاويته مخفية دائماً)، أي
        // أن مستخدماً فعّل 2FA عبر TwoFactorModal لن يُطالَب برمزه إطلاقاً عند الدخول من
        // هذه النافذة الحية — فتصبح الحماية الثنائية شكلية بلا إنفاذ فعلي. لوحة صغيرة
        // مضمَّنة (لا prompt() متصفح خام) لتطابق أسلوب باقي هذه النافذة (نفس نمط لوحة
        // "نسيت كلمة المرور" أدناه).
        const challengeMfaIfNeeded = async () => {
            const { mfaGetAAL, mfaListFactors } = await import('../../supabaseClient.js');
            const aal = await mfaGetAAL();
            if (!(aal.ok && aal.data && aal.data.nextLevel === 'aal2' && aal.data.nextLevel !== aal.data.currentLevel)) {
                return { ok: true };
            }
            const factorsRes = await mfaListFactors();
            const totpList = factorsRes.ok && factorsRes.data ? (factorsRes.data.totp || factorsRes.data.factors || []) : [];
            const factorId = totpList[0]?.id;
            if (!factorId) return { ok: true };

            return new Promise((resolve) => {
                form.style.display = 'none';
                const mfaPanel = this.overlay.querySelector('#authModalMfaPanel');
                mfaPanel.style.display = 'block';
                const codeInput = mfaPanel.querySelector('#authMfaCode');
                const mfaErr = mfaPanel.querySelector('#authMfaError');
                setTimeout(() => codeInput?.focus(), 30);
                const submitBtn = mfaPanel.querySelector('#authBtnMfaVerify');
                const onSubmit = async (e) => {
                    e.preventDefault();
                    const code = (codeInput.value || '').trim();
                    if (code.length < 6) { mfaErr.textContent = 'أدخل الرمز المكوّن من 6 أرقام'; mfaErr.style.display = 'block'; return; }
                    submitBtn.disabled = true;
                    submitBtn.textContent = 'جاري التحقق...';
                    const { mfaChallengeAndVerify } = await import('../../supabaseClient.js');
                    const verifyRes = await mfaChallengeAndVerify(factorId, code);
                    if (verifyRes.ok) {
                        resolve({ ok: true });
                    } else {
                        mfaErr.textContent = verifyRes.error || 'رمز غير صحيح';
                        mfaErr.style.display = 'block';
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'تأكيد';
                    }
                };
                mfaPanel.querySelector('#authMfaForm').addEventListener('submit', onSubmit);
            });
        };

        const runAuth = async (isSignUp) => {
            const passEl = this.overlay.querySelector('#authPassword');
            const email = this.overlay.querySelector('#authEmail').value.trim();
            const pass = passEl.value;
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
                    if (isSignUp) {
                        const { log: auditLog, ACTIONS } = await import('../utils/auditLogger.js');
                        auditLog(ACTIONS.SIGNUP, { email });
                    } else {
                        const mfaResult = await challengeMfaIfNeeded();
                        if (!mfaResult.ok) return;
                    }
                    this._succeeded = true;
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
                if (passEl) passEl.value = '';
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
                    const { log: auditLog, ACTIONS } = await import('../utils/auditLogger.js');
                    auditLog(ACTIONS.OAUTH, { provider: 'google' });
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
            if (this._onTrap) this.overlay.removeEventListener('keydown', this._onTrap);
            this._onTrap = null;
            this.overlay.classList.remove('is-open');
            this.overlay.remove();
            this.overlay = null;
        }
        document.body.style.overflow = '';
        // أعِد التركيز للعنصر الذي فتح النافذة (a11y)
        try { this._prevFocus?.focus?.(); } catch (_) {}
        // إن أُغلقت بلا نجاح، أبلغ المستدعي مرّة واحدة (يعامله الحارس كتخطٍّ)
        if (!this._succeeded && this.onClose) {
            const cb = this.onClose;
            this.onClose = null;
            cb();
        }
    }

    render() {}
    attachEvents() {}
    populateSettings() {}
}
