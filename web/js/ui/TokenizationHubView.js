export class TokenizationHubView {
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
            <div class="tokenization-view max-w-6xl mx-auto py-8 px-4 animate-entry">
                <!-- Header -->
                <div class="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-gradient-to-l from-fuchsia-600/10 to-transparent p-6 rounded-2xl border border-fuchsia-500/20">
                    <div>
                        <h2 class="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                            <svg class="ic w-6 h-6 text-fuchsia-400" aria-hidden="true"><use href="#i-layers"/></svg>
                            منصة ترميز الحصص (Tokenization & ESOP)
                        </h2>
                        <p class="text-white/60 text-sm">حوّل رأس مال شركتك إلى "أسهم رقمية" (Tokens). امنح الموظفين حوافز أو اجمع تمويلاً جماعياً بسهولة.</p>
                    </div>
                    <button class="btn btn--primary !bg-fuchsia-600 hover:!bg-fuchsia-700 font-bold whitespace-nowrap text-white border-0 shadow-[0_0_15px_rgba(192,38,211,0.5)]">
                        إصدار أسهم رقمية (Mint Tokens)
                    </button>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <!-- Token Metrics -->
                    <div class="lg:col-span-1 space-y-6">
                        <div class="p-6 rounded-2xl relative overflow-hidden" style="background: linear-gradient(135deg, rgba(192,38,211,0.15) 0%, rgba(0,0,0,0) 100%); border: 1px solid rgba(192,38,211,0.3);">
                            <div class="absolute -right-6 -top-6 w-24 h-24 bg-fuchsia-500/20 rounded-full blur-xl"></div>
                            <h3 class="text-white/80 font-bold text-xs mb-2">إجمالي الأسهم المصدرة (Total Supply)</h3>
                            <div class="text-3xl font-bold text-white mb-2 font-mono">1,000,000 <span class="text-sm text-fuchsia-400">Q-Token</span></div>
                            
                            <h3 class="text-white/80 font-bold text-xs mb-2 mt-6">القيمة السوقية للرمز (Token Price)</h3>
                            <div class="text-2xl font-bold text-green-400 mb-1 font-mono">4.20 <span class="text-xs text-white/50">ريال</span></div>
                            <p class="text-[10px] text-white/40">بناءً على التقييم الأخير للشركة (4.2 مليون ريال)</p>
                        </div>
                        
                        <!-- Cap Table -->
                        <div class="p-6 rounded-2xl border border-white/5" style="background: rgba(255,255,255,0.02);">
                            <h3 class="text-white font-bold text-sm mb-4">هيكل الملكية (Cap Table)</h3>
                            
                            <div class="space-y-4">
                                <div>
                                    <div class="flex justify-between text-xs mb-1">
                                        <span class="text-white">المؤسسون</span>
                                        <span class="text-fuchsia-400 font-bold">75%</span>
                                    </div>
                                    <div class="w-full h-1.5 bg-black/50 rounded-full">
                                        <div class="h-full bg-fuchsia-500 rounded-full" style="width: 75%;"></div>
                                    </div>
                                </div>
                                <div>
                                    <div class="flex justify-between text-xs mb-1">
                                        <span class="text-white">مجمع حوافز الموظفين (ESOP)</span>
                                        <span class="text-blue-400 font-bold">10%</span>
                                    </div>
                                    <div class="w-full h-1.5 bg-black/50 rounded-full">
                                        <div class="h-full bg-blue-500 rounded-full" style="width: 10%;"></div>
                                    </div>
                                </div>
                                <div>
                                    <div class="flex justify-between text-xs mb-1">
                                        <span class="text-white">تمويل جماعي (Crowdfunding)</span>
                                        <span class="text-emerald-400 font-bold">15%</span>
                                    </div>
                                    <div class="w-full h-1.5 bg-black/50 rounded-full">
                                        <div class="h-full bg-emerald-500 rounded-full" style="width: 15%;"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Token Utilities (ESOP & Crowdfunding) -->
                    <div class="lg:col-span-2 space-y-6">
                        <!-- Employee Stock Option Plan -->
                        <div class="p-6 rounded-2xl border border-white/5" style="background: rgba(255,255,255,0.02);">
                            <div class="flex justify-between items-center mb-6">
                                <h3 class="text-white font-bold text-sm flex items-center gap-2">
                                    <svg class="ic w-5 h-5 text-blue-400" aria-hidden="true"><use href="#i-users"/></svg>
                                    توزيع الحوافز للموظفين (ESOP)
                                </h3>
                                <button class="btn btn--secondary !py-1 text-xs border-blue-500/50 text-blue-300 hover:bg-blue-500/20">منح أسهم</button>
                            </div>
                            
                            <table class="w-full text-right text-xs text-white/80">
                                <thead class="bg-white/5 border-b border-white/10">
                                    <tr>
                                        <th class="p-2 font-medium">الموظف</th>
                                        <th class="p-2 font-medium">عدد الأسهم الممنوحة</th>
                                        <th class="p-2 font-medium">فترة الاستحقاق (Vesting)</th>
                                        <th class="p-2 font-medium">الأسهم المحررة</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr class="border-b border-white/5">
                                        <td class="p-2 font-bold text-white">مدير العمليات</td>
                                        <td class="p-2 font-mono text-fuchsia-300">50,000</td>
                                        <td class="p-2">4 سنوات (سنة جرف Cliff)</td>
                                        <td class="p-2">
                                            <div class="w-full bg-black/50 rounded-full h-1.5 mt-1">
                                                <div class="bg-blue-400 h-1.5 rounded-full" style="width: 25%"></div>
                                            </div>
                                        </td>
                                    </tr>
                                    <tr class="border-b border-white/5">
                                        <td class="p-2 font-bold text-white">مدير التسويق</td>
                                        <td class="p-2 font-mono text-fuchsia-300">20,000</td>
                                        <td class="p-2">3 سنوات</td>
                                        <td class="p-2">
                                            <div class="w-full bg-black/50 rounded-full h-1.5 mt-1">
                                                <div class="bg-blue-400 h-1.5 rounded-full" style="width: 60%"></div>
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <!-- Public Offering / Crowdfunding -->
                        <div class="p-6 rounded-2xl relative overflow-hidden group border border-emerald-500/30" style="background: rgba(255,255,255,0.02);">
                            <div class="absolute -left-10 -bottom-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-colors"></div>
                            
                            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
                                <div>
                                    <h3 class="text-white font-bold text-sm mb-2 flex items-center gap-2">
                                        <svg class="ic w-5 h-5 text-emerald-400" aria-hidden="true"><use href="#i-globe"/></svg>
                                        طرح عام مصغر (Crowdfunding)
                                    </h3>
                                    <p class="text-[10px] text-white/60">اطرح 15% من أسهمك للجمهور لجمع 630,000 ريال لتوسيع أعمالك.</p>
                                </div>
                                <div class="flex gap-2">
                                    <button class="btn btn--secondary !py-2 text-xs border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/20">
                                        توليد نشرة الإصدار
                                    </button>
                                    <button class="btn btn--primary !bg-emerald-600 hover:!bg-emerald-700 !py-2 text-xs border-0 text-white">
                                        بدء جولة التمويل
                                    </button>
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
