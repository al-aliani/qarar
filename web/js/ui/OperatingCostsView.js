/**
 * OperatingCostsView — «المصاريف التشغيلية» (دمج بصري)
 * ────────────────────────────────────────────────────────────────────────────
 * إعادة هيكلة تجربة المستخدم 2026-07-11: يجمع ثلاث خطوات نحيلة كانت منفصلة
 * (الموارد التقنية + اللوجستية + الإدارية) في شاشة واحدة بأكورديون، لأنها كلها
 * «دِلاء تكاليف تشغيلية».
 *
 * مبدأ السلامة (الأهم): هذا دمج **بصري فقط** — لا يلمس نموذج البيانات إطلاقاً.
 * كل جدول يبقى مخزّناً في قسمه الأصلي (techResources / logistics / administrative)
 * بنفس المسار الذي تقرأه المحركات المالية. نحقق ذلك بإعادة استخدام
 * Wizard.renderTable(section, tableKey, data) الموجودة أصلاً — وهي التي تعمل
 * الربط الصحيح للقراءة والكتابة والحفظ والاقتراح الذكي. فلا يشعر المحرّك بأي تغيير.
 *
 * التوقيع يطابق بقية المكوّنات المخصّصة + wizard كوسيط رابع لإعادة استخدام renderTable.
 */
export class OperatingCostsView {
    // الأقسام الثلاثة المدموجة — المفتاح هو معرّف القسم الأصلي (لا يتغيّر أبداً).
    static SECTIONS = [
        { section: 'techResources',  title: 'الموارد التقنية',   desc: 'برمجيات، اشتراكات، أنظمة، وأجهزة تشغيلية دورية.' },
        { section: 'logistics',      title: 'الموارد اللوجستية', desc: 'نقل، شحن، وتخزين — تؤثر في التكلفة ووقت التسليم.' },
        { section: 'administrative', title: 'المصاريف الإدارية', desc: 'إيجار المكتب، كهرباء، اتصالات، ومصاريف إدارية أخرى.' },
    ];

    constructor(containerId, store, onNavigate, wizard) {
        this.container = document.getElementById(containerId);
        this.store = store;
        this.onNavigate = onNavigate;
        this.wizard = wizard;      // لإعادة استخدام renderTable (الربط الأصلي بالمتجر)
        this.stepIndex = 0;
    }

    /**
     * توافق خلفي: بعض الدراسات القديمة تخزّن هذه الأقسام كمصفوفة مباشرة بدل
     * كائن { [section]: [...] } — نفس هجرة Wizard.renderStep. نضمن الشكل الكائني
     * قبل الرسم كي يقرأ getNestedValue(`section.section`) بشكل صحيح.
     */
    _ensureObjectShape() {
        const state = this.store.get();
        OperatingCostsView.SECTIONS.forEach(({ section }) => {
            const value = state?.[section];
            if (Array.isArray(value)) {
                this.store.update(section, { [section]: value });
            } else if (value == null) {
                this.store.update(section, { [section]: [] });
            }
        });
    }

    render(stepIndex) {
        if (typeof stepIndex === 'number') this.stepIndex = stepIndex;
        this._ensureObjectShape();

        const sectionsHtml = OperatingCostsView.SECTIONS.map(({ section, title, desc }, i) => `
            <details class="oc-section card" ${i === 0 ? 'open' : ''}>
                <summary class="oc-section__summary">
                    <span class="oc-section__title">${title}</span>
                    <span class="oc-section__desc">${desc}</span>
                </summary>
                <div class="oc-section__body">
                    <!-- المعرّف table-${section} هو ما تبحث عنه Wizard.renderTable لتركيب DynamicTable -->
                    <div id="table-${section}"></div>
                </div>
            </details>
        `).join('');

        this.container.innerHTML = `
            <div class="operating-costs-view animate-entry">
                <h2 class="section-title">المصاريف التشغيلية</h2>
                <p class="text-muted mb-4">كل ما ينفقه المشروع دورياً على التشغيل — مجمّع في مكان واحد
                    بدل ثلاث خطوات منفصلة. افتح كل قسم وأضف بنوده؛ يُحفظ كل بند في مكانه تلقائياً.</p>

                <div class="oc-sections">
                    ${sectionsHtml}
                </div>
                <!-- شريط التنقّل (السابق/التالي) يضيفه app.js عبر wizard.appendNav() بعد
                     الرسم — وهو المزوّد القانوني الذي يراعي stepIndexMap في كل الأوضاع.
                     فلا نرسمه هنا كي لا يُحذف ويُعاد (appendNav يزيل أي .wizard-nav سابق). -->
            </div>
        `;

        // تركيب الجداول الثلاثة عبر منطق المعالج نفسه — كل جدول يُكتب في قسمه الأصلي.
        const data = this.store.get();
        OperatingCostsView.SECTIONS.forEach(({ section }) => {
            // (section) يُستخدم كـ stepId وكـ tableKey معاً — فمسار القراءة/الكتابة
            // يصير `${section}.${section}` تماماً كما في الخطوات المنفصلة سابقاً.
            this.wizard.renderTable(section, section, data);
        });
    }
}
