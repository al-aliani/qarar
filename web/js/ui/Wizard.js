import { getLabel } from '../core/labels.js';
import { getLabelSDB, getAuditorTooltip, getFieldHint } from '../core/regulatoryLabels.js';
import { getPhaseForStep, getStepHelp, MAJOR_PHASES, getMajorPhaseForStep } from '../core/wizardSteps.js';
import { EXPERT_FAQ } from '../config.js';
import { DynamicTable } from './DynamicTable.js';
import { DataService } from '../services/DataService.js';
import { generateTableSuggestions } from '../services/AIConnector.js';
import { InternalAIGenerator } from '../services/InternalAIGenerator.js';
import { generateSuggestionStreaming } from '../services/FieldSuggestionService.js';
import { exportSectionToExcel } from '../utils/sectionExporter.js';
import { ReviewCharts } from './ReviewCharts.js';
import { toast } from '../utils/toast.js';
import { validateAssumptions, validateFinancing } from '../utils/validation.js';
import { GULF_CURRENCIES, CURRENCY_LABELS } from '../utils/formatters.js';
import { CITY_STATS } from '../data/SaudiCityStats.js';
import { getFieldOptionSpec } from '../core/fieldOptions.js';
import { getFieldHelp } from '../core/fieldHelpTexts.js';
import { fieldHelp } from './components/FieldHelp.js';

/** Smart Fill handlers keyed by TABLE_SCHEMAS.*.smartFill.dataKey. Add new tables here. */
const SMART_FILL_HANDLERS = {
    staffing: (state) => {
        const size = state.projectInfo?.areaSize || state.technical?.area || 100;
        const type = state.projectInfo?.concept || state.projectInfo?.activity || 'cafe';
        const suggestions = DataService.recommendStaffing(size, type);
        return suggestions.map(s => ({
            id: Date.now() + Math.random(),
            position: s.position,
            count: s.count,
            salary: s.salary,
            months: 12,
            isVariable: (s.position || '').includes('عامل')
        }));
    },
    licenses: (state) => {
        const city = state.projectInfo?.city || state.projectInfo?.location || 'الرياض';
        const type = state.projectInfo?.concept || state.projectInfo?.activity || 'cafe';
        const size = state.projectInfo?.areaSize || state.technical?.area || 100;
        const list = DataService.getComplianceCosts(city, type, size);
        return list.map(l => ({
            id: Date.now() + Math.random(),
            name: l.name,
            quantity: 1,
            price: l.cost || 0
        }));
    }
};

// الحقول السردية الطويلة — تُرسم textarea لا سطر إدخال ضيق واحد
const LONG_TEXT_KEYS = ['identityStatement', 'valueProposition', 'problem', 'solution', 'insight', 'insightText', 'whyUs', 'marketSize', 'competitiveAdvantage', 'locationFactors', 'alternativesComparison', 'finalChoiceReason'];

// حقول خطوة معلومات المشروع الأساسية — الباقي يُطوى تحت «حقول متقدمة» لتخفيف النموذج
const PROJECT_INFO_BASIC_KEYS = ['name', 'description', 'city', 'region', 'district', 'concept', 'studyType', 'studyRecipientType', 'businessModel', 'franchiseDetails', 'areaSize', 'ownershipType', 'targetCapital', 'selfFundingAmount', 'targetSegment', 'timeline'];

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
        this.onNavigate = options.onNavigate || (() => { });
        this.lastValidationError = null; // Track last validation error to prevent spam
        this.validationDebounce = null; // Debounce timer
    }

    renderStep(stepId, metadata, stepIndex = 0) {
        if (!this.container) return;
        this.currentStepIndex = stepIndex;

        // Progress bar HTML + Gamification
        const isQuickMode = localStorage.getItem('study_mode_preference') === 'quick';
        const activeSteps = isQuickMode ? this.steps.filter(s => !s.isAdvancedStep) : this.steps;
        const totalSteps = activeSteps.length;
        
        let relativeStepIndex = activeSteps.findIndex(s => s.id === stepId);
        if (relativeStepIndex === -1) relativeStepIndex = 0; // Fallback
        
        const progressPercent = totalSteps > 0 ? ((relativeStepIndex + 1) / totalSteps) * 100 : 0;
        
        let expectedMinutes;
        if (isQuickMode) {
             // 5 mins total, reduce by progress
             expectedMinutes = Math.max(1, Math.round(5 * (1 - progressPercent/100)));
        } else {
             // 30 mins total
             expectedMinutes = Math.max(5, Math.round(30 * (1 - progressPercent/100)));
        }

        const { phase: currentMajorPhase, index: currentMajorIndex } = getMajorPhaseForStep(relativeStepIndex);
        
        const phasesStepperHTML = MAJOR_PHASES.map((p, idx) => {
            const isActive = idx === currentMajorIndex;
            const isCompleted = idx < currentMajorIndex;
            return `
                <div class="major-phase-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}" style="flex: 1; text-align: center; border-bottom: 3px solid ${isActive ? 'var(--color-primary)' : isCompleted ? 'var(--color-success)' : 'var(--color-border)'}; padding-bottom: 0.5rem; color: ${isActive ? 'var(--color-primary)' : isCompleted ? 'var(--color-success)' : 'var(--color-muted)'}; font-weight: ${isActive ? 'bold' : 'normal'};">
                    <span class="phase-number" style="display:inline-block; width: 24px; height: 24px; border-radius: 50%; background: ${isActive ? 'var(--color-primary)' : isCompleted ? 'var(--color-success)' : 'var(--color-surface)'}; color: ${isActive || isCompleted ? 'white' : 'inherit'}; line-height: 24px; font-size: 0.8rem; margin-left: 0.5rem;">${isCompleted ? '✓' : idx + 1}</span>
                    ${p.label}
                </div>
            `;
        }).join('');

        const progressHTML = totalSteps > 0 ? `
            <div class="wizard-major-phases" style="display: flex; justify-content: space-between; margin-bottom: 2rem; gap: 1rem;">
                ${phasesStepperHTML}
            </div>
            <div class="wizard-progress" role="status" aria-live="polite">
                <div class="progress-info">
                    <span class="progress-step-label">الخطوة <span class="num">${relativeStepIndex + 1}</span> من <span class="num">${totalSteps}</span></span>
                    <span class="progress-percent">${Math.round(progressPercent)}٪</span>
                </div>
                <div class="progress-bar-container">
                    <div class="progress-bar-fill" style="width: ${progressPercent}%"></div>
                </div>
                <p class="progress-eta">الوقت المتبقي تقريباً <span class="num">${expectedMinutes}</span> دقائق</p>
            </div>
        ` : '';

        const phaseLabel = getPhaseForStep(stepIndex);
        let html = `
            ${progressHTML}
            <p class="step-phase" aria-label="المرحلة التعليمية">${phaseLabel}</p>
            <div class="step-content" key="${stepId}">
                <h2 class="animate-entry" style="margin-bottom: var(--s-3)">${metadata.label}</h2>
                ${(function () {
                const help = getStepHelp(stepIndex);
                const hasFaq = EXPERT_FAQ && EXPERT_FAQ.length > 0;
                if (!help || !help.why) return '';
                
                return `
                    <div class="d-flex justify-end mb-4" style="margin-top: -1rem;">
                        <button type="button" class="btn btn--secondary btn-sm" onclick="document.getElementById('stepHelpModal').showModal()" aria-label="مساعدة وتعليمات هذه الخطوة">
                            كيف أملأ هذه الخطوة؟ 💡
                        </button>
                    </div>
                    <dialog id="stepHelpModal" class="modal" aria-labelledby="helpModalTitle">
                        <div class="modal-content" style="max-width: 600px;">
                            <button type="button" class="modal-close" onclick="this.closest('dialog').close()" aria-label="إغلاق">&times;</button>
                            <h3 id="helpModalTitle" class="text-gold mb-3">دليل الخطوة: ${metadata.label}</h3>
                            <div class="help-section mb-4" style="background: var(--color-surface-hover); padding: 1.5rem; border-radius: var(--radius); border-right: 4px solid var(--color-primary);">
                                <h4 class="mb-2">🤔 لماذا نطلب هذا؟</h4>
                                <p class="mb-4 text-muted">${help.why}</p>
                                <h4 class="mb-2">📝 كيف تملأه؟</h4>
                                <p class="mb-0 text-muted">${help.how}</p>
                            </div>
                            ${hasFaq ? `
                                <h4 class="mb-3">نصائح الخبراء والأسئلة الشائعة</h4>
                                <div class="faq-list">
                                    ${EXPERT_FAQ.map(f => `
                                        <div class="faq-item mb-3 p-3" style="border: 1px solid var(--color-border); border-radius: var(--radius); background: var(--color-surface);">
                                            <p class="faq-q font-bold mb-2" style="color: var(--color-text);">${f.q}</p>
                                            <p class="faq-a text-muted mb-0">${f.a}</p>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : ''}
                        </div>
                    </dialog>
                `;
            })()}
                ${stepId === 'assumptions' ? `<div class="alert alert--info mb-4"><strong>ملاحظة:</strong> يمكن الاستناد إلى معدل التضخم ومعدل الخصم الصادر عن البنك المركزي السعودي (ساما) عند تحديد الافتراضات. <a href="https://www.sama.gov.sa" target="_blank" rel="noopener">ساما</a></div><div class="alert alert--warning mb-4"><strong>رأس المال العامل حاسم:</strong> إهماله سبب رئيسي لأزمات السيولة. تأكد من تمويل 3–6 أشهر تشغيل قبل الاعتماد على الإيرادات.</div><div class="alert alert--info mb-4"><strong>مبرر المبيعات:</strong> وضّح لماذا المبيعات ثابتة أو متزايدة أو متناقصة — مطلوب لتبرير التوقعات.</div><div class="alert alert--info mb-4"><strong>الأوفر هيد:</strong> احسب احتياطياً للتكاليف غير المحسوبة (قطع كهرباء، غياب عامل، طوارئ) — من أكثر ما يزعج المشاريع.</div>` : ''}
                ${stepId === 'technical' ? `<div class="alert alert--info mb-4"><strong>معيار التصنيف:</strong> الآلات والمعدات = عناصر <em>أساسية</em> لتنفيذ المشروع (مثل ماكينة القهوة للمقهى). الأثاث = عناصر <em>مساعدة</em> (طاولات، كراسي). نفس العنصر قد يُصنّف مختلفاً حسب نوع المشروع.</div><div class="alert alert--info mb-4"><strong>وصف العملية الإنتاجية:</strong> وصف خطوات الإنتاج من المدخلات للمخرجات يساعد في تحديد الاحتياجات (عمالة، معدات، مواد) بدقة.</div>` : ''}
                ${stepId === 'marketing' ? `<div class="alert alert--info mb-4"><strong>توازن العرض والطلب:</strong> الطلب &gt; العرض = فرصة؛ العرض &gt; الطلب = خطر. ادرس اتجاه الطلب خلال 5 سنوات على الأقل — الاتجاه الصاعد إيجابي. <strong>المصدر المقترح لاتجاهات الطلب:</strong> GASTAT، دراسات قطاعية، الغرف. <strong>أساليب التنبؤ:</strong> إذا لديك بيانات تاريخية (5+ سنوات)، يمكن استخدام: نمو بسيط، نمو مركب، متوسط متحرك — التنبؤ يعتمد على بيانات الماضي.</div>` : ''}
                ${stepId === 'projectInfo' ? `<div class="alert alert--info mb-4"><strong>خطوات جمع المعلومات:</strong> أسبوع بحث أونلاين (كلمات مفتاحية، جروبات، إعلانات، أوليكس، بيانات حكومية) — ثم زيارة منافسين، جهات حكومية (تراخيص)، جهات تمويل. <strong>البحث أونلاين يصفي 50% من الأفكار</strong> — الباقي يحتاج نزول ميداني. "جمع المعلومات هو أكبر جزء في دراسة الجدوى".</div>` : ''}
                ${stepId === 'revenue' ? `<div class="alert alert--info mb-4"><strong>أفضل الممارسات المحلية:</strong> جمع المعلومات الدقيقة هو أساس دراسة جدوى موثوقة.</div><div class="alert alert--warning mb-4"><strong>تجنّب وهم المبيعات:</strong> تقدير المبيعات يجب أن يُبنى على دراسة السوق والمنافسين — «كم ستبيع فعلياً؟» يُجاب بناءً على بيانات، وليس تقديراً وهمياً.</div><div class="alert alert--info mb-4"><strong>مخرَج الدراسة السوقية:</strong> جدول (صنف، عدد متوقع بيعه، سعر) — الخدمة = الصنف، العملاء/شهر × 12 = العدد السنوي، متوسط السعر = السعر. هذا الجدول يغذّي الدراسة الفنية.</div>` : ''}
        `;

        // ⚠️ FIX: Always get fresh data from store to ensure latest changes are reflected
        // Force a small delay to ensure any pending saves are completed
        // بعض الخطوات معرّفها فريد للتنقل لكن بياناتها في قسم آخر (projectDetails → projectInfo)
        stepId = metadata.dataSection || stepId;
        const studyData = this.store.get();
        // Ensure state is initialized
        if (!studyData || !studyData[stepId]) {
            console.warn(`Section ${stepId} not found in store, initializing...`);
            if (!studyData[stepId]) {
                // Initialize section if missing
                const emptyStudy = this.store.getState();
                if (emptyStudy && typeof emptyStudy === 'object') {
                    // Section will be created by schema, but ensure it exists
                    console.log('Store state exists, section may need initialization');
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
        if (isQuickMode && stepId === 'projectInfo') {
            // إخفاء الجداول المعقدة من الخطوة الأولى في الوضع السريع
            tablesToRender = tablesToRender.filter(t => !['glossary', 'dataGatheringChecklist'].includes(t));
        }

        // Render regular fields first (if section is object, not array)
        if (!isArraySection && sectionData && typeof sectionData === 'object') {
            const renderEntry = ([key, val]) => {
                // Skip array fields and complex objects - they'll be rendered as tables
                if (Array.isArray(val)) return '';
                if (typeof val === 'object' && val !== null) {
                    // Nested object (like timeline, swot)
                    // التنسيق يأتي من .step-content .card h4 في wizard-forms.css — لا inline styles
                    let part = `<h4>${getLabel(key)}</h4>`;
                    Object.entries(val).forEach(([subKey, subVal]) => {
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
                // ~49 حقلاً دفعة واحدة تُرهق المستخدم — الأساسي يظهر مباشرة والباقي مطوي
                const entries = Object.entries(sectionData);
                const basicHtml = entries.filter(([k]) => PROJECT_INFO_BASIC_KEYS.includes(k)).map(renderEntry).join('');
                const advancedHtml = entries.filter(([k]) => !PROJECT_INFO_BASIC_KEYS.includes(k)).map(renderEntry).join('');
                html += `<div class="card form-grid">${basicHtml}</div>`;
                if (advancedHtml.trim()) {
                    html += `
                        <details class="card advanced-fields mt-4">
                            <summary style="cursor: pointer; font-weight: 600; padding: 0.5rem 0;">حقول متقدمة (اختيارية) — يمكنك العودة لها لاحقاً</summary>
                            <div class="form-grid mt-3">${advancedHtml}</div>
                        </details>
                    `;
                }
            } else {
                html += `<div class="card form-grid">`;
                Object.entries(sectionData).forEach(entry => { html += renderEntry(entry); });
                html += `</div>`;
            }
        }

        // Add table containers
        tablesToRender.forEach(tableKey => {
            html += `<div id="table-${tableKey}" class="mt-4"></div>`;
        });

        // Navigation buttons
        const isFirstStep = stepIndex === 0;
        const isLastStep = stepIndex === this.steps.length - 1;
        const showNav = this.steps.length > 1;

        if (showNav) {
            // أسهم SVG بدل الرموز النصية — الاتجاهات صحيحة في RTL (السابق يميناً، التالي يساراً)
            html += `
                <div class="wizard-nav">
                    <button type="button" class="btn btn--secondary" id="btnPrevStep" ${isFirstStep ? 'disabled' : ''}>
                        <svg class="ic-nav" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
                        <span>السابق</span>
                    </button>
                    <div class="nav-actions">
                        <button type="button" class="btn btn--ghost btn-sm" id="btnExportSection" title="تصدير هذا القسم">تصدير إكسل</button>
                        <div class="nav-indicator">
                            <span class="nav-indicator__caption">الخطوة التالية</span>
                            <span class="nav-indicator__label">${isLastStep ? 'إنهاء الدراسة' : this.steps[stepIndex + 1]?.label}</span>
                        </div>
                    </div>
                    <button type="button" class="btn btn--primary" id="btnNextStep" ${isLastStep ? 'disabled' : ''}>
                        <span>التالي</span>
                        <svg class="ic-nav" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>
                    </button>
                </div>
            `;
        }

        if (stepId === 'marketing') {
            html += `<div id="marketingChart" class="mt-4 card" style="display:none; min-height:200px;"></div>`;
        } else if (stepId === 'staffing') {
            html += `<div id="staffingChart" class="mt-4 card" style="display:none; min-height:200px;"></div>`;
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

        // عصا سحرية: اقتراح/إعادة صياغة تدفقية لكل textarea
        this.container.querySelectorAll('.btn-magic-wand').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const key = btn.getAttribute('data-key');
                const textarea = btn.closest('.input-with-ai')?.querySelector('textarea');
                if (!key || !textarea) return;
                if (btn.disabled) return;
                btn.disabled = true;
                btn.setAttribute('aria-busy', 'true');
                const originalTitle = btn.getAttribute('title');
                btn.setAttribute('title', 'جاري التوليد...');
                const state = this.store.get();
                const currentValue = textarea.value || '';
                // حماية من فقدان النص: إن كان الحقل يحوي كتابة فعلية للمستخدم، نؤكّد قبل الاستبدال.
                if (currentValue.trim().length > 0 &&
                    !confirm('سيستبدل الاقتراح النصَّ الحالي في هذا الحقل. هل تريد المتابعة؟')) {
                    return;
                }
                const previousValue = currentValue; // للتراجع عند الفشل
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
        tablesToRender.forEach(tableKey => {
            this.renderTable(stepId, tableKey, freshStudyData);
        });
    }

    bindNavigationEvents() {
        const prevBtn = document.getElementById('btnPrevStep');
        const nextBtn = document.getElementById('btnNextStep');
        const exportBtn = document.getElementById('btnExportSection');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (this.currentStepIndex > 0) {
                    this.onNavigate(this.currentStepIndex - 1);
                }
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                if (this.currentStepIndex < this.steps.length - 1) {
                    if (this.validateStep(this.steps[this.currentStepIndex])) {
                        this.onNavigate(this.currentStepIndex + 1);
                    }
                }
            });
        }

        if (exportBtn) {
            exportBtn.addEventListener('click', async (e) => {
                const currentStep = this.steps[this.currentStepIndex];
                const sectionId = currentStep?.id || 'section';
                const sectionLabel = currentStep?.label || 'القسم';

                e.target.textContent = 'جاري التصدير…';
                e.target.disabled = true;

                try {
                    const outName = await exportSectionToExcel(
                        this.store.getState(),
                        sectionId,
                        sectionLabel
                    );
                    e.target.textContent = 'تم التصدير';
                    if (outName) toast.success(`تم تصدير Excel: ${outName}`);
                    setTimeout(() => {
                        e.target.textContent = 'تصدير إكسل';
                        e.target.disabled = false;
                    }, 1500);
                } catch (err) {
                    console.error('Export error:', err);
                    e.target.textContent = 'تعذّر التصدير';
                    toast.error('فشل تصدير القسم. تحقق من الاتصال ومكتبة Excel.');
                    setTimeout(() => {
                        e.target.textContent = 'تصدير إكسل';
                        e.target.disabled = false;
                    }, 1500);
                }
            });
        }
    }

    appendNav(stepIndex) {
        this.currentStepIndex = stepIndex;
        const isFirstStep = stepIndex === 0;
        const isLastStep = stepIndex === this.steps.length - 1;
        const showNav = this.steps.length > 1;

        if (!showNav) return;

        // Check if navbar already exists in container
        let nav = this.container.querySelector('.wizard-nav');
        if (nav) {
            nav.remove();
        }

        const nextStepLabel = isLastStep ? 'إنهاء الدراسة' : this.steps[stepIndex + 1]?.label;
        const navHtml = `
            <div class="wizard-nav">
                <button type="button" class="btn btn--secondary" id="btnPrevStep" ${isFirstStep ? 'disabled' : ''}>
                    <svg class="ic-nav" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
                    <span>السابق</span>
                </button>
                <div class="nav-actions">
                    <button type="button" class="btn btn--ghost btn-sm" id="btnExportSection" title="تصدير هذا القسم">تصدير إكسل</button>
                    <div class="nav-indicator">
                        <span class="nav-indicator__caption">الخطوة التالية</span>
                        <span class="nav-indicator__label">${nextStepLabel}</span>
                    </div>
                </div>
                <button type="button" class="btn btn--primary" id="btnNextStep" ${isLastStep ? 'disabled' : ''}>
                    <span>التالي</span>
                    <svg class="ic-nav" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>
                </button>
            </div>
        `;

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
            if (!document.getElementById(btnId)) {
                const btnHtml = `
                    <div class="flex-between mb-2">
                        <span></span>
                        <button id="${btnId}" class="btn-xs btn-magic">${smart.label}</button>
                    </div>
                `;
                container.insertAdjacentHTML('beforebegin', btnHtml);

                document.getElementById(btnId).addEventListener('click', (e) => {
                    e.target.disabled = true;
                    e.target.textContent = 'جاري البحث…';
                    const state = this.store.get();
                    const newData = handler(state);
                    this.store.updatePath(stepId, this.getRelativePath(tableKey), newData);
                    if (this.tables[tableKey]) {
                        this.tables[tableKey].data = newData;
                        this.tables[tableKey].render();
                    }
                    e.target.disabled = false;
                    e.target.textContent = 'تم الجلب بنجاح';
                    setTimeout(() => { e.target.textContent = smart.label; }, 2000);
                });
            }
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

        const table = new DynamicTable(containerId, {
            ...schema,
            id: tableKey,
            initialData: Array.isArray(tableData) ? tableData : [],
            onSuggest, // Inject suggestions
            onChange: (newData) => {
                this.store.updatePath(stepId, this.getRelativePath(tableKey), newData);
            }
        });

        table.container = container;
        table.render();
        this.tables[tableKey] = table;
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
            'suppliers': `${stepId}.suppliers`,
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
        if (labelKey === 'city') {
            const cities = Object.keys(CITY_STATS).filter(c => c !== 'default').sort();
            const cityOpts = cities.map(c =>
                `<option value="${c}" ${value === c ? 'selected' : ''}>${c}</option>`
            ).join('');

            return `
                <div class="form-group">
                    <label for="field-${fullKey}">${arabicLabel}${tooltipHtml}</label>
                    <div class="relative">
                        <select id="field-${fullKey}" data-key="${fullKey}" class="input">
                            ${cityOpts}
                        </select>
                        <p class="field-hint">اختيار المدينة يساعدنا في تقدير <strong>الإيجار والرواتب</strong> بدقة أكبر.</p>
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
                        <textarea id="field-${fullKey}" data-key="${fullKey}" data-section="${section}" rows="3" class="input input--textarea" placeholder="اكتب أفكارك هنا، أو اضغط على زر 🪄 ليقوم الذكاء الاصطناعي باقتراح نص مناسب لمشروعك...">${displayValue}</textarea>
                        <button type="button" class="btn-magic-wand" data-key="${fullKey}" title="اقتراح أو إعادة صياغة بالذكاء الاصطناعي" aria-label="اقتراح نص"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4V2m0 20v-2m7-7h-2M4 13H2m18.5-6.5L19 8M6 21l9-9"/><path d="m19 8-3-3-2 2 3 3 2-2z"/></svg></button>
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
                <input type="${inputType}" id="field-${fullKey}" data-key="${fullKey}" value="${displayValue}" step="any" ${dirAttr} ${phGeneric}>
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
                    <input type="text" id="field-${fullKey}" data-key="${fullKey}" value="${safeVal}" list="${listId}" class="input input--datalist" placeholder="اختر من القائمة أو اكتب بحرية...">
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
                <input type="text" id="field-${fullKey}" data-key="${fullKey}" value="${safeVal}" class="input">
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
        if (type === 'number') finalVal = parseFloat(value) || 0;
        if (type === 'checkbox') finalVal = checked;

        // حقول النِسب المعروضة كنسبة مئوية تُخزَّن ككسر (10 → 0.10) — انظر renderField
        if (type === 'number' && Wizard.isFractionPercentKey(keyPath)) {
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
