export class ComplianceRadarView {
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
            <div class="compliance-radar-view max-w-5xl mx-auto py-8 px-4 animate-entry">
                <!-- Header -->
                <div class="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-gradient-to-l from-slate-600/20 to-transparent p-6 rounded-2xl border border-slate-500/30">
                    <div>
                        <h2 class="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                            <svg class="ic w-6 h-6 text-slate-300" aria-hidden="true"><use href="#i-shield"/></svg>
                            رادار التشريعات والامتثال (Compliance Radar)
                        </h2>
                        <p class="text-white/60 text-sm">تجنب الغرامات والمخالفات. راقب التحديثات النظامية لقطاعك واحسب تكلفة الامتثال آلياً.</p>
                    </div>
                    <div class="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-full border border-emerald-500/30 text-xs font-bold">
                        <svg class="ic w-4 h-4" aria-hidden="true"><use href="#i-check-circle"/></svg>
                        وضع الامتثال: آمن (95%)
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <!-- Live Feed -->
                    <div class="lg:col-span-2 space-y-4">
                        <h3 class="text-white font-bold text-sm mb-4">التحديثات التشريعية الأخيرة (قطاع التجزئة والمطاعم)</h3>
                        
                        <!-- High Priority Alert -->
                        <div class="p-5 rounded-2xl border border-red-500/30 bg-black/40 relative overflow-hidden group">
                            <div class="absolute left-0 top-0 w-1.5 h-full bg-red-500"></div>
                            <div class="flex justify-between items-start mb-3">
                                <div class="flex items-center gap-2">
                                    <span class="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded font-bold">عالي الأهمية</span>
                                    <span class="text-xs text-white/50">وزارة الشؤون البلدية والقروية</span>
                                </div>
                                <span class="text-xs text-white/40">قبل ساعتين</span>
                            </div>
                            <h4 class="text-white font-bold text-lg mb-2 group-hover:text-red-400 transition-colors">إلزام تركيب كاميرات مراقبة مرتبطة أمنياً</h4>
                            <p class="text-sm text-white/70 mb-4 leading-relaxed">بناءً على التحديث الجديد، يجب على جميع منافذ البيع التي تزيد مساحتها عن 100 متر مربع تركيب نظام كاميرات معتمد ومربوط بالنظام الموحد خلال 30 يوماً.</p>
                            
                            <!-- Financial Impact Calc -->
                            <div class="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex justify-between items-center">
                                <div>
                                    <div class="text-[10px] text-red-300 mb-1">التكلفة التقديرية للامتثال</div>
                                    <div class="text-lg font-bold text-white">8,500 ريال</div>
                                </div>
                                <button class="btn btn--secondary !py-1.5 text-xs border-red-500/50 text-red-300 hover:bg-red-500 hover:text-white transition-colors">
                                    خصم من ميزانية الطوارئ
                                </button>
                            </div>
                        </div>

                        <!-- Medium Priority Alert -->
                        <div class="p-5 rounded-2xl border border-yellow-500/30 bg-black/40 relative overflow-hidden group">
                            <div class="absolute left-0 top-0 w-1.5 h-full bg-yellow-500"></div>
                            <div class="flex justify-between items-start mb-3">
                                <div class="flex items-center gap-2">
                                    <span class="bg-yellow-500 text-black text-[10px] px-2 py-0.5 rounded font-bold">متوسط الأهمية</span>
                                    <span class="text-xs text-white/50">وزارة الموارد البشرية</span>
                                </div>
                                <span class="text-xs text-white/40">أمس</span>
                            </div>
                            <h4 class="text-white font-bold text-lg mb-2 group-hover:text-yellow-400 transition-colors">تعديل نسب التوطين في منافذ البيع</h4>
                            <p class="text-sm text-white/70 mb-4 leading-relaxed">رفع نسبة التوطين في القطاع إلى 35% بحلول الربع القادم. (أنت حالياً عند 33%).</p>
                            
                            <div class="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex justify-between items-center">
                                <div>
                                    <div class="text-[10px] text-yellow-300 mb-1">الإجراء المطلوب</div>
                                    <div class="text-sm font-bold text-white">توظيف 1 مواطن إضافي</div>
                                </div>
                                <button class="btn btn--secondary !py-1.5 text-xs border-yellow-500/50 text-yellow-300 hover:bg-yellow-500 hover:text-black transition-colors" onclick="window.dispatchEvent(new CustomEvent('feasibility:showHRSandbox'))">
                                    الذهاب لمحاكي الـ HR
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Readiness Dashboard -->
                    <div class="lg:col-span-1 space-y-6">
                        <div class="p-6 rounded-2xl border border-white/5" style="background: rgba(255,255,255,0.02);">
                            <h3 class="text-white font-bold text-sm mb-6">مؤشرات الحماية</h3>
                            
                            <div class="space-y-4">
                                <!-- Status -->
                                <div>
                                    <div class="flex justify-between text-xs mb-2">
                                        <span class="text-white/70">التراخيص سارية المفعول</span>
                                        <span class="text-emerald-400">100%</span>
                                    </div>
                                    <div class="w-full h-1.5 bg-black/50 rounded-full">
                                        <div class="h-full bg-emerald-500 rounded-full" style="width: 100%;"></div>
                                    </div>
                                </div>
                                
                                <div>
                                    <div class="flex justify-between text-xs mb-2">
                                        <span class="text-white/70">الامتثال الضريبي (ZATCA)</span>
                                        <span class="text-emerald-400">100%</span>
                                    </div>
                                    <div class="w-full h-1.5 bg-black/50 rounded-full">
                                        <div class="h-full bg-emerald-500 rounded-full" style="width: 100%;"></div>
                                    </div>
                                </div>
                                
                                <div>
                                    <div class="flex justify-between text-xs mb-2">
                                        <span class="text-white/70">تطبيق اشتراطات الدفاع المدني</span>
                                        <span class="text-yellow-400">75%</span>
                                    </div>
                                    <div class="w-full h-1.5 bg-black/50 rounded-full">
                                        <div class="h-full bg-yellow-500 rounded-full" style="width: 75%;"></div>
                                    </div>
                                    <div class="text-[10px] text-yellow-400 mt-1">ناقص: تجديد عقد صيانة الطفايات</div>
                                </div>
                            </div>
                        </div>

                        <!-- Retained Earnings Impact -->
                        <div class="p-6 rounded-2xl border border-white/5" style="background: linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0) 100%);">
                            <h3 class="text-white/80 font-bold text-xs mb-2">ميزانية الامتثال المتاحة</h3>
                            <div class="text-2xl font-bold text-white mb-2">25,000 <span class="text-xs text-white/50">ريال</span></div>
                            <p class="text-[10px] text-white/60">تم تجنيبها آلياً من الأرباح المحتجزة لمواجهة أي قوانين أو رسوم حكومية طارئة.</p>
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
