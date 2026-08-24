/**
 * قسم تعلم — مركز معرفة قصير (الأكاديمية العربية للتدريب / صناع الحياة / Bizplan)
 * ما دراسة الجدوى، المراحل، المصطلحات، نصائح الخبراء — أسئلة شائعة.
 */
import { FINANCIAL_TERMS } from '../utils/glossary.js';
import { EXPERT_FAQ } from '../config.js';

export class BeginnerGuideView {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.onStart = options.onStart || (() => {});
        this.onBack = options.onBack || (() => {});
    }

    render() {
        if (!this.container) return;

        const whatIsFeasibility = 'دراسة الجدوى هي أداة تحليلية لتقييم إمكانية تنفيذ مشروع من نواحٍ تسويقية، فنية، مالية، وقانونية. تهدف إلى الإجابة: هل المشروع مجدٍ؟ وما التوصية (المضي، المراجعة، أو عدم المضي)؟ المراحل الشائعة في الدورات: مبدئية، تسويقية، فنية، مالية، ثم مرحلة القرار.';

        const stages = [
            { label: 'المرحلة المبدئية', sentence: 'تحديد الفكرة والتحقق من إمكانية تنفيذها وجمع المعلومات الأولية.' },
            { label: 'المرحلة التسويقية', sentence: 'تحليل السوق والمنافسين والعرض والطلب واستراتيجية التسعير.' },
            { label: 'المرحلة الفنية', sentence: 'التكاليف الرأسمالية والتشغيلية والموارد البشرية والمعدات.' },
            { label: 'المرحلة المالية', sentence: 'مصادر الإيرادات والتمويل والافتراضات والمؤشرات (NPV, IRR، نقطة التعادل).' },
            { label: 'مرحلة القرار', sentence: 'التوصية النهائية: المضي، أو المراجعة، أو عدم المضي.' }
        ];

        const tips = [
            'لا تتخذ قرار الاستقالة أو الاستثمار الكبير قبل إكمال الدراسة — أفضل الممارسات المحلية (مركز تنمية).',
            'اجمع معلومات من السوق الحقيقي (زيارات، استبيانات، منافسون) قبل تثبيت الأرقام.',
            'لا تهمل رأس المال العامل: احسب 3–6 أشهر تشغيل قبل الاعتماد على الإيرادات.',
            'قدّر المبيعات بناءً على بيانات السوق وليس أمنيات — «كم ستبيع؟» يُجاب بأرقام مدروسة.',
            'راجع لوحة القرار وفحص الجودة (QA) قبل التصدير أو التقديم للممول.',
            'استخدم القوالب القطاعية الجاهزة كنقطة انطلاق ثم عدّل حسب مشروعك.'
        ];

        this.container.innerHTML = `
            <div class="beginner-guide-view animate-entry p-6 max-w-2xl mx-auto">
                <div class="flex items-center gap-3 mb-6">
                    <button type="button" id="btnBackGuide" class="btn btn--ghost btn--sm">← العودة</button>
                </div>
                <p class="text-xs text-muted mb-2 text-center">مركز معرفة قصير</p>
                <h1 class="text-2xl font-bold mb-2 text-center">دليل المبتدئ</h1>
                <p class="text-gold font-semibold text-center mb-8">تعلم ثم ابنِ — تعلم مراحل دراسة الجدوى ثم ابدأ بناء دراستك</p>

                <h2 class="text-lg font-bold mb-4 text-gold">ما دراسة الجدوى؟</h2>
                <p class="text-muted text-sm mb-6">${whatIsFeasibility}</p>

                <h2 class="text-lg font-bold mb-4 text-gold">مراحل الجدوى</h2>
                <ol class="space-y-6 mb-10" style="list-style: none; padding-right: 0;">
                    ${stages.map((s, i) => `
                        <li class="flex gap-4 items-start">
                            <span class="flex-shrink-0 w-8 h-8 rounded-full bg-gold/20 text-gold font-bold flex items-center justify-center">${i + 1}</span>
                            <div>
                                <h3 class="font-bold text-white mb-1">${s.label}</h3>
                                <p class="text-muted text-sm">${s.sentence}</p>
                            </div>
                        </li>
                    `).join('')}
                </ol>

                <h2 class="text-lg font-bold mb-4 text-gold">نصائح للمبتدئ</h2>
                <ul class="space-y-3 mb-10 text-sm text-muted" style="list-style: none; padding-right: 0;">
                    ${tips.map((t, i) => `
                        <li class="flex gap-3 items-start">
                            <span class="text-gold">•</span>
                            <span>${t}</span>
                        </li>
                    `).join('')}
                </ul>

                <h2 class="text-lg font-bold mb-4 text-gold">نصائح الخبراء — أسئلة شائعة</h2>
                <p class="text-muted text-sm mb-4">أسئلة شائعة مع إجابات قصيرة وواضحة:</p>
                <div class="space-y-4 mb-10">
                    ${(EXPERT_FAQ || []).map(f => `
                        <div class="p-3 rounded-lg border border-white/10 bg-white/5">
                            <p class="font-medium text-sm mb-1">${f.q}</p>
                            <p class="text-sm text-muted mb-0">${f.a}</p>
                        </div>
                    `).join('')}
                </div>

                <h2 class="text-lg font-bold mb-4 text-gold">كيف تقرأ لوحة القرار</h2>
                <p class="text-muted text-sm mb-4">لوحة القرار تعرض نتيجة الدراسة في شاشة واحدة:</p>
                <ul class="space-y-2 mb-6 text-sm text-muted" style="list-style: none; padding-right: 0;">
                    <li><strong class="text-gold">التوصية:</strong> المضي — المشروع مجدٍ؛ المراجعة — عدّل بعض الافتراضات؛ عدم المضي — غير مجدٍ في وضعه الحالي.</li>
                    <li><strong class="text-gold">المؤشرات:</strong> صافي القيمة الحالية (NPV)، معدل العائد (IRR)، فترة الاسترداد، نقطة التعادل — اقرأها مع التوصية.</li>
                    <li><strong class="text-gold">الخطوة التالية:</strong> إن كانت التوصية المضي يمكنك تصدير التقرير أو نسخة للممول؛ إن كانت المراجعة راجع التحذيرات وعدّل المدخلات ثم أعد الحساب.</li>
                </ul>

                <h2 class="text-lg font-bold mb-4 text-gold">المصطلحات</h2>
                <p class="text-muted text-sm mb-4">مصطلحات شائعة في دورات وورش دراسة الجدوى:</p>
                <dl class="space-y-3 mb-10 text-sm" style="padding-right: 0;">
                    ${['NPV', 'IRR', 'PAYBACK', 'BREAKEVEN', 'CAPEX', 'OPEX'].map(key => {
                        const t = FINANCIAL_TERMS[key];
                        if (!t) return '';
                        return `<dt class="font-bold text-gold">${t.term} (${t.abbr})</dt><dd class="text-muted mr-4 mb-2">${t.definition}</dd>`;
                    }).join('')}
                </dl>

                <div class="text-center">
                    <button type="button" id="btnStartStudy" class="btn btn--primary py-3 px-8 text-lg shadow-glow hover:scale-105 transition-transform">
                        ابدأ بناء دراستك
                    </button>
                </div>
            </div>
        `;

        this.container.querySelector('#btnBackGuide')?.addEventListener('click', () => this.onBack());
        this.container.querySelector('#btnStartStudy')?.addEventListener('click', () => this.onStart());
    }
}
