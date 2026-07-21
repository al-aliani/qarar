export class TeamManagementView {
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
        const teamMembers = [
            { name: 'محمد الخالد', email: 'mohammad@example.com', role: 'owner', roleName: 'مالك', lastActive: 'الآن', avatar: 'M' },
            { name: 'سارة أحمد', email: 'sara@example.com', role: 'editor', roleName: 'محرر', lastActive: 'قبل ساعتين', avatar: 'S' },
            { name: 'عبدالله السالم', email: 'abdullah@example.com', role: 'viewer', roleName: 'مشاهد', lastActive: 'أمس', avatar: 'A' },
            { name: 'فريق المحاسبة', email: 'finance@example.com', role: 'reviewer', roleName: 'مراجع مالي', lastActive: 'منذ أسبوع', avatar: 'F' }
        ];

        this.container.innerHTML = `
            <div class="team-management-view max-w-4xl mx-auto py-8 px-4 animate-entry">
                <!-- Header -->
                <div class="flex justify-between items-center mb-8 gap-4 flex-wrap">
                    <div>
                        <h2 class="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                            <svg class="ic w-6 h-6 text-primary" aria-hidden="true"><use href="#i-users"/></svg>
                            إدارة الفريق والصلاحيات
                        </h2>
                        <p class="text-white/60 text-sm">معاينة توضيحية لشكل إدارة فريق العمل والصلاحيات — لا يوجد حالياً نظام دعوات فعلي عبر البريد الإلكتروني، والأعضاء والبيانات أدناه للتوضيح فقط.</p>
                    </div>
                    <div class="flex items-center gap-3 bg-black/40 px-4 py-2 rounded-xl border border-white/5">
                        <div class="w-2 h-2 rounded-full bg-amber-500"></div>
                        <span class="text-xs text-white/80 font-bold">بيانات تجريبية (Demo)</span>
                    </div>
                </div>

                <!-- Stats Cards -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <div class="team-stat-card">
                        <div class="text-white/60 text-xs mb-1">إجمالي الأعضاء</div>
                        <div class="text-3xl font-bold text-white">4</div>
                    </div>
                    <div class="team-stat-card">
                        <div class="text-white/60 text-xs mb-1">المقاعد المتبقية</div>
                        <div class="text-3xl font-bold text-green-400">1</div>
                    </div>
                    <div class="team-stat-card">
                        <div class="text-white/60 text-xs mb-1">دعوات معلقة</div>
                        <div class="text-3xl font-bold text-yellow-400">0</div>
                    </div>
                </div>

                <!-- Members List -->
                <div class="team-list-container rounded-2xl overflow-hidden">
                    <table class="w-full text-right">
                        <thead>
                            <tr class="text-white/40 text-xs border-b border-white/10">
                                <th class="py-4 px-6 font-medium">العضو</th>
                                <th class="py-4 px-6 font-medium">الصلاحية</th>
                                <th class="py-4 px-6 font-medium">آخر نشاط</th>
                                <th class="py-4 px-6 font-medium text-left">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${teamMembers.map(member => `
                                <tr class="team-member-row border-b border-white/5 transition-colors">
                                    <td class="py-4 px-6">
                                        <div class="flex items-center gap-3">
                                            <div class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white" style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));">
                                                ${member.avatar}
                                            </div>
                                            <div>
                                                <div class="text-white font-medium text-sm">${member.name}</div>
                                                <div class="text-white/50 text-xs mt-0.5">${member.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td class="py-4 px-6">
                                        <span class="role-badge role-${member.role}">${member.roleName}</span>
                                    </td>
                                    <td class="py-4 px-6 text-white/50 text-xs">
                                        ${member.lastActive}
                                    </td>
                                    <td class="py-4 px-6 text-left">
                                        ${member.role !== 'owner' ? `
                                            <button class="p-2 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors" aria-label="تعديل الصلاحية" title="تعديل الصلاحية">
                                                <svg class="ic w-4 h-4" aria-hidden="true"><use href="#i-pen"/></svg>
                                            </button>
                                            <button class="p-2 rounded hover:bg-red-500/20 text-white/60 hover:text-red-400 transition-colors" aria-label="حذف العضو" title="حذف العضو">
                                                <svg class="ic w-4 h-4" aria-hidden="true"><use href="#i-trash"/></svg>
                                            </button>
                                        ` : `
                                            <span class="text-xs text-white/30">لا يمكن تعديل المالك</span>
                                        `}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <!-- Back Button -->
            <div class="max-w-4xl mx-auto px-4 mt-6">
                <button type="button" class="btn btn-secondary btn-back-dashboard">
                    <svg class="ic" aria-hidden="true"><use href="#i-arrow-right"/></svg>
                    العودة للوحة التحكم
                </button>
            </div>
        `;

        // Bind events
        this.container.querySelector('.btn-back-dashboard')?.addEventListener('click', () => {
            window.location.hash = '#/home';
        });

        return this.container;
    }
}
