export class ExpertsMarketplaceView {
    constructor(containerOrId) {
        if (typeof containerOrId === 'string') {
            this.container = document.getElementById(containerOrId);
        } else {
            this.container = containerOrId;
        }
    }

    async render() {
        if (!this.container) return;

        const experts = [
            { name: 'م. عبدالله السالم', title: 'مستشار مالي معتمد', rating: 4.9, reviews: 124, price: '350', tags: ['نمذجة مالية', 'SaaS', 'تمويل'], avatar: 'A' },
            { name: 'د. نورة الفارس', title: 'خبير قانوني', rating: 4.8, reviews: 89, price: '500', tags: ['عقود تأسيس', 'ملكية فكرية'], avatar: 'N' },
            { name: 'طارق زياد', title: 'استراتيجي تسويق', rating: 4.7, reviews: 210, price: '250', tags: ['GTM Strategy', 'B2B Sales'], avatar: 'T' }
        ];

        this.container.innerHTML = `
            <div class="experts-view max-w-5xl mx-auto py-8 px-4 animate-entry">
                <!-- Header -->
                <div class="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-gradient-to-l from-yellow-500/10 to-transparent p-6 rounded-2xl border border-yellow-500/20">
                    <div>
                        <h2 class="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                            <svg class="ic w-6 h-6 text-yellow-400" aria-hidden="true"><use href="#i-star"/></svg>
                            سوق الخبراء والمستشارين المستقلين
                        </h2>
                        <p class="text-white/60 text-sm">وظف أفضل العقول لمراجعة دراسة الجدوى الخاصة بك، أو احجز مكالمة فيديو استشارية بأسعار تنافسية.</p>
                    </div>
                </div>

                <!-- Filters -->
                <div class="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide">
                    <button class="px-4 py-1.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 text-xs whitespace-nowrap">الكل</button>
                    <button class="px-4 py-1.5 rounded-full bg-white/5 text-white/60 hover:text-white border border-white/10 text-xs whitespace-nowrap">مالية وتمويل</button>
                    <button class="px-4 py-1.5 rounded-full bg-white/5 text-white/60 hover:text-white border border-white/10 text-xs whitespace-nowrap">قانون وتراخيص</button>
                    <button class="px-4 py-1.5 rounded-full bg-white/5 text-white/60 hover:text-white border border-white/10 text-xs whitespace-nowrap">تسويق ومبيعات</button>
                    <button class="px-4 py-1.5 rounded-full bg-white/5 text-white/60 hover:text-white border border-white/10 text-xs whitespace-nowrap">تشغيل وموارد بشرية</button>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${experts.map(ex => `
                        <div class="p-6 rounded-2xl relative overflow-hidden group hover:-translate-y-1 transition-transform border border-white/5" style="background: linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.2) 100%);">
                            <!-- Verified Badge -->
                            <div class="absolute top-4 left-4 bg-blue-500/20 text-blue-400 text-[10px] px-2 py-1 rounded-full flex items-center gap-1 border border-blue-500/30">
                                <svg class="ic w-3 h-3" aria-hidden="true"><use href="#i-check-circle"/></svg>
                                موثق
                            </div>
                            
                            <div class="flex flex-col items-center text-center mb-4 pt-2">
                                <div class="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white text-2xl font-bold mb-3 shadow-[0_0_20px_rgba(234,179,8,0.3)]">
                                    ${ex.avatar}
                                </div>
                                <h3 class="text-white font-bold text-lg mb-1">${ex.name}</h3>
                                <p class="text-xs text-white/50">${ex.title}</p>
                            </div>
                            
                            <div class="flex justify-center gap-4 text-xs mb-4">
                                <div class="flex items-center gap-1 text-yellow-400 font-bold">
                                    <svg class="ic w-4 h-4" aria-hidden="true"><use href="#i-star"/></svg>
                                    ${ex.rating} <span class="text-white/40 font-normal">(${ex.reviews})</span>
                                </div>
                                <div class="w-px h-4 bg-white/10"></div>
                                <div class="text-white font-bold">
                                    ${ex.price} <span class="text-white/40 font-normal">ريال/ساعة</span>
                                </div>
                            </div>
                            
                            <div class="flex flex-wrap justify-center gap-2 mb-6">
                                ${ex.tags.map(t => `<span class="bg-white/5 text-white/60 text-[10px] px-2 py-1 rounded border border-white/10">${t}</span>`).join('')}
                            </div>
                            
                            <div class="grid grid-cols-2 gap-2">
                                <button class="py-2 bg-yellow-500 text-black text-xs font-bold rounded-xl hover:bg-yellow-400 transition-colors">
                                    حجز مكالمة
                                </button>
                                <button class="py-2 bg-white/5 text-white text-xs font-bold rounded-xl hover:bg-white/10 transition-colors border border-white/10">
                                    تصفح الباقات
                                </button>
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
