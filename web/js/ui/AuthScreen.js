/**
 * AuthScreen - شاشة المصادقة الاحترافية
 * تدعم: تسجيل الدخول، إنشاء حساب، استعادة كلمة المرور، إعدادات Supabase
 */

import { getSupabaseClient, getAuthUser, signIn, signUp, signOut, signInWithOAuth } from '../../supabaseClient.js';
import { toast } from '../utils/toast.js';

export class AuthScreen {
    constructor(options = {}) {
        this.onAuthSuccess = options.onAuthSuccess || (() => { });
        this.onSkip = options.onSkip || (() => { });
        this.mode = 'login'; // login, register, forgot, setup
        this.isLoading = false;
        this.overlay = null;
    }

    async checkSupabaseConfig() {
        const { ok } = await getSupabaseClient();
        return ok;
    }

    async render() {
        // Check if Supabase is configured
        const isConfigured = await this.checkSupabaseConfig();
        if (!isConfigured) {
            this.mode = 'setup';
        }

        // Check if already logged in
        if (isConfigured) {
            const { user } = await getAuthUser();
            if (user) {
                this.onAuthSuccess(user);
                return;
            }
        }

        this.createOverlay();
        this.updateContent();
        this.show();
    }

    createOverlay() {
        // Remove existing overlay
        const existing = document.getElementById('authScreenOverlay');
        if (existing) existing.remove();

        this.overlay = document.createElement('div');
        this.overlay.id = 'authScreenOverlay';
        this.overlay.className = 'auth-screen-overlay';
        this.overlay.innerHTML = `
            <div class="auth-screen-container">
                <div class="auth-screen-card">
                    <div class="auth-screen-header">
                        <div class="auth-logo">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                            </svg>
                        </div>
                        <h1 class="auth-title">محاكي دراسة الجدوى</h1>
                        <p class="auth-subtitle">أنشئ دراسات جدوى احترافية في دقائق</p>
                    </div>
                    <div id="authScreenContent"></div>
                    <div class="auth-screen-footer">
                        <button id="btnSkipAuth" class="auth-skip-btn">
                            تخطي والمتابعة بدون حساب
                        </button>
                    </div>
                </div>
                <div class="auth-screen-features">
                    <h2>لماذا تسجل حساب؟</h2>
                    <div class="feature-list">
                        <div class="feature-item">
                            <span class="feature-icon">☁️</span>
                            <div>
                                <strong>حفظ سحابي</strong>
                                <p>احفظ مشاريعك وادخل من أي جهاز</p>
                            </div>
                        </div>
                        <div class="feature-item">
                            <span class="feature-icon">🔒</span>
                            <div>
                                <strong>أمان البيانات</strong>
                                <p>بياناتك مشفرة ومحمية</p>
                            </div>
                        </div>
                        <div class="feature-item">
                            <span class="feature-icon">🤝</span>
                            <div>
                                <strong>مشاركة الفريق</strong>
                                <p>شارك دراساتك مع شركائك</p>
                            </div>
                        </div>
                        <div class="feature-item">
                            <span class="feature-icon">📊</span>
                            <div>
                                <strong>تقارير متقدمة</strong>
                                <p>تصدير احترافي للبنوك والمستثمرين</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(this.overlay);

        // Bind skip button
        this.overlay.querySelector('#btnSkipAuth').addEventListener('click', () => {
            this.hide();
            this.onSkip();
        });
    }

    updateContent() {
        const content = document.getElementById('authScreenContent');
        if (!content) return;

        switch (this.mode) {
            case 'setup':
                content.innerHTML = this.getSetupHTML();
                this.bindSetupEvents();
                break;
            case 'login':
                content.innerHTML = this.getLoginHTML();
                this.bindLoginEvents();
                break;
            case 'register':
                content.innerHTML = this.getRegisterHTML();
                this.bindRegisterEvents();
                break;
            case 'forgot':
                content.innerHTML = this.getForgotHTML();
                this.bindForgotEvents();
                break;
        }
    }

    getSetupHTML() {
        return `
            <div class="auth-form setup-form">
                <div class="setup-notice">
                    <span class="notice-icon">⚙️</span>
                    <div>
                        <strong>إعداد الاتصال السحابي</strong>
                        <p>أدخل بيانات مشروع Supabase الخاص بك</p>
                    </div>
                </div>

                <div class="form-group">
                    <label>
                        <span class="label-icon">🔗</span>
                        رابط المشروع (Project URL)
                    </label>
                    <input type="url" id="inputSupabaseUrl"
                           placeholder="https://xxxxx.supabase.co"
                           class="form-input" dir="ltr">
                </div>

                <div class="form-group">
                    <label>
                        <span class="label-icon">🔑</span>
                        المفتاح العام (Anon Key)
                    </label>
                    <input type="password" id="inputSupabaseKey"
                           placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                           class="form-input" dir="ltr">
                    <button type="button" class="toggle-password" data-target="inputSupabaseKey">👁️</button>
                </div>

                <button id="btnSaveSetup" class="auth-btn primary">
                    <span class="btn-text">حفظ وتفعيل</span>
                    <span class="btn-loader hidden">⏳</span>
                </button>

                <div class="setup-help">
                    <p>ليس لديك مشروع Supabase؟</p>
                    <a href="https://supabase.com" target="_blank" rel="noopener">
                        أنشئ حساب مجاني على Supabase ←
                    </a>
                </div>
            </div>
        `;
    }

    getLoginHTML() {
        return `
            <div class="auth-form login-form">
                <div class="form-group">
                    <label>
                        <span class="label-icon">📧</span>
                        البريد الإلكتروني
                    </label>
                    <input type="email" id="inputEmail"
                           placeholder="example@email.com"
                           class="form-input" dir="ltr" autocomplete="email">
                </div>

                <div class="form-group">
                    <label>
                        <span class="label-icon">🔒</span>
                        كلمة المرور
                    </label>
                    <input type="password" id="inputPassword"
                           placeholder="••••••••"
                           class="form-input" dir="ltr" autocomplete="current-password">
                    <button type="button" class="toggle-password" data-target="inputPassword">👁️</button>
                </div>

                <div id="authError" class="auth-error hidden"></div>

                <button id="btnLogin" class="auth-btn primary">
                    <span class="btn-text">تسجيل الدخول</span>
                    <span class="btn-loader hidden">⏳</span>
                </button>

                <div class="auth-divider">
                    <span>أو المتابعة باستخدام</span>
                </div>

                <button id="btnGoogleLogin" class="auth-btn google">
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="18" height="18" alt="Google">
                    <span class="btn-text">Google</span>
                </button>

                <div class="auth-divider">
                    <span>أو</span>
                </div>

                <button id="btnGoToRegister" class="auth-btn secondary">
                    إنشاء حساب جديد
                </button>

                <div class="auth-links">
                    <a href="#" id="btnForgotPassword">نسيت كلمة المرور؟</a>
                    <span class="separator">|</span>
                    <a href="#" id="btnGoToSetup">إعدادات الاتصال</a>
                </div>
            </div>
        `;
    }

    getRegisterHTML() {
        return `
            <div class="auth-form register-form">
                <div class="form-group">
                    <label>
                        <span class="label-icon">👤</span>
                        الاسم الكامل
                    </label>
                    <input type="text" id="inputFullName"
                           placeholder="محمد أحمد"
                           class="form-input" autocomplete="name">
                </div>

                <div class="form-group">
                    <label>
                        <span class="label-icon">📧</span>
                        البريد الإلكتروني
                    </label>
                    <input type="email" id="inputEmail"
                           placeholder="example@email.com"
                           class="form-input" dir="ltr" autocomplete="email">
                </div>

                <div class="form-group">
                    <label>
                        <span class="label-icon">🔒</span>
                        كلمة المرور
                    </label>
                    <input type="password" id="inputPassword"
                           placeholder="8 أحرف على الأقل"
                           class="form-input" dir="ltr" autocomplete="new-password">
                    <button type="button" class="toggle-password" data-target="inputPassword">👁️</button>
                    <div class="password-strength" id="passwordStrength"></div>
                </div>

                <div class="form-group">
                    <label>
                        <span class="label-icon">🔒</span>
                        تأكيد كلمة المرور
                    </label>
                    <input type="password" id="inputPasswordConfirm"
                           placeholder="أعد إدخال كلمة المرور"
                           class="form-input" dir="ltr" autocomplete="new-password">
                </div>

                <div id="authError" class="auth-error hidden"></div>

                <button id="btnRegister" class="auth-btn primary">
                    <span class="btn-text">إنشاء الحساب</span>
                    <span class="btn-loader hidden">⏳</span>
                </button>

                <div class="auth-links">
                    <a href="#" id="btnGoToLogin">لديك حساب؟ سجل دخول</a>
                </div>
            </div>
        `;
    }

    getForgotHTML() {
        return `
            <div class="auth-form forgot-form">
                <div class="forgot-notice">
                    <span class="notice-icon">📧</span>
                    <p>أدخل بريدك الإلكتروني وسنرسل لك رابط لاستعادة كلمة المرور</p>
                </div>

                <div class="form-group">
                    <label>
                        <span class="label-icon">📧</span>
                        البريد الإلكتروني
                    </label>
                    <input type="email" id="inputEmail"
                           placeholder="example@email.com"
                           class="form-input" dir="ltr" autocomplete="email">
                </div>

                <div id="authError" class="auth-error hidden"></div>
                <div id="authSuccess" class="auth-success hidden"></div>

                <button id="btnResetPassword" class="auth-btn primary">
                    <span class="btn-text">إرسال رابط الاستعادة</span>
                    <span class="btn-loader hidden">⏳</span>
                </button>

                <div class="auth-links">
                    <a href="#" id="btnGoToLogin">← العودة لتسجيل الدخول</a>
                </div>
            </div>
        `;
    }

    bindSetupEvents() {
        // Toggle password visibility
        this.bindPasswordToggles();

        // Save setup
        const btnSave = document.getElementById('btnSaveSetup');
        btnSave?.addEventListener('click', async () => {
            const url = document.getElementById('inputSupabaseUrl')?.value.trim();
            const key = document.getElementById('inputSupabaseKey')?.value.trim();

            if (!url || !key) {
                toast.error('الرجاء إدخال جميع البيانات');
                return;
            }

            if (!url.includes('supabase.co')) {
                toast.error('الرابط غير صحيح. يجب أن يكون رابط Supabase');
                return;
            }

            this.setLoading(btnSave, true);

            // Save to localStorage
            localStorage.setItem('SUPABASE_URL', url);
            localStorage.setItem('SUPABASE_ANON_KEY', key);

            // Test connection
            try {
                const { ok, error } = await getSupabaseClient();
                if (ok) {
                    toast.success('تم الاتصال بنجاح! جاري التحديث...');
                    setTimeout(() => {
                        this.mode = 'login';
                        this.updateContent();
                    }, 1500);
                } else {
                    toast.error('فشل الاتصال: ' + error);
                    localStorage.removeItem('SUPABASE_URL');
                    localStorage.removeItem('SUPABASE_ANON_KEY');
                }
            } catch (e) {
                toast.error('خطأ في الاتصال: ' + e.message);
            } finally {
                this.setLoading(btnSave, false);
            }
        });
    }

    bindLoginEvents() {
        this.bindPasswordToggles();

        // Login
        const btnLogin = document.getElementById('btnLogin');
        btnLogin?.addEventListener('click', () => this.handleLogin());

        // Google Login
        const btnGoogle = document.getElementById('btnGoogleLogin');
        btnGoogle?.addEventListener('click', async () => {
            this.setLoading(btnGoogle, true);
            this.hideError();
            try {
                const result = await signInWithOAuth('google');
                if (!result.ok) {
                    this.showError(result.error);
                    this.setLoading(btnGoogle, false);
                }
                // Redirect happens automatically
            } catch (e) {
                this.showError('تعذر بدء تسجيل الدخول بـ Google');
                this.setLoading(btnGoogle, false);
            }
        });

        // Enter key
        document.getElementById('inputPassword')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleLogin();
        });

        // Navigation
        document.getElementById('btnGoToRegister')?.addEventListener('click', () => {
            this.mode = 'register';
            this.updateContent();
        });

        document.getElementById('btnForgotPassword')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.mode = 'forgot';
            this.updateContent();
        });

        document.getElementById('btnGoToSetup')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.mode = 'setup';
            this.updateContent();
        });
    }

    bindRegisterEvents() {
        this.bindPasswordToggles();

        // Password strength
        document.getElementById('inputPassword')?.addEventListener('input', (e) => {
            this.updatePasswordStrength(e.target.value);
        });

        // Register
        const btnRegister = document.getElementById('btnRegister');
        btnRegister?.addEventListener('click', () => this.handleRegister());

        // Navigation
        document.getElementById('btnGoToLogin')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.mode = 'login';
            this.updateContent();
        });
    }

    bindForgotEvents() {
        const btnReset = document.getElementById('btnResetPassword');
        btnReset?.addEventListener('click', () => this.handleForgotPassword());

        document.getElementById('btnGoToLogin')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.mode = 'login';
            this.updateContent();
        });
    }

    bindPasswordToggles() {
        document.querySelectorAll('.toggle-password').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.dataset.target;
                const input = document.getElementById(targetId);
                if (input) {
                    input.type = input.type === 'password' ? 'text' : 'password';
                    btn.textContent = input.type === 'password' ? '👁️' : '🙈';
                }
            });
        });
    }

    async handleLogin() {
        const email = document.getElementById('inputEmail')?.value.trim();
        const password = document.getElementById('inputPassword')?.value;
        const btnLogin = document.getElementById('btnLogin');
        const errorDiv = document.getElementById('authError');

        if (!email || !password) {
            this.showError('الرجاء إدخال البريد وكلمة المرور');
            return;
        }

        this.setLoading(btnLogin, true);
        this.hideError();

        try {
            const result = await signIn(email, password);

            if (!result.ok) {
                this.showError(this.translateError(result.error));
                return;
            }

            toast.success('مرحباً بك!');

            const { user } = await getAuthUser();
            this.hide();
            this.onAuthSuccess(user);

        } catch (e) {
            this.showError('حدث خطأ غير متوقع');
            console.error(e);
        } finally {
            this.setLoading(btnLogin, false);
        }
    }

    async handleRegister() {
        const fullName = document.getElementById('inputFullName')?.value.trim();
        const email = document.getElementById('inputEmail')?.value.trim();
        const password = document.getElementById('inputPassword')?.value;
        const passwordConfirm = document.getElementById('inputPasswordConfirm')?.value;
        const btnRegister = document.getElementById('btnRegister');

        // Validation
        if (!fullName || !email || !password) {
            this.showError('الرجاء إدخال جميع البيانات');
            return;
        }

        if (password.length < 8) {
            this.showError('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
            return;
        }

        if (password !== passwordConfirm) {
            this.showError('كلمتا المرور غير متطابقتين');
            return;
        }

        this.setLoading(btnRegister, true);
        this.hideError();

        try {
            const { supabase } = await getSupabaseClient();

            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName
                    }
                }
            });

            if (error) {
                this.showError(this.translateError(error.message));
                return;
            }

            if (data?.user?.identities?.length === 0) {
                this.showError('هذا البريد مسجل مسبقاً');
                return;
            }

            toast.success('تم إنشاء الحساب! تحقق من بريدك الإلكتروني لتفعيل الحساب.');

            // Switch to login
            setTimeout(() => {
                this.mode = 'login';
                this.updateContent();
            }, 2000);

        } catch (e) {
            this.showError('حدث خطأ غير متوقع');
            console.error(e);
        } finally {
            this.setLoading(btnRegister, false);
        }
    }

    async handleForgotPassword() {
        const email = document.getElementById('inputEmail')?.value.trim();
        const btnReset = document.getElementById('btnResetPassword');
        const successDiv = document.getElementById('authSuccess');

        if (!email) {
            this.showError('الرجاء إدخال البريد الإلكتروني');
            return;
        }

        this.setLoading(btnReset, true);
        this.hideError();

        try {
            const { supabase } = await getSupabaseClient();

            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin + '/reset-password'
            });

            if (error) {
                this.showError(this.translateError(error.message));
                return;
            }

            if (successDiv) {
                successDiv.textContent = 'تم إرسال رابط الاستعادة إلى بريدك الإلكتروني';
                successDiv.classList.remove('hidden');
            }

            toast.success('تحقق من بريدك الإلكتروني');

        } catch (e) {
            this.showError('حدث خطأ غير متوقع');
            console.error(e);
        } finally {
            this.setLoading(btnReset, false);
        }
    }

    updatePasswordStrength(password) {
        const strengthDiv = document.getElementById('passwordStrength');
        if (!strengthDiv) return;

        let strength = 0;
        let label = '';
        let color = '';

        if (password.length >= 8) strength++;
        if (password.length >= 12) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^A-Za-z0-9]/.test(password)) strength++;

        if (strength <= 1) {
            label = 'ضعيفة';
            color = '#ef4444';
        } else if (strength <= 3) {
            label = 'متوسطة';
            color = '#f59e0b';
        } else {
            label = 'قوية';
            color = '#10b981';
        }

        strengthDiv.innerHTML = `
            <div class="strength-bar">
                <div class="strength-fill" style="width: ${strength * 20}%; background: ${color}"></div>
            </div>
            <span class="strength-label" style="color: ${color}">${label}</span>
        `;
    }

    translateError(error) {
        const translations = {
            'Invalid login credentials': 'البريد أو كلمة المرور غير صحيحة',
            'Email not confirmed': 'البريد غير مفعّل. تحقق من صندوق الوارد',
            'User already registered': 'هذا البريد مسجل مسبقاً',
            'Password should be at least 6 characters': 'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
            'Unable to validate email address': 'البريد الإلكتروني غير صالح',
            'Signup requires a valid password': 'الرجاء إدخال كلمة مرور صالحة',
            'Rate limit exceeded': 'محاولات كثيرة. انتظر قليلاً وحاول مجدداً'
        };

        return translations[error] || error;
    }

    showError(message) {
        const errorDiv = document.getElementById('authError');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.classList.remove('hidden');
        }
    }

    hideError() {
        const errorDiv = document.getElementById('authError');
        if (errorDiv) {
            errorDiv.classList.add('hidden');
        }
    }

    setLoading(button, loading) {
        if (!button) return;

        const text = button.querySelector('.btn-text');
        const loader = button.querySelector('.btn-loader');

        button.disabled = loading;

        if (text) text.classList.toggle('hidden', loading);
        if (loader) loader.classList.toggle('hidden', !loading);
    }

    show() {
        if (this.overlay) {
            this.overlay.classList.add('visible');
            document.body.style.overflow = 'hidden';
        }
    }

    hide() {
        if (this.overlay) {
            this.overlay.classList.remove('visible');
            document.body.style.overflow = '';
        }
    }

    destroy() {
        this.hide();
        this.overlay?.remove();
    }
}

// Singleton for quick access
let authScreenInstance = null;

export function showAuthScreen(options = {}) {
    if (authScreenInstance) {
        authScreenInstance.destroy();
    }
    authScreenInstance = new AuthScreen(options);
    authScreenInstance.render();
    return authScreenInstance;
}

export function hideAuthScreen() {
    authScreenInstance?.hide();
}
