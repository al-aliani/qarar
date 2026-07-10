import { toast } from '../utils/toast.js';

/**
 * OfferingView — «ماذا تبيع وبكم» (دمج بصري + ربط اقتصادي)
 * ────────────────────────────────────────────────────────────────────────────
 * إعادة هيكلة تجربة المستخدم 2026-07-11: يجمع «المنتجات + الخدمات + القيمة للعميل»
 * مع «مصادر الإيرادات» في شاشة واحدة، فيربط المستخدم ما يبيعه باقتصادياته في مكان
 * واحد بدل خطوتين متباعدتين (كانت خطوة 3 وخطوة 10).
 *
 * مبدأ السلامة الذهبي (كما في OperatingCostsView): دمج **بصري** لا يلمس نموذج
 * البيانات. كل جدول يبقى في قسمه الأصلي عبر إعادة استخدام Wizard.renderTable:
 *   • products/introServices/customerValues → projectInfo.<table>  (تحقّق حيّ)
 *   • revenueStreams                        → revenue.streams       (getRelativePath='streams')
 * فيقرأها المحرّك المالي (revenue.js يقرأ revenue.streams) بلا أي تغيير.
 *
 * الربط: زر «استورد كمصادر إيراد» يأخذ أسماء المنتجات/الخدمات ويضيف أي اسم غير
 * موجود كصفٍّ صالح للمخطط في جدول الإيرادات (بأرقام صفرية يملؤها المستخدم) — يوفّر
 * إعادة كتابة الأسماء، ولا يكسر عقد المحرّك لأن الصف يطابق أعمدة revenueStreams.
 */
export class OfferingView {
    // جداول «ما تبيعه» — كلها تحت قسم projectInfo (نفس ما تفعله خطوة projectDetails).
    static OFFERINGS = [
        { section: 'projectInfo', table: 'products',       title: 'المنتجات',        desc: 'ما تبيعه من سلع — النوع، الاسم، والخصائص الفريدة.' },
        { section: 'projectInfo', table: 'introServices',  title: 'الخدمات',          desc: 'ما تقدّمه من خدمات أساسية أو داعمة.' },
        { section: 'projectInfo', table: 'customerValues', title: 'القيمة للعميل',    desc: 'من عميلك، ماذا يحتاج، وما القيمة التي تحلّها له.' },
    ];

    // صف إيراد افتراضي مطابق لأعمدة مخطط revenueStreams (schema.js) — أرقام صفرية
    // يملؤها المستخدم؛ variableCostRate/growthRate بالقيم الافتراضية نفسها.
    static _revenueRow(name) {
        return { service: name, customersPerMonth: 0, avgPrice: 0, variableCostRate: 0.30, growthRate: 0.07 };
    }

    constructor(containerId, store, onNavigate, wizard) {
        this.container = document.getElementById(containerId);
        this.store = store;
        this.onNavigate = onNavigate;
        this.wizard = wizard;      // لإعادة استخدام renderTable (الربط الأصلي بالمتجر)
        this.stepIndex = 0;
    }

    render(stepIndex) {
        if (typeof stepIndex === 'number') this.stepIndex = stepIndex;

        const offeringsHtml = OfferingView.OFFERINGS.map(({ table, title, desc }, i) => `
            <details class="oc-section card" ${i === 0 ? 'open' : ''}>
                <summary class="oc-section__summary">
                    <span class="oc-section__title">${title}</span>
                    <span class="oc-section__desc">${desc}</span>
                </summary>
                <div class="oc-section__body">
                    <div id="table-${table}"></div>
                </div>
            </details>
        `).join('');

        this.container.innerHTML = `
            <div class="offering-view animate-entry">
                <h2 class="section-title">ماذا تبيع وبكم؟</h2>
                <p class="text-muted mb-4">عرّف ما يبيعه مشروعك أولاً، ثم حدّد كم يدرّ كل عرض من إيراد —
                    كلاهما في شاشة واحدة كي تربط المنتج باقتصادياته مباشرة.</p>

                <h3 class="offer-group__title">١) ما تبيعه</h3>
                <div class="oc-sections mb-4">
                    ${offeringsHtml}
                </div>

                <h3 class="offer-group__title">٢) بكم تبيعه — مصادر الإيرادات</h3>
                <div class="offer-revenue card">
                    <div class="offer-revenue__bar">
                        <span class="offer-revenue__hint">أضف كل مصدر إيراد وكميته وسعره. المحرّك المالي يقرأ هذا الجدول مباشرة.</span>
                        <button type="button" id="btnImportOfferings" class="btn btn--sm btn--secondary">استورد منتجاتك وخدماتك كمصادر إيراد</button>
                    </div>
                    <div id="table-revenueStreams" class="mt-3"></div>
                </div>
                <!-- شريط التنقّل يضيفه app.js عبر wizard.appendNav() بعد الرسم. -->
            </div>
        `;

        // تركيب الجداول الأربعة عبر منطق المعالج نفسه — كلٌّ يُحفظ في قسمه الأصلي.
        const data = this.store.get();
        OfferingView.OFFERINGS.forEach(({ section, table }) => {
            this.wizard.renderTable(section, table, data);
        });
        // revenueStreams: stepId='revenue' → المسار revenue.streams (getTableDataPath)
        this.wizard.renderTable('revenue', 'revenueStreams', data);

        this._bindImport();
    }

    _bindImport() {
        this.container.querySelector('#btnImportOfferings')?.addEventListener('click', () => {
            const state = this.store.get();
            const offerings = [
                ...(Array.isArray(state?.projectInfo?.products) ? state.projectInfo.products : []),
                ...(Array.isArray(state?.projectInfo?.introServices) ? state.projectInfo.introServices : []),
            ];
            const names = offerings.map(r => (r?.name || '').trim()).filter(Boolean);
            if (!names.length) {
                toast.info('أضف منتجاً أو خدمة (باسم) أولاً ليمكن استيرادها.');
                return;
            }

            const streams = Array.isArray(state?.revenue?.streams) ? [...state.revenue.streams] : [];
            const existing = new Set(streams.map(s => (s.service || '').trim()));
            let added = 0;
            names.forEach(name => {
                if (!existing.has(name)) {
                    streams.push(OfferingView._revenueRow(name));
                    existing.add(name);
                    added++;
                }
            });

            if (!added) {
                toast.info('كل منتجاتك وخدماتك مضافة أصلاً كمصادر إيراد.');
                return;
            }

            // كتابة عبر نفس مسار DynamicTable (revenue.streams) ثم إعادة رسم الجدول.
            this.store.updatePath('revenue', 'streams', streams);
            this.wizard.renderTable('revenue', 'revenueStreams', this.store.get());
            toast.success(`أُضيف ${added} مصدر إيراد — أكمل الكميات والأسعار.`);
        });
    }
}
