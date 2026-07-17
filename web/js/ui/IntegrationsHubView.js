export class IntegrationsHubView {
    constructor(containerOrId) {
        if (typeof containerOrId === 'string') {
            this.container = document.getElementById(containerOrId);
        } else {
            this.container = containerOrId;
        }
    }

    async render() {
        if (!this.container) return;
        
        // Mock Data
        const integrations = [
            { id: 'openai', name: 'OpenAI (ChatGPT)', category: 'الذكاء الاصطناعي', desc: 'توليد أجزاء دراسة الجدوى وتلخيص المشاريع آلياً.', icon: 'i-sparkles', active: true, color: '#10a37f' },
            { id: 'xero', name: 'Xero Accounting', category: 'المحاسبة', desc: 'مزامنة القوائم المالية وربط المصروفات مباشرة.', icon: 'i-credit-card', active: false, color: '#13b5ea' },
            { id: 'qoyod', name: 'قيود', category: 'المحاسبة', desc: 'نظام محاسبي متكامل يدعم الفوترة الإلكترونية السعودية.', icon: 'i-file-text', active: false, color: '#0f766e' },
            { id: 'google_sheets', name: 'Google Sheets', category: 'الإنتاجية', desc: 'تصدير الجداول الحساسة والسيناريوهات للتعديل الحي.', icon: 'i-grid', active: true, color: '#0f9d58' },
            { id: 'slack', name: 'Slack Alerts', category: 'التواصل', desc: 'تلقي إشعارات عند انضمام عضو أو تصدير دراسة.', icon: 'i-chat', active: false, color: '#e01e5a' },
            { id: 'stripe', name: 'Stripe Billing', category: 'المدفوعات', desc: 'استقبال الدفعات الاستشارية والتمويلية.', icon: 'i-globe', active: false, color: '#635bff' }
        ];

        this.container.innerHTML = `
            <div class="integrations-hub max-w-5xl mx-auto py-8 px-4 animate-entry">
                <!-- Header -->
                <div class="flex justify-between items-center mb-8 bg-gradient-to-l from-primary/10 to-transparent p-6 rounded-2xl border border-primary/20">
                    <div>
                        <h2 class="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                            <svg class="ic w-6 h-6 text-primary" aria-hidden="true"><use href="#i-grid"/></svg>
                            مركز التكاملات وتطبيقات الذكاء الاصطناعي
                        </h2>
                        <p class="text-white/60 text-sm">اربط "قرار" مع أدواتك المفضلة وسخّر قوة الـ AI لتسريع نمو أعمالك.</p>
                    </div>
                    <div class="hidden md:block">
                        <button class="btn btn--primary opacity-80" style="pointer-events: none;">متجر التطبيقات (قريباً)</button>
                    </div>
                </div>

                <!-- Integrations Grid -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${integrations.map(app => `
                        <div class="integration-card p-6 rounded-2xl relative overflow-hidden group transition-all" style="background: linear-gradient(145deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01)); border: 1px solid rgba(255,255,255,0.05);">
                            <!-- Status Badge -->
                            <div class="absolute top-4 left-4">
                                ${app.active 
                                    ? `<span class="bg-green-500/20 text-green-400 border border-green-500/30 text-[10px] px-2 py-1 rounded-full flex items-center gap-1"><span class="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span> متصل</span>` 
                                    : `<span class="bg-white/5 text-white/40 border border-white/10 text-[10px] px-2 py-1 rounded-full">غير متصل</span>`
                                }
                            </div>
                            
                            <div class="flex items-start gap-4 mb-4">
                                <div class="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-lg" style="background: ${app.color}20; color: ${app.color};">
                                    <svg class="ic w-6 h-6" aria-hidden="true"><use href="#${app.icon}"/></svg>
                                </div>
                                <div>
                                    <h3 class="text-white font-bold mb-1">${app.name}</h3>
                                    <span class="text-xs text-white/40">${app.category}</span>
                                </div>
                            </div>
                            
                            <p class="text-sm text-white/60 mb-6 h-10">${app.desc}</p>
                            
                            <div class="flex justify-between items-center border-t border-white/5 pt-4">
                                ${app.id === 'openai' ? `
                                    <button class="text-xs text-primary hover:text-white transition-colors flex items-center gap-1 btn-api-settings">
                                        <svg class="ic w-3 h-3" aria-hidden="true"><use href="#i-settings"/></svg> إعدادات API
                                    </button>
                                ` : `<span></span>`}
                                
                                <button class="btn ${app.active ? 'btn--ghost text-red-400 hover:bg-red-500/10' : 'btn--secondary hover:bg-white/10 text-white'} text-xs px-4 py-2 rounded-lg transition-colors btn-toggle-app" data-id="${app.id}">
                                    ${app.active ? 'إلغاء الربط' : 'تفعيل الربط'}
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="max-w-5xl mx-auto px-4 mt-6">
                <button type="button" class="btn btn-secondary btn-back-dashboard">
                    <svg class="ic" aria-hidden="true"><use href="#i-arrow-right"/></svg>
                    العودة للوحة التحكم
                </button>
            </div>
        `;

        this.container.querySelector('.btn-back-dashboard')?.addEventListener('click', () => {
            window.location.hash = '#/home';
        });

        this.container.querySelectorAll('.btn-api-settings').forEach(btn => {
            btn.addEventListener('click', () => {
                import('sweetalert2').then(({ default: Swal }) => {
                    Swal.fire({
                        title: 'إعدادات OpenAI API',
                        html: `
                            <div class="text-right mt-4">
                                <label class="block text-sm text-white/70 mb-2">أدخل مفتاح API الخاص بك</label>
                                <input type="password" id="apiKey" class="swal2-input !bg-black/20 !border-white/10 !text-white w-full !mx-0 !text-sm" placeholder="sk-..." value="${window.localStorage.getItem('qarar_integration_openai_key') || ''}" style="width: 100%; box-sizing: border-box;">
                                <p class="text-[10px] text-white/40 mt-2">يُحفظ المفتاح محلياً في متصفحك فقط، ولا يُرسل لأي خادم من هذه الشاشة التجريبية.</p>
                            </div>
                        `,
                        background: 'rgba(30, 41, 59, 0.95)',
                        color: '#fff',
                        showCancelButton: true,
                        confirmButtonText: 'حفظ وتشفير',
                        cancelButtonText: 'إلغاء',
                        customClass: {
                            popup: 'backdrop-blur-xl border border-white/10 rounded-2xl',
                            confirmButton: 'btn btn--primary !px-6',
                            cancelButton: 'btn btn--secondary !bg-white/5'
                        },
                        buttonsStyling: false
                    }).then((result) => {
                        if (result.isConfirmed) {
                            const key = document.getElementById('apiKey')?.value?.trim() || '';
                            if (key) {
                                window.localStorage.setItem('qarar_integration_openai_key', key);
                            } else {
                                window.localStorage.removeItem('qarar_integration_openai_key');
                            }
                            import('../utils/toast.js').then(({ toast }) => toast.success('تم حفظ المفتاح محلياً في متصفحك'));
                        }
                    });
                });
            });
        });

        return this.container;
    }
}
