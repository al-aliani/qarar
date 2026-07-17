export class InvestorNetworkView {
    constructor(containerOrId) {
        if (typeof containerOrId === 'string') {
            this.container = document.getElementById(containerOrId);
        } else {
            this.container = containerOrId;
        }
    }

    async render() {
        if (!this.container) return;

        const deals = [
            { id: 1, sector: 'قطاع الأغذية والمشروبات', req: '2.5M ريال', roi: '35%', risk: 'متوسط', tags: ['توسع', 'مبيعات نشطة'] },
            { id: 2, sector: 'التطبيقات التقنية (SaaS)', req: '500K ريال', roi: '60%', risk: 'عالي', tags: ['بذرة (Seed)', 'تقنية مالية'] },
            { id: 3, sector: 'القطاع اللوجستي', req: '1.2M ريال', roi: '22%', risk: 'منخفض', tags: ['معدات', 'عقود حكومية'] }
        ];

        this.container.innerHTML = `
            <div class="investor-network-view max-w-5xl mx-auto py-8 px-4 animate-entry">
                <!-- Header -->
                <div class="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-gradient-to-l from-amber-500/10 to-transparent p-6 rounded-2xl border border-amber-500/20">
                    <div>
                        <h2 class="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                            <svg class="ic w-6 h-6 text-amber-400" aria-hidden="true"><use href="#i-briefcase"/></svg>
                            شبكة مطابقة المستثمرين (Deal-Flow)
                        </h2>
                        <p class="text-white/60 text-sm">استعرض ملخصات المشاريع المجهولة (Teasers) التي تبحث عن استثمار، أو اعرض مشروعك هنا.</p>
                    </div>
                    <button class="btn btn--primary !bg-amber-500 hover:!bg-amber-600 text-black font-bold whitespace-nowrap">
                        تقديم مشروعي للمستثمرين
                    </button>
                </div>

                <!-- Filters -->
                <div class="flex gap-4 mb-6">
                    <select class="form-control text-xs bg-black/20 text-white border-white/10 w-40">
                        <option>كل القطاعات</option>
                        <option>التقنية</option>
                        <option>الأغذية</option>
                    </select>
                    <select class="form-control text-xs bg-black/20 text-white border-white/10 w-40">
                        <option>مستوى المخاطرة</option>
                        <option>منخفض</option>
                        <option>متوسط</option>
                        <option>عالي</option>
                    </select>
                </div>

                <!-- Teaser Cards -->
                <div class="space-y-4">
                    ${deals.map(deal => `
                        <div class="flex flex-col md:flex-row items-center justify-between p-6 rounded-2xl transition-all hover:bg-white/5 cursor-pointer border border-white/5" style="background: linear-gradient(90deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.01) 100%);">
                            <div class="flex-1 mb-4 md:mb-0">
                                <div class="flex items-center gap-3 mb-2">
                                    <div class="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                                        <svg class="ic w-5 h-5" aria-hidden="true"><use href="#i-lock"/></svg>
                                    </div>
                                    <div>
                                        <h3 class="text-white font-bold">مشروع في ${deal.sector}</h3>
                                        <div class="text-[10px] text-white/40">الموقع مجهول • قيد الموافقة</div>
                                    </div>
                                </div>
                                <div class="flex gap-2 mt-3 ml-12">
                                    ${deal.tags.map(t => `<span class="px-2 py-1 rounded bg-white/10 text-white/60 text-[10px]">${t}</span>`).join('')}
                                </div>
                            </div>
                            
                            <div class="flex flex-wrap items-center gap-8 pl-4 border-l border-white/10">
                                <div class="text-center">
                                    <div class="text-[10px] text-white/40 mb-1">المبلغ المطلوب</div>
                                    <div class="text-lg font-bold text-white">${deal.req}</div>
                                </div>
                                <div class="text-center">
                                    <div class="text-[10px] text-white/40 mb-1">متوسط العائد</div>
                                    <div class="text-lg font-bold text-green-400">${deal.roi}</div>
                                </div>
                                <div class="text-center">
                                    <div class="text-[10px] text-white/40 mb-1">المخاطرة</div>
                                    <div class="text-sm font-bold ${deal.risk === 'عالي' ? 'text-red-400' : deal.risk === 'متوسط' ? 'text-yellow-400' : 'text-green-400'}">${deal.risk}</div>
                                </div>
                            </div>
                            
                            <div class="mr-6">
                                <button class="btn btn--secondary hover:bg-amber-500/20 hover:text-amber-400 text-xs">طلب التواصل</button>
                            </div>
                        </div>
                    `).join('')}
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
