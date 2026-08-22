export class GovTendersRadarView {
    constructor(containerOrId) {
        if (typeof containerOrId === 'string') {
            this.container = document.getElementById(containerOrId);
        } else {
            this.container = containerOrId;
        }
    }

    async render() {
        if (!this.container) return;

        const tenders = [
            { id: 'TND-2024-89', entity: 'وزارة الصحة', title: 'توريد إعاشة ومواد غذائية لمستشفيات المنطقة الشرقية', value: '2,500,000 ريال', daysLeft: 4, match: 95 },
            { id: 'TND-2024-102', entity: 'أمانة منطقة الرياض', title: 'عقد تشغيل مقهى في حديقة الملك سلمان', value: 'غير محدد', daysLeft: 12, match: 88 },
            { id: 'TND-2024-115', entity: 'جامعة الملك سعود', title: 'تأمين أجهزة تقنية وخدمات سحابية', value: '450,000 ريال', daysLeft: 2, match: 45 }
        ];

        this.container.innerHTML = `
            <div class="tenders-radar-view max-w-5xl mx-auto py-8 px-4 animate-entry">
                <!-- Header -->
                <div class="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-gradient-to-l from-emerald-600/10 to-transparent p-6 rounded-2xl border border-emerald-500/20">
                    <div>
                        <h2 class="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                            <svg class="ic w-6 h-6 text-emerald-500" aria-hidden="true"><use href="#i-briefcase"/></svg>
                            رادار المناقصات والعطاءات الحكومية
                        </h2>
                        <p class="text-white/60 text-sm">أمثلة توضيحية لشكل مناقصات متوافقة مع مشروعك — الربط الفعلي بمنصة اعتماد الحكومية غير متاح حالياً.</p>
                    </div>
                    <div class="flex items-center gap-3 bg-black/40 px-4 py-2 rounded-xl border border-white/5">
                        <div class="w-2 h-2 rounded-full bg-amber-500"></div>
                        <span class="text-xs text-white/80 font-bold">بيانات تجريبية (Demo)</span>
                    </div>
                </div>

                <!-- Stats & Sync -->
                <div class="flex justify-between items-center mb-6">
                    <div class="flex gap-4">
                        <select class="form-control text-xs bg-black/20 text-white border-white/10 w-40" disabled title="بيانات تجريبية — التصفية غير مفعّلة">
                            <option>تطابق عالي (>80%)</option>
                            <option>الكل</option>
                        </select>
                        <select class="form-control text-xs bg-black/20 text-white border-white/10 w-40" disabled title="بيانات تجريبية — التصفية غير مفعّلة">
                            <option>تنتهي قريباً</option>
                            <option>الأحدث</option>
                        </select>
                    </div>
                    <button class="text-emerald-400/50 text-xs flex items-center gap-1 cursor-not-allowed" disabled title="بيانات تجريبية — الربط الفعلي بمنصة اعتماد غير متاح حالياً">
                        <svg class="ic w-4 h-4" aria-hidden="true"><use href="#i-refresh-cw"/></svg> تحديث الرادار
                    </button>
                </div>

                <!-- Tenders List -->
                <div class="space-y-4">
                    ${tenders.map(t => `
                        <div class="p-5 rounded-2xl border ${t.match > 80 ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-white/5 bg-white/5'} hover:bg-white/10 transition-colors cursor-pointer group relative overflow-hidden">
                            ${t.match > 80 ? '<div class="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 blur-xl"></div>' : ''}
                            
                            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div class="flex-1">
                                    <div class="flex items-center gap-3 mb-2">
                                        <div class="text-[10px] bg-black/40 text-white/50 px-2 py-0.5 rounded border border-white/5 font-mono">${t.id}</div>
                                        <div class="text-xs font-bold text-white/80">${t.entity}</div>
                                    </div>
                                    <h3 class="text-white font-bold text-lg mb-2 group-hover:text-emerald-400 transition-colors">${t.title}</h3>
                                    <div class="flex gap-4 text-xs">
                                        <span class="text-white/50">القيمة التقديرية: <strong class="${t.value !== 'غير محدد' ? 'text-white' : 'text-white/30'}">${t.value}</strong></span>
                                        <span class="${t.daysLeft <= 3 ? 'text-red-400 font-bold' : 'text-yellow-400'} flex items-center gap-1">
                                            <svg class="ic w-3 h-3" aria-hidden="true"><use href="#i-clock"/></svg>
                                            ينتهي بعد ${t.daysLeft} أيام
                                        </span>
                                    </div>
                                </div>
                                
                                <div class="flex flex-col items-end gap-3 min-w-[150px]">
                                    <!-- Match Score -->
                                    <div class="flex items-center gap-2">
                                        <span class="text-[10px] text-white/50">نسبة التطابق</span>
                                        <div class="w-10 h-10 rounded-full border-2 ${t.match > 80 ? 'border-emerald-500 text-emerald-400' : 'border-slate-500 text-slate-400'} flex items-center justify-center text-xs font-bold bg-black/40">
                                            ${t.match}%
                                        </div>
                                    </div>
                                    <button class="btn btn--secondary w-full text-xs cursor-not-allowed opacity-60 flex items-center justify-center gap-2" disabled title="بيانات تجريبية — التوليد الآلي غير متاح حالياً">
                                        <svg class="ic w-4 h-4" aria-hidden="true"><use href="#i-file-text"/></svg>
                                        توليد عرض سعر آلي
                                    </button>
                                </div>
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
