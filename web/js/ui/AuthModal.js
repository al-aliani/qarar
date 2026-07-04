/**
 * نافذة تسجيل الدخول/التسجيل. غير مستخدمة في البناء بسبب خطأ تحليل (parse) في Vite.
 * الاستيراد الحالي من AuthModalStub. أعد './AuthModal.js' عند حل المشكلة.
 */
function _authModalHTML(title, formClass, mainClass, btnLabel, toggleLabel) {
    return '<div class="auth-modal relative">' +
        '<button type="button" id="authCloseBtn" class="absolute top-2 left-2 text-gray-500 hover:text-gray-700" aria-label="إغلاق">&#10005;</button>' +
        '<h2>' + title + '</h2><div id="authSettingsForm" class="' + formClass + '">' +
        '<input id="inputSbUrl"><input id="inputSbKey"><select id="inputAiProvider"><option value="openai">OpenAI</option></select>' +
        '<input id="inputAiKey"><input id="inputAiModel"><button id="btnSaveLink">Save</button><a href="#" id="authBackToLogin">Back</a></div>' +
        '<div id="authMainForm" class="' + mainClass + '">' +
        '<input id="inputEmail"><input id="inputPassword"><div id="authError"></div><div id="authSuccess"></div>' +
        '<button id="btnAuthAction">' + btnLabel + '</button>' +
        '<a href="#" id="toggleAuthMode">' + toggleLabel + '</a><a href="#" id="openSettings">Settings</a></div></div>';
}

export class AuthModal {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        // support passing client or options object
        if (options.signIn) { // check if it's a supabase client-like object? No, strict check
            this.client = options;
            this.onSuccess = null;
        } else {
            this.client = options.client || null;
            this.onSuccess = options.onSuccess || (typeof options === 'function' ? options : null);
        }

        this.isOpen = false;
        this.mode = 'login'; // 'login' or 'register'
        this.settingsMode = false;
    }

    render() {
        // Create modal overlay if it doesn't exist
        let overlay = document.getElementById('authModalOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'authModalOverlay';
            overlay.className = 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center hidden';
            document.body.appendChild(overlay);
        }

        const title = this.settingsMode ? 'Settings' : (this.mode === 'login' ? 'Login' : 'Register');
        const formClass = this.settingsMode ? '' : 'hidden';
        const mainClass = this.settingsMode ? 'hidden' : '';
        const btnLabel = this.mode === 'login' ? 'Login' : 'Register';
        const toggleLabel = this.mode === 'login' ? 'Register' : 'Login';

        overlay.innerHTML = _authModalHTML(title, formClass, mainClass, btnLabel, toggleLabel);

        this.attachEvents(overlay);
    }

    attachEvents(overlay) {
        // Toggle Logic
        const toggleBtn = overlay.querySelector('#toggleAuthMode');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.mode = this.mode === 'login' ? 'register' : 'login';
                this.render();
                this.open(); // Re-open to refresh content
            });
        }

        // Close
        const closeBtn = overlay.querySelector('#authCloseBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.close();
        });

        // Settings Toggle
        const settingsBtn = overlay.querySelector('#openSettings');
        const backBtn = overlay.querySelector('#authBackToLogin');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.settingsMode = true;
                this.render();
                this.open();
                this.populateSettings();
            });
        }
        if (backBtn) {
            backBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.settingsMode = false;
                this.render();
                this.open();
            });
        }

        // Save Settings
        const btnSaveLink = overlay.querySelector('#btnSaveLink');
        if (btnSaveLink) {
            btnSaveLink.addEventListener('click', () => {
                const url = (document.getElementById('inputSbUrl') && document.getElementById('inputSbUrl').value) ? String(document.getElementById('inputSbUrl').value).trim() : '';
                const key = (document.getElementById('inputSbKey') && document.getElementById('inputSbKey').value) ? String(document.getElementById('inputSbKey').value).trim() : '';

                const aiProvider = (document.getElementById('inputAiProvider') && document.getElementById('inputAiProvider').value) || '';
                const aiKey = (document.getElementById('inputAiKey') && document.getElementById('inputAiKey').value) ? String(document.getElementById('inputAiKey').value).trim() : '';
                const aiModel = (document.getElementById('inputAiModel') && document.getElementById('inputAiModel').value) ? String(document.getElementById('inputAiModel').value).trim() : '';

                if (url && key) {
                    localStorage.setItem('SUPABASE_URL', url);
                    localStorage.setItem('SUPABASE_ANON_KEY', key);
                }

                // Always save AI settings if changed
                if (aiProvider) localStorage.setItem('AI_PROVIDER', aiProvider);
                if (aiKey) localStorage.setItem('AI_API_KEY', aiKey);
                if (aiModel) localStorage.setItem('AI_MODEL', aiModel);

                location.reload();
            });
        }

        // Action
        const actionBtn = overlay.querySelector('#btnAuthAction');
        if (actionBtn) {
            actionBtn.addEventListener('click', async () => {
                const email = (document.getElementById('inputEmail')?.value || '').trim();
                const password = (document.getElementById('inputPassword')?.value || '').trim();
                const errorDiv = document.getElementById('authError');
                const successDiv = document.getElementById('authSuccess');

                actionBtn.disabled = true;
                actionBtn.textContent = 'Loading...';
                if (errorDiv) errorDiv.classList.add('hidden');
                if (successDiv) successDiv.classList.add('hidden');

                try {
                    const supabaseMod = await import('../../supabaseClient.js');
                    const signIn = supabaseMod.signIn;
                    const signUp = supabaseMod.signUp;
                    const result = this.mode === 'login'
                        ? await signIn(email, password)
                        : await signUp(email, password);
                    if (!result.ok) throw new Error(result.error);
                    if (successDiv) { successDiv.textContent = this.mode === 'login' ? 'Success!' : 'Account created. Please check your email.'; successDiv.classList.remove('hidden'); }
                    if (this.onSuccess) this.onSuccess({ success: true, user: (result.data && result.data.user) || null });
                    setTimeout(function () { this.close(); if (this.mode === 'login' && !this.onSuccess) location.reload(); }.bind(this), 1500);
                } catch (err) {
                    if (errorDiv) { errorDiv.textContent = err.message; errorDiv.classList.remove('hidden'); }
                } finally {
                    actionBtn.disabled = false;
                    actionBtn.textContent = this.mode === 'login' ? 'Login' : 'Register';
                }
            };
        }
    }

    populateSettings() {
        // Try to pre-fill from localStorage
        const url = localStorage.getItem('SUPABASE_URL') || '';
        const key = localStorage.getItem('SUPABASE_ANON_KEY') || '';

        const aiProvider = localStorage.getItem('AI_PROVIDER') || 'openai';
        const aiKey = localStorage.getItem('AI_API_KEY') || '';
        const aiModel = localStorage.getItem('AI_MODEL') || '';

        if (document.getElementById('inputSbUrl')) document.getElementById('inputSbUrl').value = url;
        if (document.getElementById('inputSbKey')) document.getElementById('inputSbKey').value = key;

        if (document.getElementById('inputAiProvider')) document.getElementById('inputAiProvider').value = aiProvider;
        if (document.getElementById('inputAiKey')) document.getElementById('inputAiKey').value = aiKey;
        if (document.getElementById('inputAiModel')) document.getElementById('inputAiModel').value = aiModel;
    }

    open() {
        if (!this.isOpen) {
            this.render();
            this.isOpen = true;
        }
        const overlay = document.getElementById('authModalOverlay');
        if (overlay) overlay.classList.remove('hidden');
    }

    close() {
        const overlay = document.getElementById('authModalOverlay');
        if (overlay) overlay.classList.add('hidden');
        this.isOpen = false;
        this.settingsMode = false;
    }
}
