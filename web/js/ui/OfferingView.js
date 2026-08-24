import { toast } from '../utils/toast.js';
import { describeRevenueRampGap } from '../core/engine.js';
import { escapeHtml } from '../utils/escape.js';
import { generateNameIdeas } from '../services/InternalAIGenerator.js';
import { getSupabaseClient } from '../../supabaseClient.js';
import { SECTIONS } from '../core/schema.js';
import { stepIndexById } from '../core/wizardSteps.js';

// كلمات ربط عربية شائعة مستبعدة من مطابقة الاسم النصية أدناه — لا تحمل دلالة كافية.
// مُصدَّرة كي تُعيد TechnicalAssetsView.js استخدام نفس أسلوب المطابقة (تدقيق فجوة المعدات الشائعة)
// بدل نسخة مكرّرة تنحرف عنها لاحقاً.
export const OFFERING_MATCH_STOPWORDS = new Set(['في', 'من', 'إلى', 'على', 'أو', 'و', 'مع', 'عن', 'هذا', 'هذه', 'التي', 'الذي', 'ما', 'لا']);

export function normalizeOfferingWords(text) {
    return (text || '')
        .toString()
        .toLowerCase()
        .split(/[\s،,.\-_/]+/)
        .map(w => w.trim())
        .filter(w => w.length >= 2 && !OFFERING_MATCH_STOPWORDS.has(w));
}

/**
 * تدقيق تصميم (ميزة جديدة 2026-07): لا يوجد مفتاح ربط (FK) حقيقي بين products/
 * introServices وcustomerValues في schema.js — الأولان يُعرَّفان بحقل name فقط،
 * وcustomerValues (customerType/customerNeed/valueWeProvide) حقول نصية حرة لا
 * تشير لمعرّف منتج. المطابقة هنا استرشادية فقط (تداخل كلمة واحدة ≥ حرفين بين اسم
 * المنتج/الخدمة ونص أي صف قيمة عميل) — تنبيه استشاري لا قاعدة صارمة، وقد تُغفل
 * تطابقاً حقيقياً بصياغة مختلفة تماماً (توست غير معيق للتنقل، انظر _bindConsistencyCheck).
 * @param {object} state
 * @returns {string[]} أسماء المنتجات/الخدمات التي لم نجد لها قيمة عميل مطابقة نصياً
 */
export function findOfferingsWithoutCustomerValue(state) {
    const p = state?.projectInfo || {};
    const products = Array.isArray(p.products) ? p.products : [];
    const introServices = Array.isArray(p.introServices) ? p.introServices : [];
    const customerValues = Array.isArray(p.customerValues) ? p.customerValues : [];

    const offeringNames = [...products, ...introServices]
        .map(o => (o?.name || '').trim())
        .filter(Boolean);
    if (!offeringNames.length) return [];

    const cvWordSets = customerValues.map(cv => new Set(normalizeOfferingWords(
        `${cv?.customerType || ''} ${cv?.customerNeed || ''} ${cv?.valueWeProvide || ''}`
    )));

    return offeringNames.filter(name => {
        const nameWords = normalizeOfferingWords(name);
        if (!nameWords.length) return false;
        return !cvWordSets.some(cvWords => nameWords.some(w => cvWords.has(w)));
    });
}

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
        this._bindConsistencyCheck();
    }

    /**
     * زر «التالي» تضيفه Wizard.appendNav() بعد render() هذه الشاشة (انظر تعليق أعلى
     * الملف) — لا وجود له وقت render() لنربطه مباشرة، وappendNav يزيل .wizard-nav
     * ويعيد إدراجها في كل نداء. تفويض الحدث (delegation) على this.container (العنصر
     * نفسه لا يُستبدَل، فقط innerHTML الداخلي) يلتقط كل نقرة على #btnNextStep بصرف
     * النظر متى أُدرج الزر أو أُعيد إنشاؤه. مرة واحدة في المُنشئ فقط (لا render())
     * كي لا يتكرر الاستماع عبر زيارات متعددة لنفس النسخة المخزَّنة مؤقتاً (stepComponentRegistry).
     * استشاري بحت — لا نمنع التنقل، ولا نلمس أي مستمع آخر على نفس الزر.
     */
    _bindConsistencyCheck() {
        this.container?.addEventListener('click', (e) => {
            if (!e.target.closest?.('#btnNextStep')) return;
            const gaps = findOfferingsWithoutCustomerValue(this.store.get());
            if (gaps.length) {
                toast.warning(`لم نجد قيمة عميل واضحة لهذه المنتجات/الخدمات: ${gaps.join('، ')} — راجع جدول «القيمة للعميل» (لا يمنع هذا من المتابعة).`);
            }
        });
    }

    render(stepIndex) {
        if (typeof stepIndex === 'number') this.stepIndex = stepIndex;

        const data = this.store.get();
        // وجود خدمات في «تحليل الخدمات» يعني أن المحرّك يتجاهل صفوف revenue.streams
        // التشغيلية كلياً (revenue.js:38) — نعرض هنا قراءة فقط من services.items بدل
        // جدول قابل للتعديل يُهمَله المحرك صامتاً، ونوجّه التعديل الفعلي إلى مصدره.
        const hasServiceItems = Array.isArray(data?.services?.items) && data.services.items.length > 0;

        const offeringsHtml = OfferingView.OFFERINGS.map(({ table, title, desc }, i) => `
            <details class="oc-section card" ${i === 0 ? 'open' : ''}>
                <summary class="oc-section__summary">
                    <span class="oc-section__title">${title}</span>
                    <span class="oc-section__desc">${desc}</span>
                </summary>
                <div class="oc-section__body">
                    <div id="table-${table}"></div>
                    ${table !== 'customerValues' ? `<div id="image-stub-${table}" class="mt-3"></div>` : ''}
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
                ${hasServiceItems ? this._renderServicesMirrorTable(data.services.items) : `
                <div class="offer-revenue card">
                    <div id="revenue-shadow-warning"></div>
                    <div class="offer-revenue__bar">
                        <span class="offer-revenue__hint">أضف كل مصدر إيراد وكميته وسعره. المحرّك المالي يقرأ هذا الجدول مباشرة.</span>
                        <button type="button" id="btnImportOfferings" class="btn btn--sm btn--secondary">استورد منتجاتك وخدماتك كمصادر إيراد</button>
                    </div>
                    <div id="table-revenueStreams" class="mt-3"></div>
                    <p id="revenue-reconciliation-note" class="text-muted mt-2" style="font-size:.85em"></p>
                </div>
                `}

                <h3 class="offer-group__title">٣) اسم وهوية مقترحة (تجريبي)</h3>
                <div class="offer-naming card">
                    <p class="text-muted mb-2">أفكار اسم تجاري وفكرة شعار أولية — توليد داخلي استرشادي، لا يغني عن استشارة هوية بصرية احترافية قبل الاعتماد النهائي.</p>
                    <button type="button" id="btnSuggestNames" class="btn btn--sm btn--secondary">اقتراح أسماء</button>
                    <div id="nameIdeasResult" class="mt-3"></div>
                </div>
                <!-- شريط التنقّل يضيفه app.js عبر wizard.appendNav() بعد الرسم. -->
            </div>
        `;

        // تركيب الجداول الأربعة عبر منطق المعالج نفسه — كلٌّ يُحفظ في قسمه الأصلي.
        OfferingView.OFFERINGS.forEach(({ section, table }) => {
            this.wizard.renderTable(section, table, data);
            if (table !== 'customerValues') this._wireImageStubList(table);
        });
        if (!hasServiceItems) {
            // revenueStreams: stepId='revenue' → المسار revenue.streams (getTableDataPath)
            this.wizard.renderTable('revenue', 'revenueStreams', data);
            this._wireReconciliationNote();
            this._bindImport();
        } else {
            this.container.querySelector('#btnGoServiceAnalysis')?.addEventListener('click', () => {
                const idx = stepIndexById(SECTIONS.SERVICES);
                if (this.onNavigate && idx >= 0) this.onNavigate(idx);
            });
        }
        this._bindNameIdeas();
    }

    /**
     * قراءة فقط لمصادر الإيرادات حين توجد خدمات في services.items — النموذج المالي
     * يعتمد أسعار هذه الخدمات فعلياً (revenue.js يتجاهل صفوف revenue.streams التشغيلية
     * كلياً عند وجود خدمات، انظر revenue.js:38)، فنعرض هنا نفس ما يقرأه المحرّك بدل
     * جدول قابل للتعديل يُهمَله صامتاً، مع توجيه صريح لمكان التعديل الفعلي.
     */
    _renderServicesMirrorTable(items) {
        const rows = items.map(it => {
            const customersPerMonth = Number(it?.customersPerMonth) || 0;
            const price = Number(it?.pricePerUnit) || 0;
            return { name: it?.name || 'خدمة', customersPerMonth, price, year1: customersPerMonth * 12 * price };
        });
        const total = rows.reduce((sum, r) => sum + r.year1, 0);
        return `
            <div class="offer-revenue card">
                <p class="text-muted mb-2">لديك خدمات مُدخلة في «تحليل الخدمات» — النموذج المالي يعتمد أسعارها من هناك مباشرة، وهذا عرض للاطلاع فقط.</p>
                <div class="table-wrapper">
                    <table class="service-comparison-table">
                        <thead>
                            <tr>
                                <th>الخدمة</th>
                                <th>العملاء/شهر</th>
                                <th>السعر</th>
                                <th>الإيراد السنوي</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows.map(r => `
                                <tr>
                                    <td>${escapeHtml(r.name)}</td>
                                    <td class="text-mono">${r.customersPerMonth}</td>
                                    <td class="text-mono">${r.price}</td>
                                    <td class="text-mono">${r.year1.toLocaleString('ar-SA')}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colspan="3">الإجمالي</td>
                                <td class="text-mono">${total.toLocaleString('ar-SA')}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                <button type="button" id="btnGoServiceAnalysis" class="btn btn--sm btn--secondary mt-3">عدّل من تحليل الخدمات ←</button>
            </div>
        `;
    }

    /**
     * زر «توليد صورة أولية» لكل صف — لا مزوّد توليد صور مُهيّأ حالياً (يحتاج مفتاح
     * API خارجي). الحالة الصادقة الوحيدة الممكنة اليوم هي إعلان التعذّر عند الطلب
     * الفعلي، لا اختلاق صورة ولا تعليق دوّار لا ينتهي (نفس مبدأ unavailable() في
     * DataConnectors.js). يُعاد الرسم عند كل تغيير في الجدول عبر لفّ onChange، بنفس
     * أسلوب _wireReconciliationNote أعلاه.
     */
    _wireImageStubList(table) {
        const container = this.container.querySelector(`#image-stub-${table}`);
        if (!container) return;

        const render = () => {
            const state = this.store.get();
            const rows = Array.isArray(state?.projectInfo?.[table]) ? state.projectInfo[table] : [];
            if (!rows.length) { container.innerHTML = ''; return; }
            container.innerHTML = rows.map((row, i) => `
                <div class="image-stub-row" data-row="${i}">
                    <span class="text-muted" style="font-size:.85em">${escapeHtml(row?.name || `صف ${i + 1}`)}</span>
                    <button type="button" class="btn-xs btn-image-stub" data-row="${i}">توليد صورة أولية (تجريبي)</button>
                    <span class="image-stub-result" data-row="${i}" style="font-size:.85em"></span>
                </div>
            `).join('');
            container.querySelectorAll('.btn-image-stub').forEach(btn => {
                btn.addEventListener('click', () => {
                    const resultEl = container.querySelector(`.image-stub-result[data-row="${btn.dataset.row}"]`);
                    if (resultEl) resultEl.textContent = ' — غير متاح الآن: يتطلب مزوّد توليد صور (API) لم يُهيَّأ بعد.';
                });
            });
        };

        render();
        const tableInstance = this.wizard.tables?.[table];
        if (tableInstance) {
            const originalOnChange = tableInstance.onChange;
            tableInstance.onChange = (newData) => {
                originalOnChange(newData);
                render();
            };
        }
    }

    /**
     * اقتراح أسماء + فحص توفر إرشادي (نطاق .sa ومقابض تواصل) عبر Edge Function
     * وسيطة check-name-availability — لا مفتاح/سر في العميل، الفحص من الخادم
     * لتفادي CORS. لا نُخمّن توفراً عند تعذّر الاتصال، نُعلن التعذّر صراحة.
     */
    _bindNameIdeas() {
        const btn = this.container.querySelector('#btnSuggestNames');
        const resultEl = this.container.querySelector('#nameIdeasResult');
        if (!btn || !resultEl) return;

        btn.addEventListener('click', async () => {
            const state = this.store.get();
            const ideas = generateNameIdeas(state);
            resultEl.innerHTML = ideas.map((idea, i) => `
                <div class="name-idea-row" data-idx="${i}">
                    <strong>${escapeHtml(idea.name)}</strong>
                    <span class="text-muted" style="font-size:.85em"> — ${escapeHtml(idea.logoIdea)}</span>
                    <span class="name-idea-availability" data-idx="${i}" style="font-size:.85em"> (جارٍ فحص التوفر…)</span>
                </div>
            `).join('');

            const { supabase, ok } = await getSupabaseClient();
            if (!ok || !supabase) {
                resultEl.querySelectorAll('.name-idea-availability').forEach(el => {
                    el.textContent = ' — تعذّر فحص التوفر الآن.';
                });
                return;
            }

            try {
                const { data, error } = await supabase.functions.invoke('check-name-availability', {
                    body: { candidates: ideas.map(i => i.name) }
                });
                if (error || !data?.results) throw (error || new Error('no_results'));
                data.results.forEach((r, i) => {
                    const el = resultEl.querySelector(`.name-idea-availability[data-idx="${i}"]`);
                    if (!el) return;
                    if (r.checked === 'unsupported') {
                        el.textContent = ` — ${r.note}`;
                        return;
                    }
                    const label = (val, taken, avail) => val === null ? `${taken}: تعذّر` : (val ? `${taken}: ${avail}` : `${taken}: مأخوذ على الأرجح`);
                    const parts = [
                        label(r.domainAvailable, '.sa', 'متاح على الأرجح'),
                        label(r.instagramAvailable, 'إنستغرام', 'متاح'),
                        label(r.xAvailable, 'إكس', 'متاح')
                    ];
                    el.textContent = ` — ${parts.join(' · ')} (فحص إرشادي لا رسمي)`;
                });
            } catch (e) {
                resultEl.querySelectorAll('.name-idea-availability').forEach(el => {
                    el.textContent = ' — تعذّر فحص التوفر الآن.';
                });
                toast.warning('تعذّر الاتصال بخدمة فحص توفر الأسماء.');
            }
        });
    }

    /**
     * تدقيق اختبار عميل 2026-07-12: إجمالي جدول مصادر الإيرادات (بلا تصاعد) ورقم
     * «السنة الأولى» في القوائم المالية (بعد تطبيق فترة التصاعد rampUpMonths) رقمان
     * مختلفان بالتصميم — كانا يُقرآن خطأً كخلل حسابي (قفزة غير منطقية) عند تغيير
     * السعر. نعرض مطابقة صريحة بينهما بدل ترك المستخدم يقارن رقمين متباعدين بصمت.
     * نستخدم calculateRampFactorY1 المُصدَّرة (حساب صغير نقي) لا calculateStudy
     * الكاملة — تفادياً لتشغيل المحرك المالي على كل تعديل خلية.
     */
    _updateReconciliationNote() {
        const note = this.container.querySelector('#revenue-reconciliation-note');
        if (!note) return;
        const state = this.store.get();
        note.textContent = describeRevenueRampGap(state?.revenue?.streams, state?.assumptions?.rampUpMonths);
    }

    /** يربط تحديث ملاحظة المطابقة بكل تعديل في جدول الإيرادات دون لمس Wizard.renderTable العام. */
    _wireReconciliationNote() {
        const table = this.wizard.tables?.revenueStreams;
        if (!table) return;
        const originalOnChange = table.onChange;
        table.onChange = (newData) => {
            originalOnChange(newData);
            this._updateReconciliationNote();
        };
        this._updateReconciliationNote();
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
            this._wireReconciliationNote(); // renderTable ينشئ DynamicTable جديداً فيفقد الربط السابق
            toast.success(`أُضيف ${added} مصدر إيراد — أكمل الكميات والأسعار.`);
        });
    }
}
