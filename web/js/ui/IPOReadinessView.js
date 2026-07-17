/**
 * منصة التجهيز للاكتتاب العام (IPO Readiness) — شاشة مفاهيمية غير مبنية.
 * تعمّداً بلا أي نسبة جاهزية أو معلم "مكتمل" مُختلَق: تتبّع اكتتاب حقيقي يحتاج
 * (1) أرباحاً فعلية تاريخية + قيمة سوقية متداولة فعلية — لا يوجد لهما تمثيل في
 * schema.js بعد إزالة أداة متابعة الأداء الفعلي من الواجهة (state.actuals لا
 * يحمل اليوم سوى timelineCompletions)، و(2) معالم حوكمة مؤسسية (مراجع حسابات
 * خارجي، مجلس إدارة ولجنة مراجعة، مستشار مالي مرخص، ملف هيئة السوق المالية) لا
 * حقل واحد لها في نموذج بيانات الدراسة، و(3) ValuationAnalysis.js ينتج تقييم
 * DCF لمشروع لم يُطلق بعد، وهذا ليس قيمة سوقية متداولة فعلية. هذه الشاشة تبقى
 * غير موصولة بلوحة التحكم الحية إلى أن يُتخذ قرار عمل ببناء البيانات الناقصة.
 */
export class IPOReadinessView {
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
            <div class="ipo-readiness-view" style="max-width:760px;margin:0 auto;padding:var(--s-4) 0;">
                <button type="button" id="btnIpoReadinessBack" class="btn btn--ghost mb-4" style="display:inline-flex;align-items:center;gap:8px;">← العودة للوحة التحكم</button>

                <h2 class="section-title" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                    <svg class="ic" aria-hidden="true"><use href="#i-trophy"/></svg>
                    منصة التجهيز للاكتتاب العام (IPO Readiness)
                    <span class="badge badge--warning">مفهوم — قيد التطوير</span>
                </h2>
                <p class="text-muted mb-4">تتبّع جاهزية الاكتتاب يحتاج بيانات فعلية تاريخية لشركة عاملة، وهذا خارج نطاق ما يبنيه "قرار" اليوم.</p>

                <div class="alert alert--info mb-4">
                    <p><strong>هذه شاشة مفاهيمية فقط ولا تُحسب من بياناتك.</strong> "قرار" يبني دراسات جدوى لمشاريع لم تنطلق بعد، ولا يتابع نتائج فعلية بعد الإطلاق (أداة متابعة الأداء الفعلي أُزيلت من الواجهة سابقاً). جاهزية الاكتتاب الحقيقية على سوق "نمو" تحتاج ما لا يوجد له تمثيل في نموذج بيانات الدراسة حالياً:</p>
                    <ul class="mb-2">
                        <li>3 سنوات أرباح فعلية موثّقة، وقيمة سوقية متداولة فعلية تتجاوز 50 مليون ريال — أرقام تاريخية لشركة تعمل فعلياً، لا تقديرات دراسة جدوى قبل الإطلاق.</li>
                        <li>معالم حوكمة مؤسسية: تعيين مراجع حسابات خارجي معتمد، تشكيل مجلس إدارة ولجنة مراجعة، تعيين مستشار مالي مرخص، تقديم ملف الطرح لهيئة السوق المالية.</li>
                        <li>قيمة سوقية متداولة فعلية، بخلاف تقييم DCF/توقعات ما قبل الإطلاق الذي تنتجه أداة التقييم الحالية في الدراسة.</li>
                    </ul>
                    <p class="mb-0">لذلك لا تعرض هذه الشاشة نسبة جاهزية أو خانات "مكتملة" — أي رقم من هذا النوع هنا سيكون مختلَقاً وليس محسوباً.</p>
                </div>

                <div class="card glass-card">
                    <h3 class="card-title mb-2">ما الذي يلزم لبناء هذه الأداة فعلياً؟</h3>
                    <p class="text-sm mb-1">قرارات عمل مطلوبة قبل أي برمجة:</p>
                    <ul class="text-sm mb-0">
                        <li>إعادة تفعيل تتبّع الأداء الفعلي بعد الإطلاق (أرباح سنوية حقيقية، إيرادات فعلية).</li>
                        <li>بناء نموذج بيانات جديد لحوكمة الشركة (مراجع الحسابات، مجلس الإدارة، لجنة المراجعة، المستشار المالي، تقديم هيئة السوق المالية).</li>
                        <li>تأكيد أن جمهور "قرار" الحالي (مشاريع ما قبل الإطلاق) هو فعلاً الفئة المستهدفة لتتبع اكتتاب لاحق.</li>
                    </ul>
                </div>
            </div>
        `;

        this.container.querySelector('#btnIpoReadinessBack')?.addEventListener('click', () => {
            window.location.hash = '#/home';
        });

        return this.container;
    }
}
