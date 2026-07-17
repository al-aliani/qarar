export class SurgePricingEngineView {
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
            <div class="surge-pricing-view max-w-6xl mx-auto py-8 px-4 animate-entry">
                <!-- Header -->
                <div class="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-gradient-to-l from-cyan-900/40 to-black p-6 rounded-2xl border border-cyan-500/50 relative overflow-hidden">
                    <!-- Tech Background -->
                    <div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGcgc3Ryb2tlPSIjMDBGRkZGIiBzdHJva2Utd2lkdGg9IjEiIHN0cm9rZS1vcGFjaXR5PSIwLjEiIGZpbGw9Im5vbmUiPjxwYXRoIGQ9Ik0wIDIwaDIwTTAgMTBoMjBNMCAwaDIwTTEwIDB2MjBMMCAwdjIwIi8+PC9nPjwvc3ZnPg==')] opacity-30 pointer-events-none"></div>
                    <div class="absolute right-0 top-0 w-64 h-full bg-gradient-to-l from-cyan-500/20 to-transparent"></div>
                    
                    <div class="relative z-10">
                        <h2 class="text-3xl font-bold text-cyan-400 mb-2 flex items-center gap-3">
                            <svg class="ic w-8 h-8" aria-hidden="true"><use href="#i-zap"/></svg>
                            محرك التسعير الديناميكي (Surge Pricing Engine)
                        </h2>
                        <p class="text-cyan-100/60 text-sm">اربط أسعارك بمتغيرات السوق اللحظية. ارفع السعر عندما يرتفع الطلب (كالطقس والمواسم) وحقق أقصى ربح.</p>
                    </div>
                    
                    <div class="relative z-10 flex flex-col items-end gap-2">
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" value="" class="sr-only peer" checked>
                            <div class="w-14 h-7 bg-black border border-cyan-500/50 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-cyan-400 after:border-cyan-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-cyan-900 shadow-[0_0_15px_rgba(6,182,212,0.5)]"></div>
                            <span class="ms-3 text-sm font-bold text-cyan-400">المحرك مُفعّل</span>
                        </label>
                        <div class="text-[10px] text-cyan-400/50 font-mono">آخر تحديث للأسعار: قبل 12 ثانية</div>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <!-- Active Rules -->
                    <div class="lg:col-span-2 space-y-4">
                        <h3 class="text-white font-bold text-sm mb-4">قواعد التسعير النشطة (Active Rules)</h3>
                        
                        <!-- Rule 1: Weather -->
                        <div class="p-5 rounded-2xl border border-cyan-500/50 bg-black/60 relative overflow-hidden group shadow-[0_0_15px_rgba(6,182,212,0.15)]">
                            <div class="absolute left-0 top-0 w-1.5 h-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,1)]"></div>
                            
                            <div class="flex justify-between items-start mb-4">
                                <div class="flex items-center gap-3">
                                    <div class="w-10 h-10 rounded-xl bg-cyan-900/50 flex items-center justify-center text-cyan-400 border border-cyan-500/30">
                                        <svg class="ic w-5 h-5" aria-hidden="true"><use href="#i-cloud-rain"/></svg>
                                    </div>
                                    <div>
                                        <h4 class="text-white font-bold">قاعدة الطقس (الأمطار)</h4>
                                        <div class="text-xs text-white/50">تطبق على: خدمات التوصيل، المشروبات الساخنة</div>
                                    </div>
                                </div>
                                <div class="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded text-[10px] font-bold border border-emerald-500/30 flex items-center gap-1 animate-pulse">
                                    حالة الشرط: متحققة الآن (تمطر)
                                </div>
                            </div>
                            
                            <div class="flex items-center gap-4 bg-cyan-950/30 p-3 rounded-xl border border-cyan-500/20">
                                <div class="flex-1 text-center border-l border-white/10">
                                    <div class="text-[10px] text-white/50 mb-1">السعر الأساسي</div>
                                    <div class="text-lg font-bold text-white/80 line-through">15.00 ر.س</div>
                                </div>
                                <div class="flex-1 text-center border-l border-white/10">
                                    <div class="text-[10px] text-cyan-400 mb-1">مُعامل الزيادة (Surge Multiplier)</div>
                                    <div class="text-xl font-bold text-cyan-400">1.4x</div>
                                </div>
                                <div class="flex-1 text-center">
                                    <div class="text-[10px] text-emerald-400 mb-1">السعر اللحظي (الآن)</div>
                                    <div class="text-2xl font-bold text-emerald-400">21.00 ر.س</div>
                                </div>
                            </div>
                        </div>

                        <!-- Rule 2: Competitor Stock -->
                        <div class="p-5 rounded-2xl border border-white/10 bg-black/40 relative overflow-hidden group opacity-80">
                            <div class="absolute left-0 top-0 w-1.5 h-full bg-yellow-500/50"></div>
                            
                            <div class="flex justify-between items-start mb-4">
                                <div class="flex items-center gap-3">
                                    <div class="w-10 h-10 rounded-xl bg-yellow-900/30 flex items-center justify-center text-yellow-500/70 border border-yellow-500/20">
                                        <svg class="ic w-5 h-5" aria-hidden="true"><use href="#i-shopping-cart"/></svg>
                                    </div>
                                    <div>
                                        <h4 class="text-white/80 font-bold">نفاد مخزون المنافسين</h4>
                                        <div class="text-xs text-white/40">تطبق على: المنتجات الأكثر مبيعاً</div>
                                    </div>
                                </div>
                                <div class="bg-white/5 text-white/40 px-3 py-1 rounded text-[10px] border border-white/10">
                                    الشرط غير متحقق (المنتج متوفر لدى المنافسين)
                                </div>
                            </div>
                            
                            <div class="text-xs text-white/50 bg-white/5 p-3 rounded-lg border border-white/5 text-center">
                                سيتم رفع السعر بنسبة <span class="text-yellow-400 font-bold">25%</span> آلياً إذا نفد المنتج من متجر منافسك المباشر.
                            </div>
                        </div>
                    </div>

                    <!-- Impact & Controls -->
                    <div class="lg:col-span-1 space-y-6">
                        <!-- Financial Impact -->
                        <div class="p-6 rounded-2xl border border-cyan-500/30 bg-cyan-950/20 relative overflow-hidden text-center">
                            <div class="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl"></div>
                            <h3 class="text-cyan-400 font-bold text-sm mb-4 relative z-10 flex items-center justify-center gap-2">
                                <svg class="ic w-4 h-4" aria-hidden="true"><use href="#i-dollar-sign"/></svg>
                                الأرباح الإضافية (Surge Revenue)
                            </h3>
                            
                            <div class="text-4xl font-mono font-bold text-white mb-1 relative z-10">
                                +4,250 <span class="text-lg text-cyan-400">ر.س</span>
                            </div>
                            <div class="text-[10px] text-white/50 relative z-10 mb-6">تم تحصيلها بفضل (التسعير الديناميكي) خلال آخر 24 ساعة.</div>
                            
                            <!-- Graph Mockup -->
                            <div class="h-24 w-full flex items-end gap-1 px-4 relative z-10">
                                <div class="w-full h-[40%] bg-white/10 rounded-t-sm"></div>
                                <div class="w-full h-[55%] bg-white/10 rounded-t-sm"></div>
                                <div class="w-full h-[30%] bg-white/10 rounded-t-sm"></div>
                                <div class="w-full h-[80%] bg-cyan-500 rounded-t-sm shadow-[0_0_10px_rgba(6,182,212,0.8)] relative">
                                    <div class="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] text-cyan-300 font-bold">ذروة (مطر)</div>
                                </div>
                                <div class="w-full h-[60%] bg-white/10 rounded-t-sm"></div>
                            </div>
                        </div>

                        <!-- Manual Override -->
                        <div class="p-6 rounded-2xl border border-white/10 bg-black/40">
                            <h3 class="text-white font-bold text-sm mb-4">التدخل اليدوي السريع</h3>
                            <div class="space-y-3">
                                <button class="w-full py-2 bg-red-900/50 hover:bg-red-800 border border-red-500/50 text-red-400 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2">
                                    <svg class="ic w-4 h-4" aria-hidden="true"><use href="#i-arrow-down"/></svg>
                                    تطبيق (Flash Sale) - خصم 20% لمدة ساعة
                                </button>
                                <button class="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 text-xs rounded-lg transition-colors">
                                    إنشاء قاعدة تسعير جديدة
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
