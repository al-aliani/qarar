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
                <div class="flex justify-between items-center mb-8">
                    <div>
                        <h2 class="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                            <svg class="ic w-6 h-6 text-primary" aria-hidden="true"><use href="#i-users"/></svg>
                            إدارة الفريق والصلاحيات
                        </h2>
                        <p class="text-white/60 text-sm">قم بدعوة شركائك ومستشاريك للعمل معاً على دراسات الجدوى في بيئة آمنة.</p>
                    </div>
                    <button class="btn btn--primary btn-invite-team" style="border-radius: 12px; padding: 10px 20px; font-weight: bold; display: flex; align-items: center; gap: 8px;">
                        <svg class="ic w-4 h-4" aria-hidden="true"><use href="#i-plus"/></svg>
                        دعوة عضو جديد
                    </button>
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
                                            <button class="p-2 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors" title="تعديل الصلاحية">
                                                <svg class="ic w-4 h-4" aria-hidden="true"><use href="#i-edit"/></svg>
                                            </button>
                                            <button class="p-2 rounded hover:bg-red-500/20 text-white/60 hover:text-red-400 transition-colors" title="حذف العضو">
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
        
        this.container.querySelector('.btn-invite-team')?.addEventListener('click', () => {
            import('sweetalert2').then(({ default: Swal }) => {
                Swal.fire({
                    title: 'دعوة عضو جديد',
                    html: `
                        <div class="text-right mt-4">
                            <label class="block text-sm text-white/70 mb-2">البريد الإلكتروني</label>
                            <input type="email" id="inviteEmail" class="swal2-input !bg-black/20 !border-white/10 !text-white w-full !mx-0 !mb-4" placeholder="name@company.com" style="width: 100%; box-sizing: border-box;">
                            
                            <label class="block text-sm text-white/70 mb-2">الصلاحية الممنوحة</label>
                            <select id="inviteRole" class="swal2-select !bg-black/20 !border-white/10 !text-white w-full !mx-0 !text-sm" style="width: 100%; box-sizing: border-box; display: flex;">
                                <option value="editor">محرر (تعديل وحفظ)</option>
                                <option value="reviewer">مراجع (إضافة ملاحظات وتدقيق)</option>
                                <option value="viewer">مشاهد (قراءة وتصدير فقط)</option>
                            </select>
                        </div>
                    `,
                    background: 'rgba(30, 41, 59, 0.95)',
                    color: '#fff',
                    showCancelButton: true,
                    confirmButtonText: 'إرسال الدعوة',
                    cancelButtonText: 'إلغاء',
                    customClass: {
                        popup: 'backdrop-blur-xl border border-white/10 rounded-2xl',
                        confirmButton: 'btn btn--primary !px-6',
                        cancelButton: 'btn btn--secondary !bg-white/5'
                    },
                    buttonsStyling: false
                }).then((result) => {
                    if (result.isConfirmed) {
                        import('../utils/toast.js').then(({ toast }) => {
                            toast.success('تم إرسال دعوة الانضمام بنجاح!');
                        });
                    }
                });
            });
        });

        return this.container;
    }
}
