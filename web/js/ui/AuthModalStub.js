/**
 * AuthModal — واجهة تسجيل الدخول والتسجيل عبر Supabase.
 * يحافظ على توافق (containerId, options) مع الاستدعاء في Sidebar و DashboardView.
 */
import { trackEvent } from '../utils/analytics.js';
import { monitoring } from '../utils/monitoring.js';
import { attachModalA11y } from '../utils/modalA11y.js';

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

// تدقيق 2026-08-31: زر "إعادة إرسال رابط التأكيد" أدناه كان يعرض res.error الخام من
// Supabase عند الفشل (مثال: "For security purposes, you can only request this after
// N seconds") رغم أن translateAuthError أعلاه بُني بالضبط لمنع هذا النوع من التسريب —
// لم يكن مطبَّقاً على مسار resendConfirmationEmail. نفس النمط هنا لأخطائه الشائعة.
const RESEND_ERROR_TRANSLATIONS = [
    { match: 'security purposes', text: 'محاولات كثيرة خلال وقت قصير — انتظر قليلاً ثم أعد المحاولة.' },
    { match: 'rate limit', text: 'محاولات كثيرة خلال وقت قصير — انتظر قليلاً ثم أعد المحاولة.' },
    { match: 'user not found', text: 'لا يوجد حساب مسجَّل بهذا البريد.' },
    { match: 'email not found', text: 'لا يوجد حساب مسجَّل بهذا البريد.' },
];

function translateResendError(error) {
    const errLower = (error || '').toLowerCase();
    const found = RESEND_ERROR_TRANSLATIONS.find((t) => errLower.includes(t.match));
    return found ? found.text : 'تعذّر إرسال رابط التأكيد. حاول مرة أخرى لاحقاً.';
}

// أكواد خطأ mfa-recovery-unenroll (مصدرها الخادم — انظر supabase/functions/
// mfa-recovery-unenroll/index.ts) — نفس نمط ERROR_MESSAGES/friendlyError في
// WhatsAppVerifyModal.js.
const RECOVERY_ERROR_MESSAGES = {
    missing_recovery_code: 'أدخل رمز الاسترداد.',
    invalid_recovery_code: 'رمز الاسترداد غير صحيح.',
    rate_limited: 'محاولات كثيرة — انتظر قليلاً ثم أعد المحاولة.',
    factor_removal_failed: 'تعذّر إتمام الاسترداد. حاول مرة أخرى أو تواصل مع الدعم.',
};

function friendlyRecoveryError(code) {
    return RECOVERY_ERROR_MESSAGES[code] || 'حدث خطأ غير متوقع، حاول مرة أخرى.';
}

// تدقيق حي 2026-08-25: النافذة كانت تُفتح دائماً على تبويب «دخول» بعنوان «أهلاً بعودتك»،
// حتى لزائر وصل لتوّه من زر «ابدأ دراستك الآن» أو أحد أزرار الباقات في صفحة التسويق
// (app.js يحفظ landing_cta/selected_package عند وصوله) — أي إن التطبيق يعرف أنه قادم
// بنيّة البدء، ثم يحيّيه بـ«أهلاً بعودتك» على نموذج دخول لحساب لا يملكه. العلامة أدناه
// (تُكتَب عند كل نجاح فعلي في هذه النافذة) هي دليلنا الوحيد على حساب سابق على هذا الجهاز.
const HAS_ACCOUNT_KEY = 'qarar_has_account';

function hasKnownAccount() {
    try { return localStorage.getItem(HAS_ACCOUNT_KEY) === '1'; } catch (_) { return false; }
}

function markHasAccount() {
    try { localStorage.setItem(HAS_ACCOUNT_KEY, '1'); } catch (_) { /* تجاهل بيئات بلا localStorage */ }
}

function cameFromLandingFunnel() {
    try {
        return !!(sessionStorage.getItem('landing_cta') || sessionStorage.getItem('selected_package'));
    } catch (_) { return false; }
}

/** التبويب الافتراضي عند الفتح: إنشاء حساب فقط لقادمٍ من القمع بلا دليل على حساب سابق. */
function shouldDefaultToSignUp() {
    return cameFromLandingFunnel() && !hasKnownAccount();
}

export class AuthModal {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.onSuccess = options.onSuccess || null;
        this.onClose = options.onClose || null; // يُستدعى عند الإغلاق بلا نجاح (يعامله الحارس كتخطٍّ)
        this.overlay = null;
        this._succeeded = false;
        this._a11y = null;
    }

    open() {
        if (this.overlay) return;
        this.overlay = document.createElement('div');
        this.overlay.id = 'authModalOverlay';
        this.overlay.className = 'modal-overlay is-open';
        this.overlay.innerHTML = `
            <div class="modal-card auth-modal-card" role="dialog" aria-modal="true" aria-labelledby="authModalTitle">
                <div class="auth-modal-header">
                    <span class="auth-modal-logo">ق</span>
                    <div class="auth-modal-heading">
                        <strong id="authModalTitle">أهلاً بعودتك</strong>
                        <span id="authModalSubtitle">احفظ دراستك وزامنها بين أجهزتك</span>
                    </div>
                </div>
                <div class="modal-body">
                    <div id="authModalError" class="text-danger text-sm mb-2" role="alert" style="display:none;"></div>
                    <div id="authModalResendBlock" class="mb-2 p-2 rounded text-sm" style="display:none;background:var(--c-danger-subtle);border:1px solid var(--c-danger);">
                        <p class="text-danger mb-1">البريد غير مفعّل. تحقق من صندوق الوارد أو البريد المزعج.</p>
                        <button type="button" id="authBtnResendConfirm" class="btn btn--ghost text-sm">إعادة إرسال رابط التأكيد</button>
                    </div>
                    <div id="authModalNotConfigured" class="alert alert--warning text-sm" style="display:none;"></div>
                    <div id="authTabRow" class="auth-tabs" role="tablist" aria-label="دخول أو إنشاء حساب">
                        <button type="button" id="authTabSignIn" class="btn btn--primary" role="tab" aria-selected="true" aria-controls="authModalForm">دخول</button>
                        <button type="button" id="authTabSignUp" class="btn btn--ghost" role="tab" aria-selected="false" aria-controls="authModalForm">إنشاء حساب</button>
                    </div>
                    <form id="authModalForm" style="display:block;">
                        <div class="mb-3">
                            <label class="block text-sm mb-1" for="authEmail">البريد الإلكتروني</label>
                            <div class="auth-field"><svg class="ic" aria-hidden="true"><use href="#i-mail"/></svg><input type="email" id="authEmail" placeholder="you@example.com" required autocomplete="username" dir="ltr"></div>
                        </div>
                        <div class="mb-3">
                            <label class="block text-sm mb-1" for="authPassword">كلمة المرور</label>
                            <div class="auth-field"><svg class="ic" aria-hidden="true"><use href="#i-lock"/></svg><input type="password" id="authPassword" placeholder="••••••••" required autocomplete="current-password"></div>
                            <div id="authPasswordStrength" class="auth-strength" style="display:none;">
                                <div class="auth-strength-track"><div id="authPasswordStrengthFill" class="auth-strength-fill"></div></div>
                                <span id="authPasswordStrengthLabel" class="auth-strength-label"></span>
                            </div>
                        </div>
                        <div class="mb-3" id="authNameGroup" style="display:none;">
                            <label class="block text-sm mb-1" for="authName">الاسم</label>
                            <div class="auth-field"><svg class="ic" aria-hidden="true"><use href="#i-user"/></svg><input type="text" id="authName" placeholder="اسمك الكامل" autocomplete="name"></div>
                        </div>
                        <div class="mb-3" id="authPhoneGroup" style="display:none;">
                            <label class="block text-sm mb-1" for="authPhone">رقم الجوال (واتساب)</label>
                            <div class="auth-field"><svg class="ic" aria-hidden="true"><use href="#i-phone"/></svg><input type="tel" id="authPhone" placeholder="05xxxxxxxx" autocomplete="tel" dir="ltr" inputmode="numeric"></div>
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
                        <span class="auth-panel-icon"><svg aria-hidden="true"><use href="#i-key"/></svg></span>
                        <p class="text-sm mb-1" style="font-weight:700">إعادة تعيين كلمة المرور</p>
                        <label class="block text-sm mb-1" for="authForgotEmail">أدخل بريدك لإرسال رابط إعادة التعيين</label>
                        <div class="auth-field mb-2"><svg class="ic" aria-hidden="true"><use href="#i-mail"/></svg><input type="email" id="authForgotEmail" placeholder="you@example.com" autocomplete="email" dir="ltr"></div>
                        <div class="flex gap-2">
                            <button type="button" id="authBtnSendReset" class="btn btn--primary flex-1">إرسال الرابط</button>
                            <button type="button" id="authBtnBackToLogin" class="btn btn--secondary">رجوع</button>
                        </div>
                        <p id="authForgotMessage" class="text-sm mt-2" style="display:none;"></p>
                    </div>
                    <div id="authModalMfaPanel" class="mb-3" style="display:none;">
                        <span class="auth-panel-icon"><svg aria-hidden="true"><use href="#i-shield"/></svg></span>
                        <p class="text-sm mb-1" style="font-weight:700">التحقق بخطوتين</p>
                        <p class="text-muted text-sm mb-3">حسابك محمي بمصادقة ثنائية. أدخل رمز تطبيق المصادقة (6 أرقام).</p>
                        <div id="authMfaError" class="text-danger text-sm mb-2" role="alert" style="display:none;"></div>
                        <form id="authMfaForm">
                            <div class="mb-3">
                                <input type="text" id="authMfaCode" class="input w-full" placeholder="رمز التحقق" maxlength="6" inputmode="numeric" pattern="[0-9]*" autocomplete="one-time-code" dir="ltr" style="text-align:center;letter-spacing:4px;font-size:18px;">
                            </div>
                            <button type="submit" id="authBtnMfaVerify" class="btn btn--primary w-full">تأكيد</button>
                        </form>
                        <div class="text-center mt-2">
                            <button type="button" id="authBtnLostDevice" class="btn--text text-sm text-muted">فقدت جهاز المصادقة؟</button>
                        </div>
                    </div>
                    <div id="authModalRecoveryPanel" class="mb-3" style="display:none;">
                        <span class="auth-panel-icon"><svg aria-hidden="true"><use href="#i-key"/></svg></span>
                        <p class="text-sm mb-1" style="font-weight:700">استرداد الحساب</p>
                        <p class="text-muted text-sm mb-3">أدخل أحد رموز الاسترداد العشرة التي حصلت عليها عند تفعيل المصادقة الثنائية. سيُطلَب منك تفعيل مصادقة ثنائية جديدة بعد الدخول.</p>
                        <div id="authRecoveryError" class="text-danger text-sm mb-2" role="alert" style="display:none;"></div>
                        <form id="authRecoveryForm">
                            <div class="mb-3">
                                <input type="text" id="authRecoveryCode" class="input w-full" placeholder="XXXX-XXXX" autocomplete="off" dir="ltr" style="text-align:center;letter-spacing:2px;">
                            </div>
                            <div class="flex gap-2">
                                <button type="submit" id="authBtnRecoverySubmit" class="btn btn--primary flex-1">تأكيد</button>
                                <button type="button" id="authBtnRecoveryBack" class="btn btn--secondary">رجوع</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(this.overlay);
        document.body.style.overflow = 'hidden';
        // يُستخدَم لإخفاء غطاء الإقلاع (#bootCover في index.html) فور ظهور هذه النافذة
        // فعلياً — انظر app.js: كان الغطاء (إن أُضيف لاحقاً) يبقى بانتظار هذه اللحظة
        // تحديداً حين يكون المستخدم غير مسجَّل دخوله عند أول تحميل.
        window.dispatchEvent(new CustomEvent('feasibility:authModalShown'));

        // إدارة التركيز (حبس Tab + Escape + إعادة التركيز للفاتح) — انظر utils/modalA11y.js
        this._a11y = attachModalA11y({
            container: this.overlay,
            labelledBy: 'authModalTitle',
            initialFocus: '#authEmail',
            focusDelay: 30,
            onEscape: () => this.close()
        });

        this.overlay.addEventListener('click', (e) => { if (e.target === this.overlay) this.close(); });

        const form = this.overlay.querySelector('#authModalForm');
        const errEl = this.overlay.querySelector('#authModalError');
        const notCfg = this.overlay.querySelector('#authModalNotConfigured');

        // نعيد لون النص للافتراضي (خطأ/أحمر عبر class) في كل استدعاء حتى لا تتسرّب
        // رسالة نجاح خضراء (تأكيد التسجيل أدناه) إلى خطأ لاحق.
        const showErr = (msg) => { errEl.textContent = msg || ''; errEl.style.color = ''; errEl.style.display = msg ? 'block' : 'none'; };
        const showSuccessNote = (msg) => { errEl.textContent = msg; errEl.style.color = 'var(--c-success)'; errEl.style.display = 'block'; };

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
        const titleEl = this.overlay.querySelector('#authModalTitle');
        const subtitleEl = this.overlay.querySelector('#authModalSubtitle');
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
            // تدقيق 2026-08-31: minlength="8" كان ثابتاً بالـHTML بصرف النظر عن التبويب
            // النشط، بينما حد "8 أحرف" الفعلي (validatePassword أدناه) يُطبَّق فقط عند
            // التسجيل، والحد الأدنى الحقيقي على الخادم 6 (انظر AUTH_ERROR_TRANSLATIONS)
            // — فكان يمنع تحقق المتصفح إرسال نموذج الدخول لحساب حقيقي بكلمة مرور 6-7
            // أحرف قبل وصول أي كود JS. الآن يُضبط ديناميكياً حسب التبويب النشط.
            const passwordFieldEl = this.overlay.querySelector('#authPassword');
            if (passwordFieldEl) {
                if (signUp) {
                    passwordFieldEl.setAttribute('minlength', '8');
                    passwordFieldEl.title = '8+ أحرف، رقم واحد على الأقل، رمز واحد على الأقل';
                } else {
                    passwordFieldEl.removeAttribute('minlength');
                    passwordFieldEl.removeAttribute('title');
                }
            }
            if (titleEl) titleEl.textContent = signUp ? 'إنشاء حساب جديد' : 'أهلاً بعودتك';
            if (subtitleEl) subtitleEl.textContent = 'احفظ دراستك وزامنها بين أجهزتك';
            showErr('');
        };
        tabSignIn?.addEventListener('click', () => setAuthTab(false));
        tabSignUp?.addEventListener('click', () => setAuthTab(true));
        // الافتراضي في الـHTML أعلاه هو «دخول» (زائر عائد أو أي حالة أخرى) — لا نحوّل إلا
        // للقادم من قمع صفحة التسويق بلا حساب معروف على هذا الجهاز.
        if (shouldDefaultToSignUp()) setAuthTab(true);

        const validatePassword = (p) => {
            if (p.length < 8) return 'كلمة المرور 8 أحرف على الأقل';
            if (!/[0-9]/.test(p)) return 'أضف رقماً واحداً على الأقل';
            if (!/[^A-Za-z0-9]/.test(p)) return 'أضف رمزاً واحداً على الأقل (مثل !@#$%)';
            return '';
        };
        const passInput = this.overlay.querySelector('#authPassword');
        const strengthEl = this.overlay.querySelector('#authPasswordStrength');
        const strengthFillEl = this.overlay.querySelector('#authPasswordStrengthFill');
        const strengthLabelEl = this.overlay.querySelector('#authPasswordStrengthLabel');
        if (passInput && strengthEl) {
            passInput.addEventListener('input', () => {
                const p = passInput.value;
                if (p.length === 0) { strengthEl.style.display = 'none'; return; }
                strengthEl.style.display = 'flex';
                let s = 0;
                if (p.length >= 8) s++;
                if (p.length >= 12) s++;
                if (/[0-9]/.test(p)) s++;
                if (/[^A-Za-z0-9]/.test(p)) s++;
                const label = s <= 1 ? 'ضعيفة' : s <= 2 ? 'متوسطة' : s <= 3 ? 'جيدة' : 'قوية';
                const color = s <= 1 ? 'var(--c-danger)' : s <= 2 ? 'var(--c-warning)' : 'var(--c-success)';
                if (strengthFillEl) { strengthFillEl.style.width = Math.min(100, (s / 4) * 100) + '%'; strengthFillEl.style.background = color; }
                if (strengthLabelEl) { strengthLabelEl.textContent = label; strengthLabelEl.style.color = color; }
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
                // تدقيق أمني 2026-08-21: signIn() بالأعلى أنشأ جلسة صالحة فعلياً (aal1) قبل
                // هذا التحدي — إغلاق النافذة من هنا بلا إكمال الرمز يجب أن يُبطل هذه الجلسة
                // (close() أدناه)، لا يتركها صالحة صامتة تُستخدَم لاحقاً بلا الرمز إطلاقاً.
                this._mfaChallengeActive = true;
                form.style.display = 'none';
                if (tabRow) tabRow.style.display = 'none';
                if (titleEl) titleEl.textContent = 'خطوة أمان';
                if (subtitleEl) subtitleEl.textContent = 'تحقق بخطوتين';
                const mfaPanel = this.overlay.querySelector('#authModalMfaPanel');
                mfaPanel.style.display = 'block';
                const codeInput = mfaPanel.querySelector('#authMfaCode');
                const mfaErr = mfaPanel.querySelector('#authMfaError');
                setTimeout(() => codeInput?.focus(), 30);
                const submitBtn = mfaPanel.querySelector('#authBtnMfaVerify');
                const onSubmit = async (e) => {
                    e.preventDefault();
                    const code = (codeInput.value || '').trim();
                    if (code.length < 6) { trackEvent('mfa_failed', { reason: 'invalid_length' }); mfaErr.textContent = 'أدخل الرمز المكوّن من 6 أرقام'; mfaErr.style.display = 'block'; return; }
                    submitBtn.disabled = true;
                    submitBtn.textContent = 'جاري التحقق...';
                    const { mfaChallengeAndVerify } = await import('../../supabaseClient.js');
                    const verifyRes = await mfaChallengeAndVerify(factorId, code);
                    if (verifyRes.ok) {
                        trackEvent('mfa_success', {});
                        this._mfaChallengeActive = false;
                        // AuthGuard.isAuthenticated ضُبطت false عند SIGNED_IN بانتظار هذا
                        // التحدي (راجع AuthGuard.js) — نُحدّثها الآن فعلياً بعد نجاح الرمز.
                        const { AuthGuard } = await import('../middleware/AuthGuard.js');
                        await AuthGuard.refreshAuthState();
                        resolve({ ok: true });
                    } else {
                        trackEvent('mfa_failed', { reason: 'invalid_code' });
                        mfaErr.textContent = verifyRes.error || 'رمز غير صحيح';
                        mfaErr.style.display = 'block';
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'تأكيد';
                    }
                };
                mfaPanel.querySelector('#authMfaForm').addEventListener('submit', onSubmit);

                // فقدان جهاز المصادقة: مسار بديل لا يمرّ بـauth.mfa.unenroll العادي (يتطلب
                // هو نفسه AAL2 لا يملكه من فقد جهازه) — يستهلك رمز استرداد عبر Edge
                // Function بصلاحية service_role (mfa-recovery-unenroll).
                const recoveryPanel = this.overlay.querySelector('#authModalRecoveryPanel');
                const recoveryInput = recoveryPanel?.querySelector('#authRecoveryCode');
                const recoveryErr = recoveryPanel?.querySelector('#authRecoveryError');
                const recoveryBtn = recoveryPanel?.querySelector('#authBtnRecoverySubmit');
                this.overlay.querySelector('#authBtnLostDevice')?.addEventListener('click', () => {
                    trackEvent('mfa_recovery_opened', {});
                    mfaPanel.style.display = 'none';
                    if (recoveryPanel) recoveryPanel.style.display = 'block';
                    if (titleEl) titleEl.textContent = 'استرداد الحساب';
                    if (subtitleEl) subtitleEl.textContent = 'رمز استرداد بدل تطبيق المصادقة';
                    setTimeout(() => recoveryInput?.focus(), 30);
                });
                this.overlay.querySelector('#authBtnRecoveryBack')?.addEventListener('click', () => {
                    if (recoveryPanel) recoveryPanel.style.display = 'none';
                    mfaPanel.style.display = 'block';
                    if (titleEl) titleEl.textContent = 'خطوة أمان';
                    if (subtitleEl) subtitleEl.textContent = 'تحقق بخطوتين';
                    setTimeout(() => codeInput?.focus(), 30);
                });
                recoveryPanel?.querySelector('#authRecoveryForm').addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const code = (recoveryInput.value || '').trim();
                    if (!code) { recoveryErr.textContent = 'أدخل رمز الاسترداد'; recoveryErr.style.display = 'block'; return; }
                    recoveryErr.style.display = 'none';
                    recoveryBtn.disabled = true;
                    recoveryBtn.textContent = 'جاري التحقق...';
                    const { redeemMfaRecoveryCode } = await import('../services/MfaRecoveryService.js');
                    const result = await redeemMfaRecoveryCode(code);
                    if (result.ok) {
                        trackEvent('mfa_recovery_success', {});
                        // النجاح يُسقط كل جلسات المستخدم على الخادم فعلياً (حذف عامل verified) —
                        // لا نحاول استئناف الجلسة القديمة (نفس مبدأ تعليق close() بالأسفل)، بل
                        // نسجّل خروجاً محلياً صريحاً ونطلب إعادة الدخول وتفعيل 2FA جديدة فوراً.
                        this._mfaChallengeActive = false;
                        this._succeeded = false;
                        const { signOut } = await import('../../supabaseClient.js');
                        await signOut();
                        const { toast } = await import('../utils/toast.js');
                        toast.success('تم استرداد حسابك. سجّل الدخول من جديد وفعّل مصادقة ثنائية جديدة فوراً.', 10000);
                        this.close();
                        resolve({ ok: false, recovered: true });
                    } else {
                        trackEvent('mfa_recovery_failed', { reason: result.error || 'unknown' });
                        recoveryErr.textContent = friendlyRecoveryError(result.error);
                        recoveryErr.style.display = 'block';
                        recoveryBtn.disabled = false;
                        recoveryBtn.textContent = 'تأكيد';
                    }
                });
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
            const trackAuthFailure = (reason, provider = 'password') => {
                trackEvent(isSignUp ? 'signup_error' : 'login_failed', {
                    reason: String(reason || 'unknown').slice(0, 40),
                    provider,
                });
            };
            try {
                const { signIn, signUp, getSupabaseClient, updateUserProfile } = await import('../../supabaseClient.js');
                const { ok } = await getSupabaseClient();
                if (!ok) {
                    trackAuthFailure('supabase_unavailable');
                    // فشل تقني حقيقي (تعذّر تهيئة/الاتصال بعميل Supabase) لا خطأ إدخال مستخدم — يستحق مراقبة.
                    monitoring.captureMessage('Auth: تعذّر تهيئة عميل Supabase عند الدخول/إنشاء الحساب', 'error', { source: 'AuthModalStub.runAuth', isSignUp });
                    showErr('Supabase غير مهيأ. لا يمكن الدخول أو إنشاء حساب.');
                    return;
                }
                // حلقة نمو (share_token → تسجيل): التقطها app.js من ?ref= عند الوصول من رابط
                // مشاركة وحفظها بـsessionStorage — نقرأها هنا فقط عند إنشاء حساب فعلي.
                let referredByToken = null;
                if (isSignUp) {
                    try { referredByToken = sessionStorage.getItem('referred_by_token') || null; } catch (_) { /* تجاهل */ }
                }
                const authResult = isSignUp ? await signUp(email, pass, phoneE164, fullName, referredByToken) : await signIn(email, pass);
                const { ok: authOk, error } = authResult;
                if (authOk) {
                    if (isSignUp) {
                        try { sessionStorage.removeItem('referred_by_token'); } catch (_) { /* تجاهل */ }
                        const { log: auditLog, ACTIONS } = await import('../utils/auditLogger.js');
                        auditLog(ACTIONS.SIGNUP, { email });
                        // تأكيد البريد مفعّل في Supabase ⇒ signUp يُعيد user بلا session (لا جلسة
                        // نشطة). كان الكود يعامل هذا كدخول ناجح (onSuccess يحدّث اللوحة كأن المستخدم
                        // داخل، بينما كل حفظ سحابي سيفشل «not authenticated») — فنعرض بدلاً منه رسالة
                        // تأكيد واضحة، ونحوّله لتبويب الدخول، دون إغلاق النافذة أو استدعاء onSuccess.
                        if (!authResult.data?.session) {
                            trackEvent('signup_awaiting_confirmation', {});
                            markHasAccount(); // الحساب أُنشئ فعلاً — لا يُعرَض عليه «إنشاء حساب» مجدداً
                            setAuthTab(false);
                            showSuccessNote('تم إنشاء الحساب. أرسلنا رابط تأكيد إلى بريدك — فعّله ثم سجّل الدخول من هنا.');
                            return;
                        }
                    } else {
                        const mfaResult = await challengeMfaIfNeeded();
                        if (!mfaResult.ok) {
                            // استرداد ناجح عبر "فقدت جهاز المصادقة؟": ليس فشلاً — أغلق نفسه
                            // وسجَّل خروج المستخدم عمداً بالفعل (راجع معالج authRecoveryForm
                            // أعلاه)، لا داعٍ لأي تتبّع/تنبيه إضافي هنا يصوّره كخطأ تقني.
                            if (mfaResult.recovered) return;
                            trackEvent('mfa_failed', { reason: 'challenge_failed' });
                            // فشل تقني في تدفق تحدي MFA نفسه (لا رمز خاطئ من المستخدم — ذاك مُعالَج بلوحة الخطأ أعلاه).
                            monitoring.captureMessage('Auth: فشل تحدي التحقق بخطوتين بعد نجاح كلمة المرور', 'error', { source: 'AuthModalStub.runAuth' });
                            return;
                        }
                    }
                    // تدقيق حي 2026-07-22: الدخول هنا لم يكن يوجّه أبداً لـ#/checkout ولا يطبّق
                    // الباقة المختارة من صفحة الأسعار — نفس المنطق المطبَّق فعلياً في مسار
                    // الجوال/OTP (PhoneAuthModal.js:144-157)، هنا لبريد/كلمة المرور.
                    try {
                        const selectedPackage = sessionStorage.getItem('selected_package');
                        if (['free', 'self', 'reviewed', 'full'].includes(selectedPackage)) {
                            await updateUserProfile({ preferred_tier: selectedPackage });
                        }
                    } catch (_) { /* لا نمنع نجاح الدخول بسبب فشل حفظ الباقة المفضّلة */ }
                    this._succeeded = true;
                    markHasAccount();
                    trackEvent(isSignUp ? 'signup_complete' : 'login_complete', {});
                    if (this.onSuccess) this.onSuccess({ success: true });
                    this.close();
                    try {
                        const selectedPackage = sessionStorage.getItem('selected_package');
                        if (selectedPackage && selectedPackage !== 'free') window.location.hash = '#/checkout';
                        else sessionStorage.removeItem('selected_package');
                    } catch (_) { /* تجاهل بيئات بلا sessionStorage/hash */ }
                } else {
                    const isEmailNotConfirmed = (error || '').toLowerCase().includes('email not confirmed');
                    trackAuthFailure(isEmailNotConfirmed ? 'email_not_confirmed' : 'invalid_credentials');
                    showErr(translateAuthError(error));
                    const resendBlock = this.overlay.querySelector('#authModalResendBlock');
                    if (resendBlock) resendBlock.style.display = isEmailNotConfirmed ? 'block' : 'none';
                }
            } catch (e) {
                trackAuthFailure('unexpected_error');
                // استثناء JS غير متوقَّع (لا فشل بيانات دخول عادي) — يستحق مراقبة.
                monitoring.captureException(e, { source: 'AuthModalStub.runAuth', isSignUp });
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
            if (res.ok) {
                showErr('');
                if (block) block.style.display = 'none';
                btn.textContent = 'تم الإرسال. تحقق من بريدك.';
            } else {
                showErr(translateResendError(res.error));
                btn.textContent = 'إعادة إرسال رابط التأكيد';
            }
            btn.disabled = false;
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
                    // لا markHasAccount() هنا: هذا مجرد تحويل لصفحة Google — النجاح الفعلي
                    // يقع بعد العودة ولا يمرّ بهذه النافذة إطلاقاً (تُدمَّر بالتنقّل). وسم
                    // النية وحدها سيكذب على كل من ألغى من عند Google.
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
            if (titleEl) titleEl.textContent = 'استعادة الحساب';
            if (subtitleEl) subtitleEl.textContent = 'أدخل بريدك ونرسل لك رابط إعادة التعيين';
            if (forgotPanel) forgotPanel.style.display = 'block';
            const forgotEmailInput = this.overlay.querySelector('#authForgotEmail');
            setTimeout(() => forgotEmailInput?.focus(), 30);
        });
        this.overlay.querySelector('#authBtnBackToLogin')?.addEventListener('click', () => {
            if (forgotPanel) forgotPanel.style.display = 'none';
            if (forgotMessage) { forgotMessage.style.display = 'none'; forgotMessage.textContent = ''; }
            form.style.display = 'block';
            if (tabRow) tabRow.style.display = 'flex';
            setAuthTab(isSignUpTab);
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
        if (this.overlay) {
            this.overlay.classList.remove('is-open');
            this.overlay.remove();
            this.overlay = null;
        }
        document.body.style.overflow = '';
        // أعِد التركيز للعنصر الذي فتح النافذة (a11y)
        this._a11y?.release();
        this._a11y = null;
        // تدقيق أمني 2026-08-21: جلسة aal1 صالحة فعلياً بهذي اللحظة (كلمة المرور تحققت)
        // لكن تحدي 2FA لم يكتمل — إغلاق النافذة هنا (Escape/×/نقر خارجي، كلها تصل لـclose())
        // يجب أن يُنهي هذه الجلسة فعلياً، لا يتركها صالحة صامتة تُستخدَم لاحقاً بلا الرمز.
        if (this._mfaChallengeActive && !this._succeeded) {
            this._mfaChallengeActive = false;
            import('../../supabaseClient.js').then(({ signOut }) => signOut());
        }
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
