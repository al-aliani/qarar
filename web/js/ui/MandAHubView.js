export class MandAHubView {
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
            <div class="m-and-a-view max-w-5xl mx-auto py-8 px-4 animate-entry">
                <!-- Header -->
                <div class="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-gradient-to-l from-purple-500/10 to-transparent p-6 rounded-2xl border border-purple-500/20">
                    <div>
                        <h2 class="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                            <svg class="ic w-6 h-6 text-purple-400" aria-hidden="true"><use href="#i-target"/></svg>
                            مركز صفقات الاستحواذ والتخارج (M&A Hub)
                        </h2>
                        <p class="text-white/60 text-sm">قيّم مشروعك الحالي، وتواصل مع صناديق استثمارية تبحث عن الاستحواذ أو الشراكة.</p>
                    </div>
                    <button class="btn btn--primary !bg-purple-500 hover:!bg-purple-600 font-bold whitespace-nowrap">
                        <svg class="ic w-4 h-4 mr-2" aria-hidden="true"><use href="#i-briefcase"/></svg>
                        طرح المشروع للاستحواذ
                    </button>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <!-- Valuation Card -->
                    <div class="lg:col-span-1 p-6 rounded-2xl relative overflow-hidden" style="background: linear-gradient(135deg, rgba(88,28,135,0.3) 0%, rgba(15,23,42,0.9) 100%); border: 1px solid rgba(168,85,247,0.3);">
                        <div class="absolute -right-10 -top-10 w-40 h-40 bg-purple-500/20 blur-3xl rounded-full"></div>
                        
                        <h3 class="text-white font-bold text-sm mb-4">التقييم التقديري (Valuation)</h3>
                        <div class="text-4xl font-bold text-purple-400 mb-2">4.2M <span class="text-lg">ريال</span></div>
                        <div class="text-[10px] text-green-400 flex items-center gap-1 mb-6">
                            <svg class="ic w-3 h-3" aria-hidden="true"><use href="#i-trending-up"/></svg> ارتفاع بنسبة 12% عن الربع السابق
                        </div>
                        
                        <div class="space-y-3">
                            <div class="flex justify-between items-center pb-2 border-b border-white/10">
                                <span class="text-xs text-white/50">طريقة التقييم</span>
                                <span class="text-xs text-white font-bold">مكرر الأرباح (EBITDA)</span>
                            </div>
                            <div class="flex justify-between items-center pb-2 border-b border-white/10">
                                <span class="text-xs text-white/50">المضاعف للقطاع</span>
                                <span class="text-xs text-white font-bold">x3.5</span>
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="text-xs text-white/50">التدفق النقدي المخصوم</span>
                                <span class="text-xs text-white font-bold">إيجابي</span>
                            </div>
                        </div>
                        
                        <button class="w-full mt-6 py-2 border border-purple-500/50 rounded-xl text-purple-300 hover:bg-purple-500/20 transition-colors text-xs">
                            تحديث نموذج التقييم
                        </button>
                    </div>

                    <!-- M&A Process & Interested Parties -->
                    <div class="lg:col-span-2 space-y-6">
                        <!-- Pipeline -->
                        <div class="p-6 rounded-2xl border border-white/5" style="background: rgba(255,255,255,0.02);">
                            <h3 class="text-white font-bold text-sm mb-6">مسار صفقة الاستحواذ الحالية</h3>
                            <div class="flex justify-between items-center relative">
                                <!-- Connecting Line -->
                                <div class="absolute top-1/2 left-0 w-full h-0.5 bg-white/10 -z-10 -translate-y-1/2"></div>
                                
                                <!-- Step 1 -->
                                <div class="flex flex-col items-center">
                                    <div class="w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center font-bold text-sm shadow-[0_0_15px_rgba(168,85,247,0.5)]">1</div>
                                    <span class="text-[10px] text-white/70 mt-2">إعداد الملف</span>
                                </div>
                                <!-- Step 2 -->
                                <div class="flex flex-col items-center">
                                    <div class="w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center font-bold text-sm shadow-[0_0_15px_rgba(168,85,247,0.5)]">2</div>
                                    <span class="text-[10px] text-white/70 mt-2">توقيع الـ NDA</span>
                                </div>
                                <!-- Step 3 -->
                                <div class="flex flex-col items-center">
                                    <div class="w-8 h-8 rounded-full bg-white/10 text-white/40 flex items-center justify-center font-bold text-sm border border-white/20">3</div>
                                    <span class="text-[10px] text-white/40 mt-2">الفحص النافي للجهالة</span>
                                </div>
                                <!-- Step 4 -->
                                <div class="flex flex-col items-center">
                                    <div class="w-8 h-8 rounded-full bg-white/10 text-white/40 flex items-center justify-center font-bold text-sm border border-white/20">4</div>
                                    <span class="text-[10px] text-white/40 mt-2">نقل الملكية</span>
                                </div>
                            </div>
                        </div>

                        <!-- Interested Funds -->
                        <div class="p-6 rounded-2xl border border-white/5" style="background: rgba(255,255,255,0.02);">
                            <div class="flex justify-between items-center mb-4">
                                <h3 class="text-white font-bold text-sm">عروض الشراء السرية (LOI)</h3>
                                <span class="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full animate-pulse">2 عروض جديدة</span>
                            </div>
                            
                            <div class="space-y-3">
                                <div class="p-4 rounded-xl border border-purple-500/20 bg-purple-500/5 hover:bg-purple-500/10 transition-colors flex items-center justify-between cursor-pointer">
                                    <div class="flex items-center gap-4">
                                        <div class="w-10 h-10 rounded bg-white/5 flex items-center justify-center">
                                            <svg class="ic w-5 h-5 text-purple-400" aria-hidden="true"><use href="#i-shield"/></svg>
                                        </div>
                                        <div>
                                            <div class="text-white font-bold text-sm">صندوق استثماري (A)</div>
                                            <div class="text-[10px] text-white/50">عرض استحواذ كلي (100%) • دفع نقدي</div>
                                        </div>
                                    </div>
                                    <div class="text-right">
                                        <div class="text-sm font-bold text-green-400">4.0M ريال</div>
                                        <button class="text-[10px] text-purple-400 hover:text-white transition-colors">عرض التفاصيل</button>
                                    </div>
                                </div>
                                
                                <div class="p-4 rounded-xl border border-white/5 bg-black/20 hover:bg-white/5 transition-colors flex items-center justify-between cursor-pointer">
                                    <div class="flex items-center gap-4">
                                        <div class="w-10 h-10 rounded bg-white/5 flex items-center justify-center">
                                            <svg class="ic w-5 h-5 text-white/50" aria-hidden="true"><use href="#i-users"/></svg>
                                        </div>
                                        <div>
                                            <div class="text-white font-bold text-sm">مجموعة تجارية متقاطعة</div>
                                            <div class="text-[10px] text-white/50">استحواذ جزئي (40%) • شراكة استراتيجية</div>
                                        </div>
                                    </div>
                                    <div class="text-right">
                                        <div class="text-sm font-bold text-white">1.8M ريال</div>
                                        <button class="text-[10px] text-purple-400 hover:text-white transition-colors">عرض التفاصيل</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
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

        return this.container;
    }
}
