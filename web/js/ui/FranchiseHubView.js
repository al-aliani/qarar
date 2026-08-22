export class FranchiseHubView {
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
            <div class="franchise-hub-view max-w-5xl mx-auto py-8 px-4 animate-entry">
                <!-- Header -->
                <div class="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-gradient-to-l from-orange-500/10 to-transparent p-6 rounded-2xl border border-orange-500/20">
                    <div>
                        <h2 class="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                            <svg class="ic w-6 h-6 text-orange-400" aria-hidden="true"><use href="#i-home"/></svg>
                            منصة الامتياز التجاري (Franchise Hub)
                        </h2>
                        <p class="text-white/60 text-sm">عرض مفاهيمي لما يمكن أن تبدو عليه أداة تجهيز العلامة التجارية للامتياز — لا يوجد حالياً سوق مستثمرين متصل أو نشر فعلي للعلامة، والأرقام أدناه أمثلة توضيحية وليست محسوبة من بيانات مشروعك.</p>
                    </div>
                    <div class="flex items-center gap-3 bg-black/40 px-4 py-2 rounded-xl border border-white/5">
                        <div class="w-2 h-2 rounded-full bg-amber-500"></div>
                        <span class="text-xs text-white/80 font-bold">بيانات تجريبية (Demo)</span>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <!-- Calculator -->
                    <div class="p-6 rounded-2xl border border-white/5" style="background: rgba(255,255,255,0.02);">
                        <h3 class="text-white font-bold text-sm mb-6 flex items-center gap-2">
                            <svg class="ic w-5 h-5 text-orange-400" aria-hidden="true"><use href="#i-percent"/></svg>
                            حاسبة رسوم الامتياز العادلة
                        </h3>
                        
                        <div class="space-y-6">
                            <!-- Input Sliders Simulation -->
                            <div>
                                <div class="flex justify-between text-xs text-white/60 mb-2">
                                    <label>قوة العلامة في السوق</label>
                                    <span class="text-white">متوسطة (جديدة نسبياً)</span>
                                </div>
                                <div class="w-full h-2 bg-black/50 rounded-full overflow-hidden">
                                    <div class="h-full bg-orange-400" style="width: 40%;"></div>
                                </div>
                            </div>
                            
                            <div>
                                <div class="flex justify-between text-xs text-white/60 mb-2">
                                    <label>هامش الربح الصافي للفرع</label>
                                    <span class="text-white">22%</span>
                                </div>
                                <div class="w-full h-2 bg-black/50 rounded-full overflow-hidden">
                                    <div class="h-full bg-emerald-400" style="width: 60%;"></div>
                                </div>
                            </div>

                            <!-- Results -->
                            <div class="mt-8 p-4 rounded-xl bg-orange-500/10 border border-orange-500/20">
                                <div class="flex justify-between items-center mb-4">
                                    <span class="text-sm text-white/80">النسبة المقترحة (Royalty Fee)</span>
                                    <span class="text-xl font-bold text-orange-400">5.5%</span>
                                </div>
                                <div class="flex justify-between items-center mb-4">
                                    <span class="text-sm text-white/80">رسوم التسويق الإلزامية</span>
                                    <span class="text-xl font-bold text-orange-400">1.5%</span>
                                </div>
                                <div class="flex justify-between items-center pt-4 border-t border-orange-500/20">
                                    <span class="text-sm text-white/80">الرسوم التأسيسية (Initial Fee)</span>
                                    <span class="text-xl font-bold text-white">150,000 ريال</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Operations Manual & Readiness -->
                    <div class="flex flex-col gap-6">
                        <!-- Readiness Score -->
                        <div class="p-6 rounded-2xl relative overflow-hidden" style="background: linear-gradient(135deg, rgba(249,115,22,0.2) 0%, rgba(15,23,42,0.9) 100%); border: 1px solid rgba(249,115,22,0.3);">
                            <h3 class="text-white font-bold text-sm mb-2">جاهزية منح الامتياز (Readiness Score)</h3>
                            <div class="flex items-end gap-4 mt-4">
                                <div class="text-5xl font-bold text-orange-400">68<span class="text-2xl">%</span></div>
                                <div class="text-xs text-white/60 mb-2 max-w-[150px]">مشروعك بحاجة إلى توثيق دليل التشغيل واعتماد هوية بصرية صارمة قبل الطرح.</div>
                            </div>
                        </div>

                        <!-- Documents Gen -->
                        <div class="p-6 rounded-2xl border border-white/5 flex-1" style="background: rgba(255,255,255,0.02);">
                            <h3 class="text-white font-bold text-sm mb-4">الأدلة التشغيلية (SOPs)</h3>
                            <p class="text-xs text-white/50 mb-6">سر نجاح أي فرنشايز هو "نقل المعرفة". قم بتوليد مسودات أدلة التشغيل القياسية بناءً على قطاع مشروعك.</p>
                            
                            <div class="space-y-3">
                                <button class="w-full text-right p-3 rounded-xl bg-white/5 border border-transparent flex justify-between items-center cursor-not-allowed opacity-70" disabled title="بيانات تجريبية — توليد الأدلة غير متاح حالياً">
                                    <div>
                                        <div class="text-sm text-white font-bold mb-1">دليل العمليات اليومي</div>
                                        <div class="text-[10px] text-white/40">Opening & Closing Procedures</div>
                                    </div>
                                    <svg class="ic w-5 h-5 text-white/30" aria-hidden="true"><use href="#i-file-text"/></svg>
                                </button>

                                <button class="w-full text-right p-3 rounded-xl bg-white/5 border border-transparent flex justify-between items-center cursor-not-allowed opacity-70" disabled title="بيانات تجريبية — توليد الأدلة غير متاح حالياً">
                                    <div>
                                        <div class="text-sm text-white font-bold mb-1">دليل الموارد البشرية والتدريب</div>
                                        <div class="text-[10px] text-white/40">Employee Handbook</div>
                                    </div>
                                    <svg class="ic w-5 h-5 text-white/30" aria-hidden="true"><use href="#i-users"/></svg>
                                </button>
                            </div>
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
