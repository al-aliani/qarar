/**
 * مركز معرفة منظم (KPI-6.4)
 * مقالات قصيرة: ما هي الجدوى، المراحل، NPV، IRR، نقطة التعادل، فترة الاسترداد، إلخ.
 */
const ARTICLES = [
    {
        id: 'what-is-feasibility',
        title: 'ما هي دراسة الجدوى؟',
        icon: '📋',
        body: 'دراسة الجدوى تقييم منهجي لمشروع مقترح لتحديد ما إذا كان قابلاً للتنفيذ ومجدياً مالياً. تشمل عادة: الدراسة المبدئية، دراسة السوق، الدراسة الفنية (التكاليف والأصول)، الدراسة المالية (الإيرادات والتدفقات والمؤشرات)، وتحليل المخاطر. الهدف هو اتخاذ قرار استثماري صحيح (متابعة، تأجيل، أو تعديل المشروع).'
    },
    {
        id: 'stages',
        title: 'مراحل دراسة الجدوى',
        icon: '🔄',
        body: 'المراحل النموذجية: (1) الدراسة المبدئية — هل الفكرة مناسبة للبيئة والموارد؟ (2) الدراسة التسويقية — حجم السوق والمنافسون والتسعير. (3) الدراسة الفنية — الأصول، الموارد البشرية، التشغيل. (4) الدراسة المالية — قائمة الدخل، التدفق النقدي، التمويل. (5) تقييم المشروع والمخاطر — NPV، IRR، نقطة التعادل، والتوصية النهائية.'
    },
    {
        id: 'npv',
        title: 'صافي القيمة الحالية (NPV)',
        icon: '💰',
        body: 'NPV = مجموع التدفقات النقدية المستقبلية مخصوماً إلى اليوم مطروحاً منه الاستثمار الأولي. إذا كان NPV موجباً فإن المشروع يخلق قيمة (عائد أعلى من معدل الخصم). إذا كان سالباً فالمشروع لا يلبي تكلفة رأس المال. يُستخدم معدل الخصم عادةً قريباً من تكلفة التمويل أو العائد المطلوب.'
    },
    {
        id: 'irr',
        title: 'معدل العائد الداخلي (IRR)',
        icon: '📈',
        body: 'IRR هو معدل الخصم الذي يجعل صافي القيمة الحالية (NPV) مساوياً للصفر. بمعنى آخر: معدل العائد السنوي المتوقع على الاستثمار. يُقارن عادةً بمعدل الخصم أو تكلفة التمويل — إذا كان IRR أعلى منهما فالمشروع مقبول من ناحية العائد. المنصة تحسبه تلقائياً من التدفق النقدي.'
    },
    {
        id: 'payback',
        title: 'فترة الاسترداد (Payback)',
        icon: '⏱️',
        body: 'فترة الاسترداد هي عدد السنوات (أو الأشهر) حتى يسترد المشروع الاستثمار الأولي من التدفقات النقدية. كلما قلت الفترة كان المشروع أقل مجازفة من ناحية السيولة. لا تأخذ في الاعتبار القيمة الزمنية للنقود (بعكس NPV وIRR)، لكنها سهلة الفهم للمستثمرين والممولين.'
    },
    {
        id: 'breakeven',
        title: 'نقطة التعادل (Breakeven)',
        icon: '⚖️',
        body: 'نقطة التعادل هي مستوى المبيعات (وحدات أو إيرادات) الذي عنده إجمالي الإيرادات يساوي إجمالي التكاليف — أي لا ربح ولا خسارة. فوق هذه النقطة يتحقق ربح. تساعد في فهم الحد الأدنى من النشاط المطلوب لتغطية التكاليف الثابتة والمتغيرة.'
    },
    {
        id: 'tam-sam-som',
        title: 'TAM و SAM و SOM',
        icon: '🌐',
        body: 'TAM (Total Addressable Market): إجمالي السوق المتاح للمنتج/الخدمة. SAM (Serviceable Addressable Market): الجزء الذي يمكنك خدمته فعلياً. SOM (Serviceable Obtainable Market): الحصة التي تتوقع الحصول عليها في أفق زمني معقول. تُستخدم في تحليل السوق وتقدير الإيرادات المحتملة.'
    },
    {
        id: 'sensitivity',
        title: 'تحليل الحساسية واختبار الضغط',
        icon: '🔬',
        body: 'تحليل الحساسية يوضح كيف تتغير المؤشرات (مثل NPV أو هامش الربح) عند تغيير افتراض واحد (مثلاً الإيرادات أو التكاليف). اختبار الضغط يطبّق تغييرات سلبية (مثل -10% إيراد، +5% تكلفة) لقياس مرونة المشروع. يساعد في تحديد أبرز المخاطر واتخاذ قرار مريح.'
    }
];

export class KnowledgeCenterView {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.onBack = options.onBack || (() => {});
        this.expandedId = null;
    }

    async render() {
        if (!this.container) return;

        const listHtml = ARTICLES.map(a => {
            const isOpen = this.expandedId === a.id;
            return `
                <div class="knowledge-article card card-hover mb-3 overflow-hidden" data-id="${a.id}">
                    <button type="button" class="w-full text-right p-4 flex items-center gap-3 hover:bg-white/5 transition-colors" aria-expanded="${isOpen}">
                        <span class="text-2xl">${a.icon}</span>
                        <span class="flex-1 font-bold text-gold">${a.title}</span>
                        <span class="text-muted transform transition-transform ${isOpen ? 'rotate-180' : ''}">▼</span>
                    </button>
                    <div class="article-body px-4 pb-4 text-sm text-muted ${isOpen ? '' : 'hidden'} border-t border-white/10 pt-3">
                        ${a.body}
                    </div>
                </div>
            `;
        }).join('');

        this.container.innerHTML = `
            <div class="knowledge-center-view animate-entry p-6 max-w-3xl mx-auto" dir="rtl">
                <button type="button" class="btn btn--ghost mb-4" id="knowledgeCenterBack">← رجوع</button>
                <h1 class="text-2xl font-bold mb-2">مركز المعرفة</h1>
                <p class="text-muted mb-6">مصطلحات وشرح مختصر لمراحل ومؤشرات دراسة الجدوى.</p>

                <div class="space-y-0">
                    ${listHtml}
                </div>

                <p class="text-xs text-muted mt-6">للمزيد من المراحل والتطبيق العملي، راجع <strong>دليل المبتدئ</strong> و<strong>موارد وإرشاد</strong> من القائمة الرئيسية.</p>
            </div>
        `;

        this.container.querySelector('#knowledgeCenterBack')?.addEventListener('click', () => this.onBack());

        this.container.querySelectorAll('.knowledge-article').forEach(card => {
            const btn = card.querySelector('button');
            const body = card.querySelector('.article-body');
            const id = card.dataset.id;
            btn?.addEventListener('click', () => {
                const willOpen = this.expandedId !== id;
                this.expandedId = willOpen ? id : null;
                this.container.querySelectorAll('.knowledge-article').forEach(c => {
                    const b = c.querySelector('.article-body');
                    const arrow = c.querySelector('.text-muted.transform');
                    if (c.dataset.id === id) {
                        b?.classList.toggle('hidden', !willOpen);
                        arrow?.classList.toggle('rotate-180', willOpen);
                        c.querySelector('button')?.setAttribute('aria-expanded', willOpen);
                    } else {
                        b?.classList.add('hidden');
                        arrow?.classList.remove('rotate-180');
                        c.querySelector('button')?.setAttribute('aria-expanded', 'false');
                    }
                });
            });
        });
    }
}
