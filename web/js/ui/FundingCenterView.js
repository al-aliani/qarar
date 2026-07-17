export class FundingCenterView {
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
            <div class="funding-center-view max-w-5xl mx-auto py-8 px-4 animate-entry">
                <!-- Header -->
                <div class="flex justify-between items-center mb-8 bg-gradient-to-l from-yellow-500/10 to-transparent p-6 rounded-2xl border border-yellow-500/20">
                    <div>
                        <h2 class="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                            <svg class="ic w-6 h-6 text-yellow-400" aria-hidden="true"><use href="#i-trending-up"/></svg>
                            منصة التمويل وعرض المشاريع
                        </h2>
                        <p class="text-white/60 text-sm">اجذب المستثمرين بخطوات عملية، وحوّل دراستك إلى عرض استثماري (Pitch Deck) احترافي.</p>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    <!-- Progress Card -->
                    <div class="lg:col-span-1 p-6 rounded-2xl" style="background: linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01)); border: 1px solid rgba(255,255,255,0.08);">
                        <h3 class="text-white font-bold mb-4">مؤشر جاهزية التمويل</h3>
                        <div class="relative w-32 h-32 mx-auto mb-4 flex items-center justify-center">
                            <svg class="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                <path class="text-white/10" stroke-width="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                <path class="text-yellow-400" stroke-width="3" stroke-dasharray="75, 100" stroke-linecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                            </svg>
                            <div class="absolute inset-0 flex flex-col items-center justify-center">
                                <span class="text-2xl font-bold text-white">75%</span>
                            </div>
                        </div>
                        <ul class="text-sm text-white/60 space-y-2 mb-4">
                            <li class="flex items-center gap-2"><svg class="ic w-4 h-4 text-green-400" aria-hidden="true"><use href="#i-check"/></svg> العائد على الاستثمار +20%</li>
                            <li class="flex items-center gap-2"><svg class="ic w-4 h-4 text-green-400" aria-hidden="true"><use href="#i-check"/></svg> فترة الاسترداد أقل من 3 سنوات</li>
                            <li class="flex items-center gap-2"><svg class="ic w-4 h-4 text-red-400" aria-hidden="true"><use href="#i-x"/></svg> نموذج العمل بحاجة لتفصيل</li>
                        </ul>
                        <button class="btn btn--secondary w-full text-xs">تحسين دراسة الجدوى</button>
                    </div>

                    <!-- Pitch Deck & Funding Sources -->
                    <div class="lg:col-span-2 flex flex-col gap-6">
                        <!-- Pitch Deck Generator -->
                        <div class="p-6 rounded-2xl relative overflow-hidden" style="background: linear-gradient(135deg, rgba(30,58,138,0.3) 0%, rgba(15,23,42,0.9) 100%); border: 1px solid rgba(59,130,246,0.3);">
                            <div class="absolute -right-10 -top-10 w-40 h-40 bg-blue-500/20 blur-3xl rounded-full"></div>
                            <h3 class="text-white font-bold mb-2 flex items-center gap-2">
                                <svg class="ic w-5 h-5 text-blue-400" aria-hidden="true"><use href="#i-file-text"/></svg>
                                مولد العروض الاستثمارية (Pitch Deck)
                            </h3>
                            <p class="text-white/70 text-sm mb-6 max-w-md">نقوم آلياً باستخراج أهم الجوانب من دراستك (المشكلة، الحل، حجم السوق، التوقعات المالية) وتصديرها كملف تقديمي احترافي (PDF/PPTX) مخصص لعيون المستثمرين.</p>
                            
                            <div class="flex gap-3">
                                <button class="btn btn--primary flex items-center gap-2 btn-generate-pitch">
                                    <svg class="ic w-4 h-4" aria-hidden="true"><use href="#i-download"/></svg>
                                    توليد Pitch Deck الآن
                                </button>
                                <button class="btn btn--secondary flex items-center gap-2">
                                    <svg class="ic w-4 h-4" aria-hidden="true"><use href="#i-eye"/></svg>
                                    معاينة
                                </button>
                            </div>
                        </div>

                        <!-- Funding Directory -->
                        <div class="p-6 rounded-2xl" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);">
                            <div class="flex justify-between items-center mb-4">
                                <h3 class="text-white font-bold">دليل الجهات التمويلية المعتمدة</h3>
                                <button class="text-primary text-xs hover:underline">عرض الكل</button>
                            </div>
                            
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div class="p-4 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-colors cursor-pointer group">
                                    <h4 class="text-white font-bold text-sm mb-1 group-hover:text-primary transition-colors">صناديق الاستثمار الجريء (VCs)</h4>
                                    <p class="text-white/50 text-xs">للمشاريع التقنية وذات النمو المتسارع.</p>
                                </div>
                                <div class="p-4 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-colors cursor-pointer group">
                                    <h4 class="text-white font-bold text-sm mb-1 group-hover:text-primary transition-colors">البنوك التجارية وبنك التنمية</h4>
                                    <p class="text-white/50 text-xs">قروض ميسرة وتمويل للمنشآت الصغيرة والمتوسطة.</p>
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

        this.container.querySelector('.btn-generate-pitch')?.addEventListener('click', () => {
            import('sweetalert2').then(({ default: Swal }) => {
                Swal.fire({
                    title: 'جاري توليد العرض الاستثماري...',
                    html: `
                        <div class="flex flex-col items-center justify-center py-4">
                            <div class="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                            <p class="text-white/70 text-sm">يتم الآن تلخيص البيانات المالية وتركيب الشرائح...</p>
                        </div>
                    `,
                    background: 'rgba(30, 41, 59, 0.95)',
                    color: '#fff',
                    showConfirmButton: false,
                    allowOutsideClick: false,
                    customClass: { popup: 'backdrop-blur-xl border border-white/10 rounded-2xl' }
                });

                // Simulate processing
                setTimeout(() => {
                    Swal.fire({
                        icon: 'success',
                        title: 'تم التوليد بنجاح!',
                        text: 'تم حفظ العرض الاستثماري في مركز التنزيلات الخاص بك.',
                        background: 'rgba(30, 41, 59, 0.95)',
                        color: '#fff',
                        confirmButtonText: 'حسناً',
                        customClass: {
                            popup: 'backdrop-blur-xl border border-white/10 rounded-2xl',
                            confirmButton: 'btn btn--primary !px-6'
                        },
                        buttonsStyling: false
                    });
                }, 2500);
            });
        });

        return this.container;
    }
}
