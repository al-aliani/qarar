import { signInWithOtpPhone, verifyOtpPhone, updateUserProfile, signInWithOAuth } from '../../supabaseClient.js';
import { normalizeSaudiPhone } from '../utils/phoneUtils.js';
import { attachModalA11y } from '../utils/modalA11y.js';

/** دخول سريع برقم الجوال. الإرسال الحقيقي يتم عبر Supabase Phone Auth بقناة WhatsApp. */
export class PhoneAuthModal {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.onSuccess = options.onSuccess || (() => {});
        this.onClose = options.onClose || (() => {});
        this.overlay = null;
        this.phone = '';
        this.succeeded = false;
        this._a11y = null;
    }

    open() {
        if (this.overlay) return;
        const existingOverlay = document.getElementById('phoneAuthModalOverlay');
        if (existingOverlay) {
            existingOverlay.querySelector('input:not([style*="display:none"])')?.focus();
            return;
        }

        const currentUrl = new URL(window.location.href);
        const hashParams = new URLSearchParams(currentUrl.hash.replace(/^#/, ''));
        const oauthError = currentUrl.searchParams.get('error_description') || hashParams.get('error_description');
        const oauthErrorCode = currentUrl.searchParams.get('error_code') || hashParams.get('error_code')
            || currentUrl.searchParams.get('error') || hashParams.get('error') || '';
        if (oauthError) {
            ['error', 'error_code', 'error_description', 'sb'].forEach((key) => currentUrl.searchParams.delete(key));
            if (currentUrl.hash.startsWith('#error=')) currentUrl.hash = '#/home';
            window.history.replaceState({}, '', currentUrl);
        }

        this.overlay = document.createElement('div');
        this.overlay.id = 'phoneAuthModalOverlay';
        this.overlay.className = 'modal-overlay is-open';
        this.overlay.innerHTML = `
            <div class="modal-card" style="width:420px;max-width:calc(100vw - 32px)" role="dialog" aria-modal="true" aria-labelledby="phoneAuthTitle">
                <div class="modal-header">
                    <div>
                        <h3 id="phoneAuthTitle">دخول سريع</h3>
                        <p class="text-xs text-muted mt-1">برقم الجوال فقط — لا تحتاج كلمة مرور</p>
                    </div>
                </div>
                <div class="modal-body">
                    <div id="phoneAuthError" class="text-danger text-sm mb-3" role="alert" style="display:none"></div>
                    <form id="phoneAuthSendForm">
                        <label class="block text-sm font-medium mb-1" for="phoneAuthNumber">رقم الجوال السعودي</label>
                        <input id="phoneAuthNumber" class="input w-full mb-2" type="tel" inputmode="numeric" autocomplete="tel" dir="ltr" placeholder="05xxxxxxxx" required>
                        <p class="text-xs text-muted mb-4">سنرسل لك رمز تحقق عبر واتساب. إذا كان الرقم جديدًا فسيُنشأ حسابك تلقائيًا.</p>
                        <button type="submit" id="phoneAuthSend" class="btn btn--primary w-full">إرسال رمز واتساب</button>
                        <div class="flex items-center gap-3 my-4" aria-hidden="true">
                            <span style="height:1px;background:var(--c-border);flex:1"></span>
                            <span class="text-xs text-muted">أو</span>
                            <span style="height:1px;background:var(--c-border);flex:1"></span>
                        </div>
                        <button type="button" id="phoneAuthGoogle" class="btn btn--ghost w-full flex items-center justify-center gap-2">
                            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                                <path fill="#4285F4" d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.482h4.844a4.14 4.14 0 0 1-1.797 2.716v2.258h2.909c1.702-1.567 2.684-3.875 2.684-6.615Z"/>
                                <path fill="#34A853" d="M9 18c2.43 0 4.468-.806 5.956-2.18l-2.909-2.258c-.806.54-1.836.86-3.047.86-2.344 0-4.328-1.585-5.037-3.714H.956v2.332A9 9 0 0 0 9 18Z"/>
                                <path fill="#FBBC05" d="M3.963 10.708A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.281-1.708V4.96H.956A9 9 0 0 0 0 9c0 1.452.347 2.827.956 4.04l3.007-2.332Z"/>
                                <path fill="#EA4335" d="M9 3.578c1.322 0 2.508.454 3.442 1.346l2.582-2.582C13.464.89 11.426 0 9 0A9 9 0 0 0 .956 4.96l3.007 2.332C4.672 5.163 6.656 3.578 9 3.578Z"/>
                            </svg>
                            المتابعة باستخدام Google
                        </button>
                        <p class="text-xs text-muted mt-3" style="text-align:center">سيبقى حسابك مسجّلًا على هذا الجهاز حتى تختار تسجيل الخروج.</p>
                    </form>
                    <form id="phoneAuthVerifyForm" style="display:none">
                        <p class="text-sm mb-3">أدخل الرمز المرسل إلى <strong id="phoneAuthMasked" dir="ltr"></strong></p>
                        <label class="block text-sm font-medium mb-1" for="phoneAuthCode">رمز التحقق</label>
                        <input id="phoneAuthCode" class="input w-full mb-3" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" dir="ltr" style="text-align:center;letter-spacing:6px;font-size:20px" required>
                        <button type="submit" id="phoneAuthVerify" class="btn btn--primary w-full">دخول</button>
                        <div class="flex items-center justify-center gap-2 mt-3">
                            <button type="button" id="phoneAuthResend" class="btn--text text-sm">إعادة الإرسال</button>
                            <span class="text-muted">·</span>
                            <button type="button" id="phoneAuthChange" class="btn--text text-sm">تغيير الرقم</button>
                        </div>
                    </form>
                    <button type="button" id="phoneAuthSkip" class="btn btn--ghost w-full mt-4">تخطي الآن ومتابعة بدون تسجيل دخول</button>
                    <a href="./landing.html" class="btn btn--ghost w-full mt-2" style="text-align:center">الرجوع إلى الصفحة الرئيسية</a>
                </div>
            </div>`;
        document.body.appendChild(this.overlay);
        document.body.style.overflow = 'hidden';

        const errorEl = this.overlay.querySelector('#phoneAuthError');
        const sendForm = this.overlay.querySelector('#phoneAuthSendForm');
        const verifyForm = this.overlay.querySelector('#phoneAuthVerifyForm');
        const showError = (message = '') => {
            errorEl.textContent = message;
            errorEl.style.display = message ? 'block' : 'none';
        };
        if (oauthError) {
            showError(this.describeOAuthError(oauthError, oauthErrorCode));
        }
        const setBusy = (button, busy, busyText) => {
            if (!button) return;
            if (!button.dataset.label) button.dataset.label = button.textContent;
            button.disabled = busy;
            button.textContent = busy ? busyText : button.dataset.label;
        };

        const sendCode = async () => {
            showError();
            const input = this.overlay.querySelector('#phoneAuthNumber');
            const phone = normalizeSaudiPhone(input?.value || this.phone);
            if (!phone) { showError('أدخل رقم جوال سعودي صحيح، مثل 0512345678.'); return; }
            this.phone = phone;
            const button = this.overlay.querySelector('#phoneAuthSend');
            setBusy(button, true, 'جاري الإرسال...');
            const result = await signInWithOtpPhone(phone, 'whatsapp');
            setBusy(button, false);
            if (!result.ok) {
                showError(this.translateError(result.error));
                return;
            }
            this.overlay.querySelector('#phoneAuthMasked').textContent = phone.replace(/(\+9665)\d{4}(\d{4})/, '$1****$2');
            sendForm.style.display = 'none';
            verifyForm.style.display = 'block';
            setTimeout(() => this.overlay?.querySelector('#phoneAuthCode')?.focus(), 20);
        };

        sendForm.addEventListener('submit', (event) => { event.preventDefault(); sendCode(); });
        this.overlay.querySelector('#phoneAuthGoogle')?.addEventListener('click', async () => {
            showError();
            const button = this.overlay.querySelector('#phoneAuthGoogle');
            setBusy(button, true, 'جاري فتح Google...');
            const result = await signInWithOAuth('google');
            if (!result.ok) {
                setBusy(button, false);
                showError(result.error || 'تعذر تسجيل الدخول باستخدام Google.');
            }
        });
        verifyForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            showError();
            const token = (this.overlay.querySelector('#phoneAuthCode')?.value || '').trim();
            if (!/^\d{6}$/.test(token)) { showError('أدخل رمز التحقق المكوّن من 6 أرقام.'); return; }
            const button = this.overlay.querySelector('#phoneAuthVerify');
            setBusy(button, true, 'جاري التحقق...');
            const result = await verifyOtpPhone(this.phone, token);
            setBusy(button, false);
            if (!result.ok) { showError(this.translateError(result.error)); return; }
            try {
                const selectedPackage = sessionStorage.getItem('selected_package');
                if (['free', 'self', 'reviewed', 'full'].includes(selectedPackage)) {
                    await updateUserProfile({ preferred_tier: selectedPackage });
                }
            } catch (_) {}
            this.succeeded = true;
            this.close();
            this.onSuccess(result.data?.user || result.data?.session?.user || null);
            try {
                const selectedPackage = sessionStorage.getItem('selected_package');
                if (selectedPackage && selectedPackage !== 'free') window.location.hash = '#/checkout';
                else sessionStorage.removeItem('selected_package');
            } catch (_) {}
        });
        this.overlay.querySelector('#phoneAuthSkip')?.addEventListener('click', () => this.skip());
        this.overlay.querySelector('#phoneAuthResend')?.addEventListener('click', sendCode);
        this.overlay.querySelector('#phoneAuthChange')?.addEventListener('click', () => {
            showError();
            verifyForm.style.display = 'none';
            sendForm.style.display = 'block';
            setTimeout(() => this.overlay?.querySelector('#phoneAuthNumber')?.focus(), 20);
        });
        // onEscape غائب عمداً: لا توجد إغلاق بـEscape هنا اليوم — الخروج الوحيد هو زر
        // «تخطي الآن» الذي يُبلّغ AuthGuard بتخطٍّ صريح.
        this._a11y = attachModalA11y({
            container: this.overlay,
            labelledBy: 'phoneAuthTitle',
            initialFocus: '#phoneAuthNumber',
            focusDelay: 20
        });
    }

    /**
     * سبب فشل OAuth الحقيقي كما يرسله Supabase/Google في error_description،
     * بدل رسالة تخمينية ثابتة تلوم Client ID. الدخول ينجح حتى authorize (لا
     * يحتاج إلا client_id العام) ثم يفشل عند callback، فالعطل دائماً في تبادل
     * الرمز أو حفظ المستخدم أو الموافقة — لا في Client ID.
     *
     * النص التفصيلي (error_description) له الأولوية دائماً على الرمز
     * (error_code) لأن Supabase يستخدم "unexpected_failure" كرمز عام لأي فشل
     * غير مصنَّف (راجع docs/guides/auth/debugging/error-codes) — يشمل فشل
     * تبادل الرمز مع Google بقدر ما يشمل فشل حفظ المستخدم، فلا يدل بمفرده على
     * السبب. الرمز يُستخدم فقط حين لا يعطي النص أي دليل.
     */
    describeOAuthError(description = '', code = '') {
        const raw = String(description).trim();
        const c = String(code).toLowerCase();
        const d = raw.toLowerCase();
        let hint;
        if (d.includes('exchange') || d.includes('invalid_client') || d.includes('unauthorized_client') || d.includes('invalid_grant')) {
            hint = 'تعذر إكمال تسجيل الدخول عبر Google: فشل تبادل الرمز مع Google — غالبًا Client Secret في Supabase غير صحيح (تحقق من عدم وجود مسافة زائدة في البداية أو النهاية عند اللصق) أو منتهٍ. أعد نسخه من Google Cloud → Credentials إلى Supabase → Authentication → Providers → Google.';
        } else if (d.includes('access_denied') || c.includes('access_denied')) {
            hint = 'تعذر إكمال تسجيل الدخول عبر Google: أُلغي الإذن. إن كان تطبيق Google OAuth في وضع «Testing» فلن يدخل إلا الحسابات المضافة كمستخدمي اختبار — انشره (Publish) أو أضف بريدك في Google Cloud → OAuth consent screen.';
        } else if (d.includes('redirect')) {
            hint = 'تعذر إكمال تسجيل الدخول عبر Google: عدم تطابق رابط إعادة التوجيه. تأكد أن Google Cloud فيه Authorized redirect URI يساوي https://<project-ref>.supabase.co/auth/v1/callback.';
        } else if (d.includes('email')) {
            hint = 'تعذر إكمال تسجيل الدخول عبر Google: لم يُرجع البريد الإلكتروني. تأكد من تفعيل نطاق email في إعدادات OAuth.';
        } else if (d.includes('database') || d.includes('saving new user')) {
            hint = 'تعذر إكمال تسجيل الدخول عبر Google: فشل حفظ المستخدم في قاعدة البيانات. راجع سجل Supabase → Logs → Auth للتفاصيل.';
        } else if (c.includes('unexpected_failure')) {
            hint = 'تعذر إكمال تسجيل الدخول عبر Google: خطأ عام غير مصنَّف من خادم Supabase. راجع سجل Supabase → Logs → Auth (ابحث عن الوقت الحالي) لمعرفة السبب الدقيق.';
        } else {
            hint = 'تعذر إكمال تسجيل الدخول عبر Google.';
        }
        return raw ? `${hint} (التفاصيل: ${raw})` : hint;
    }

    translateError(error = '') {
        const value = String(error).toLowerCase();
        if (value.includes('rate') || value.includes('seconds')) return 'انتظر قليلًا قبل طلب رمز جديد.';
        if (value.includes('token') || value.includes('otp')) return 'الرمز غير صحيح أو انتهت صلاحيته.';
        if (value.includes('provider') || value.includes('whatsapp')) return 'قناة واتساب غير مهيأة حاليًا. راجع إعدادات مزود الرسائل.';
        return 'تعذر إكمال الدخول. تحقق من الرقم والاتصال ثم حاول مرة أخرى.';
    }

    close() {
        if (!this.overlay || !this.succeeded) return;
        this.overlay.remove();
        this.overlay = null;
        document.body.style.overflow = '';
        this._a11y?.release();
        this._a11y = null;
    }

    /** تخطي الدخول: يُغلق النافذة بلا تسجيل ويُخطر onClose (AuthGuard يعامله كتخطٍّ صريح). */
    skip() {
        if (!this.overlay) return;
        this.overlay.remove();
        this.overlay = null;
        document.body.style.overflow = '';
        this._a11y?.release();
        this._a11y = null;
        this.onClose();
    }
}
