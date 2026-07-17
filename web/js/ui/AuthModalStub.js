/**
 * AuthModal — واجهة تسجيل الدخول والتسجيل عبر Supabase.
 * يحافظ على توافق (containerId, options) مع الاستدعاء في Sidebar و DashboardView.
 */
import { trackEvent } from '../utils/analytics.js';

// تدقيق 2026-07-17: supabaseClient.js:signIn() يُعيد e.message الخام من Supabase GoTrue
// بلا أي ترجمة — قبل هذا كان أي خطأ غير "email not confirmed" يظهر كنص إنجليزي حرفي
// (مثال: "Invalid login credentials") للمستخدم رغم أن الواجهة عربية بالكامل. نترجم
// الرسائل الشائعة، ونستبدل أي رسالة أخرى غير معروفة برسالة عربية عامة بدل تسريب النص
// الإنجليزي الخام — لا نعرض أبداً error كما هو.
const AUTH_ERROR_TRANSLATIONS = [
    { match: 'email not confirmed', text: 'البريد غير مفعّل. استخدم الزر أدناه لإعادة إرسال رابط التأكيد.' },
    { match: 'invalid login credentials', text: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' },
    { match: 'user already registered', text: 'هذا البريد مسجَّل بالفعل — جرّب تسجيل الدخول بدل إنشاء حساب جديد.' },
    { match: 'password should be at least', text: 'كلمة المرور قصيرة جداً — استخدم 6 أحرف على الأقل.' },
];

function translateAuthError(error) {
    const errLower = (error || '').toLowerCase();
    const found = AUTH_ERROR_TRANSLATIONS.find((t) => errLower.includes(t.match));
    return found ? found.text : 'فشل تسجيل الدخول أو إنشاء الحساب.';
}

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
                    <div id="authTabRow" class="flex gap-2 mb-3" role="tablist" aria-label="دخول أو إنشاء حساب">
                        <button type="button" id="authTabSignIn" class="btn btn--primary flex-1" role="tab" aria-selected="true" aria-controls="authModalForm">دخول</button>
                        <button type="button" id="authTabSignUp" class="btn btn--ghost flex-1" role="tab" aria-selected="false" aria-controls="authModalForm">إنشاء حساب</button>
                    </div>
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
                        <div class="mb-3" id="authNameGroup" style="display:none;">
                            <label class="block text-sm mb-1" for="authName">الاسم</label>
                            <input type="text" id="authName" class="input w-full" placeholder="اسمك الكامل" autocomplete="name">
                        </div>
                        <div class="mb-3" id="authPhoneGroup" style="display:none;">
                            <label class="block text-sm mb-1" for="authPhone">رقم الجوال (واتساب)</label>
                            <input type="tel" id="authPhone" class="input w-full" placeholder="05xxxxxxxx" autocomplete="tel" dir="ltr" inputmode="numeric">
                            <p class="text-xs text-muted mt-1">نستخدمه للتواصل معك بخصوص طلباتك عبر واتساب.</p>
                        </div>
                        <div class="flex gap-2 mb-2">
                            <button type="submit" id="authBtnSignIn" class="btn btn--primary flex-1">دخول</button>
                            <button type="button" id="authBtnSignUp" class="btn btn--secondary flex-1" style="display:none;">إنشاء حساب</button>
                        </div>
                        <p class="text-xs text-muted text-center mb-2">
                            بإنشاء حساب أو تسجيل الدخول، أنت توافق على
                            <a href="./terms.html" target="_blank" rel="noopener">الشروط والأحكام</a>
                            و<a href="./privacy.html" target="_blank" rel="noopener">سياسة الخصوصية</a>.
                        </p>
                        <div class="text-center mb-2">
                            <button type="button" id="authBtnForgotPassword" class="btn--text text-sm text-muted">نسيت كلمة المرور؟</button>
                        </div>
                        <div class="border-t border-solid mt-3 pt-3" style="border-color:var(--c-border);">
                            <p class="text-xs text-muted text-center mb-2">أو</p>
                            <button type="button" id="authBtnGoogle" class="btn btn--ghost w-full flex items-center justify-center gap-2" title="تسجيل الدخول بحساب Google">
                                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/><path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.348 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/></svg>
                                تسجيل الدخول بـ Google
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

        // تدقيق 2026-07-17: كانت حقول الاسم/الجوال (غير مطلوبة إلا عند إنشاء حساب) ظاهرة
        // دائماً بجانب حقلَي البريد/كلمة المرور — نموذج واحد مزدحم بلا فصل واضح بين دخول
        // وتسجيل. تبويبان يتحكمان الآن بإظهارها وبأيّ من زرَّي الإجراء الأساسيَّين ظاهر،
        // مع isSignUpTab يوجّه إرسال النموذج (Enter/submit) للدالة الصحيحة أدناه.
        let isSignUpTab = false;
        const tabRow = this.overlay.querySelector('#authTabRow');
        const tabSignIn = this.overlay.querySelector('#authTabSignIn');
        const tabSignUp = this.overlay.querySelector('#authTabSignUp');
        const nameGroup = this.overlay.querySelector('#authNameGroup');
        const phoneGroup = this.overlay.querySelector('#authPhoneGroup');
        const btnSignInEl = this.overlay.querySelector('#authBtnSignIn');
        const btnSignUpEl = this.overlay.querySelector('#authBtnSignUp');
        const setAuthTab = (signUp) => {
            isSignUpTab = signUp;
            tabSignIn.classList.toggle('btn--primary', !signUp);
            tabSignIn.classList.toggle('btn--ghost', signUp);
            tabSignIn.setAttribute('aria-selected', String(!signUp));
            tabSignUp.classList.toggle('btn--primary', signUp);
            tabSignUp.classList.toggle('btn--ghost', !signUp);
            tabSignUp.setAttribute('aria-selected', String(signUp));
            nameGroup.style.display = signUp ? 'block' : 'none';
            phoneGroup.style.display = signUp ? 'block' : 'none';
            btnSignInEl.style.display = signUp ? 'none' : 'block';
            btnSignUpEl.style.display = signUp ? 'block' : 'none';
            showErr('');
        };
        tabSignIn?.addEventListener('click', () => setAuthTab(false));
        tabSignUp?.addEventListener('click', () => setAuthTab(true));

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
                if (tabRow) tabRow.style.display = 'none';
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
            let phoneE164 = null;
            let fullName = null;
            if (isSignUp) {
                const pErr = validatePassword(pass);
                if (pErr) { showErr(pErr); return; }
                fullName = (this.overlay.querySelector('#authName')?.value || '').trim();
                if (!fullName) { showErr('أدخل اسمك لإنشاء الحساب'); return; }
                const { normalizeSaudiPhone } = await import('../utils/phoneUtils.js');
                const phoneRaw = this.overlay.querySelector('#authPhone')?.value || '';
                phoneE164 = normalizeSaudiPhone(phoneRaw);
                if (!phoneE164) { showErr('أدخل رقم جوال سعودي صحيح لإنشاء الحساب (مثال: 0512345678)'); return; }
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
                const { ok: authOk, error } = isSignUp ? await signUp(email, pass, phoneE164, fullName) : await signIn(email, pass);
                if (authOk) {
                    if (isSignUp) {
                        const { log: auditLog, ACTIONS } = await import('../utils/auditLogger.js');
                        auditLog(ACTIONS.SIGNUP, { email });
                    } else {
                        const mfaResult = await challengeMfaIfNeeded();
                        if (!mfaResult.ok) return;
                    }
                    this._succeeded = true;
                    trackEvent(isSignUp ? 'signup_complete' : 'login_complete', {});
                    if (this.onSuccess) this.onSuccess({ success: true });
                    this.close();
                } else {
                    const isEmailNotConfirmed = (error || '').toLowerCase().includes('email not confirmed');
                    showErr(translateAuthError(error));
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

        form.addEventListener('submit', (e) => { e.preventDefault(); runAuth(isSignUpTab); });
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
            if (tabRow) tabRow.style.display = 'none';
            if (forgotPanel) forgotPanel.style.display = 'block';
        });
        this.overlay.querySelector('#authBtnBackToLogin')?.addEventListener('click', () => {
            if (forgotPanel) forgotPanel.style.display = 'none';
            if (forgotMessage) { forgotMessage.style.display = 'none'; forgotMessage.textContent = ''; }
            form.style.display = 'block';
            if (tabRow) tabRow.style.display = 'flex';
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
                    if (tabRow) tabRow.style.display = 'none';
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
