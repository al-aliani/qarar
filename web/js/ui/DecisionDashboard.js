import { createTooltip, indicatorHelp } from '../utils/glossary.js';
/**
 * Decision Dashboard Component
 * The "Boardroom" view for investors to see if the project is ready
 */
import { SECTIONS } from '../core/schema.js';
import { calculateStudy as runFullModel } from '../core/engine.js';
import { calculateProjectScore } from '../core/scoring.js';
import { ReportGenerator } from '../services/ReportGenerator.js';
import { ProjectManager } from '../services/ProjectManager.js';
import { PresentationView } from './PresentationView.js';
import { BankReportGenerator } from '../../export/BankReportGenerator.js';
import { PitchDeckExporter } from '../../export/PitchDeckExporter.js';
import { sanitizeFilename, exportDateISO, downloadBlob } from '../../export/utils.js';
import { generateInvestorLink } from '../utils/shareUtils.js';
import { exportExcel } from '../../export/excel.js';
import { animateCounter } from '../utils/ui.js';
import { runQAChecks } from '../utils/qaChecks.js';
import { investmentDataWarning, investmentDataWarningHtml } from '../utils/dataQuality.js';
import { toast } from '../utils/toast.js';

export class DecisionDashboard {
    constructor(containerId, store) {
        this.container = document.getElementById(containerId);
        this.store = store;
        this._eventListeners = [];
    }

    // Cleanup method
    cleanup() {
        this._eventListeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        this._eventListeners = [];
    }

    async render(options = {}) {
        const isCurrent = typeof options.isCurrent === 'function' ? options.isCurrent : () => true;
        const state = this.store.getState();

        // بلا إيرادات لا يصح إصدار حكم «غير مجدي» بأرقام سالبة مضللة —
        // نعرض حالة «لا بيانات» إرشادية توجّه للخطوات الناقصة (كما في القوائم المالية).
        if (!(Array.isArray(state.revenue?.streams) && state.revenue.streams.length > 0)) {
            this.container.innerHTML = `
                <div class="decision-dashboard animate-entry">
                    <div class="card glass-card">
                        <h2 class="card-title page-title">لوحة القرار الاستثماري</h2>
                        <div class="alert alert--warning">
                            <p><strong><svg class="ic" aria-hidden="true"><use href="#i-warning"/></svg> لا توجد بيانات إيرادات. يرجى إضافة مصادر الإيرادات في خطوة "مصادر الإيرادات".</strong></p>
                            <p class="text-sm mt-2">لا يمكن إصدار توصية (مجدٍ / غير مجدٍ) قبل إدخال الحد الأدنى من البيانات. أكمل:</p>
                            <ul class="text-sm mt-2" style="list-style: disc; padding-right: 20px;">
                                <li>مصادر الإيرادات (خطوة "مصادر الإيرادات")</li>
                                <li>التكاليف الرأسمالية (خطوة "الدراسة الفنية")</li>
                                <li>التكاليف التشغيلية (خطوات "الموارد البشرية" و"اللوجستية" و"الإدارية")</li>
                                <li>هيكل التمويل (خطوة "مصادر وهيكلة التمويل")</li>
                            </ul>
                            <p class="text-sm mt-2 text-muted">بعد إكمال هذه الخطوات ستُحسب المؤشرات (صافي القيمة الحالية، العائد الداخلي، فترة الاسترداد) وتظهر التوصية هنا.</p>
                        </div>
                    </div>
                </div>`;
            return;
        }

        let results = null;
        try {
            results = runFullModel(state);
        } catch (e) {
            console.error('Financial Model Error:', e);
        }

        const evaluation = calculateProjectScore(state, results);
        const readiness = this.calculateReadiness(state, results, evaluation);

        // سيناريوهات مشتقة من المحرك فعلياً (لا مضاعفات ثابتة) — لمصداقية أرقام القرار
        let pessimistic = null, optimistic = null;
        try { pessimistic = runFullModel(state, { revenueChange: -0.2 }); } catch (e) { console.warn('Pessimistic scenario error', e); }
        try { optimistic = runFullModel(state, { revenueChange: 0.2 }); } catch (e) { console.warn('Optimistic scenario error', e); }

        // «لماذا هذا القرار» و«الخطوات التالية» — مشتقة من التقييم والجاهزية
        const decision = this.buildDecisionReasons(state, results, readiness, evaluation);
        const financingDiagnostics = this.getFinancingDiagnostics(state, results);
        const decisionExplanation = results?.decisionExplanation || null;
        const mcLastRun = state?.monteCarlo?.lastRun;
        const mcProbability = Number.isFinite(Number(mcLastRun?.successProbability)) ? Number(mcLastRun.successProbability) : null;
        const year1Revenue = Number(results?.incomeStatement?.[0]?.revenue) || 0;
        const breakEvenRevenue = Number(results?.indicators?.breakEvenPointValue) || 0;
        const breakEvenMargin = year1Revenue > 0 ? Math.max(0, 1 - (breakEvenRevenue / year1Revenue)) : null;
        const minCumulativeCash = Array.isArray(results?.cashFlow) && results.cashFlow.length
            ? Math.min(...results.cashFlow.map(row => Number(row.cumulative)).filter(Number.isFinite))
            : null;
        let npvSafetyMargin = null;
        if (Number(results?.indicators?.npv) >= 0 && year1Revenue > 0) {
            let low = -1, high = 0;
            for (let i = 0; i < 12; i += 1) {
                const mid = (low + high) / 2;
                try {
                    const stressed = runFullModel(state, { revenueChange: mid });
                    if (Number(stressed?.indicators?.npv) >= 0) high = mid;
                    else low = mid;
                } catch (_) { break; }
            }
            npvSafetyMargin = Math.max(0, Math.abs(high));
        }

        // QA Gate validation (async, but we'll await it)
        let qaResults = { passed: true, hardErrors: [], softWarnings: [], validationErrors: [], validationWarnings: [] };
        try {
            qaResults = await runQAChecks(state, results);
        } catch (e) {
            console.error('QA Check failed:', e);
        }

        // تحقق صحة البيانات (validateStudy)
        let validationResult = { valid: true, errors: [] };
        try {
            const { validateStudy } = await import('../utils/validation.js');
            validationResult = validateStudy(state);
        } catch (_) {}

        // إذا انتقل المستخدم أثناء فحوص الجودة فلا تكتب نتيجة قديمة فوق الخطوة الجديدة.
        if (!isCurrent()) return false;

        // «اجتياز نظيف» = بلا أخطاء حرجة وبلا تحذيرات مهمة وبلا أخطاء بيانات.
        // كان البانر الأخضر «اجتاز 100/100» يظهر بمجرد غياب الأخطاء الحرجة، فيتزامن مع تحذيرات
        // حمراء عن عائد داخلي غير واقعي — إشارتان متناقضتان. الآن الأخضر للنظيف فقط.
        const hasSoftIssues = (qaResults.softWarnings?.length > 0)
            || (qaResults.validationWarnings?.length > 0)
            || (!validationResult.valid && (validationResult.errors?.length > 0));
        const cleanPass = qaResults.passed && qaResults.hardErrors.length === 0 && !hasSoftIssues;

        this.container.innerHTML = `
            <div class="decision-dashboard animate-entry">
                ${investmentDataWarningHtml(investmentDataWarning(state, results))}
                ${this.renderFinancingGate(financingDiagnostics)}
                <div class="dd-verdict">

                    <!-- Score Gauge Container -->
                    <div class="dd-gauge">
                         <svg viewBox="0 0 100 100" class="dd-gauge__svg" aria-hidden="true">
                            <!-- Background Circle -->
                            <circle cx="50" cy="50" r="45" class="dd-gauge__track" stroke-width="8" fill="none" />
                            <!-- Progress Circle -->
                            <circle cx="50" cy="50" r="45" stroke="${this.getScoreColor(evaluation.score)}" stroke-width="8" fill="none"
                                stroke-dasharray="283" stroke-dashoffset="${283 - (283 * evaluation.score / 100)}"
                                class="dd-gauge__fill" />
                        </svg>
                        <div class="dd-gauge__center">
                            <span class="dd-gauge__num dv-num" id="scoreValue" data-value="${evaluation.score}">${evaluation.score}</span>
                            <span class="dd-gauge__caption">النقاط</span>
                        </div>
                    </div>

                    <div class="dd-verdict__body">
                        <span class="dd-verdict__eyebrow">التقييم الشامل</span>
                        <h2 class="dd-verdict__title">
                            ${evaluation.recommendationLabel}
                        </h2>
                        <p class="dd-verdict__desc">
                            بناءً على تحليل ${evaluation.details.length} معايير تشمل الجدوى المالية، اكتمال البيانات، وجاهزية السوق.
                            ${evaluation.score >= 100 && evaluation.recommendation !== 'go' ? '<br><span class="dd-verdict__flag dd-verdict__flag--warning">الدرجة تقيس اكتمال/جودة المدخلات، أما التوصية فتضيف اختبارات المخاطر والتمويل؛ لذلك قد تكون الدرجة 100/100 مع بقاء القرار «يحتاج مراجعة».</span>' : ''}
                            ${qaResults.hardErrors.length > 0 ? '<br><span class="dd-verdict__flag dd-verdict__flag--danger">توجد أخطاء حرجة يجب إصلاحها قبل اتخاذ القرار.</span>' : ''}
                            ${cleanPass ? '<br><span class="dd-verdict__flag dd-verdict__flag--success">الدراسة اجتازت معايير الجودة.</span>' : ''}
                            ${!cleanPass && qaResults.hardErrors.length === 0 && hasSoftIssues ? '<br><span class="dd-verdict__flag dd-verdict__flag--warning">اجتازت الأخطاء الحرجة، لكن توجد تحذيرات مهمة — راجعها قبل القرار.</span>' : ''}
                        </p>
                    </div>

                     <div class="dd-verdict__actions">
                        <button id="btnExecutiveSummary" class="btn btn--primary dd-verdict__cta" title="يعمل بدون مفتاح API">
                            <svg class="ic" aria-hidden="true"><use href="#i-doc"/></svg> الملخص التنفيذي
                        </button>
                         <button id="btnPresentation" class="btn btn--secondary btn--sm">
                            <svg class="ic" aria-hidden="true"><use href="#i-slides"/></svg> عرض تقديمي
                        </button>
                        <button id="btnInvestorLink" class="btn btn--secondary btn--sm" title="إنشاء رابط للمستثمر (صفحة هبوط للقراءة فقط)">
                            <svg class="ic" aria-hidden="true"><use href="#i-link"/></svg> رابط لوحة المستثمر
                        </button>
                        <button id="btnRefreshResults" class="btn btn--ghost btn--sm" title="إعادة حساب النتائج والتقييم">
                            <svg class="ic" aria-hidden="true"><use href="#i-reset"/></svg> إعادة حساب
                        </button>
                        <button id="btnExportBackup" class="btn btn--ghost btn--sm" title="حفظ نسخة احتياطية من دراسة الجدوى كملف (JSON)">
                            <svg class="ic" aria-hidden="true"><use href="#i-download"/></svg> تصدير
                        </button>
                        <label for="btnImportBackup" class="btn btn--ghost btn--sm" title="استعادة مشروع من ملف نسخة احتياطية" style="cursor: pointer;">
                            <svg class="ic" aria-hidden="true"><use href="#i-upload"/></svg> استيراد
                        </label>
                        <input type="file" id="btnImportBackup" accept=".json" style="display: none;">
                    </div>
                </div>

                <!-- لماذا هذا القرار + خطواتك التالية (جوهر مرحلة القرار) -->
                <div class="card glass-card decision-reasoning mb-6">
                    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:1.5rem;">
                        <div>
                            <h4 class="card-title">لماذا هذا القرار؟</h4>
                            ${decision.desc ? `<p class="text-sm" style="line-height:1.8; margin-bottom:.6rem;">${decision.desc}</p>` : ''}
                            ${decision.reasons.length ? `
                                <ul class="decision-reason-list" style="margin:0; padding-inline-start:1.1rem; font-size:.85rem; line-height:1.8;">
                                    ${decision.reasons.map(r => `<li>${r}</li>`).join('')}
                                </ul>` : `<p class="text-sm text-success">جميع المعايير المالية والتشغيلية ضمن النطاق المطلوب.</p>`}
                            ${decision.positives.length ? `<p class="text-sm text-success" style="margin-top:.6rem;">نقاط القوة: ${decision.positives.join('، ')}.</p>` : ''}
                        </div>
                        <div>
                            <h4 class="card-title">خطواتك التالية</h4>
                            ${decision.nextSteps.length ? `
                                <ol class="decision-next-steps" style="margin:0; padding-inline-start:1.2rem; font-size:.85rem; line-height:1.9;">
                                    ${decision.nextSteps.map(s => `<li><strong>${s.step}:</strong> ${s.text}</li>`).join('')}
                                </ol>` : `<p class="text-sm text-success">لا خطوات عالقة — الدراسة مكتملة الأركان. راجع الملخص التنفيذي وصدّر التقرير.</p>`}
                        </div>
                    </div>
                </div>

                ${this.renderDecisionExplainer(decisionExplanation)}

                <!-- QA Gate Status -->
                ${qaResults.hardErrors.length > 0 ? `
                    <div class="card dd-status dd-status--danger">
                        <div class="dd-status__head">
                            <svg class="ic dd-status__ic" aria-hidden="true"><use href="#i-shield"/></svg>
                            <h4 class="dd-status__title">أخطاء حرجة - الدراسة غير جاهزة</h4>
                        </div>
                        <ul class="dd-status__list">
                            ${qaResults.hardErrors.map(err => `<li>${err.message || err}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                ${qaResults.softWarnings.length > 0 ? `
                    <div class="card dd-status dd-status--warning">
                        <div class="dd-status__head">
                            <svg class="ic dd-status__ic" aria-hidden="true"><use href="#i-shield"/></svg>
                            <h4 class="dd-status__title">تحذيرات مهمة</h4>
                        </div>
                        <ul class="dd-status__list">
                            ${qaResults.softWarnings.map(warn => `<li>${warn.message || warn}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                ${!validationResult.valid && validationResult.errors?.length ? `
                    <div class="card dd-status dd-status--warning">
                        <div class="dd-status__head">
                            <svg class="ic dd-status__ic" aria-hidden="true"><use href="#i-doc"/></svg>
                            <h4 class="dd-status__title">أخطاء في صحة البيانات</h4>
                        </div>
                        <p class="dd-status__note">قد تؤثر على دقة النتائج المالية. يُفضّل إصلاحها قبل التصدير أو اتخاذ القرار.</p>
                        <ul class="dd-status__list">
                            ${validationResult.errors.slice(0, 5).map(e => `<li>${e}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                ${cleanPass ? `
                    <div class="card dd-status dd-status--success">
                        <div class="dd-status__head">
                            <svg class="ic dd-status__ic" aria-hidden="true"><use href="#i-shield"/></svg>
                            <h4 class="dd-status__title">الدراسة اجتازت فحص الجودة</h4>
                        </div>
                    </div>
                ` : ''}
                ${state.projectInfo?.investorProfile === 'conservative' && (readiness.recommendation.status === 'review' || readiness.recommendation.status === 'nogo') ? `
                    <div class="card dd-status dd-status--warning">
                        <div class="dd-status__head">
                            <svg class="ic dd-status__ic" aria-hidden="true"><use href="#i-shield"/></svg>
                            <div>
                                <h4 class="dd-status__title">ملفك محافظ — تنبيه</h4>
                                <p class="dd-status__note">مشروعك عالي المخاطر أو يحتاج مراجعة. كملف محافظ قد لا يتوافق معك. راجع أو ابحث عن بديل أقل مخاطرة.</p>
                            </div>
                        </div>
                    </div>
                ` : ''}

                <div class="dashboard-grid">
                     <!-- Scoring Breakdown -->
                    <div class="dashboard-col">
                        <div class="card glass-card h-full">
                            <h4 class="card-title flex justify-between items-center">
                                <span>تفاصيل التقييم</span>
                                <span class="text-xs text-muted font-normal">${evaluation.score}/100 نقطة</span>
                            </h4>
                            <div class="dd-scores">
                                ${evaluation.details.map(item => `
                                    <div class="dd-score ${item.score > 0 ? 'is-positive' : 'is-negative'}">
                                        <div class="dd-score__id">
                                            <span class="dd-score__bar" aria-hidden="true"></span>
                                            <div>
                                                <div class="dd-score__label">${item.label}</div>
                                                <div class="dd-score__cat">${item.category}</div>
                                            </div>
                                        </div>
                                        <div class="dd-score__pts dv-num">
                                            +${item.score}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div><!-- /dashboard-grid (تفاصيل التقييم) — كان غير مُغلق فيبتلع الشبكة التالية وشريط الأفعال -->

                <div class="dashboard-grid">
                    <!-- Left Column: Metrics -->
                    <div class="dashboard-col">
                        <div class="card glass-card">
                            <h4 class="card-title">المؤشرات المالية الحاسمة</h4>
                            <div class="kpi-grid-decision">
                                ${this.renderKPIItem('صافي القيمة الحالية', results?.indicators?.npv, 'currency', 1, 'NPV')}
                                ${this.renderKPIItem('معدل العائد الداخلي', results?.indicators?.irr, 'percent', 1, 'IRR')}
                                ${this.renderKPIItem('فترة الاسترداد', results?.indicators?.paybackPeriod, 'years', 1, 'PAYBACK')}
                                ${this.renderKPIItem('العائد على الاستثمار', results?.indicators?.roi, 'percent', 1, 'ROI')}
                                ${this.renderKPIItem('فجوة التمويل', financingDiagnostics.fundingGap, 'fundingGap', financingDiagnostics.fundingGapThreshold)}
                                ${this.renderKPIItem('DSCR السنة الأولى', financingDiagnostics.dscr, 'dscr', 1, 'DSCR')}
                            </div>
                            <div class="kpi-grid-decision dd-risk-kpis" aria-label="مؤشرات هامش الأمان والمخاطر">
                                ${this.renderKPIItem('احتمالية نجاح مونت كارلو', mcProbability, 'percent')}
                                ${this.renderKPIItem('هامش الأمان لنقطة التعادل', breakEvenMargin, 'percent', 1, 'BREAKEVEN')}
                                ${this.renderKPIItem('أقصى انخفاض بالإيراد قبل NPV السالب', npvSafetyMargin, 'percent')}
                                ${this.renderKPIItem('أدنى تدفق نقدي تراكمي', minCumulativeCash, 'currency')}
                            </div>
                        </div>

                        <!-- اختبار الضغط (Stress Test / ماذا لو — Upmetrics) -->
                        <div class="card glass-card stress-test-card">
                            <h4 class="card-title">ماذا لو؟ — اختبار الضغط</h4>
                            <p class="text-muted text-sm mb-4">لو زاد الإيراد 10%؟ لو زاد الإيجار 20%؟ حرّك المنزلقات لتحديث النتائج فوراً (NPV، هامش الربح).</p>
                            <div class="stress-test-sliders">
                                <div class="stress-slider-row">
                                    <label class="stress-slider-label" for="stressRevenueSlider">تغير الإيرادات</label>
                                    <div class="stress-slider-wrap">
                                        <input type="range" id="stressRevenueSlider" class="stress-slider" min="-20" max="20" value="0" step="1" aria-label="تغير الإيرادات بالمئة">
                                        <span id="stressRevenueValue" class="stress-slider-value">0%</span>
                                    </div>
                                </div>
                                <div class="stress-slider-row">
                                    <label class="stress-slider-label" for="stressCostSlider">تغير التكاليف</label>
                                    <div class="stress-slider-wrap">
                                        <input type="range" id="stressCostSlider" class="stress-slider" min="-20" max="20" value="0" step="1" aria-label="تغير التكاليف بالمئة">
                                        <span id="stressCostValue" class="stress-slider-value">0%</span>
                                    </div>
                                </div>
                            </div>
                            <div class="stress-test-results">
                                <div class="stress-kpi">
                                    <span class="stress-kpi-label">صافي القيمة الحالية (بعد الصدمة)</span>
                                    <span id="stressNPV" class="stress-kpi-value">${this.formatCurrency(results?.indicators?.npv)}</span>
                                </div>
                                <div class="stress-kpi">
                                    <span class="stress-kpi-label">هامش الربح (بعد الصدمة)</span>
                                    <span id="stressMargin" class="stress-kpi-value">${this.formatPercent(results?.indicators?.profitMargin ?? 0)}</span>
                                </div>
                            </div>
                            <div class="stress-test-chart-wrap" aria-hidden="true">
                                <div class="stress-bar-label">مقارنة NPV بالأساسي</div>
                                <div class="stress-bar-track">
                                    <div id="stressNPVBar" class="stress-bar-fill" style="width: 50%;"></div>
                                </div>
                            </div>
                            <div class="mt-3">
                                <button type="button" id="btnStressAskAI" class="btn btn--secondary btn--sm" title="اسأل المستشار الذكي عن هذا السيناريو (ربط اختبار الضغط بـ AI)">
                                    <svg class="ic" aria-hidden="true"><use href="#i-bolt"/></svg> اسأل مساعد AI عن هذا السيناريو
                                </button>
                            </div>
                        </div>

                        <div class="card glass-card">
                            <h4 class="card-title">جاهزية الأبعاد الأساسية</h4>
                            <div class="readiness-list">
                                ${this.renderReadinessItem('جاهزية السوق', readiness.dimensions.market)}
                                ${this.renderReadinessItem('جاهزية التمويل', readiness.dimensions.financing)}
                                ${this.renderReadinessItem('جاهزية الفريق', readiness.dimensions.team)}
                                ${this.renderReadinessItem('الجاهزية القانونية', readiness.dimensions.legal)}
                                ${this.renderReadinessItem('جاهزية الموقع', readiness.dimensions.location)}
                                ${this.renderReadinessItem('إدارة المخاطر', readiness.dimensions.risk)}
                                ${this.renderReadinessItem('الجاهزية الاستراتيجية', readiness.dimensions.strategic)}
                                ${this.renderReadinessItem('جاهزية الخدمات/المنتجات', readiness.dimensions.services)}
                            </div>
                        </div>
                    </div>

                    <!-- Right Column: Context -->
                    <div class="dashboard-col">
                        <div class="card glass-card">
                            <h4 class="card-title">نتائج السيناريوهات</h4>
                            <div class="scenario-results-table">
                                <table class="data-table small">
                                    <thead>
                                        <tr>
                                            <th>السيناريو</th>
                                            <th>صافي القيمة الحالية</th>
                                            <th>الأرباح قبل الفوائد والضرائب</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr class="row-pessimistic">
                                            <td>متشائم (إيراد −20%)</td>
                                            <td>${this.formatCurrency((pessimistic ?? results)?.indicators?.npv)}</td>
                                            <td>${this.formatCurrency((pessimistic ?? results)?.incomeStatement?.[0]?.ebitda)}</td>
                                        </tr>
                                        <tr class="row-base">
                                            <td>أساسي</td>
                                            <td>${this.formatCurrency(results?.indicators?.npv)}</td>
                                            <td>${this.formatCurrency(results?.incomeStatement?.[0]?.ebitda)}</td>
                                        </tr>
                                        <tr class="row-optimistic">
                                            <td>متفائل (إيراد +20%)</td>
                                            <td>${this.formatCurrency((optimistic ?? results)?.indicators?.npv)}</td>
                                            <td>${this.formatCurrency((optimistic ?? results)?.incomeStatement?.[0]?.ebitda)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div class="card glass-card">
                            <h4 class="card-title">شروط النجاح الحرجة</h4>
                            <ul class="factors-list">
                                ${readiness.factors.map(f => `<li><span class="bullet" aria-hidden="true"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg></span> ${f}</li>`).join('')}
                            </ul>
                        </div>
                    </div>
                </div>

                <!-- Action Buttons — هرم واضح: فعل رئيسي + ثانويات + «المزيد» -->
                <div class="decision-actions dd-actions">
                    <div class="dd-actions__primary">
                        <button id="btnSaveStudy" class="btn btn--primary dd-actions__main">
                            <svg class="ic" aria-hidden="true"><use href="#i-save"/></svg> حفظ الدراسة
                        </button>
                        <button id="btnExportPDF" class="btn btn--secondary">
                            <svg class="ic" aria-hidden="true"><use href="#i-bank"/></svg> تصدير تقرير بنكي
                        </button>
                        <button id="btnExportExcel" class="btn btn--secondary">
                            <svg class="ic" aria-hidden="true"><use href="#i-table"/></svg> تصدير إكسل
                        </button>
                    </div>
                    <details class="dd-more">
                        <summary class="dd-more__toggle btn btn--ghost btn--sm">
                            <svg class="ic" aria-hidden="true"><use href="#i-chev-down"/></svg> المزيد
                        </summary>
                        <div class="dd-more__menu">
                            <button id="btnConsultation" class="btn btn--ghost dd-more__item" title="احجز استشارة Zoom مع خبير">
                                <svg class="ic" aria-hidden="true"><use href="#i-user"/></svg> احجز استشارة
                            </button>
                            <button id="btnPitchMode" class="btn btn--ghost dd-more__item">
                                <svg class="ic" aria-hidden="true"><use href="#i-slides"/></svg> عرض المستثمر
                            </button>
                            <button id="btnExportPitch" class="btn btn--ghost dd-more__item" title="تحميل Pitch Deck كـ HTML (اطبع كـ PDF)">
                                <svg class="ic" aria-hidden="true"><use href="#i-download"/></svg> تصدير Pitch Deck
                            </button>
                        </div>
                    </details>
                </div>
            </div>
        `;

        this.bindEvents(state, results);

        // Stress-test sliders: live update NPV and Profit Margin
        this.bindStressTestSliders(state, results);

        // Animate Score — يجب تمرير عنصر DOM فعلي وكائن خيارات {duration}.
        // كان يُمرَّر نص المعرّف 'scoreValue' + الرقم 1500، فترمي animateCounter (element.getAttribute)
        // ويبقى العدّاد على القيمة الابتدائية «0» رغم أن الدرجة الحقيقية 100 — تناقض «0 مقابل 100».
        setTimeout(() => {
            const scoreEl = this.container.querySelector('#scoreValue');
            if (scoreEl) animateCounter(scoreEl, evaluation.score, { duration: 1500 });
        }, 300);
        return true;
    }

    bindStressTestSliders(state, results) {
        const revSlider = this.container.querySelector('#stressRevenueSlider');
        const costSlider = this.container.querySelector('#stressCostSlider');
        const revValueEl = this.container.querySelector('#stressRevenueValue');
        const costValueEl = this.container.querySelector('#stressCostValue');
        const stressNPVEl = this.container.querySelector('#stressNPV');
        const stressMarginEl = this.container.querySelector('#stressMargin');
        const stressNPVBar = this.container.querySelector('#stressNPVBar');
        if (!revSlider || !costSlider || !stressNPVEl || !stressMarginEl) return;

        const baseNPV = results?.indicators?.npv ?? 0;

        const updateStressResults = () => {
            const revPct = Number(revSlider.value);
            const costPct = Number(costSlider.value);
            if (revValueEl) revValueEl.textContent = (revPct >= 0 ? '+' : '') + revPct + '%';
            if (costValueEl) costValueEl.textContent = (costPct >= 0 ? '+' : '') + costPct + '%';

            const overrides = { revenueChange: revPct / 100, opexChange: costPct / 100 };
            let stressed = null;
            try {
                stressed = runFullModel(state, overrides);
            } catch (e) {
                console.warn('Stress test runFullModel error', e);
            }
            if (!stressed?.indicators) return;

            const npv = stressed.indicators.npv;
            const margin = stressed.indicators.profitMargin ?? 0;
            stressNPVEl.textContent = this.formatCurrency(npv);
            stressNPVEl.classList.toggle('text-danger', npv < 0);
            stressNPVEl.classList.toggle('text-success', npv >= 0);
            stressMarginEl.textContent = this.formatPercent(margin);
            stressMarginEl.classList.toggle('text-danger', margin < 0);
            stressMarginEl.classList.toggle('text-success', margin >= 0);

            if (stressNPVBar && Number.isFinite(baseNPV) && baseNPV !== 0) {
                const pct = Math.max(0, Math.min(100, (npv / baseNPV) * 100));
                stressNPVBar.style.width = pct + '%';
                stressNPVBar.classList.toggle('stress-bar-negative', npv < 0);
                stressNPVBar.classList.remove('stress-bar-negative');
                if (npv < 0) stressNPVBar.classList.add('stress-bar-negative');
            }
        };

        revSlider.addEventListener('input', updateStressResults);
        costSlider.addEventListener('input', updateStressResults);
        this._eventListeners.push({ element: revSlider, event: 'input', handler: updateStressResults });
        this._eventListeners.push({ element: costSlider, event: 'input', handler: updateStressResults });

        const btnStressAskAI = this.container.querySelector('#btnStressAskAI');
        if (btnStressAskAI) {
            const handler = () => {
                const revPct = revSlider?.value ?? 0;
                const costPct = costSlider?.value ?? 0;
                const npvText = stressNPVEl?.textContent ?? '—';
                const marginText = stressMarginEl?.textContent ?? '—';
                const prompt = `في اختبار الضغط: تغير الإيرادات ${revPct >= 0 ? '+' : ''}${revPct}% وتغير التكاليف ${costPct >= 0 ? '+' : ''}${costPct}%. صافي القيمة الحالية بعد الصدمة ${npvText} وهامش الربح ${marginText}. هل المشروع لا يزال مجدياً؟ ما توصياتك؟`;
                if (typeof window.aiChatModal?.openWithPrompt === 'function') {
                    window.aiChatModal.openWithPrompt(prompt);
                } else {
                    import('../utils/toast.js').then(({ toast }) => toast.info('المستشار الذكي يُحمّل... جرّب بعد ثوانٍ.'));
                }
            };
            btnStressAskAI.addEventListener('click', handler);
            this._eventListeners.push({ element: btnStressAskAI, event: 'click', handler });
        }
    }

    bindEvents(state, results) {
        // Executive Summary Button
        const btnExec = this.container.querySelector('#btnExecutiveSummary');
        if (btnExec) {
            const handler = async () => {
                // Dynamic Import
                const { ExecutiveSummary } = await import('./ExecutiveSummary.js');

                // Create Modal Container if not exists
                let modal = document.getElementById('execSummaryModal');
                if (!modal) {
                    modal = document.createElement('div');
                    modal.id = 'execSummaryModal';
                    modal.className = 'dd-modal';
                    modal.innerHTML = `
                        <div class="dd-modal__panel">
                            <button class="dd-modal__close btn btn--secondary btn--sm btn-close-modal"><svg class="ic" aria-hidden="true"><use href="#i-x"/></svg> إغلاق</button>
                            <div id="execSummaryContent" class="dd-modal__content"></div>
                        </div>
                    `;
                    document.body.appendChild(modal);

                    modal._doClose = () => {
                        modal.classList.add('hidden');
                        if (modal._onEscape) { document.removeEventListener('keydown', modal._onEscape); modal._onEscape = null; }
                    };
                    const closeBtn = modal.querySelector('.btn-close-modal');
                    if (closeBtn) closeBtn.addEventListener('click', modal._doClose);
                }

                modal.classList.remove('hidden');
                modal._onEscape = (e) => { if (e.key === 'Escape') modal._doClose(); };
                document.addEventListener('keydown', modal._onEscape);

                // Render Component
                const execView = new ExecutiveSummary('execSummaryContent', this.store);
                execView.render();
            };
            btnExec.addEventListener('click', handler);
            this._eventListeners.push({ element: btnExec, event: 'click', handler });
        }

        // عرض المستثمر (على الشاشة)
        const btnPitch = this.container.querySelector('#btnPitchMode');
        if (btnPitch) {
            const handler = () => {
                const presentation = new PresentationView(this.store);
                presentation.render();
            };
            btnPitch.addEventListener('click', handler);
            this._eventListeners.push({ element: btnPitch, event: 'click', handler });
        }

        // تصدير Pitch Deck — مباشر (HTML جاهز للطباعة كـ PDF)
        const btnExportPitch = this.container.querySelector('#btnExportPitch');
        if (btnExportPitch) {
            const handler = async () => {
                try {
                    const pitchHtml = PitchDeckExporter.generateHTML(this.store);
                    const win = window.open('', '_blank');
                    if (win) {
                        win.document.write(pitchHtml);
                        win.document.close();
                        win.focus();
                    }
                    const state = this.store.getState();
                    const projName = sanitizeFilename(state?.projectInfo?.name || 'pitch_deck');
                    const pitchName = `pitch_deck_${projName}_${exportDateISO()}.html`;
                    const blob = new Blob([pitchHtml], { type: 'text/html;charset=utf-8' });
                    downloadBlob(blob, pitchName);
                    toast.success(win ? `تم فتح Pitch Deck وتنزيل: ${pitchName} — اطبع كـ PDF من المتصفح` : `تم تنزيل ${pitchName}. اسمح بالنوافذ المنبثقة لفتح العرض.`);
                } catch (e) {
                    console.error('Pitch deck export error', e);
                    toast.error('فشل إنشاء Pitch Deck. تحقق من اكتمال البيانات.');
                }
            };
            btnExportPitch.addEventListener('click', handler);
            this._eventListeners.push({ element: btnExportPitch, event: 'click', handler });
        }

        // إعادة حساب النتائج — innerHTML (لا textContent) كي تبقى أيقونة SVG بعد التفاعل
        // بدل أن تُستبدل بإيموجي نهائياً (كانت تفقد الأيقونة بعد أول نقرة — تدقيق 2026-07-08)
        const btnRefresh = this.container.querySelector('#btnRefreshResults');
        if (btnRefresh) {
            const handler = () => {
                btnRefresh.disabled = true;
                btnRefresh.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#i-reset"/></svg> جاري الحساب...';
                this.render().catch(e => console.error('Refresh error:', e)).finally(() => {
                    if (btnRefresh.isConnected) {
                        btnRefresh.disabled = false;
                        btnRefresh.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#i-reset"/></svg> إعادة حساب';
                    }
                });
            };
            btnRefresh.addEventListener('click', handler);
            this._eventListeners.push({ element: btnRefresh, event: 'click', handler });
        }

        // تصدير نسخة احتياطية (JSON Backup)
        const btnExportBackup = this.container.querySelector('#btnExportBackup');
        if (btnExportBackup) {
            const handler = async () => {
                const state = this.store.getState();
                const id = state.projectInfo?.id;
                if (!id) {
                    toast.error('الرجاء حفظ الدراسة أولاً قبل تصديرها.');
                    return;
                }
                const result = await ProjectManager.exportProjectBackup(id);
                if (result.success) {
                    const blob = new Blob([result.json], { type: 'application/json;charset=utf-8' });
                    downloadBlob(blob, result.filename);
                    toast.success('تم تصدير النسخة الاحتياطية بنجاح.');
                } else {
                    toast.error(result.error || 'حدث خطأ أثناء تصدير الدراسة.');
                }
            };
            btnExportBackup.addEventListener('click', handler);
            this._eventListeners.push({ element: btnExportBackup, event: 'click', handler });
        }

        // استيراد نسخة احتياطية (JSON Backup)
        const btnImportBackup = this.container.querySelector('#btnImportBackup');
        if (btnImportBackup) {
            const handler = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                const reader = new FileReader();
                reader.onload = async (event) => {
                    const content = event.target.result;
                    const result = await ProjectManager.importProjectBackup(content);
                    if (result.success) {
                        toast.success('تم استيراد المشروع بنجاح. سيتم فتح المشروع الآن.');
                        // We need to load the imported project into the store
                        const loaded = await ProjectManager.loadProject(result.id);
                        if (loaded?.data) {
                            // Update store and rerender
                            Object.entries(loaded.data).forEach(([key, value]) => {
                                this.store.update(key, value, true); // true for silent
                            });
                            this.store.notify(); // trigger UI updates
                            this.render();
                        }
                    } else {
                        toast.error(result.error || 'فشل استيراد المشروع.');
                    }
                };
                reader.readAsText(file);
                // Reset value so the same file can be selected again
                e.target.value = '';
            };
            btnImportBackup.addEventListener('change', handler);
            this._eventListeners.push({ element: btnImportBackup, event: 'change', handler });
        }

        // احجز استشارة
        const btnConsultation = this.container.querySelector('#btnConsultation');
        if (btnConsultation) {
            const handler = async () => {
                const { ConsultationModal } = await import('./ConsultationModal.js');
                new ConsultationModal('consultationModalOverlay', this.store).open();
            };
            btnConsultation.addEventListener('click', handler);
            this._eventListeners.push({ element: btnConsultation, event: 'click', handler });
        }

        // تصدير تقرير بنكي — مباشر (بنك التنمية / ريادة / كفالة)
        const btnExport = this.container.querySelector('#btnExportPDF');
        if (btnExport) {
            const handler = async () => {
                try {
                    const html = BankReportGenerator.generateHTML(this.store);
                    const win = window.open('', '_blank');
                    if (win) {
                        win.document.write(html);
                        win.document.close();
                        win.focus();
                    }
                    const state = this.store.getState();
                    const projName = sanitizeFilename(state?.projectInfo?.name || 'تقرير_تمويل_بنكي');
                    const bankName = `bank_report_${projName}_${exportDateISO()}.html`;
                    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
                    downloadBlob(blob, bankName);
                    toast.success(win ? `تم فتح التقرير البنكي وتنزيل: ${bankName}` : `تم تنزيل ${bankName}. اسمح بالنوافذ المنبثقة لفتح التقرير.`);
                } catch (e) {
                    console.error('Bank report export error', e);
                    toast.error('فشل إنشاء التقرير البنكي. تحقق من اكتمال البيانات.');
                }
            };
            btnExport.addEventListener('click', handler);
            this._eventListeners.push({ element: btnExport, event: 'click', handler });
        }

        // Save Study
        const btnSave = this.container.querySelector('#btnSaveStudy');
        if (btnSave) {
            const handler = async (e) => {
                const state = this.store.getState();
                let name = state.projectInfo?.name;
                if (!name) {
                    name = prompt('الرجاء إدخال اسم المشروع للحفظ:', 'مشروع جديد');
                    if (name) {
                        this.store.update('projectInfo', { ...state.projectInfo, name: name });
                    }
                }

                if (name) {
                    // btnSave (لا e.target) — نقرة على أيقونة SVG داخل الزر تجعل e.target هو
                    // <svg> نفسه لا الزر، فيفشل التحديث بصمت. innerHTML يحافظ على الأيقونة
                    // بدل استبدالها بإيموجي (تدقيق 2026-07-08).
                    btnSave.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#i-save"/></svg> جاري الحفظ...';
                    btnSave.disabled = true;
                    try {
                        const state = this.store.getState();
                        const result = await ProjectManager.saveProject(state);
                        if (result.success) {
                            btnSave.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#i-save"/></svg> تم الحفظ';
                            try {
                                const results = runFullModel(state);
                                const evaluation = calculateProjectScore(state, results);
                                const readiness = this.calculateReadiness(state, results, evaluation);
                                const status = readiness?.recommendation?.status;
                                const { WebhookService } = await import('../services/WebhookService.js');
                                if (status === 'go') {
                                    WebhookService.triggerEvent('decision.go', { study_id: state.projectInfo?.id, project_name: state.projectInfo?.name });
                                } else if (status === 'nogo') {
                                    WebhookService.triggerEvent('decision.nogo', { study_id: state.projectInfo?.id, project_name: state.projectInfo?.name });
                                }
                            } catch (_) {}
                            setTimeout(() => {
                                btnSave.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#i-save"/></svg> حفظ الدراسة';
                                btnSave.disabled = false;
                            }, 2000);
                        } else {
                            alert('حدث خطأ أثناء الحفظ: ' + (result.error || 'Unknown'));
                            btnSave.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#i-save"/></svg> خطأ — أعد المحاولة';
                            btnSave.disabled = false;
                        }
                    } catch (err) {
                        console.error(err);
                        alert('فشل الحفظ');
                        btnSave.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#i-save"/></svg> حفظ الدراسة';
                        btnSave.disabled = false;
                    }
                }
            };
            btnSave.addEventListener('click', handler);
            this._eventListeners.push({ element: btnSave, event: 'click', handler });
        }

        // Excel Export
        const btnExcel = this.container.querySelector('#btnExportExcel');
        if (btnExcel) {
            const handler = async (e) => {
                const { ExportMenu } = await import('./ExportMenu.js');
                new ExportMenu('exportMenuOverlay', this.store).open();
            };
            btnExcel.addEventListener('click', handler);
            this._eventListeners.push({ element: btnExcel, event: 'click', handler });
        }

        // Presentation Button
        const btnPresentation = this.container.querySelector('#btnPresentation');
        if (btnPresentation) {
            const handler = () => {
                const presentation = new PresentationView(this.store);
                presentation.render();
            };
            btnPresentation.addEventListener('click', handler);
            this._eventListeners.push({ element: btnPresentation, event: 'click', handler });
        }

        // رابط لوحة المستثمر (Pitch View — للقراءة فقط، مشاركة عبر token)
        const btnInvestorLink = this.container.querySelector('#btnInvestorLink');
        if (btnInvestorLink) {
            const handler = async () => {
                const link = await generateInvestorLink(state, results);
                if (link?.url) {
                    try {
                        await navigator.clipboard.writeText(link.url);
                        toast.success('تم نسخ رابط لوحة المستثمر. شاركه مع المستثمر ليفتح الصفحة للقراءة فقط.');
                    } catch (_) {
                        window.prompt('انسخ الرابط:', link.url);
                        toast.info('انسخ الرابط من النافذة وأرسله للمستثمر.');
                    }
                    window.open(link.url, '_blank');
                } else {
                    toast.error('فشل إنشاء الرابط. تأكد من اكتمال بيانات المشروع.');
                }
            };
            btnInvestorLink.addEventListener('click', handler);
            this._eventListeners.push({ element: btnInvestorLink, event: 'click', handler });
        }
    }

    calculateReadiness(state, results, evaluation) {
        const kpis = results?.indicators || {}; 
        const payback = kpis.paybackPeriod ?? kpis.payback;
        // تدقيق 2026-07-08: كانت تُقرأ من state.assumptions?.thresholds الخام مع احتياط محلي
        // مكرر — لا رابط فعلي بمصدر القرار الحقيقي (يطابقه صدفةً حالياً، وقد ينحرف مستقبلاً
        // عند أي تعديل في resolveDecisionThresholds بمحرك القرار). الآن نفس المصدر الموحّد.
        const thresholds = results?.assumptionsApplied?.thresholds || {
            minNPV: 0,
            minIRR: 0.15,
            maxPayback: 3.5,
            minROI: 0.20
        };

        const la = state.projectInfo?.locationAnalysis || {};
        const hasLocation = la.address || (la.coordinates?.lat != null && la.coordinates?.lng != null) || la.selectionFactors;
        const financingHealth = this.getFinancingDiagnostics(state, results);
        const hasInvestment = Number(results?.capex?.total || state.financing?.totalInvestment || 0) > 0;
        const swot = state[SECTIONS.STRATEGIC]?.swot || {};
        const hasSwot = [swot.strengths, swot.weaknesses, swot.opportunities, swot.threats]
            .some(list => Array.isArray(list) && list.length > 0);
        const hasServices = (state[SECTIONS.SERVICES]?.items?.length > 0) || (state.revenue?.streams?.length > 0);
        const dimensions = {
            market: (state.marketSizing?.som?.value > 0) ? 'ready' : 'needs_work',
            financing: (financingHealth.hasBlockers || financingHealth.fundingGap > financingHealth.fundingGapThreshold || financingHealth.dscrBlocked)
                ? 'critical'
                : (hasInvestment ? 'ready' : 'critical'),
            team: (state.hr?.positions?.length > 0) ? 'ready' : 'needs_work',
            legal: (state.legal?.licenses?.length > 0) ? 'ready' : 'needs_work',
            risk: (state.riskAnalysis?.risks?.length > 0) ? 'ready' : 'needs_work',
            location: hasLocation ? 'ready' : 'needs_work',
            strategic: hasSwot ? 'ready' : 'needs_work',
            services: hasServices ? 'ready' : 'needs_work'
        };

        let recStatus = 'review';
        if (results?.decision) {
            recStatus = results.decision === 'GO' ? 'go' : (results.decision === 'NO-GO' ? 'nogo' : 'review');
        } else if (evaluation?.recommendation) {
            recStatus = evaluation.recommendation === 'revise' ? 'review' : evaluation.recommendation;
        }
        let recommendation;
        if (recStatus === 'go') {
            recommendation = { status: 'go', icon: '<svg class="ic" aria-hidden="true"><use href="#i-check"/></svg>', label: 'ادخل المشروع بقوة', desc: 'المؤشرات المالية والتشغيلية ضمن النطاق المطلوب.' };
        } else if (recStatus === 'nogo') {
            recommendation = { status: 'nogo', icon: '<svg class="ic" aria-hidden="true"><use href="#i-x"/></svg>', label: 'لا تدخل المشروع', desc: 'المخاطر عالية والمؤشرات المالية لا تحقق الحد الأدنى المطلوب.' };
        } else {
            // «يحتاج مراجعة» — لا رمز SVG مطابق دلالياً لـ🤔 (تفكير/تردد) ضمن المجموعة الحالية
            // في index.html؛ i-warning أقرب بديل متاح (تنبيه يستدعي انتباهاً) دون إضافة رمز جديد.
            recommendation = { status: 'review', icon: '<svg class="ic" aria-hidden="true"><use href="#i-warning"/></svg>', label: 'يحتاج مراجعة', desc: 'القرار يوصي بمراجعة الدراسة قبل المضي — راجع بنود التكلفة أو الإيراد.' };
        }

        const factors = [
            `تحقيق صافي قيمة حالية أعلى من ${this.formatCurrency(thresholds.minNPV)}.`,
            `تجاوز معدل العائد الداخلي نسبة ${(thresholds.minIRR * 100).toFixed(0)}%.`,
            `استرداد رأس المال خلال أقل من ${thresholds.maxPayback} سنوات.`,
            financingHealth.loanAmount > 0
                ? `تحقيق DSCR لا يقل عن ${financingHealth.targetDSCR.toFixed(2)}x عند وجود قرض.`
                : 'مطابقة مصادر التمويل مع إجمالي الاستثمار المطلوب.'
        ];

        return { dimensions, recommendation, factors, score: evaluation?.score || 0 };
    }

    renderDecisionExplainer(explanation) {
        const issues = explanation?.issues || [];
        if (!issues.length) {
            return `
                <div class="card dd-status dd-status--success">
                    <div class="dd-status__head">
                        <svg class="ic dd-status__ic" aria-hidden="true"><use href="#i-shield"/></svg>
                        <h4 class="dd-status__title">مفسّر القرار: لا يوجد رقم كاسر واضح</h4>
                    </div>
                    <p class="dd-status__note">${explanation?.summary || 'الأرقام الرئيسية لا تكسر القرار حالياً، لكن يبقى توثيق الافتراضات ضرورياً.'}</p>
                </div>
            `;
        }


        return `
            <div class="card dd-status ${issues.some(i => i.severity === 'critical') ? 'dd-status--danger' : 'dd-status--warning'}">
                <div class="dd-status__head">
                    <svg class="ic dd-status__ic" aria-hidden="true"><use href="#i-shield"/></svg>
                    <div>
                        <h4 class="dd-status__title">مفسّر القرار: ما الرقم الذي كسر الدراسة؟</h4>
                        <p class="dd-status__note">${explanation.summary || ''}</p>
                    </div>
                </div>
                <ul class="dd-status__list">
                    ${issues.slice(0, 5).map(issue => `
                        <li>
                            <strong>${issue.title}</strong> ${issue.tooltipKey ? createTooltip(issue.tooltipKey) : ''}: ${issue.explanation}
                            <br><span class="text-muted">عدّل من خطوة: <strong>${this.pathToStepLabel(issue.path)}</strong> — ${issue.action}</span>
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    }

    /**
     * تحويل المسار التقني (revenue.streams، assumptions.thresholds.minIRR...) إلى اسم
     * الخطوة العربية — المستخدم لا يعرف بنية الحالة الداخلية.
     */
    pathToStepLabel(path) {
        const p = String(path || '');
        if (!p) return 'غير محدد';
        const map = [
            ['assumptions.thresholds', 'الافتراضات المالية (حدود القرار)'],
            ['assumptions', 'الافتراضات المالية'],
            ['revenue', 'مصادر الإيرادات'],
            ['financing', 'مصادر وهيكلة التمويل'],
            ['technical', 'الدراسة الفنية'],
            ['hr', 'الموارد البشرية'],
            ['techResources', 'الموارد التقنية'],
            ['logistics', 'الموارد اللوجستية'],
            ['administrative', 'الموارد الإدارية'],
            ['legal', 'الدراسة القانونية'],
            ['marketing', 'الدراسة التسويقية'],
            ['marketSizing', 'تحليل حجم السوق'],
            ['services', 'تحليل الخدمات'],
            ['riskAnalysis', 'تحليل المخاطر'],
            ['scenarios', 'السيناريوهات'],
            ['projectInfo', 'بيانات المشروع']
        ];
        const hit = map.find(([prefix]) => p === prefix || p.startsWith(prefix + '.'));
        return hit ? hit[1] : p;
    }

    getFinancingDiagnostics(state, results) {
        const financing = state?.financing || {};
        const loan = financing.sources?.bankLoan || {};
        const loanAmount = Number(loan.amount || results?.loanSchedule?.loanAmount || 0);
        // تدقيق 2026-07-08: كانت 1.5 هنا احتياطياً مختلفة عن 1.25 الفعلية في محرك القرار
        // (engine.js) لنفس الحقل — فتُظهر بطاقة "تغطية دين غير كافية" حمراء لمشروع
        // يجتاز فعلياً بوابة القرار الحقيقية. الآن تُقرأ من نفس المصدر الموحّد.
        const targetDSCR = Number.isFinite(Number(financing.targetDSCR))
            ? Number(financing.targetDSCR)
            : Number(results?.assumptionsApplied?.thresholds?.targetDSCR ?? 1.25);
        const fundingGap = Number(results?.financingCheck?.fundingGap ?? 0);
        // مرآة لعتبة مادية الفجوة في engine.js (تدقيق ٢٠٢٦-٠٧-٠٩) — بلا هذا، انحراف تقريب
        // عادي بين خطوة التمويل والاستثمار المُعاد حسابه لاحقاً يُظهر بطاقة «حرجة» زائفة هنا.
        const fundingGapThreshold = Number(
            results?.financingCheck?.fundingGapMaterialityThreshold
            ?? Math.max(1000, Number(results?.financingCheck?.totalInvestment ?? 0) * 0.01)
        );
        const dscr = results?.indicators?.dscr ?? null;
        const y1Ebitda = Number(results?.incomeStatement?.[0]?.ebitda ?? NaN);
        const concept = String(state?.projectInfo?.concept || state?.projectInfo?.sector || '');
        const isSaas = /saas|منصة|تطبيق|برمجي|تقني|موقع دراسة جدوى/i.test(concept);
        const alerts = [];

        if (fundingGap > fundingGapThreshold) {
            alerts.push({
                type: 'funding-gap',
                title: 'فجوة تمويل غير مغطاة',
                text: `مصادر التمويل أقل من الاستثمار المطلوب بفجوة ${this.formatCurrency(fundingGap)}. أكمل التمويل الذاتي أو خفّض الاستثمار أو أضف مصدر تمويل واضح.`
            });
        }

        const dscrBlocked = loanAmount > 0 && (dscr == null || dscr < targetDSCR);
        if (dscrBlocked) {
            const dscrText = dscr == null ? 'غير قابل للحساب بسبب EBITDA سالبة/صفرية' : `${Number(dscr).toFixed(2)}x`;
            alerts.push({
                type: 'dscr',
                title: 'تغطية خدمة الدين غير كافية',
                text: `DSCR السنة الأولى ${dscrText}، والهدف ${targetDSCR.toFixed(2)}x. جرّب تخفيض القرض، زيادة رأس المال الذاتي، تمديد فترة السماح، أو إثبات إيرادات مسبقة.`
            });
        }

        if (isSaas && loanAmount > 0 && (!Number.isFinite(y1Ebitda) || y1Ebitda <= 0)) {
            alerts.push({
                type: 'saas-bank-readiness',
                title: 'قراءة البنك تختلف عن قراءة المستثمر',
                text: 'منصة SaaS قد تكون جذابة لمستثمر إذا ثبت النمو والاحتفاظ، لكنها ليست جاهزة بنكياً عندما تكون EBITDA السنة الأولى سالبة ولا تغطي القرض.'
            });
        }

        return {
            alerts,
            hasBlockers: alerts.length > 0,
            fundingGap,
            fundingGapThreshold,
            dscr,
            targetDSCR,
            loanAmount,
            y1Ebitda,
            isSaas,
            dscrBlocked,
            bankReady: alerts.length === 0
        };
    }

    renderFinancingGate(financingDiagnostics) {
        const d = financingDiagnostics || {};
        const gapThreshold = d.fundingGapThreshold ?? 1;
        if (!d.hasBlockers && !d.isSaas && Math.abs(Number(d.fundingGap || 0)) <= gapThreshold && !d.loanAmount) return '';

        const statusClass = d.hasBlockers ? 'dd-status--warning' : 'dd-status--success';
        const title = d.hasBlockers ? 'حواجز التمويل قبل البنك' : 'التمويل متوازن مبدئياً';
        const bankLabel = d.bankReady ? 'جاهز بنكياً مبدئياً' : 'غير جاهز بنكياً بعد';
        const investorLabel = d.isSaas
            ? 'قراءة المستثمر: تعتمد على إثبات النمو، CAC، الاحتفاظ، والعقود المسبقة.'
            : 'قراءة المستثمر: راجع جودة السوق والمخاطر بجانب المؤشرات المالية.';
        const gapLabel = d.fundingGap > gapThreshold
            ? `فجوة ${this.formatCurrency(d.fundingGap)}`
            : d.fundingGap < -gapThreshold
                ? `فائض ${this.formatCurrency(Math.abs(d.fundingGap))}`
                : 'متوازن';
        const dscrLabel = d.dscr == null ? 'غير قابل للحساب' : `${Number(d.dscr).toFixed(2)}x`;

        return `
            <div class="card dd-status ${statusClass}">
                <div class="dd-status__head">
                    <svg class="ic dd-status__ic" aria-hidden="true"><use href="#i-shield"/></svg>
                    <div>
                        <h4 class="dd-status__title">${title}</h4>
                        <p class="dd-status__note">قراءة البنك: <strong>${bankLabel}</strong>. ${investorLabel}</p>
                    </div>
                </div>
                <div class="indicators-grid" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-top:10px;">
                    <div class="kpi-mini-card ${d.fundingGap > gapThreshold ? 'negative' : 'positive'}">
                        <span class="mini-label">فجوة التمويل</span>
                        <span class="mini-value">${gapLabel}</span>
                    </div>
                    <div class="kpi-mini-card ${d.dscrBlocked ? 'negative' : 'positive'}">
                        <span class="mini-label">DSCR السنة الأولى</span>
                        <span class="mini-value">${dscrLabel}</span>
                    </div>
                    <div class="kpi-mini-card ${d.y1Ebitda < 0 ? 'negative' : 'positive'}">
                        <span class="mini-label">EBITDA السنة الأولى</span>
                        <span class="mini-value">${Number.isFinite(d.y1Ebitda) ? this.formatCurrency(d.y1Ebitda) : '--'}</span>
                    </div>
                </div>
                ${d.alerts?.length ? `
                    <ul class="dd-status__list" style="margin-top:10px;">
                        ${d.alerts.map(a => `<li><strong>${a.title}:</strong> ${a.text}</li>`).join('')}
                    </ul>
                ` : ''}
            </div>
        `;
    }

    /**
     * يبني تفسير القرار (لماذا) والخطوات التالية العلاجية من التقييم والجاهزية.
     * كان recommendation.desc محسوباً في calculateReadiness لكنه لا يُعرض في أي مكان —
     * وهنا نعرضه ونشتق منه بنوداً واضحة وخطوات قابلة للتنفيذ.
     */
    buildDecisionReasons(state, results, readiness, evaluation) {
        const kpis = results?.indicators || {};
        const payback = kpis.paybackPeriod ?? kpis.payback;
        const thresholds = results?.assumptionsApplied?.thresholds || { minNPV: 0, minIRR: 0.15, maxPayback: 3.5, minROI: 0.20 };
        const reasons = [];
        const nextSteps = [];
        const engineReasons = Array.isArray(results?.decisionReasons) ? results.decisionReasons : [];

        engineReasons.forEach(reason => {
            if (reason && !reasons.includes(reason)) reasons.push(reason);
            if (/مصادر التمويل|فجوة/.test(reason || '')) {
                nextSteps.push({ step: 'مصادر وهيكلة التمويل', text: 'طابق مصادر التمويل مع إجمالي الاستثمار أو استخدم زر سدّ الفجوة من التمويل الذاتي.' });
            }
            if (/تغطية خدمة الدين|DSCR/.test(reason || '')) {
                nextSteps.push({ step: 'تفاصيل القرض', text: 'خفّض مبلغ القرض أو زد فترة السماح أو أضف رأس مال ذاتي/إيرادات مسبقة حتى يتحسن DSCR.' });
            }
        });

        // الأسباب المالية
        if (!(kpis.npv > thresholds.minNPV)) {
            reasons.push(`صافي القيمة الحالية (${this.formatCurrency(kpis.npv)}) دون الحد الأدنى (${this.formatCurrency(thresholds.minNPV)}).`);
            nextSteps.push({ step: 'التمويل والتكاليف', text: 'راجع هيكل التكاليف أو قلّل الاستثمار المبدئي لرفع صافي القيمة الحالية.' });
        }
        if (!(kpis.irr >= thresholds.minIRR)) {
            reasons.push(`معدل العائد الداخلي أقل من ${(thresholds.minIRR * 100).toFixed(0)}%.`);
            nextSteps.push({ step: 'الافتراضات المالية', text: 'حسّن هامش الربح أو أعد النظر في التسعير ومعدل النمو.' });
        }
        if (!(payback <= thresholds.maxPayback && payback > 0)) {
            reasons.push(`فترة الاسترداد تتجاوز ${thresholds.maxPayback} سنوات.`);
        }

        // الأسباب التشغيلية (نقص بيانات الجاهزية)
        const dimMap = {
            financing: { step: 'مصادر وهيكلة التمويل', text: 'أكمل بيانات التمويل (إجمالي الاستثمار).' },
            market: { step: 'الدراسة السوقية', text: 'أكمل تحجيم السوق (SOM) وتحليل الطلب.' },
            team: { step: 'الموارد البشرية', text: 'أضف المناصب الوظيفية والرواتب.' },
            legal: { step: 'الدراسة القانونية', text: 'أضف التراخيص المطلوبة وتكلفتها.' },
            risk: { step: 'تحليل المخاطر', text: 'وثّق سجل المخاطر وخطط التخفيف.' },
            location: { step: 'الدراسة الفنية', text: 'حدّد الموقع وعوامل اختياره.' }
        };
        Object.keys(dimMap).forEach(k => {
            if (readiness.dimensions?.[k] && readiness.dimensions[k] !== 'ready') {
                reasons.push(`«${dimMap[k].step}» غير مكتملة.`);
                nextSteps.push(dimMap[k]);
            }
        });

        // نقاط القوة (لماذا القرار جيد) من تفاصيل التقييم الإيجابية
        const positives = (evaluation?.details || [])
            .filter(d => d && (d.issue === false || (typeof d.score === 'number' && d.score > 0)))
            .slice(0, 3)
            .map(d => d.label)
            .filter(Boolean);

        // إزالة تكرار الخطوات (قد يتكرر التمويل من المسارين المالي والتشغيلي)
        const seen = new Set();
        const uniqueSteps = nextSteps.filter(s => {
            const key = s.step + '|' + s.text;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        return { desc: readiness.recommendation?.desc || '', reasons, nextSteps: uniqueSteps, positives };
    }

    renderKPIItem(label, value, type, threshold = 1, term = null) {
        const n = Number(value);
        const explanations = {
            currency: 'القيمة الحالية بعد خصم التدفقات النقدية وفق معدل الخصم المدخل.',
            percent: 'النسبة محسوبة من مخرجات النموذج للسنة الأولى أو سيناريو المحاكاة.',
            years: 'عدد السنوات حتى استرداد الاستثمار وفق التدفق النقدي التراكمي.',
            dscr: 'قدرة التدفق النقدي التشغيلي على تغطية خدمة الدين.',
            fundingGap: 'إجمالي الاستثمار المطلوب ناقص مصادر التمويل المدخلة.'
        };
        const explanation = explanations[type] || 'مؤشر محسوب من النموذج المالي الحالي.';
        let formatted = (value === null || value === undefined || value === '') ? '--' : String(value);
        let status = 'positive';
        if (type === 'currency') {
            formatted = this.formatCurrency(n);
            status = n < 0 ? 'negative' : 'positive';
        }
        if (type === 'fundingGap') {
            formatted = !Number.isFinite(n) ? '--' : n > threshold ? this.formatCurrency(n) : n < -threshold ? `فائض ${this.formatCurrency(Math.abs(n))}` : 'متوازن';
            status = n > threshold ? 'negative' : 'positive';
        }
        if (type === 'dscr') {
            formatted = Number.isFinite(n) ? `${n.toFixed(2)}x` : 'غير قابل للحساب';
            status = Number.isFinite(n) && n >= 1.25 ? 'positive' : 'negative';
        }
        if (type === 'percent') {
            formatted = Number.isFinite(n) ? (n * 100).toFixed(1) + '%' : '--';
            status = n < 0.05 ? 'negative' : 'positive';
        }
        if (type === 'years') {
            formatted = Number.isFinite(n) && n > 0 ? (Math.round(n * 10) / 10) + ' سنة' : 'غير محقق';
            status = Number.isFinite(n) && n > 0 ? 'positive' : 'negative';
        }

        const labelHtml = term ? `${label} ${indicatorHelp(term)}` : label;
        return `
                <div class="kpi-mini-card ${status}" title="${explanation}">
                <span class="mini-label">${labelHtml}</span>
                <span class="mini-value">${formatted}</span>
            </div>
        `;
    }

    renderReadinessItem(label, status) {
        // حالة نصية بدل إيموجي ملوّن — أوضح لقارئ الشاشة وأليق بتقرير يُقدَّم للبنك.
        // اللون يأتي من الصنف status-${status}، فالمعنى لا يعتمد على اللون وحده.
        const labels = { ready: 'جاهز', needs_work: 'يحتاج عمل', critical: 'حرج' };
        return `
            <div class="readiness-item status-${status}">
                <span class="readiness-label">${label}</span>
                <span class="readiness-status-icon">${labels[status] || '—'}</span>
            </div>
        `;
    }

    // تدقيق 2026-07-08 (ملاحظة عالية #27): كانت hex ثابتة (#10b981...) لا تتبع متغيرات
    // CSS الخاصة بالثيم (variables.css) — فتبقى نفس الدرجة اللونية حرفياً بين الفاتح
    // والداكن بدل استخدام --c-success/--c-warning/--c-danger المُعرَّفة لكل ثيم.
    getScoreColor(score) {
        if (score >= 80) return 'var(--c-success)';
        // تدقيق بصري: --c-accent-blue كان لوناً رابعاً دخيلاً على تدرّج الحالة الثلاثي
        // (نجاح/تحذير/خطر) — الوحيد بين الأربعة غير المُعاد تعريفه في [data-theme="dark"]،
        // فيبقى نفس اللون حرفياً بين الفاتح والداكن ويُقرأ كحيادي لا كإشارة تقييم فعلية.
        // مزيج حقيقي بين نجاح/تحذير بدل لون accent منفصل — يتبع الثيم تلقائياً في الحالتين.
        if (score >= 60) return 'color-mix(in srgb, var(--c-success) 55%, var(--c-warning))';
        if (score >= 40) return 'var(--c-warning)';
        return 'var(--c-danger)';
    }

    formatCurrency(n) {
        if (!n && n !== 0) return '--';
        return new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(n || 0);
    }

    formatPercent(n) {
        if (!Number.isFinite(n)) return '--';
        return (n * 100).toFixed(1) + '%';
    }
}
