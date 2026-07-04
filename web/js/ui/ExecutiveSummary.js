/**
 * Executive Summary Component
 * Auto-generated summary with key highlights and investment decision
 */

import { calculateStudy as runFullModel } from '../core/engine.js';
import { aiConnector } from '../services/AIConnector.js'; // Updated: use unified AI service
import { InternalAIGenerator } from '../services/InternalAIGenerator.js';
import { toast } from '../utils/toast.js';

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
                <h2 class="section-title">📋 الملخص التنفيذي</h2>
                
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
        let score = 0;
        const breakdown = {};

        // Financial (40 points) — من runFullModel.indicators (يُمرَّر من render)
        let financialScore = 0;
        const ind = financialResults?.indicators || {};
        if ((ind.npv ?? 0) > 0) financialScore += 20;
        if ((ind.irr ?? 0) > 0.15) financialScore += 10;
        const payback = ind.paybackPeriod ?? ind.payback ?? 999;
        if (payback < 5 && payback >= 0) financialScore += 10;
        if (financialResults == null && Object.keys(ind).length === 0) financialScore = 10; // default عند فشل النموذج
        breakdown.financial = { score: financialScore, max: 40, label: 'المالية' };
        score += financialScore;

        // Market (20 points)
        let marketScore = 0;
        const marketSizing = state.marketSizing || {};
        if (marketSizing.tam?.value > 0) marketScore += 5;
        if (marketSizing.sam?.value > 0) marketScore += 5;
        if (marketSizing.som?.value > 0) marketScore += 5;
        if ((marketSizing.segments || []).length > 0) marketScore += 5;
        breakdown.market = { score: marketScore, max: 20, label: 'السوق' };
        score += marketScore;

        // Risk (20 points)
        let riskScore = 20;
        const risks = state.riskAnalysis?.risks || [];
        const criticalRisks = risks.filter(r => r.probability === 'high' && r.impact === 'high').length;
        riskScore -= criticalRisks * 5;
        if (risks.every(r => r.mitigation)) riskScore = Math.min(20, riskScore + 5);
        breakdown.risk = { score: Math.max(0, riskScore), max: 20, label: 'المخاطر' };
        score += Math.max(0, riskScore);

        // Completeness (20 points)
        let completenessScore = 0;
        const sections = ['projectInfo', 'technical', 'hr', 'marketing', 'revenue', 'assumptions', 'financing'];
        sections.forEach(section => {
            const data = state[section];
            if (data && Object.keys(data).length > 0) {
                completenessScore += Math.floor(20 / sections.length);
            }
        });
        breakdown.completeness = { score: completenessScore, max: 20, label: 'اكتمال البيانات' };
        score += completenessScore;

        return { score: Math.min(100, score), breakdown };
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
                        ${sh.problem ? `<div class="overview-item full-width"><span class="overview-label">المشكلة (الظروف الأولية)</span><p class="overview-value mt-1">${String(sh.problem).replace(/</g, '&lt;')}</p></div>` : ''}
                        ${sh.solution ? `<div class="overview-item full-width"><span class="overview-label">الحل (التجربة / المنتج أو الخدمة)</span><p class="overview-value mt-1">${String(sh.solution).replace(/</g, '&lt;')}</p></div>` : ''}
                        ${sh.insight ? `<div class="overview-item full-width"><span class="overview-label">الاستبصار (لماذا سنربح؟)</span><p class="overview-value mt-1">${String(sh.insight).replace(/</g, '&lt;')}</p></div>` : ''}
                        ${typesList ? `<div class="overview-item full-width"><span class="overview-label">المزايا غير العادلة</span><p class="overview-value mt-1">${String(typesList).replace(/</g, '&lt;')}</p></div>` : ''}
                        ${ua.insightText ? `<div class="overview-item full-width"><span class="overview-label">شرح موجز للاستبصار</span><p class="overview-value mt-1">${String(ua.insightText).replace(/</g, '&lt;')}</p></div>` : ''}
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
                    <span class="overview-value">${projectInfo.name || '(لم يحدد)'}</span>
                </div>
                <div class="overview-item">
                    <span class="overview-label">الموقع</span>
                    <span class="overview-value">${projectInfo.city || ''} - ${projectInfo.district || ''}</span>
                </div>
                <div class="overview-item full-width">
                    <label for="projectOverview" class="overview-label">وصف المشروع</label>
                    <div class="ai-toolbar">
                        <small class="text-muted">يمكنك كتابة الوصف يدوياً أو استخدام الذكاء الاصطناعي:</small>
                        <button type="button" class="btn-xs btn-magic ai-generate-btn" data-target="projectOverview" title="يعمل بدون مفتاح API؛ يمكنك إضافة مفتاح OpenAI لنتائج أوضح">
                            ✨ توليد بالذكاء الاصطناعي
                        </button>
                    </div>
                    <textarea class="input exec-field" data-field="projectOverview" id="projectOverview" rows="4"
                              placeholder="وصف مختصر للمشروع وأهدافه">${execSummary.projectOverview || projectInfo.description || ''}</textarea>
                </div>
                <div class="overview-item full-width">
                    <div class="ai-toolbar flex-between mb-1">
                        <label for="exec-problemStatement">المشكلة التي يحلها المشروع</label>
                        <button type="button" class="btn-xs btn-magic ai-field-btn" data-target="exec-problemStatement" title="ولّد بالذكاء الاصطناعي">✨ ولّد</button>
                    </div>
                    <textarea id="exec-problemStatement" class="input exec-field" data-field="problemStatement" rows="2"
                              placeholder="ما المشكلة أو الحاجة التي يلبيها مشروعك؟">${execSummary.problemStatement || ''}</textarea>
                </div>
                <div class="overview-item full-width">
                    <div class="ai-toolbar flex-between mb-1">
                        <label for="exec-uniqueValue">الميزة التنافسية الفريدة</label>
                        <button type="button" class="btn-xs btn-magic ai-field-btn" data-target="exec-uniqueValue" title="ولّد بالذكاء الاصطناعي">✨ ولّد</button>
                    </div>
                    <textarea id="exec-uniqueValue" class="input exec-field" data-field="uniqueValueProposition" rows="2"
                              placeholder="ما الذي يميز مشروعك عن المنافسين؟">${execSummary.uniqueValueProposition || ''}</textarea>
                </div>
            </div>
        `;
    }

    renderInvestmentHighlights(state, results) {
        const financing = state.financing || {};
        const ind = results?.indicators || {};
        const inv = financing.totalInvestment ?? results?.capex?.total ?? 0;
        const payback = ind.paybackPeriod ?? ind.payback ?? 0;

        const highlights = [
            { label: 'إجمالي الاستثمار', value: this.formatCurrency(inv), icon: '💰' },
            { label: 'صافي القيمة الحالية', value: this.formatCurrency(ind.npv ?? 0), icon: '📈', positive: (ind.npv ?? 0) > 0 },
            { label: 'معدل العائد الداخلي', value: `${((ind.irr ?? 0) * 100).toFixed(1)}%`, icon: '📊' },
            { label: 'فترة الاسترداد', value: `${Number(payback) >= 0 && Number(payback) < 900 ? payback.toFixed(1) : '—'} سنة`, icon: '⏱️' },
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
                        <strong>التحدي:</strong> ${s.challenge}<br>
                        <strong>الحل المقترح:</strong> ${s.solution}
                    </li>
                `).join('')}
            </ul>
        `;
    }

    renderKeyRisks(state) {
        // مرتبط بصفحة «تحليل المخاطر» / مصفوفة المخاطر: state.riskAnalysis.risks
        const raw = state.riskAnalysis?.risks || [];
        const risks = raw
            .filter(r => (r.probability === 'high' || r.impact === 'high') && (r.name || r.description))
            .slice(0, 5);

        if (risks.length === 0) {
            return `<p class="text-muted">لم يتم تحديد مخاطر رئيسية في صفحة <strong>تحليل المخاطر</strong> (مصفوفة المخاطر). أضف مخاطر ذات احتمال أو أثر عالٍ هناك حتى تظهر هنا.</p>`;
        }

        return `
            <div class="risks-list">
                ${risks.map(risk => `
                    <div class="risk-item">
                        <span class="risk-severity ${risk.probability === 'high' && risk.impact === 'high' ? 'critical' : 'high'}">
                            ${risk.probability === 'high' && risk.impact === 'high' ? '🔴' : '🟡'}
                        </span>
                        <span class="risk-name">${risk.name || risk.description || 'خطر غير محدد'}</span>
                        <span class="risk-mitigation">${risk.mitigation || 'لا توجد خطة مواجهة'}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderRecommendation(score, results, state) {
        let recommendation = 'conditional';
        let message = '';
        let actions = [];

        if (score >= 70 && ((results?.indicators?.npv) ?? 0) > 0) {
            recommendation = 'go';
            message = 'المشروع مجدي ويُنصح بالمضي قدماً في التنفيذ';
            actions = ['البدء في إجراءات التأسيس', 'تأمين التمويل', 'بناء الفريق'];
        } else if (score >= 40) {
            recommendation = 'conditional';
            message = 'المشروع يحتاج معالجة بعض النقاط قبل اتخاذ القرار النهائي';
            actions = ['معالجة الفجوات المحددة', 'إعادة النظر في التكاليف', 'استشارة خبراء'];
        } else {
            recommendation = 'nogo';
            message = 'المشروع غير مجدي في شكله الحالي ويحتاج إعادة هيكلة جوهرية';
            actions = ['إعادة دراسة نموذج العمل', 'تقليل التكاليف بشكل كبير', 'البحث عن أسواق بديلة'];
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
        // Local Saudi industry benchmarks
        const benchmarks = {
            restaurants: { name: 'المطاعم', profitMargin: [8, 12], roi: [15, 25], payback: [2, 4] },
            fitness: { name: 'النوادي الرياضية', profitMargin: [15, 20], roi: [20, 35], payback: [2, 3] },
            retail: { name: 'البيع بالتجزئة', profitMargin: [5, 10], roi: [10, 20], payback: [3, 5] },
            services: { name: 'الخدمات المهنية', profitMargin: [20, 30], roi: [30, 50], payback: [1, 2] },
            tech: { name: 'التقنية', profitMargin: [15, 25], roi: [25, 40], payback: [2, 4] }
        };

        const projectMargin = results?.indicators?.profitMargin ?? (results?.revenueProjection?.[0]?.total > 0 ? (results?.incomeStatement?.[0]?.netIncome ?? 0) / results.revenueProjection[0].total : 0);
        const projectROI = results?.indicators?.roi ?? 0;
        const projectPayback = results?.indicators?.paybackPeriod ?? results?.indicators?.payback ?? 0;

        return `
            <div class="benchmarks-container">
                <div class="benchmark-comparison">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>الصناعة</th>
                                <th>هامش الربح</th>
                                <th>العائد على الاستثمار</th>
                                <th>فترة الاسترداد</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr class="project-row">
                                <td><strong>مشروعك</strong></td>
                                <td class="${projectMargin >= 10 ? 'text-success' : 'text-danger'}">${(projectMargin * 100).toFixed(1)}%</td>
                                <td class="${projectROI >= 0.20 ? 'text-success' : 'text-danger'}">${(projectROI * 100).toFixed(0)}%</td>
                                <td class="${projectPayback <= 4 ? 'text-success' : 'text-danger'}">${projectPayback.toFixed(1)} سنة</td>
                            </tr>
                            ${Object.entries(benchmarks).map(([key, b]) => `
                                <tr>
                                    <td>${b.name}</td>
                                    <td>${b.profitMargin[0]}-${b.profitMargin[1]}%</td>
                                    <td>${b.roi[0]}-${b.roi[1]}%</td>
                                    <td>${b.payback[0]}-${b.payback[1]} سنة</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
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

                    // Update UI
                    if (inputEl) {
                        inputEl.value = generatedText;
                        // Trigger change event to save to store
                        inputEl.dispatchEvent(new Event('change'));
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
