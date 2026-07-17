export class GlobalAnalyticsView {
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
            <div class="global-analytics-view max-w-6xl mx-auto py-8 px-4 animate-entry">
                <!-- Header -->
                <div class="flex justify-between items-center mb-8 bg-gradient-to-l from-indigo-500/10 to-transparent p-6 rounded-2xl border border-indigo-500/20">
                    <div>
                        <h2 class="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                            <svg class="ic w-6 h-6 text-indigo-400" aria-hidden="true"><use href="#i-pie-chart"/></svg>
                            لوحة الإحصائيات الشاملة (Global Analytics)
                        </h2>
                        <p class="text-white/60 text-sm">نظرة عامة على أداء جميع دراسات الجدوى والمشاريع الخاصة بك في شاشة واحدة.</p>
                    </div>
                    <div class="hidden md:flex gap-2">
                        <select class="form-control text-xs !py-2 !w-auto bg-black/20 text-white border-white/10">
                            <option>جميع القطاعات</option>
                            <option>المطاعم والمقاهي</option>
                            <option>التجزئة</option>
                        </select>
                        <button class="btn btn--secondary text-xs !py-2"><svg class="ic w-3 h-3" aria-hidden="true"><use href="#i-download"/></svg> تصدير التقرير</button>
                    </div>
                </div>

                <!-- Key Metrics -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <div class="stat-card p-5 rounded-2xl" style="background: linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01)); border: 1px solid rgba(255,255,255,0.05);">
                        <div class="text-white/50 text-xs mb-2">إجمالي المشاريع</div>
                        <div class="text-3xl font-bold text-white mb-1">12</div>
                        <div class="text-[10px] text-green-400 flex items-center gap-1"><svg class="ic w-3 h-3" aria-hidden="true"><use href="#i-trending-up"/></svg> +2 هذا الشهر</div>
                    </div>
                    <div class="stat-card p-5 rounded-2xl" style="background: linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01)); border: 1px solid rgba(255,255,255,0.05);">
                        <div class="text-white/50 text-xs mb-2">إجمالي رأس المال المطلوب</div>
                        <div class="text-2xl font-bold text-indigo-400 mb-1">14.5M <span class="text-sm">ريال</span></div>
                        <div class="text-[10px] text-white/40">مجموع استثماراتك المخططة</div>
                    </div>
                    <div class="stat-card p-5 rounded-2xl" style="background: linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01)); border: 1px solid rgba(255,255,255,0.05);">
                        <div class="text-white/50 text-xs mb-2">متوسط العائد على الاستثمار (ROI)</div>
                        <div class="text-3xl font-bold text-green-400 mb-1">24%</div>
                        <div class="text-[10px] text-white/40">أعلى من مؤشر السوق بـ 4%</div>
                    </div>
                    <div class="stat-card p-5 rounded-2xl" style="background: linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01)); border: 1px solid rgba(255,255,255,0.05);">
                        <div class="text-white/50 text-xs mb-2">متوسط فترة الاسترداد</div>
                        <div class="text-3xl font-bold text-orange-400 mb-1">2.8 <span class="text-sm">سنوات</span></div>
                        <div class="text-[10px] text-white/40">مؤشر أمان عالي</div>
                    </div>
                </div>

                <!-- Charts Section -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div class="p-6 rounded-2xl" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);">
                        <h3 class="text-white font-bold mb-4 text-sm">توزيع المشاريع حسب القطاع</h3>
                        <!-- Mock Chart using CSS -->
                        <div class="flex items-end justify-between h-48 pb-4 border-b border-white/10 px-4">
                            <div class="w-12 bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-sm h-[80%] relative group">
                                <div class="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity">80%</div>
                            </div>
                            <div class="w-12 bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-sm h-[50%] relative group">
                                <div class="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity">50%</div>
                            </div>
                            <div class="w-12 bg-gradient-to-t from-orange-600 to-orange-400 rounded-t-sm h-[30%] relative group">
                                <div class="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity">30%</div>
                            </div>
                            <div class="w-12 bg-gradient-to-t from-pink-600 to-pink-400 rounded-t-sm h-[60%] relative group">
                                <div class="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity">60%</div>
                            </div>
                        </div>
                        <div class="flex justify-between px-4 mt-2 text-[10px] text-white/50">
                            <span>مطاعم</span>
                            <span>تقنية</span>
                            <span>عقارات</span>
                            <span>تجزئة</span>
                        </div>
                    </div>
                    
                    <div class="p-6 rounded-2xl" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);">
                        <h3 class="text-white font-bold mb-4 text-sm">التدفقات النقدية التراكمية (لكل المشاريع)</h3>
                        <!-- Mock Line Chart -->
                        <div class="h-48 relative flex items-center justify-center">
                            <svg class="w-full h-full" viewBox="0 0 100 50" preserveAspectRatio="none">
                                <path d="M0,45 Q20,40 40,30 T80,10 T100,5" fill="none" stroke="url(#lineGrad)" stroke-width="2" vector-effect="non-scaling-stroke"/>
                                <path d="M0,45 Q20,40 40,30 T80,10 T100,5 L100,50 L0,50 Z" fill="url(#fillGrad)" opacity="0.3"/>
                                <defs>
                                    <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                                        <stop offset="0%" stop-color="#10b981"/>
                                        <stop offset="100%" stop-color="#3b82f6"/>
                                    </linearGradient>
                                    <linearGradient id="fillGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stop-color="#10b981"/>
                                        <stop offset="100%" stop-color="transparent"/>
                                    </linearGradient>
                                </defs>
                            </svg>
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
