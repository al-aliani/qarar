export class IPOReadinessView {
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
            <div class="ipo-readiness-view max-w-5xl mx-auto py-8 px-4 animate-entry relative overflow-hidden">
                <!-- Background Glow -->
                <div class="absolute top-0 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-[100px] pointer-events-none"></div>
                
                <!-- Header -->
                <div class="flex flex-col md:flex-row justify-between items-center mb-10 gap-4 bg-gradient-to-l from-amber-500/10 to-transparent p-6 rounded-2xl border border-amber-500/20 relative z-10">
                    <div>
                        <h2 class="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                            <svg class="ic w-6 h-6 text-amber-400" aria-hidden="true"><use href="#i-trending-up"/></svg>
                            منصة التجهيز للاكتتاب العام (IPO Readiness)
                        </h2>
                        <p class="text-white/60 text-sm">تتبع رحلة انتقال شركتك من مساهمة مغلقة إلى شركة مدرجة في سوق "نمو" الموازي.</p>
                    </div>
                    <button class="btn btn--primary !bg-amber-500 hover:!bg-amber-600 font-bold whitespace-nowrap text-black border-0 shadow-[0_0_20px_rgba(245,158,11,0.4)]">
                        توليد نشرة الإصدار الأولية
                    </button>
                </div>

                <!-- Main Progress -->
                <div class="flex flex-col items-center justify-center mb-12 relative z-10">
                    <div class="relative w-48 h-48 flex items-center justify-center mb-4">
                        <!-- Circular Progress Background -->
                        <svg class="w-full h-full transform -rotate-90">
                            <circle cx="96" cy="96" r="88" stroke="currentColor" stroke-width="12" fill="transparent" class="text-white/5" />
                            <circle cx="96" cy="96" r="88" stroke="currentColor" stroke-width="12" fill="transparent" class="text-amber-400 drop-shadow-[0_0_10px_rgba(245,158,11,0.8)]" stroke-dasharray="552.92" stroke-dashoffset="193.52" stroke-linecap="round" />
                        </svg>
                        <!-- Center Text -->
                        <div class="absolute flex flex-col items-center justify-center text-center">
                            <span class="text-5xl font-bold text-white drop-shadow-lg">65<span class="text-2xl text-amber-400">%</span></span>
                            <span class="text-xs text-white/50 mt-1">نسبة الجاهزية</span>
                        </div>
                    </div>
                    <h3 class="text-lg font-bold text-amber-400">المرحلة الحالية: حوكمة الشركة وتدقيق القوائم المالية</h3>
                    <p class="text-sm text-white/60 mt-2 max-w-lg text-center">أنت على بعد خطوات من تحقيق الحلم، يجب إنهاء تحويل الكيان القانوني لشركة مساهمة وتعيين مستشار مالي مرخص.</p>
                </div>

                <!-- Milestones Checklist -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                    
                    <!-- Phase 1 (Completed) -->
                    <div class="p-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 relative">
                        <div class="absolute top-4 left-4 text-emerald-400">
                            <svg class="ic w-6 h-6" aria-hidden="true"><use href="#i-check-circle"/></svg>
                        </div>
                        <h4 class="text-white font-bold mb-4">المرحلة الأولى: الهيكلة الأساسية</h4>
                        <ul class="space-y-3">
                            <li class="flex items-center gap-2 text-sm text-white/70 line-through decoration-emerald-500/50">
                                <div class="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400"><svg class="ic w-3 h-3" aria-hidden="true"><use href="#i-check"/></svg></div>
                                تحقيق أرباح لـ 3 سنوات متتالية
                            </li>
                            <li class="flex items-center gap-2 text-sm text-white/70 line-through decoration-emerald-500/50">
                                <div class="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400"><svg class="ic w-3 h-3" aria-hidden="true"><use href="#i-check"/></svg></div>
                                وصول القيمة السوقية لأكثر من 50 مليون ريال
                            </li>
                        </ul>
                    </div>

                    <!-- Phase 2 (In Progress) -->
                    <div class="p-5 rounded-2xl border border-amber-500/40 bg-amber-500/10 relative shadow-[0_0_15px_rgba(245,158,11,0.1)]">
                        <div class="absolute top-4 left-4 text-amber-400 animate-spin-slow">
                            <svg class="ic w-5 h-5" aria-hidden="true"><use href="#i-loader"/></svg>
                        </div>
                        <h4 class="text-white font-bold mb-4">المرحلة الثانية: الحوكمة (قيد العمل)</h4>
                        <ul class="space-y-3">
                            <li class="flex items-center gap-2 text-sm text-white/70 line-through decoration-emerald-500/50">
                                <div class="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400"><svg class="ic w-3 h-3" aria-hidden="true"><use href="#i-check"/></svg></div>
                                تحويل الكيان إلى (شركة مساهمة مقفلة)
                            </li>
                            <li class="flex items-center gap-2 text-sm text-white/90">
                                <div class="w-4 h-4 rounded border border-white/20"></div>
                                <span class="font-bold">تعيين مراجع حسابات خارجي معتمد (Big 4)</span>
                            </li>
                            <li class="flex items-center gap-2 text-sm text-white/90">
                                <div class="w-4 h-4 rounded border border-white/20"></div>
                                تشكيل مجلس الإدارة ولجنة المراجعة
                            </li>
                        </ul>
                        <button class="mt-4 w-full text-xs py-2 bg-amber-500 text-black font-bold rounded-lg hover:bg-amber-400 transition-colors">
                            البحث عن مراجع حسابات في سوق الخبراء
                        </button>
                    </div>

                    <!-- Phase 3 (Locked) -->
                    <div class="p-5 rounded-2xl border border-white/5 bg-white/5 relative opacity-60">
                        <div class="absolute top-4 left-4 text-white/30">
                            <svg class="ic w-5 h-5" aria-hidden="true"><use href="#i-lock"/></svg>
                        </div>
                        <h4 class="text-white/60 font-bold mb-4">المرحلة الثالثة: الإدراج</h4>
                        <ul class="space-y-3">
                            <li class="flex items-center gap-2 text-sm text-white/40">
                                <div class="w-4 h-4 rounded border border-white/10"></div>
                                تعيين مستشار مالي مرخص
                            </li>
                            <li class="flex items-center gap-2 text-sm text-white/40">
                                <div class="w-4 h-4 rounded border border-white/10"></div>
                                تقديم ملف الطرح لهيئة السوق المالية
                            </li>
                        </ul>
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
