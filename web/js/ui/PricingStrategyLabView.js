export class PricingStrategyLabView {
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
            <div class="pricing-lab-view max-w-6xl mx-auto py-8 px-4 animate-entry">
                <!-- Header -->
                <div class="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-gradient-to-l from-rose-500/10 to-transparent p-6 rounded-2xl border border-rose-500/20">
                    <div>
                        <h2 class="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                            <svg class="ic w-6 h-6 text-rose-400" aria-hidden="true"><use href="#i-tag"/></svg>
                            مختبر التسعير السيكولوجي (Pricing Lab)
                        </h2>
                        <p class="text-white/60 text-sm">اختبر حساسية السعر (Price Elasticity) وتأثير الاستراتيجيات النفسية على مبيعاتك وأرباحك الصافية.</p>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <!-- Controls -->
                    <div class="lg:col-span-1 space-y-6">
                        <div class="p-6 rounded-2xl border border-white/5" style="background: rgba(255,255,255,0.02);">
                            <h3 class="text-white font-bold text-sm mb-6 flex items-center gap-2">
                                <svg class="ic w-5 h-5 text-rose-400" aria-hidden="true"><use href="#i-sliders"/></svg>
                                متغيرات التجربة
                            </h3>
                            
                            <div class="space-y-6">
                                <!-- Base Price -->
                                <div>
                                    <div class="flex justify-between text-xs text-white/80 mb-2">
                                        <label>السعر الأساسي الحالي</label>
                                        <span class="font-bold">100 ريال</span>
                                    </div>
                                </div>
                                
                                <!-- Price Change Simulator -->
                                <div>
                                    <div class="flex justify-between text-xs text-white/60 mb-2">
                                        <label>نسبة التغيير المقترحة</label>
                                        <span class="text-rose-400 font-bold">+15%</span>
                                    </div>
                                    <div class="w-full h-2 bg-black/50 rounded-full overflow-hidden flex items-center justify-center">
                                        <div class="h-full bg-rose-500" style="width: 65%;"></div>
                                    </div>
                                    <div class="text-[10px] text-white/40 text-center mt-1">السعر الجديد: 115 ريال</div>
                                </div>

                                <!-- Psychological Tactics -->
                                <div class="pt-4 border-t border-white/10">
                                    <h4 class="text-xs text-white/70 mb-3">التكتيكات النفسية المطبقة</h4>
                                    
                                    <label class="flex items-center gap-3 mb-3 cursor-pointer group">
                                        <input type="checkbox" checked class="w-4 h-4 rounded border-white/20 bg-black/40 text-rose-500 focus:ring-rose-500 focus:ring-offset-gray-900">
                                        <span class="text-sm text-white/80 group-hover:text-white transition-colors">تأثير الرقم 9 (مثال: 114.99)</span>
                                    </label>
                                    
                                    <label class="flex items-center gap-3 mb-3 cursor-pointer group">
                                        <input type="checkbox" class="w-4 h-4 rounded border-white/20 bg-black/40 text-rose-500 focus:ring-rose-500 focus:ring-offset-gray-900">
                                        <span class="text-sm text-white/80 group-hover:text-white transition-colors">تسعير الباقات (Decoy Pricing)</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Results Dashboard -->
                    <div class="lg:col-span-2 space-y-6">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <!-- Impact on Volume -->
                            <div class="p-6 rounded-2xl relative overflow-hidden border border-white/5" style="background: rgba(255,255,255,0.02);">
                                <h3 class="text-white/80 font-bold text-xs mb-2">التأثير المتوقع على حجم المبيعات</h3>
                                <div class="text-4xl font-bold text-red-400 mb-2">-8<span class="text-xl">%</span></div>
                                <p class="text-[10px] text-white/50">المنتج يعتبر "عالي المرونة"، زيادة السعر ستؤدي لفقدان بعض العملاء.</p>
                            </div>
                            
                            <!-- Impact on Profit -->
                            <div class="p-6 rounded-2xl relative overflow-hidden border border-rose-500/30" style="background: linear-gradient(135deg, rgba(244,63,94,0.15) 0%, rgba(0,0,0,0) 100%);">
                                <h3 class="text-rose-400 font-bold text-xs mb-2">التأثير المتوقع على صافي الأرباح</h3>
                                <div class="text-4xl font-bold text-white mb-2">+22<span class="text-xl">%</span></div>
                                <p class="text-[10px] text-white/70">رغم انخفاض المبيعات، إلا أن هامش الربح الإضافي سيعوض الخسارة ويزيد الأرباح الكلية بقوة.</p>
                            </div>
                        </div>

                        <!-- Demand Curve Chart Simulation -->
                        <div class="p-6 rounded-2xl border border-white/5" style="background: rgba(255,255,255,0.02); min-height: 250px;">
                            <h3 class="text-white font-bold text-sm mb-4">منحنى الطلب الافتراضي (A/B Test Simulation)</h3>
                            
                            <div class="relative w-full h-40 mt-8 border-l border-b border-white/20">
                                <div class="absolute -left-8 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] text-white/50">السعر</div>
                                <div class="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-white/50">الكمية المباعة</div>
                                
                                <!-- Curve Line -->
                                <svg class="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                                    <path d="M 0,0 Q 50,80 100,100" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="2" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"></path>
                                    <path d="M 0,20 Q 50,60 100,90" fill="none" stroke="#f43f5e" stroke-width="3" vector-effect="non-scaling-stroke"></path>
                                </svg>
                                
                                <!-- Old Point -->
                                <div class="absolute w-3 h-3 bg-white rounded-full left-[60%] top-[70%] -translate-x-1/2 -translate-y-1/2 shadow-[0_0_10px_white]"></div>
                                <div class="absolute left-[60%] top-[70%] mt-3 ml-3 text-[10px] text-white/50">الوضع الحالي</div>
                                
                                <!-- New Point -->
                                <div class="absolute w-4 h-4 bg-rose-500 rounded-full left-[40%] top-[40%] -translate-x-1/2 -translate-y-1/2 shadow-[0_0_15px_rgba(244,63,94,0.8)] border-2 border-white"></div>
                                <div class="absolute left-[40%] top-[40%] mt-3 ml-3 text-[10px] text-rose-400 font-bold bg-black/60 px-2 py-0.5 rounded">السيناريو المقترح</div>
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
