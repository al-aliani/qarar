export class TalentPoachingRadarView {
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
            <div class="poaching-radar-view max-w-6xl mx-auto py-8 px-4 animate-entry">
                <!-- Header -->
                <div class="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-gradient-to-l from-emerald-900/40 to-black p-6 rounded-2xl border border-emerald-500/50 relative overflow-hidden">
                    <!-- Matrix/Radar Background Elements -->
                    <div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGcgc3Ryb2tlPSIjMTA4NTZGIiBzdHJva2Utd2lkdGg9IjEiIHN0cm9rZS1vcGFjaXR5PSIwLjEiIGZpbGw9Im5vbmUiPjxjaXJjbGUgY3g9IjMwIiBjeT0iMzAiIHI9IjMwIi8+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMjAiLz48Y2lyY2xlIGN4PSIzMCIgY3k9IjMwIiByPSIxMCIvPjwvZz48L3N2Zz4=')] bg-[length:60px_60px] opacity-20 pointer-events-none"></div>
                    <div class="absolute right-0 top-0 w-1/2 h-full bg-gradient-to-l from-emerald-500/10 to-transparent"></div>
                    
                    <div class="relative z-10">
                        <h2 class="text-3xl font-bold text-emerald-400 mb-2 flex items-center gap-3">
                            <svg class="ic w-8 h-8" aria-hidden="true"><use href="#i-crosshair"/></svg>
                            رادار اصطياد المواهب (Talent Poaching)
                        </h2>
                        <p class="text-emerald-100/60 text-sm">راقب أبرز الكفاءات لدى منافسيك، واخطفهم بعروض لا يمكن رفضها لتعزيز فريقك.</p>
                    </div>
                    
                    <div class="relative z-10 flex items-center gap-3 bg-black/50 px-4 py-2 rounded-xl border border-emerald-500/30">
                        <div class="w-3 h-3 rounded-full bg-emerald-500 animate-ping"></div>
                        <span class="text-emerald-400 font-bold text-sm font-mono">الرادار نشط: جاري المسح...</span>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <!-- High Value Targets -->
                    <div class="lg:col-span-2 space-y-4">
                        <h3 class="text-white font-bold text-sm mb-4">الأهداف عالية القيمة (High-Value Targets)</h3>
                        
                        <!-- Target 1 -->
                        <div class="p-5 rounded-2xl border border-emerald-500/30 bg-black/60 relative overflow-hidden group hover:border-emerald-400 transition-colors">
                            <div class="absolute left-0 top-0 w-1.5 h-full bg-emerald-500"></div>
                            
                            <div class="flex justify-between items-start mb-4">
                                <div class="flex items-center gap-4">
                                    <div class="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center text-white font-bold text-xl border-2 border-emerald-500/50">أ</div>
                                    <div>
                                        <h4 class="text-white font-bold text-lg">أحمد س. <span class="text-xs text-white/40 font-normal ml-2">(المدير التقني CTO)</span></h4>
                                        <div class="text-xs text-white/60">يعمل حالياً في: <span class="text-red-400 font-bold">الشركة المنافسة (X)</span></div>
                                    </div>
                                </div>
                                <div class="bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded text-[10px] font-bold border border-emerald-500/30 flex items-center gap-1">
                                    <svg class="ic w-3 h-3" aria-hidden="true"><use href="#i-activity"/></svg>
                                    محتمل الاستقالة (85%)
                                </div>
                            </div>
                            
                            <div class="grid grid-cols-3 gap-4 mb-4 text-center">
                                <div class="p-2 bg-white/5 rounded-lg border border-white/5">
                                    <div class="text-[10px] text-white/40 mb-1">الراتب التقديري الحالي</div>
                                    <div class="text-sm font-mono font-bold text-white/80">35K ر.س</div>
                                </div>
                                <div class="p-2 bg-emerald-900/20 rounded-lg border border-emerald-500/20">
                                    <div class="text-[10px] text-emerald-400/70 mb-1">العرض المقترح (للاختطاف)</div>
                                    <div class="text-sm font-mono font-bold text-emerald-400">42K ر.س</div>
                                </div>
                                <div class="p-2 bg-fuchsia-900/20 rounded-lg border border-fuchsia-500/20">
                                    <div class="text-[10px] text-fuchsia-400/70 mb-1">إضافة خيارات أسهم</div>
                                    <div class="text-sm font-mono font-bold text-fuchsia-400">0.5% (ESOP)</div>
                                </div>
                            </div>
                            
                            <div class="flex justify-end gap-2">
                                <button class="btn btn--secondary !py-2 text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10">عرض الملف الشخصي</button>
                                <button class="py-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-black font-bold rounded-lg text-xs transition-colors shadow-[0_0_10px_rgba(16,185,129,0.3)] flex items-center gap-2">
                                    <svg class="ic w-4 h-4" aria-hidden="true"><use href="#i-send"/></svg>
                                    إرسال العرض السري
                                </button>
                            </div>
                        </div>

                        <!-- Target 2 -->
                        <div class="p-5 rounded-2xl border border-white/10 bg-black/40 relative overflow-hidden group hover:border-white/20 transition-colors opacity-80">
                            <div class="flex justify-between items-start mb-4">
                                <div class="flex items-center gap-4">
                                    <div class="w-12 h-12 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white font-bold text-xl border-2 border-white/10">س</div>
                                    <div>
                                        <h4 class="text-white font-bold text-lg">سارة م. <span class="text-xs text-white/40 font-normal ml-2">(مديرة التسويق CMO)</span></h4>
                                        <div class="text-xs text-white/60">تعمل حالياً في: <span class="text-blue-400 font-bold">وكالة إعلانية كبرى</span></div>
                                    </div>
                                </div>
                                <div class="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded text-[10px] font-bold border border-yellow-500/30">
                                    مستقرة (30%)
                                </div>
                            </div>
                            
                            <div class="flex justify-end">
                                <button class="btn btn--secondary !py-1.5 text-xs border-white/10 text-white/50 hover:text-white">وضع تحت المراقبة</button>
                            </div>
                        </div>
                    </div>

                    <!-- Market Intel -->
                    <div class="lg:col-span-1 space-y-6">
                        <div class="p-6 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 relative">
                            <div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjIiIGZpbGw9IiMxMDg1NkYiIGZpbGwtb3BhY2l0eT0iMC4yIi8+PC9zdmc+')] opacity-50"></div>
                            
                            <h3 class="text-emerald-400 font-bold text-sm mb-6 relative z-10 flex items-center gap-2">
                                <svg class="ic w-4 h-4" aria-hidden="true"><use href="#i-bar-chart-2"/></svg>
                                استخبارات سوق العمل
                            </h3>
                            
                            <div class="space-y-4 relative z-10">
                                <div>
                                    <div class="text-[10px] text-emerald-200/60 mb-1">متوسط رواتب مدراء التقنية (قطاعك)</div>
                                    <div class="text-xl font-mono font-bold text-white">32,000 <span class="text-xs text-emerald-400">ر.س</span></div>
                                </div>
                                <div class="h-px w-full bg-emerald-500/20"></div>
                                <div>
                                    <div class="text-[10px] text-emerald-200/60 mb-1">معدل الدوران الوظيفي لدى منافسيك</div>
                                    <div class="text-xl font-mono font-bold text-red-400">18% <span class="text-[10px] font-normal text-white/50">(مرتفع، فرصة جيدة للصيد)</span></div>
                                </div>
                            </div>
                            
                            <button class="mt-6 w-full py-2 bg-emerald-900/50 hover:bg-emerald-800 border border-emerald-500/50 text-emerald-400 text-xs font-bold rounded-lg transition-colors relative z-10">
                                تحديث بيانات الرادار
                            </button>
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
