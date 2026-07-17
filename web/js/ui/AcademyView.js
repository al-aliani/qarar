export class AcademyView {
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
            <div class="academy-view max-w-6xl mx-auto py-8 px-4 animate-entry">
                <!-- Header (Netflix Style) -->
                <div class="flex flex-col md:flex-row justify-between items-end mb-8 gap-4 bg-gradient-to-r from-black via-gray-900 to-red-900/30 p-8 rounded-3xl border border-white/5 relative overflow-hidden h-64">
                    <div class="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1553877522-43269d4ea984?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-20 mix-blend-overlay"></div>
                    <div class="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"></div>
                    
                    <div class="relative z-10 w-full">
                        <div class="flex items-center gap-2 mb-2">
                            <span class="bg-red-600 text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">حصري</span>
                            <span class="text-white/60 text-xs">سلسلة الماستر كلاس</span>
                        </div>
                        <h2 class="text-4xl font-bold text-white mb-2">كيف تبني علامة تجارية لا تموت؟</h2>
                        <p class="text-white/60 text-sm max-w-xl mb-4">في هذه السلسلة الوثائقية، نستعرض كيف استطاعت الشركات الكبرى النجاة من الأزمات المالية وبناء ولاء أعمى لدى عملائها.</p>
                        
                        <div class="flex gap-3">
                            <button class="px-6 py-2 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2">
                                <svg class="ic w-5 h-5" aria-hidden="true"><use href="#i-play"/></svg>
                                تشغيل الآن
                            </button>
                            <button class="px-4 py-2 bg-white/20 text-white font-bold rounded-lg hover:bg-white/30 transition-colors flex items-center gap-2 backdrop-blur-sm">
                                <svg class="ic w-5 h-5" aria-hidden="true"><use href="#i-plus"/></svg>
                                قائمتي
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Sections -->
                <div class="space-y-8">
                    
                    <!-- Continue Watching -->
                    <div>
                        <h3 class="text-white font-bold text-lg mb-4">متابعة التعلم</h3>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <!-- Video Card -->
                            <div class="group cursor-pointer">
                                <div class="relative w-full aspect-video rounded-xl overflow-hidden mb-2 border border-white/10">
                                    <div class="absolute inset-0 bg-black/40 group-hover:bg-transparent transition-colors z-10"></div>
                                    <div class="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10"></div>
                                    <div class="absolute bottom-2 right-2 text-white font-bold z-20 text-sm">قراءة القوائم المالية للمبتدئين</div>
                                    <div class="absolute bottom-0 left-0 w-full h-1 bg-white/20 z-20">
                                        <div class="h-full bg-red-600" style="width: 45%;"></div>
                                    </div>
                                    <svg class="ic w-10 h-10 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true"><use href="#i-play-circle"/></svg>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Categories -->
                    <div>
                        <h3 class="text-white font-bold text-lg mb-4">المالية والتمويل (Mastering Finance)</h3>
                        <div class="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                            <!-- Course Card -->
                            <div class="min-w-[250px] group cursor-pointer">
                                <div class="relative w-full aspect-[3/4] rounded-xl overflow-hidden mb-2 border border-white/10">
                                    <div class="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent z-10"></div>
                                    <div class="absolute top-2 right-2 bg-red-600 text-white text-[10px] px-2 py-0.5 rounded z-20">جديد</div>
                                    <div class="absolute bottom-4 right-4 left-4 z-20">
                                        <h4 class="text-white font-bold mb-1 group-hover:text-red-400 transition-colors">أسرار التقييم (Valuation)</h4>
                                        <p class="text-[10px] text-white/50">كيف تقيم شركتك قبل دخول المستثمرين؟</p>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Course Card -->
                            <div class="min-w-[250px] group cursor-pointer">
                                <div class="relative w-full aspect-[3/4] rounded-xl overflow-hidden mb-2 border border-white/10">
                                    <div class="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent z-10"></div>
                                    <div class="absolute bottom-4 right-4 left-4 z-20">
                                        <h4 class="text-white font-bold mb-1 group-hover:text-red-400 transition-colors">هندسة التسعير</h4>
                                        <p class="text-[10px] text-white/50">استراتيجيات التسعير السيكولوجي</p>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Course Card -->
                            <div class="min-w-[250px] group cursor-pointer">
                                <div class="relative w-full aspect-[3/4] rounded-xl overflow-hidden mb-2 border border-white/10">
                                    <div class="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent z-10"></div>
                                    <div class="absolute bottom-4 right-4 left-4 z-20">
                                        <h4 class="text-white font-bold mb-1 group-hover:text-red-400 transition-colors">النجاة من وادي الموت</h4>
                                        <p class="text-[10px] text-white/50">إدارة التدفقات النقدية في السنة الأولى</p>
                                    </div>
                                </div>
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
