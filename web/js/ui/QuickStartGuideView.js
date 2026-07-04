/**
 * دليل سريع — كيف تنجز دراستك في 5–7 دقائق (منصات تعليمية — القسم 20)
 * خطوات 5–7 مع أوصاف واضحة؛ بدون فيديو (نص + أوصاف).
 */
export class QuickStartGuideView {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.onBack = options.onBack || (() => {});
        this.onStartQuick = options.onStartQuick || null;
        this.onStartFull = options.onStartFull || null;
    }

    render() {
        if (!this.container) return;

        const steps = [
            { num: 1, title: 'اختر نقطة البداية', desc: 'من لوحة التحكم: «ابدأ جدوى سريعة» لدراسة في 3 خطوات (حوالي 15 دقيقة)، أو «دراسة جديدة (كاملة)» لاستخدام القوالب القطاعية وإكمال كل الأقسام.' },
            { num: 2, title: 'أدخل بيانات المشروع', desc: 'اسم المشروع، القطاع، المدينة، وصف الفكرة. في الجدوى السريعة يكفي الاسم والقطاع وبضع أرقام أساسية.' },
            { num: 3, title: 'أكمل الإيرادات والتكاليف', desc: 'قدّر الإيراد المتوقع (شهري أو سنوي) والتكاليف التشغيلية والاستثمار الأولي. المنصة تقترح قيماً افتراضية حسب القطاع.' },
            { num: 4, title: 'راجع هيكل التمويل', desc: 'حدد مصادر التمويل (تمويل ذاتي، قرض، مستثمرون) والمبالغ. يمكنك ترك الافتراضات ثم تعديلها لاحقاً.' },
            { num: 5, title: 'اعرض لوحة القرار', desc: 'انتقل إلى «لوحة القرار» لرؤية التوصية (GO / REVISE / NO-GO) والمؤشرات: NPV، IRR، فترة الاسترداد، نقطة التعادل.' },
            { num: 6, title: 'صدّر التقرير أو النسخة للممول', desc: 'من قائمة التصدير اختر تقرير PDF، نسخة للممول، أو نسخة للمراجعة. اطبع كـ PDF من المتصفح إن احتجت ملف PDF.' },
            { num: 7, title: 'احفظ مشروعك', desc: 'احفظ الدراسة من لوحة القرار أو من القائمة لاستئناف التعديل لاحقاً. يمكنك أيضاً تصدير ملف المشروع (JSON) كنسخة احتياطية.' }
        ];

        this.container.innerHTML = `
            <div class="quick-start-guide-view animate-entry p-6 max-w-2xl mx-auto" dir="rtl">
                <button type="button" class="btn btn--ghost mb-4" id="quickStartGuideBack">← العودة</button>
                <h1 class="text-2xl font-bold mb-2">كيف تنجز دراستك في 5–7 دقائق</h1>
                <p class="text-muted mb-6">خطوات واضحة لإنهاء مسودة دراسة جدوى بسرعة — منصات تعليمية (أكاديميات، دورات).</p>

                <ol class="space-y-6 mb-10" style="list-style: none; padding-right: 0;">
                    ${steps.map((s) => `
                        <li class="flex gap-4 items-start">
                            <span class="flex-shrink-0 w-10 h-10 rounded-full bg-gold/30 text-gold font-bold flex items-center justify-center text-lg">${s.num}</span>
                            <div>
                                <h3 class="font-bold text-white mb-1">${s.title}</h3>
                                <p class="text-muted text-sm">${s.desc}</p>
                            </div>
                        </li>
                    `).join('')}
                </ol>

                <div class="flex flex-wrap gap-3 justify-center">
                    ${this.onStartQuick ? '<button type="button" class="btn btn--primary" id="quickStartGuideQuick">ابدأ مجاناً — جدوى سريعة</button>' : ''}
                    ${this.onStartFull ? '<button type="button" class="btn btn--secondary" id="quickStartGuideFull">دراسة جديدة (كاملة)</button>' : ''}
                </div>
            </div>
        `;

        this.container.querySelector('#quickStartGuideBack')?.addEventListener('click', () => this.onBack());
        this.container.querySelector('#quickStartGuideQuick')?.addEventListener('click', () => this.onStartQuick && this.onStartQuick());
        this.container.querySelector('#quickStartGuideFull')?.addEventListener('click', () => this.onStartFull && this.onStartFull());
    }
}
