export class ActivityLogView {
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
        const logs = [
            { id: 1, action: 'تسجيل دخول جديد', details: 'تم الدخول من متصفح Chrome على نظام Windows.', ip: '192.168.1.5', time: 'اليوم, 10:30 صباحاً', icon: 'i-shield', type: 'security' },
            { id: 2, action: 'تعديل الصلاحيات', details: 'تمت ترقية "سارة أحمد" إلى دور محرر.', ip: '192.168.1.5', time: 'اليوم, 09:15 صباحاً', icon: 'i-users', type: 'admin' },
            { id: 3, action: 'تصدير تقرير PDF', details: 'تم تصدير دراسة "مشروع القهوة المختصة".', ip: '192.168.1.5', time: 'أمس, 04:45 مساءً', icon: 'i-download', type: 'action' },
            { id: 4, action: 'تعديل دراسة', details: 'قام "محمد الخالد" بتعديل قسم التكاليف التشغيلية.', ip: '10.0.0.12', time: 'أمس, 02:20 مساءً', icon: 'i-edit', type: 'action' }
        ];

        this.container.innerHTML = `
            <div class="activity-log-view max-w-4xl mx-auto py-8 px-4 animate-entry">
                <!-- Header -->
                <div class="flex justify-between items-center mb-8">
                    <div>
                        <h2 class="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                            <svg class="ic w-6 h-6 text-primary" aria-hidden="true"><use href="#i-clock"/></svg>
                            سجل الأنشطة والتدقيق
                        </h2>
                        <p class="text-white/60 text-sm">تتبع جميع العمليات التي تمت على حسابك ومشاريعك لضمان أقصى درجات الأمان.</p>
                    </div>
                </div>

                <!-- Timeline -->
                <div class="activity-timeline bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
                    <div class="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:ml-[8.5rem] md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent">
                        ${logs.map(log => `
                            <div class="relative flex items-center justify-between md:justify-normal group is-active">
                                <!-- Time (Desktop) -->
                                <div class="hidden md:block w-32 shrink-0 text-left pr-6 text-white/50 text-xs">
                                    ${log.time}
                                </div>
                                <!-- Icon -->
                                <div class="flex items-center justify-center w-10 h-10 rounded-full border border-white/20 bg-slate-900 shrink-0 shadow-[0_0_15px_rgba(255,255,255,0.05)] z-10 mx-0 md:mx-4" style="color: ${log.type === 'security' ? '#10b981' : log.type === 'admin' ? '#f59e0b' : '#3b82f6'};">
                                    <svg class="ic w-4 h-4" aria-hidden="true"><use href="#${log.icon}"/></svg>
                                </div>
                                <!-- Content -->
                                <div class="w-[calc(100%-4rem)] md:w-auto flex-1 p-4 rounded-xl" style="background: linear-gradient(145deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01)); border: 1px solid rgba(255,255,255,0.05);">
                                    <div class="flex justify-between items-start mb-1">
                                        <h4 class="text-white font-medium text-sm">${log.action}</h4>
                                        <span class="md:hidden text-white/40 text-[10px]">${log.time}</span>
                                    </div>
                                    <p class="text-white/60 text-xs mb-2">${log.details}</p>
                                    <div class="flex items-center gap-1 text-white/30 text-[10px]">
                                        <svg class="ic w-3 h-3" aria-hidden="true"><use href="#i-globe"/></svg>
                                        IP: ${log.ip}
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
            
            <!-- Back Button -->
            <div class="max-w-4xl mx-auto px-4 mt-6">
                <button type="button" class="btn btn-secondary btn-back-profile">
                    <svg class="ic" aria-hidden="true"><use href="#i-arrow-right"/></svg>
                    العودة للملف الشخصي
                </button>
            </div>
        `;

        // Bind events
        this.container.querySelector('.btn-back-profile')?.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('feasibility:showUserProfile'));
        });

        return this.container;
    }
}
