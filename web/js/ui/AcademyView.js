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
                <!-- Header -->
                <div class="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-gradient-to-l from-red-600/10 to-transparent p-6 rounded-2xl border border-red-500/20">
                    <div>
                        <h2 class="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                            <svg class="ic w-6 h-6 text-red-500" aria-hidden="true"><use href="#i-graduation"/></svg>
                            أكاديمية قرار — دورات ريادة الأعمال
                        </h2>
                        <p class="text-white/60 text-sm">تصور مبدئي لشكل أكاديمية تدريبية داخل المنصة — عناوين الدورات أدناه أمثلة توضيحية فقط، ولا يوجد محتوى فيديو فعلي أو نظام تشغيل أو تتبّع تقدّم مرتبط بها حالياً.</p>
                    </div>
                    <div class="flex items-center gap-3 bg-black/40 px-4 py-2 rounded-xl border border-white/5">
                        <div class="w-2 h-2 rounded-full bg-amber-500"></div>
                        <span class="text-xs text-white/80 font-bold">مفهوم — قيد التطوير (Demo)</span>
                    </div>
                </div>

                <!-- Sections -->
                <div class="space-y-8">

                    <!-- Categories -->
                    <div>
                        <h3 class="text-white font-bold text-lg mb-4">أمثلة لمحتوى مقترح — المالية والتمويل</h3>
                        <div class="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                            <!-- Course Card -->
                            <div class="min-w-[250px] group cursor-default">
                                <div class="relative w-full aspect-[3/4] rounded-xl overflow-hidden mb-2 border border-white/10">
                                    <div class="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent z-10"></div>
                                    <div class="absolute top-2 right-2 bg-white/10 text-white/70 text-[10px] px-2 py-0.5 rounded z-20">مثال</div>
                                    <div class="absolute bottom-4 right-4 left-4 z-20">
                                        <h4 class="text-white font-bold mb-1">أسرار التقييم (Valuation)</h4>
                                        <p class="text-[10px] text-white/50">كيف تقيم شركتك قبل دخول المستثمرين؟</p>
                                    </div>
                                </div>
                            </div>

                            <!-- Course Card -->
                            <div class="min-w-[250px] group cursor-default">
                                <div class="relative w-full aspect-[3/4] rounded-xl overflow-hidden mb-2 border border-white/10">
                                    <div class="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent z-10"></div>
                                    <div class="absolute top-2 right-2 bg-white/10 text-white/70 text-[10px] px-2 py-0.5 rounded z-20">مثال</div>
                                    <div class="absolute bottom-4 right-4 left-4 z-20">
                                        <h4 class="text-white font-bold mb-1">هندسة التسعير</h4>
                                        <p class="text-[10px] text-white/50">استراتيجيات التسعير السيكولوجي</p>
                                    </div>
                                </div>
                            </div>

                            <!-- Course Card -->
                            <div class="min-w-[250px] group cursor-default">
                                <div class="relative w-full aspect-[3/4] rounded-xl overflow-hidden mb-2 border border-white/10">
                                    <div class="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent z-10"></div>
                                    <div class="absolute top-2 right-2 bg-white/10 text-white/70 text-[10px] px-2 py-0.5 rounded z-20">مثال</div>
                                    <div class="absolute bottom-4 right-4 left-4 z-20">
                                        <h4 class="text-white font-bold mb-1">النجاة من وادي الموت</h4>
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
