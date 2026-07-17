export class AIAssistantCopilotView {
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
            <div class="ai-copilot-view max-w-4xl mx-auto py-4 px-4 h-[calc(100vh-100px)] flex flex-col animate-entry">
                <!-- Header -->
                <div class="flex justify-between items-center mb-4 bg-gradient-to-l from-emerald-500/10 to-transparent p-4 rounded-t-2xl border-b border-emerald-500/20">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400">
                            <svg class="ic w-6 h-6" aria-hidden="true"><use href="#i-cpu"/></svg>
                        </div>
                        <div>
                            <h2 class="text-lg font-bold text-white flex items-center gap-2">
                                مساعد قرار الذكي (Qarar Copilot)
                            </h2>
                            <p class="text-emerald-400/80 text-[10px]">متصل ببيانات دراسة الجدوى الخاصة بك</p>
                        </div>
                    </div>
                    <button class="btn btn-secondary btn-back-dashboard !py-1.5 !text-xs">
                        العودة
                    </button>
                </div>

                <!-- Chat Area -->
                <div class="flex-1 bg-black/40 border-x border-white/5 p-4 overflow-y-auto space-y-6 flex flex-col scrollbar-hide">
                    
                    <!-- Bot Greeting -->
                    <div class="flex gap-3 max-w-[85%]">
                        <div class="w-8 h-8 rounded-full bg-emerald-500/20 shrink-0 flex items-center justify-center text-emerald-400">
                            <svg class="ic w-4 h-4" aria-hidden="true"><use href="#i-cpu"/></svg>
                        </div>
                        <div class="bg-white/5 border border-white/10 rounded-2xl rounded-tr-sm p-4 text-sm text-white/90 leading-relaxed shadow-lg">
                            أهلاً بك! أنا مساعدك المالي الذكي. لقد قمت بتحليل دراسة الجدوى لمشروعك. يمكنك سؤالي عن التوقعات المالية، تعديل الأسعار، أو محاكاة أي سيناريو تريده. كيف يمكنني مساعدتك اليوم؟
                        </div>
                    </div>

                    <!-- User Question -->
                    <div class="flex gap-3 max-w-[85%] self-end flex-row-reverse">
                        <div class="w-8 h-8 rounded-full bg-indigo-500/20 shrink-0 flex items-center justify-center text-indigo-400 font-bold text-xs border border-indigo-500/30">
                            أنت
                        </div>
                        <div class="bg-indigo-500/20 border border-indigo-500/30 rounded-2xl rounded-tl-sm p-4 text-sm text-white leading-relaxed shadow-lg">
                            هل يمكنني استرداد رأس مالي في سنتين بدلاً من ثلاث؟
                        </div>
                    </div>

                    <!-- Bot Reply with Chart -->
                    <div class="flex gap-3 max-w-[90%]">
                        <div class="w-8 h-8 rounded-full bg-emerald-500/20 shrink-0 flex items-center justify-center text-emerald-400">
                            <svg class="ic w-4 h-4" aria-hidden="true"><use href="#i-cpu"/></svg>
                        </div>
                        <div class="bg-white/5 border border-white/10 rounded-2xl rounded-tr-sm p-4 text-sm text-white/90 leading-relaxed shadow-lg w-full">
                            <p class="mb-4">نعم، بناءً على النموذج المالي الحالي، لتقليص فترة الاسترداد إلى <strong class="text-emerald-400">24 شهراً</strong>، تحتاج إلى تحقيق أحد السيناريوهين التاليين:</p>
                            <ul class="list-disc list-inside text-white/70 space-y-1 mb-6 text-xs">
                                <li>زيادة متوسط سعر البيع بنسبة <strong class="text-white">12%</strong> دون التأثير على حجم الطلب.</li>
                                <li>تخفيض التكاليف التشغيلية بنسبة <strong class="text-white">18%</strong>.</li>
                            </ul>
                            
                            <div class="p-4 bg-black/40 rounded-xl border border-white/5">
                                <h4 class="text-xs text-white/50 mb-3 text-center">محاكاة التدفق النقدي التراكمي (السيناريو المقترح)</h4>
                                <div class="h-32 w-full flex items-end justify-between gap-2 px-2">
                                    <div class="w-full bg-red-500/50 rounded-t-sm" style="height: 20%"></div>
                                    <div class="w-full bg-red-500/30 rounded-t-sm" style="height: 10%"></div>
                                    <div class="w-full bg-emerald-500/30 rounded-t-sm" style="height: 10%"></div>
                                    <div class="w-full bg-emerald-500/50 rounded-t-sm" style="height: 30%"></div>
                                    <div class="w-full bg-emerald-500/70 rounded-t-sm" style="height: 50%"></div>
                                    <div class="w-full bg-emerald-500/90 rounded-t-sm" style="height: 80%"></div>
                                </div>
                                <div class="flex justify-between text-[10px] text-white/30 mt-2 px-2">
                                    <span>أشهر 1-4</span>
                                    <span>أشهر 5-8</span>
                                    <span>أشهر 9-12</span>
                                    <span>أشهر 13-16</span>
                                    <span>أشهر 17-20</span>
                                    <span class="text-emerald-400">نقطة الاسترداد (24)</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Input Area -->
                <div class="p-4 bg-white/5 border border-white/10 rounded-b-2xl flex items-center gap-3">
                    <button class="p-2 text-white/40 hover:text-white transition-colors">
                        <svg class="ic w-5 h-5" aria-hidden="true"><use href="#i-paperclip"/></svg>
                    </button>
                    <input type="text" placeholder="اسأل المساعد الذكي أي سؤال حول مشروعك..." class="flex-1 bg-transparent border-0 text-white focus:outline-none text-sm px-2">
                    <button class="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:scale-105 transition-transform">
                        <svg class="ic w-5 h-5 rotate-90" aria-hidden="true"><use href="#i-navigation"/></svg>
                    </button>
                </div>
            </div>
        `;

        this.container.querySelector('.btn-back-dashboard')?.addEventListener('click', () => {
            window.location.hash = '#/home';
        });

        return this.container;
    }
}
