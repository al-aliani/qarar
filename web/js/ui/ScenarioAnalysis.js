/**
 * Scenario Analysis Component
 * Sensitivity analysis, scenario comparison, and break-even visualization
 */

import { calculateStudy as runFullModel } from '../core/engine.js';

export class ScenarioAnalysis {
    constructor(containerId, store, onNavigate) {
        this.container = document.getElementById(containerId);
        this.store = store;
        this.onNavigate = onNavigate;
        this.stepIndex = 0;
        this.isGenerating = false;
    }

    render(stepIndex) {
        if (typeof stepIndex === 'number') this.stepIndex = stepIndex;
        const state = this.store.getState();
        const scenarios = state.scenarios || {};

        // Run base model for calculations
        let baseResults = null;
        try {
            baseResults = runFullModel(state);
        } catch (e) {
            console.warn('Could not run financial model:', e);
        }

        this.container.innerHTML = `
            <div class="scenario-analysis">
                <h2 class="section-title">📊 تحليل السيناريوهات</h2>
                
                <!-- Scenario Comparison -->
                <div class="card analysis-card">
                    <h3 class="card-title">مقارنة السيناريوهات</h3>
                    <p class="text-muted text-sm mb-3">المتشائم vs الأساسي vs المتفائل — محسوبة بالمحرك الفعلي</p>
                    <!-- تدقيق 2026-07-08 (ملاحظة منخفضة #59): نسب السيناريوهات الافتراضية
                    ثوابت تقديرية عامة بلا مصدر خارجي منشور — عدِّلها من الحقول أدناه
                    بحسب واقع مشروعك ونشاطك. -->
                    <p class="text-xs text-muted mb-3">النسب الافتراضية (متشائم ‎-20%‏/+15%، متفائل ‎+25%‏/‎-10%‏) تقديرات عامة (ASSUMPTION) قابلة للتعديل الكامل — لا مصدر خارجي منشور لها.</p>
                    ${this.renderScenarioComparison(scenarios, baseResults)}
                </div>

                <div class="alert alert--info">
                    <p class="text-sm">لتحليل الحساسية أحادي المتغير (±10%/±20%) وقيمة التبديل، راجع خطوة <strong>«تحليل الحساسية»</strong>. ولتحليل نقطة التعادل التفصيلي راجع خطوة <strong>«تحليل نقطة التعادل»</strong>.</p>
                </div>

                <!-- Navigation -->
                <div class="wizard-nav margin-top-lg">
                    <button class="btn btn--secondary btn-prev-step">السابق</button>
                    <button class="btn btn--primary btn-next-step">التالي</button>
                </div>
            </div>
        `;

        this.bindEvents();
    }

    renderScenarioComparison(scenarios, baseResults) {
        const pessimistic = scenarios.pessimistic || { revenueChange: -0.20, costChange: 0.15 };
        const base = scenarios.base || { revenueChange: 0, costChange: 0 };
        const optimistic = scenarios.optimistic || { revenueChange: 0.25, costChange: -0.10 };

        // Calculate scenario-adjusted results using the REAL engine
        // يُرجع null عند تعذّر الحساب (لا صفراً ملفَّقاً) — نفس عقد runScenario في
        // SensitivityAnalysis.js (تدقيق 2026-07-08: كان يُرجع {npv:0,...} عند الفشل
        // فتُعرض "٠ ر.س." كأنها نتيجة حسابية حقيقية بدل حالة تعذّر محايدة).
        const getResults = (s) => {
            try {
                // Run full model with scenario parameters
                const res = runFullModel(this.store.getState(), {
                    revenueChange: s.revenueChange,
                    costChange: s.costChange
                });
                const npv = res?.indicators?.npv;
                return (npv == null || Number.isNaN(npv)) ? null : res.indicators;
            } catch (e) {
                console.error("Scenario Eval Error", e);
                return null;
            }
        };

        const pessResults = getResults(pessimistic);
        const baseNpv = baseResults?.indicators?.npv;
        const baseResultsCalc = (baseNpv == null || Number.isNaN(baseNpv)) ? null : baseResults.indicators; // Use Base from main run
        const optResults = getResults(optimistic);

        // Alias for template usage (mapping indicators names to what template expects)
        //Template expects: npv, irr, payback. Model returns: npv, irr, paybackPeriod.
        const mapToView = (r) => r == null ? { npv: null, irr: null, payback: null } : {
            npv: r.npv,
            // احتراس مستقل عن NPV (تدقيق 2026-07-08، تحقّق عدائي): IRR قد يأتي NaN
            // بمعزل عن NPV صالح من الناحية النظرية — بلا هذا الحارس كانت تظهر "NaN%"
            // حرفياً في الواجهة، نفس فئة "الرقم الملفَّق" التي يمنعها هذا الإصلاح.
            irr: (r.irr != null && Number.isFinite(r.irr)) ? r.irr : null,
            payback: (r.paybackPeriod != null && Number.isFinite(r.paybackPeriod)) ? r.paybackPeriod : null
        };
        const fmtPayback = (p) => (p != null && p > 0) ? `${p.toFixed(1)} سنة` : 'غير محقق';

        const viewPess = mapToView(pessResults);
        const viewBase = mapToView(baseResultsCalc);
        const viewOpt = mapToView(optResults);

        const formatCurrency = (n) => n == null ? '--' : new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(n);
        const formatPercent = (n) => n == null ? '--' : `${(n * 100).toFixed(1)}%`;

        return `
            <div class="scenarios-grid">
                <!-- Pessimistic -->
                <div class="scenario-card scenario-pessimistic">
                    <div class="scenario-header">
                        <span class="scenario-icon">😟</span>
                        <span class="scenario-title">السيناريو المتشائم</span>
                    </div>
                    <div class="scenario-inputs">
                        <label for="scenario-pess-revenue">تغير الإيرادات:</label>
                        <input type="number" id="scenario-pess-revenue" class="input input--sm scenario-input" 
                               data-scenario="pessimistic" data-field="revenueChange"
                               value="${(pessimistic.revenueChange * 100).toFixed(0)}" step="5">%
                        <label for="scenario-pess-cost">تغير التكاليف:</label>
                        <input type="number" id="scenario-pess-cost" class="input input--sm scenario-input" 
                               data-scenario="pessimistic" data-field="costChange"
                               value="${(pessimistic.costChange * 100).toFixed(0)}" step="5">%
                    </div>
                    <div class="scenario-results">
                        <div class="kpi"><span>صافي القيمة الحالية</span><span class="text-danger">${formatCurrency(viewPess.npv)}</span></div>
                        <div class="kpi"><span>معدل العائد الداخلي</span><span>${formatPercent(viewPess.irr)}</span></div>
                        <div class="kpi"><span>فترة الاسترداد</span><span>${fmtPayback(viewPess.payback)}</span></div>
                    </div>
                </div>

                <!-- Base -->
                <div class="scenario-card scenario-base">
                    <div class="scenario-header">
                        <span class="scenario-icon">😐</span>
                        <span class="scenario-title">السيناريو الأساسي</span>
                    </div>
                    <div class="scenario-inputs">
                        <span class="scenario-label">الإيرادات:</span>
                        <span class="text-muted">100% (الافتراضات الحالية)</span>
                        <span class="scenario-label">التكاليف:</span>
                        <span class="text-muted">100% (الافتراضات الحالية)</span>
                    </div>
                    <div class="scenario-results">
                        <div class="kpi"><span>صافي القيمة الحالية</span><span class="text-gold">${formatCurrency(viewBase.npv)}</span></div>
                        <div class="kpi"><span>معدل العائد الداخلي</span><span>${formatPercent(viewBase.irr)}</span></div>
                        <div class="kpi"><span>فترة الاسترداد</span><span>${fmtPayback(viewBase.payback)}</span></div>
                    </div>
                </div>

                <!-- Optimistic -->
                <div class="scenario-card scenario-optimistic">
                    <div class="scenario-header">
                        <span class="scenario-icon">😊</span>
                        <span class="scenario-title">السيناريو المتفائل</span>
                    </div>
                    <div class="scenario-inputs">
                        <label for="scenario-opt-revenue">تغير الإيرادات:</label>
                        <input type="number" id="scenario-opt-revenue" class="input input--sm scenario-input" 
                               data-scenario="optimistic" data-field="revenueChange"
                               value="${(optimistic.revenueChange * 100).toFixed(0)}" step="5">%
                        <label for="scenario-opt-cost">تغير التكاليف:</label>
                        <input type="number" id="scenario-opt-cost" class="input input--sm scenario-input" 
                               data-scenario="optimistic" data-field="costChange"
                               value="${(optimistic.costChange * 100).toFixed(0)}" step="5">%
                    </div>
                    <div class="scenario-results">
                        <div class="kpi"><span>صافي القيمة الحالية</span><span class="text-success">${formatCurrency(viewOpt.npv)}</span></div>
                        <div class="kpi"><span>معدل العائد الداخلي</span><span>${formatPercent(viewOpt.irr)}</span></div>
                        <div class="kpi"><span>فترة الاسترداد</span><span>${fmtPayback(viewOpt.payback)}</span></div>
                    </div>
                </div>
            </div>

            <!-- تدقيق 2026-07-08 (ملاحظة منخفضة #60): كانت العبارة تشير لتحليل حساسية
            "أدناه" رغم أن دالة عرضه أُزيلت من هذا المكوّن ونُقلت لخطوة منفصلة تماماً
            (كما يوضّح تنبيه أعلى الصفحة) — "أدناه" أصبحت مضلِّلة بعد إعادة الهيكلة. -->
            <p class="text-xs text-muted mt-2">يجمع كل سيناريو تغييرين معاً: الإيرادات والتكاليف في آنٍ واحد (مثلاً المتفائل ${(optimistic.revenueChange * 100).toFixed(0)}% إيراد و${(optimistic.costChange * 100).toFixed(0)}% تكاليف)، لذلك أثره على صافي القيمة الحالية أكبر بكثير من تحليل الحساسية أحادي المتغير (±10%) في خطوة «تحليل الحساسية» المنفصلة — بسبب الرافعة التشغيلية العالية، لا بسبب خطأ حسابي.</p>

            <!-- Feasibility Verdict -->
            <!-- تدقيق 2026-07-08 (ملاحظة متوسطة #34): viewPess.npv==null (تعذّر الحساب
            فعلياً، لا سيناريو سالب حقيقي) كان يقع في نفس فرع "قد لا يكون مجدياً" لأن
            null > 0 === false — استنتاج مالي حاسم زائف بدل الإفصاح عن تعذّر الحساب،
            يخالف نفس مبدأ "null لا صفر ملفَّق" المطبَّق على بطاقات المؤشرات أعلاه. -->
            <div class="verdict-box ${viewPess.npv == null ? 'verdict-neutral' : (viewPess.npv > 0 ? 'verdict-success' : 'verdict-warning')}">
                ${viewPess.npv == null
                ? '❔ تعذّر حساب السيناريو المتشائم — أكمل بيانات الدراسة الأساسية (الإيرادات والتكاليف) أولاً'
                : (viewPess.npv > 0
                    ? '✅ المشروع مجدي حتى في السيناريو المتشائم'
                    : '⚠️ المشروع قد لا يكون مجدياً في السيناريو المتشائم')}
            </div>
        `;
    }

    // ملاحظة: أُزيلت 3 دوال عرض ميتة (renderSensitivityAnalysis/renderBreakEven/renderCharts)
    // لم يعد render() يستدعيها منذ توجيه المستخدم لخطوتي «الحساسية»/«نقطة التعادل» المستقلتين —
    // وكانت تحمل أرقاماً ملفّقة جاهزة للعودة إن أُعيد تفعيلها سهواً (baseNPV احتياطي 100,000
    // ريال، سعر وحدة ثابت 100، طاقة قصوى 1,000 — لا علاقة لها ببيانات الدراسة الفعلية).

    bindEvents() {
        // Navigation
        this.container.querySelector('.btn-prev-step')?.addEventListener('click', () => {
            if (this.onNavigate) this.onNavigate(this.stepIndex - 1);
        });
        this.container.querySelector('.btn-next-step')?.addEventListener('click', () => {
            if (this.onNavigate) this.onNavigate(this.stepIndex + 1);
        });

        // Scenario inputs
        this.container.querySelectorAll('.scenario-input').forEach(input => {
            input.addEventListener('change', (e) => this.updateScenario(e));
        });
    }

    updateScenario(e) {
        const scenario = e.target.dataset.scenario;
        const field = e.target.dataset.field;
        const value = parseFloat(e.target.value) / 100;

        const state = this.store.getState();
        const scenarios = { ...state.scenarios };
        scenarios[scenario] = { ...scenarios[scenario], [field]: value };

        this.store.update('scenarios', scenarios);
        this.render();
    }
}
