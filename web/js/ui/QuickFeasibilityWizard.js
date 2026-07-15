/**
 * مسار "جدوى سريعة" / "جدوى في حوالي ساعة" (Modeliks) — 3 خطوات: تعريف المشروع → الأرقام الأساسية → القرار والتصدير.
 * استنساخ لنقاط قوة منافس (جدوى تك، Modeliks): تبسيط، طباعة/حفظ PDF فوري، ملء بالذكاء الاصطناعي اختياري.
 */
import {
    quickFeasibilityCalc,
    QUICK_SECTOR_OPTIONS,
    estimateAllInInvestment,
    getQuickDefaultsForSector,
    getQuickSectorLabel,
    normalizeQuickSector,
    quickSanityChecks
} from '../utils/quickFeasibilityCalc.js';
import { formatCurrency } from '../utils/formatters.js';
import { toast } from '../utils/toast.js';
import { QuickPDFGenerator } from '../../export/quickPdfGenerator.js';
import { IntelligenceService } from '../services/IntelligenceService.js';

const SECTORS = QUICK_SECTOR_OPTIONS;

const OTHER_CITY_VALUE = '__other__';
const CITIES = ['الرياض', 'جدة', 'مكة المكرمة', 'المدينة المنورة', 'الدمام', 'الخبر', 'الطائف', 'تبوك', 'بريدة', 'خميس مشيط', 'سبت العلايا'];

const TOTAL_STEPS = 3;
const ESTIMATED_MINUTES = 15;
/** وقت متوقع متبقي للإكمال (دقائق) حسب الخطوة — KPI-1.2 / KPI-9.1 */
const ESTIMATED_MINUTES_BY_STEP = { 1: 12, 2: 5, 3: 0 };
const MODELIKS_HOUR_LABEL = 'جدوى في حوالي ساعة';

export class QuickFeasibilityWizard {
    constructor(containerId, store, options = {}) {
        this.container = document.getElementById(containerId);
        this.store = store;
        this.onFinish = options.onFinish || (() => {}); // الانتقال للمسار الكامل
        this.onExit = options.onExit || (() => {});      // العودة للوحة المشاريع
        this.step = 1;
        // القيم المالية تبدأ فارغة (null) — لا نُعبّئ أرقاماً «تقديرية» ونعرضها كأنها أرقام المستخدم.
        // التقدير القطاعي يُخزَّن منفصلاً في this.estimates ويُعرض كتلميح/زر اختياري فقط.
        this.quickData = {
            projectName: '',
            sector: 'restaurant',
            sectorLabel: getQuickSectorLabel('restaurant'),
            city: 'الرياض',
            area: 100,
            budget: 0,
            monthlyRevenue: null,
            monthlyCosts: null,
            initialInvestment: null,
            fundingSource: 'self',
            apiDefaults: null
        };
        this.estimates = { ...getQuickDefaultsForSector('restaurant') };
        this.estimateSource = 'sector'; // 'sector' (متوسط قطاعي ثابت) أو 'market' (محرك السوق حسب المدينة/المساحة)
    }

    /** يحدّث التقدير القطاعي المعروض (لا يلمس أرقام المستخدم في quickData). */
    applySectorDefaults() {
        this.quickData.sector = normalizeQuickSector(this.quickData.sector);
        this.quickData.sectorLabel = getQuickSectorLabel(this.quickData.sector);
        const def = getQuickDefaultsForSector(this.quickData.sector);
        this.estimates = { ...def };
        this.estimateSource = 'sector';
    }

    /** هل القيم الحالية مطابقة للتقدير القطاعي (أي أن المستخدم اعتمد التقدير ولم يُدخل أرقامه)؟ */
    isUsingEstimates() {
        const d = this.quickData, e = this.estimates;
        return Number(d.monthlyRevenue) === Number(e.monthlyRevenue)
            && Number(d.monthlyCosts) === Number(e.monthlyCosts)
            && Number(d.initialInvestment) === Number(e.initialInvestment);
    }

    render() {
        if (!this.container) return;
        if (this.step === 1) this.renderStep1();
        else if (this.step === 2) this.renderStep2();
        else this.renderStep3();
    }

    renderStep1() {
        const d = this.quickData;
        const progress = (1 / TOTAL_STEPS) * 100;
        const remaining = TOTAL_STEPS - 1;
        const selectedSector = normalizeQuickSector(d.sector);
        const selectedCity = CITIES.includes(d.city) ? d.city : OTHER_CITY_VALUE;
        const customCity = selectedCity === OTHER_CITY_VALUE && d.city ? d.city : '';
        this.container.innerHTML = `
            <div class="quick-feasibility animate-entry" dir="rtl">
                <div class="progress-step-map flex gap-2 justify-center mb-4" role="navigation" aria-label="خريطة الخطوات">
                    <span class="step-dot active" aria-current="step" style="width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;background:var(--c-p-500);color:#fff;border:2px solid var(--c-p-400);">1</span>
                    <span class="step-dot" style="width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:12px;background:var(--c-bg-card);color:var(--c-text-muted);border:2px solid var(--c-border);">2</span>
                    <span class="step-dot" style="width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:12px;background:var(--c-bg-card);color:var(--c-text-muted);border:2px solid var(--c-border);">3</span>
                </div>
                <div class="progress-info flex justify-between mb-2 text-sm text-muted" role="status" aria-label="أنت في الخطوة 1 من ${TOTAL_STEPS}">
                    <span>أنت في الخطوة 1 من ${TOTAL_STEPS}</span>
                    <span>${Math.round(progress)}%</span>
                </div>
                <p class="text-sm text-gold mb-2" aria-live="polite">⏱ وقت الإكمال المتوقع: حوالي ${ESTIMATED_MINUTES_BY_STEP[1]} دقيقة</p>
                <div class="progress-bar mb-6" role="progressbar" aria-valuenow="${Math.round(progress)}" aria-valuemin="0" aria-valuemax="100">
                    <div class="progress-bar-fill" style="width: ${progress}%"></div>
                </div>
                <h2 class="text-2xl font-bold mb-2">تعريف المشروع</h2>
                <p class="text-muted mb-6">${MODELIKS_HOUR_LABEL} — خطوتان متبقيتان.</p>
                <div class="card card-hover max-w-xl space-y-4">
                    <div>
                        <label class="block text-sm font-medium mb-1">اسم المشروع</label>
                        <input type="text" id="qf-projectName" class="input w-full" value="${(d.projectName || '').replace(/"/g, '&quot;')}" placeholder="مثال: مقهى الروح" />
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">القطاع</label>
                        <select id="qf-sector" class="input w-full">
                            ${SECTORS.map(s => `<option value="${s.value}" ${selectedSector === s.value ? 'selected' : ''}>${s.label}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">المدينة / المنطقة</label>
                        <select id="qf-city" class="input w-full">
                            ${CITIES.map(c => `<option value="${c}" ${selectedCity === c ? 'selected' : ''}>${c}</option>`).join('')}
                            <option value="${OTHER_CITY_VALUE}" ${selectedCity === OTHER_CITY_VALUE ? 'selected' : ''}>أخرى</option>
                        </select>
                        <input type="text" id="qf-city-other" class="input w-full mt-2" value="${(customCity || '').replace(/"/g, '&quot;')}" placeholder="اكتب المدينة أو المحافظة" style="${selectedCity === OTHER_CITY_VALUE ? '' : 'display:none;'}" />
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">المساحة (م²)</label>
                        <input type="number" id="qf-area" class="input w-full" value="${d.area || 100}" min="10" step="10" placeholder="100" />
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">ميزانية تقريبية (ريال) — اختياري</label>
                        <input type="number" id="qf-budget" class="input w-full" value="${d.budget || ''}" min="0" step="10000" placeholder="اتركه فارغاً" />
                    </div>
                </div>
                <div class="flex gap-3 mt-6">
                    <button type="button" id="qf-back-dash" class="btn btn--ghost">← العودة</button>
                    <button type="button" id="qf-next-1" class="btn btn--primary">التالي ←</button>
                </div>
            </div>
        `;
        this.bindStep1();
    }

    /**
     * إشعار مصدر الأرقام: صندوق ثابت الظهور يشرح أن الحقول أرقامك أنت،
     * وأن التقدير القطاعي مجرد نقطة بداية اختيارية موسومة بوضوح — لا يُعرض كأنه أرقام مؤكدة.
     */
    _renderEstimatesNotice() {
        const e = this.estimates;
        const srcLabel = this.estimateSource === 'market'
            ? 'محرك السوق (حسب مدينتك ومساحتك)'
            : 'متوسط قطاعي عام (غير مخصّص لمشروعك)';
        return `
            <div class="alert alert--warning mb-4" role="note">
                <strong>هذه أرقامك أنت.</strong> اترك الحقول فارغة وأدخل أرقامك الحقيقية (من عروض أسعار، إيجار فعلي، ومبيعات مدروسة).
                إن أردت نقطة بداية فقط، يمكنك ملؤها بتقدير قطاعي — لكنه <u>متوسط عام لا يخص مشروعك</u> ويجب مراجعته.
                <div class="text-xs text-muted mt-2">مصدر التقدير: ${srcLabel} • إيراد ~${formatCurrency(e.monthlyRevenue)} / تكاليف ~${formatCurrency(e.monthlyCosts)} / استثمار ~${formatCurrency(e.initialInvestment)}</div>
                <button type="button" id="qf-apply-estimate" class="btn btn--sm btn--ghost mt-2">املأ بالتقدير القطاعي (يمكنك تعديله)</button>
            </div>`;
    }

    /** قيمة الحقل: رقم المستخدم إن أدخله، وإلا فارغ (لا نعرض التقدير كقيمة). */
    _fieldVal(v) {
        return (v === null || v === undefined || Number.isNaN(v)) ? '' : v;
    }

    renderStep2() {
        const d = this.quickData;
        const e = this.estimates;
        const progress = (2 / TOTAL_STEPS) * 100;
        this.container.innerHTML = `
            <div class="quick-feasibility animate-entry" dir="rtl">
                <div class="progress-step-map flex gap-2 justify-center mb-4" role="navigation" aria-label="خريطة الخطوات">
                    <span class="step-dot completed" style="width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:12px;background:var(--c-success);color:#fff;border:2px solid var(--c-success);">✓</span>
                    <span class="step-dot active" aria-current="step" style="width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;background:var(--c-p-500);color:#fff;border:2px solid var(--c-p-400);">2</span>
                    <span class="step-dot" style="width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:12px;background:var(--c-bg-card);color:var(--c-text-muted);border:2px solid var(--c-border);">3</span>
                </div>
                <div class="progress-info flex justify-between mb-2 text-sm text-muted" role="status" aria-label="أنت في الخطوة 2 من ${TOTAL_STEPS}">
                    <span>أنت في الخطوة 2 من ${TOTAL_STEPS}</span>
                    <span>${Math.round(progress)}%</span>
                </div>
                <p class="text-sm text-gold mb-2" aria-live="polite">⏱ وقت الإكمال المتوقع: حوالي ${ESTIMATED_MINUTES_BY_STEP[2]} دقيقة</p>
                <div class="progress-bar mb-6" role="progressbar" aria-valuenow="${Math.round(progress)}" aria-valuemin="0" aria-valuemax="100">
                    <div class="progress-bar-fill" style="width: ${progress}%"></div>
                </div>
                <h2 class="text-2xl font-bold mb-2">الأرقام الأساسية</h2>
                <p class="text-muted mb-6">خطوة واحدة متبقية — ثم تحصل على القرار وخيار الطباعة أو الحفظ كـ PDF (حوالي 5 دقائق).</p>
                ${this._renderEstimatesNotice()}
                <div class="card card-hover max-w-xl space-y-4">
                    <div>
                        <label class="block text-sm font-medium mb-1">الإيراد الشهري المتوقع (ريال)</label>
                        <input type="number" id="qf-monthlyRevenue" class="input w-full" dir="ltr" value="${this._fieldVal(d.monthlyRevenue)}" min="0" step="1000" placeholder="تقدير قطاعي: ${e.monthlyRevenue}" />
                        <p class="field-hint text-xs text-muted mt-1">أدخل مبيعاتك الشهرية المتوقعة بناءً على دراسة السوق والمنافسين — لا تقديراً متفائلاً.</p>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">التكاليف التشغيلية الشهرية (ريال)</label>
                        <input type="number" id="qf-monthlyCosts" class="input w-full" dir="ltr" value="${this._fieldVal(d.monthlyCosts)}" min="0" step="1000" placeholder="تقدير قطاعي: ${e.monthlyCosts}" />
                        <p class="field-hint text-xs text-muted mt-1">اشمل: إيجار، رواتب، مواد/بضاعة، كهرباء وماء، تسويق، صيانة.</p>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">الاستثمار الأولي (ريال)</label>
                        <input type="number" id="qf-initialInvestment" class="input w-full" dir="ltr" value="${this._fieldVal(d.initialInvestment)}" min="0" step="10000" placeholder="تقدير قطاعي: ${e.initialInvestment}" />
                        <p class="field-hint text-xs text-muted mt-1">اشمل كل التكاليف لمرة واحدة: تجهيز المكان، معدات، أثاث، تراخيص، ما قبل التشغيل، ورأس مال عامل للأشهر الأولى.</p>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">مصدر التمويل</label>
                        <select id="qf-fundingSource" class="input w-full">
                            <option value="self" ${d.fundingSource === 'self' ? 'selected' : ''}>تمويل ذاتي</option>
                            <option value="loan" ${d.fundingSource === 'loan' ? 'selected' : ''}>قرض</option>
                        </select>
                    </div>
                </div>
                <div class="mt-4 p-3 rounded-lg border border-border bg-card max-w-xl">
                    <p class="text-sm text-muted mb-2">اختياري: ملء المسودة بالذكاء الاصطناعي (ملخص، سوق، منافسون، مخاطر).</p>
                    <button type="button" id="qf-ai-fill" class="btn btn--sm btn-magic">ملء المسودة بالذكاء الاصطناعي</button>
                    <span id="qf-ai-status" class="text-xs text-muted mr-2"></span>
                </div>
                <div class="flex gap-3 mt-6">
                    <button type="button" id="qf-prev-2" class="btn btn--ghost">→ السابق</button>
                    <button type="button" id="qf-next-2" class="btn btn--primary">التالي ←</button>
                </div>
            </div>
        `;
        this.bindStep2();
    }

    renderStep3() {
        const d = this.quickData;
        const result = quickFeasibilityCalc(d);
        const progress = 100;

        // بوابة جودة مصغّرة: نُبرز الأرقام غير الواقعية بدل عرض «GO» واثق فوقها
        const warnings = quickSanityChecks(d, result, { estimatesApplied: this.isUsingEstimates() });
        const hardWarnings = warnings.filter(w => w.level === 'hard');
        const hasHard = hardWarnings.length > 0;

        // توصية أمينة: عند وجود تحذيرات جوهرية لا نعرض GO قاطعاً بل «مبدئي — يتطلب مراجعة»
        let displayLabel = result.recommendationLabel;
        let recClass = result.recommendation === 'go' ? 'text-success' : result.recommendation === 'revise' ? 'text-warning' : 'text-danger';
        if (hasHard && result.recommendation === 'go') {
            displayLabel = 'مبدئي — يتطلب مراجعة قبل القرار';
            recClass = 'text-warning';
        }

        const warningsHtml = warnings.length ? `
            <div class="alert ${hasHard ? 'alert--warning' : 'alert--info'} max-w-xl mb-6" role="alert">
                <strong>${hasHard ? '⚠ قبل أن تثق بهذه النتيجة، انتبه:' : 'ملاحظات على الأرقام:'}</strong>
                <ul class="mt-2 space-y-2 text-sm" style="list-style:disc; padding-inline-start:1.25rem;">
                    ${warnings.map(w => `<li>${w.text}</li>`).join('')}
                </ul>
                <p class="text-xs text-muted mt-3">للتحقق الكامل من هذه النقاط (فترة تهيئة، تدفق شهري، طاقة استيعابية، معايير القطاع) استخدم «الدراسة الكاملة» — فيها بوابة جودة تفصيلية.</p>
            </div>` : '';

        this.container.innerHTML = `
            <div class="quick-feasibility animate-entry" dir="rtl">
                <div class="progress-step-map flex gap-2 justify-center mb-4" role="navigation" aria-label="خريطة الخطوات">
                    <span class="step-dot completed" style="width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:12px;background:var(--c-success);color:#fff;border:2px solid var(--c-success);">✓</span>
                    <span class="step-dot completed" style="width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:12px;background:var(--c-success);color:#fff;border:2px solid var(--c-success);">✓</span>
                    <span class="step-dot active" aria-current="step" style="width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;background:var(--c-p-500);color:#fff;border:2px solid var(--c-p-400);">3</span>
                </div>
                <div class="progress-info flex justify-between mb-2 text-sm text-muted" role="status" aria-label="أنت في الخطوة 3 من ${TOTAL_STEPS}">
                    <span>أنت في الخطوة 3 من ${TOTAL_STEPS}</span>
                    <span>100%</span>
                </div>
                <div class="progress-bar mb-6" role="progressbar" aria-valuenow="100" aria-valuemin="0" aria-valuemax="100">
                    <div class="progress-bar-fill" style="width: 100%"></div>
                </div>
                <h2 class="text-2xl font-bold mb-2">ملخص القرار</h2>
                <p class="text-muted mb-6">تم تقييم المشروع بناءً على المدخلات. يمكنك طباعة التقرير المختصر أو حفظه كـ PDF الآن.</p>
                <p class="text-gold font-semibold mb-4">تم إعداد مسودة دراستك في حوالي ساعة.</p>
                ${warningsHtml}
                <div class="card card-hover max-w-xl mb-6 p-6">
                    <div class="text-center mb-6">
                        <span class="text-4xl font-black ${recClass}">${displayLabel}</span>
                        ${hasHard ? '<div class="text-xs text-muted mt-2">هذا مؤشر مبدئي سريع وليس قراراً نهائياً — راجع التحذيرات أعلاه.</div>' : ''}
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                        <div class="p-3 bg-white/5 rounded-lg">
                            <div class="text-xs text-muted mb-1">صافي القيمة الحالية (NPV)</div>
                            <div class="font-bold">${formatCurrency(result.npv)}</div>
                        </div>
                        <div class="p-3 bg-white/5 rounded-lg">
                            <div class="text-xs text-muted mb-1">فترة الاسترداد (سنوات)</div>
                            <div class="font-bold">${result.paybackYears != null ? result.paybackYears + ' سنة' : '—'}</div>
                        </div>
                        <div class="p-3 bg-white/5 rounded-lg">
                            <div class="text-xs text-muted mb-1">نقطة التعادل (ريال/شهر)</div>
                            <div class="font-bold">${formatCurrency(result.breakevenMonthly)}</div>
                        </div>
                    </div>
                </div>
                <div class="flex flex-col sm:flex-row gap-3 items-center justify-between max-w-xl">
                    <button type="button" id="qf-download-pdf" class="btn btn--primary text-lg py-4 px-8 shadow-lg hover:scale-105" aria-label="طباعة أو حفظ PDF — يفتح نافذة الطباعة لاختيار حفظ كـ PDF">
                        📄 طباعة / حفظ PDF
                    </button>
                    <div class="flex gap-2">
                        <button type="button" id="qf-full-path" class="btn btn--secondary">استكمال الدراسة الكاملة</button>
                        <button type="button" id="qf-back-dash-3" class="btn btn--ghost">العودة للوحة المشاريع</button>
                    </div>
                </div>
                <p class="text-xs text-muted mt-6 max-w-xl">التقرير المبني على معايير دراسات جدوى متوافقة مع أفضل الممارسات المحلية (رؤية 2030، منشآت، بنك التنمية). لا يُعد اعتماداً رسمياً إلا بموجب اتفاق.</p>
            </div>
        `;
        this.bindStep3(result, warnings);
    }

    bindStep1() {
        const sectorEl = this.container.querySelector('#qf-sector');
        sectorEl?.addEventListener('change', () => {
            this.quickData.sector = normalizeQuickSector(sectorEl.value);
            this.quickData.sectorLabel = getQuickSectorLabel(this.quickData.sector);
            this.applySectorDefaults();
        });
        const cityEl = this.container.querySelector('#qf-city');
        const cityOtherEl = this.container.querySelector('#qf-city-other');
        const syncOtherCity = () => {
            if (!cityOtherEl) return;
            cityOtherEl.style.display = cityEl?.value === OTHER_CITY_VALUE ? '' : 'none';
            if (cityEl?.value === OTHER_CITY_VALUE) cityOtherEl.focus();
        };
        cityEl?.addEventListener('change', syncOtherCity);
        this.container.querySelector('#qf-next-1')?.addEventListener('click', async () => {
            this.quickData.projectName = this.container.querySelector('#qf-projectName')?.value?.trim() || 'مشروع جديد';
            this.quickData.sector = normalizeQuickSector(this.container.querySelector('#qf-sector')?.value || 'restaurant');
            this.quickData.sectorLabel = getQuickSectorLabel(this.quickData.sector);
            const selectedCity = this.container.querySelector('#qf-city')?.value || 'الرياض';
            const customCity = this.container.querySelector('#qf-city-other')?.value?.trim() || '';
            if (selectedCity === OTHER_CITY_VALUE && !customCity) {
                toast.error('اكتب المدينة أو المحافظة قبل المتابعة.');
                return;
            }
            this.quickData.city = selectedCity === OTHER_CITY_VALUE ? customCity : selectedCity;
            this.quickData.area = Number(this.container.querySelector('#qf-area')?.value) || 100;
            this.quickData.budget = Number(this.container.querySelector('#qf-budget')?.value) || 0;
            this.applySectorDefaults();
            try {
                const defaults = await IntelligenceService.getMarketDefaults(
                    this.quickData.sector,
                    this.quickData.city,
                    this.quickData.area,
                    this.quickData.budget
                );
                if (defaults && (defaults.rent_per_sqm || defaults.fitout_per_sqm)) {
                    this.quickData.apiDefaults = defaults;
                    const area = this.quickData.area || 100;
                    const rent = (defaults.rent_per_sqm || 1000) * area / 12;
                    const sal = defaults.salaries || { manager: 6000, staff: 3500 };
                    const staffCount = 2;
                    const monthlySalaries = (sal.manager || 6000) + (staffCount * (sal.staff || 3500));
                    const marketing = (defaults.marketing && defaults.marketing.monthly) || 1500;
                    const monthlyCosts = Math.round(rent + monthlySalaries + marketing);
                    // تقدير قطاعي محدَّث (لا نلمس أرقام المستخدم) — استثمار *شامل* لا تجهيزاً فقط
                    this.estimates.monthlyCosts = monthlyCosts;
                    this.estimates.initialInvestment = estimateAllInInvestment(defaults, area, monthlyCosts);
                    this.estimates.monthlyRevenue = Math.max(this.estimates.monthlyRevenue, Math.round(monthlyCosts * 1.25));
                    this.estimateSource = defaults.source === 'Offline Fallback' ? 'sector' : 'market';
                }
            } catch (e) {
                /* استمر بالتقدير القطاعي الثابت */
            }
            this.step = 2;
            this.render();
        });
        this.container.querySelector('#qf-back-dash')?.addEventListener('click', () => this.onExit());
    }

    bindStep2() {
        this.container.querySelector('#qf-prev-2')?.addEventListener('click', () => {
            this.step = 1;
            this.render();
        });
        // ملء اختياري بالتقدير القطاعي — يسجّل موافقة صريحة من المستخدم (وليس تعبئة صامتة)
        this.container.querySelector('#qf-apply-estimate')?.addEventListener('click', () => {
            this.quickData.monthlyRevenue = this.estimates.monthlyRevenue;
            this.quickData.monthlyCosts = this.estimates.monthlyCosts;
            this.quickData.initialInvestment = this.estimates.initialInvestment;
            this.render();
            toast.info('تم ملء الحقول بتقدير قطاعي عام — راجع كل رقم وعدّله بأرقامك الحقيقية قبل القرار.');
        });
        this.container.querySelector('#qf-next-2')?.addEventListener('click', () => {
            this.quickData.monthlyRevenue = Number(this.container.querySelector('#qf-monthlyRevenue')?.value) || 0;
            this.quickData.monthlyCosts = Number(this.container.querySelector('#qf-monthlyCosts')?.value) || 0;
            this.quickData.initialInvestment = Number(this.container.querySelector('#qf-initialInvestment')?.value) || 0;
            this.quickData.fundingSource = this.container.querySelector('#qf-fundingSource')?.value || 'self';

            // تحقق مانع: مدخلات صفرية/سالبة كانت تمر وتعطي «GO باسترداد 0 سنة»
            const problems = [];
            if (this.quickData.monthlyRevenue <= 0) problems.push('الإيراد الشهري المتوقع');
            if (this.quickData.monthlyCosts <= 0) problems.push('التكاليف الشهرية');
            if (this.quickData.initialInvestment <= 0) problems.push('الاستثمار الأولي');
            if (problems.length) {
                toast.error(`أدخل قيماً أكبر من صفر في: ${problems.join('، ')} — لا يمكن حساب جدوى بلا هذه الأرقام.`);
                return;
            }

            this.step = 3;
            this.render();
        });
        this.container.querySelector('#qf-ai-fill')?.addEventListener('click', async () => {
            const btn = this.container.querySelector('#qf-ai-fill');
            const status = this.container.querySelector('#qf-ai-status');
            if (btn) btn.disabled = true;
            if (status) status.textContent = 'جاري التوليد...';
            try {
                const { AIConnector } = await import('../services/AIConnector.js');
                const connector = new AIConnector();
                const ctx = {
                    projectInfo: {
                        name: this.quickData.projectName || 'مشروع',
                        concept: this.quickData.sectorLabel || getQuickSectorLabel(this.quickData.sector),
                        city: this.quickData.city
                    }
                };
                // تمرير نتائج الجدوى السريعة الحقيقية بدل كائن فارغ (يمنع ملخصاً بأصفار وتوصية زائفة)
                const qr = quickFeasibilityCalc(this.quickData) || {};
                const qResults = {
                    npv: qr.npv,
                    paybackPeriod: qr.paybackYears,
                    breakEvenPointValue: qr.breakevenMonthly,
                    decision: qr.recommendation === 'go' ? 'GO' : (qr.recommendation === 'revise' ? 'REVISE' : 'NO-GO'),
                    indicators: { npv: qr.npv, paybackPeriod: qr.paybackYears, breakEvenPointValue: qr.breakevenMonthly }
                };
                const [execSummary, market, competitors, risks] = await Promise.all([
                    connector.generateExecutiveSummary(ctx, qResults).catch(() => ''),
                    connector.generateMarketAnalysisText(ctx).catch(() => ''),
                    connector.generateCompetitors(ctx).then(c => Array.isArray(c) ? c : []).catch(() => []),
                    connector.generateRisksForReport(ctx).then(r => Array.isArray(r) ? r : []).catch(() => [])
                ]);
                this.quickData.generated = {
                    execSummary: typeof execSummary === 'string' ? execSummary : '',
                    market: typeof market === 'string' ? market : '',
                    competitors: Array.isArray(competitors) ? competitors : [],
                    risks: Array.isArray(risks) ? risks.map(r => ({ name: r.name || r.description, description: r.description || r.name, mitigation: r.mitigation || '', probability: r.probability || 'medium', impact: r.impact || 'medium' })) : []
                };
                toast.success('تم ملء المسودة بالذكاء الاصطناعي. انقر «التالي» لعرض القرار.');
                if (status) status.textContent = 'تم ✓';
            } catch (e) {
                console.error('Quick AI fill failed', e);
                toast.error('تعذر التوليد. يمكنك المتابعة بدون ملء المسودة.');
                if (status) status.textContent = '';
            }
            if (btn) btn.disabled = false;
        });
    }

    bindStep3(result, warnings = []) {
        this.container.querySelector('#qf-download-pdf')?.addEventListener('click', async () => {
            const btn = this.container.querySelector('#qf-download-pdf');
            if (btn?.disabled) return;
            if (btn) {
                btn.disabled = true;
                btn.textContent = '⏳ جاري الإعداد...';
            }
            try {
                const gen = new QuickPDFGenerator(this.quickData, result, this.store, { warnings });
                await gen.generate();
                toast.success('تم فتح نافذة الطباعة — اختر «حفظ كـ PDF»');
            } catch (e) {
                console.error(e);
                toast.error('تعذر إعداد التقرير. حاول مجدداً أو استخدم «الدراسة الكاملة» للتصدير.');
            }
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '📄 طباعة / حفظ PDF';
            }
        });
        this.container.querySelector('#qf-full-path')?.addEventListener('click', () => this.onFinish(this.quickData));
        this.container.querySelector('#qf-back-dash-3')?.addEventListener('click', () => this.onExit());
    }
}
