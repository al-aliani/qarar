export class DigitalReputationRadarView {
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
            <div class="digital-reputation-view max-w-6xl mx-auto py-8 px-4 animate-entry">
                <!-- Header -->
                <div class="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-gradient-to-l from-blue-600/10 to-transparent p-6 rounded-2xl border border-blue-500/20">
                    <div>
                        <h2 class="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                            <svg class="ic w-6 h-6 text-blue-400" aria-hidden="true"><use href="#i-target"/></svg>
                            رادار السمعة الرقمية (Reputation Radar)
                        </h2>
                        <p class="text-white/60 text-sm">تصوّر لما يمكن أن تعرضه أداة مراقبة السمعة الرقمية على منصات مثل X وTikTok وGoogle Maps — الربط الفعلي بهذه المنصات غير متاح حالياً، ويحتاج اشتراكات API مدفوعة مع كل منصة على حدة.</p>
                    </div>
                    <div class="flex items-center gap-3 bg-black/40 px-4 py-2 rounded-xl border border-white/5">
                        <div class="w-2 h-2 rounded-full bg-amber-500"></div>
                        <span class="text-xs text-white/80 font-bold">بيانات تجريبية (Demo)</span>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <!-- Global Sentiment -->
                    <div class="lg:col-span-1 space-y-6">
                        <div class="p-6 rounded-2xl border border-white/10 bg-black/40 text-center relative overflow-hidden group">
                            <div class="absolute inset-0 bg-gradient-to-b from-emerald-500/10 to-transparent opacity-50"></div>
                            <h3 class="text-white font-bold text-sm mb-6 relative z-10">مؤشر المشاعر العام — مثال توضيحي</h3>

                            <div class="text-6xl font-black text-emerald-400 mb-2 font-mono drop-shadow-[0_0_15px_rgba(16,185,129,0.5)] relative z-10">
                                75%
                            </div>
                            <div class="text-emerald-500/70 text-xs font-bold mb-6 relative z-10">مثال افتراضي لمشاعر إيجابية (ليست بيانات حقيقية)</div>

                            <div class="space-y-3 relative z-10 text-right">
                                <div class="flex items-center justify-between text-xs p-2 rounded bg-white/5">
                                    <span class="text-white/70">X (Twitter)</span>
                                    <span class="text-yellow-400 font-bold">50% (محايد)</span>
                                </div>
                                <div class="flex items-center justify-between text-xs p-2 rounded bg-white/5">
                                    <span class="text-white/70">TikTok</span>
                                    <span class="text-red-400 font-bold">35% (سلبي)</span>
                                </div>
                                <div class="flex items-center justify-between text-xs p-2 rounded bg-white/5">
                                    <span class="text-white/70">Google Maps</span>
                                    <span class="text-emerald-400 font-bold">92% (إيجابي)</span>
                                </div>
                            </div>
                        </div>

                        <!-- Brand Keywords -->
                        <div class="p-6 rounded-2xl border border-white/10 bg-black/40">
                            <h4 class="text-white font-bold text-sm mb-4">أمثلة كلمات مفتاحية متكررة (توضيحي)</h4>
                            <div class="flex flex-wrap gap-2">
                                <span class="px-2 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-xs">"طعم رائع" (42)</span>
                                <span class="px-2 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded text-xs">"تأخير الطلب" (18)</span>
                                <span class="px-2 py-1 bg-white/10 text-white/60 border border-white/20 rounded text-xs">"التغليف" (12)</span>
                                <span class="px-2 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded text-xs">"الموقع" (8)</span>
                            </div>
                        </div>
                    </div>

                    <!-- Example Feed & Alerts -->
                    <div class="lg:col-span-2 space-y-4">
                        <!-- Example Alert -->
                        <div class="p-4 rounded-xl border border-red-500/50 bg-red-900/30 relative overflow-hidden">
                            <div class="absolute left-0 top-0 w-1.5 h-full bg-red-500"></div>
                            <div class="flex justify-between items-start mb-3">
                                <div class="flex items-center gap-2 text-red-400 font-bold text-sm">
                                    <svg class="ic w-5 h-5" aria-hidden="true"><use href="#i-warning"/></svg>
                                    مثال: إنذار مبكر لأزمة محتملة على TikTok
                                </div>
                                <div class="text-[10px] text-red-300/50">مثال توضيحي</div>
                            </div>
                            <p class="text-xs text-white/80 leading-relaxed mb-4">هكذا يمكن أن يبدو تنبيه عندما يشتكي عميل من تأخر التوصيل ووصول القهوة باردة، لو كانت الأداة متصلة فعلياً بمصدر بيانات حقيقي.</p>

                            <div class="flex gap-2">
                                <button class="py-1.5 px-4 bg-red-600/50 text-white/70 font-bold rounded text-xs cursor-not-allowed flex items-center gap-2" disabled title="مثال توضيحي — غير مفعّل">
                                    إطلاق كود خصم للاعتذار
                                </button>
                                <button class="py-1.5 px-4 bg-black/40 border border-red-500/30 text-red-300/70 font-bold rounded text-xs cursor-not-allowed" disabled title="مثال توضيحي — غير مفعّل">
                                    الرد المباشر على الحساب
                                </button>
                            </div>
                        </div>

                        <!-- Example Mentions Feed -->
                        <h3 class="text-white font-bold text-sm mt-6 mb-2">أمثلة على إشارات متداولة (Mentions) — توضيحي</h3>

                        <div class="space-y-3">
                            <!-- Mention 1 -->
                            <div class="p-4 rounded-xl border border-white/5 bg-black/40 flex gap-4 hover:border-white/20 transition-colors">
                                <div class="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/30">X</div>
                                <div class="flex-1">
                                    <div class="flex justify-between items-start mb-1">
                                        <div class="text-xs font-bold text-white">@user_2910</div>
                                        <div class="text-[10px] text-white/40">مثال</div>
                                    </div>
                                    <p class="text-xs text-white/70">تطبيقكم الجديد يفوز! واجهة سريعة وخدمة عملاء راقية. شكراً لكم 👏</p>
                                </div>
                            </div>

                            <!-- Mention 2 -->
                            <div class="p-4 rounded-xl border border-white/5 bg-black/40 flex gap-4 hover:border-white/20 transition-colors">
                                <div class="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                                    <svg class="ic w-4 h-4" aria-hidden="true"><use href="#i-pin"/></svg>
                                </div>
                                <div class="flex-1">
                                    <div class="flex justify-between items-start mb-1">
                                        <div class="text-xs font-bold text-white">Google Maps Review (فرع الملقا)</div>
                                        <div class="text-[10px] text-white/40">مثال</div>
                                    </div>
                                    <div class="flex text-yellow-400 mb-1">★★★★★</div>
                                    <p class="text-xs text-white/70">المكان هادئ ومناسب للعمل، والقهوة ممتازة كالعادة.</p>
                                </div>
                            </div>

                            <!-- Mention 3 -->
                            <div class="p-4 rounded-xl border border-red-500/20 bg-red-950/20 flex gap-4 hover:border-red-500/40 transition-colors">
                                <div class="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/30">X</div>
                                <div class="flex-1">
                                    <div class="flex justify-between items-start mb-1">
                                        <div class="text-xs font-bold text-white">@angry_client</div>
                                        <div class="text-[10px] text-white/40">مثال</div>
                                    </div>
                                    <p class="text-xs text-white/70">أسوأ تجربة! طلبت من ساعة ونص وللحين ما وصل الطلب ومحد يرد على خدمة العملاء 😡</p>
                                    <div class="mt-2 text-right">
                                        <span class="text-[10px] text-white/40">مثال — إنشاء تذكرة دعم فني تلقائياً غير متاح حالياً</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="max-w-6xl mx-auto px-4 mt-6">
                <button type="button" class="btn btn-secondary btn-back-dashboard">
                    <svg class="ic" aria-hidden="true"><use href="#i-home"/></svg>
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
