import { getLabel } from '../core/labels.js';
import { getLabelSDB, getAuditorTooltip, getFieldHint } from '../core/regulatoryLabels.js';
import { getStepHelp, miniEssentialFields, miniEssentialTables } from '../core/wizardSteps.js';
import { DynamicTable } from './DynamicTable.js';
import { DataService } from '../services/DataService.js';
import { generateTableSuggestions } from '../services/AIConnector.js';
import { InternalAIGenerator } from '../services/InternalAIGenerator.js';
import { generateSuggestionStreaming } from '../services/FieldSuggestionService.js';
import { trackEvent } from '../utils/analytics.js';
import { ReviewCharts } from './ReviewCharts.js';
import { toast } from '../utils/toast.js';
import { validateAssumptions, validateFinancing } from '../utils/validation.js';
import { GULF_CURRENCIES, CURRENCY_LABELS, formatCurrency, formatFractionAsPercent } from '../utils/formatters.js';
import { CITY_STATS } from '../data/SaudiCityStats.js';
import { getFieldOptionSpec } from '../core/fieldOptions.js';
import { getFieldHelp } from '../core/fieldHelpTexts.js';
import { fieldHelp } from './components/FieldHelp.js';
import { escapeHtml } from '../utils/escape.js';
import { describeRevenueRampGap } from '../core/engine.js';
import { suggest, isUsable } from '../services/DataConnectors.js';
import '../services/connectors/ChamberSuppliersConnector.js'; // يسجّل 'market.suppliers' ذاتياً عند التحميل
import { getExpertTemplates } from '../services/ExpertTemplateService.js';
import { detectKeyPeopleSectorGap } from '../core/keyPeopleSectorGap.js';
import { buildNitaqatHrCardData } from '../core/nitaqatHrCard.js';
import { findMissingCommonLicenses } from '../core/licensingGap.js';
import { scanContractRisks } from '../core/contractRiskScan.js';
import noUiSlider from 'nouislider';
import AutoNumeric from 'autonumeric';

// أيقونة sprite + تجريد إيموجي من التسميات القادمة من schema (smartFill.label تحوي 🪄)
// — تدقيق تنظيف 2026-07-11: تُنظَّف عند العرض بلا لمس ملف schema المشترك.
const icon = (id) => `<svg class="ic" aria-hidden="true"><use href="#${id}"/></svg>`;
const stripEmoji = (s) => (s || '').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}️‍]/gu, '').trim();

/** Smart Fill handlers keyed by TABLE_SCHEMAS.*.smartFill.dataKey. Add new tables here. */
export const SMART_FILL_HANDLERS = {
    staffing: (state) => {
        const size = state.projectInfo?.areaSize || state.technical?.area || 100;
        const type = state.projectInfo?.concept || state.projectInfo?.activity || 'cafe';
        const suggestions = DataService.recommendStaffing(size, type);
        // تدقيق 2026-07-09 (اختبار عميل حي: دراسة مقهى): كان هذا التحويل يُسقط
        // nationality الذي يُرجعه DataService.recommendStaffing بالفعل — فتُحسب GOSI
        // دائماً بمعدل الوافد (2%) حتى لموظفين سعوديين، ولوحة نطاقات/التوطين تعرض
        // 0% بصمت رغم توطين فعلي مرتفع (تناقض مباشر مع جدول الرواتب نفسه).
        return suggestions.map(s => ({
            id: Date.now() + Math.random(),
            position: s.position,
            nationality: s.nationality || 'expat',
            count: s.count,
            salary: s.salary,
            months: 12,
            isVariable: (s.position || '').includes('عامل')
        }));
    },
    // تدقيق 2026-07-08 (ملاحظة حرجة، خبير السوق): كان هذا الزر (المربوط فعلياً في
    // الواجهة) يستدعي DataService.getComplianceCosts — عام تماماً، يفوّت رخصة هيئة
    // الغذاء والدواء (SFDA) الإلزامية للمطاعم رغم أن المنتج مخصص لها. المولّد الأفضل
    // (InternalAIGenerator.generateLicenses) واعٍ بالقطاع ويضيف SFDA للمطاعم/الصحي
    // لكنه كان مربوطاً فقط بزر "اقتراح بنود" منفصل بأسعار مختلفة لنفس البنود — الآن
    // مصدر واحد للتراخيص في كلا الزرين.
    licenses: (state) => {
        const list = InternalAIGenerator.generateLicenses(state);
        return list.map(l => ({
            id: Date.now() + Math.random(),
            name: l.name,
            quantity: l.quantity || 1,
            price: l.price || 0,
            notes: l.notes || ''
        }));
    }
};

// الحقول السردية الطويلة — تُرسم textarea لا سطر إدخال ضيق واحد
const LONG_TEXT_KEYS = ['identityStatement', 'valueProposition', 'problem', 'solution', 'insight', 'insightText', 'whyUs', 'marketSize', 'competitiveAdvantage', 'locationFactors', 'alternativesComparison', 'finalChoiceReason'];

// حقول خطوة معلومات المشروع الأساسية — الباقي يُطوى تحت «حقول متقدمة» لتخفيف النموذج
const PROJECT_INFO_BASIC_KEYS = ['name', 'description', 'city', 'district', 'concept', 'studyType', 'businessModel', 'areaSize', 'targetSegment', 'timeline'];

// هدف حفظ اقتراح العصا السحرية: data-section/data-path الصريحان يسبقان
// خطوة/مفتاح العرض الحاليين — المفتاح قد يكون مساراً متداخلاً داخل قسم آخر
export function getSuggestionUpdateTarget(stepId, key, textarea) {
    const ds = textarea?.dataset || {};
    return {
        section: ds.section || stepId,
        path: ds.path || key
    };
}

export class Wizard {
    constructor(containerId, store, tableSchemas, options = {}) {
        this.container = document.getElementById(containerId);
        this.store = store;
        this.tableSchemas = tableSchemas || {};
        this.tables = {};
        this.currentStepIndex = 0;
        this.steps = options.steps || [];
        // خريطة فهرس محلي(داخل this.steps المُصفّاة)→فهرس مطلق(داخل STEPS الكامل) —
        // يضبطها app.js عبر applyMode() عند تفعيل وضع مصغّر/سريع/بسيط. null في الوضع
        // المتقدم (this.steps === STEPS الكاملة، فالمحلي=المطلق أصلاً).
        this.stepIndexMap = options.stepIndexMap || null;
        this.onNavigate = options.onNavigate || (() => { });
        this.onGoHome = options.onGoHome || (() => { });
        this.lastValidationError = null; // Track last validation error to prevent spam
        this.validationDebounce = null; // Debounce timer
    }

    // مصدر واحد لشريط التنقل + لوحة الإغلاق — كانا مكررين حرفياً بين renderStep()
    // وappendNav() (نفس شرط isLastStep يجب أن يتطابق في الموضعين، تدقيق 2026-07-09)،
    // وهذا بالضبط نمط الخطأ الذي أنتج «undefined» بتسمية الخطوة التالية سابقاً حين
    // نسي تعديل أحد الموضعين الآخر. استخراج الآن لدالة واحدة يمنع تكرار تلك العلة.
    _renderNavHtml(isFirstStep, isLastStep, navCaption, navLabel) {
        const navHtml = `
            <div class="wizard-nav">
                <button type="button" class="btn btn--secondary" id="btnPrevStep" ${isFirstStep ? 'disabled' : ''}>
                    <svg class="ic-nav" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
                    <span>السابق</span>
                </button>
                <div class="nav-indicator">
                    <span class="nav-indicator__caption">${navCaption}</span>
                    <span class="nav-indicator__label">${navLabel}</span>
                </div>
                <button type="button" class="btn btn--primary" id="btnNextStep" ${isLastStep ? 'disabled' : ''}>
                    <span>${isLastStep ? 'اكتملت' : 'التالي'}</span>
                    ${isLastStep
                        ? '<svg class="ic-nav" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>'
                        : '<svg class="ic-nav" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>'}
                </button>
            </div>
        `;
        if (!isLastStep) return navHtml;
        // لوحة إغلاق حقيقية لآخر خطوة — بدل ترك المستخدم بلا أي مسار خروج واضح بعد
        // إكمال الرحلة كاملة. تعيد استخدام نفس البنية التحتية المستخدمة أصلاً في لوحة
        // القرار (DecisionDashboard.js): ExportMenu نفسه، ونفس onNavigate للقفز للوحة
        // القرار، وonGoHome الجديد الذي يوازي مسار شعار الهيدر إلى الرئيسية.
        return navHtml + `
            <div class="wizard-completion">
                <div class="wizard-completion__icon" aria-hidden="true">${icon('i-trophy')}</div>
                <div class="wizard-completion__body">
                    <h3 class="wizard-completion__title">اكتملت خطوات الدراسة</h3>
                    <p class="wizard-completion__desc">اختر ما تريد فعله الآن.</p>
                    <div class="wizard-completion__actions">
                        <button type="button" class="btn btn--secondary" id="btnGoDecisionDashboard">عرض لوحة القرار</button>
                        <button type="button" class="btn btn--secondary" id="btnFinishExport">تصدير الدراسة</button>
                        <button type="button" class="btn btn--primary" id="btnGoHome">العودة للرئيسية</button>
                    </div>
                </div>
            </div>
        `;
    }

    // تدقيق 2026-07-08 (ملاحظة عالية #25): التنقل التالي/السابق كان يحسب
    // this.currentStepIndex±1 مباشرة — لكن currentStepIndex فهرس مطلق (من STEPS
    // الكاملة عبر app.js) بينما this.steps في وضع مصغّر/سريع/بسيط مصفوفة مُصفّاة
    // قصيرة غير متجاورة بالضرورة مع الفهرسة المطلقة. فكانت الخطوة «التالية»
    // تقفز فعلياً لأي خطوة مطلقة تالية (قد تكون متقدمة/مخفية) لا للخطوة التالية
    // ضمن المسار المُصفّى فعلياً. هاتان الدالتان تترجمان بين الفضاءين عبر
    // stepIndexMap (يضبطه app.js)، فتعملان بشكل صحيح في كل الأوضاع.
    _localStepIndex() {
        if (!this.stepIndexMap) return this.currentStepIndex;
        const idx = this.stepIndexMap.indexOf(this.currentStepIndex);
        return idx === -1 ? this.currentStepIndex : idx;
    }

    // خطوة خارج المسار المُصفّى (رابط عميق/بحث/رحلة الدراسة): الفهرس المطلق ليس
    // محلياً — كان يُفسَّر كمحلي فتظهر تسمية «الخطوة التالية» لخطوة عشوائية ويقفز
    // «التالي» لغير جارتها. هنا نحسب الجارين المرئيين الحقيقيين حول الخطوة الحالية.
    _visibleNeighbors() {
        const last = this.steps.length - 1;
        if (!this.stepIndexMap) {
            const i = this.currentStepIndex;
            return { currentLocal: i, prevLocal: i - 1, nextLocal: i + 1, isFirst: i <= 0, isLast: i >= last };
        }
        const found = this.stepIndexMap.indexOf(this.currentStepIndex);
        if (found !== -1) {
            return { currentLocal: found, prevLocal: found - 1, nextLocal: found + 1, isFirst: found === 0, isLast: found === last };
        }
        const ins = this.stepIndexMap.findIndex(abs => abs > this.currentStepIndex);
        if (ins === -1) return { currentLocal: null, prevLocal: last, nextLocal: null, isFirst: false, isLast: true };
        return { currentLocal: null, prevLocal: ins - 1, nextLocal: ins, isFirst: ins === 0, isLast: false };
    }

    _absoluteStepIndex(localIndex) {
        if (!this.stepIndexMap) return localIndex;
        return this.stepIndexMap[localIndex] ?? localIndex;
    }

    renderStep(stepId, metadata, stepIndex = 0) {
        if (!this.container) return;
        this.currentStepIndex = stepIndex;

        const isQuickMode = localStorage.getItem('study_mode_preference') === 'quick';
        let html = `
            <div class="step-content" key="${stepId}">
                <h2 class="animate-entry" style="margin-bottom: var(--s-3)">${metadata.label}</h2>
                ${(function () {
                const help = getStepHelp(stepIndex);
                if (!help || !help.why) return '';

                return `
                    <details class="step-guide mb-4">
                        <summary>دليل مختصر</summary>
                        <div class="step-guide__body">
                            <p><strong>الهدف:</strong> ${help.why}</p>
                            <p><strong>المطلوب:</strong> ${help.how}</p>
                        </div>
                    </details>
                `;
            })()}
                ${stepId === 'assumptions' ? `<div class="alert alert--warning mb-4"><strong>قبل الاعتماد:</strong> وثّق افتراضاتك وموّل 3–6 أشهر من التشغيل كرأس مال عامل.</div>` : ''}
                ${stepId === 'technical' ? `<div class="alert alert--info mb-4"><strong>تجنّب التكرار:</strong> صنّف ما يلزم التشغيل كأصل، وسجّل الأثاث في جدوله المنفصل.</div>
                <div class="card mb-4" id="productionCapacitySuggestCard">
                    <div class="flex-between items-center gap-2 flex-wrap">
                        <p class="text-sm text-muted mb-0" style="flex:1; min-width:220px;">لديك جدول إيرادات أو خدمات مُعبَّأ بالفعل؟ استخرج مقترح «سعة سنوية» منه بدل تعبئتها يدوياً من الصفر.</p>
                        <button type="button" class="btn btn--secondary btn-sm" id="btnSuggestProductionCapacity">${icon('i-sparkle')} اقتراح السعة من الإيرادات</button>
                    </div>
                    <div id="productionCapacitySuggestResult" class="hidden mt-2"></div>
                </div>` : ''}
                ${stepId === 'marketing' ? `<div class="alert alert--info mb-4"><strong>اعتمد الدليل:</strong> استخدم بيانات موثقة للطلب والمنافسة، لا الانطباع الشخصي.</div>` : ''}
                ${stepId === 'revenue' ? `<div class="alert alert--warning mb-4"><strong>تقدير المبيعات:</strong> ابنِ الكمية والسعر على نتائج السوق والمنافسين.</div>` : ''}
        `;

        // ⚠️ FIX: Always get fresh data from store to ensure latest changes are reflected
        // Force a small delay to ensure any pending saves are completed
        // بعض الخطوات معرّفها فريد للتنقل لكن بياناتها في قسم آخر (projectDetails → projectInfo)
        // تدقيق 2026-07-08 (ملاحظة حرجة UX): خطوة تستعير قسم بيانات خطوة أخرى (dataSection)
        // إنما لعرض جداولها الخاصة (products/introServices هنا) — لا لإعادة عرض ~49 حقلاً
        // العامة لتلك الخطوة الأخرى مجدداً. isDataSectionBorrower يمنع ذلك أدناه.
        const isDataSectionBorrower = !!metadata.dataSection;
        stepId = metadata.dataSection || stepId;
        const studyData = this.store.get();
        // وضع «مصغّر»: تقصير الأسئلة داخل الخطوة (حقول/جداول جوهرية فقط) — مصدر واحد
        // wizardSteps.js. غير المصغّر يعرض القسم كاملاً كالمعتاد.
        const studyMode = studyData?.appSettings?.mode || 'advanced';
        const essentialFields = studyMode === 'mini' ? miniEssentialFields(stepId) : null;
        const essentialTables = studyMode === 'mini' ? miniEssentialTables(stepId) : null;
        // Ensure state is initialized
        if (!studyData || !studyData[stepId]) {
            console.warn(`Section ${stepId} not found in store, initializing...`);
            if (!studyData[stepId]) {
                // Initialize section if missing
                const emptyStudy = this.store.getState();
                if (emptyStudy && typeof emptyStudy === 'object') {
                    // Section will be created by schema, but ensure it exists
                }
            }
        }

        let sectionData = studyData[stepId];

        // Auto-fix layout for array-based sections (Migrate Array -> Object)
        const arraySections = ['techResources', 'logistics', 'administrative', 'legal'];
        if (Array.isArray(sectionData) && arraySections.includes(stepId)) {
            console.warn(`Migrating section ${stepId} from Array to Object`);
            const migratedData = { [stepId === 'legal' ? 'licenses' : stepId]: sectionData };
            // Note: Legal used 'licenses' table. Tech uses 'techResources'. Logistics 'logistics'. Admin 'administrative'.
            // Step ID 'legal' -> Schema 'licenses'.
            // Step ID 'techResources' -> Schema 'techResources'.

            if (stepId !== 'legal') {
                this.store.update(stepId, migratedData);
                sectionData = migratedData;
            }
        }

        // Check if this section is an array (like techResources, logistics)
        const isArraySection = Array.isArray(sectionData);

        // Tables to render for this step
        let tablesToRender = metadata.tables || [];
        let optionalTablesToRender = metadata.optionalTables || [];
        if (isQuickMode && stepId === 'projectInfo') {
            // إخفاء الجداول المعقدة من الخطوة الأولى في الوضع السريع
            tablesToRender = tablesToRender.filter(t => !['glossary', 'dataGatheringChecklist'].includes(t));
            optionalTablesToRender = [];
        }
        // وضع مصغّر: الجداول الجوهرية فقط لهذا القسم (وإخفاء الجداول الاختيارية).
        if (essentialTables) {
            tablesToRender = tablesToRender.filter(t => essentialTables.includes(t));
            optionalTablesToRender = [];
        }

        // Render regular fields first (if section is object, not array) — لا لخطوة تستعير
        // قسم بيانات خطوة أخرى فقط لعرض جداولها (isDataSectionBorrower).
        if (!isDataSectionBorrower && !isArraySection && sectionData && typeof sectionData === 'object') {
            const renderEntry = ([key, val]) => {
                // Skip array fields and complex objects - they'll be rendered as tables
                if (Array.isArray(val)) return '';
                if (typeof val === 'object' && val !== null) {
                    // Nested object (like timeline, swot)
                    // التنسيق يأتي من .step-content .card h4 في wizard-forms.css — لا inline styles
                    let part = `<h4>${getLabel(key)}</h4>`;
                    Object.entries(val).forEach(([subKey, subVal]) => {
                        // مرونة الطلب السعرية لها محرر مخصص أغنى في خطوة «تحجيم السوق»
                        // (MarketAnalysis.js) — تدقيق 2026-07-11: كلاهما يكتب نفس المسار
                        // marketing.marketAnalysis.demandElasticity، فتخطّي عرضها هنا
                        // يمنع إدخالاً مزدوجاً لنفس الحقل (خلافاً لـswot/towsMatrix أعلاه،
                        // هذا الحقل متداخل داخل marketAnalysis لا في المستوى الأعلى مباشرة).
                        if (stepId === 'marketing' && key === 'marketAnalysis' && subKey === 'demandElasticity') return;
                        // null قيمة مشروعة لحقل رقمي اختياري (dsoDays مثلاً) —
                        // typeof null === 'object' كان يتخطاها فلا تظهر إطلاقاً
                        if (!Array.isArray(subVal) && (subVal === null || typeof subVal !== 'object')) {
                            part += this.renderField(stepId, `${key}.${subKey}`, subKey, subVal);
                        }
                    });
                    return part;
                }
                return this.renderField(stepId, key, key, val);
            };

            if (stepId === 'projectInfo') {
                // ~49 حقلاً دفعة واحدة تُرهق المستخدم — الأساسي يظهر مباشرة والباقي مطوي.
                // وضع مصغّر: نكتفي بالحقول الجوهرية (essentialFields) ولا نعرض المطويّ إطلاقاً.
                const entries = Object.entries(sectionData);
                const basicKeys = essentialFields || PROJECT_INFO_BASIC_KEYS;
                const basicHtml = entries.filter(([k]) => basicKeys.includes(k)).map(renderEntry).join('');
                html += `<div class="card form-grid">${basicHtml}</div>`;
                if (!essentialFields) {
                    const advancedHtml = entries.filter(([k]) => !PROJECT_INFO_BASIC_KEYS.includes(k)).map(renderEntry).join('');
                    if (advancedHtml.trim()) {
                        html += `
                        <details class="card advanced-fields mt-4">
                            <summary style="cursor: pointer; font-weight: 600; padding: 0.5rem 0;">حقول متقدمة (اختيارية) — يمكنك العودة لها لاحقاً</summary>
                            <div class="form-grid mt-3">${advancedHtml}</div>
                        </details>
                    `;
                    }
                }
            } else {
                // SWOT/TOWS لهما محرر غني مخصص في خطوة «التحليل الاستراتيجي» (مع مزامنة
                // ثنائية في store.js) — عرض حقولهما هنا أيضاً كان إدخالاً مزدوجاً مربكاً
                // لنفس البيانات في خطوتين (وبنسخة أفقر تنقصها «الفرص» أصلاً).
                // marketingMix (4P) له محرر مخصص أغنى (زر توليد AI + نص إرشادي لكل حقل)
                // في خطوة «تحجيم السوق» (MarketAnalysis.js) — تدقيق 2026-07-11: كلاهما
                // كانا يكتبان نفس المسار marketing.marketingMix، فيظهر الحقل مرتين.
                const editedElsewhere = stepId === 'marketing' ? ['swot', 'towsMatrix', 'marketingMix'] : [];
                html += `<div class="card form-grid">`;
                Object.entries(sectionData)
                    .filter(([key]) => !editedElsewhere.includes(key))
                    // وضع مصغّر: الحقول الجوهرية فقط لهذا القسم (الافتراضات مثلاً).
                    .filter(([key]) => !essentialFields || essentialFields.includes(key))
                    .forEach(entry => { html += renderEntry(entry); });
                html += `</div>`;
                if (editedElsewhere.length) {
                    html += `<p class="text-sm text-muted mt-2">التحليل الرباعي (SWOT) ومصفوفة الاستراتيجيات (TOWS) تحرّرهما في خطوة «التحليل الاستراتيجي»، والمزيج التسويقي (4P) في خطوة «تحجيم السوق».</p>`;
                }
            }
        }

        // Add table containers
        tablesToRender.forEach(tableKey => {
            html += `<div id="table-${tableKey}" class="mt-4"></div>`;
            // تدقيق اختبار عميل 2026-07-12: إجمالي هذا الجدول (بلا تصاعد) يختلف عمداً
            // عن رقم «السنة الأولى» في القوائم المالية (بعد rampUpMonths) — كان يُقرأ
            // خطأً كخلل حسابي عند تغيير السعر. راجع _wireRevenueReconciliationNote.
            if (tableKey === 'revenueStreams') {
                html += `<p id="revenue-reconciliation-note" class="text-muted mt-2" style="font-size:.85em"></p>`;
            }
        });
        if (optionalTablesToRender.length) {
            html += `
                <details class="optional-step-tools mt-4">
                    <summary>قائمة تجهيز البيانات (اختيارية)</summary>
                    <div class="optional-step-tools__body">
                        ${optionalTablesToRender.map(tableKey => `<div id="table-${tableKey}"></div>`).join('')}
                    </div>
                </details>`;
        }

        // Navigation buttons — الجيران المرئيون الحقيقيون في كل الأوضاع (راجع _visibleNeighbors أعلاه).
        const nb = this._visibleNeighbors();
        const isFirstStep = nb.isFirst;
        const isLastStep = nb.isLast;
        const showNav = this.steps.length > 1;

        if (showNav) {
            // أسهم SVG بدل الرموز النصية — الاتجاهات صحيحة في RTL (السابق يميناً، التالي يساراً)
            // في آخر خطوة: لا وعد بإجراء «قادم» غير موجود — رسالة حالة صادقة بدل «إنهاء الدراسة»
            // (تدقيق 2026-07-09: كانت التسمية توحي بأن الضغط على «التالي» سيُنهي شيئاً، بينما
            // معالج النقر لا يفعل شيئاً إطلاقاً عند آخر خطوة — راجع bindNavigationEvents أدناه).
            const navCaption = isLastStep ? 'الحالة' : 'الخطوة التالية';
            const navLabel = isLastStep ? 'اكتملت خطوات الدراسة' : (this.steps[nb.nextLocal]?.label || 'القسم التالي');
            html += this._renderNavHtml(isFirstStep, isLastStep, navCaption, navLabel);
        }

        if (stepId === 'marketing') {
            html += `<div id="marketingChart" class="mt-4 card" style="display:none; min-height:200px;"></div>`;
        } else if (stepId === 'staffing') {
            html += `<div id="staffingChart" class="mt-4 card" style="display:none; min-height:200px;"></div>`;
        } else if (stepId === 'technical') {
            html += `<div class="card analysis-card mt-4">
                        <h3 class="card-title">تحليل الموقع الجغرافي</h3>
                        <p class="text-muted text-sm mb-3">حدد موقع المشروع لتقييم الكثافة وقربه من المنافسين والموردين.</p>
                        <div id="technicalMap" style="height: 300px; border-radius: 8px; z-index: 1;"></div>
                     </div>`;
        }

        html += `</div>`; // Close step-content
        this.container.innerHTML = html;

        // Render Charts after HTML insertion
        setTimeout(() => {
            if (stepId === 'marketing') {
                const chartContainer = document.getElementById('marketingChart');
                if (chartContainer && sectionData?.competitors?.length > 0) {
                    chartContainer.style.display = 'block';
                    ReviewCharts.renderMarketingMix('marketingChart', studyData);
                }
            } else if (stepId === 'staffing') {
                const chartContainer = document.getElementById('staffingChart');
                if (chartContainer && sectionData?.length > 0) { // staffing is array in schema usually?
                    // Actually staffing stores its data in the section root if specialized, or as 'positions' table? 
                    // Let's check Schema. 'staffing' uses 'positions' table usually. 
                    // Wizard renders tables. The data is in studyData.staffing probably if specialized.
                    // Wait, Wizard lines 68 show migration logic? 
                    // Let's rely on studyData passed to ReviewCharts.
                    chartContainer.style.display = 'block';
                    ReviewCharts.renderStaffingCost('staffingChart', { staffing: this.store.get().staffing?.positions || [] });
                }
            } else if (stepId === 'technical') {
                const mapEl = document.getElementById('technicalMap');
                if (mapEl) {
                    Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]).then(([{ default: L }]) => {
                        if (!this.container?.contains(mapEl)) return;
                        const map = L.map('technicalMap').setView([24.7136, 46.6753], 12); // Riyadh center
                        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                            attribution: '© OpenStreetMap contributors'
                        }).addTo(map);
                        const marker = L.marker([24.7136, 46.6753], {draggable: true}).addTo(map);
                        marker.bindPopup('<b>موقع المشروع المقترح</b><br>اسحب لتحديد الموقع الدقيق.').openPopup();
                    });
                }
            }
        }, 300);

        // Bind navigation events
        this.bindNavigationEvents();

        // Bind regular input events
        this.container.querySelectorAll('input, select, textarea').forEach(input => {
            if (input.classList.contains('table-input')) return;
            input.addEventListener('change', (e) => {
                this.updateStore(stepId, input.dataset.key, e.target.type, e.target.value, e.target.checked);
            });
        });

        // Initialize Financial Upgrades if step is Assumptions
        if (stepId === 'assumptions' || stepId === 'financing') {
            this.container.querySelectorAll('input[type="number"]').forEach(input => {
                if (input.dataset.key?.includes('Rate') || input.dataset.key?.includes('contingencyRate')) {
                    input.style.display = 'none';
                    const sliderDiv = document.createElement('div');
                    sliderDiv.style.margin = '20px 10px';
                    input.parentNode.insertBefore(sliderDiv, input.nextSibling);
                    
                    const max = input.dataset.key.includes('contingency') ? 50 : 100;
                    // تدقيق حي 2026-07-16: input.value هنا هو بالفعل رقم النسبة المئوية
                    // المعروض (مثلاً "10" لـ discountRate=0.10) — renderField يحوّله من
                    // الكسر المخزَّن قبل هذا الكود (pctDisplay = value*100، انظر أعلى
                    // الملف). ×100 هنا كان يضاعف التحويل فيصل startVal إلى 1000 لحقل
                    // قيمته الفعلية 10%، فيُقصّ Slider القيمة عند سقفه (100 أو 50) ويعرض
                    // تلميحاً مضلِّلاً «100%»/«50%» مهما كانت القيمة الحقيقية.
                    const startVal = parseFloat(input.value) || 0;

                    try {
                        noUiSlider.create(sliderDiv, {
                            start: [startVal],
                            connect: [true, false],
                            step: 1,
                            range: { 'min': 0, 'max': max },
                            tooltips: true,
                            format: {
                                to: value => parseInt(value) + '%',
                                from: value => Number(value.replace('%', ''))
                            }
                        });
                        sliderDiv.noUiSlider.on('change', (values) => {
                            // نفس الخلل بالاتجاه المعاكس: values[0] رقم نسبة مئوية جاهز
                            // (مثلاً 10) — updateStore أدناه (isFractionPercentKey) هو من
                            // يحوّله لكسر (÷100) عند الحفظ. القسمة هنا كانت تُطبَّق مرتين
                            // فتُخزَّن القيمة أصغر 100 مرة من المُدخلة فعلياً (10% → 0.001
                            // بدل 0.10) — تلاعب صامت بأرقام القرار المالي دون أي خطأ ظاهر.
                            input.value = parseFloat(values[0]) || 0;
                            input.dispatchEvent(new Event('change'));
                        });
                    } catch(e) { console.error('Slider error', e); }
                } else if (input.type !== 'number' && !input.dataset.key?.includes('projectionYears') && !input.dataset.key?.includes('Months')) {
                    // AutoNumeric لا يدعم input[type=number] إطلاقاً (يرمي خطأً دائماً — انظر
                    // توثيقه). كانت المحاولة تفشل بصمت هنا على كل حقول العتبات/الأيام
                    // (thresholds.*, workingCapitalPolicy.*Days) في كل مرة تُرسم فيها هذه
                    // الخطوة، فتُغرق الـconsole بأخطاء متكررة بلا أي أثر فعلي.
                    try {
                        new AutoNumeric(input, {
                            currencySymbol: '',
                            decimalPlaces: 0,
                            digitGroupSeparator: ','
                        });
                    } catch(e) { console.error('AutoNumeric error', e); }
                }
            });
        }

        // عصا سحرية: اقتراح/إعادة صياغة تدفقية لكل textarea
        this.container.querySelectorAll('.btn-magic-wand').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const key = btn.getAttribute('data-key');
                const textarea = btn.closest('.input-with-ai')?.querySelector('textarea');
                if (!key || !textarea) return;
                if (btn.disabled) return;
                const state = this.store.get();
                const currentValue = textarea.value || '';
                // حماية من فقدان النص: إن كان الحقل يحوي كتابة فعلية للمستخدم، نؤكّد قبل الاستبدال.
                // يجب أن يحدث هذا التحقق قبل أي تغيير في حالة الزر (disabled/aria-busy/title)
                // وإلا يبقى الزر معطّلاً للأبد إن ضغط المستخدم "إلغاء" (bug: زر عالق).
                if (currentValue.trim().length > 0 &&
                    !confirm('سيستبدل الاقتراح النصَّ الحالي في هذا الحقل. هل تريد المتابعة؟')) {
                    return;
                }
                btn.disabled = true;
                btn.setAttribute('aria-busy', 'true');
                const originalTitle = btn.getAttribute('title');
                btn.setAttribute('title', 'جاري التوليد...');
                const previousValue = currentValue; // للتراجع عند الفشل
                trackEvent('ai_wand_use', { type: 'text', key });
                try {
                    await generateSuggestionStreaming(key, currentValue, state, {
                        onChunk: (chunk) => { textarea.value = chunk; },
                        onDone: () => {
                            const target = getSuggestionUpdateTarget(stepId, key, textarea);
                            this.store.updatePath(target.section, target.path, textarea.value);
                            btn.disabled = false;
                            btn.removeAttribute('aria-busy');
                            btn.setAttribute('title', originalTitle || 'اقتراح أو إعادة صياغة');
                            toast.success('تم اقتراح النص. يمكنك التعديل كما تريد.');
                        },
                        onError: (msg) => {
                            textarea.value = previousValue; // استعادة نص المستخدم عند الفشل
                            btn.disabled = false;
                            btn.removeAttribute('aria-busy');
                            btn.setAttribute('title', originalTitle || 'اقتراح أو إعادة صياغة');
                            toast.error(msg || 'فشل التوليد');
                        }
                    });
                } catch (err) {
                    btn.disabled = false;
                    btn.removeAttribute('aria-busy');
                    btn.setAttribute('title', originalTitle || 'اقتراح أو إعادة صياغة');
                    toast.error('فشل اقتراح النص');
                }
            });
        });

        // Render dynamic tables - ensure we use fresh data
        // ⚠️ FIX: Re-fetch data right before rendering tables to ensure latest changes
        const freshStudyData = this.store.get();
        [...tablesToRender, ...optionalTablesToRender].forEach(tableKey => {
            this.renderTable(stepId, tableKey, freshStudyData);
        });
        if ([...tablesToRender, ...optionalTablesToRender].includes('revenueStreams')) {
            this._wireRevenueReconciliationNote();
        }
        if (stepId === 'technical') {
            this._wireProductionCapacitySuggestion(stepId, metadata, stepIndex);
        }
    }

    /**
     * زر «اقتراح السعة من الإيرادات» في خطوة الأصول والتجهيزات (بند 1.2، خطة 2026-07-12):
     * generateProductionCapacity كانت دالة مكتوبة أصلاً وغير موصولة بأي زر. اقتراح بنقرتين
     * (اعرض ثم طبّق) لا تعبئة صامتة — وإلا صار فحص الطاقة دائرياً (يشتق سقفه من نفس الرقم
     * الذي يفترض قياسه).
     */
    _wireProductionCapacitySuggestion(stepId, metadata, stepIndex) {
        const btn = this.container.querySelector('#btnSuggestProductionCapacity');
        const resultBox = this.container.querySelector('#productionCapacitySuggestResult');
        if (!btn || !resultBox) return;

        btn.addEventListener('click', () => {
            if (btn.disabled) return;
            try {
                const state = this.store.get();
                const suggestion = InternalAIGenerator.generateProductionCapacity(state);
                if (!suggestion?.annualCapacity) {
                    toast.info('لا تتوفر بيانات كافية في جدول الإيرادات/الخدمات لاشتقاق سعة سنوية بعد.');
                    return;
                }
                resultBox.classList.remove('hidden');
                resultBox.innerHTML = `
                    <div class="alert alert--info">
                        <span>مقترح: <strong>${suggestion.annualCapacity.toLocaleString('ar-SA')}</strong> ${escapeHtml(suggestion.unitOrMeasure)} — مشتق من جدول الإيرادات/الخدمات الحالي.</span>
                        <button type="button" class="btn btn--sm btn--primary" id="btnApplyProductionCapacity">تطبيق على «السعة السنوية»</button>
                    </div>
                `;
                resultBox.querySelector('#btnApplyProductionCapacity')?.addEventListener('click', () => {
                    const current = this.store.get();
                    this.store.updatePath(stepId, 'productionCapacity', {
                        ...(current[stepId]?.productionCapacity || {}),
                        annualCapacity: suggestion.annualCapacity,
                        unitOrMeasure: suggestion.unitOrMeasure,
                        marketShareLink: suggestion.marketShareLink
                    });
                    toast.success('طُبِّق اقتراح السعة السنوية — راجعه وعدّله حسب واقعك.');
                    this.renderStep(stepId, metadata, stepIndex);
                });
            } catch (err) {
                console.error('generateProductionCapacity error:', err);
                toast.error('تعذّر توليد اقتراح السعة');
            }
        });
    }

    /** يحدّث ملاحظة مطابقة إجمالي جدول الإيرادات مع رقم السنة الأولى بعد كل تعديل. */
    _updateRevenueReconciliationNote() {
        const note = this.container.querySelector('#revenue-reconciliation-note');
        if (!note) return;
        const state = this.store.get();
        note.textContent = describeRevenueRampGap(state?.revenue?.streams, state?.assumptions?.rampUpMonths);
    }

    _wireRevenueReconciliationNote() {
        const table = this.tables?.revenueStreams;
        if (!table) return;
        const originalOnChange = table.onChange;
        table.onChange = (newData) => {
            originalOnChange(newData);
            this._updateRevenueReconciliationNote();
        };
        this._updateRevenueReconciliationNote();
    }

    bindNavigationEvents() {
        const prevBtn = document.getElementById('btnPrevStep');
        const nextBtn = document.getElementById('btnNextStep');

        this.container.querySelectorAll('.wizard-map-step').forEach(button => {
            button.addEventListener('click', () => {
                const index = Number(button.dataset.wizardStepIndex);
                if (Number.isInteger(index) && index >= 0) this.onNavigate(index);
            });
        });

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                const nb = this._visibleNeighbors();
                if (!nb.isFirst && nb.prevLocal >= 0) {
                    this.onNavigate(this._absoluteStepIndex(nb.prevLocal));
                }
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                const nb = this._visibleNeighbors();
                if (nb.isLast || nb.nextLocal == null) return;
                // خطوة خارج المسار المرئي لا تملك إعدادات ضمن this.steps — تُتجاوز صلاحيتها
                const currentStep = nb.currentLocal != null ? this.steps[nb.currentLocal] : null;
                if (!currentStep || this.validateStep(currentStep)) {
                    this.onNavigate(this._absoluteStepIndex(nb.nextLocal));
                }
            });
        }

        // أزرار لوحة إغلاق آخر خطوة (تدقيق 2026-07-10) — موجودة فقط في DOM عند isLastStep،
        // فالحراسة هنا كافية بلا حاجة لتمرير isLastStep صراحة.
        const goDecisionBtn = document.getElementById('btnGoDecisionDashboard');
        if (goDecisionBtn) {
            goDecisionBtn.addEventListener('click', () => {
                const localIdx = this.steps.findIndex(s => s.isDecisionDashboard);
                const targetLocalIdx = localIdx !== -1 ? localIdx : Math.max(0, this.steps.length - 5);
                this.onNavigate(this._absoluteStepIndex(targetLocalIdx));
            });
        }

        const finishExportBtn = document.getElementById('btnFinishExport');
        if (finishExportBtn) {
            finishExportBtn.addEventListener('click', async () => {
                try {
                    const { ExportMenu } = await import('./ExportMenu.js');
                    new ExportMenu('exportMenuOverlay', this.store).open();
                } catch (err) {
                    console.error('ExportMenu load failed:', err);
                    toast.error('تعذّر فتح قائمة التصدير');
                }
            });
        }

        const goHomeBtn = document.getElementById('btnGoHome');
        if (goHomeBtn) {
            goHomeBtn.addEventListener('click', () => this.onGoHome());
        }
    }

    appendNav(stepIndex) {
        this.currentStepIndex = stepIndex;
        const nb = this._visibleNeighbors();
        const isFirstStep = nb.isFirst;
        const isLastStep = nb.isLast;
        const showNav = this.steps.length > 1;

        if (!showNav) return;

        // Check if navbar already exists in container
        let nav = this.container.querySelector('.wizard-nav');
        if (nav) {
            nav.remove();
        }
        const existingCompletion = this.container.querySelector('.wizard-completion');
        if (existingCompletion) {
            existingCompletion.remove();
        }

        // في آخر خطوة: لا وعد بإجراء «قادم» غير موجود — رسالة حالة صادقة بدل «إنهاء الدراسة»
        // (تدقيق 2026-07-09)، ولوحة إغلاق حقيقية بإجراءات فعلية (تدقيق 2026-07-10) —
        // كلاهما عبر _renderNavHtml() المشتركة مع renderStep أعلاه.
        const navCaption = isLastStep ? 'الحالة' : 'الخطوة التالية';
        const nextStepLabel = isLastStep ? 'اكتملت خطوات الدراسة' : (this.steps[nb.nextLocal]?.label || 'القسم التالي');
        const navHtml = this._renderNavHtml(isFirstStep, isLastStep, navCaption, nextStepLabel);

        this.container.insertAdjacentHTML('beforeend', navHtml);
        this.bindNavigationEvents();
    }

    renderTable(stepId, tableKey, studyData) {
        const containerId = `table-${tableKey}`;
        const container = document.getElementById(containerId);
        if (!container) return;

        // --- SMART FILL: from TABLE_SCHEMAS[tableKey].smartFill (config-driven) ---
        const smart = this.tableSchemas[tableKey]?.smartFill;
        const handler = smart?.dataKey && SMART_FILL_HANDLERS[smart.dataKey];
        if (handler && smart.label) {
            const btnId = `btn-smart-${tableKey}`;
            // تسمية schema تبدأ بـ🪄 — نجرّدها ونضع أيقونة sprite موحّدة بدل الإيموجي.
            const labelHtml = `${icon('i-sparkle')} ${stripEmoji(smart.label)}`;
            if (!document.getElementById(btnId)) {
                const btnHtml = `
                    <div class="flex-between mb-2">
                        <span></span>
                        <button id="${btnId}" class="btn-xs btn-magic">${labelHtml}</button>
                    </div>
                `;
                container.insertAdjacentHTML('beforebegin', btnHtml);

                document.getElementById(btnId).addEventListener('click', (e) => {
                    e.target.disabled = true;
                    e.target.textContent = 'جاري البحث…';
                    try {
                        const state = this.store.get();
                        const newData = handler(state);
                        this.store.updatePath(stepId, this.getRelativePath(tableKey), newData);
                        if (this.tables[tableKey]) {
                            this.tables[tableKey].data = newData;
                            this.tables[tableKey].render();
                        }
                        e.target.textContent = 'تم الجلب بنجاح';
                        setTimeout(() => { e.target.innerHTML = labelHtml; }, 2000);
                    } catch (err) {
                        console.error('Smart fill handler failed:', err);
                        toast.error('تعذّر الجلب التلقائي');
                        e.target.innerHTML = labelHtml;
                    } finally {
                        e.target.disabled = false;
                    }
                });
            }
        }
        // -------------------------------------------------------------------------

        // بحث موردين حقيقيين قريبين (Overpass/OSM) — يكمّل زر «اقتراح بنود» (نص AI)
        // بمصدر بيانات حيّ وموقعي فعلي بدل توليد نصي فقط؛ راجع ChamberSuppliersConnector.js.
        if (tableKey === 'suppliers' && !document.getElementById('btn-real-suppliers')) {
            const realBtnHtml = `
                <div class="flex-between mb-2">
                    <span></span>
                    <button id="btn-real-suppliers" type="button" class="btn-xs btn-magic">${icon('i-pin')} بحث موردين حقيقيين قريبين</button>
                </div>
            `;
            container.insertAdjacentHTML('beforebegin', realBtnHtml);

            document.getElementById('btn-real-suppliers').addEventListener('click', async (e) => {
                const btn = e.currentTarget;
                if (btn.disabled) return;
                btn.disabled = true;
                const originalHtml = btn.innerHTML;
                btn.textContent = 'جاري البحث…';
                try {
                    const projectInfo = this.store.get().projectInfo || {};
                    // نفس منطق تحليل موقع السوق (MarketAnalysis.js): إحداثيات فعلية فقط
                    // من locationAnalysis.coordinates — projectInfo.coords غير موجود بالمخطط.
                    const coords = projectInfo.locationAnalysis?.coordinates;
                    const hasRealCoords = coords && Number.isFinite(Number(coords.lat)) && Number.isFinite(Number(coords.lng));
                    const live = await suggest('market.suppliers', {
                        city: projectInfo.city,
                        coords: hasRealCoords ? coords : undefined
                    });

                    if (isUsable(live)) {
                        const sample = Array.isArray(live.value?.sample) ? live.value.sample : [];
                        if (sample.length > 0) {
                            const kindLabel = { shop: 'تجارة جملة', office: 'مكتب تجاري', craft: 'حرفي/تصنيع صغير' };
                            const citation = [live.source, live.note].filter(Boolean).join(' — ');
                            const newRows = sample.map(s => ({
                                name: s.name,
                                supplyNature: kindLabel[s.kind] || '',
                                availability: '',
                                avgDeliveryDays: 0,
                                notes: citation
                            }));
                            const table = this.tables['suppliers'];
                            if (table) {
                                table.data = [...table.data, ...newRows];
                                table.onChange(JSON.parse(JSON.stringify(table.data)));
                                table.render();
                            }
                            toast.success(`عُثر على ${live.value.count} منشأة قريبة فعلياً (OpenStreetMap) — أُضيفت ${newRows.length} كصفوف، راجع طبيعة التوريد والتوفر يدوياً.`);
                        } else {
                            toast.info('لم يُعثر على منشآت قريبة حقيقية ضمن نصف القطر — جرّب موقعاً آخر أو أدخل يدوياً.');
                        }
                    } else {
                        toast.error(live.note || 'تعذّر البحث عن موردين حقيقيين قريبين.');
                    }
                } catch (err) {
                    console.error('Real suppliers search error:', err);
                    toast.error('تعذّر البحث عن موردين حقيقيين قريبين.');
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = originalHtml;
                }
            });
        }
        // -------------------------------------------------------------------------

        const schema = this.tableSchemas[tableKey];
        if (!schema) {
            console.warn(`No schema for table: ${tableKey}`);
            return;
        }

        // Determine data path
        const dataPath = this.getTableDataPath(stepId, tableKey);
        const tableData = this.getNestedValue(studyData, dataPath) || [];

        // Suggestions Map: مباني/معدات/أثاث/تقنية من الذكاء الداخلي؛ الباقي schema.aiPrompt + AIConnector
        const proj = () => this.store.get().projectInfo || {};
        const suggestionsMap = {
            'buildings': async () => InternalAIGenerator.generateBuildings({ projectInfo: proj() }),
            'equipment': async () => InternalAIGenerator.generateEquipment({ projectInfo: proj() }),
            'furniture': async () => InternalAIGenerator.generateFurniture({ projectInfo: proj() }),
            'techResources': async () => InternalAIGenerator.generateTechResources({ projectInfo: proj() }),
            'locationAssessment': async () => InternalAIGenerator.generateLocationFactors({ projectInfo: proj() }),
            'establishmentCosts': async () => InternalAIGenerator.generateEstablishmentCosts({ projectInfo: proj() }),
            'suppliers': async () => InternalAIGenerator.generateSuppliers({ projectInfo: proj() }),
            'competitorBenchmarking': async () => InternalAIGenerator.generateCompetitorBenchmark(this.store.get()),
            'operationalKpis': async () => InternalAIGenerator.generateOperationalKpis({ projectInfo: proj() })
        };
        const onSuggest = suggestionsMap[tableKey] || (schema.aiPrompt ? async (btn) => {
            if (btn && btn.disabled) return;
            const originalText = btn ? btn.textContent : '';
            if (btn) {
                btn.disabled = true;
                btn.textContent = 'جاري التوليد...';
            }

            try {
                const state = this.store.get();
                const projectInfo = state.projectInfo || {};

                // Use unified AI service
                const data = await generateTableSuggestions(schema.aiPrompt, projectInfo);

                // Ensure we have valid array data
                if (!data) {
                    console.warn('No data returned from generateTableSuggestions');
                    return [];
                }

                if (Array.isArray(data) && data.length > 0) {
                    // Enrich data with IDs - return for DynamicTable to handle merging
                    const enriched = data.map((item, index) => ({
                        ...item,
                        id: item.id || Date.now() + index + Math.random()
                    }));

                    // Return data so DynamicTable can merge it with existing data
                    return enriched;
                }

                // If data is empty array or invalid, return empty
                console.warn('Empty or invalid data returned from generateTableSuggestions');
                return [];
            } catch (err) {
                console.error('AI Table Error:', err);
                // Don't show alert here, let DynamicTable handle it
                // The fallback should have been used in generateTableSuggestions
                return [];
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = originalText;
                }
            }
        } : null);

        // بند 1.1 (خطة 2026-07-12): جدول الرواتب (positions) يعرض شريط تلميح اختياري
        // من آخر نتيجة لمحاكاة التشغيل والازدحام (operational.lastResult) — اقتراح
        // بنقرة لا تطبيق تلقائي صامت (يحترم القرار الموثّق ضد الكتابة التلقائية
        // + اختبار batch6.operationalSimDisclosure).
        const hintHtml = tableKey === 'positions' ? this._buildStaffingSuggestionHint(studyData) : null;

        const table = new DynamicTable(containerId, {
            ...schema,
            id: tableKey,
            initialData: Array.isArray(tableData) ? tableData : [],
            onSuggest, // Inject suggestions
            hintHtml,
            onHintAction: tableKey === 'positions'
                ? (action) => this._applyStaffingSuggestion(action, tableKey)
                : undefined,
            onChange: (newData) => {
                // جدول الموردين مسجّل فعلياً تحت قسم 'marketing' (يقرأه partnerNeeds.js
                // وsectionExporter.js لتحليل فجوة الموردين وتصدير القسم التسويقي) حتى لو
                // عُرض من خطوة الأشخاص الرئيسين — الكتابة يجب أن تستهدف نفس القسم دائماً.
                const targetSection = tableKey === 'suppliers' ? 'marketing' : stepId;
                this.store.updatePath(targetSection, this.getRelativePath(tableKey), newData);
            }
        });

        table.container = container;
        table.render();
        this.tables[tableKey] = table;

        if (tableKey === 'positions') {
            this._bindLiveStaffingHint(table);
            this._renderNitaqatHrCard(container, studyData);
        }

        if (tableKey === 'keyPeople') {
            this._renderKeyPeopleSectorGapCard(container, studyData);
        }

        if (tableKey === 'licenses') {
            this._renderLicensingGapCard(container, studyData);
        }

        if (tableKey === 'partnershipContracts') {
            this._renderContractRiskScanPanel(container);
        }
    }

    /**
     * بطاقة نطاقات (Nitaqat) + مقارنة تكلفة سعودي/وافد — تُعرض دائماً أسفل جدول «الوظائف
     * والرواتب» (بخلاف بطاقة الفجوة القطاعية لكبار الموظفين، لا تشترط اكتشاف قطاع
     * مسبقاً: مقارنة التكلفة مفيدة حتى بلا قطاع مكتشَف). كل المنطق في nitaqatHrCard.js
     * (نقي، مختبَر منفصلاً) — هذه الدالة تُحوّله فقط إلى HTML (مهمة Nitaqat، دفعة 4).
     */
    _renderNitaqatHrCard(container, studyData) {
        const cardId = 'nitaqatHrCard';
        document.getElementById(cardId)?.remove();

        const data = buildNitaqatHrCardData(studyData);

        const tierHtml = data.tierInfo ? `
            <p class="mb-1">${icon('i-users')} نسبة التوطين الحالية <strong>${formatFractionAsPercent(data.rate, 0)}</strong>
                تقع تقريبياً ضمن نطاق «<strong>${escapeHtml(data.tierInfo.label)}</strong>»${data.sectorLabel ? ` (تقدير مبسّط لقطاع «${escapeHtml(data.sectorLabel)}»)` : ''}.
                ${!data.tierInfo.isCompliant ? `<span class="text-danger">هذا أقل من الحد الأدنى التقريبي للالتزام (${formatFractionAsPercent(data.tierInfo.minCompliantRate, 0)}) — راجع حسابك في منصة قوى.</span>` : ''}
            </p>
            <p class="text-xs text-muted mb-2">تصنيف تقريبي تعليمي وليس رقماً رسمياً منشوراً — النسبة الملزمة الدقيقة تُحسب بمعادلة رسمية تختلف حسب نشاطك وحجم منشأتك، راجعها في منصة قوى (qiwa.sa).</p>
        ` : `<p class="mb-1 text-muted">أضف موظفين في الجدول أعلاه لعرض تصنيف نطاقك التقريبي.</p>`;

        const costHtml = `
            <p class="mb-1">${icon('i-info')} تكلفة سنوية تقديرية (${data.avgSalaryIsAssumed ? 'مثال توضيحي براتب أساسي شهري' : 'بمتوسط الراتب الأساسي الشهري المُدخل'} ${formatCurrency(data.avgSalary)}):</p>
            <ul class="text-sm mb-0">
                <li>موظف سعودي: <strong>${formatCurrency(data.saudiAnnualCost)}</strong>/سنة</li>
                <li>موظف وافد: <strong>${formatCurrency(data.expatAnnualCost)}</strong>/سنة</li>
            </ul>
            <p class="text-xs text-muted mt-1 mb-0">معدل التأمينات الاجتماعية (GOSI) المستخدم كما بتاريخ 2026 — لا تغذية حية، راجع gosi.gov.sa لأي تحديث رسمي لاحق.</p>
        `;

        const cardHtml = `
            <div class="alert alert--info mt-2" id="${cardId}">
                ${tierHtml}
                ${costHtml}
            </div>
        `;
        container.insertAdjacentHTML('afterend', cardHtml);
    }

    /**
     * تنبيه استشاري: تراخيص شائعة لنشاط المشروع المكتشَف (نفس قائمة زر "اقتراح بنود"
     * لهذا الجدول تحديداً — لا مصدر ثانٍ) لم تُدرَج بعد. صمت تام إن تعذّر اكتشاف
     * القطاع أو كانت القائمة مكتملة أصلاً — لا نص "لا يوجد نقص" مزعج.
     */
    _renderLicensingGapCard(container, studyData) {
        const cardId = 'licensingGapCard';
        document.getElementById(cardId)?.remove();

        let missing = [];
        try { missing = findMissingCommonLicenses(studyData) || []; } catch (_) { missing = []; }
        if (!missing.length) return;

        const cardHtml = `
            <div class="alert alert--info mt-2" id="${cardId}">
                <p class="mb-0">${icon('i-info')} تراخيص شائعة لأنشطة مشابهة لم تُدرَج بعد: ${missing.map(escapeHtml).join('، ')} — تنبيه استرشادي فقط، راجع الجهة المختصة لمتطلباتك الفعلية.</p>
            </div>
        `;
        container.insertAdjacentHTML('afterend', cardHtml);
    }

    /**
     * فحص أولي (بحث كلمات مفتاحية، لا فهم لغوي حقيقي) لأهم بنود/مخاطر شائعة في نص
     * عقد شراكة يلصقه المستخدم يدوياً أو يرفعه كملف .txt — لا استخراج من PDF (يحتاج
     * مكتبة تحليل PDF غير موجودة في المشروع بعد، قرار تبعية مستقبلي) ولا OCR للصور.
     */
    _renderContractRiskScanPanel(container) {
        const cardId = 'contractRiskScanCard';
        document.getElementById(cardId)?.remove();

        const cardHtml = `
            <div class="card mt-2" id="${cardId}">
                <p class="text-sm text-muted mb-1">${icon('i-doc')} فحص أولي لبنود عقد شراكة (كلمات مفتاحية شائعة — ليس فهماً قانونياً حقيقياً، راجع مستشاراً قانونياً دائماً): الصق نص العقد أو ارفع ملف .txt.</p>
                <textarea id="contractRiskScanText" class="input" rows="4" style="width:100%" placeholder="الصق نص العقد هنا..."></textarea>
                <div class="ca-row mt-1">
                    <input type="file" id="contractRiskScanFile" accept=".txt">
                    <button type="button" id="contractRiskScanBtn" class="btn btn--sm btn--secondary">فحص العقد</button>
                </div>
                <div id="contractRiskScanResult" class="mt-2"></div>
            </div>
        `;
        container.insertAdjacentHTML('afterend', cardHtml);

        const card = document.getElementById(cardId);
        const textarea = card.querySelector('#contractRiskScanText');
        card.querySelector('#contractRiskScanFile')?.addEventListener('change', async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            textarea.value = await file.text();
        });
        card.querySelector('#contractRiskScanBtn')?.addEventListener('click', () => {
            const result = scanContractRisks(textarea.value);
            const resultEl = card.querySelector('#contractRiskScanResult');
            if (!result.wordCount) {
                resultEl.innerHTML = `<p class="text-sm text-muted">ألصق نص العقد أولاً.</p>`;
            } else if (!result.flags.length) {
                resultEl.innerHTML = `<p class="text-sm text-muted">لم يُرصد أي من الكلمات المفتاحية الشائعة في هذا النص — هذا لا يعني خلوّه من المخاطر، فقط أن الفحص الأولي لم يجد إشارات معروفة.</p>`;
            } else {
                resultEl.innerHTML = `<ul class="text-sm mb-0">${result.flags.map(f => `<li>${escapeHtml(f.label)}</li>`).join('')}</ul>`;
            }
        });
    }

    /**
     * بطاقة اقتراح غير مزعجة: إن لم يكن لدى الفريق المؤسس خبرة موثّقة في قطاع المشروع
     * المكتشَف، وتوجد قوالب خبراء مسجّلة محلياً (ExpertTemplateService) بنفس القطاع،
     * تُعرض أسماؤهم/تخصصاتهم. صمت تام إن تعذّر اكتشاف القطاع أو لا خبراء مطابقون —
     * السجل محلي وفارغ افتراضياً في أغلب التثبيتات، فلا داعي لنص "لا يوجد" مزعج.
     */
    _renderKeyPeopleSectorGapCard(container, studyData) {
        const cardId = 'keyPeopleSectorGapCard';
        document.getElementById(cardId)?.remove();

        const gap = detectKeyPeopleSectorGap(studyData, getExpertTemplates());
        if (!gap) return;

        const expertsHtml = gap.experts.map(e => `
            <li><strong>${escapeHtml(e.name)}</strong>${e.specialty ? ' — ' + escapeHtml(e.specialty) : ''}</li>
        `).join('');

        const cardHtml = `
            <div class="alert alert--info mt-2" id="${cardId}">
                <p class="mb-1">${icon('i-info')} لا يوجد في فريقك المؤسس خبرة موثّقة في قطاع «${escapeHtml(gap.sectorLabel)}» — خبراء مسجّلون بنفس القطاع قد يفيدونك كمستشارين:</p>
                <ul class="text-sm mb-0">${expertsHtml}</ul>
            </div>
        `;
        container.insertAdjacentHTML('afterend', cardHtml);
    }

    /**
     * تدقيق اختبار قبول 2026-07-12: شريط تلميح جدول الرواتب كان يُبنى مرة واحدة فقط
     * عند renderTable — لو أُعيد تشغيل محاكاة التشغيل لاحقاً بنفس زيارة صفحة التصنيف
     * (StudyCategoryView لا يعيد رسم الخطوات عند تغيّر قسم آخر)، يبقى النص المعروض
     * عالقاً على أول نتيجة بينما زر «إدراج» يُدرج الرقم الصحيح الحديث فعلياً — تناقض
     * مباشر بين ما يقرأه العميل وما يحدث عند الضغط (مُثبَت حياً وتكرّر). اشتراك خفيف
     * يحدّث نص الشريط فقط دون render() كامل.
     */
    _bindLiveStaffingHint(table) {
        if (!this.store?.subscribe) return;
        this.store.subscribe((state, changedSection) => {
            if (!table.container?.isConnected) return;
            if (changedSection && changedSection !== 'operational') return;
            const hintEl = table.container.querySelector('[data-table-hint]');
            if (!hintEl) return;
            const newHint = this._buildStaffingSuggestionHint(state);
            if (newHint) hintEl.innerHTML = newHint;
        });
    }

    /**
     * يبني شريط تلميح اختياري أعلى جدول الرواتب من آخر نتيجة لمحاكاة التشغيل
     * (state.operational.lastResult) — لا يظهر إطلاقاً قبل أول تشغيل للمحاكاة،
     * ولا يكتب أي شيء بنفسه (راجع _applyStaffingSuggestion للفعل الفعلي بنقرة).
     */
    _buildStaffingSuggestionHint(studyData) {
        const lastResult = studyData?.operational?.lastResult;
        const n = lastResult?.recommendedServers;
        if (!n || !Number.isFinite(n) || n <= 0) return null;
        return `${icon('i-info')} <strong>محاكاة التشغيل والازدحام</strong> تقترح <strong>${n}</strong> ${n === 1 ? 'موظف خدمة واحد' : 'موظفي خدمة'} لتغطية الذروة بانتظار أقل من 5 دقائق — رقم استرشادي لنقاط الخدمة فقط (لا يشمل الإدارة/المحاسبة)، ولا يُطبَّق تلقائياً على هذا الجدول. <button type="button" class="btn btn--sm btn--ghost" data-hint-action="insert-suggested-staff">${icon('i-plus')} إدراج كصف مقترح</button>`;
    }

    /** إدراج صف عادي قابل للتعديل بعدد الموظفين المقترح — لا استبدال ولا كتابة صامتة لبقية الجدول. */
    _applyStaffingSuggestion(action, tableKey) {
        if (action !== 'insert-suggested-staff') return;
        const state = this.store.get();
        const n = state.operational?.lastResult?.recommendedServers;
        if (!n) return;
        const table = this.tables[tableKey];
        if (!table) return;

        const newRow = {
            position: 'موظف خدمة (مقترح من محاكاة التشغيل)',
            nationality: 'expat',
            count: n,
            salary: 0,
            months: 12,
            isVariable: false
        };
        table.data = [...table.data, newRow];
        table.onChange(JSON.parse(JSON.stringify(table.data)));
        table.render();
        toast.success(`أُدرج صف مقترح بـ${n} ${n === 1 ? 'موظف خدمة' : 'موظفي خدمة'} — عدّل الراتب والجنسية والعدد حسب واقعك الفعلي.`);
    }

    getTableDataPath(stepId, tableKey) {
        // Map table key to full path in study data
        const mappings = {
            'establishmentCosts': `${stepId}.establishmentCosts`,
            'buildings': `${stepId}.buildings`,
            'equipment': `${stepId}.equipment`,
            'furniture': `${stepId}.furniture`,
            'positions': `${stepId}.positions`,
            'techResources': `${stepId}.techResources`, // Nested array within techResources section
            'logistics': `${stepId}.logistics`, // Nested array within logistics section
            'administrative': `${stepId}.administrative`, // Nested array within administrative section
            'licenses': `${stepId}.licenses`,
            'competitors': `${stepId}.competitors`,
            'campaigns': `${stepId}.campaigns`,
            // مسار ثابت (لا ${stepId}): الجدول يُعرض من خطوة الأشخاص الرئيسين لكن بياناته
            // تبقى تحت 'marketing' (partnerNeeds.js/sectionExporter.js يقرآن من هناك).
            'suppliers': 'marketing.suppliers',
            'competitorBenchmarking': `${stepId}.competitorBenchmarking`,
            'historicalData': `${stepId}.marketAnalysis.historicalData`,
            'supplyDemandBalance': `${stepId}.supplyDemandBalance`,
            'partnershipContracts': `${stepId}.partnershipContracts`,
            'dataGatheringChecklist': `${stepId}.dataGatheringChecklist`,
            'revenueStreams': `${stepId}.streams`,
            'serviceItems': `${stepId}.items`,
            'keyPeople': `${stepId}.keyPeople`,
            'locationAssessment': `${stepId}.locationAssessment`,
            'operationalKpis': `${stepId}.operationalKpis`
        };
        return mappings[tableKey] || `${stepId}.${tableKey}`;
    }

    getRelativePath(tableKey) {
        // Path relative to section (for updatePath)
        const mappings = {
            'establishmentCosts': 'establishmentCosts',
            'buildings': 'buildings',
            'equipment': 'equipment',
            'furniture': 'furniture',
            'positions': 'positions',
            'techResources': 'techResources', // Nested array name within section
            'logistics': 'logistics', // Nested array name within section
            'administrative': 'administrative', // Nested array name within section
            'licenses': 'licenses',
            'competitors': 'competitors',
            'campaigns': 'campaigns',
            'suppliers': 'suppliers',
            'competitorBenchmarking': 'competitorBenchmarking',
            'historicalData': 'marketAnalysis.historicalData',
            'supplyDemandBalance': 'supplyDemandBalance',
            'partnershipContracts': 'partnershipContracts',
            'dataGatheringChecklist': 'dataGatheringChecklist',
            'revenueStreams': 'streams',
            'serviceItems': 'items',
            'keyPeople': 'keyPeople',
            'locationAssessment': 'locationAssessment',
            'operationalKpis': 'operationalKpis'
        };
        return mappings[tableKey] || tableKey;
    }

    getNestedValue(obj, path) {
        if (!path) return obj;
        return path.split('.').reduce((o, k) => (o || {})[k], obj);
    }

    renderField(section, fullKey, labelKey, value) {
        let inputType = typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'checkbox' : 'text';

        // Auto-detect dates
        const lowerKey = labelKey.toLowerCase();
        if (lowerKey.includes('date') || lowerKey.includes('start') || lowerKey.includes('end') || lowerKey.includes('timeline')) {
            inputType = 'date';
        }
        // حقل رقمي اختياري قيمته null (dsoDays مثلاً) — النية رقمية من اسم المفتاح
        if (value === null && /days|months|rate|amount|years|count/i.test(labelKey)) {
            inputType = 'number';
        }
        // شرح مبسّط (؟) للحقول غير البديهية — يُطابق كامل المفتاح أو جزءه الأخير
        const helpEntry = getFieldHelp(fullKey) || getFieldHelp(labelKey);
        const helpHtml = helpEntry ? fieldHelp(helpEntry.help, helpEntry.example) : '';

        // طريقة القيمة النهائية: قائمة اختيار بدل نص حر
        if (fullKey === 'terminalValue.method') {
            const arabicLbl = getLabelSDB(labelKey, getLabel(fullKey));
            const tvEntry = getFieldHelp('terminalValue');
            return `
                <div class="form-group">
                    <label for="field-${fullKey}">${arabicLbl}${tvEntry ? fieldHelp(tvEntry.help, tvEntry.example) : ''}</label>
                    <select id="field-${fullKey}" data-key="${fullKey}" class="input" style="width:100%; max-width:320px;">
                        <option value="gordon" ${value !== 'none' ? 'selected' : ''}>استرشادية (نمو Gordon) — القرار يبقى على NPV المتحفظ</option>
                        <option value="none" ${value === 'none' ? 'selected' : ''}>بدون قيمة نهائية</option>
                    </select>
                </div>
            `;
        }

        const displayValue = value === null || value === undefined ? '' : value;
        const checked = value === true ? 'checked' : '';
        const arabicLabel = getLabelSDB(labelKey, getLabel(fullKey));
        const auditorHint = getAuditorTooltip(labelKey);
        // أيقونة (؟) تُلحق بكل مواضع رسم الملصق عبر tooltipHtml نفسه — بلا تعديل باقي الفروع
        const tooltipHtml = (auditorHint ? `<span class="tooltip-auditor" title="هذا ما يبحث عنه المدقق المالي: ${auditorHint.replace(/"/g, '&quot;')}" aria-label="تلميح للمدقق المالي"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11.5 12H12v4h.5"/></svg></span>` : '') + helpHtml;
        // مثال/نطاق معتاد مرئي دائماً — يقلّل تردّد المستخدم أمام حقل مالي فارغ
        const fieldHint = getFieldHint(fullKey);
        const hintHtml = fieldHint?.hint ? `<p class="field-hint">${fieldHint.hint}</p>` : '';

        // حقول مُدارة كقوائم اختيار / أزرار نعم-لا (تقليل الكتابة اليدوية)
        const spec = getFieldOptionSpec(fullKey, labelKey);
        if (spec) {
            return this.renderControlled(fullKey, arabicLabel, value, spec, { tooltipHtml, hintHtml });
        }

        // كل الأسئلة المنطقية (booleans) تُعرض كأزرار نعم/لا
        if (inputType === 'checkbox') {
            return this.renderControlled(fullKey, arabicLabel, value, { control: 'yesno' }, { tooltipHtml, hintHtml });
        }

        // عملات خليجية (المرحلة 4)
        if (labelKey === 'currency') {
            const opts = GULF_CURRENCIES.map(c => `<option value="${c}" ${value === c ? 'selected' : ''}>${c} - ${CURRENCY_LABELS[c] || c}</option>`).join('');
            return `
                <div class="form-group">
                    <label for="field-${fullKey}">${arabicLabel}${tooltipHtml}</label>
                    <select id="field-${fullKey}" data-key="${fullKey}" class="input">${opts}</select>
                </div>
            `;
        }

        // Saudi City Selector (Phase 9: Local Intelligence)
        // كان select مقفلاً على 11 مدينة كبرى فقط — أي مستخدم من بلدة أو محافظة أصغر
        // (مثل سبت العلايا) لا يجد اسمه إطلاقاً ويُجبر على اختيار مدينة بديلة غير
        // دقيقة. datalist (نفس نمط حقل الحي أدناه) يتيح الكتابة الحرة مع اقتراحات
        // المدن الكبرى؛ أي اسم غير موجود في CITY_STATS يستخدم تلقائياً متوسطات
        // 'default' المحايدة (انظر getCityStats في SaudiCityStats.js) بدل رقم مُختلَق.
        if (labelKey === 'city') {
            const cities = Object.keys(CITY_STATS).filter(c => c !== 'default').sort();
            const listId = `dl-${fullKey}`;
            const cityOpts = cities.map(c => `<option value="${escapeHtml(c)}"></option>`).join('');
            const isKnownCity = cities.includes(displayValue);
            // أزرار اختيار سريع للمدن الكبرى الأكثر شيوعاً — تكمّل datalist (لا تحل محله)
            // فتظهر أمام المستخدم كخيارات ملموسة بدل الاعتماد فقط على اقتراح متصفح ضمني.
            const quickCities = ['الرياض', 'جدة', 'الدمام', 'أبها', 'المدينة المنورة'];
            const pillsHtml = `
                <div class="quick-select-pills d-flex flex-wrap gap-2 mt-2">
                    ${quickCities.map(c => `
                        <button type="button" class="btn btn--ghost btn-xs btn-pill" onclick="const i=document.getElementById('field-${fullKey}'); i.value='${c}'; i.dispatchEvent(new Event('input',{bubbles:true})); i.dispatchEvent(new Event('change',{bubbles:true}));">${c}</button>
                    `).join('')}
                </div>`;

            return `
                <div class="form-group">
                    <label for="field-${fullKey}">${arabicLabel}${tooltipHtml}</label>
                    <div class="relative">
                        <input type="text" id="field-${fullKey}" data-key="${fullKey}" value="${escapeHtml(displayValue)}" list="${listId}" class="input input--datalist" placeholder="اختر مدينة كبرى أو اكتب اسم مدينتك/محافظتك بحرية...">
                        <datalist id="${listId}">${cityOpts}</datalist>
                        ${pillsHtml}
                        <p class="field-hint">${!isKnownCity && displayValue
                            ? 'مدينتك غير مدرجة — تُستخدم متوسطات عامة للإيجار والرواتب بدل رقم مدينة أخرى.'
                            : 'يُستخدم لتقدير الإيجار والرواتب محلياً. مدينتك غير مدرجة؟ اكتبها بحرية.'}</p>
                    </div>
                </div>
            `;
        }

        // Handle longer text fields — مع زر «عصا سحرية» لاقتراح AI
        if (LONG_TEXT_KEYS.includes(labelKey) ||
            labelKey.includes('description') || labelKey.includes('notes') || labelKey.includes('trends') ||
            labelKey.includes('strengths') || labelKey.includes('weaknesses') || labelKey.includes('opportunities') || labelKey.includes('threats')) {
            return `
                <div class="form-group">
                    <label for="field-${fullKey}">${arabicLabel}${tooltipHtml}</label>
                    <div class="input-with-ai">
                        <textarea id="field-${fullKey}" data-key="${fullKey}" data-section="${section}" rows="3" class="input input--textarea" placeholder="اكتب أفكارك هنا، أو اطلب اقتراحاً جاهزاً مناسباً لمشروعك...">${escapeHtml(displayValue)}</textarea>
                        <button type="button" class="btn-magic-wand" data-key="${fullKey}" title="اقتراح أو إعادة صياغة" aria-label="اقتراح نص" style="display: flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 6px; font-weight: 500; font-size: 13px;"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4V2m0 20v-2m7-7h-2M4 13H2m18.5-6.5L19 8M6 21l9-9"/><path d="m19 8-3-3-2 2 3 3 2-2z"/></svg> <span>اكتب لي</span></button>
                    </div>
                </div>
            `;
        }

        // حقول النِسب المخزّنة ككسور (0.10 = 10%) تُعرض وتُحرَّر كنسبة مئوية —
        // يمنع فخّ الوحدات (مستخدم يرى 0.15 فيكتب 15 → ضريبة 1500%).
        if (Wizard.isFractionPercentKey(fullKey) && typeof value === 'number') {
            const pctDisplay = Math.round(value * 10000) / 100; // 0.10 → 10
            const phAttr = fieldHint?.placeholder ? `placeholder="${fieldHint.placeholder}"` : '';
            return `
                <div class="form-group">
                    <label for="field-${fullKey}">${arabicLabel}${tooltipHtml}</label>
                    <div class="flex items-center gap-1">
                        <input type="number" id="field-${fullKey}" data-key="${fullKey}" value="${pctDisplay}" step="any" min="0" max="100" ${phAttr}>
                        <span class="text-muted" aria-hidden="true">٪</span>
                    </div>
                    ${hintHtml}
                </div>
            `;
        }

        const phGeneric = (fieldHint?.placeholder && displayValue === '') ? `placeholder="${fieldHint.placeholder}"` : '';
        // حقل التاريخ يُعرض باتجاه LTR داخل نموذج RTL
        const dirAttr = inputType === 'date' ? 'dir="ltr" style="text-align:right"' : '';
        return `
            <div class="form-group">
                <label for="field-${fullKey}">${arabicLabel}${tooltipHtml}</label>
                <input type="${inputType}" id="field-${fullKey}" data-key="${fullKey}" value="${escapeHtml(displayValue)}" step="any" ${dirAttr} ${phGeneric}>
                ${hintHtml}
            </div>
        `;
    }

    /** يُرندر الحقول المُتحكّم بها (قوائم منسدلة، datalist، أزرار yes/no) مع دعم أزرار Quick Selects */
    renderControlled(fullKey, labelHtml, value, spec, extras) {
        const { tooltipHtml = '', hintHtml = '' } = extras || {};
        const safeVal = value === null || value === undefined ? '' : value;

        if (spec.control === 'yesno') {
            const isYes = safeVal === true || String(safeVal).toLowerCase() === 'yes' || safeVal === 'true';
            const isNo = safeVal === false || String(safeVal).toLowerCase() === 'no' || safeVal === 'false';
            return `
                <div class="form-group">
                    <label>${labelHtml}${tooltipHtml}</label>
                    <div class="yesno-group d-flex gap-2 mt-2">
                        <label class="yesno-btn flex-1 ${isYes ? 'active' : ''}">
                            <input type="radio" name="field-${fullKey}" data-key="${fullKey}" value="true" class="hidden-radio" ${isYes ? 'checked' : ''}>
                            نعم
                        </label>
                        <label class="yesno-btn flex-1 ${isNo ? 'active' : ''}">
                            <input type="radio" name="field-${fullKey}" data-key="${fullKey}" value="false" class="hidden-radio" ${isNo ? 'checked' : ''}>
                            لا
                        </label>
                    </div>
                    ${hintHtml}
                </div>
            `;
        }

        if (spec.control === 'select') {
            const optsHtml = (spec.options || []).map(o => {
                const isSelected = String(o.value) === String(safeVal) ? 'selected' : '';
                return `<option value="${o.value}" ${isSelected}>${o.label}</option>`;
            }).join('');
            return `
                <div class="form-group">
                    <label for="field-${fullKey}">${labelHtml}${tooltipHtml}</label>
                    <select id="field-${fullKey}" data-key="${fullKey}" class="input input--select">
                        <option value="" disabled ${safeVal === '' ? 'selected' : ''}>-- اختر --</option>
                        ${optsHtml}
                    </select>
                    ${hintHtml}
                </div>
            `;
        }

        if (spec.control === 'datalist') {
            const listId = `dl-${fullKey}`;
            const optsHtml = (spec.options || []).map(o => `<option value="${o.value}">${o.label}</option>`).join('');
            
            // إضافة أزرار Quick Selects (Pills) لخيارات datalist المهمة لمساعدة المبتدئين
            const isQuickMode = localStorage.getItem('study_mode_preference') === 'quick';
            let pillsHtml = '';
            if (isQuickMode && spec.options && spec.options.length <= 6) {
                pillsHtml = `
                    <div class="quick-select-pills d-flex flex-wrap gap-2 mt-2">
                        ${spec.options.map(o => `
                            <button type="button" class="btn btn--ghost btn-xs btn-pill" onclick="const i=document.getElementById('field-${fullKey}'); i.value='${o.value}'; i.dispatchEvent(new Event('change'));">
                                ${o.label}
                            </button>
                        `).join('')}
                    </div>
                `;
            }

            return `
                <div class="form-group">
                    <label for="field-${fullKey}">${labelHtml}${tooltipHtml}</label>
                    <input type="text" id="field-${fullKey}" data-key="${fullKey}" value="${escapeHtml(safeVal)}" list="${listId}" class="input input--datalist" placeholder="اختر من القائمة أو اكتب بحرية...">
                    <datalist id="${listId}">
                        ${optsHtml}
                    </datalist>
                    ${pillsHtml}
                    ${hintHtml}
                </div>
            `;
        }

        // Fallback
        return `
            <div class="form-group">
                <label for="field-${fullKey}">${labelHtml}${tooltipHtml}</label>
                <input type="text" id="field-${fullKey}" data-key="${fullKey}" value="${escapeHtml(safeVal)}" class="input">
                ${hintHtml}
            </div>
        `;
    }

    /** المفاتيح المخزّنة ككسر (0–1) وتُعرض كنسبة مئوية (0–100). */
    static isFractionPercentKey(keyPath) {
        const PERCENT_FRACTION_KEYS = ['discountRate', 'taxRate', 'inflationRate', 'contingencyRate', 'gosiRate', 'foreignOwnershipRate', 'growthRate', 'minIRR', 'minROI'];
        return PERCENT_FRACTION_KEYS.some(p => keyPath === p || keyPath.endsWith('.' + p));
    }

    updateStore(section, keyPath, type, value, checked) {
        let finalVal = value;
        if (type === 'number') finalVal = value === '' ? null : (parseFloat(value) || 0);
        if (type === 'checkbox') finalVal = checked;

        // حقول النِسب المعروضة كنسبة مئوية تُخزَّن ككسر (10 → 0.10) — انظر renderField
        if (type === 'number' && finalVal != null && Wizard.isFractionPercentKey(keyPath)) {
            finalVal = finalVal / 100;
        }

        // Update the specific path
        this.store.updatePath(section, keyPath, finalVal);

        // Auto-calculate Operation Start Date
        if (keyPath === 'timeline.projectStart' || keyPath === 'timeline.constructionMonths') {
            const state = this.store.get();
            const timeline = state.projectInfo?.timeline || {};

            if (timeline.projectStart && timeline.constructionMonths) {
                const start = new Date(timeline.projectStart);
                const months = parseFloat(timeline.constructionMonths);

                if (!isNaN(start.getTime()) && !isNaN(months)) {
                    // Add months to start date
                    const opDate = new Date(start);
                    opDate.setMonth(opDate.getMonth() + months);

                    // Format YYYY-MM-DD
                    const opDateStr = opDate.toISOString().split('T')[0];

                    // Update operationStart
                    this.store.updatePath('projectInfo', 'timeline.operationStart', opDateStr);

                    // Update UI if field exists
                    const opField = this.container.querySelector('input[data-key="timeline.operationStart"]');
                    if (opField) opField.value = opDateStr;
                }
            }
        }
    }
    validateStep(step) {
        // Basic validation logic
        const state = this.store.get();
        const data = state[step.id];

        // Clear previous debounce
        if (this.validationDebounce) {
            clearTimeout(this.validationDebounce);
        }

        // 1. Check Revenue (Critical)
        if (step.id === 'revenue') {
            const streams = data?.streams || [];
            if (streams.length === 0) {
                const errorKey = 'revenue_no_streams';
                // Only show error if it's different from last one (prevent spam)
                if (this.lastValidationError !== errorKey) {
                    this.lastValidationError = errorKey;
                    toast.error('يرجى إضافة مصدر إيرادات واحد على الأقل للمتابعة.');
                }
                return false;
            }
            // Check prices - support both avgPrice and price fields
            if (streams.some(s => {
                const price = s.avgPrice || s.price || 0;
                return !price || price <= 0;
            })) {
                const errorKey = 'revenue_invalid_prices';
                if (this.lastValidationError !== errorKey) {
                    this.lastValidationError = errorKey;
                    toast.error('يرجى التأكد من إدخال أسعار صحيحة لجميع الخدمات.');
                }
                return false;
            }
        }

        // 2. Check Project Info
        if (step.id === 'projectInfo') {
            if (!data?.name || data?.name.trim() === '') {
                const errorKey = 'projectInfo_no_name';
                // إظهار الخطأ inline أسفل حقل الاسم + نقل التركيز إليه
                this.showFieldError('name', 'اسم المشروع مطلوب للمتابعة.');
                if (this.lastValidationError !== errorKey) {
                    this.lastValidationError = errorKey;
                    toast.error('يرجى إدخال اسم المشروع.', { duration: 3000 });
                    this.validationDebounce = setTimeout(() => { this.lastValidationError = null; }, 2000);
                }
                return false;
            }
        }

        // 3. الافتراضات المالية
        if (step.id === 'assumptions') {
            const a = validateAssumptions(state?.assumptions || state?.financial?.assumptions || data);
            if (!a.valid && a.errors?.length > 0) {
                if (this.lastValidationError !== 'assumptions') {
                    this.lastValidationError = 'assumptions';
                    toast.warning((a.errors[0] || 'يرجى مراجعة الافتراضات المالية.'), 4000);
                }
                return false;
            }
        }

        // 4. التمويل
        if (step.id === 'financing') {
            const f = validateFinancing(state?.financing || data);
            if (!f.valid && f.errors?.length > 0) {
                if (this.lastValidationError !== 'financing') {
                    this.lastValidationError = 'financing';
                    toast.warning((f.errors[0] || 'يرجى مراجعة بيانات التمويل.'), 4000);
                }
                return false;
            }
        }

        this.lastValidationError = null;
        return true;
    }
}
