export class AIFocusGroupView {
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
            <div class="ai-focus-group-view max-w-6xl mx-auto py-8 px-4 animate-entry">
                <!-- Header -->
                <div class="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-gradient-to-r from-blue-900/30 via-indigo-900/20 to-transparent p-6 rounded-2xl border border-blue-500/30 relative overflow-hidden">
                    <div class="absolute -right-20 -top-20 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl animate-pulse"></div>
                    <div class="absolute left-10 bottom-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl"></div>
                    
                    <div class="relative z-10">
                        <h2 class="text-3xl font-bold text-blue-400 mb-2 flex items-center gap-3">
                            <svg class="ic w-8 h-8" aria-hidden="true"><use href="#i-message-square"/></svg>
                            محطة أبحاث المستهلك الافتراضية (AI Focus Group)
                        </h2>
                        <p class="text-blue-100/60 text-sm">مثال توضيحي لشكل محادثة مع عميل افتراضي — المحادثة أدناه نص ثابت لأغراض العرض فقط، وليست تفاعلاً حقيقياً مع ذكاء اصطناعي، ولا يمكن الكتابة فيها حالياً.</p>
                    </div>

                    <div class="flex items-center gap-3 relative z-10">
                        <button class="btn btn--primary !bg-blue-600 text-white font-bold whitespace-nowrap border-0 opacity-60" style="pointer-events: none;" disabled>
                            توليد شخصية جديدة (قريباً)
                        </button>
                        <div class="flex items-center gap-3 bg-black/40 px-4 py-2 rounded-xl border border-white/5">
                            <div class="w-2 h-2 rounded-full bg-amber-500"></div>
                            <span class="text-xs text-white/80 font-bold">مفهوم — قيد التطوير</span>
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <!-- Persona Profile -->
                    <div class="lg:col-span-1 space-y-6">
                        <div class="p-6 rounded-2xl border border-blue-500/30 bg-black/60 relative overflow-hidden text-center">
                            <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-indigo-500"></div>
                            
                            <!-- Avatar -->
                            <div class="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 p-1 mb-4 relative">
                                <div class="w-full h-full rounded-full bg-black flex items-center justify-center overflow-hidden">
                                    <svg class="ic w-12 h-12 text-indigo-400" aria-hidden="true"><use href="#i-user"/></svg>
                                </div>
                                <div class="absolute bottom-0 right-0 w-6 h-6 bg-emerald-500 rounded-full border-2 border-black flex items-center justify-center">
                                    <svg class="ic w-3 h-3 text-white" aria-hidden="true"><use href="#i-cpu"/></svg>
                                </div>
                            </div>
                            
                            <h3 class="text-white font-bold text-xl mb-1">سارة (العميل الافتراضي)</h3>
                            <p class="text-blue-400 text-xs font-bold mb-4">أم عاملة، 32 سنة، تسكن في الرياض</p>
                            
                            <div class="space-y-3 text-right mt-6 border-t border-white/10 pt-4">
                                <div class="flex justify-between text-xs">
                                    <span class="text-white/50">الدخل الشهري</span>
                                    <span class="text-white font-bold">12,000 - 15,000 ر.س</span>
                                </div>
                                <div class="flex justify-between text-xs">
                                    <span class="text-white/50">الاهتمامات</span>
                                    <span class="text-white font-bold">القهوة المختصة، السرعة، التوفير</span>
                                </div>
                                <div class="flex justify-between text-xs">
                                    <span class="text-white/50">نقاط الألم (Pain points)</span>
                                    <span class="text-red-400 font-bold">ضيق الوقت في الصباح</span>
                                </div>
                            </div>
                        </div>

                        <!-- Mood Meter -->
                        <div class="p-6 rounded-2xl border border-white/5 bg-white/5">
                            <h4 class="text-white font-bold text-sm mb-4">مؤشر الإعجاب بالمنتج (مثال توضيحي)</h4>
                            <div class="relative w-full h-4 bg-black/50 rounded-full overflow-hidden mb-2">
                                <div class="absolute top-0 left-0 h-full bg-gradient-to-r from-red-500 via-yellow-500 to-emerald-500 w-full opacity-30"></div>
                                <div class="absolute top-0 right-0 h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)] rounded-full transition-all duration-1000" style="width: 75%;"></div>
                            </div>
                            <div class="flex justify-between text-[10px] font-bold">
                                <span class="text-emerald-400">متحمسة للشراء (75%)</span>
                                <span class="text-red-400">ترفض السعر</span>
                            </div>
                        </div>
                    </div>

                    <!-- Chat Interface (static demo text, not interactive) -->
                    <div class="lg:col-span-2 flex flex-col h-[600px] p-4 rounded-2xl border border-indigo-500/30 bg-black/40 relative">
                        <div class="flex items-center gap-3 mb-4 pb-4 border-b border-white/10">
                            <div class="w-2 h-2 rounded-full bg-amber-500"></div>
                            <span class="text-white font-bold text-sm">مثال محادثة (نص ثابت — غير تفاعلي)</span>
                        </div>

                        <!-- Messages Area -->
                        <div class="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                            <!-- User Message -->
                            <div class="flex flex-col items-start gap-1">
                                <div class="text-[10px] text-white/40 px-2">أنت (صاحب المشروع)</div>
                                <div class="bg-indigo-600 text-white text-sm p-3 rounded-2xl rounded-tr-sm max-w-[80%] border border-indigo-500">
                                    أهلاً سارة، نحن نطلق تطبيقاً جديداً لتوصيل القهوة المجدولة (تصلك قهوتك الساخنة يومياً في نفس موعد خروجك للعمل). الاشتراك الشهري بـ 350 ريال، ما رأيك؟
                                </div>
                            </div>

                            <!-- AI Persona Response -->
                            <div class="flex flex-col items-end gap-1">
                                <div class="text-[10px] text-blue-400 px-2 flex items-center gap-1"><svg class="ic w-3 h-3" aria-hidden="true"><use href="#i-cpu"/></svg> سارة (شخصية افتراضية — نص مثال)</div>
                                <div class="bg-white/10 text-white text-sm p-3 rounded-2xl rounded-tl-sm max-w-[80%] border border-white/20 leading-relaxed text-right">
                                    الفكرة ممتازة جداً وتحل مشكلة كبيرة لي، أنا أكره الوقوف في طوابير المقاهي صباحاً! 😍<br/><br/>
                                    ولكن.. السعر (350 ريال) يبدو مرتفعاً قليلاً لدفع مبلغ مقطوع مسبقاً. لو جعلتم الاشتراك بـ 250 ريال لـ 15 كوباً في الشهر فقط (أيام العمل) سأشترك فوراً!
                                </div>
                            </div>
                            
                            <!-- Analysis Node -->
                            <div class="flex justify-center my-4">
                                <div class="bg-indigo-900/40 border border-indigo-500/50 text-indigo-300 px-4 py-2 rounded-full text-[10px] font-mono flex items-center gap-2">
                                    <svg class="ic w-3 h-3" aria-hidden="true"><use href="#i-zap"/></svg>
                                    مثال تحليل: العميل يرفض التسعير الحالي، يقترح باقة مخصصة لأيام العمل.
                                </div>
                            </div>
                        </div>

                        <!-- Honest notice instead of a fake live input -->
                        <div class="mt-4 pt-4 border-t border-white/10">
                            <div class="alert alert--info text-xs">
                                المحادثة التفاعلية الحقيقية (طرح أسئلة والحصول على ردود من عميل افتراضي مدعوم بذكاء اصطناعي) تحتاج قرار ربط بموفر ذكاء اصطناعي وميزانية تشغيلية، وهي غير مفعّلة في هذا الإصدار.
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
