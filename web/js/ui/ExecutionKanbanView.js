export class ExecutionKanbanView {
    constructor(containerOrId) {
        if (typeof containerOrId === 'string') {
            this.container = document.getElementById(containerOrId);
        } else {
            this.container = containerOrId;
        }
    }

    async render() {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="execution-kanban-view max-w-6xl mx-auto py-8 px-4 animate-entry">
                <!-- Header -->
                <div class="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-gradient-to-l from-emerald-500/10 to-transparent p-6 rounded-2xl border border-emerald-500/20">
                    <div>
                        <h2 class="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                            <svg class="ic w-6 h-6 text-emerald-400" aria-hidden="true"><use href="#i-check-square"/></svg>
                            مدير المهام والتنفيذ (Execution Board)
                        </h2>
                        <p class="text-white/60 text-sm">تتبع تحويل دراسة الجدوى إلى مشروع واقعي خطوة بخطوة.</p>
                    </div>
                    <div class="flex items-center gap-4">
                        <div class="text-right">
                            <div class="text-[10px] text-white/50">نسبة الإنجاز</div>
                            <div class="font-bold text-emerald-400">45%</div>
                        </div>
                        <div class="w-12 h-12 rounded-full border-4 border-emerald-500 border-t-emerald-900 flex items-center justify-center text-white text-xs font-bold shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                            🚀
                        </div>
                    </div>
                </div>

                <!-- Kanban Board Layout -->
                <div class="flex flex-col lg:flex-row gap-6 overflow-x-auto pb-4">
                    
                    <!-- Column: To Do -->
                    <div class="flex-1 min-w-[300px] bg-white/5 rounded-2xl border border-white/10 p-4 flex flex-col">
                        <div class="flex justify-between items-center mb-4">
                            <h3 class="text-white font-bold flex items-center gap-2">
                                <span class="w-2 h-2 rounded-full bg-slate-400"></span>
                                قيد الانتظار (To Do)
                            </h3>
                            <span class="bg-black/40 text-white/60 text-xs px-2 py-1 rounded-lg">3</span>
                        </div>
                        
                        <div class="space-y-3 flex-1">
                            <div class="bg-black/30 border border-white/5 p-4 rounded-xl cursor-grab hover:border-white/20 transition-colors">
                                <div class="flex justify-between items-start mb-2">
                                    <span class="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">التشغيل</span>
                                    <button class="text-white/30 hover:text-white"><svg class="ic w-4 h-4" aria-hidden="true"><use href="#i-more-horizontal"/></svg></button>
                                </div>
                                <h4 class="text-sm text-white font-bold mb-1">توظيف مدير العمليات</h4>
                                <p class="text-[10px] text-white/40 mb-3">مراجعة السير الذاتية وإجراء المقابلات.</p>
                                <div class="flex justify-between items-center">
                                    <div class="flex -space-x-2">
                                        <div class="w-6 h-6 rounded-full bg-gradient-to-r from-purple-400 to-pink-500 border border-black flex items-center justify-center text-[8px] text-white">SA</div>
                                    </div>
                                    <span class="text-[10px] text-white/30 flex items-center gap-1"><svg class="ic w-3 h-3" aria-hidden="true"><use href="#i-calendar"/></svg> بعد أسبوعين</span>
                                </div>
                            </div>
                            
                            <div class="bg-black/30 border border-white/5 p-4 rounded-xl cursor-grab hover:border-white/20 transition-colors">
                                <div class="flex justify-between items-start mb-2">
                                    <span class="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">التسويق</span>
                                </div>
                                <h4 class="text-sm text-white font-bold mb-1">إطلاق الحملة الإعلانية</h4>
                                <p class="text-[10px] text-white/40 mb-3">حملات سناب شات وإنستقرام.</p>
                            </div>
                        </div>
                        <button class="w-full mt-4 py-2 border border-dashed border-white/10 rounded-xl text-white/40 hover:text-white hover:bg-white/5 transition-colors text-xs flex items-center justify-center gap-1">
                            <svg class="ic w-4 h-4" aria-hidden="true"><use href="#i-plus"/></svg> إضافة مهمة
                        </button>
                    </div>

                    <!-- Column: In Progress -->
                    <div class="flex-1 min-w-[300px] bg-white/5 rounded-2xl border border-white/10 p-4 flex flex-col">
                        <div class="flex justify-between items-center mb-4">
                            <h3 class="text-white font-bold flex items-center gap-2">
                                <span class="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]"></span>
                                قيد التنفيذ (In Progress)
                            </h3>
                            <span class="bg-black/40 text-white/60 text-xs px-2 py-1 rounded-lg">2</span>
                        </div>
                        
                        <div class="space-y-3 flex-1">
                            <div class="bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/30 p-4 rounded-xl cursor-grab shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
                                <div class="flex justify-between items-start mb-2">
                                    <span class="text-[10px] px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">قانوني</span>
                                </div>
                                <h4 class="text-sm text-white font-bold mb-1">استخراج السجل التجاري</h4>
                                <p class="text-[10px] text-white/40 mb-3">بانتظار موافقة وزارة التجارة.</p>
                                <div class="w-full bg-black/50 rounded-full h-1.5 mb-2">
                                    <div class="bg-amber-400 h-1.5 rounded-full" style="width: 70%"></div>
                                </div>
                            </div>
                            
                            <div class="bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/30 p-4 rounded-xl cursor-grab shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
                                <div class="flex justify-between items-start mb-2">
                                    <span class="text-[10px] px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">تجهيزات</span>
                                </div>
                                <h4 class="text-sm text-white font-bold mb-1">أعمال الديكور للمقر</h4>
                                <p class="text-[10px] text-white/40 mb-3">المقاول بدأ العمل الفعلي.</p>
                            </div>
                        </div>
                    </div>

                    <!-- Column: Done -->
                    <div class="flex-1 min-w-[300px] bg-white/5 rounded-2xl border border-white/10 p-4 flex flex-col">
                        <div class="flex justify-between items-center mb-4">
                            <h3 class="text-white font-bold flex items-center gap-2">
                                <span class="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                                مكتمل (Done)
                            </h3>
                            <span class="bg-black/40 text-white/60 text-xs px-2 py-1 rounded-lg">1</span>
                        </div>
                        
                        <div class="space-y-3 flex-1 opacity-60 hover:opacity-100 transition-opacity">
                            <div class="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-xl">
                                <div class="flex justify-between items-start mb-2">
                                    <span class="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">دراسة وتخطيط</span>
                                    <svg class="ic w-4 h-4 text-emerald-400" aria-hidden="true"><use href="#i-check-circle"/></svg>
                                </div>
                                <h4 class="text-sm text-white font-bold line-through mb-1">الانتهاء من دراسة الجدوى</h4>
                                <p class="text-[10px] text-emerald-400 mb-3">تمت الموافقة على الخطة المالية.</p>
                            </div>
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
