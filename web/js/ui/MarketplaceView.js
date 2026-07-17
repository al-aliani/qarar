export class MarketplaceView {
    constructor(containerOrId) {
        if (typeof containerOrId === 'string') {
            this.container = document.getElementById(containerOrId);
        } else {
            this.container = containerOrId;
        }
    }

    async render() {
        if (!this.container) return;

        const vendors = [
            { id: 1, name: 'شركة التقنية المتقدمة', category: 'تصميم المواقع والتطبيقات', discount: '20%', logo: 'i-monitor', rating: 4.8 },
            { id: 2, name: 'مكتب السديري للمحاماة', category: 'تأسيس وعقود', discount: '15%', logo: 'i-shield', rating: 4.9 },
            { id: 3, name: 'وكالة إبداع للتسويق', category: 'هوية بصرية وتسويق', discount: '10%', logo: 'i-pen-tool', rating: 4.5 },
            { id: 4, name: 'مؤسسة إعمار', category: 'ديكور وتشطيب', discount: '5%', logo: 'i-home', rating: 4.2 }
        ];

        this.container.innerHTML = `
            <div class="marketplace-view max-w-5xl mx-auto py-8 px-4 animate-entry">
                <!-- Header -->
                <div class="flex justify-between items-center mb-8 bg-gradient-to-l from-emerald-500/10 to-transparent p-6 rounded-2xl border border-emerald-500/20">
                    <div>
                        <h2 class="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                            <svg class="ic w-6 h-6 text-emerald-400" aria-hidden="true"><use href="#i-shopping-bag"/></svg>
                            سوق مقدمي الخدمات (Marketplace)
                        </h2>
                        <p class="text-white/60 text-sm">شركاء معتمدون لتنفيذ مشروعك على أرض الواقع بخصومات حصرية لعملاء قرار.</p>
                    </div>
                </div>

                <!-- Categories -->
                <div class="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide">
                    <button class="px-4 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs whitespace-nowrap">الكل</button>
                    <button class="px-4 py-1.5 rounded-full bg-white/5 text-white/60 hover:text-white border border-white/10 text-xs whitespace-nowrap">قانون وتأسيس</button>
                    <button class="px-4 py-1.5 rounded-full bg-white/5 text-white/60 hover:text-white border border-white/10 text-xs whitespace-nowrap">تسويق وتصميم</button>
                    <button class="px-4 py-1.5 rounded-full bg-white/5 text-white/60 hover:text-white border border-white/10 text-xs whitespace-nowrap">تقنية المعلومات</button>
                    <button class="px-4 py-1.5 rounded-full bg-white/5 text-white/60 hover:text-white border border-white/10 text-xs whitespace-nowrap">مقاولات ومعدات</button>
                </div>

                <!-- Vendor Grid -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    ${vendors.map(vendor => `
                        <div class="vendor-card p-5 rounded-2xl relative group cursor-pointer transition-all" style="background: linear-gradient(145deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01)); border: 1px solid rgba(255,255,255,0.05);">
                            <!-- Discount Badge -->
                            <div class="absolute -top-3 -right-3 w-12 h-12 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center text-white font-bold shadow-[0_0_15px_rgba(16,185,129,0.5)] transform group-hover:scale-110 transition-transform z-10 text-sm">
                                ${vendor.discount}
                            </div>
                            
                            <div class="w-16 h-16 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center mx-auto mb-4 text-emerald-400">
                                <svg class="ic w-8 h-8" aria-hidden="true"><use href="#${vendor.logo}"/></svg>
                            </div>
                            
                            <div class="text-center">
                                <h3 class="text-white font-bold text-sm mb-1">${vendor.name}</h3>
                                <p class="text-[10px] text-white/40 mb-3">${vendor.category}</p>
                                <div class="flex items-center justify-center gap-1 text-yellow-400 text-xs mb-4">
                                    <svg class="ic w-3 h-3" aria-hidden="true"><use href="#i-star"/></svg>
                                    ${vendor.rating}
                                </div>
                                <button class="btn btn--secondary w-full text-xs hover:bg-emerald-500/20 hover:text-emerald-400 hover:border-emerald-500/30">طلب عرض سعر</button>
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
