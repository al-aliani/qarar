/**
 * Auth Component
 * Handles user authentication with Supabase and API Key configuration
 */
import { getSupabaseClient, getAuthUser, signOut, signInWithOAuth, signInWithOtpPhone, verifyOtpPhone, mfaGetAAL, mfaListFactors, mfaChallengeAndVerify, resendConfirmationEmail } from '../../supabaseClient.js';
import { toast } from '../utils/toast.js';
import { log as auditLog, ACTIONS } from '../utils/auditLogger.js';

function getDisplayName(user) {
  return (user?.user_metadata?.full_name || '').trim() || user?.email || user?.phone || '—';
}

export class AuthComponent {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.user = null;
        this.isExpanded = false;
        this._phoneSent = false;
        this._phoneNumber = '';
    }

    async render() {
        if (!this.container) return;

        // Check configuration
        const { ok } = await getSupabaseClient();
        if (!ok) {
            this.renderConfigMode();
            return;
        }

        // Check auth status
        const auth = await getAuthUser();
        this.user = auth.user;

        if (this.user) {
            this.renderUserMode();
        } else {
            this.renderLoginMode();
        }
    }

    renderConfigMode() {
        this.container.innerHTML = `
            <div class="auth-card p-4 card border-warning bg-warning-light">
                <div class="flex justify-between items-center mb-2">
                    <h3 class="font-bold text-warning-dark">⚙️ إعداد السحابة</h3>
                    <button id="btnToggleAuth" class="btn-xs btn--ghost">▼</button>
                </div>
                <div id="authContent" class="${this.isExpanded ? '' : 'hidden'}">
                    <p class="text-sm text-muted mb-3">أدخل بيانات Supabase لتفعيل الحفظ السحابي والمزامنة.</p>
                    <div class="form-group">
                        <label class="text-xs">Project URL</label>
                        <input type="text" id="inpSupabaseUrl" class="form-input text-xs" placeholder="https://xyz.supabase.co">
                    </div>
                    <div class="form-group">
                        <label class="text-xs">Anon Key</label>
                        <input type="password" id="inpSupabaseKey" class="form-input text-xs" placeholder="eyJhbGciOiJIUzI1NiIsInR5c...">
                    </div>
                    <button id="btnSaveConfig" class="btn btn--primary w-full mt-2 text-sm">حفظ الإعدادات</button>
                </div>
            </div>
        `;
        this.bindConfigEvents();
    }

    renderLoginMode() {
        this.container.innerHTML = `
            <div class="auth-card p-4 card">
                <div class="flex justify-between items-center mb-2">
                    <h3 class="font-bold">☁️ تسجيل الدخول</h3>
                    <button id="btnToggleAuth" class="btn-xs btn--ghost">▼</button>
                </div>
                <div id="authContent" class="${this.isExpanded ? '' : 'hidden'}">
                    <p class="text-sm text-muted mb-3">سجّل دخولك لحفظ مشاريعك سحابياً.</p>
                    <div class="flex gap-1 mb-3 p-1 rounded" style="background: var(--c-bg-card);">
                        <button type="button" id="authTabEmail" class="auth-tab flex-1 text-sm py-1.5 rounded font-medium" data-tab="email">بالبريد</button>
                        <button type="button" id="authTabPhone" class="auth-tab flex-1 text-sm py-1.5 rounded" data-tab="phone">بالجوال</button>
                    </div>
                    <div id="authEmailForm" class="auth-form">
                        <div class="form-group">
                            <input type="email" id="inpEmail" class="form-input text-sm" placeholder="البريد الإلكتروني">
                        </div>
                        <div class="form-group">
                            <input type="password" id="inpPassword" class="form-input text-sm" placeholder="كلمة المرور">
                        </div>
                        <div class="flex gap-2 mt-2">
                            <button id="btnLogin" class="btn btn--primary flex-1 text-sm">دخول</button>
                            <button id="btnSignup" class="btn btn--outline flex-1 text-sm">تسجيل</button>
                        </div>
                    </div>
                    <div id="authPhoneForm" class="auth-form hidden">
                        <div class="form-group">
                            <input type="tel" id="inpPhone" class="form-input text-sm" placeholder="05xxxxxxxx أو +9665xxxxxxxx">
                        </div>
                        <button type="button" id="btnSendOtp" class="btn btn--primary w-full text-sm mb-2">إرسال رمز الدخول</button>
                        <div id="authOtpBlock" class="hidden">
                            <div class="form-group">
                                <input type="text" id="inpOtp" class="form-input text-sm" placeholder="الرمز المكون من 6 أرقام" maxlength="6" inputmode="numeric" pattern="[0-9]*">
                            </div>
                            <button type="button" id="btnVerifyOtp" class="btn btn--primary w-full text-sm">تأكيد الدخول</button>
                        </div>
                    </div>
                    <div class="mt-3 pt-3" style="border-top: 1px solid var(--c-border);">
                        <button id="btnGoogleLogin" class="btn btn--ghost w-full text-sm mb-1" style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                            <span style="font-size: 18px;">🌐</span>
                            <span>تسجيل بحساب Google</span>
                        </button>
                        <button id="btnAppleLogin" class="btn btn--ghost w-full text-sm mb-1" style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                            <span style="font-size: 18px;">🍎</span>
                            <span>تسجيل بحساب Apple</span>
                        </button>
                        <button id="btnMicrosoftLogin" class="btn btn--ghost w-full text-sm" style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                            <span style="font-size: 18px;">🪟</span>
                            <span>تسجيل بحساب Microsoft</span>
                        </button>
                    </div>
                    <div id="authResendBlock" class="hidden mt-2 p-2 rounded" style="background:var(--c-danger-subtle);border:1px solid var(--c-danger);">
                        <p class="text-sm text-danger mb-1">البريد غير مفعّل. تحقق من صندوق الوارد أو البريد المزعج.</p>
                        <button id="btnResendConfirm" type="button" class="btn btn--ghost text-sm">إعادة إرسال رابط التأكيد</button>
                    </div>
                    <button id="btnClearConfig" class="btn btn--text text-xs text-muted w-full mt-2">مسح الإعدادات</button>
                </div>
            </div>
        `;
        this.bindLoginEvents();
    }

    renderUserMode() {
        const displayName = getDisplayName(this.user);
        const initial = (displayName !== '—' ? displayName[0] : (this.user.email || this.user.phone || '?')[0]).toUpperCase();
        this.container.innerHTML = `
            <div class="auth-card p-4 card bg-success-light border-success">
                <div class="flex items-center gap-3">
                    <div class="avatar bg-success text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">
                        ${initial}
                    </div>
                    <div class="flex-1 overflow-hidden">
                        <div class="text-sm font-bold truncate" title="${this.user.email || this.user.phone || ''}">${displayName}</div>
                        <div class="text-xs text-success-dark">● متصل سحابياً</div>
                    </div>
                    <button id="btn2FASettings" class="btn-xs btn--ghost" title="إعدادات المصادقة الثنائية">🔐</button>
                    <button id="btnLogout" class="btn-xs btn--ghost text-danger" title="تسجيل خروج">🚪</button>
                </div>
                <button type="button" id="btnUserPage" class="btn btn--ghost w-full mt-2 text-sm" title="صفحة حسابي">
                    👤 حسابي
                </button>
            </div>
        `;

        this.container.querySelector('#btnUserPage')?.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('feasibility:showUserProfile'));
        });
        
        this.container.querySelector('#btn2FASettings')?.addEventListener('click', async () => {
            const { TwoFactorModal } = await import('./TwoFactorModal.js');
            const modal = new TwoFactorModal();
            modal.show();
        });
        
        this.container.querySelector('#btnLogout')?.addEventListener('click', async () => {
            auditLog(ACTIONS.LOGOUT, {});
            await signOut();
        });
    }

    bindConfigEvents() {
        this.bindToggle();
        document.getElementById('btnSaveConfig').addEventListener('click', () => {
            const url = document.getElementById('inpSupabaseUrl').value.trim();
            const key = document.getElementById('inpSupabaseKey').value.trim();

            if (url && key) {
                localStorage.setItem('SUPABASE_URL', url);
                localStorage.setItem('SUPABASE_ANON_KEY', key);
                toast.success('تم حفظ الإعدادات! جاري التحديث...');
                setTimeout(() => window.location.reload(), 1500);
            } else {
                toast.error('الرجاء إدخال البيانات المطلوبة');
            }
        });
    }

    bindLoginEvents() {
        this.bindToggle();
        this._phoneSent = false;
        this._phoneNumber = '';

        const authTabEmail = this.container?.querySelector('#authTabEmail');
        const authTabPhone = this.container?.querySelector('#authTabPhone');
        const authEmailForm = this.container?.querySelector('#authEmailForm');
        const authPhoneForm = this.container?.querySelector('#authPhoneForm');
        if (authTabEmail && authTabPhone && authEmailForm && authPhoneForm) {
            authTabEmail.classList.add('auth-tab-active');
            authTabEmail.addEventListener('click', () => {
                authTabEmail.classList.add('auth-tab-active');
                authTabPhone.classList.remove('auth-tab-active');
                authEmailForm.classList.remove('hidden');
                authPhoneForm.classList.add('hidden');
            });
            authTabPhone.addEventListener('click', () => {
                authTabPhone.classList.add('auth-tab-active');
                authTabEmail.classList.remove('auth-tab-active');
                authPhoneForm.classList.remove('hidden');
                authEmailForm.classList.add('hidden');
            });
        }

        const btnSendOtp = this.container?.querySelector('#btnSendOtp');
        const inpPhone = this.container?.querySelector('#inpPhone');
        const authOtpBlock = this.container?.querySelector('#authOtpBlock');
        if (btnSendOtp && inpPhone && authOtpBlock) {
            btnSendOtp.addEventListener('click', async () => {
                const phone = (inpPhone.value || '').trim();
                if (!phone) {
                    toast.error('أدخل رقم الجوال');
                    return;
                }
                btnSendOtp.disabled = true;
                btnSendOtp.textContent = 'جاري الإرسال...';
                const result = await signInWithOtpPhone(phone);
                btnSendOtp.disabled = false;
                btnSendOtp.textContent = 'إرسال رمز الدخول';
                if (result.ok) {
                    this._phoneNumber = phone;
                    this._phoneSent = true;
                    authOtpBlock.classList.remove('hidden');
                    toast.success('تم إرسال الرمز إلى جوالك');
                } else {
                    toast.error(result.error || 'فشل إرسال الرمز. تأكد من تفعيل الدخول بالجوال في Supabase.');
                }
            });
        }

        const btnVerifyOtp = this.container?.querySelector('#btnVerifyOtp');
        const inpOtp = this.container?.querySelector('#inpOtp');
        if (btnVerifyOtp && inpOtp) {
            btnVerifyOtp.addEventListener('click', async () => {
                const token = (inpOtp.value || '').trim();
                if (!token || token.length < 6) {
                    toast.error('أدخل الرمز المكون من 6 أرقام');
                    return;
                }
                btnVerifyOtp.disabled = true;
                btnVerifyOtp.textContent = 'جاري التحقق...';
                const result = await verifyOtpPhone(this._phoneNumber, token);
                if (result.ok) {
                    toast.success('تم الدخول بنجاح');
                    this.render();
                } else {
                    toast.error(result.error || 'رمز غير صحيح');
                    btnVerifyOtp.disabled = false;
                    btnVerifyOtp.textContent = 'تأكيد الدخول';
                }
            });
        }

        const handleOAuth = async (provider, btnId, label, icon) => {
            const btn = document.getElementById(btnId);
            if (!btn) return;
            btn.disabled = true;
            btn.innerHTML = '<span>⏳ جاري...</span>';
            auditLog(ACTIONS.OAUTH, { provider });
            const result = await signInWithOAuth(provider);
            if (!result.ok) {
                toast.error('فشل الدخول بـ ' + label + ': ' + result.error);
                btn.disabled = false;
                btn.innerHTML = '<span style="font-size: 18px;">' + icon + '</span><span>تسجيل بحساب ' + label + '</span>';
                return;
            }
            // توجيه المتصفح لصفحة مزود OAuth (Google / Apple / Microsoft)
            if (result.data?.url) {
                window.location.href = result.data.url;
                return;
            }
            btn.disabled = false;
            btn.innerHTML = '<span style="font-size: 18px;">' + icon + '</span><span>تسجيل بحساب ' + label + '</span>';
            toast.warning('لم يُرجَع رابط الدخول. تأكد من تفعيل ' + label + ' في لوحة Supabase.');
        };
        document.getElementById('btnGoogleLogin')?.addEventListener('click', (e) => handleOAuth('google', 'btnGoogleLogin', 'Google', '🌐'));
        document.getElementById('btnAppleLogin')?.addEventListener('click', (e) => handleOAuth('apple', 'btnAppleLogin', 'Apple', '🍎'));
        document.getElementById('btnMicrosoftLogin')?.addEventListener('click', (e) => handleOAuth('azure', 'btnMicrosoftLogin', 'Microsoft', '🪟'));

        document.getElementById('btnLogin').addEventListener('click', async (e) => {
            const inpEmail = this.container?.querySelector('#inpEmail') || document.getElementById('inpEmail');
            const inpPassword = this.container?.querySelector('#inpPassword') || document.getElementById('inpPassword');
            const email = (inpEmail?.value || '').trim();
            const password = inpPassword?.value || '';

            if (!email || !password) {
                toast.error('أدخل البريد الإلكتروني وكلمة المرور');
                return;
            }

            e.target.disabled = true;
            e.target.textContent = '...';

            const { supabase } = await getSupabaseClient();
            const { error } = await supabase.auth.signInWithPassword({ email, password });

            if (error) {
                const isEmailNotConfirmed = (error.message || '').toLowerCase().includes('email not confirmed') || (error.message || '').includes('البريد غير مفعّل');
                toast.error(isEmailNotConfirmed ? 'البريد غير مفعّل. تحقق من صندوق الوارد أو استخدم «إعادة إرسال رابط التأكيد».' : 'فشل الدخول: ' + error.message);
                if (isEmailNotConfirmed) {
                    const block = document.getElementById('authResendBlock');
                    if (block) {
                        block.classList.remove('hidden');
                        const resendBtn = document.getElementById('btnResendConfirm');
                        if (resendBtn && !resendBtn._bound) {
                            resendBtn._bound = true;
                            resendBtn.addEventListener('click', async () => {
                                resendBtn.disabled = true;
                                resendBtn.textContent = 'جاري الإرسال...';
                                const res = await resendConfirmationEmail(email);
                                if (res.ok) {
                                    toast.success('تم إرسال رابط التأكيد إلى بريدك. تحقق من صندوق الوارد.');
                                    block.classList.add('hidden');
                                } else {
                                    toast.error(res.error || 'فشل الإرسال');
                                }
                                resendBtn.disabled = false;
                                resendBtn.textContent = 'إعادة إرسال رابط التأكيد';
                            });
                        }
                    }
                }
                e.target.disabled = false;
                e.target.textContent = 'دخول';
                return;
            }
            document.getElementById('authResendBlock')?.classList.add('hidden');
            const aal = await mfaGetAAL();
            if (aal.ok && aal.data && aal.data.nextLevel === 'aal2') {
                const factorsRes = await mfaListFactors();
                const totpList = factorsRes.ok && factorsRes.data ? (factorsRes.data.totp || factorsRes.data.factors || []) : [];
                const factorId = totpList[0]?.id;
                if (factorId) {
                    const code = prompt('أدخل رمز التطبيق (6 أرقام):');
                    if (code != null && code.trim()) {
                        const verifyRes = await mfaChallengeAndVerify(factorId, code.trim());
                        if (!verifyRes.ok) {
                            toast.error(verifyRes.error || 'رمز غير صحيح');
                            await supabase.auth.signOut();
                            e.target.disabled = false;
                            e.target.textContent = 'دخول';
                            return;
                        }
                    }
                }
            }
            auditLog(ACTIONS.LOGIN, { email });
            toast.success('مرحباً بك!');
            this.render();
        });

        document.getElementById('btnSignup').addEventListener('click', async (e) => {
            const inpEmail = this.container?.querySelector('#inpEmail') || document.getElementById('inpEmail');
            const inpPassword = this.container?.querySelector('#inpPassword') || document.getElementById('inpPassword');
            const email = (inpEmail?.value || '').trim();
            const password = inpPassword?.value || '';

            if (!email || !password) {
                toast.error('أدخل البريد الإلكتروني وكلمة المرور');
                return;
            }

            e.target.disabled = true;
            e.target.textContent = '...';

            let captchaToken = null;
            try {
                const { executeCaptcha, isCaptchaConfigured } = await import('../utils/captcha.js');
                if (isCaptchaConfigured()) captchaToken = await executeCaptcha('signup');
            } catch (_) {}

            const { supabase } = await getSupabaseClient();
            const signUpOptions = { email, password };
            if (captchaToken) signUpOptions.options = { captchaToken };
            const { error } = await supabase.auth.signUp(signUpOptions);

            if (error) {
                toast.error('فشل التسجيل: ' + error.message);
                e.target.disabled = false;
                e.target.textContent = 'تسجيل';
            } else {
                auditLog(ACTIONS.SIGNUP, { email });
                toast.success('تم التسجيل! تحقق من بريدك الإلكتروني.');
            }
        });

        document.getElementById('btnClearConfig').addEventListener('click', () => {
            if (confirm('هل أنت متأكد من مسح إعدادات Supabase؟')) {
                localStorage.removeItem('SUPABASE_URL');
                localStorage.removeItem('SUPABASE_ANON_KEY');
                window.location.reload();
            }
        });
    }

    bindToggle() {
        const btn = document.getElementById('btnToggleAuth');
        const content = document.getElementById('authContent');
        if (btn && content) {
            btn.addEventListener('click', () => {
                this.isExpanded = !this.isExpanded;
                content.classList.toggle('hidden');
                btn.textContent = this.isExpanded ? '▲' : '▼';
            });
        }
    }
}
