export class MultiBranchScalingView {
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
            <div class="scaling-view max-w-6xl mx-auto py-8 px-4 animate-entry">
                <!-- Header -->
                <div class="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-gradient-to-l from-indigo-500/10 to-transparent p-6 rounded-2xl border border-indigo-500/20">
                    <div>
                        <h2 class="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                            <svg class="ic w-6 h-6 text-indigo-400" aria-hidden="true"><use href="#i-map"/></svg>
                            محاكي التوسع والفروع (Multi-Branch Scaling)
                        </h2>
                        <p class="text-white/60 text-sm">خطط لإمبراطوريتك! انسخ نموذج عملك الحالي لمدن جديدة واستعرض خطة النمو التراكمية.</p>
                    </div>
                    <button class="btn btn--primary !bg-indigo-500 hover:!bg-indigo-600 font-bold whitespace-nowrap text-white">
                        + افتتاح فرع جديد
                    </button>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <!-- Interactive Map & Branches -->
                    <div class="lg:col-span-2 space-y-6">
                        <!-- Simulated Map Area -->
                        <div class="p-6 rounded-2xl relative overflow-hidden" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); min-height: 300px;">
                            <h3 class="text-white font-bold text-sm mb-4">خريطة الفروع</h3>
                            
                            <!-- Map background pattern -->
                            <div class="absolute inset-0 opacity-10 pointer-events-none" style="background-image: radial-gradient(circle at 2px 2px, white 1px, transparent 0); background-size: 32px 32px;"></div>
                            
                            <!-- Branch 1: Riyadh -->
                            <div class="absolute top-[40%] right-[30%] group">
                                <div class="w-4 h-4 bg-indigo-500 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.8)] border-2 border-white animate-pulse"></div>
                                <div class="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/80 px-2 py-1 rounded text-xs text-white border border-white/10 whitespace-nowrap">
                                    الرياض (الفرع الرئيسي)
                                </div>
                            </div>

                            <!-- Branch 2: Jeddah -->
                            <div class="absolute top-[50%] right-[60%] group">
                                <div class="w-3 h-3 bg-indigo-400/50 rounded-full border border-indigo-400"></div>
                                <div class="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/80 px-2 py-1 rounded text-xs text-white/50 border border-white/10 whitespace-nowrap">
                                    جدة (مخطط Q3)
                                </div>
                            </div>
                        </div>

                        <!-- Branches List -->
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <!-- Branch Card -->
                            <div class="p-4 rounded-xl border border-indigo-500/30 bg-indigo-500/5 hover:border-indigo-500/50 transition-colors">
                                <div class="flex justify-between items-start mb-3">
                                    <div>
                                        <h4 class="text-white font-bold">فرع الرياض</h4>
                                        <div class="text-[10px] text-emerald-400">يعمل - حقق التعادل</div>
                                    </div>
                                    <span class="text-xs font-bold text-indigo-400">100% ملكية</span>
                                </div>
                                <div class="flex justify-between text-xs text-white/60 mb-1">
                                    <span>الإيراد المتوقع (سنوي):</span>
                                    <span class="text-white">1,200,000 ريال</span>
                                </div>
                            </div>
                            
                            <!-- Branch Card (Planned) -->
                            <div class="p-4 rounded-xl border border-dashed border-white/20 bg-white/5 opacity-70">
                                <div class="flex justify-between items-start mb-3">
                                    <div>
                                        <h4 class="text-white font-bold">فرع جدة</h4>
                                        <div class="text-[10px] text-yellow-400">مخطط - جاري جمع التمويل</div>
                                    </div>
                                </div>
                                <div class="flex justify-between text-xs text-white/60 mb-1">
                                    <span>رأس المال المطلوب:</span>
                                    <span class="text-white">450,000 ريال</span>
                                </div>
                                <button class="mt-3 w-full py-1.5 bg-white/10 rounded text-xs text-white hover:bg-white/20 transition-colors">
                                    توليد دراسة الجدوى للفرع
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Consolidated Financials -->
                    <div class="lg:col-span-1 p-6 rounded-2xl relative" style="background: linear-gradient(145deg, rgba(79,70,229,0.1), rgba(0,0,0,0)); border: 1px solid rgba(79,70,229,0.2);">
                        <h3 class="text-white font-bold text-sm mb-6">البيانات المالية الموحدة (Consolidated)</h3>
                        
                        <div class="space-y-6">
                            <div>
                                <div class="text-[10px] text-white/50 mb-1">إجمالي رأس المال (للفرعين)</div>
                                <div class="text-2xl font-bold text-white">1,450,000 ريال</div>
                            </div>
                            
                            <div>
                                <div class="text-[10px] text-white/50 mb-1">الإيرادات التراكمية (السنة 3)</div>
                                <div class="text-2xl font-bold text-indigo-400">4,800,000 ريال</div>
                            </div>
                            
                            <div class="pt-4 border-t border-white/10">
                                <h4 class="text-xs text-white/70 mb-3">وفورات الحجم (Economies of Scale)</h4>
                                <div class="space-y-2 text-xs">
                                    <div class="flex justify-between items-center text-white/50">
                                        <span>توفير في التسويق الموحد:</span>
                                        <span class="text-green-400">+15%</span>
                                    </div>
                                    <div class="flex justify-between items-center text-white/50">
                                        <span>تكاليف الموردين المركزية:</span>
                                        <span class="text-green-400">-8%</span>
                                    </div>
                                </div>
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
