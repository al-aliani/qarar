export class NotificationsView {
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
        const notifications = [
            { id: 1, type: 'success', title: 'دراستك جاهزة', text: 'تم إنشاء تقرير دراسة "مشروع القهوة المختصة" بنجاح.', time: 'منذ ساعتين', icon: 'i-clipboard' },
            { id: 2, type: 'info', title: 'رد على استشارة', text: 'قام المستشار بالرد على استفسارك الأخير بخصوص التقييم المالي.', time: 'منذ 5 ساعات', icon: 'i-chat' },
            { id: 3, type: 'warning', title: 'تجديد الاشتراك', text: 'باقي 3 أيام على تجديد اشتراك باقة رواد الأعمال.', time: 'أمس', icon: 'i-info' },
        ];

        const changelog = [
            { version: 'v2.4.0', date: 'أغسطس 2026', title: 'إضافة قوالب قطاع التجزئة 🛍️', changes: ['قالب جاهز لمحلات الملابس', 'تحديث مؤشرات أداء نقاط البيع', 'تحسين محرك ضريبة القيمة المضافة'] },
            { version: 'v2.3.5', date: 'يوليو 2026', title: 'تحسينات واجهة الاستخدام (V2) ✨', changes: ['إطلاق التصميم الزجاجي الموحد', 'دعم الوضع الليلي لجميع النوافذ', 'تسريع تصدير تقارير PDF بنسبة 40%'] }
        ];

        this.container.innerHTML = `
            <div class="notifications-view max-w-4xl mx-auto py-8 px-4 animate-entry">
                <!-- Header -->
                <div class="flex justify-between items-center mb-8">
                    <div>
                        <h2 class="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                            <svg class="ic w-6 h-6 text-primary" aria-hidden="true"><use href="#i-bell"/></svg>
                            مركز التنبيهات والتحديثات
                        </h2>
                        <p class="text-white/60 text-sm">ابقَ على اطلاع دائم بآخر التطورات والإشعارات الهامة.</p>
                    </div>
                </div>

                <!-- Tabs -->
                <div class="notifications-tabs mb-6 flex gap-4 border-b border-white/10 pb-2">
                    <button class="tab-btn active text-white font-medium border-b-2 border-primary px-2 pb-2 transition-all" data-target="tab-alerts">
                        الإشعارات <span class="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full mr-1">3</span>
                    </button>
                    <button class="tab-btn text-white/50 hover:text-white font-medium px-2 pb-2 transition-all" data-target="tab-changelog">
                        جديد قرار (Changelog)
                    </button>
                </div>

                <!-- Tab Contents -->
                <div class="tab-content" id="tab-alerts">
                    <div class="space-y-3">
                        ${notifications.map(notif => `
                            <div class="notification-card p-4 rounded-xl flex gap-4 transition-all" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05);">
                                <div class="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style="background: ${notif.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : notif.type === 'warning' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(59, 130, 246, 0.2)'}; color: ${notif.type === 'success' ? '#10b981' : notif.type === 'warning' ? '#f59e0b' : '#3b82f6'};">
                                    <svg class="ic w-5 h-5" aria-hidden="true"><use href="#${notif.icon}"/></svg>
                                </div>
                                <div>
                                    <h4 class="text-white font-medium text-sm mb-1">${notif.title}</h4>
                                    <p class="text-white/70 text-xs mb-2">${notif.text}</p>
                                    <span class="text-white/40 text-[10px]">${notif.time}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="tab-content hidden" id="tab-changelog">
                    <div class="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent">
                        ${changelog.map(log => `
                            <div class="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                <!-- Icon -->
                                <div class="flex items-center justify-center w-10 h-10 rounded-full border border-white/20 bg-slate-900 text-primary shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-[0_0_15px_rgba(16,185,129,0.2)] z-10">
                                    <svg class="ic w-4 h-4" aria-hidden="true"><use href="#i-rocket"/></svg>
                                </div>
                                <!-- Card -->
                                <div class="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-5 rounded-2xl" style="background: linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01)); border: 1px solid rgba(255,255,255,0.08);">
                                    <div class="flex justify-between items-center mb-3">
                                        <span class="text-primary font-bold text-sm">${log.version}</span>
                                        <span class="text-white/40 text-xs">${log.date}</span>
                                    </div>
                                    <h4 class="text-white font-bold mb-3">${log.title}</h4>
                                    <ul class="text-white/70 text-sm space-y-2 list-disc list-inside">
                                        ${log.changes.map(c => `<li>${c}</li>`).join('')}
                                    </ul>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        // Bind events for tabs
        const tabs = this.container.querySelectorAll('.tab-btn');
        const contents = this.container.querySelectorAll('.tab-content');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Update active tab styles
                tabs.forEach(t => {
                    t.classList.remove('active', 'border-b-2', 'border-primary', 'text-white');
                    t.classList.add('text-white/50');
                });
                tab.classList.add('active', 'border-b-2', 'border-primary', 'text-white');
                tab.classList.remove('text-white/50');
                
                // Show content
                contents.forEach(c => c.classList.add('hidden'));
                this.container.querySelector('#' + tab.dataset.target).classList.remove('hidden');
            });
        });

        return this.container;
    }
}
