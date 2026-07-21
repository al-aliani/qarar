/**
 * Financial Dashboard Component
 * Displays aggregated CAPEX/OPEX, Income Statement, and Key Indicators
 */
// توحيد مصدر الحقيقة (تدقيق 2026-07-04): كانت اللوحة تحسب عبر محرك مالي موازي قديم
// (بلا زكاة، خصم 5%) فتعرض NPV/IRR مختلفة عن التقرير المُصدَّر لنفس الدراسة.
// الآن كل الشاشات والمصدّرات تقرأ من engine.js حصراً.
import { calculateStudy as runFullModel } from '../core/engine.js';
import { hasMinimumRevenueData } from '../utils/dataSufficiency.js';
import { DEFAULT_SCENARIOS } from '../core/schema.js';
import { SmartAdvisor } from '../services/SmartAdvisor.js';
import { aiConnector } from '../services/AIConnector.js';
import { indicatorHelp } from '../utils/glossary.js';
import { ScenarioSwitcher } from './ScenarioSwitcher.js';
import { PresentationView } from './PresentationView.js';
import { renderBenchmarkingSection } from './BenchmarkingView.js'; // المهمة 4 — هل أرقامي منطقية؟

// «اسأل عن رقمك» — تحويل سؤال حر مثل «لو زاد الإيجار 20%؟» لتغيير فعلي عبر نفس آلية
// تجاوزات المحرك (overrides) التي تستخدمها منزلقات اختبار الضغط في لوحة القرار
// (engine.js calculateStudy(study, overrides): revenueChange/opexChange/priceChange/
// fixedChange...) بدل نص عام لا يقرأ السؤال المكتوب فعلياً.
const LEVER_INCREASE_RE = /(زد|رفعت?|ارتفعت?|زادت?|زياد[ةه]?)[^\d%]{0,15}(إيجار|ايجار|إيراد|ايراد|مبيعات|تكلفة|سعر|أسعار|اسعار)[^\d%]{0,10}(\d{1,3}(?:\.\d+)?)\s*%/;
const LEVER_DECREASE_RE = /(خفّض|خفضت?|قلّلت?|قللت?|نقصت?|انخفضت?|تراجعت?)[^\d%]{0,15}(إيجار|ايجار|إيراد|ايراد|مبيعات|تكلفة|سعر|أسعار|اسعار)[^\d%]{0,10}(\d{1,3}(?:\.\d+)?)\s*%/;

function normalizeAlef(s) { return String(s || '').replace(/[إأآ]/g, 'ا'); }

// أيقونة من الـsprite الموحّد بدل إيموجي — تدقيق تنظيف 2026-07-11.
const icon = (id) => `<svg class="ic" aria-hidden="true"><use href="#${id}"/></svg>`;

/** يحدد مفتاح تجاوز المحرك (override key) والتسمية المعروضة من كلمة المتغير المطابَقة */
function detectLever(word) {
    const w = normalizeAlef(word);
    if (w.includes('ايجار')) return { key: 'fixedChange', label: 'الإيجار' };
    if (w.includes('مبيعات')) return { key: 'revenueChange', label: 'المبيعات' };
    if (w.includes('ايراد')) return { key: 'revenueChange', label: 'الإيراد' };
    if (w.includes('تكلفة')) return { key: 'opexChange', label: 'التكلفة' };
    if (w.includes('سعر') || w.includes('اسعار')) return { key: 'priceChange', label: 'السعر' };
    return null;
}

/**
 * يحلّل سؤالاً حراً بحثاً عن نمط «(زد|رفع|ارتفع) <متغير> <رقم>%» أو
 * «(خفّض|قلل|انخفض) <متغير> <رقم>%» ويعيد مفتاح التجاوز ونسبته الموقّعة، أو null إن لم يُطابق.
 * @param {string} q
 * @returns {{leverKey:string, leverLabel:string, pct:number, signedFraction:number, sign:1|-1}|null}
 */
export function parseNumberQuestion(q) {
    if (!q) return null;
    let m = q.match(LEVER_INCREASE_RE);
    let sign = 1;
    if (!m) {
        m = q.match(LEVER_DECREASE_RE);
        sign = -1;
    }
    if (!m) return null;
    const pct = parseFloat(m[3]);
    if (!Number.isFinite(pct) || pct <= 0) return null;
    const lever = detectLever(m[2]);
    if (!lever) return null;
    return { leverKey: lever.key, leverLabel: lever.label, pct, signedFraction: sign * (pct / 100), sign };
}

export class FinancialDashboard {
    constructor(containerId, store) {
        this.container = document.getElementById(containerId);
        this.store = store;
        this.results = null;
        this._chartInstance = null;
        this._forecastChartInstance = null;
        this._eventListeners = [];
    }

    // Cleanup method to prevent memory leaks
    cleanup() {
        // Destroy chart instances
        if (this._chartInstance) {
            this._chartInstance.destroy();
            this._chartInstance = null;
        }
        if (this._forecastChartInstance) {
            this._forecastChartInstance.destroy();
            this._forecastChartInstance = null;
        }

        // Remove event listeners
        this._eventListeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        this._eventListeners = [];
    }

    render() {
        if (!this.container) return;

        // Run the full financial model
        const studyData = this.store.get ? this.store.get() : this.store.getState();

        // بلا إيرادات لا معنى للوحة: المحرك يعيد NPV/ROI سالبة مضللة لمشروع لم تُدخل
        // بياناته بعد — نعرض حالة «لا بيانات» إرشادية بدل بطاقات بأرقام سالبة.
        if (!hasMinimumRevenueData(studyData)) {
            this.container.innerHTML = `
                <div class="card glass-card">
                    <h2 class="card-title">لوحة المؤشرات المالية</h2>
                    <div class="alert alert--warning">
                        <p><strong><svg class="ic" aria-hidden="true"><use href="#i-warning"/></svg> لا توجد بيانات إيرادات. يرجى إضافة مصادر الإيرادات في خطوة "مصادر الإيرادات".</strong></p>
                        <p class="text-sm mt-2">لعرض المؤشرات المالية (صافي القيمة الحالية، العائد، التعادل) أكمل:</p>
                        <ul class="text-sm mt-2" style="list-style: disc; padding-right: 20px;">
                            <li>مصادر الإيرادات (خطوة "مصادر الإيرادات")</li>
                            <li>التكاليف الرأسمالية (خطوة "الدراسة الفنية")</li>
                            <li>التكاليف التشغيلية (خطوات "الموارد البشرية" و"اللوجستية" و"الإدارية")</li>
                        </ul>
                    </div>
                </div>`;
            return;
        }

        try {
            this.results = runFullModel(studyData);
        } catch (e) {
            console.warn('FinancialDashboard: runFullModel failed', e);
            this.results = null;
        }
        if (!this.results || !this.results.incomeStatement) {
            this.container.innerHTML = `
                <div class="card glass-card">
                    <h2 class="card-title">لوحة المؤشرات المالية</h2>
                    <p class="text-muted">لا يمكن تشغيل النموذج المالي. أكمل: <strong>التكاليف الرأسمالية</strong>، <strong>مصادر الإيرادات</strong>، و<strong>هيكل التمويل</strong> من القائمة الجانبية.</p>
                </div>`;
            return;
        }

        const { capex, opex, depreciation, incomeStatement, indicators, decision, cashFlow, assumptionsApplied } = this.results;
        // تدقيق 2026-07-08: كانت بطاقتا IRR/ROI تلوّنان بعتبات ثابتة (5%/0%) منفصلة عن
        // عتبات شارة القرار (15%/20%) — نفس الشاشة تُظهر بطاقة خضراء "إيجابي" بجانب
        // شارة قرار حمراء REVISE مباشرة. الآن تُقرأ من نفس مصدر العتبات الموحّد.
        const decisionThresholds = assumptionsApplied?.thresholds || { minIRR: 0.15, minROI: 0.20 };
        const isSimpleView = (studyData.appSettings?.mode || 'advanced') === 'mini';
        const y1 = incomeStatement[0] || {};
        const revY1 = y1.revenue ?? 0;
        const costY1 = (y1.variableCosts ?? 0) + (y1.fixedCosts ?? 0) + (y1.depreciation ?? 0);
        // المحرك يعيد التعادل بوحدات سنوية — نعرضه شهرياً (البطاقة معنونة «وحدة/شهر»)
        const breakevenMonthly = typeof indicators.breakevenUnitsPerMonth === 'number'
            ? indicators.breakevenUnitsPerMonth
            : (Number.isFinite(indicators.breakEvenUnits) ? indicators.breakEvenUnits / 12 : null);
        const breakevenDisplay = breakevenMonthly != null ? Math.round(breakevenMonthly) : '—';

        // النسب المالية (سيولة/ملاءة/ربحية) — إضافة إضافية بحتة من engine.js (result.ratios)،
        // سنة أولى فقط لهذه اللوحة؛ null تعني «غير قابلة للحساب» فتُعرض كشرطة لا صفر/رقم منفجر.
        const ratiosY1 = this.results.ratios?.[0] || {};
        const currentRatioDisplay = Number.isFinite(ratiosY1.currentRatio) ? `${ratiosY1.currentRatio.toFixed(2)}x` : '—';
        const currentRatioSentiment = !Number.isFinite(ratiosY1.currentRatio) ? 'neutral'
            : (ratiosY1.currentRatio >= 1.5 ? 'positive' : (ratiosY1.currentRatio < 1 ? 'negative' : 'neutral'));
        const debtRatioDisplay = Number.isFinite(ratiosY1.debtRatio) ? `${(ratiosY1.debtRatio * 100).toFixed(1)}%` : '—';
        const debtRatioSentiment = !Number.isFinite(ratiosY1.debtRatio) ? 'neutral'
            : (ratiosY1.debtRatio < 0.6 ? 'positive' : (ratiosY1.debtRatio > 0.85 ? 'negative' : 'neutral'));
        const roaDisplay = Number.isFinite(ratiosY1.roa) ? `${(ratiosY1.roa * 100).toFixed(1)}%` : '—';
        const roaSentiment = !Number.isFinite(ratiosY1.roa) ? 'neutral' : (ratiosY1.roa > 0 ? 'positive' : 'negative');
        const roeDisplay = Number.isFinite(ratiosY1.roe) ? `${(ratiosY1.roe * 100).toFixed(1)}%` : '—';
        const roeSentiment = !Number.isFinite(ratiosY1.roe) ? 'neutral' : (ratiosY1.roe > 0 ? 'positive' : 'negative');

        // تدقيق 2026-07-08 (ملاحظة عالية #28): كل بطاقات kpi-card كانت تستخدم تراكباً
        // أبيض ثابتاً بدل var(--c-surface-2) — فتبدو غامقة/متناقضة على أرضية الثيم الفاتح
        // (ورقي دافئ لا رمادي).
        this.container.innerHTML = `
            <h2 class="section-title">لوحة المؤشرات المالية</h2>
            <!-- Decision Banner: قرار ثلاثي GO / REVISE / NO-GO (لا يُختزل إلى ثنائي) -->
            <div class="decision-banner ${decision === 'GO' ? 'is-go' : (decision === 'REVISE' ? 'is-revise' : 'is-nogo')}">
                <div class="decision-label">${decision === 'GO' ? 'المشروع مجدٍ' : (decision === 'REVISE' ? 'المشروع يحتاج مراجعة' : 'المشروع غير مجدٍ')}</div>
                <div class="flex gap-2 items-center">
                    <button type="button" id="btnSimpleViewToggle" class="btn btn--sm ${isSimpleView ? 'btn--primary' : 'btn--ghost'}" title="${isSimpleView ? 'الرجوع للعرض الكامل (NPV، IRR)' : 'عرض مبسّط: هل ربح؟ متى استرداد؟ حد التعادل؟'}">${isSimpleView ? 'عرض كامل' : 'عرض مبسّط'}</button>
                    <button id="btnPresentationMode" class="btn btn--secondary btn--sm">
                        عرض تقديمي
                    </button>
                </div>
            </div>

            <!-- عرض مبسّط (Brixx/StratPad) — هل المشروع ربح؟ متى يسترد؟ ما حد التعادل؟ -->
            <div id="simpleViewPanel" class="card glass-card mt-4 ${isSimpleView ? '' : 'hidden'}" aria-label="عرض مبسّط للمؤشرات">
                <h3 class="card-title mb-3"><svg class="ic" aria-hidden="true"><use href="#i-bolt"/></svg> عرض مبسّط</h3>
                <p class="text-xs text-muted mb-3">بدون مصطلحات متقدمة (NPV، IRR) — ثلاثة أسئلة فقط.</p>
                <div class="indicators-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
                    <div class="kpi-card" style="background: var(--c-surface-2); border-radius: 8px; padding: 16px;">
                        <div class="kpi-label text-muted">هل المشروع ربح؟</div>
                        <div class="kpi-value ${(y1.netIncome ?? 0) >= 0 ? 'text-success' : 'text-danger'}">${(y1.netIncome ?? 0) >= 0 ? 'نعم <svg class="ic" aria-hidden="true"><use href="#i-check"/></svg>' : 'لا <svg class="ic" aria-hidden="true"><use href="#i-x"/></svg>'}</div>
                    </div>
                    <div class="kpi-card" style="background: var(--c-surface-2); border-radius: 8px; padding: 16px;">
                        <div class="kpi-label text-muted">متى يسترد رأس المال؟</div>
                        <div class="kpi-value text-gold">${indicators.paybackPeriod != null && Number.isFinite(indicators.paybackPeriod) ? indicators.paybackPeriod.toFixed(1) + ' سنة' : 'غير محدد'}</div>
                    </div>
                    <div class="kpi-card" style="background: var(--c-surface-2); border-radius: 8px; padding: 16px;">
                        <div class="kpi-label text-muted">ما حد التعادل؟</div>
                        <div class="kpi-value">${breakevenDisplay} وحدة/شهر</div>
                        <p class="text-xs text-muted mt-1">مبيعات شهرية للتعادل</p>
                    </div>
                </div>
            </div>

            <!-- Scenario Switcher Panel -->
            <div id="scenarioSwitcherContainer" class="${isSimpleView ? 'hidden' : ''}"></div>

            <!-- لوحة KPI واحدة (Brixx/Fathom) — الإيراد، التكلفة، الصافي، الاسترداد، التعادل، DSCR -->
            <div class="card glass-card mt-4 ${isSimpleView ? 'hidden' : ''}" id="unifiedKpiPanel" aria-label="لوحة KPI">
                <h3 class="card-title mb-3"><svg class="ic" aria-hidden="true"><use href="#i-chart"/></svg> لوحة KPI</h3>
                <p class="text-xs text-muted mb-3">الإيراد، التكلفة، الصافي، الاسترداد، التعادل، DSCR في بطاقات واحدة.</p>
                <div class="indicators-grid" style="grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));">
                    <div class="kpi-card" style="background: var(--c-surface-2); border-radius: 8px; padding: 12px;"><div class="kpi-label text-muted text-xs">الإيراد (سنة 1)</div><div class="kpi-value text-sm text-success">${this.formatCurrency(revY1)}</div></div>
                    <div class="kpi-card" style="background: var(--c-surface-2); border-radius: 8px; padding: 12px;"><div class="kpi-label text-muted text-xs">التكلفة (سنة 1)</div><div class="kpi-value text-sm">${this.formatCurrency(costY1)}</div></div>
                    <div class="kpi-card" style="background: var(--c-surface-2); border-radius: 8px; padding: 12px;"><div class="kpi-label text-muted text-xs">الصافي (سنة 1)</div><div class="kpi-value text-sm ${(y1.netIncome ?? 0) >= 0 ? 'text-gold' : 'text-danger'}">${this.formatCurrency(y1.netIncome ?? 0)}</div></div>
                    <div class="kpi-card" style="background: var(--c-surface-2); border-radius: 8px; padding: 12px;"><div class="kpi-label text-muted text-xs">الاسترداد</div><div class="kpi-value text-sm">${indicators.paybackPeriod != null && Number.isFinite(indicators.paybackPeriod) ? indicators.paybackPeriod.toFixed(1) + ' سنة' : '—'}</div></div>
                    <div class="kpi-card" style="background: var(--c-surface-2); border-radius: 8px; padding: 12px;"><div class="kpi-label text-muted text-xs">التعادل</div><div class="kpi-value text-sm text-gold">${breakevenDisplay} وحدة/شهر</div></div>
                    <div class="kpi-card" style="background: var(--c-surface-2); border-radius: 8px; padding: 12px;"><div class="kpi-label text-muted text-xs">DSCR</div><div class="kpi-value text-sm">${this.formatDscr(indicators.dscr)}</div></div>
                </div>
            </div>

            <!-- التدفق النقدي السنوي (رسم بياني) — Brixx/Fathom -->
            <div class="card glass-card mt-4 ${isSimpleView ? 'hidden' : ''}" id="cashFlowChartPanel">
                <h3 class="card-title mb-3"><svg class="ic" aria-hidden="true"><use href="#i-bank"/></svg> التدفق النقدي السنوي</h3>
                <p class="text-xs text-muted mb-3">عرض التدفق النقدي على الرسم البياني (سنوي).</p>
                <canvas id="cashFlowChartAnnual" height="180"></canvas>
            </div>

            <!-- لوحة توقعات (Section 44–50: Tarken/Baremetrics) — إيراد، تكلفة، صافي 5–7 سنوات + مقارنة سيناريوهات -->
            <div class="card glass-card mt-4 ${isSimpleView ? 'hidden' : ''}" id="forecastPanel">
                <h3 class="card-title mb-3"><svg class="ic" aria-hidden="true"><use href="#i-chart"/></svg> لوحة توقعات (5–7 سنوات)</h3>
                <p class="text-xs text-muted mb-3">رسم الإيراد والتكلفة والصافي على مدى فترة الدراسة؛ مع إمكانية مقارنة صافي الربح بين السيناريوهات.</p>
                <div class="flex flex-wrap gap-2 mb-3">
                    <button type="button" class="btn btn--sm btn-forecast-mode active" data-mode="revenue-cost-net">الإيراد والتكلفة والصافي</button>
                    <button type="button" class="btn btn--sm btn-forecast-mode btn--ghost" data-mode="scenarios">مقارنة السيناريوهات (صافي الربح)</button>
                </div>
                <canvas id="forecastChart" height="220"></canvas>
            </div>

            <!-- لوحة الأداء (LivePlan / Upmetrics) — ربح متوقع، تدفق نقدي، فترة الدراسة 5 أو 7 سنوات -->
            <div class="card glass-card mt-4 ${isSimpleView ? 'hidden' : ''}" id="performancePanel" aria-label="لوحة الأداء">
                <h3 class="card-title mb-3"><svg class="ic" aria-hidden="true"><use href="#i-chart"/></svg> لوحة الأداء</h3>
                <p class="text-xs text-muted mb-3">تحديث فوري عند تغيير المدخلات (الملخص، الإيرادات، التكاليف، التمويل).</p>
                <div class="flex flex-wrap items-center gap-4 mb-3" style="margin-bottom: 12px;">
                    <span class="text-sm text-muted">فترة الدراسة (توقعات طويلة):</span>
                    <div class="flex gap-2" role="group" aria-label="فترة الدراسة بالسنوات">
                        <button type="button" class="btn btn--sm projection-years-btn ${(studyData.assumptions?.projectionYears || 5) === 5 ? 'btn--primary' : 'btn--ghost'}" data-years="5">5 سنوات</button>
                        <button type="button" class="btn btn--sm projection-years-btn ${(studyData.assumptions?.projectionYears || 5) === 7 ? 'btn--primary' : 'btn--ghost'}" data-years="7">7 سنوات</button>
                    </div>
                </div>
                <div class="indicators-grid" style="grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));">
                    <div class="kpi-card" style="background: var(--c-surface-2); border-radius: 8px; padding: 14px;">
                        <div class="kpi-label text-muted">الربح المتوقع (السنة 1)</div>
                        <div class="kpi-value ${(incomeStatement[0]?.netIncome || 0) >= 0 ? 'text-gold' : 'text-danger'}">${this.formatCurrency(incomeStatement[0]?.netIncome ?? 0)}</div>
                    </div>
                    <div class="kpi-card" style="background: var(--c-surface-2); border-radius: 8px; padding: 14px;">
                        <div class="kpi-label text-muted">التدفق النقدي (السنة 1)</div>
                        <div class="kpi-value">${this.formatCurrency((incomeStatement[0]?.netIncome ?? 0) + (incomeStatement[0]?.depreciation ?? 0))}</div>
                        <p class="text-xs text-muted mt-1">صافي ربح + استهلاك</p>
                    </div>
                </div>
            </div>

            <!-- Key Indicators Grid (مخفى في العرض المبسّط) -->
            <div id="fullKpiGrid" class="indicators-grid ${isSimpleView ? 'hidden' : ''}">
                ${this.renderKPICard('NPV', 'صافي القيمة الحالية', this.formatCurrency(indicators.npv), indicators.npv >= 0 ? 'positive' : 'negative')}
                ${this.renderKPICard('IRR', 'معدل العائد الداخلي', this.formatPercent(indicators.irr), indicators.irr >= decisionThresholds.minIRR ? 'positive' : 'negative')}
                ${this.renderKPICard('PAYBACK', 'فترة الاسترداد', (indicators.paybackPeriod != null && Number.isFinite(indicators.paybackPeriod)) ? indicators.paybackPeriod.toFixed(1) + ' سنة' : 'غير قابل للاسترداد خلال فترة الدراسة', 'neutral')}
                ${this.renderKPICard('ROI', 'العائد على الاستثمار', this.formatPercent(indicators.roi), indicators.roi >= decisionThresholds.minROI ? 'positive' : 'negative')}
            </div>

            <!-- النسب المالية (سنة 1) — سيولة/ملاءة/ربحية من engine.js result.ratios (مخفى في العرض المبسّط) -->
            <div id="ratiosKpiGrid" class="indicators-grid ${isSimpleView ? 'hidden' : ''}">
                ${this.renderKPICard(null, 'نسبة التداول', currentRatioDisplay, currentRatioSentiment)}
                ${this.renderKPICard(null, 'نسبة الدين إلى الأصول', debtRatioDisplay, debtRatioSentiment)}
                ${this.renderKPICard(null, 'العائد على الأصول', roaDisplay, roaSentiment)}
                ${this.renderKPICard(null, 'العائد على حقوق الملكية', roeDisplay, roeSentiment)}
            </div>

            <!-- لوحة مؤشرات القرار (تعادل، عائد، DSCR) - مدارج -->
            <div class="card glass-card mt-4 ${isSimpleView ? 'hidden' : ''}" id="decisionIndicatorsPanel">
                <h3 class="card-title mb-3"><svg class="ic" aria-hidden="true"><use href="#i-chart"/></svg> مؤشرات القرار والجدارة التمويلية</h3>
                <div class="indicators-grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));">
                    <div class="kpi-card" style="background: var(--c-surface-2); border-radius: 8px; padding: 16px;">
                        <div class="kpi-label text-muted">نقطة التعادل (وحدات/شهر)</div>
                        <div class="kpi-value text-gold">${breakevenDisplay}</div>
                        <p class="text-xs text-muted mt-1">مبيعات شهرية للوصول لتعادل التكاليف</p>
                    </div>
                    <div class="kpi-card" style="background: var(--c-surface-2); border-radius: 8px; padding: 16px;">
                        <div class="kpi-label text-muted">العائد على الاستثمار (ROI)</div>
                        <div class="kpi-value ${(indicators.roi || 0) >= decisionThresholds.minROI ? 'positive' : 'negative'}">${this.formatPercent(indicators.roi)}</div>
                        <p class="text-xs text-muted mt-1">عائد سنوي على إجمالي الاستثمار</p>
                    </div>
                    <div class="kpi-card" style="background: var(--c-surface-2); border-radius: 8px; padding: 16px;">
                        <div class="kpi-label text-muted">نسبة تغطية خدمة الدين (DSCR)</div>
                        <div class="kpi-value">${this.formatDscr(indicators.dscr)}</div>
                        <p class="text-xs text-muted mt-1">${this.getDscrExplanation(indicators.dscr, this.results?.dscrAnalysis)}</p>
                    </div>
                </div>
            </div>

            <!-- نظرة المدقق: مصالحة الطاقة + المتغير المهيمن + القيمة النهائية -->
            ${this.renderAuditorPanel(this.results)}

            <!-- Smart Advisor Section -->
            <div class="card glass-card mt-4 advisor-panel">
                <div class="flex-between mb-4">
                    <div style="display:flex; gap:10px; align-items:center;">
                        <svg class="ic" aria-hidden="true" style="width:1.5rem;height:1.5rem;"><use href="#i-auto"/></svg>
                        <div>
                            <h3 class="card-title mb-0">المستشار الذكي</h3>
                            <p class="text-muted text-sm">تحليل فوري لأداء مشروعك مقارنة بالسوق</p>
                        </div>
                    </div>
                    <button class="btn-xs btn-magic ai-consultant-btn">
                        <svg class="ic" aria-hidden="true"><use href="#i-bolt"/></svg> طلب تقرير مفصل
                    </button>
                </div>
                
                <div id="advisorInsights">
                    ${this.renderAdvisorInsights(this.results, studyData)}
                </div>
                
                <div id="aiConsultationBox" class="mt-4 hidden p-4" style="background:rgba(0,0,0,0.3); border-radius:8px; border:1px solid var(--c-p-500);">
                    <!-- AI content goes here -->
                </div>
                <div class="mt-4 p-3 rounded-lg border border-border bg-card" id="askAboutNumbersPanel" aria-label="اسأل عن رقمك">
                    <h4 class="card-title mb-2 text-sm">اسأل عن رقمك — مساعد مالي</h4>
                    <p class="text-xs text-muted mb-2">مثال: «هل مشروعي مجدٍ إذا زاد الإيجار 20%؟» — نُفسّر بناءً على نموذج الحساسية ونقترح إجراء.</p>
                    <p class="text-xs text-gold mb-2"><svg class="ic" aria-hidden="true"><use href="#i-lightbulb"/></svg> يمكنك كتابة طلب بلغة عادية، مثل: زد الإيراد 10% أو خفّض التكلفة 5%.</p>
                    <div class="flex gap-2 flex-wrap">
                        <input type="text" id="askAboutNumbersInput" class="input flex-grow" placeholder="اكتب سؤالك عن الأرقام أو السيناريوهات..." style="min-width:200px;" />
                        <button type="button" class="btn btn--sm btn-magic" id="askAboutNumbersBtn">اسأل</button>
                    </div>
                    <div id="askAboutNumbersAnswer" class="mt-3 text-sm text-muted hidden"></div>
                </div>
                ${this.renderImprovementSuggestions(this.results, studyData)}
                ${renderBenchmarkingSection(this.results, studyData)}
            </div>

            <!-- CAPEX Summary -->
            <div class="card mt-4">
                <h3 class="text-gold">ملخص التكاليف الرأسمالية</h3>
                <table class="summary-table">
                    <tr><td>التجهيزات والمعدات</td><td class="text-mono">${this.formatCurrency(capex.subtotal)}</td></tr>
                    <tr><td>احتياطي طوارئ (10%)</td><td class="text-mono">${this.formatCurrency(capex.contingency)}</td></tr>
                    <tr><td>رأس المال العامل</td><td class="text-mono">${this.formatCurrency(capex.workingCapital)}</td></tr>
                    <tr class="total-row"><td><strong>إجمالي الاستثمار المطلوب (شامل رأس المال العامل)</strong></td><td class="text-mono text-gold">${this.formatCurrency(capex.total)}</td></tr>
                </table>
            </div>

            <!-- OPEX Summary -->
            <div class="card mt-4">
                <h3 class="text-gold">ملخص التكاليف التشغيلية</h3>
                <table class="summary-table">
                    <tr><td>التكاليف الثابتة التشغيلية (بدون استهلاك)</td><td class="text-mono">${this.formatCurrency(opex.fixedAnnual)}</td></tr>
                    <tr><td>التكاليف المتغيرة (سنوياً)</td><td class="text-mono">${this.formatCurrency(opex.variableAnnual)}</td></tr>
                    <tr><td>الاستهلاك السنوي</td><td class="text-mono">${this.formatCurrency(depreciation)}</td></tr>
                    <tr class="total-row"><td><strong>إجمالي التشغيل السنوي</strong></td><td class="text-mono text-gold">${this.formatCurrency(opex.totalAnnual + depreciation)}</td></tr>
                </table>
            </div>

            ${this.renderLocalizationBreakdown(opex)}

            <!-- Income Statement (5 Years) -->
            <div class="card mt-4">
                <h3 class="text-gold">قائمة الدخل التقديرية (5 سنوات)</h3>
                <div class="table-wrapper">
                    <table class="income-statement">
                        <thead>
                            <tr>
                                <th>البند</th>
                                ${incomeStatement.map(s => `<th>السنة ${s.year}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>الإيرادات</td>
                                ${incomeStatement.map(s => `<td class="text-mono">${this.formatCompact(s.revenue)}</td>`).join('')}
                            </tr>
                            <tr>
                                <td>(-) التكاليف المتغيرة</td>
                                ${incomeStatement.map(s => `<td class="text-mono text-muted">(${this.formatCompact(s.variableCosts)})</td>`).join('')}
                            </tr>
                            <tr class="subtotal-row">
                                <td>مجمل الربح</td>
                                ${incomeStatement.map(s => `<td class="text-mono">${this.formatCompact(s.grossProfit)}</td>`).join('')}
                            </tr>
                            <tr>
                                <td>(-) التكاليف الثابتة</td>
                                ${incomeStatement.map(s => `<td class="text-mono text-muted">(${this.formatCompact(s.fixedCosts)})</td>`).join('')}
                            </tr>
                            <tr>
                                <td>(-) الاستهلاك</td>
                                ${incomeStatement.map(s => `<td class="text-mono text-muted">(${this.formatCompact(s.depreciation)})</td>`).join('')}
                            </tr>
                            <tr class="subtotal-row">
                                <td>الربح قبل الفوائد والضرائب (EBIT)</td>
                                ${incomeStatement.map(s => `<td class="text-mono">${this.formatCompact(s.ebit)}</td>`).join('')}
                            </tr>
                            <tr>
                                <td>(-) الفوائد البنكية</td>
                                ${incomeStatement.map(s => `<td class="text-mono text-muted">(${this.formatCompact(s.interestExpense ?? s.interest ?? 0)})</td>`).join('')}
                            </tr>
                            <tr class="subtotal-row">
                                <td>الربح قبل الزكاة</td>
                                ${incomeStatement.map(s => `<td class="text-mono">${this.formatCompact(s.profitBeforeZakat || s.ebt)}</td>`).join('')}
                            </tr>
                            <tr>
                                <td>(-) الضريبة (15% من الربح)</td>
                                ${incomeStatement.map(s => `<td class="text-mono text-muted">(${this.formatCompact(s.tax)})</td>`).join('')}
                            </tr>
                            <tr>
                                <td>(-) الزكاة التقديرية (2.5%)</td>
                                ${incomeStatement.map(s => `<td class="text-mono text-muted">(${this.formatCompact(s.zakat || 0)})</td>`).join('')}
                            </tr>
                            <tr class="total-row">
                                <td><strong>صافي الربح النهائي</strong></td>
                                ${incomeStatement.map(s => `<td class="text-mono ${s.netIncome >= 0 ? 'text-gold' : 'text-danger'}">${this.formatCompact(s.netIncome)}</td>`).join('')}
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Revenue vs Profit Chart -->
            <div class="card mt-4">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-gold">تحليل الإيرادات وصافي الربح</h3>
                    <div class="flex gap-2">
                        <button id="btnChartRevenue" class="btn btn--sm btn--ghost active" data-chart="revenue">الإيرادات</button>
                        <button id="btnChartProfit" class="btn btn--sm btn--ghost" data-chart="profit">الأرباح</button>
                        <button id="btnChartBoth" class="btn btn--sm btn--ghost" data-chart="both">كلاهما</button>
                    </div>
                </div>
                <canvas id="cashFlowChart" height="200"></canvas>
                <div class="mt-4 flex gap-4 justify-center text-sm text-muted">
                    <div class="flex items-center gap-2">
                        <div class="w-3 h-3 rounded-full bg-green-500"></div>
                        <span>الإيرادات السنوية</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <div class="w-3 h-3 rounded-full bg-blue-500"></div>
                        <span>صافي الربح</span>
                    </div>
                </div>
            </div>
        `;

        // Render cash flow chart using the shared Charts component
        // Note: Charts.js expects pnlData (Income Statement) to plot Revenue vs Net Income
        // But the placeholder says "Cumulative Cash Flow". 
        // We should probably adapt Charts.js or use it correctly.
        // Looking at Charts.js: render(pnlData) plots Revenue and NetIncome.
        // It does NOT plot Cumulative Cash Flow.
        // So we have a choice: Update Charts.js to support Cash Flow, or just pass P&L data here.
        // Let's pass P&L data to match Charts.js capability for now, or update Charts.js.
        // Given the label is "Cumulative Cash Flow", let's update the label in HTML or use the correct data.
        // But wait, the previous code had `renderCashFlowChart` inside this file.
        // Let's see if we can use Charts.js for P&L and keep the custom logic for Cash Flow, OR upgrade Charts.js.

        // For this task, I will use Charts.js to render the P&L chart (Revenue vs Net Income) 
        // as it is implemented in Charts.js, and rename the card to "تحليل الإيرادات والأرباح".

        this.renderPnlChart();
        this.renderCashFlowAnnualChart();
        this.renderForecastChart();

        this.bindEvents();

        // Initialize Scenario Switcher
        this.initializeScenarioSwitcher();
    }

    initializeScenarioSwitcher() {
        const scenarioSwitcher = new ScenarioSwitcher('scenarioSwitcherContainer', this.store);
        scenarioSwitcher.render();

        // Listen for scenario changes to update dashboard (إن وُجد من مكوّن آخر)
        // تدقيق 2026-07-11: كان يُضاف مستمع window مجهول في كل render() ولا يُزال أبداً
        // (cleanup لا يُستدعى، ومستمعات window لا تُجمَع تلقائياً كعناصر DOM المُعاد إنشاؤها)
        // فيتراكم وكلٌّ يستدعي render() → تضاعف الرسم. حارس idempotent يضيفه مرة واحدة فقط.
        if (!this._scenarioChangedBound) {
            this._scenarioChangedBound = (e) => {
                if (!e?.detail?.results) return;
                this.results = e.detail.results;
                this.render();
            };
            window.addEventListener('scenarioChanged', this._scenarioChangedBound);
        }
    }

    renderAdvisorInsights(results, inputs) {
        const analysis = SmartAdvisor.analyze(results, inputs);

        if (!analysis.insights.length) return '<p class="text-muted">لا توجد ملاحظات سلبية. أداء المشروع ممتاز! <svg class="ic" aria-hidden="true"><use href="#i-rocket"/></svg></p>';

        return `
            <div class="insights-list" style="display:flex; flex-direction:column; gap:10px;">
                ${analysis.insights.map(item => `
                    <div class="insight-item ${item.type}" style="display:flex; gap:10px; padding:10px; border-radius:6px; background:var(--c-surface-2); border-left: 4px solid ${this.getColorForType(item.type)}">
                        <div class="insight-icon">
                            ${item.type === 'danger' || item.type === 'critical' ? '<svg class="ic" aria-hidden="true"><use href="#i-warning"/></svg>' : item.type === 'warning' ? '<svg class="ic" aria-hidden="true"><use href="#i-hand-stop"/></svg>' : '<svg class="ic" aria-hidden="true"><use href="#i-check"/></svg>'}
                        </div>
                        <div class="insight-content">
                            <div class="insight-msg font-bold">${item.message}</div>
                            <div class="insight-action text-sm text-gold mt-1"><svg class="ic" aria-hidden="true"><use href="#i-lightbulb"/></svg> الحل المقترح: ${item.action}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="ratios-strip mt-4 flex gap-4 text-sm text-muted" style="display:flex; gap:15px; margin-top:10px; font-family:monospace;">
                <span><svg class="ic" aria-hidden="true"><use href="#i-chart"/></svg> COGS: ${(analysis.ratios.cogs * 100).toFixed(1)}%</span> |
                <span><svg class="ic" aria-hidden="true"><use href="#i-users"/></svg> Labor: ${(analysis.ratios.labor * 100).toFixed(1)}%</span> |
                <span><svg class="ic" aria-hidden="true"><use href="#i-home"/></svg> Rent: ${(analysis.ratios.rent * 100).toFixed(1)}%</span>
            </div>
        `;
    }

    getColorForType(type) {
        if (type === 'danger' || type === 'critical') return '#ef4444';
        if (type === 'warning') return '#f59e0b';
        return '#10b981';
    }

    /** توطين مالي — عرض GOSI، رسوم إقامة، تأمين صحي (المهمة 5) */
    renderLocalizationBreakdown(opex) {
        if (!opex?.fixed) return '';
        const items = opex.fixed.filter(i => i.autoCalculated === true);
        if (items.length === 0) return '';
        return `
            <div class="card mt-4" id="localizationBreakdown" aria-label="جدول توطين مالي">
                <h3 class="text-gold mb-2"><svg class="ic" aria-hidden="true"><use href="#i-flag-sa"/></svg> توطين مالي (محسوب تلقائياً)</h3>
                <p class="text-xs text-muted mb-3">التأمينات الاجتماعية (GOSI)، رسوم الإقامة، والتأمين الصحي — مدمجة من جدول الرواتب حسب الجنسية.</p>
                <table class="summary-table">
                    ${items.map(i => `
                        <tr>
                            <td>${(i.name || i.source || '').toString()}</td>
                            <td class="text-mono">${this.formatCurrency(i.annual ?? (i.monthly ?? 0) * 12)}</td>
                        </tr>
                    `).join('')}
                </table>
            </div>
        `;
    }

    /** اقتراحات التحسين (Modeliks) — نقاط من QA والحساسية مع زر «تطبيق الاقتراح» */
    renderImprovementSuggestions(results, studyData) {
        const analysis = SmartAdvisor.analyze(results || {}, studyData || {});
        const insights = analysis.insights || [];
        if (insights.length === 0) return '';
        return `
            <div class="mt-4 p-4 rounded-lg border border-border bg-card" id="improvementSuggestionsPanel" aria-label="اقتراحات التحسين">
                <h4 class="card-title mb-3">اقتراحات التحسين</h4>
                <p class="text-xs text-muted mb-3">مستخرجة من مؤشرات الجدوى والحساسية — كل نقطة مع إجراء مقترح.</p>
                <ul class="space-y-3" id="improvementSuggestionsList">
                    ${insights.map((item, i) => `
                        <li class="flex gap-3 items-start p-3 rounded-lg" style="background:var(--c-surface-2); border-left: 4px solid ${this.getColorForType(item.type)};">
                            <div class="flex-grow">
                                <div class="font-medium text-sm">${(item.message || '').toString().replace(/</g, '&lt;')}</div>
                                <div class="text-xs text-gold mt-1"><svg class="ic" aria-hidden="true"><use href="#i-lightbulb"/></svg> ${(item.action || '').toString().replace(/</g, '&lt;')}</div>
                            </div>
                            <button type="button" class="btn btn--sm btn--ghost btn-apply-improvement flex-shrink-0" data-insight-index="${i}" data-action="${(item.action || '').toString().replace(/"/g, '&quot;').replace(/`/g, '&#96;').slice(0, 100)}">تطبيق الاقتراح</button>
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    }

    bindEvents() {
        const btnSimpleView = this.container.querySelector('#btnSimpleViewToggle');
        if (btnSimpleView) {
            const handler = () => {
                const state = this.store.get ? this.store.get() : this.store.getState();
                const appSettings = { ...(state.appSettings || {}), mode: (state.appSettings?.mode || 'advanced') === 'mini' ? 'advanced' : 'mini' };
                this.store.update('appSettings', appSettings);
                if (this.store.notify) this.store.notify();
                this.render();
            };
            btnSimpleView.addEventListener('click', handler);
            this._eventListeners.push({ element: btnSimpleView, event: 'click', handler });
        }

        this.container.querySelectorAll('.projection-years-btn').forEach(btn => {
            const handler = () => {
                const years = parseInt(btn.dataset.years, 10);
                if (years !== 5 && years !== 7) return;
                const state = this.store.get ? this.store.get() : this.store.getState();
                const assumptions = { ...(state.assumptions || {}), projectionYears: years };
                this.store.update('assumptions', assumptions);
                if (this.store.notify) this.store.notify();
                this.render();
            };
            btn.addEventListener('click', handler);
            this._eventListeners.push({ element: btn, event: 'click', handler });
        });

        const aiBtn = this.container.querySelector('.ai-consultant-btn');
        if (aiBtn) {
            const handler = async (e) => {
                // ... (existing AI logic)
                const box = this.container.querySelector('#aiConsultationBox');
                box.classList.remove('hidden');
                box.innerHTML = '<div class="spinner-sm"></div> جاري كتابة التقرير الاستشاري...';
                e.target.disabled = true;

                try {
                    const state = this.store.get();
                    // Pass simplified context to AI — نستخدم this.results (محسوبة طازجة في render())
                    // بدل state.results المخزّنة في الحالة والتي قد تكون فارغة/قديمة.
                    const context = {
                        kpis: this.results?.indicators || {},
                        insights: SmartAdvisor.analyze(this.results || {}, state).insights
                    };

                    const report = await aiConnector.query('', 'consultant_review', context);
                    if (report == null) {
                        box.innerHTML = '<p class="text-muted">تعذر توليد التقرير حالياً — التحليل الفوري أعلاه (المستشار الذكي) يغطي أهم الملاحظات.</p>';
                        e.target.disabled = false;
                        return;
                    }
                    let text = report;
                    if (typeof report === 'object' && report.content) text = report.content;
                    else if (typeof report !== 'string') text = JSON.stringify(report);

                    box.innerHTML = `<h4 class="text-gold mb-2">رأي المستشار الرقمي:</h4><p style="white-space: pre-line; line-height:1.6;">${text}</p>`;
                } catch (err) {
                    console.error(err);
                    box.innerHTML = 'حدث خطأ في الاتصال بالمستشار.';
                }

                e.target.disabled = false;
            };
            aiBtn.addEventListener('click', handler);
            this._eventListeners.push({ element: aiBtn, event: 'click', handler });
        }

        this.container.querySelectorAll('.btn-apply-improvement').forEach(btn => {
            const handler = () => {
                const action = btn.dataset.action || '';
                if (typeof toast !== 'undefined') toast.info('الإجراء المقترح: ' + action);
                window.dispatchEvent(new CustomEvent('feasibility:applyImprovement', { detail: { action } }));
            };
            btn.addEventListener('click', handler);
            this._eventListeners.push({ element: btn, event: 'click', handler });
        });

        const askInput = this.container.querySelector('#askAboutNumbersInput');
        const askBtn = this.container.querySelector('#askAboutNumbersBtn');
        const askAnswer = this.container.querySelector('#askAboutNumbersAnswer');
        if (askBtn && askAnswer) {
            const askHandler = async () => {
                const q = (askInput && askInput.value || '').trim();
                askAnswer.classList.remove('hidden');
                if (!q) {
                    const analysis = SmartAdvisor.analyze(this.results || {}, this.store.get ? this.store.get() : this.store.getState());
                    const tips = analysis.insights.length
                        ? analysis.insights.slice(0, 2).map(i => `• ${i.message} — ${i.action || '—'}`).join('<br>')
                        : 'لا توجد ملاحظات سلبية. أداء المشروع جيد.';
                    askAnswer.innerHTML = `<strong>توصيات المستشار:</strong><br>${tips}<br><br><span class="text-gold"><svg class="ic" aria-hidden="true"><use href="#i-lightbulb"/></svg> لأسئلة مثل «لو زاد الإيجار 20%؟» استخدم <strong>اختبار الضغط</strong> في لوحة القرار (منزلقات تغير الإيرادات/التكاليف) لتحديث النتائج فوراً.</span>`;
                    return;
                }

                // سؤال يطابق نمط «زد/خفّض <متغير> <رقم>%» — نحسب مقارنة حقيقية قبل/بعد عبر نفس
                // آلية تجاوزات المحرك التي تستخدمها منزلقات اختبار الضغط، بدل نص عام لا يقرأ
                // السؤال. حساب متزامن بالكامل (بلا await) كي يظهر الرد فوراً عند الضغط.
                const lever = parseNumberQuestion(q);
                if (lever && this.results?.incomeStatement?.[0]) {
                    try {
                        const stateForLever = this.store.get ? this.store.get() : this.store.getState();
                        const before = this.results;
                        const after = runFullModel(stateForLever, { [lever.leverKey]: lever.signedFraction });
                        if (after?.indicators && after?.incomeStatement?.[0]) {
                            const beforeNet = before.incomeStatement[0].netIncome ?? 0;
                            const afterNet = after.incomeStatement[0].netIncome ?? 0;
                            const afterNPV = after.indicators.npv ?? 0;
                            const netVerb = afterNet === beforeNet ? 'يبقى دون تغيير عند' : (afterNet > beforeNet ? 'يرتفع من' : 'ينخفض من');
                            const netClause = afterNet === beforeNet
                                ? `${netVerb} ${this.formatCurrency(afterNet)}`
                                : `${netVerb} ${this.formatCurrency(beforeNet)} إلى ${this.formatCurrency(afterNet)}`;
                            const npvClause = afterNPV >= 0
                                ? `صافي القيمة الحالية (NPV) يبقى موجباً عند ${this.formatCurrency(afterNPV)}`
                                : `صافي القيمة الحالية (NPV) يصبح سالباً عند ${this.formatCurrency(afterNPV)}`;
                            const actionPhrase = lever.sign === 1 ? 'بزيادة' : 'بخفض';
                            const text = `${actionPhrase} ${lever.leverLabel} ${lever.pct}%: صافي الربح ${netClause}، و${npvClause}.`;
                            askAnswer.innerHTML = `<strong>إجابة عن سؤالك:</strong><br><span style="white-space:pre-line;">${text}</span><br><br><span class="text-gold"><svg class="ic" aria-hidden="true"><use href="#i-lightbulb"/></svg> لاختبار سيناريوهات أخرى بدقة أكبر، استخدم منزلقات <strong>اختبار الضغط</strong> في لوحة القرار.</span>`;
                            return;
                        }
                    } catch (err) {
                        console.warn('Lever-based number question failed:', err);
                    }
                }

                askAnswer.innerHTML = '<span class="text-muted">جاري التحليل...</span>';
                const state = this.store.get ? this.store.get() : this.store.getState();
                const analysis = SmartAdvisor.analyze(this.results || {}, state);
                try {
                    const directAnswer = await aiConnector.query(q, 'advisor', {
                        projectInfo: state.projectInfo || {},
                        results: this.results,
                        context: {
                            question: q,
                            kpis: this.results?.indicators || {},
                            insights: analysis.insights || []
                        }
                    });
                    const answerText = typeof directAnswer === 'string' ? directAnswer : directAnswer?.content;
                    if (answerText) {
                        askAnswer.innerHTML = `<strong>إجابة عن سؤالك:</strong><br><span style="white-space:pre-line;">${String(answerText).replace(/</g, '&lt;')}</span>`;
                        return;
                    }
                } catch (err) {
                    console.warn('Direct number question fallback:', err);
                }
                const tips = analysis.insights.length
                    ? analysis.insights.slice(0, 3).map(i => `• ${i.message} — ${i.action || '—'}`).join('<br>')
                    : 'بناءً على النموذج الحالي: المؤشرات ضمن النطاق المقبول.';
                askAnswer.innerHTML = `<strong>بناءً على سؤالك:</strong><br>${tips}<br><br><span class="text-gold"><svg class="ic" aria-hidden="true"><use href="#i-lightbulb"/></svg> لاختبار «لو زاد الإيجار 20%؟» أو «لو انخفض الإيراد 10%؟» انتقل إلى <strong>لوحة القرار</strong> واستخدم منزلقات اختبار الضغط لتحديث NPV وهامش الربح فوراً.</span>`;
            };
            askBtn.addEventListener('click', askHandler);
            // تدقيق 2026-07-11: كان المفتاح askHandler بدل handler، فيفكّكه cleanup كـundefined
            // ولا يُزال المستمع أبداً. توحيد المفتاح مع بقية العناصر (handler).
            this._eventListeners.push({ element: askBtn, event: 'click', handler: askHandler });
            if (askInput) {
                const enterHandler = (e) => { if (e.key === 'Enter') askHandler(); };
                askInput.addEventListener('keydown', enterHandler);
                this._eventListeners.push({ element: askInput, event: 'keydown', handler: enterHandler });
            }
        }

        // Presentation Mode Button
        const presBtn = this.container.querySelector('#btnPresentationMode');
        if (presBtn) {
            const handler = () => {
                try {
                    const presentation = new PresentationView(this.store);
                    presentation.render();
                } catch (err) {
                    console.error('Presentation Error:', err);
                    alert('عذراً، حدث خطأ أثناء تشغيل العرض التقديمي.\n' + err.message);
                }
            };
            presBtn.addEventListener('click', handler);
            this._eventListeners.push({ element: presBtn, event: 'click', handler });
        }

        // Chart Toggle Buttons
        const chartBtns = this.container.querySelectorAll('[data-chart]');
        chartBtns.forEach(btn => {
            const handler = () => {
                chartBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const chartType = btn.dataset.chart;
                this.updateChart(chartType);
            };
            btn.addEventListener('click', handler);
            this._eventListeners.push({ element: btn, event: 'click', handler });
        });

        // لوحة توقعات: تبديل وضع الإيراد/التكلفة/الصافي vs مقارنة السيناريوهات
        const forecastModeBtns = this.container.querySelectorAll('.btn-forecast-mode');
        forecastModeBtns.forEach(btn => {
            const handler = () => {
                forecastModeBtns.forEach(b => { b.classList.remove('active'); b.classList.add('btn--ghost'); });
                btn.classList.add('active');
                btn.classList.remove('btn--ghost');
                this._forecastMode = btn.dataset.mode || 'revenue-cost-net';
                this.renderForecastChart();
            };
            btn.addEventListener('click', handler);
            this._eventListeners.push({ element: btn, event: 'click', handler });
        });
    }

    updateChart(chartType) {
        if (!this._chartInstance || !this.results?.incomeStatement) return;

        const data = this.results.incomeStatement;
        const labels = data.map(d => `السنة ${d.year}`);

        if (chartType === 'revenue') {
            this._chartInstance.data.datasets = [
                {
                    label: 'الإيرادات',
                    data: data.map(d => d.revenue),
                    backgroundColor: 'rgba(16, 185, 129, 0.6)',
                    borderColor: '#10b981',
                    borderWidth: 1
                }
            ];
        } else if (chartType === 'profit') {
            this._chartInstance.data.datasets = [
                {
                    label: 'صافي الربح',
                    data: data.map(d => d.netIncome),
                    backgroundColor: 'rgba(59, 130, 246, 0.6)',
                    borderColor: '#3b82f6',
                    borderWidth: 1
                }
            ];
        } else {
            // Both
            this._chartInstance.data.datasets = [
                {
                    label: 'الإيرادات',
                    data: data.map(d => d.revenue),
                    backgroundColor: 'rgba(16, 185, 129, 0.6)',
                    borderColor: '#10b981',
                    borderWidth: 1
                },
                {
                    label: 'صافي الربح',
                    data: data.map(d => d.netIncome),
                    backgroundColor: 'rgba(59, 130, 246, 0.6)',
                    borderColor: '#3b82f6',
                    borderWidth: 1,
                    type: 'line'
                }
            ];
        }

        this._chartInstance.update();
    }

    renderKPICard(term, label, value, status) {
        const statusClass = status === 'positive' ? 'kpi-positive' : status === 'negative' ? 'kpi-negative' : '';
        const statusText = status === 'positive' ? 'ضمن النطاق' : status === 'negative' ? 'يحتاج مراجعة' : '';
        const statusIcon = status === 'positive' ? icon('i-check') : status === 'negative' ? icon('i-warning') : '';
        // تدقيق 2026-07-12: كان يُمرَّر التسمية العربية كمفتاح بحث في القاموس (مثال:
        // 'صافي القيمة الحالية' بدل 'NPV') فيفشل createTooltip/wrapWithTooltip بصمت ولا
        // تظهر أي أيقونة شرح. المستدعي الآن يمرر مفاتيح القاموس الصحيحة (NPV/IRR/...)،
        // والعرض تحوّل إلى indicatorHelp الوصولي (زر + popover) بدل wrapWithTooltip القائم
        // على :hover فقط.
        const labelWithTooltip = term ? `${label} ${indicatorHelp(term)}` : label;

        return `
            <div class="kpi-card ${statusClass}">
                <div class="kpi-label">${labelWithTooltip}</div>
                <div class="kpi-value">${value}</div>
                ${statusText ? `<div class="kpi-status" aria-label="${statusText}">${statusIcon} ${statusText}</div>` : ''}
            </div>
        `;
    }

    renderPnlChart() {
        // Using the global Charts class (assumed available or imported if module)
        // Since Charts.js is likely a global script or module, let's check import.
        // Actually in previous code `this.charts = new Charts` implies it's in scope.
        // If "Charts" is not imported, we need to import it or define logic here.
        // Given I don't see "Charts" imported in the top of this file, it might have been missing.
        // Let's implement a simple Chart.js render directly here since we have the data.

        const canvas = document.getElementById('cashFlowChart');
        if (!canvas || !this.results?.incomeStatement) return;

        const data = this.results.incomeStatement;
        const ctx = canvas.getContext('2d');

        if (typeof Chart === 'undefined') return;

        // Destroy existing chart if any
        if (this._chartInstance) this._chartInstance.destroy();

        this._chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(d => `السنة ${d.year}`),
                datasets: [
                    {
                        label: 'الإيرادات',
                        data: data.map(d => d.revenue),
                        backgroundColor: 'rgba(16, 185, 129, 0.6)',
                        borderColor: '#10b981',
                        borderWidth: 1
                    },
                    {
                        label: 'صافي الربح',
                        data: data.map(d => d.netIncome),
                        backgroundColor: 'rgba(59, 130, 246, 0.6)',
                        borderColor: '#3b82f6',
                        borderWidth: 1,
                        type: 'line'
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: { legend: { position: 'bottom' } },
                scales: { y: { beginAtZero: true } }
            }
        });
    }

    /** لوحة توقعات (Section 44–50): إيراد وتكلفة وصافي 5–7 سنوات؛ أو مقارنة صافي الربح بين السيناريوهات */
    async renderForecastChart() {
        const canvas = document.getElementById('forecastChart');
        if (!canvas || typeof Chart === 'undefined') return;
        const mode = this._forecastMode || this.container?.querySelector('.btn-forecast-mode.active')?.dataset?.mode || 'revenue-cost-net';

        let chartInstance = null;
        try { chartInstance = Chart.getChart(canvas); } catch (_) {}
        if (chartInstance) chartInstance.destroy();
        this._forecastChartInstance = null;

        const ctx = canvas.getContext('2d');
        const studyData = this.store.get ? this.store.get() : this.store.getState();

        if (mode === 'scenarios') {
            // تدقيق 2026-07-09: كانت هذه القيم نسخة محلية مختلفة (0.15/-0.05) عن الثابت
            // المعتمد في schema.js (0.25/-0.10) — استُبدلت بالثابت المشترك DEFAULT_SCENARIOS.
            const DEF = DEFAULT_SCENARIOS;
            const params = studyData.scenarios || {};
            const baseP = params.base || DEF.base;
            const optP = params.optimistic || DEF.optimistic;
            const pessP = params.pessimistic || DEF.pessimistic;
            let baseRes, optRes, pessRes;
            try {
                const { calculateStudy } = await import('../core/engine.js');
                baseRes = calculateStudy(studyData, baseP);
                optRes = calculateStudy(studyData, optP);
                pessRes = calculateStudy(studyData, pessP);
            } catch (e) {
                console.warn('Forecast scenarios:', e);
                baseRes = this.results;
                optRes = pessRes = this.results;
            }
            const isArr = (r) => r?.incomeStatement && Array.isArray(r.incomeStatement);
            const labels = (isArr(baseRes) ? baseRes.incomeStatement : [])
                .map(d => `السنة ${d.year}`);
            const baseNet = isArr(baseRes) ? baseRes.incomeStatement.map(d => d.netIncome ?? 0) : [];
            const optNet = isArr(optRes) ? optRes.incomeStatement.map(d => d.netIncome ?? 0) : [];
            const pessNet = isArr(pessRes) ? pessRes.incomeStatement.map(d => d.netIncome ?? 0) : [];

            this._forecastChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels,
                    datasets: [
                        { label: 'أساسي', data: baseNet, borderColor: '#94a3b8', backgroundColor: 'rgba(148,163,184,0.1)', fill: false, tension: 0.2 },
                        { label: 'متفائل', data: optNet, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', fill: false, tension: 0.2 },
                        { label: 'متشائم', data: pessNet, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', fill: false, tension: 0.2 }
                    ]
                },
                options: {
                    responsive: true,
                    plugins: { legend: { position: 'bottom' } },
                    scales: { y: { beginAtZero: true, title: { display: true, text: 'صافي الربح (ريال)' } } }
                }
            });
            return;
        }

        if (!this.results?.incomeStatement?.length) return;
        const isArr = this.results.incomeStatement;
        const labels = isArr.map(d => `السنة ${d.year}`);
        const revenue = isArr.map(d => d.revenue ?? 0);
        const totalCost = isArr.map(d => (d.variableCosts ?? 0) + (d.fixedCosts ?? 0) + (d.depreciation ?? 0));
        const netIncome = isArr.map(d => d.netIncome ?? 0);

        this._forecastChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    { label: 'الإيراد', data: revenue, backgroundColor: 'rgba(16, 185, 129, 0.6)', borderColor: '#10b981', borderWidth: 1 },
                    { label: 'التكلفة', data: totalCost, backgroundColor: 'rgba(239, 68, 68, 0.5)', borderColor: '#ef4444', borderWidth: 1 },
                    { label: 'الصافي', data: netIncome, backgroundColor: 'rgba(138, 95, 28, 0.6)', borderColor: '#8a5f1c', borderWidth: 1, type: 'line', tension: 0.2 }
                ]
            },
            options: {
                responsive: true,
                plugins: { legend: { position: 'bottom' } },
                scales: { y: { beginAtZero: true } }
            }
        });
    }

    /** رسم التدفق النقدي السنوي (Brixx/Fathom) */
    renderCashFlowAnnualChart() {
        const canvas = document.getElementById('cashFlowChartAnnual');
        if (!canvas || !this.results?.cashFlow) return;
        const cf = this.results.cashFlow;
        if (!Array.isArray(cf) || cf.length === 0) return;
        if (typeof Chart === 'undefined') return;

        let chartInstance = null;
        try {
            chartInstance = Chart.getChart(canvas);
        } catch (_) {}
        if (chartInstance) chartInstance.destroy();

        const ctx = canvas.getContext('2d');
        const labels = cf.map(d => d.year === 0 ? 'الاستثمار' : `السنة ${d.year}`);
        const values = cf.map(d => d.cashFlow ?? 0);
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'التدفق النقدي (ريال)',
                    data: values,
                    backgroundColor: values.map(v => v >= 0 ? 'rgba(59, 130, 246, 0.6)' : 'rgba(239, 68, 68, 0.6)'),
                    borderColor: values.map(v => v >= 0 ? '#3b82f6' : '#ef4444'),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { position: 'bottom' } },
                scales: { y: { beginAtZero: true } }
            }
        });
    }

    formatCurrency(n) {
        if (!Number.isFinite(n)) return '--';
        return new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(n);
    }

    formatCompact(n) {
        if (!Number.isFinite(n)) return '--';
        if (Math.abs(n) >= 1000000) {
            return (n / 1000000).toFixed(1) + 'M';
        }
        if (Math.abs(n) >= 1000) {
            return (n / 1000).toFixed(0) + 'K';
        }
        return n.toFixed(0);
    }

    formatPercent(n) {
        if (!Number.isFinite(n)) return '--';
        return (n * 100).toFixed(1) + '%';
    }

    /**
     * بطاقة «نظرة المدقق» — تعرض للمستخدم ما سيراه مقيّم التمويل قبل أن يراه:
     * مصالحة الطاقة، المتغير المهيمن على NPV (من Tornado)، والقيمة النهائية الاسترشادية.
     */
    renderAuditorPanel(results) {
        if (!results) return '';
        const rows = [];

        const cc = results.capacityCheck;
        if (cc) {
            const pctOfMax = Math.round((cc.utilizationOfMax || 0) * 100);
            const tone = cc.exceeded ? 'text-danger' : (pctOfMax > 85 ? 'text-gold' : 'text-success');
            const verdict = cc.exceeded
                ? `<svg class="ic" aria-hidden="true"><use href="#i-x"/></svg> مستحيلة مادياً — الخطة ${cc.plannedUnitsPerMonth.toLocaleString('ar-SA')} عميل/شهر وطاقتك ${cc.maxUnitsPerMonth.toLocaleString('ar-SA')}`
                : pctOfMax > 85
                    ? `<svg class="ic" aria-hidden="true"><use href="#i-warning"/></svg> ضيّقة — ${pctOfMax.toLocaleString('ar-SA')}% من الطاقة القصوى منذ السنة الأولى (لا هامش للذروة)`
                    : `<svg class="ic" aria-hidden="true"><use href="#i-check"/></svg> قابلة للتحقيق — ${pctOfMax.toLocaleString('ar-SA')}% من الطاقة القصوى (${cc.plannedUnitsPerMonth.toLocaleString('ar-SA')} من ${cc.maxUnitsPerMonth.toLocaleString('ar-SA')} عميل/شهر)`;
            rows.push(`<div class="flex-between py-2" style="border-bottom:1px solid var(--c-border);"><span class="text-sm">مصالحة الطاقة (هل المبيعات ممكنة مادياً؟)</span><span class="text-sm ${tone}">${verdict}</span></div>`);
        } else {
            rows.push(`<div class="flex-between py-2" style="border-bottom:1px solid var(--c-border);"><span class="text-sm">مصالحة الطاقة</span><span class="text-sm text-muted">لم يُدخل نموذج طاقة (مقاعد × دورات × أيام) — أضِفه في الدراسة الفنية لإقناع المدقق</span></div>`);
        }

        const top = Array.isArray(results.tornado) && results.tornado.length ? results.tornado[0] : null;
        if (top) {
            rows.push(`<div class="flex-between py-2" style="border-bottom:1px solid var(--c-border);"><span class="text-sm">المتغير المهيمن على النتيجة</span><span class="text-sm"><strong>${top.variable}</strong> — تغيّره ±10% يؤرجح NPV بمقدار ${this.formatCurrency(top.swing)}؛ ركّز دقتك هنا</span></div>`);
        }

        const tv = results.indicators?.terminalValue || 0;
        if (tv > 0) {
            rows.push(`<div class="flex-between py-2"><span class="text-sm">القيمة النهائية (استرشادية)</span><span class="text-sm">${this.formatCurrency(tv)} — NPV الشامل ${this.formatCurrency(results.indicators.npvWithTerminal)} (القرار يبقى على المتحفظ)</span></div>`);
        }

        if (!rows.length) return '';
        return `
            <div class="card glass-card mt-4" id="auditorPanel" aria-label="نظرة المدقق">
                <h3 class="card-title mb-1"><svg class="ic" aria-hidden="true"><use href="#i-shield"/></svg> نظرة المدقق</h3>
                <p class="text-xs text-muted mb-3">ما سيفحصه مقيّم التمويل أولاً — اعرفه قبل أن يراه.</p>
                ${rows.join('')}
            </div>`;
    }

    formatDscr(dscr) {
        if (dscr == null || dscr === 'N/A' || (typeof dscr === 'number' && !Number.isFinite(dscr))) return '—';
        if (typeof dscr === 'number') return dscr.toFixed(2) + 'x';
        return String(dscr);
    }

    getDscrExplanation(dscr, dscrAnalysis) {
        if (dscr == null || dscr === 'N/A' || (typeof dscr === 'number' && !Number.isFinite(dscr)))
            return 'لا يوجد قرض — لا ينطبق.';
        const n = typeof dscr === 'number' ? dscr : parseFloat(dscr);
        if (n >= 1.25) return 'أكثر من 1.25 = مريح للممول (الحد الأدنى المعتاد للبنوك).';
        if (n >= 1) return 'يغطي خدمة الدين — قد يطلب البنك ضمانات إضافية.';
        return 'أقل من 1 — إعادة هيكلة التمويل موصى بها.';
    }
}
