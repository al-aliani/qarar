export class JointVenturesView {
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
            <div class="jv-view max-w-6xl mx-auto py-8 px-4 animate-entry">
                <!-- Header -->
                <div class="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-gradient-to-l from-violet-600/20 to-transparent p-6 rounded-2xl border border-violet-500/30 relative overflow-hidden">
                    <!-- Background Elements -->
                    <div class="absolute -right-10 -top-10 w-40 h-40 bg-blue-500/10 rounded-full blur-2xl"></div>
                    <div class="absolute -left-10 -bottom-10 w-40 h-40 bg-fuchsia-500/10 rounded-full blur-2xl"></div>
                    
                    <div class="relative z-10">
                        <h2 class="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                            <svg class="ic w-6 h-6 text-violet-400" aria-hidden="true"><use href="#i-users"/></svg>
                            غرفة التحالفات (Joint Ventures Room)
                        </h2>
                        <p class="text-white/60 text-sm">ابحث عن شركاء استراتيجيين، وقم بمحاكاة دمج أعمالكم لإطلاق مشروع مشترك جديد.</p>
                    </div>
                    <button class="btn btn--primary !bg-violet-600 hover:!bg-violet-700 font-bold whitespace-nowrap text-white border-0 shadow-[0_0_20px_rgba(139,92,246,0.4)] relative z-10">
                        استكشاف شركاء محتملين
                    </button>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <!-- Active Simulation -->
                    <div class="space-y-6">
                        <div class="p-6 rounded-2xl border border-white/5 bg-black/40 relative">
                            <div class="absolute top-4 left-4 bg-violet-500/20 text-violet-400 text-[10px] px-2 py-1 rounded-full flex items-center gap-1 border border-violet-500/30">
                                <span class="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse"></span>
                                محاكاة نشطة
                            </div>
                            <h3 class="text-white font-bold text-sm mb-6">نموذج المشروع المشترك (JV-2026-X)</h3>
                            
                            <!-- The Merger Visualization -->
                            <div class="flex items-center justify-between mb-8">
                                <!-- Company A (You) -->
                                <div class="flex flex-col items-center flex-1">
                                    <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl mb-2 shadow-[0_0_15px_rgba(59,130,246,0.3)] border border-white/10">أنت</div>
                                    <span class="text-xs text-white/70">تطبيق توصيل</span>
                                    <span class="text-[10px] text-blue-400">تقنية وعملاء</span>
                                </div>
                                
                                <!-- Connection -->
                                <div class="flex-1 flex justify-center px-2">
                                    <div class="w-full h-px bg-white/20 relative">
                                        <div class="absolute inset-0 bg-gradient-to-r from-blue-500 via-violet-500 to-fuchsia-500 w-full animate-pulse"></div>
                                        <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black border border-white/20 flex items-center justify-center text-white/50 text-[10px]">
                                            <svg class="ic w-3 h-3" aria-hidden="true"><use href="#i-plus"/></svg>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Company B (Partner) -->
                                <div class="flex flex-col items-center flex-1">
                                    <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-pink-600 flex items-center justify-center text-white font-bold text-xl mb-2 shadow-[0_0_15px_rgba(217,70,239,0.3)] border border-white/10 opacity-80 cursor-pointer hover:opacity-100 transition-opacity">S</div>
                                    <span class="text-xs text-white/70">سلسلة مطاعم</span>
                                    <span class="text-[10px] text-fuchsia-400">بنية تحتية (مراكز إعداد)</span>
                                </div>
                            </div>
                            
                            <!-- Joint Venture Target -->
                            <div class="p-4 rounded-xl border border-violet-500/30 bg-violet-500/10 text-center">
                                <h4 class="text-xs text-white/50 mb-1">الكيان الجديد المقترح</h4>
                                <div class="text-lg font-bold text-white mb-2">تطبيق المطابخ السحابية (Dark Kitchens)</div>
                                <div class="flex justify-center gap-4 text-xs">
                                    <span class="text-emerald-400 flex items-center gap-1"><svg class="ic w-3 h-3" aria-hidden="true"><use href="#i-trending-up"/></svg> 35% نمو متوقع</span>
                                    <span class="text-white/50 border-r border-white/20 pr-4">رأس مال: 2.5M ريال</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Equity & Negotiations -->
                    <div class="space-y-6">
                        <div class="p-6 rounded-2xl border border-white/5" style="background: rgba(255,255,255,0.02);">
                            <h3 class="text-white font-bold text-sm mb-4">اقتراح هيكلة الحصص (Equity Split)</h3>
                            
                            <!-- Split Bars -->
                            <div class="space-y-4 mb-6">
                                <div>
                                    <div class="flex justify-between text-xs mb-1">
                                        <span class="text-white">حصتك (نقد + تقنية)</span>
                                        <span class="text-blue-400 font-bold">55%</span>
                                    </div>
                                    <div class="w-full h-2 bg-black/50 rounded-full">
                                        <div class="h-full bg-blue-500 rounded-full" style="width: 55%;"></div>
                                    </div>
                                </div>
                                <div>
                                    <div class="flex justify-between text-xs mb-1">
                                        <span class="text-white">حصة الشريك (مواقع + تشغيل)</span>
                                        <span class="text-fuchsia-400 font-bold">45%</span>
                                    </div>
                                    <div class="w-full h-2 bg-black/50 rounded-full">
                                        <div class="h-full bg-fuchsia-500 rounded-full" style="width: 45%;"></div>
                                    </div>
                                </div>
                            </div>

                            <!-- Term Sheet Generator -->
                            <div class="pt-4 border-t border-white/10">
                                <h4 class="text-xs text-white/70 mb-3">مسودة الشروط (Term Sheet)</h4>
                                <button class="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-white/5 group">
                                    <div class="flex items-center gap-3">
                                        <svg class="ic w-5 h-5 text-violet-400" aria-hidden="true"><use href="#i-file-text"/></svg>
                                        <span class="text-sm text-white">توليد مسودة اتفاقية مشروع مشترك (JV Agreement)</span>
                                    </div>
                                    <svg class="ic w-4 h-4 text-white/30 group-hover:text-white transition-colors" aria-hidden="true"><use href="#i-download"/></svg>
                                </button>
                                
                                <div class="mt-4 flex gap-2">
                                    <button class="flex-1 btn btn--secondary !py-2 text-xs border-white/10 text-white/70 hover:bg-white/5">تعديل الحصص</button>
                                    <button class="flex-1 py-2 bg-violet-600 text-white text-xs font-bold rounded-lg hover:bg-violet-500 transition-colors shadow-[0_0_10px_rgba(139,92,246,0.3)]">إرسال العرض للشريك</button>
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
