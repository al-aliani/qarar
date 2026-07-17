export class CrisisManagementView {
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
            <div class="crisis-management-view max-w-5xl mx-auto py-8 px-4 animate-entry">
                <!-- Header -->
                <div class="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-gradient-to-l from-red-500/10 to-transparent p-6 rounded-2xl border border-red-500/20">
                    <div>
                        <h2 class="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                            <svg class="ic w-6 h-6 text-red-500 animate-pulse" aria-hidden="true"><use href="#i-alert-triangle"/></svg>
                            غرفة إدارة الأزمات والطوارئ (Crisis Room)
                        </h2>
                        <p class="text-white/60 text-sm">اختبر صلابة مشروعك. ماذا يحدث لو انخفضت المبيعات؟ كم شهراً يمكنك الصمود؟</p>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <!-- Stress Testing Controls -->
                    <div class="p-6 rounded-2xl border border-white/5" style="background: rgba(255,255,255,0.02);">
                        <h3 class="text-white font-bold text-sm mb-6 flex items-center gap-2">
                            <svg class="ic w-5 h-5 text-red-400" aria-hidden="true"><use href="#i-sliders"/></svg>
                            محاكاة الضغط (Stress Testing)
                        </h3>
                        
                        <div class="space-y-6">
                            <!-- Slider 1 -->
                            <div>
                                <div class="flex justify-between text-xs text-white/60 mb-2">
                                    <label>انخفاض المبيعات المفاجئ</label>
                                    <span class="text-red-400 font-bold">-50%</span>
                                </div>
                                <div class="w-full h-2 bg-black/50 rounded-full overflow-hidden">
                                    <div class="h-full bg-red-500" style="width: 50%;"></div>
                                </div>
                            </div>
                            
                            <!-- Slider 2 -->
                            <div>
                                <div class="flex justify-between text-xs text-white/60 mb-2">
                                    <label>ارتفاع تكاليف التشغيل (تضخم)</label>
                                    <span class="text-yellow-400 font-bold">+20%</span>
                                </div>
                                <div class="w-full h-2 bg-black/50 rounded-full overflow-hidden">
                                    <div class="h-full bg-yellow-500" style="width: 20%;"></div>
                                </div>
                            </div>
                            
                            <!-- Warning Box -->
                            <div class="mt-6 p-4 rounded-xl border border-red-500/30 bg-red-500/10 flex items-start gap-3">
                                <svg class="ic w-5 h-5 text-red-400 shrink-0 mt-0.5" aria-hidden="true"><use href="#i-info"/></svg>
                                <div>
                                    <h4 class="text-sm font-bold text-red-400 mb-1">النتيجة: أزمة سيولة وشيكة</h4>
                                    <p class="text-[10px] text-white/70 leading-relaxed">في ظل هذه الظروف القاسية، سيهبط صافي التدفق النقدي إلى السالب، وستحتاج إلى ضخ أموال إضافية أو تقليص النفقات الثابتة فوراً.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Burn Rate & Runway -->
                    <div class="flex flex-col gap-6">
                        <div class="p-6 rounded-2xl relative overflow-hidden text-center" style="background: linear-gradient(135deg, rgba(239,68,68,0.2) 0%, rgba(15,23,42,0.9) 100%); border: 1px solid rgba(239,68,68,0.3);">
                            <h3 class="text-white/80 font-bold text-xs mb-2">معدل الحرق النقدي (Burn Rate)</h3>
                            <div class="text-3xl font-bold text-red-400 mb-6">- 45,000 <span class="text-sm">ريال/شهر</span></div>
                            
                            <h3 class="text-white/80 font-bold text-xs mb-2">المدة المتبقية للصمود (Cash Runway)</h3>
                            <div class="text-5xl font-bold text-white mb-2">4 <span class="text-xl">أشهر</span></div>
                            <p class="text-[10px] text-red-300">بدون تحقيق أي إيرادات إضافية</p>
                        </div>
                        
                        <!-- AI Recommendations -->
                        <div class="p-6 rounded-2xl border border-white/5 flex-1" style="background: rgba(255,255,255,0.02);">
                            <h3 class="text-white font-bold text-sm mb-4">خطة النجاة (AI Recommendations)</h3>
                            <ul class="space-y-3">
                                <li class="flex items-start gap-3 text-sm text-white/80 p-3 bg-white/5 rounded-lg border border-white/5 hover:bg-white/10 transition-colors">
                                    <span class="text-red-400 mt-0.5"><svg class="ic w-4 h-4" aria-hidden="true"><use href="#i-x-circle"/></svg></span>
                                    <span>إيقاف جميع الحملات التسويقية المدفوعة مؤقتاً لتوفير 15,000 ريال شهرياً.</span>
                                </li>
                                <li class="flex items-start gap-3 text-sm text-white/80 p-3 bg-white/5 rounded-lg border border-white/5 hover:bg-white/10 transition-colors">
                                    <span class="text-yellow-400 mt-0.5"><svg class="ic w-4 h-4" aria-hidden="true"><use href="#i-pause-circle"/></svg></span>
                                    <span>التفاوض مع المالك لتأجيل دفعات الإيجار للربع القادم.</span>
                                </li>
                                <li class="flex items-start gap-3 text-sm text-white/80 p-3 bg-white/5 rounded-lg border border-white/5 hover:bg-white/10 transition-colors">
                                    <span class="text-green-400 mt-0.5"><svg class="ic w-4 h-4" aria-hidden="true"><use href="#i-check-circle"/></svg></span>
                                    <span>تفعيل خط التسهيلات البنكية (Credit Line) لدعم السيولة الاحتياطية.</span>
                                </li>
                            </ul>
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
