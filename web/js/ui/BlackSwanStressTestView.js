export class BlackSwanStressTestView {
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
            <div class="black-swan-view max-w-6xl mx-auto py-8 px-4 animate-entry">
                <!-- Header -->
                <div class="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-gradient-to-l from-red-900/30 to-black p-6 rounded-2xl border border-red-500/50 relative overflow-hidden">
                    <!-- Warning Background Elements -->
                    <div class="absolute -right-20 -top-20 w-64 h-64 bg-red-600/10 rounded-full blur-3xl animate-pulse"></div>
                    <div class="absolute right-0 top-0 w-full h-full bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGcgc3Ryb2tlPSIjZmYwMDAwIiBzdHJva2Utd2lkdGg9IjEiIHN0cm9rZS1vcGFjaXR5PSIwLjEiIGZpbGw9Im5vbmUiPjxwYXRoIGQ9Ik0wIDQwbDQwLTQwTTAgMGw0MCA0MCIvPjwvZz48L3N2Zz4=')] opacity-20 pointer-events-none"></div>
                    
                    <div class="relative z-10">
                        <h2 class="text-3xl font-bold text-red-500 mb-2 flex items-center gap-3">
                            <svg class="ic w-8 h-8" aria-hidden="true"><use href="#i-alert-triangle"/></svg>
                            محاكي البجعة السوداء (Black Swan Stress Test)
                        </h2>
                        <p class="text-red-200/60 text-sm">أخضع مشروعك لأقسى الكوارث الاقتصادية الممكنة، واكتشف هل ستصمد أم ستعلن إفلاسك؟</p>
                    </div>
                </div>

                <!-- Scenario Selection -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <!-- Scenario 1 -->
                    <div class="p-4 rounded-xl border border-red-500/30 bg-black/60 cursor-pointer hover:bg-red-900/20 transition-colors group relative overflow-hidden">
                        <div class="absolute left-0 top-0 w-1 h-full bg-red-500"></div>
                        <h3 class="text-red-400 font-bold mb-1 flex items-center gap-2">
                            <svg class="ic w-4 h-4" aria-hidden="true"><use href="#i-activity"/></svg>
                            انهيار سلسلة التوريد
                        </h3>
                        <p class="text-[10px] text-white/50">تضاعف تكاليف الشحن وتأخر البضائع لمدة 6 أشهر.</p>
                    </div>
                    <!-- Scenario 2 (Active) -->
                    <div class="p-4 rounded-xl border border-red-500 bg-red-900/30 cursor-pointer shadow-[0_0_20px_rgba(220,38,38,0.2)] relative overflow-hidden">
                        <div class="absolute left-0 top-0 w-1.5 h-full bg-red-500 shadow-[0_0_10px_rgba(220,38,38,1)]"></div>
                        <h3 class="text-white font-bold mb-1 flex items-center gap-2">
                            <svg class="ic w-4 h-4 text-red-400" aria-hidden="true"><use href="#i-trending-down"/></svg>
                            جائحة / إغلاق عام (Lockdown)
                        </h3>
                        <p class="text-[10px] text-red-200">انخفاض الإيرادات بنسبة 80%، مع استمرار تكاليف الإيجار والرواتب.</p>
                    </div>
                    <!-- Scenario 3 -->
                    <div class="p-4 rounded-xl border border-red-500/30 bg-black/60 cursor-pointer hover:bg-red-900/20 transition-colors group relative overflow-hidden">
                        <div class="absolute left-0 top-0 w-1 h-full bg-red-500"></div>
                        <h3 class="text-red-400 font-bold mb-1 flex items-center gap-2">
                            <svg class="ic w-4 h-4" aria-hidden="true"><use href="#i-dollar-sign"/></svg>
                            انهيار اقتصادي / تضخم
                        </h3>
                        <p class="text-[10px] text-white/50">انخفاض القدرة الشرائية للعملاء بنسبة 40% وارتفاع تكاليف التشغيل.</p>
                    </div>
                </div>

                <!-- Simulation Results -->
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <!-- Runway & Burn Rate -->
                    <div class="lg:col-span-1 space-y-6">
                        <div class="p-6 rounded-2xl border border-red-500/50 bg-red-950/20 text-center relative overflow-hidden">
                            <div class="absolute inset-0 bg-red-500/5 animate-pulse"></div>
                            <h3 class="text-red-300 font-bold text-sm mb-4 relative z-10">مدة البقاء (Runway)</h3>
                            
                            <div class="text-6xl font-black text-white mb-2 font-mono drop-shadow-[0_0_10px_rgba(220,38,38,0.8)] relative z-10">
                                4.5
                            </div>
                            <div class="text-red-400 font-bold mb-6 relative z-10">أشهر حتى الإفلاس</div>
                            
                            <div class="bg-black/50 rounded-xl p-4 border border-red-500/20 relative z-10 text-right">
                                <div class="flex justify-between text-xs mb-2 border-b border-red-500/20 pb-2">
                                    <span class="text-white/60">معدل الحرق الشهري (Burn Rate)</span>
                                    <span class="text-red-400 font-mono font-bold">-145,000 ر.س</span>
                                </div>
                                <div class="flex justify-between text-xs">
                                    <span class="text-white/60">السيولة النقدية المتاحة (Cash)</span>
                                    <span class="text-white font-mono font-bold">652,000 ر.س</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Survival Plan (Drastic Measures) -->
                    <div class="lg:col-span-2 space-y-6">
                        <div class="p-6 rounded-2xl border border-red-500/30 bg-black/40">
                            <h3 class="text-white font-bold text-sm mb-4 flex items-center gap-2">
                                <svg class="ic w-5 h-5 text-red-500" aria-hidden="true"><use href="#i-shield"/></svg>
                                خطة النجاة القاسية (Survival Protocol)
                            </h3>
                            <p class="text-xs text-white/50 mb-6">لتمديد فترة البقاء إلى 12 شهراً لتجاوز الأزمة، يجب تفعيل القرارات الصعبة التالية فوراً:</p>
                            
                            <div class="space-y-3">
                                <!-- Action 1 -->
                                <div class="flex items-center justify-between p-3 rounded-lg border border-red-500/20 bg-red-500/5">
                                    <div class="flex items-center gap-3">
                                        <input type="checkbox" class="w-4 h-4 rounded border-red-500/50 bg-black accent-red-500" />
                                        <div>
                                            <div class="text-sm font-bold text-white mb-1">تسريح 30% من الموظفين غير الأساسيين</div>
                                            <div class="text-[10px] text-white/50">سيتم تخفيض تكاليف الرواتب بمقدار 45,000 ر.س شهرياً.</div>
                                        </div>
                                    </div>
                                    <div class="text-emerald-400 text-xs font-bold font-mono">+ 2 شهر نجاة</div>
                                </div>
                                
                                <!-- Action 2 -->
                                <div class="flex items-center justify-between p-3 rounded-lg border border-red-500/20 bg-red-500/5">
                                    <div class="flex items-center gap-3">
                                        <input type="checkbox" class="w-4 h-4 rounded border-red-500/50 bg-black accent-red-500" />
                                        <div>
                                            <div class="text-sm font-bold text-white mb-1">إغلاق فرع "الملقا" وتسييل أصوله</div>
                                            <div class="text-[10px] text-white/50">سيوفر سيولة نقدية فورية بقيمة 120,000 ر.س وإيقاف نزيف الإيجار.</div>
                                        </div>
                                    </div>
                                    <div class="text-emerald-400 text-xs font-bold font-mono">+ 3 أشهر نجاة</div>
                                </div>
                                
                                <!-- Action 3 -->
                                <div class="flex items-center justify-between p-3 rounded-lg border border-red-500/20 bg-red-500/5">
                                    <div class="flex items-center gap-3">
                                        <input type="checkbox" class="w-4 h-4 rounded border-red-500/50 bg-black accent-red-500" />
                                        <div>
                                            <div class="text-sm font-bold text-white mb-1">تجميد الميزانية التسويقية بالكامل</div>
                                            <div class="text-[10px] text-white/50">توفير 20,000 ر.س شهرياً من إعلانات المنصات الرقمية.</div>
                                        </div>
                                    </div>
                                    <div class="text-emerald-400 text-xs font-bold font-mono">+ 1 شهر نجاة</div>
                                </div>
                            </div>
                            
                            <div class="mt-6 flex justify-end">
                                <button class="py-2 px-6 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors shadow-[0_0_15px_rgba(220,38,38,0.5)]">
                                    تطبيق بروتوكول النجاة
                                </button>
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
