export class SupplyChainSandboxView {
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
            <div class="supply-chain-view max-w-6xl mx-auto py-8 px-4 animate-entry">
                <!-- Header -->
                <div class="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-gradient-to-l from-teal-500/10 to-transparent p-6 rounded-2xl border border-teal-500/20">
                    <div>
                        <h2 class="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                            <svg class="ic w-6 h-6 text-teal-400" aria-hidden="true"><use href="#i-box"/></svg>
                            محاكي سلاسل الإمداد والمخزون (Supply Chain Sandbox)
                        </h2>
                        <p class="text-white/60 text-sm">مثال توضيحي لشكل لوحة مراقبة المخزون وسلاسل الإمداد — لا يوجد اتصال فعلي حالياً بأي نظام مخزون أو شحن أو مورد حقيقي، والأرقام هنا افتراضية للتوضيح فقط.</p>
                    </div>
                    <div class="flex items-center gap-3 bg-black/40 px-4 py-2 rounded-xl border border-white/5">
                        <div class="w-2 h-2 rounded-full bg-amber-500"></div>
                        <span class="text-xs text-white/80 font-bold">بيانات تجريبية (Demo)</span>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <!-- Alerts & Action Board -->
                    <div class="lg:col-span-1 space-y-6">
                        <div class="p-6 rounded-2xl border border-teal-500/30" style="background: linear-gradient(135deg, rgba(20,184,166,0.1) 0%, rgba(0,0,0,0) 100%);">
                            <h3 class="text-white font-bold text-sm mb-4 flex items-center gap-2">
                                <svg class="ic w-5 h-5 text-teal-400" aria-hidden="true"><use href="#i-warning"/></svg>
                                مثال على تنبيهات المخزون
                            </h3>
                            
                            <!-- Alert Item -->
                            <div class="p-4 bg-black/40 border border-red-500/30 rounded-xl mb-4 relative overflow-hidden group">
                                <div class="absolute left-0 top-0 w-1 h-full bg-red-500"></div>
                                <div class="flex justify-between items-start mb-2">
                                    <h4 class="text-sm font-bold text-red-400">مخزون حرج: أكواب ورقية</h4>
                                    <span class="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded">14 يوم متبقي</span>
                                </div>
                                <p class="text-[10px] text-white/60 mb-3">بناءً على وتيرة المبيعات الحالية (أعلى بـ 15% من المعتاد)، سينفد المخزون قريباً.</p>
                                <button class="w-full btn btn--secondary !py-1.5 text-xs border-red-500/50 text-red-300/60 cursor-not-allowed" disabled title="بيانات تجريبية — لا يوجد اتصال فعلي بأي مورد">
                                    طلب عاجل من المورد الأساسي (غير متاح)
                                </button>
                            </div>
                            
                            <!-- Alert Item -->
                            <div class="p-4 bg-black/40 border border-yellow-500/30 rounded-xl relative overflow-hidden">
                                <div class="absolute left-0 top-0 w-1 h-full bg-yellow-500"></div>
                                <div class="flex justify-between items-start mb-2">
                                    <h4 class="text-sm font-bold text-yellow-400">تأخير في الشحن: حبوب البن</h4>
                                    <span class="text-[10px] bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">شحنة #889</span>
                                </div>
                                <p class="text-[10px] text-white/60 mb-3">السفينة متأخرة 3 أيام عن الموعد المتوقع بسبب ظروف مناخية.</p>
                                <button class="w-full btn btn--secondary !py-1.5 text-xs border-yellow-500/50 text-yellow-300/60 cursor-not-allowed" disabled title="بيانات تجريبية — لا يوجد نظام موردين فعلي متصل">
                                    تفعيل خطة المورد البديل (محلي) (غير متاح)
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Warehouse & Logistics Dashboard -->
                    <div class="lg:col-span-2 space-y-6">
                        <!-- Logistics Map Simulation -->
                        <div class="p-6 rounded-2xl relative border border-white/5" style="background: rgba(255,255,255,0.02); min-height: 250px;">
                            <h3 class="text-white font-bold text-sm mb-4">مثال توضيحي لمسار شحنة (لا يعكس شحنة حقيقية)</h3>

                            <div class="relative w-full h-40 mt-4 bg-black/30 rounded-xl overflow-hidden border border-white/10">
                                <!-- Illustrative route only — no live tracking connection -->
                                <svg class="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                                    <path d="M 20,80 Q 150,90 250,50 T 400,20" fill="none" stroke="rgba(20,184,166,0.3)" stroke-width="2" stroke-dasharray="5 5"></path>
                                </svg>
                                
                                <!-- Origin (Supplier) -->
                                <div class="absolute w-8 h-8 rounded-full bg-white/10 border border-white/30 flex items-center justify-center left-[20px] top-[80px] -translate-x-1/2 -translate-y-1/2 text-[10px]">
                                    <svg class="ic" aria-hidden="true"><use href="#i-factory"/></svg>
                                </div>
                                <div class="absolute left-[20px] top-[100px] -translate-x-1/2 text-[10px] text-white/50 bg-black/80 px-1 rounded">المورد (البرازيل)</div>
                                
                                <!-- Destination (Warehouse) -->
                                <div class="absolute w-8 h-8 rounded-full bg-teal-500/20 border border-teal-500 flex items-center justify-center left-[400px] top-[20px] -translate-x-1/2 -translate-y-1/2 text-[10px]">
                                    <svg class="ic" aria-hidden="true"><use href="#i-box"/></svg>
                                </div>
                                <div class="absolute left-[400px] top-[40px] -translate-x-1/2 text-[10px] text-teal-400 font-bold bg-black/80 px-1 rounded">المستودع الرئيسي</div>
                            </div>
                        </div>

                        <!-- Inventory Levels -->
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <!-- Item -->
                            <div class="p-4 rounded-xl bg-white/5 border border-white/10">
                                <h4 class="text-white text-xs font-bold mb-3">حبوب بن مختصة</h4>
                                <div class="flex justify-between items-end mb-1">
                                    <span class="text-2xl font-bold text-teal-400">85%</span>
                                    <span class="text-[10px] text-white/50">آمن</span>
                                </div>
                                <div class="w-full h-1.5 bg-black/50 rounded-full">
                                    <div class="h-full bg-teal-400 rounded-full" style="width: 85%;"></div>
                                </div>
                            </div>
                            
                            <!-- Item -->
                            <div class="p-4 rounded-xl bg-white/5 border border-white/10">
                                <h4 class="text-white text-xs font-bold mb-3">حليب مبستر</h4>
                                <div class="flex justify-between items-end mb-1">
                                    <span class="text-2xl font-bold text-yellow-400">40%</span>
                                    <span class="text-[10px] text-white/50">يحتاج طلب</span>
                                </div>
                                <div class="w-full h-1.5 bg-black/50 rounded-full">
                                    <div class="h-full bg-yellow-400 rounded-full" style="width: 40%;"></div>
                                </div>
                            </div>
                            
                            <!-- Item -->
                            <div class="p-4 rounded-xl bg-red-500/5 border border-red-500/20 relative overflow-hidden group">
                                <div class="absolute inset-0 bg-red-500/10"></div>
                                <h4 class="text-white text-xs font-bold mb-3 relative z-10">أكواب ورقية</h4>
                                <div class="flex justify-between items-end mb-1 relative z-10">
                                    <span class="text-2xl font-bold text-red-500">12%</span>
                                    <span class="text-[10px] text-red-400">حرج</span>
                                </div>
                                <div class="w-full h-1.5 bg-black/50 rounded-full relative z-10">
                                    <div class="h-full bg-red-500 rounded-full" style="width: 12%;"></div>
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
