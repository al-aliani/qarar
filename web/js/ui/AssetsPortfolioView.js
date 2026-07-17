export class AssetsPortfolioView {
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
            <div class="assets-portfolio-view max-w-6xl mx-auto py-8 px-4 animate-entry">
                <!-- Header -->
                <div class="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-gradient-to-l from-stone-600/20 to-transparent p-6 rounded-2xl border border-stone-500/30">
                    <div>
                        <h2 class="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                            <svg class="ic w-6 h-6 text-stone-300" aria-hidden="true"><use href="#i-home"/></svg>
                            محفظة الأصول والعقارات السحابية (Assets Portfolio)
                        </h2>
                        <p class="text-white/60 text-sm">أدر الفروع، وتتبع عقود الإيجار، وراقب إهلاك المعدات للحفاظ على قيمة أصول شركتك.</p>
                    </div>
                    <div class="flex gap-2">
                        <button class="btn btn--secondary !border-stone-500/50 text-stone-300 hover:bg-stone-500/20">
                            إضافة أصل جديد
                        </button>
                        <button class="btn btn--primary !bg-stone-600 hover:!bg-stone-700 font-bold whitespace-nowrap text-white border-0 shadow-[0_0_15px_rgba(120,113,108,0.4)]">
                            توليد تقرير الممتلكات
                        </button>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <!-- Lease Tracking (Alerts) -->
                    <div class="lg:col-span-1 space-y-6">
                        <div class="p-6 rounded-2xl border border-red-500/30 bg-black/40 relative overflow-hidden group">
                            <div class="absolute left-0 top-0 w-1.5 h-full bg-red-500"></div>
                            <div class="flex items-center gap-2 mb-3">
                                <svg class="ic w-5 h-5 text-red-500 animate-pulse" aria-hidden="true"><use href="#i-alert-circle"/></svg>
                                <h3 class="text-white font-bold text-sm">تنبيهات العقود الحرجة</h3>
                            </div>
                            
                            <div class="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                                <h4 class="text-sm font-bold text-white mb-1">عقد إيجار: فرع الملقا</h4>
                                <div class="flex justify-between items-center mb-2 text-xs">
                                    <span class="text-red-400 font-bold">ينتهي بعد 60 يوماً</span>
                                    <span class="text-white/50">قيمة العقد: 120K/سنة</span>
                                </div>
                                <p class="text-[10px] text-white/60 leading-relaxed mb-3">إشعار نظامي: الإيجارات في منطقة "الملقا" ارتفعت بنسبة 10% تقريباً هذا العام. استعد للتفاوض أو ابحث عن بديل مبكراً.</p>
                                <div class="flex gap-2">
                                    <button class="flex-1 py-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-300 text-xs rounded border border-red-500/30 transition-colors">إشعار تجديد</button>
                                    <button class="flex-1 py-1.5 bg-white/5 hover:bg-white/10 text-white/70 text-xs rounded transition-colors">بحث عن عقار بديل</button>
                                </div>
                            </div>
                        </div>

                        <!-- Real Estate Stats -->
                        <div class="grid grid-cols-2 gap-4">
                            <div class="p-4 rounded-xl border border-stone-500/20 bg-stone-500/5">
                                <div class="text-[10px] text-stone-400 mb-1">إجمالي الفروع المؤجرة</div>
                                <div class="text-2xl font-bold text-white">4</div>
                            </div>
                            <div class="p-4 rounded-xl border border-stone-500/20 bg-stone-500/5">
                                <div class="text-[10px] text-stone-400 mb-1">الالتزام الإيجاري السنوي</div>
                                <div class="text-xl font-bold text-white">350,000 <span class="text-[10px] font-normal text-white/50">ر.س</span></div>
                            </div>
                        </div>
                    </div>

                    <!-- Equipment & Depreciation -->
                    <div class="lg:col-span-2 space-y-6">
                        <div class="p-6 rounded-2xl border border-white/5" style="background: rgba(255,255,255,0.02);">
                            <div class="flex justify-between items-center mb-6">
                                <h3 class="text-white font-bold text-sm flex items-center gap-2">
                                    <svg class="ic w-5 h-5 text-stone-400" aria-hidden="true"><use href="#i-monitor"/></svg>
                                    الأصول الثابتة وتتبع الإهلاك (Depreciation)
                                </h3>
                                <div class="text-xs text-stone-400 bg-stone-500/10 px-3 py-1 rounded-full border border-stone-500/20">
                                    القيمة الدفترية الحالية: 850,000 ريال
                                </div>
                            </div>
                            
                            <!-- Assets Table -->
                            <div class="overflow-x-auto">
                                <table class="w-full text-right text-xs text-white/80">
                                    <thead class="bg-white/5 border-b border-white/10">
                                        <tr>
                                            <th class="p-3 font-medium">الأصل (المعدة / الآلة)</th>
                                            <th class="p-3 font-medium">الفرع</th>
                                            <th class="p-3 font-medium">تاريخ الشراء</th>
                                            <th class="p-3 font-medium">القيمة الدفترية</th>
                                            <th class="p-3 font-medium">حالة الإهلاك والعمر الافتراضي</th>
                                            <th class="p-3 font-medium text-center">إجراء</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <!-- Asset 1 (Warning) -->
                                        <tr class="border-b border-white/5 bg-yellow-500/5">
                                            <td class="p-3 font-bold text-white flex items-center gap-2">
                                                <div class="w-2 h-2 rounded-full bg-yellow-400"></div>
                                                آلة إسبريسو (La Marzocco)
                                            </td>
                                            <td class="p-3 text-white/60">فرع العليا</td>
                                            <td class="p-3 text-white/60">2021</td>
                                            <td class="p-3 font-mono text-stone-300">12,500 ريال</td>
                                            <td class="p-3 w-1/3">
                                                <div class="flex justify-between text-[10px] mb-1">
                                                    <span class="text-yellow-400">متهالك جزئياً (80%)</span>
                                                    <span>تبقى سنة</span>
                                                </div>
                                                <div class="w-full h-1.5 bg-black/50 rounded-full">
                                                    <div class="h-full bg-yellow-400 rounded-full" style="width: 80%;"></div>
                                                </div>
                                            </td>
                                            <td class="p-3 text-center">
                                                <button class="text-stone-400 hover:text-white transition-colors" title="التفاصيل"><svg class="ic w-4 h-4 mx-auto" aria-hidden="true"><use href="#i-more-horizontal"/></svg></button>
                                            </td>
                                        </tr>
                                        <!-- Asset 2 (Good) -->
                                        <tr class="border-b border-white/5">
                                            <td class="p-3 font-bold text-white flex items-center gap-2">
                                                <div class="w-2 h-2 rounded-full bg-emerald-400"></div>
                                                أثاث مكتبي وتقني
                                            </td>
                                            <td class="p-3 text-white/60">الإدارة المركزية</td>
                                            <td class="p-3 text-white/60">2024</td>
                                            <td class="p-3 font-mono text-stone-300">45,000 ريال</td>
                                            <td class="p-3 w-1/3">
                                                <div class="flex justify-between text-[10px] mb-1">
                                                    <span class="text-emerald-400">بحالة ممتازة (15%)</span>
                                                    <span>تبقى 4 سنوات</span>
                                                </div>
                                                <div class="w-full h-1.5 bg-black/50 rounded-full">
                                                    <div class="h-full bg-emerald-400 rounded-full" style="width: 15%;"></div>
                                                </div>
                                            </td>
                                            <td class="p-3 text-center">
                                                <button class="text-stone-400 hover:text-white transition-colors"><svg class="ic w-4 h-4 mx-auto" aria-hidden="true"><use href="#i-more-horizontal"/></svg></button>
                                            </td>
                                        </tr>
                                        <!-- Asset 3 (Critical) -->
                                        <tr class="border-b border-white/5 bg-red-500/5">
                                            <td class="p-3 font-bold text-white flex items-center gap-2">
                                                <div class="w-2 h-2 rounded-full bg-red-500"></div>
                                                سيارة نقل مبرد (دينا)
                                            </td>
                                            <td class="p-3 text-white/60">الخدمات اللوجستية</td>
                                            <td class="p-3 text-white/60">2019</td>
                                            <td class="p-3 font-mono text-stone-300">0 ريال</td>
                                            <td class="p-3 w-1/3">
                                                <div class="flex justify-between text-[10px] mb-1">
                                                    <span class="text-red-400 font-bold">مهلك بالكامل (100%)</span>
                                                    <span class="text-red-500">منتهي</span>
                                                </div>
                                                <div class="w-full h-1.5 bg-black/50 rounded-full">
                                                    <div class="h-full bg-red-500 rounded-full" style="width: 100%;"></div>
                                                </div>
                                            </td>
                                            <td class="p-3 text-center">
                                                <button class="px-2 py-1 bg-red-500/20 text-red-400 text-[10px] rounded hover:bg-red-500 hover:text-white transition-colors border border-red-500/30">استبدال الأصل</button>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
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
