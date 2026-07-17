export class CompetitorIntelligenceView {
    constructor(containerOrId) {
        if (typeof containerOrId === 'string') {
            this.container = document.getElementById(containerOrId);
        } else {
            this.container = containerOrId;
        }
    }

    async render() {
        if (!this.container) return;

        const competitors = [
            { name: 'المنافس (أ)', strength: '85', price: 'مرتفع', quality: 'عالية', share: '35%' },
            { name: 'المنافس (ب)', strength: '60', price: 'منخفض', quality: 'متوسطة', share: '15%' },
            { name: 'مشروعك (المقترح)', strength: '75', price: 'متوسط', quality: 'عالية', share: '0%' }
        ];

        this.container.innerHTML = `
            <div class="intelligence-view max-w-5xl mx-auto py-8 px-4 animate-entry">
                <!-- Header -->
                <div class="flex justify-between items-center mb-8 bg-gradient-to-l from-cyan-500/10 to-transparent p-6 rounded-2xl border border-cyan-500/20">
                    <div>
                        <h2 class="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                            <svg class="ic w-6 h-6 text-cyan-400" aria-hidden="true"><use href="#i-crosshair"/></svg>
                            رادار الذكاء التنافسي (AI Radar)
                        </h2>
                        <p class="text-white/60 text-sm">حلل السوق واعرف موقع مشروعك مقارنة بالمنافسين الرئيسيين لتحديد استراتيجية التسعير والجودة.</p>
                    </div>
                    <button class="btn btn--primary !bg-cyan-500 hover:!bg-cyan-600 font-bold whitespace-nowrap text-xs">
                        + إضافة منافس للرادار
                    </button>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <!-- Positioning Matrix -->
                    <div class="p-6 rounded-2xl relative" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); min-height: 350px;">
                        <h3 class="text-white font-bold text-sm mb-6 text-center">خريطة التمركز (الجودة مقابل السعر)</h3>
                        
                        <div class="absolute inset-0 flex items-center justify-center p-12 pointer-events-none mt-8">
                            <!-- Matrix Background -->
                            <div class="w-full h-full relative border-l border-b border-white/20">
                                <div class="absolute -top-4 -left-6 text-[10px] text-white/50 rotate-90 origin-left">جودة عالية</div>
                                <div class="absolute -bottom-6 right-0 text-[10px] text-white/50">سعر مرتفع</div>
                                
                                <div class="absolute top-1/2 left-0 w-full border-t border-dashed border-white/10"></div>
                                <div class="absolute top-0 left-1/2 h-full border-l border-dashed border-white/10"></div>
                                
                                <!-- Competitor A -->
                                <div class="absolute top-[20%] right-[20%] transform -translate-x-1/2 -translate-y-1/2 group">
                                    <div class="w-4 h-4 bg-red-500 rounded-full shadow-[0_0_15px_rgba(239,68,68,0.8)] animate-pulse"></div>
                                    <div class="absolute top-6 left-1/2 -translate-x-1/2 bg-black/80 px-2 py-1 rounded text-[10px] text-white border border-white/10 whitespace-nowrap">المنافس (أ)</div>
                                </div>
                                
                                <!-- Competitor B -->
                                <div class="absolute bottom-[30%] left-[20%] transform -translate-x-1/2 -translate-y-1/2 group">
                                    <div class="w-4 h-4 bg-yellow-500 rounded-full shadow-[0_0_15px_rgba(234,179,8,0.8)]"></div>
                                    <div class="absolute top-6 left-1/2 -translate-x-1/2 bg-black/80 px-2 py-1 rounded text-[10px] text-white border border-white/10 whitespace-nowrap">المنافس (ب)</div>
                                </div>
                                
                                <!-- Your Project -->
                                <div class="absolute top-[30%] left-[60%] transform -translate-x-1/2 -translate-y-1/2 group z-10">
                                    <div class="w-6 h-6 bg-cyan-400 rounded-full shadow-[0_0_20px_rgba(34,211,238,1)] border-2 border-white"></div>
                                    <div class="absolute top-8 left-1/2 -translate-x-1/2 bg-cyan-500/20 px-2 py-1 rounded text-xs font-bold text-cyan-100 border border-cyan-500/50 whitespace-nowrap">مشروعك</div>
                                    
                                    <!-- Ripple effect -->
                                    <div class="absolute inset-0 rounded-full border border-cyan-400 animate-ping opacity-75"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- AI Insights -->
                    <div class="flex flex-col gap-4">
                        <div class="p-5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20">
                            <h3 class="text-cyan-400 font-bold flex items-center gap-2 mb-3">
                                <svg class="ic w-5 h-5" aria-hidden="true"><use href="#i-cpu"/></svg>
                                تحليل الذكاء الاصطناعي
                            </h3>
                            <p class="text-white/80 text-sm leading-relaxed mb-4">
                                مشروعك يقع في "المحيط الأزرق" نسبيًا. المنافس الأكبر (أ) يقدم جودة عالية بسعر باهظ جداً، بينما (ب) يعتمد على السعر المنخفض بجودة رديئة. تمركز مشروعك في (الجودة العالية بأسعار متوسطة) سيجذب 40% من شريحة العملاء المترددين.
                            </p>
                        </div>
                        
                        <!-- Table -->
                        <div class="flex-1 rounded-2xl overflow-hidden border border-white/10" style="background: rgba(255,255,255,0.02);">
                            <table class="w-full text-right text-sm text-white/80">
                                <thead class="bg-white/5 border-b border-white/10">
                                    <tr>
                                        <th class="p-3 font-medium">الجهة</th>
                                        <th class="p-3 font-medium text-center">القوة التنافسية</th>
                                        <th class="p-3 font-medium text-center">الحصة التقديرية</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${competitors.map(c => `
                                        <tr class="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                                            <td class="p-3 font-bold ${c.name.includes('مشروعك') ? 'text-cyan-400' : 'text-white'}">${c.name}</td>
                                            <td class="p-3">
                                                <div class="w-full bg-black/50 rounded-full h-1.5 flex items-center">
                                                    <div class="${c.name.includes('مشروعك') ? 'bg-cyan-400' : 'bg-white/50'} h-1.5 rounded-full" style="width: ${c.strength}%"></div>
                                                </div>
                                            </td>
                                            <td class="p-3 text-center font-mono">${c.share}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
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
