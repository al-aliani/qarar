/**
 * Executive Summary Component
 * Auto-generated summary with key highlights and investment decision
 */

import { calculateStudy as runFullModel, resolveDecisionThresholds } from '../core/engine.js';
import { investmentDataWarning, investmentDataWarningHtml } from '../utils/dataQuality.js';
import { calculateProjectScore } from '../core/scoring.js';
import { checkDriversAgainstBenchmarks, SECTOR_BENCHMARKS, resolveSectorBenchmark } from '../core/sectorBenchmarks.js';
import { aiConnector } from '../services/AIConnector.js'; // Updated: use unified AI service
import { InternalAIGenerator } from '../services/InternalAIGenerator.js';
import { toast } from '../utils/toast.js';
import { escapeHtml } from '../utils/escape.js';

export class ExecutiveSummary {
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
        const execSummary = state.executiveSummary || {};

        // تشغيل النموذج المالي مرة واحدة واستخدام مخرجاته في الدرجة والبطاقات
        let financialResults = null;
        try {
            financialResults = runFullModel(state);
        } catch (e) {
            console.warn('Could not run financial model:', e);
        }
        const { score, breakdown } = this.calculateFeasibilityScore(state, financialResults);

        this.container.innerHTML = `
            <div class="executive-summary">
                <h2 class="section-title">الملخص التنفيذي</h2>
                ${investmentDataWarningHtml(investmentDataWarning(state, financialResults))}
                ${this.renderAuditorBanner(state, financialResults)}

                <!-- Feasibility Score -->
                <div class="card analysis-card">
                    <h3 class="card-title">درجة الجدوى التلقائية</h3>
                    ${this.renderFeasibilityScore(score, breakdown)}
                </div>

                <!-- Project Overview -->
                <div class="card analysis-card">
                    <h3 class="card-title">نظرة عامة على المشروع</h3>
                    ${this.renderProjectOverview(state, execSummary)}
                </div>

                <!-- الفرضية ولماذا سنربح (YC / تقييم أفكار الستارت آب) -->
                ${this.renderHypothesisAndAdvantage(state)}

                <!-- Investment Highlights -->
                <div class="card analysis-card">
                    <h3 class="card-title">أبرز نقاط الاستثمار</h3>
                    ${this.renderInvestmentHighlights(state, financialResults)}
                </div>

                <!-- Key Risks -->
                <div class="card analysis-card">
                    <h3 class="card-title">المخاطر الرئيسية</h3>
                    ${this.renderKeyRisks(state)}
                </div>

                <!-- الحلول المقترحة للتحديات (الفجوة المعيارية) -->
                <div class="card analysis-card">
                    <h3 class="card-title">الحلول المقترحة للتحديات</h3>
                    ${this.renderProposedSolutions(state)}
                </div>

                <!-- Final Recommendation -->
                <div class="card analysis-card">
                    <h3 class="card-title">التوصية النهائية</h3>
                    ${this.renderRecommendation(score, financialResults, state)}
                </div>

                <!-- تنبيه الدراسة ليست مضمونة -->
                <div class="alert alert--info mt-4" style="font-size: 0.85rem;">
                    <strong>تنبيه:</strong> الدراسة قد تُعدّ بعناية مهنية، لكن المستقبل مجهول — متغيرات السوق والحكومة والفنية قد تتغير. تحليل الحساسية إلزامي لأي دراسة مكتملة.
                </div>

                <!-- Navigation -->
                <div class="wizard-nav margin-top-lg">
                    <button class="btn btn--secondary btn-prev-step">السابق</button>
                    <button class="btn btn--primary btn-next-step">التالي</button>
                </div>

                <!-- Industry Benchmarks -->
                <div class="card analysis-card">
                    <h3 class="card-title">📊 مقارنة بمعايير الصناعة</h3>
                    ${this.renderIndustryBenchmarks(state, financialResults)}
                </div>
            </div>
        `;

        this.bindEvents();
    }

    calculateFeasibilityScore(state, financialResults) {
        // Unified score source: same calculateProjectScore the Decision Dashboard uses —
        // the exec summary previously had its own algorithm giving a different number (89 vs 100).
        const evaluation = calculateProjectScore(state, financialResults);
        return { score: evaluation.score, breakdown: evaluation.breakdown || {} };
    }

    renderFeasibilityScore(score, breakdown) {
        const getScoreColor = (s) => {
            if (s >= 80) return 'score-excellent';
            if (s >= 60) return 'score-good';
            if (s >= 40) return 'score-fair';
            return 'score-poor';
        };

        const getScoreLabel = (s) => {
            if (s >= 80) return 'ممتاز - المشروع مجدي بشكل كبير';
            if (s >= 60) return 'جيد - المشروع مجدي مع بعض التحفظات';
            if (s >= 40) return 'مقبول - يحتاج دراسة إضافية';
            return 'ضعيف - المشروع غير مجدي في الوضع الحالي';
        };

        return `
            <div class="feasibility-score-container">
                <div class="score-circle ${getScoreColor(score)}">
                    <div class="score-value">${score}</div>
                    <div class="score-label">من 100</div>
                </div>
                <div class="score-status">${getScoreLabel(score)}</div>
                <div class="score-breakdown">
                    ${Object.entries(breakdown).map(([key, data]) => `
                        <div class="breakdown-item">
                            <span class="breakdown-label">${data.label}</span>
                            <div class="breakdown-bar">
                                <div class="breakdown-fill" style="width: ${(data.score / data.max) * 100}%"></div>
                            </div>
                            <span class="breakdown-value">${data.score}/${data.max}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    renderHypothesisAndAdvantage(state) {
        const pi = state.projectInfo || {};
        const sh = pi.startupHypothesis || {};
        const ua = pi.unfairAdvantage || { types: [], insightText: '' };
        const hasHypothesis = (sh.problem || sh.solution || sh.insight) || (ua.types?.length > 0 || ua.insightText);
        if (!hasHypothesis) return '';

        const uaLabels = {
            founder: 'مؤسس — خبرة/معرفة نادرة',
            market: 'سوق — السوق نامٍ',
            product10x: 'منتج 10x — أفضل بعشر مرات من المنافس',
            acquisition: 'اكتساب — نمو بكلمة شفاهية',
            network: 'تأثير شبكي — كلما كبرت الشبكة زادت القيمة'
        };
        const typesList = (ua.types || []).map(t => uaLabels[t] || t).join('؛ ');

        return `
                <div class="card analysis-card">
                    <h3 class="card-title">🎯 الفرضية ولماذا سنربح</h3>
                    <div class="overview-grid" style="font-size: 0.95rem;">
                        ${sh.problem ? `<div class="overview-item full-width"><span class="overview-label">المشكلة (الظروف الأولية)</span><p class="overview-value mt-1">${escapeHtml(sh.problem)}</p></div>` : ''}
                        ${sh.solution ? `<div class="overview-item full-width"><span class="overview-label">الحل (التجربة / المنتج أو الخدمة)</span><p class="overview-value mt-1">${escapeHtml(sh.solution)}</p></div>` : ''}
                        ${sh.insight ? `<div class="overview-item full-width"><span class="overview-label">الاستبصار (لماذا سنربح؟)</span><p class="overview-value mt-1">${escapeHtml(sh.insight)}</p></div>` : ''}
                        ${typesList ? `<div class="overview-item full-width"><span class="overview-label">المزايا غير العادلة</span><p class="overview-value mt-1">${escapeHtml(typesList)}</p></div>` : ''}
                        ${ua.insightText ? `<div class="overview-item full-width"><span class="overview-label">شرح موجز للاستبصار</span><p class="overview-value mt-1">${escapeHtml(ua.insightText)}</p></div>` : ''}
                    </div>
                </div>
        `;
    }

    renderProjectOverview(state, execSummary) {
        const projectInfo = state.projectInfo || {};
        return `
            <div class="overview-grid">
                <div class="overview-item">
                    <span class="overview-label">اسم المشروع</span>
                    <span class="overview-value">${projectInfo.name ? escapeHtml(projectInfo.name) : '(لم يحدد)'}</span>
                </div>
                <div class="overview-item">
                    <span class="overview-label">الموقع</span>
                    <span class="overview-value">${escapeHtml(projectInfo.city || '')} - ${escapeHtml(projectInfo.district || '')}</span>
                </div>
                <div class="overview-item full-width">
                    <label for="projectOverview" class="overview-label">وصف المشروع</label>
                    <div class="ai-toolbar">
                        <small class="text-muted">يمكنك كتابة الوصف يدوياً أو استخدام الذكاء الاصطناعي:</small>
                        <button type="button" class="btn-xs btn-magic ai-generate-btn" data-target="projectOverview" title="توليد محلي بالكامل من بيانات دراستك — لا اتصال بأي مزوّد ذكاء اصطناعي خارجي">
                            ✨ توليد بالذكاء الاصطناعي
                        </button>
                    </div>
                    <textarea class="input exec-field" data-field="projectOverview" id="projectOverview" rows="4"
                              placeholder="وصف مختصر للمشروع وأهدافه">${escapeHtml(execSummary.projectOverview || projectInfo.description || '')}</textarea>
                </div>
                <div class="overview-item full-width">
                    <div class="ai-toolbar flex-between mb-1">
                        <label for="exec-problemStatement">المشكلة التي يحلها المشروع</label>
                        <button type="button" class="btn-xs btn-magic ai-field-btn" data-target="exec-problemStatement" title="ولّد بالذكاء الاصطناعي">✨ ولّد</button>
                    </div>
                    <textarea id="exec-problemStatement" class="input exec-field" data-field="problemStatement" rows="2"
                              placeholder="ما المشكلة أو الحاجة التي يلبيها مشروعك؟">${escapeHtml(execSummary.problemStatement || '')}</textarea>
                </div>
                <div class="overview-item full-width">
                    <div class="ai-toolbar flex-between mb-1">
                        <label for="exec-uniqueValue">الميزة التنافسية الفريدة</label>
                        <button type="button" class="btn-xs btn-magic ai-field-btn" data-target="exec-uniqueValue" title="ولّد بالذكاء الاصطناعي">✨ ولّد</button>
                    </div>
                    <textarea id="exec-uniqueValue" class="input exec-field" data-field="uniqueValueProposition" rows="2"
                              placeholder="ما الذي يميز مشروعك عن المنافسين؟">${escapeHtml(execSummary.uniqueValueProposition || '')}</textarea>
                </div>
            </div>
        `;
    }

    renderInvestmentHighlights(state, results) {
        const financing = state.financing || {};
        const ind = results?.indicators || {};
        const inv = financing.totalInvestment ?? results?.capex?.total ?? 0;
        const payback = ind.paybackPeriod ?? ind.payback ?? null;

        const highlights = [
            { label: 'إجمالي الاستثمار', value: this.formatCurrency(inv), icon: '💰' },
            { label: 'صافي القيمة الحالية', value: this.formatCurrency(ind.npv ?? 0), icon: '📈', positive: (ind.npv ?? 0) > 0 },
            { label: 'معدل العائد الداخلي', value: `${((ind.irr ?? 0) * 100).toFixed(1)}%`, icon: '📊' },
            { label: 'فترة الاسترداد', value: (payback != null && Number.isFinite(payback) && payback > 0 && payback < 900) ? `${payback.toFixed(1)} سنة` : 'غير محقق', icon: '⏱️' },
            { label: 'العائد على الاستثمار', value: `${((ind.roi ?? 0) * 100).toFixed(0)}%`, icon: '💹' }
        ];

        return `
            <div class="highlights-grid">
                ${highlights.map(h => `
                    <div class="highlight-card ${h.positive === false ? 'negative' : h.positive === true ? 'positive' : ''}">
                        <span class="highlight-icon">${h.icon}</span>
                        <span class="highlight-value">${h.value}</span>
                        <span class="highlight-label">${h.label}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderProposedSolutions(state) {
        const risks = state.riskAnalysis?.risks || [];
        const solutions = risks
            .filter(r => r.mitigation && (r.name || r.description))
            .map(r => ({ challenge: r.name || r.description, solution: r.mitigation }));

        if (solutions.length === 0) {
            return `<p class="text-muted">يتم استخراج الحلول المقترحة من خطط المواجهة في <strong>تحليل المخاطر</strong>. أضف مخاطر وخطة مواجهة لكل منها.</p>`;
        }

        return `
            <ul>
                ${solutions.map(s => `
                    <li>
                        <strong>التحدي:</strong> ${escapeHtml(s.challenge)}<br>
                        <strong>الحل المقترح:</strong> ${escapeHtml(s.solution)}
                    </li>
                `).join('')}
            </ul>
        `;
    }

    /**
     * بانر «نظرة المدقق» أعلى الملخص التنفيذي — يرفع تحذيرات معايير القطاع + فحوص معقولية IRR/الاسترداد
     * التي كانت مدفونة في لوحات فرعية، كي لا يظهر رقم يعرف النظام أنه غير واقعي بلا تنبيه بارز.
     */
    renderAuditorBanner(state, results) {
        const ind = results?.indicators || {};
        const warnings = [];
        try {
            (checkDriversAgainstBenchmarks(state, results) || []).forEach(w => { if (w?.message) warnings.push(w.message); });
        } catch (_) { }
        const irr = Number(ind.irr);
        if (Number.isFinite(irr) && irr > 0.60) {
            warnings.push(`معدل العائد الداخلي ${(irr * 100).toFixed(0)}% مرتفع بشكل غير واقعي — عادةً يعني إيرادات متفائلة أو تكاليف ناقصة؛ راجع الفرضيات قبل الاعتماد عليه أمام ممول.`);
        }
        const pb = Number(ind.paybackPeriod ?? ind.payback);
        if (Number.isFinite(pb) && pb > 0 && pb < 1) {
            warnings.push(`فترة الاسترداد ${pb.toFixed(1)} سنة أسرع من المعتاد لهذا القطاع — تحقّق من واقعية المبيعات واكتمال التكاليف.`);
        }
        if (!warnings.length) return '';
        const items = warnings.slice(0, 4).map(m => `<li>${escapeHtml(m)}</li>`).join('');
        return `
            <div class="alert alert--warning" role="alert" style="margin-bottom:1rem;">
                <strong>🔍 نظرة المدقق — انتبه قبل الاعتماد على النتيجة:</strong>
                <ul style="margin:.4rem 0 .2rem; padding-inline-start:1.2rem;">${items}</ul>
                <small class="text-muted">راجع «هل أرقامي منطقية؟» و«نظرة المدقق» في اللوحة المالية للتفاصيل.</small>
            </div>`;
    }

    renderKeyRisks(state) {
        // مرتبط بصفحة «تحليل المخاطر» / مصفوفة المخاطر: state.riskAnalysis.risks
        // نرتّب بنفس درجة الخطورة الرقمية التي يستخدمها السجل (احتمال × أثر ≥ 6)،
        // بدل اشتراط السلسلة الحرفية 'high' — فمخاطرة «متوسط×متوسط»=6 كانت تُستبعد رغم أنها مهمة.
        const probScore = { low: 1, medium: 2, high: 3 };
        const impactScore = { low: 1, medium: 3, high: 5 };
        const sev = r => (probScore[r.probability] || 1) * (impactScore[r.impact] || 1);
        const raw = state.riskAnalysis?.risks || [];
        const risks = raw
            .filter(r => (r.name || r.description) && sev(r) >= 6)
            .sort((a, b) => sev(b) - sev(a))
            .slice(0, 5);

        if (risks.length === 0) {
            return `<p class="text-muted">لم يتم تحديد مخاطر رئيسية في صفحة <strong>تحليل المخاطر</strong> (مصفوفة المخاطر). أضف مخاطر ذات احتمال أو أثر عالٍ هناك حتى تظهر هنا.</p>`;
        }

        return `
            <div class="risks-list">
                ${risks.map(risk => `
                    <div class="risk-item">
                        <span class="risk-severity ${sev(risk) >= 9 ? 'critical' : 'high'}">
                            ${sev(risk) >= 9 ? '🔴' : '🟡'}
                        </span>
                        <span class="risk-name">${risk.name ? escapeHtml(risk.name) : (risk.description ? escapeHtml(risk.description) : 'خطر غير محدد')}</span>
                        <span class="risk-mitigation">${risk.mitigation ? escapeHtml(risk.mitigation) : 'لا توجد خطة مواجهة'}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderRecommendation(score, results, state) {
        let recommendation = 'conditional';
        let message = '';
        let actions = [];

        // التوصية من نفس المصدر الموحّد (calculateProjectScore ← قرار المحرك) كي تطابق لوحة القرار،
        // بدل عتبة score>=70 مستقلة قد تعطي «نفّذ» بينما تعرض اللوحة «مراجعة» لنفس المشروع.
        const evalr = calculateProjectScore(state, results);

        // دفعة 6: كانت الأفعال الموصى بها ثابتة تماماً لكل فئة قرار (GO/CONDITIONAL/NOGO)
        // بصرف النظر عن نقاط الضعف الفعلية في مؤشرات المشروع — فمشروعان GO بملفين ماليين
        // مختلفين تماماً (مثال: DSCR مريح مقابل DSCR ملاصق للحد الأدنى، أو استرداد قصير مقابل
        // استرداد طويل) يحصلان على نفس الأفعال الثلاثة حرفياً. نشتق هنا 1-2 فعل إضافي فعلياً
        // من مؤشرات هذا المشروع تحديداً (DSCR وفترة الاسترداد) ونضيفها لقائمة كل فئة.
        const ind = results?.indicators || {};
        const financing = state?.financing || {};
        const thresholds = results?.assumptionsApplied?.thresholds
            || resolveDecisionThresholds(state?.assumptions?.thresholds, financing);
        const dynamicActions = [];

        const loanAmount = Number(financing?.sources?.bankLoan?.amount ?? results?.loanSchedule?.loanAmount ?? 0);
        const dscr = ind.dscr;
        // ليس فقط dscr < الحد — بل أي DSCR "ملاصق" للحد الأدنى (هامش أمان ضعيف) يستحق تنبيهاً،
        // حتى لو كان القرار العام GO (اجتاز الحد بالكاد ولم يهبط القرار إلى REVISE).
        if (loanAmount > 0 && Number.isFinite(dscr) && dscr < (thresholds.targetDSCR + 0.2)) {
            dynamicActions.push('أعد هيكلة التمويل (خفض مبلغ القرض أو رفع رأس المال الذاتي) لتحسين تغطية خدمة الدين (DSCR) وزيادة هامش الأمان');
        }

        const payback = ind.paybackPeriod ?? ind.payback;
        if (Number.isFinite(payback) && payback > 0 && payback > thresholds.maxPayback) {
            dynamicActions.push('فكّر بتنفيذ مرحلي (فرع أو دفعة واحدة أولاً) بدل الإطلاق الكامل لتخفيف أثر طول فترة الاسترداد على التدفق النقدي');
        }

        if (evalr.recommendation === 'go') {
            recommendation = 'go';
            message = 'المشروع مجدي ويُنصح بالمضي قدماً في التنفيذ';
            actions = ['البدء في إجراءات التأسيس', 'تأمين التمويل', 'بناء الفريق', ...dynamicActions];
        } else if (evalr.recommendation === 'nogo') {
            recommendation = 'nogo';
            message = 'المشروع غير مجدي في شكله الحالي ويحتاج إعادة هيكلة جوهرية';
            actions = ['إعادة دراسة نموذج العمل', 'تقليل التكاليف بشكل كبير', 'البحث عن أسواق بديلة'];
        } else {
            recommendation = 'conditional';
            message = 'المشروع يحتاج معالجة بعض النقاط قبل اتخاذ القرار النهائي';
            actions = ['معالجة الفجوات المحددة', 'إعادة النظر في التكاليف', 'استشارة خبراء', ...dynamicActions];
        }

        const bannerClass = recommendation === 'go' ? 'is-go' : recommendation === 'nogo' ? 'is-nogo' : 'is-conditional';

        return `
            <div class="recommendation-container">
                <div class="decision-banner ${bannerClass}">
                    ${recommendation === 'go' ? '✅ المشروع مجدي - GO' :
                recommendation === 'nogo' ? '❌ المشروع غير مجدي - NO GO' :
                    '⚠️ يحتاج مراجعة - CONDITIONAL'}
                </div>
                <p class="recommendation-message">${message}</p>
                <div class="recommended-actions">
                    <h4>الخطوات الموصى بها:</h4>
                    <ul>
                        ${actions.map(a => `<li>${a}</li>`).join('')}
                    </ul>
                </div>
            </div>
        `;
    }

    renderIndustryBenchmarks(state, results) {
        // تدقيق 2026-07-08 (ملاحظة عالية #32): كانت هذه قائمة "صناعات" مستقلة ومختلَقة
        // (مطاعم/نوادي رياضية/تجزئة/خدمات مهنية/تقنية) بأرقام هامش/ROI/استرداد بلا أي مصدر،
        // وأغلبها غير ذي صلة بمنصة مطاعم سعودية (نوادي رياضية، تقنية عامة) — وتتناقض مع
        // sectorBenchmarks.js (المصدر الموحّد المستخدم في SmartAdvisor وبوابة QA لنفس الغرض).
        // الآن تُستخدم نفس القطاعات الستة المعتمدة، وعمود الهامش فقط (الحقل الوحيد المتوفر
        // فعلياً في ذلك المصدر) — لا اختلاق أرقام ROI/استرداد قطاعية لا مصدر لها.
        const detected = resolveSectorBenchmark(state);

        const projectMargin = results?.indicators?.profitMargin ?? (results?.incomeStatement?.[0]?.revenue > 0 ? (results?.incomeStatement?.[0]?.netIncome ?? 0) / results.incomeStatement[0].revenue : 0);
        const projectAnnualROI = results?.indicators?.annualROI ?? results?.indicators?.arr ?? 0;
        const projectPayback = results?.indicators?.paybackPeriod ?? results?.indicators?.payback ?? null;
        const projectPaybackText = Number.isFinite(projectPayback) && projectPayback > 0 ? `${projectPayback.toFixed(1)} سنة` : 'غير محقق';

        return `
            <div class="benchmarks-container">
                <div class="benchmark-comparison">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>القطاع</th>
                                <th>هامش الربح</th>
                                <th>العائد السنوي على الاستثمار</th>
                                <th>فترة الاسترداد</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr class="project-row">
                                <td><strong>مشروعك</strong></td>
                                <td class="${projectMargin >= 0.10 ? 'text-success' : 'text-danger'}">${(projectMargin * 100).toFixed(1)}%</td>
                                <td class="${projectAnnualROI >= 0.20 ? 'text-success' : 'text-danger'}">${(projectAnnualROI * 100).toFixed(0)}%</td>
                                <td class="${Number.isFinite(projectPayback) && projectPayback <= 4 ? 'text-success' : 'text-danger'}">${projectPaybackText}</td>
                            </tr>
                            ${Object.values(SECTOR_BENCHMARKS).map(b => `
                                <tr${!detected.isGeneric && b.label === detected.label ? ' class="benchmark-match"' : ''}>
                                    <td>${b.label}${!detected.isGeneric && b.label === detected.label ? ' (قطاعك)' : ''}</td>
                                    <td>${Math.round(b.netProfitToRevenue[0] * 100)}-${Math.round(b.netProfitToRevenue[1] * 100)}%</td>
                                    <td>—</td>
                                    <td>—</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <p class="text-xs text-muted mt-2">المقارنة القطاعية تستخدم عائداً سنوياً قابلاً للمقارنة، وليس العائد التراكمي لكامل فترة الدراسة. نطاقات هامش الربح تقديرات داخلية من ممارسات محلية متعارف عليها (ليست رقماً رسمياً منشوراً)؛ العائد وفترة الاسترداد القطاعيان لا يتوفر لهما مصدر موثوق حالياً فتُركا فارغين بدل اختلاقهما.</p>
                </div>
            </div>
        `;
    }

    formatCurrency(n) {
        return new Intl.NumberFormat('ar-SA', {
            style: 'currency',
            currency: 'SAR',
            maximumFractionDigits: 0
        }).format(n || 0);
    }

    bindEvents() {
        // Navigation
        this.container.querySelector('.btn-prev-step')?.addEventListener('click', () => {
            if (this.onNavigate) this.onNavigate(this.stepIndex - 1);
        });
        this.container.querySelector('.btn-next-step')?.addEventListener('click', () => {
            if (this.onNavigate) this.onNavigate(this.stepIndex + 1);
        });

        this.container.querySelectorAll('.exec-field').forEach(input => {
            input.addEventListener('change', (e) => {
                const field = e.target.dataset.field;
                const value = e.target.value;
                const state = this.store.getState();
                this.store.update('executiveSummary', { ...state.executiveSummary, [field]: value });
            });
        });

        // AI Generation Handler
        this.container.querySelectorAll('.ai-generate-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const targetId = e.target.dataset.target;
                const inputEl = this.container.querySelector(`#${targetId}`);

                if (this.isGenerating) return;

                // UI Loading State
                e.target.disabled = true;
                e.target.textContent = 'جاري التفكير... 🧠';
                this.isGenerating = true;

                // Collect Context
                const state = this.store.getState();
                const projectInfo = state.projectInfo || {};

                try {
                    // Get financial results for better context
                    let results = null;
                    try {
                        results = runFullModel(state);
                    } catch (err) {
                        console.warn('Could not run financial model:', err);
                    }

                    // Call unified AI Service
                    const generatedText = await aiConnector.generateExecutiveSummary(state, results);

                    // Update UI — فقط إن كان الناتج نصاً فعلياً (null = تعذر التوليد؛
                    // لا نحفظ فراغاً/رسالة خطأ كملخص تنفيذي)
                    if (inputEl && typeof generatedText === 'string' && generatedText.trim()) {
                        inputEl.value = generatedText;
                        // Trigger change event to save to store
                        inputEl.dispatchEvent(new Event('change'));
                    } else if (!generatedText) {
                        throw new Error('تعذر التوليد — لا يوجد ناتج');
                    }

                    // Success feedback
                    e.target.textContent = '✅ تم التوليد';
                    setTimeout(() => {
                        e.target.textContent = '✨ توليد بالذكاء الاصطناعي';
                    }, 2000);
                } catch (error) {
                    console.error('AI Generation error:', error);
                    e.target.textContent = '❌ فشل التوليد';
                    setTimeout(() => {
                        e.target.textContent = '✨ توليد بالذكاء الاصطناعي';
                    }, 3000);
                } finally {
                    // Reset Button
                    e.target.disabled = false;
                    this.isGenerating = false;
                }
            });
        });

        // AI Field Buttons (ولّد — المهمة 3: AI Writer في المعالج)
        this.container.querySelectorAll('.ai-field-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const targetId = e.target.dataset.target;
                const inputEl = this.container.querySelector(`#${targetId}`);
                if (!inputEl || this.isGenerating) return;

                e.target.disabled = true;
                e.target.textContent = 'جاري...';
                this.isGenerating = true;
                const originalVal = inputEl.value;

                setTimeout(() => {
                    try {
                        const state = this.store.getState();
                        const suggestion = InternalAIGenerator.generateFieldSuggestion(targetId, originalVal, state);
                        inputEl.value = suggestion;
                        inputEl.dispatchEvent(new Event('change'));
                        toast.success('تم اقتراح النص بنجاح ✨');
                    } catch (err) {
                        console.error(err);
                        toast.error('حدث خطأ أثناء التوليد');
                    } finally {
                        e.target.disabled = false;
                        e.target.textContent = '✨ ولّد';
                        this.isGenerating = false;
                    }
                }, 400);
            });
        });
    }
}
