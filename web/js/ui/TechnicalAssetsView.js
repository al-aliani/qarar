import { toast } from '../utils/toast.js';
import { escapeHtml } from '../utils/escape.js';
import { rateOrDefault } from '../core/engine.js';
import { generateEquipment } from '../services/InternalAIGenerator.js';
import { normalizeOfferingWords } from './OfferingView.js';
import { estimateMonthlyUtilityCost } from '../core/utilityBenchmarks.js';
import { miniEssentialTables, SECTIONS } from '../core/wizardSteps.js';
import { DATA_SOURCE_CATALOG } from '../services/DataConnectors.js';
import { DynamicTable } from './DynamicTable.js';

/**
 * متوسط/أدنى عروض أسعار حقيقية — يظهر فقط عند وجود عرضين فأكثر (عرض واحد لا يكفي
 * لمتوسط ذي معنى)، ويتجاهل صفوفاً بلا سعر رقمي موجب.
 * @param {Array<{price:*}>} quotes
 * @returns {{avg:number, min:number}|null}
 */
export function quoteStats(quotes) {
    const valid = (Array.isArray(quotes) ? quotes : [])
        .map(q => Number(q?.price))
        .filter(n => Number.isFinite(n) && n > 0);
    if (valid.length < 2) return null;
    return {
        avg: Math.round(valid.reduce((a, b) => a + b, 0) / valid.length),
        min: Math.round(Math.min(...valid))
    };
}

/**
 * حاسبة إيجار مقابل شراء نقية — إجمالي تكلفة الإيجار (قسط شهري × 12 × سنوات) مقابل
 * إجمالي تكلفة الشراء (السعر + كلفة تمويل تقريبية بفائدة بسيطة إن أُدخل معدل).
 * تُعيد null إن كان العمر الافتراضي صفراً أو غير موجب (لا معنى للمقارنة بلا مدة).
 * @returns {{buyTotal:number, leaseTotal:number, cheaper:'buy'|'lease'|'equal', savings:number, years:number}|null}
 */
export function calculateLeaseVsBuy({ price, usefulLifeYears, leaseMonthly, financingRatePercent = 0 }) {
    const p = Number(price) || 0;
    const years = Number(usefulLifeYears) || 0;
    const monthly = Number(leaseMonthly) || 0;
    const rate = Number(financingRatePercent) || 0;
    if (years <= 0) return null;

    const buyTotal = Math.round(p + p * (rate / 100) * years);
    const leaseTotal = Math.round(monthly * 12 * years);
    const diff = buyTotal - leaseTotal;
    const cheaper = diff === 0 ? 'equal' : (diff < 0 ? 'buy' : 'lease');
    return { buyTotal, leaseTotal, cheaper, savings: Math.abs(diff), years };
}

/**
 * فجوة المعدات الشائعة: يقارن أسماء معدات المستخدم الحالية بقائمة generateEquipment
 * النموذجية لنفس القطاع المكتشَف (نفس المولّد المستخدم لزر «اقتراح بنود» — لا قائمة
 * ثانية مخترعة). المطابقة بأسلوب OfferingView.findOfferingsWithoutCustomerValue نفسه
 * (تداخل كلمة واحدة ≥ حرفين) — استشاري بحت، لا يضيف صفوفاً تلقائياً.
 * @param {object} state
 * @returns {string[]} أسماء البنود النموذجية غير المُغطاة بالاسم في جدول المستخدم
 */
export function findMissingCommonEquipment(state) {
    const technical = state?.technical || {};
    const current = Array.isArray(technical.equipment) ? technical.equipment : [];
    const currentWordSets = current
        .map(r => (r?.name || '').trim())
        .filter(Boolean)
        .map(name => new Set(normalizeOfferingWords(name)));

    const typical = generateEquipment(state) || [];
    const seen = new Set();
    const missing = [];
    typical.forEach(item => {
        const name = (item?.name || '').trim();
        if (!name || seen.has(name)) return;
        const words = normalizeOfferingWords(name);
        if (!words.length) return;
        const covered = currentWordSets.some(cw => words.some(w => cw.has(w)));
        if (!covered) { missing.push(name); seen.add(name); }
    });
    return missing;
}

/**
 * جدول صيانة/إحلال تخطيطي: يعيد استخدام نفس معادلة العمر الافتراضي المستخدَمة فعلياً
 * في engine.js (life = round(1/rate)، عبر rateOrDefault المُصدَّرة من هناك — بلا
 * إعادة تنفيذ منطق مختلف) على establishmentCosts/equipment/furniture. establishmentCosts
 * تُعرَض كـ«انتهاء إطفاء» (قد يحتاج تجديداً كالديكورات) لا «إحلال» لأنها ليست معدات
 * فعلية تُشترى مجدداً بالضرورة؛ equipment/furniture تُعرَض كـ«إحلال متوقع» مطابقةً
 * لفئتي checkReplacement في المحرك (لا techResources هنا — خارج نطاق خطوة التقنية).
 * أول استحقاق = life + 1 (نفس شرط المحرك: (i-1) % life === 0 && i > 1 ⇒ أول تطابق i=life+1).
 * @param {object} state
 * @returns {Array<{name:string, categoryLabel:string, kind:string, life:number, firstDueYear:number}>}
 */
export function buildMaintenanceSchedule(state) {
    const technical = state?.technical || {};
    const categories = [
        { key: 'establishmentCosts', rateField: 'amortizationRate', defaultRate: 0.20, kind: 'انتهاء إطفاء (تجديد محتمل)', categoryLabel: 'نفقات تأسيس' },
        { key: 'equipment', rateField: 'depreciationRate', defaultRate: 0.15, kind: 'إحلال متوقع', categoryLabel: 'معدات' },
        { key: 'furniture', rateField: 'depreciationRate', defaultRate: 0.20, kind: 'إحلال متوقع', categoryLabel: 'أثاث' }
    ];

    const schedule = [];
    categories.forEach(({ key, rateField, defaultRate, kind, categoryLabel }) => {
        const rows = Array.isArray(technical[key]) ? technical[key] : [];
        rows.forEach((row, i) => {
            const name = (row?.name || '').trim() || `بند ${i + 1}`;
            const rate = rateOrDefault(row?.[rateField], defaultRate);
            const life = rate > 0 ? Math.round(1 / rate) : 0;
            if (life <= 0) return;
            schedule.push({ name, categoryLabel, kind, life, firstDueYear: life + 1 });
        });
    });

    return schedule.sort((a, b) => a.firstDueYear - b.firstDueYear);
}

/**
 * TechnicalAssetsView — «الأصول والتجهيزات» (دمج بصري + أدوات مساندة)
 * ────────────────────────────────────────────────────────────────────────────
 * قبل هذه الشاشة، خطوة SECTIONS.TECHNICAL كانت تُرسم بالمسار العام (Wizard.renderStep)
 * بلا مكوّن مخصّص. هذه الشاشة تضيف فوق نفس الجداول السبعة أدوات مساندة (عروض أسعار
 * حقيقية، حاسبة إيجار/شراء، فجوة معدات شائعة، تقدير مرافق، جدول صيانة) دون أي تغيير
 * في نموذج البيانات الأصلي — كل جدول يبقى في technical.<table> كما هو (نفس مبدأ
 * OfferingView/OperatingCostsView: دمج بصري فقط عبر إعادة استخدام Wizard.renderTable).
 *
 * عروض الأسعار الحقيقية (عروض المعدات) حقل إضافي بحت (row.quotes) فوق صفوف equipment
 * الموجودة — لا DynamicTable لا يعرض مصفوفات متداخلة كعمود، فتُعرض هذه العروض في لوحة
 * فرعية منفصلة (details) أسفل الجدول بدل عمود. لأن renderTable يُنشئ DynamicTable جديداً
 * في كل استدعاء (فيفقد أي onChange مُغلَّف سابقاً)، كل تعديل على row.quotes يُعاد بعده
 * استدعاء renderTable + إعادة لفّ onChange — وإلا فإن أول تعديل خلية لاحق في الجدول
 * سيكتب نسخة this.data القديمة (بلا العروض المُضافة للتو) فوق المخزن ويمحوها بصمت.
 *
 * عروض الإيجار الحقيقية لتقييم الموقع لا تُنسَب لصفٍّ بعينه في locationAssessment —
 * صفوف ذلك الجدول معايير تقييم (الكثافة السكانية، القرب من العملاء...) لا عقارات
 * مرشَّحة، فربط «عرض إيجار» بمعيار تقييم لا معنى له. لذا تُخزَّن كقائمة واحدة مستقلة
 * (technical.locationListings) تمثّل عروض الإيجار الحقيقية لقرار الموقع ككل.
 */
export class TechnicalAssetsView {
    static TABLES = ['establishmentCosts', 'capacityModel', 'capacityUtilization', 'buildings', 'equipment', 'furniture', 'locationAssessment'];

    static TABLE_META = {
        establishmentCosts: { title: 'نفقات التأسيس', desc: 'تكاليف تُدفع مرة واحدة وتُطفأ على سنوات (دراسات، تراخيص، ديكورات).' },
        capacityModel: { title: 'الطاقة القصوى', desc: 'سقف مادي للمبيعات (مقاعد/وحدات × دورات × أيام تشغيل).' },
        capacityUtilization: { title: 'تدرج الطاقة الإنتاجية', desc: 'نسبة استخدام الطاقة القصوى لكل سنة تشغيل.' },
        buildings: { title: 'المباني والإنشاءات', desc: 'تشطيب، سباكة، كهرباء، وإنشاءات ثابتة.' },
        equipment: { title: 'المعدات والأجهزة', desc: 'كل معدة تشغيلية — أضف عروض أسعار حقيقية لكل بند أدناه.' },
        furniture: { title: 'الأثاث والتجهيزات', desc: 'أثاث العملاء والموظفين.' },
        locationAssessment: { title: 'تقييم واختيار الموقع', desc: 'تقييم موزون لمعايير الموقع + عروض إيجار حقيقية أدناه.' }
    };

    constructor(containerId, store, onNavigate, wizard) {
        this.container = document.getElementById(containerId);
        this.store = store;
        this.onNavigate = onNavigate;
        this.wizard = wizard; // لإعادة استخدام renderTable (الربط الأصلي بالمتجر)
        this.stepIndex = 0;
    }

    render(stepIndex) {
        if (typeof stepIndex === 'number') this.stepIndex = stepIndex;
        const state = this.store.get();
        const mode = state?.appSettings?.mode || 'advanced';
        // وضع «مصغّر»: نفس التقصير الذي يطبّقه Wizard.renderStep عادة (establishmentCosts/
        // equipment/furniture فقط) — بلا هذا الفلتر كانت شاشتنا المخصّصة ستُظهر كل
        // الجداول السبعة حتى في الوضع المصغّر، فتُلغي تقصيراً كان يعمل فعلياً قبل هذه الشاشة.
        const essential = mode === 'mini' ? miniEssentialTables(SECTIONS.TECHNICAL) : null;
        const visibleTables = essential || TechnicalAssetsView.TABLES;

        const tablesHtml = visibleTables.map((table, i) => {
            const meta = TechnicalAssetsView.TABLE_META[table] || { title: table, desc: '' };
            const extraPanels = table === 'equipment'
                ? `<div id="equipment-quotes-panel"></div><div id="equipment-gap-alert"></div>`
                : (table === 'locationAssessment' ? `<div id="location-listings-panel"></div>` : '');
            return `
                <details class="oc-section card" ${i === 0 ? 'open' : ''}>
                    <summary class="oc-section__summary">
                        <span class="oc-section__title">${escapeHtml(meta.title)}</span>
                        <span class="oc-section__desc">${escapeHtml(meta.desc)}</span>
                    </summary>
                    <div class="oc-section__body">
                        <div id="table-${table}"></div>
                        ${extraPanels}
                    </div>
                </details>
            `;
        }).join('');

        this.container.innerHTML = `
            <div class="technical-assets-view animate-entry">
                <h2 class="section-title">الأصول والتجهيزات</h2>
                <p class="text-muted mb-4">جهّز أصول التأسيس والتشغيل، وتحقّق منها بعروض أسعار حقيقية بدل تقديرات مولَّدة فقط.</p>

                <h3 class="offer-group__title">١) الجداول</h3>
                <div class="oc-sections mb-4">
                    ${tablesHtml}
                </div>

                <h3 class="offer-group__title">٢) أدوات مساندة</h3>
                <div class="card mb-3">
                    <h4 class="card-title">حاسبة الإيجار مقابل الشراء</h4>
                    <p class="text-muted text-sm mb-2">حاسبة مستقلة — أدخل أي معدة (من الجدول أعلاه أو غيرها) لمقارنة تكلفة استئجارها بشرائها على مدى عمرها الافتراضي.</p>
                    <div class="flex gap-2 flex-wrap mb-2">
                        <label class="text-sm" style="flex:1; min-width:150px;">سعر الشراء (ريال)
                            <input type="text" inputmode="decimal" id="leaseCalcPrice" class="input input--sm" placeholder="0">
                        </label>
                        <label class="text-sm" style="flex:1; min-width:150px;">العمر الافتراضي (سنوات)
                            <input type="text" inputmode="decimal" id="leaseCalcYears" class="input input--sm" placeholder="5">
                        </label>
                        <label class="text-sm" style="flex:1; min-width:150px;">القسط الشهري للإيجار (ريال)
                            <input type="text" inputmode="decimal" id="leaseCalcMonthly" class="input input--sm" placeholder="0">
                        </label>
                        <label class="text-sm" style="flex:1; min-width:150px;">معدل تمويل سنوي تقريبي % (اختياري)
                            <input type="text" inputmode="decimal" id="leaseCalcFinanceRate" class="input input--sm" placeholder="0">
                        </label>
                    </div>
                    <button type="button" class="btn btn--sm btn--secondary" id="btnCalcLeaseVsBuy">احسب</button>
                    <div id="leaseVsBuyResult" class="mt-2"></div>
                </div>
                <div id="utility-estimate-panel"></div>
                <div id="maintenance-schedule-panel"></div>
            </div>
        `;

        // تركيب الجداول عبر منطق المعالج نفسه — كل جدول يبقى في قسمه الأصلي (technical.<table>).
        visibleTables.forEach(table => this.wizard.renderTable('technical', table, state));

        if (visibleTables.includes('equipment')) {
            this._wireEquipmentTableOnChange();
            this._renderEquipmentQuotes();
            this._renderGapAlert();
        }
        if (visibleTables.includes('locationAssessment')) {
            this._renderLocationListings();
        }
        this._bindLeaseCalculator();
        this._renderUtilityEstimate();
        this._renderMaintenanceSchedule();
    }

    // ─── Task 1: عروض أسعار حقيقية للمعدات ─────────────────────────────────

    _renderEquipmentQuotes() {
        const container = this.container.querySelector('#equipment-quotes-panel');
        if (!container) return;
        const state = this.store.get();
        const rows = Array.isArray(state?.technical?.equipment) ? state.technical.equipment : [];
        if (!rows.length) { container.innerHTML = ''; return; }

        container.innerHTML = `
            <div class="card mt-3">
                <h4 class="card-title">عروض أسعار حقيقية</h4>
                <p class="text-muted text-sm mb-2">أضف عرض سعر حقيقياً حصلت عليه فعلاً لكل بند (لا تقديراً) — يظهر المتوسط والأدنى تلقائياً بعد عرضين فأكثر.</p>
                ${rows.map((row, i) => this._renderQuoteRow(row, i)).join('')}
            </div>
        `;
        this._bindEquipmentQuoteEvents();
    }

    _renderQuoteRow(row, i) {
        const quotes = Array.isArray(row?.quotes) ? row.quotes : [];
        const stats = quoteStats(quotes);
        const label = escapeHtml(row?.name || `بند ${i + 1}`);
        const countLabel = quotes.length ? `${quotes.length} ${quotes.length === 1 ? 'عرض' : 'عروض'}` : 'لا عروض بعد';
        const statsLabel = stats ? ` · المتوسط ${stats.avg.toLocaleString('ar-SA')} ريال · الأدنى ${stats.min.toLocaleString('ar-SA')} ريال` : '';

        return `
            <details class="quote-row" data-row="${i}">
                <summary>${label} — ${countLabel}${statsLabel}</summary>
                <div class="quote-row__body">
                    ${quotes.map((q, qi) => `
                        <div class="flex items-center gap-2 flex-wrap quote-item">
                            <span>${escapeHtml(q?.source || 'مصدر غير محدد')}</span>
                            <span>${(Number(q?.price) || 0).toLocaleString('ar-SA')} ريال</span>
                            ${q?.url ? `<a href="${escapeHtml(q.url)}" target="_blank" rel="noopener noreferrer">الرابط</a>` : ''}
                            <span class="text-muted">${escapeHtml(q?.date || '')}</span>
                            <button type="button" class="btn-xs btn-remove-quote" data-row="${i}" data-qidx="${qi}">حذف</button>
                        </div>
                    `).join('')}
                    <div class="flex items-center gap-2 flex-wrap mt-2 quote-add-form" data-row="${i}">
                        <input type="text" class="input input--sm quote-input" data-field="source" data-row="${i}" placeholder="المورد/المتجر">
                        <input type="text" inputmode="decimal" class="input input--sm quote-input" data-field="price" data-row="${i}" placeholder="السعر">
                        <input type="text" class="input input--sm quote-input" data-field="url" data-row="${i}" placeholder="رابط العرض (اختياري)">
                        <input type="date" class="input input--sm quote-input" data-field="date" data-row="${i}">
                        <button type="button" class="btn btn--sm btn--secondary btn-add-quote" data-row="${i}">+ إضافة عرض</button>
                    </div>
                </div>
            </details>
        `;
    }

    _bindEquipmentQuoteEvents() {
        const container = this.container.querySelector('#equipment-quotes-panel');
        if (!container) return;
        container.querySelectorAll('.btn-add-quote').forEach(btn => {
            btn.addEventListener('click', () => this._addEquipmentQuote(parseInt(btn.dataset.row, 10)));
        });
        container.querySelectorAll('.btn-remove-quote').forEach(btn => {
            btn.addEventListener('click', () => this._removeEquipmentQuote(parseInt(btn.dataset.row, 10), parseInt(btn.dataset.qidx, 10)));
        });
    }

    _addEquipmentQuote(rowIndex) {
        const container = this.container.querySelector('#equipment-quotes-panel');
        const form = container?.querySelector(`.quote-add-form[data-row="${rowIndex}"]`);
        if (!form) return;
        const source = form.querySelector('[data-field="source"]')?.value.trim() || '';
        const priceRaw = form.querySelector('[data-field="price"]')?.value || '';
        const url = form.querySelector('[data-field="url"]')?.value.trim() || '';
        const date = form.querySelector('[data-field="date"]')?.value || '';
        const price = DynamicTable.parseLenientNumber(priceRaw) || 0;

        if (!source || price <= 0) {
            toast.info('أدخل اسم المورد وسعراً أكبر من صفر لإضافة عرض.');
            return;
        }

        const state = this.store.get();
        const rows = Array.isArray(state?.technical?.equipment) ? [...state.technical.equipment] : [];
        if (!rows[rowIndex]) return;
        const quotes = Array.isArray(rows[rowIndex].quotes) ? [...rows[rowIndex].quotes] : [];
        quotes.push({ source, price, url, date });
        rows[rowIndex] = { ...rows[rowIndex], quotes };
        this.store.updatePath('technical', 'equipment', rows);
        this._refreshEquipmentTable();
        toast.success('أُضيف عرض السعر.');
    }

    _removeEquipmentQuote(rowIndex, quoteIndex) {
        const state = this.store.get();
        const rows = Array.isArray(state?.technical?.equipment) ? [...state.technical.equipment] : [];
        if (!rows[rowIndex]) return;
        const quotes = (Array.isArray(rows[rowIndex].quotes) ? rows[rowIndex].quotes : []).filter((_, i) => i !== quoteIndex);
        rows[rowIndex] = { ...rows[rowIndex], quotes };
        this.store.updatePath('technical', 'equipment', rows);
        this._refreshEquipmentTable();
    }

    /**
     * يعيد رسم DynamicTable الخاص بـequipment كي تلتقط نسخته الداخلية (this.data) عروض
     * الأسعار المُضافة للتو عبر store.updatePath مباشرة — وإلا فإن تعديل خلية لاحق في
     * الجدول (onChange يكتب this.data القديم فوق المخزن) يمحو تلك العروض بصمت.
     */
    _refreshEquipmentTable() {
        this.wizard.renderTable('technical', 'equipment', this.store.get());
        this._wireEquipmentTableOnChange();
        this._renderEquipmentQuotes();
        this._renderGapAlert();
    }

    /** يربط إعادة رسم لوحتَي العروض/الفجوة بأي تعديل مباشر في جدول equipment (إضافة/حذف/تعديل صف). */
    _wireEquipmentTableOnChange() {
        const table = this.wizard.tables?.equipment;
        if (!table) return;
        const originalOnChange = table.onChange;
        table.onChange = (newData) => {
            originalOnChange(newData);
            this._renderEquipmentQuotes();
            this._renderGapAlert();
        };
    }

    // ─── Task 4: تنبيه فجوة المعدات الشائعة ─────────────────────────────────

    _renderGapAlert() {
        const container = this.container.querySelector('#equipment-gap-alert');
        if (!container) return;
        const missing = findMissingCommonEquipment(this.store.get());
        if (!missing.length) { container.innerHTML = ''; return; }
        container.innerHTML = `
            <div class="alert alert--info mt-3">
                عناصر شائعة لمشاريع مشابهة لم تُدرَج بعد: ${missing.map(escapeHtml).join('، ')} — استرشادي فقط، لا يضيف صفوفاً تلقائياً.
            </div>
        `;
    }

    // ─── Task 2: حاسبة الإيجار مقابل الشراء ─────────────────────────────────

    _bindLeaseCalculator() {
        const btn = this.container.querySelector('#btnCalcLeaseVsBuy');
        const resultEl = this.container.querySelector('#leaseVsBuyResult');
        if (!btn || !resultEl) return;

        btn.addEventListener('click', () => {
            const price = DynamicTable.parseLenientNumber(this.container.querySelector('#leaseCalcPrice')?.value) || 0;
            const years = DynamicTable.parseLenientNumber(this.container.querySelector('#leaseCalcYears')?.value) || 0;
            const leaseMonthly = DynamicTable.parseLenientNumber(this.container.querySelector('#leaseCalcMonthly')?.value) || 0;
            const financingRatePercent = DynamicTable.parseLenientNumber(this.container.querySelector('#leaseCalcFinanceRate')?.value) || 0;

            const result = calculateLeaseVsBuy({ price, usefulLifeYears: years, leaseMonthly, financingRatePercent });
            if (!result) {
                resultEl.innerHTML = `<p class="text-muted">أدخل عمراً افتراضياً أكبر من صفر.</p>`;
                return;
            }
            const verdict = result.cheaper === 'equal'
                ? 'التكلفتان متعادلتان تقريباً.'
                : `${result.cheaper === 'buy' ? 'الشراء' : 'الإيجار'} أوفر بحوالي ${result.savings.toLocaleString('ar-SA')} ريال على مدى ${result.years} ${result.years === 1 ? 'سنة' : 'سنوات'}.`;
            resultEl.innerHTML = `
                <p>إجمالي تكلفة الشراء: <strong>${result.buyTotal.toLocaleString('ar-SA')}</strong> ريال</p>
                <p>إجمالي تكلفة الإيجار: <strong>${result.leaseTotal.toLocaleString('ar-SA')}</strong> ريال</p>
                <p>${verdict}</p>
            `;
        });
    }

    // ─── Task 3: عروض إيجار حقيقية لتقييم الموقع + رابط بحث ذكي ─────────────

    _renderLocationListings() {
        const container = this.container.querySelector('#location-listings-panel');
        if (!container) return;
        const state = this.store.get();
        const listings = Array.isArray(state?.technical?.locationListings) ? state.technical.locationListings : [];
        const city = (state?.projectInfo?.city || '').trim();
        // نمط رابط aqar.fm المؤكَّد من صفحاته الفعلية: /{تصنيف}/{مدينة عربية} — نستخدم
        // تصنيف «مكتب تجاري للإيجار» كتقريب عام لعقار تجاري؛ بلا مدينة نكتفي بالصفحة الرئيسية.
        const aqarUrl = city
            ? `https://sa.aqar.fm/مكتب-تجاري-للإيجار/${encodeURIComponent(city)}`
            : 'https://sa.aqar.fm/';
        // إيجار (ejar.sa) منصة تنظيم عقود لا محرك بحث عن عقارات — رابط الصفحة الرئيسية
        // من كتالوج DataConnectors نفسه (مصدر واحد) بدل نسخ الرابط هنا مجدداً.
        const ejarUrl = DATA_SOURCE_CATALOG.find(s => s.id === 'ejar-platform')?.url || 'https://www.ejar.sa/en';
        const stats = quoteStats(listings);

        container.innerHTML = `
            <div class="card mt-3">
                <h4 class="card-title">عروض إيجار حقيقية للموقع</h4>
                <p class="text-muted text-sm mb-2">أضف عروض إيجار فعلية وجدتها للموقع المستهدف — لا تُنسَب لمعيار تقييم بعينه، بل لقرار الموقع ككل.</p>
                <div class="flex gap-2 flex-wrap mb-2">
                    <a href="${aqarUrl}" target="_blank" rel="noopener noreferrer" class="btn btn--sm btn--secondary">بحث عقار تجاري (Aqar)${city ? ` — ${escapeHtml(city)}` : ''}</a>
                    <a href="${ejarUrl}" target="_blank" rel="noopener noreferrer" class="btn btn--sm btn--ghost">التحقق عبر منصة إيجار</a>
                </div>
                ${listings.map((q, i) => `
                    <div class="flex items-center gap-2 flex-wrap quote-item">
                        <span>${escapeHtml(q?.source || 'مصدر غير محدد')}</span>
                        <span>${(Number(q?.price) || 0).toLocaleString('ar-SA')} ريال/شهر</span>
                        ${q?.url ? `<a href="${escapeHtml(q.url)}" target="_blank" rel="noopener noreferrer">الرابط</a>` : ''}
                        <span class="text-muted">${escapeHtml(q?.date || '')}</span>
                        <button type="button" class="btn-xs btn-remove-listing" data-idx="${i}">حذف</button>
                    </div>
                `).join('')}
                ${stats ? `<p class="text-muted text-sm">المتوسط: ${stats.avg.toLocaleString('ar-SA')} ريال/شهر · الأدنى: ${stats.min.toLocaleString('ar-SA')} ريال/شهر</p>` : ''}
                <div class="flex items-center gap-2 flex-wrap mt-2 quote-add-form">
                    <input type="text" class="input input--sm listing-input" data-field="source" placeholder="المالك/الوسيط">
                    <input type="text" inputmode="decimal" class="input input--sm listing-input" data-field="price" placeholder="الإيجار الشهري">
                    <input type="text" class="input input--sm listing-input" data-field="url" placeholder="رابط الإعلان (اختياري)">
                    <input type="date" class="input input--sm listing-input" data-field="date">
                    <button type="button" class="btn btn--sm btn--secondary" id="btnAddListing">+ إضافة عرض إيجار</button>
                </div>
            </div>
        `;
        this._bindLocationListingsEvents();
    }

    _bindLocationListingsEvents() {
        const container = this.container.querySelector('#location-listings-panel');
        if (!container) return;
        container.querySelector('#btnAddListing')?.addEventListener('click', () => this._addLocationListing());
        container.querySelectorAll('.btn-remove-listing').forEach(btn => {
            btn.addEventListener('click', () => this._removeLocationListing(parseInt(btn.dataset.idx, 10)));
        });
    }

    _addLocationListing() {
        const container = this.container.querySelector('#location-listings-panel');
        const source = container?.querySelector('[data-field="source"]')?.value.trim() || '';
        const priceRaw = container?.querySelector('[data-field="price"]')?.value || '';
        const url = container?.querySelector('[data-field="url"]')?.value.trim() || '';
        const date = container?.querySelector('[data-field="date"]')?.value || '';
        const price = DynamicTable.parseLenientNumber(priceRaw) || 0;

        if (!source || price <= 0) {
            toast.info('أدخل اسم المالك/الوسيط وإيجاراً شهرياً أكبر من صفر.');
            return;
        }

        const state = this.store.get();
        const listings = Array.isArray(state?.technical?.locationListings) ? [...state.technical.locationListings] : [];
        listings.push({ source, price, url, date });
        this.store.updatePath('technical', 'locationListings', listings);
        this._renderLocationListings();
        toast.success('أُضيف عرض الإيجار.');
    }

    _removeLocationListing(idx) {
        const state = this.store.get();
        const listings = (Array.isArray(state?.technical?.locationListings) ? state.technical.locationListings : []).filter((_, i) => i !== idx);
        this.store.updatePath('technical', 'locationListings', listings);
        this._renderLocationListings();
    }

    // ─── Task 6: تقدير استهلاك المرافق ──────────────────────────────────────

    _renderUtilityEstimate() {
        const container = this.container.querySelector('#utility-estimate-panel');
        if (!container) return;
        const state = this.store.get();
        const estimate = estimateMonthlyUtilityCost(state);
        if (!estimate) {
            container.innerHTML = `
                <div class="card mb-3">
                    <h4 class="card-title">تقدير استهلاك المرافق (كهرباء ومياه)</h4>
                    <p class="text-muted text-sm">أدخل مساحة المشروع (م²) في «معلومات المشروع» لعرض تقدير.</p>
                </div>
            `;
            return;
        }

        // بند «كهرباء ومياه» الجاهز فعلياً في جدول الموارد اللوجستية (schema.js) — إن
        // وُجد نطبّق التقدير عليه مباشرة؛ إن لم يوجد نكتفي برقم استرشادي بلا اختراع بند جديد.
        const logisticsRows = Array.isArray(state?.logistics?.logistics) ? state.logistics.logistics : [];
        const utilityRowIndex = logisticsRows.findIndex(r => /كهرباء/.test(r?.name || ''));
        const mid = Math.round((estimate.lowSar + estimate.highSar) / 2);
        const currentValue = utilityRowIndex >= 0 ? (Number(logisticsRows[utilityRowIndex]?.monthly) || 0) : 0;

        container.innerHTML = `
            <div class="card mb-3">
                <h4 class="card-title">تقدير استهلاك المرافق (كهرباء ومياه)</h4>
                <p class="text-muted text-sm mb-2">
                    تقدير تقريبي (افتراض داخلي غير مبني على عداد فعلي) بضرب المساحة (${estimate.areaSize.toLocaleString('ar-SA')} م²)
                    في معيار قطاع «${escapeHtml(estimate.sectorLabel)}»${estimate.isGeneric ? ' (معيار عام لعدم اكتشاف القطاع)' : ''}.
                </p>
                <p>المدى الشهري المقدَّر: <strong>${estimate.lowSar.toLocaleString('ar-SA')}–${estimate.highSar.toLocaleString('ar-SA')}</strong> ريال/شهر.</p>
                ${utilityRowIndex >= 0
                    ? `<button type="button" class="btn btn--sm btn--secondary" id="btnApplyUtilityEstimate">تطبيق ${mid.toLocaleString('ar-SA')} ريال/شهر على بند «كهرباء ومياه»${currentValue > 0 ? ` (استبدال القيمة الحالية ${currentValue.toLocaleString('ar-SA')} ريال)` : ''}</button>`
                    : `<p class="text-xs text-muted">لا يوجد بند «كهرباء ومياه» بعد في الموارد اللوجستية — هذا الرقم استرشادي فقط.</p>`}
            </div>
        `;

        this.container.querySelector('#btnApplyUtilityEstimate')?.addEventListener('click', () => {
            const rows = [...logisticsRows];
            rows[utilityRowIndex] = { ...rows[utilityRowIndex], monthly: mid };
            this.store.updatePath('logistics', 'logistics', rows);
            toast.success(`طُبِّق ${mid.toLocaleString('ar-SA')} ريال/شهر على بند «كهرباء ومياه» (الموارد اللوجستية).`);
            this._renderUtilityEstimate();
        });
    }

    // ─── Task 8: جدول الصيانة/الإحلال المتوقع ───────────────────────────────

    _renderMaintenanceSchedule() {
        const container = this.container.querySelector('#maintenance-schedule-panel');
        if (!container) return;
        const schedule = buildMaintenanceSchedule(this.store.get());
        if (!schedule.length) {
            container.innerHTML = `
                <div class="card">
                    <h4 class="card-title">جدول الصيانة/الإحلال المتوقع</h4>
                    <p class="text-muted text-sm">أضف بنوداً بعمر إهلاك/إطفاء (نفقات تأسيس، معدات، أثاث) لعرض جدول متوقع.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="card">
                <h4 class="card-title">جدول الصيانة/الإحلال المتوقع</h4>
                <p class="text-muted text-sm mb-2">مبني على أعمار الإهلاك/الإطفاء المُدخلة لكل بند (نفس منطق المحرك المالي) — تخطيطي فقط، لا يضيف تكلفة جديدة.</p>
                <div class="table-scroll" style="overflow-x:auto">
                    <table class="data-table">
                        <thead><tr><th>البند</th><th>الفئة</th><th>العمر الافتراضي</th><th>أول استحقاق متوقع</th></tr></thead>
                        <tbody>
                            ${schedule.map(item => `
                                <tr>
                                    <td>${escapeHtml(item.name)}</td>
                                    <td>${escapeHtml(item.categoryLabel)}</td>
                                    <td>${item.life} ${item.life === 1 ? 'سنة' : 'سنوات'}</td>
                                    <td>سنة التشغيل رقم ${item.firstDueYear} (${escapeHtml(item.kind)})</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
}
