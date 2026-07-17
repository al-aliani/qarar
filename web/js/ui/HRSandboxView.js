export class HRSandboxView {
    constructor(containerOrId) {
        if (typeof containerOrId === 'string') {
            this.container = document.getElementById(containerOrId);
        } else {
            this.container = containerOrId;
        }
    }

    async render() {
        if (!this.container) return;

        const employees = [
            { id: 1, role: 'مدير فرع', nationality: 'سعودي', salary: 8000, status: 'نشط', avatar: 'M' },
            { id: 2, role: 'محاسب', nationality: 'سعودي', salary: 5500, status: 'نشط', avatar: 'A' },
            { id: 3, role: 'عامل إنتاج', nationality: 'أجنبي', salary: 2500, status: 'نشط', avatar: 'W' },
            { id: 4, role: 'عامل إنتاج', nationality: 'أجنبي', salary: 2500, status: 'شاغر', avatar: '?' }
        ];

        this.container.innerHTML = `
            <div class="hr-sandbox-view max-w-6xl mx-auto py-8 px-4 animate-entry">
                <!-- Header -->
                <div class="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-gradient-to-l from-blue-500/10 to-transparent p-6 rounded-2xl border border-blue-500/20">
                    <div>
                        <h2 class="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                            <svg class="ic w-6 h-6 text-blue-400" aria-hidden="true"><use href="#i-users"/></svg>
                            محاكي الموارد البشرية والرواتب (HR Sandbox)
                        </h2>
                        <p class="text-white/60 text-sm">إدارة الهيكل التنظيمي، محاكاة مسيرات الرواتب، وتتبع مؤشر التوطين (نطاقات).</p>
                    </div>
                    <button class="btn btn--primary !bg-blue-500 hover:!bg-blue-600 font-bold whitespace-nowrap text-xs flex items-center gap-2">
                        <svg class="ic w-4 h-4" aria-hidden="true"><use href="#i-plus"/></svg>
                        إضافة موظف
                    </button>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <!-- Nitaqat & Payroll Summary -->
                    <div class="lg:col-span-1 space-y-6">
                        <!-- Nitaqat Indicator -->
                        <div class="p-6 rounded-2xl relative overflow-hidden" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);">
                            <h3 class="text-white font-bold text-sm mb-4">مؤشر التوطين (نطاقات)</h3>
                            
                            <!-- Gauge Chart Simulation -->
                            <div class="relative w-40 h-20 mx-auto mb-2 overflow-hidden">
                                <div class="absolute top-0 left-0 w-full h-full border-[15px] border-b-0 border-white/10 rounded-t-full"></div>
                                <!-- Colors -->
                                <div class="absolute top-0 left-0 w-full h-full border-[15px] border-b-0 rounded-t-full" style="border-color: #10b981 transparent transparent #10b981; transform: rotate(45deg);"></div>
                                <!-- Needle -->
                                <div class="absolute bottom-0 left-1/2 w-1 h-16 bg-white origin-bottom -translate-x-1/2 transform rotate-[30deg] shadow-lg rounded-t-full"></div>
                                <div class="absolute bottom-[-6px] left-1/2 w-3 h-3 bg-white rounded-full -translate-x-1/2 shadow-lg"></div>
                            </div>
                            
                            <div class="text-center mb-6">
                                <div class="text-2xl font-bold text-emerald-400">النطاق الأخضر</div>
                                <div class="text-[10px] text-white/50">نسبة التوطين الحالية: 50%</div>
                            </div>
                            
                            <div class="space-y-2 text-xs">
                                <div class="flex justify-between text-white/70">
                                    <span>الموظفين السعوديين:</span>
                                    <span class="font-bold text-white">2</span>
                                </div>
                                <div class="flex justify-between text-white/70">
                                    <span>الموظفين غير السعوديين:</span>
                                    <span class="font-bold text-white">2</span>
                                </div>
                            </div>
                        </div>

                        <!-- Payroll Summary -->
                        <div class="p-6 rounded-2xl" style="background: linear-gradient(145deg, rgba(59,130,246,0.1), rgba(0,0,0,0)); border: 1px solid rgba(59,130,246,0.2);">
                            <h3 class="text-white font-bold text-sm mb-4">مسير الرواتب (الشهر القادم)</h3>
                            <div class="text-3xl font-bold text-blue-400 mb-4">18,500 <span class="text-sm">ريال</span></div>
                            
                            <div class="space-y-3 pt-4 border-t border-white/10 text-xs">
                                <div class="flex justify-between text-white/60">
                                    <span>الرواتب الأساسية</span>
                                    <span class="text-white">16,000 ريال</span>
                                </div>
                                <div class="flex justify-between text-white/60">
                                    <span>بدل سكن ومواصلات</span>
                                    <span class="text-white">1,600 ريال</span>
                                </div>
                                <div class="flex justify-between text-white/60">
                                    <span>التأمينات الاجتماعية</span>
                                    <span class="text-white">900 ريال</span>
                                </div>
                            </div>
                            <button class="w-full mt-6 btn btn--secondary text-xs">تصدير المسير للبنك</button>
                        </div>
                    </div>

                    <!-- Org Chart / Employee List -->
                    <div class="lg:col-span-2 p-6 rounded-2xl" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);">
                        <div class="flex justify-between items-center mb-6">
                            <h3 class="text-white font-bold text-sm">الهيكل التنظيمي (الفعلي vs المخطط)</h3>
                            <div class="flex gap-2">
                                <button class="p-2 bg-white/10 rounded-lg text-white hover:bg-white/20 transition-colors"><svg class="ic w-4 h-4" aria-hidden="true"><use href="#i-grid"/></svg></button>
                                <button class="p-2 bg-black/40 rounded-lg text-white/50 hover:text-white transition-colors"><svg class="ic w-4 h-4" aria-hidden="true"><use href="#i-list"/></svg></button>
                            </div>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            ${employees.map(emp => `
                                <div class="p-4 rounded-xl border ${emp.status === 'شاغر' ? 'border-dashed border-white/20 bg-transparent opacity-60' : 'border-white/10 bg-white/5'} hover:border-blue-500/50 transition-colors group cursor-pointer">
                                    <div class="flex items-center gap-4 mb-3">
                                        <div class="w-12 h-12 rounded-full ${emp.status === 'شاغر' ? 'bg-white/10 border border-dashed border-white/30' : emp.nationality === 'سعودي' ? 'bg-gradient-to-br from-emerald-400 to-emerald-600' : 'bg-gradient-to-br from-slate-600 to-slate-800'} flex items-center justify-center text-white font-bold">
                                            ${emp.avatar}
                                        </div>
                                        <div>
                                            <h4 class="text-white font-bold text-sm">${emp.role}</h4>
                                            <div class="text-[10px] ${emp.nationality === 'سعودي' ? 'text-emerald-400' : 'text-white/50'}">${emp.nationality}</div>
                                        </div>
                                    </div>
                                    <div class="flex justify-between items-center pt-3 border-t border-white/5">
                                        <div class="text-sm font-bold text-white/90">${emp.salary.toLocaleString()} <span class="text-[10px] font-normal text-white/40">ريال/شهر</span></div>
                                        <span class="text-[10px] px-2 py-1 rounded-md ${emp.status === 'شاغر' ? 'bg-white/10 text-white/50' : 'bg-blue-500/20 text-blue-400'}">${emp.status}</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="max-w-6xl mx-auto px-4 mt-6">
                <button type="button" class="btn btn-secondary btn-back-dashboard">
                    <svg class="ic" aria-hidden="true"><use href="#i-arrow-right"/></svg>
                    العودة للوحة التحكم
                </button>
            </div>
        `;

        this.container.querySelector('.btn-back-dashboard')?.addEventListener('click', () => {
            window.location.hash = '#/home';
        });

        return this.container;
    }
}
