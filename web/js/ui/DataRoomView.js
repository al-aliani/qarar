export class DataRoomView {
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
            <div class="data-room-view max-w-5xl mx-auto py-8 px-4 animate-entry">
                <!-- Header -->
                <div class="flex justify-between items-center mb-8 bg-gradient-to-l from-slate-500/10 to-transparent p-6 rounded-2xl border border-slate-500/20">
                    <div>
                        <h2 class="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                            <svg class="ic w-6 h-6 text-slate-400" aria-hidden="true"><use href="#i-lock"/></svg>
                            غرفة البيانات الافتراضية (Data Room)
                        </h2>
                        <p class="text-white/60 text-sm">مساحة سحابية مشفرة لمشاركة مستنداتك القانونية والمالية مع المستثمرين بأمان.</p>
                    </div>
                    <button class="btn btn--primary text-xs flex items-center gap-2">
                        <svg class="ic w-4 h-4" aria-hidden="true"><use href="#i-share"/></svg>
                        إنشاء رابط مشاركة للمستثمر
                    </button>
                </div>

                <!-- Folders / Files -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <!-- Folders Column -->
                    <div class="md:col-span-1 space-y-2">
                        <h3 class="text-white font-bold text-sm mb-4">المجلدات</h3>
                        
                        <div class="p-3 rounded-lg bg-white/10 border border-white/20 text-white flex items-center gap-3 cursor-pointer">
                            <svg class="ic w-5 h-5 text-yellow-400" aria-hidden="true"><use href="#i-folder"/></svg>
                            <span class="text-sm font-medium">المستندات القانونية</span>
                        </div>
                        <div class="p-3 rounded-lg hover:bg-white/5 border border-transparent text-white/70 flex items-center gap-3 cursor-pointer transition-colors">
                            <svg class="ic w-5 h-5 text-yellow-400/50" aria-hidden="true"><use href="#i-folder"/></svg>
                            <span class="text-sm font-medium">القوائم المالية المدققة</span>
                        </div>
                        <div class="p-3 rounded-lg hover:bg-white/5 border border-transparent text-white/70 flex items-center gap-3 cursor-pointer transition-colors">
                            <svg class="ic w-5 h-5 text-yellow-400/50" aria-hidden="true"><use href="#i-folder"/></svg>
                            <span class="text-sm font-medium">عروض الأسعار والفواتير</span>
                        </div>
                        
                        <button class="mt-4 w-full py-2 border border-dashed border-white/20 rounded-lg text-white/50 text-xs hover:bg-white/5 hover:text-white transition-colors flex items-center justify-center gap-2">
                            <svg class="ic w-4 h-4" aria-hidden="true"><use href="#i-plus"/></svg>
                            مجلد جديد
                        </button>
                    </div>
                    
                    <!-- Files Area -->
                    <div class="md:col-span-2 p-6 rounded-2xl" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);">
                        <div class="flex justify-between items-center mb-6">
                            <h3 class="text-white font-bold text-sm">محتويات: المستندات القانونية</h3>
                            <button class="btn btn--secondary text-xs !py-1.5"><svg class="ic w-3 h-3" aria-hidden="true"><use href="#i-upload"/></svg> رفع ملف</button>
                        </div>
                        
                        <div class="space-y-3">
                            <!-- File Item -->
                            <div class="flex items-center justify-between p-3 rounded-xl bg-black/20 hover:bg-white/5 transition-colors group cursor-pointer border border-white/5">
                                <div class="flex items-center gap-3">
                                    <div class="w-10 h-10 rounded bg-red-500/20 text-red-400 flex items-center justify-center shrink-0">
                                        <svg class="ic w-5 h-5" aria-hidden="true"><use href="#i-file-text"/></svg>
                                    </div>
                                    <div>
                                        <div class="text-white text-sm font-medium mb-0.5">السجل التجاري.pdf</div>
                                        <div class="text-[10px] text-white/40">1.2 MB • أضيف اليوم</div>
                                    </div>
                                </div>
                                <div class="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                    <button class="p-1.5 text-white/50 hover:text-white"><svg class="ic w-4 h-4" aria-hidden="true"><use href="#i-eye"/></svg></button>
                                    <button class="p-1.5 text-white/50 hover:text-red-400"><svg class="ic w-4 h-4" aria-hidden="true"><use href="#i-trash"/></svg></button>
                                </div>
                            </div>
                            
                            <!-- File Item -->
                            <div class="flex items-center justify-between p-3 rounded-xl bg-black/20 hover:bg-white/5 transition-colors group cursor-pointer border border-white/5">
                                <div class="flex items-center gap-3">
                                    <div class="w-10 h-10 rounded bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                                        <svg class="ic w-5 h-5" aria-hidden="true"><use href="#i-file-text"/></svg>
                                    </div>
                                    <div>
                                        <div class="text-white text-sm font-medium mb-0.5">عقد الشراكة_موقع.docx</div>
                                        <div class="text-[10px] text-white/40">2.4 MB • منذ أسبوع</div>
                                    </div>
                                </div>
                                <div class="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                    <button class="p-1.5 text-white/50 hover:text-white"><svg class="ic w-4 h-4" aria-hidden="true"><use href="#i-eye"/></svg></button>
                                    <button class="p-1.5 text-white/50 hover:text-red-400"><svg class="ic w-4 h-4" aria-hidden="true"><use href="#i-trash"/></svg></button>
                                </div>
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
