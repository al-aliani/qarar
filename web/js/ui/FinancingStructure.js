/**
 * Financing Structure Component
 * Sources of funding, loan schedule, and WACC calculation
 * Based on UNIDO and Monsha'at requirements
 */

import { calculateStudy as runFullModel, rateOrDefault, resolveDecisionThresholds, calculateFinancingWACC } from '../core/engine.js';

// أيقونة من الـsprite الموحّد بدل إيموجي — تدقيق تنظيف 2026-07-11.
const icon = (id) => `<svg class="ic" aria-hidden="true"><use href="#${id}"/></svg>`;

export class FinancingStructure {
    constructor(containerId, store, onNavigate) {
        this.container = document.getElementById(containerId);
        this.store = store;
        this.onNavigate = onNavigate;
        this.stepIndex = 0;
        this.isGenerating = false;
        this.fundingChart = null; // Store chart instance for cleanup
    }

    render(stepIndex) {
        if (typeof stepIndex === 'number') this.stepIndex = stepIndex;
        const state = this.store.getState();
        const financing = state.financing || {};
        const capexBreakdown = this.calculateTotalCapex(state);
        const totalCapex = capexBreakdown.total;

        // ثبّت الإجمالي الموحّد في الحالة كي تعرضه بقية الشاشات (الملخص التنفيذي، التقييم، عرض المستثمر)
        // بنفس رقم المحرك — دون هذا يبقى financing.totalInvestment على قيمة قديمة مختلفة.
        if (financing.totalInvestment !== totalCapex) {
            this.store.update('financing', { ...financing, totalInvestment: totalCapex });
        }

        // تدقيق 2026-07-12: «تفاصيل القرض البنكي» و«الضمانات وتغطية خدمة الدين» كانتا ظاهرتين
        // دوماً بتعليق صريح رغم أنهما بلا معنى بلا قرض — نفس شرط إخفاء بطاقة جدول السداد
        // أدناه (financing.sources.bankLoan.amount > 0)، دون مسح القيم المخزَّنة (تبقى لو
        // رجع المستخدم وأدخل مبلغاً لاحقاً، ويقرأها WACC والدراسات المحفوظة القديمة كما هي).
        const loanAmount = Number(financing.sources?.bankLoan?.amount || 0);

        this.container.innerHTML = `
            <div class="financing-structure">
                <h2 class="section-title">التمويل</h2>
                
                <!-- Investment Summary -->
                <div class="card analysis-card">
                    <h3 class="card-title">ملخص الاستثمار</h3>
                    <div class="investment-summary">
                        <div class="kpi-card">
                            <div class="kpi-label">
                                إجمالي الاستثمار المطلوب
                                <span class="tooltip-icon" title="${this.getInvestmentTooltip(capexBreakdown)}">${icon('i-info')}</span>
                            </div>
                            <div class="kpi-value text-gold">${this.formatCurrency(totalCapex)}</div>
                        </div>
                    </div>
                    <!-- Investment Breakdown -->
                    <div class="investment-breakdown mt-4" style="border-top: 1px solid var(--border-color); padding-top: 1rem;">
                        <details class="breakdown-details">
                            <summary style="cursor: pointer; color: var(--text-muted); font-size: 0.9rem;">
                                ${icon('i-chart')} تفاصيل الحساب (اضغط للعرض)
                            </summary>
                            <div class="breakdown-content mt-3" style="padding-right: 1rem;">
                                ${this.renderInvestmentBreakdown(capexBreakdown)}
                            </div>
                        </details>
                    </div>
                <h2 class="section-title">${icon('i-bank')} هيكل التمويل</h2>
                <div class="alert alert--info mb-3" style="font-size: 0.85rem;">
                    موّل رأس المال العامل (مخزون ورواتب 3–6 أشهر) مسبقاً — نقصه أشهر أسباب أزمات السيولة.
                </div>
                <div class="alert alert-info">
                    إجمالي رأس المال المطلوب (التكاليف الرأسمالية + التكاليف التشغيلية): <strong>${this.formatCurrency(totalCapex)}</strong>
                </div>
                ${capexBreakdown._engineError ? `
                <div class="alert alert--warning">
                    ${icon('i-warning')} تعذّر حساب المحرك المالي — الرقم أعلاه <strong>تقدير مبدئي محلي</strong> وقد يختلف عن القوائم المالية.
                    أكمل/راجع بيانات الدراسة (الإيرادات، الأصول) ثم أعد فتح هذه الخطوة قبل مطابقة التمويل.
                </div>` : ''}

                <!-- نسب التمويل المقترحة (الفجوة المعيارية) -->
                <div class="card analysis-card">
                    <h3 class="card-title">${icon('i-clipboard')} نسب التمويل المقترحة</h3>
                    <p class="text-muted text-sm mb-3">النسب المعيارية لحساب رأس المال المطلوب عند البداية</p>
                    <div class="financing-percentages" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                        <div class="pct-item" style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 8px;">
                            <div style="font-size: 0.85rem; color: var(--text-muted);">نفقات التأسيس</div>
                            <div style="font-weight: bold; color: var(--gold);">100%</div>
                            <div style="font-size: 0.8rem;">تُموّل بالكامل مسبقاً</div>
                        </div>
                        <div class="pct-item" style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 8px;">
                            <div style="font-size: 0.85rem; color: var(--text-muted);">التكاليف الاستثمارية</div>
                            <div style="font-weight: bold; color: var(--gold);">100%</div>
                            <div style="font-size: 0.8rem;">معدات، أثاث، مباني</div>
                        </div>
                        <div class="pct-item" style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 8px;">
                            <div style="font-size: 0.85rem; color: var(--text-muted);">التكاليف التشغيلية</div>
                            <div style="font-weight: bold; color: var(--gold);">25%</div>
                            <div style="font-size: 0.8rem;">أول 3 أشهر عادة (باستثناء الإيجار)</div>
                        </div>
                        <div class="pct-item" style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 8px;">
                            <div style="font-size: 0.85rem; color: var(--text-muted);">الإيجار</div>
                            <div style="font-weight: bold; color: var(--gold);">50%</div>
                            <div style="font-size: 0.8rem;">عادة 6 أشهر مقدماً</div>
                        </div>
                    </div>
                </div>

                <!-- Funding Sources -->
                <div class="card analysis-card">
                    <h3 class="card-title">هيكل التمويل</h3>
                    <p class="text-muted text-sm mb-3"><strong>كم ستدفع من جيبك؟ وكم ستأخذ قرضاً؟</strong> حدّد نسبة التمويل الذاتي والقرض البنكي — النسب تُحسب تلقائياً حسب المبالغ.</p>
                    ${this.renderFundingSources(financing, totalCapex)}
                </div>

                <!-- تفاصيل القرض البنكي: نسبة الفائدة ومدة السداد — تدقيق 2026-07-12: كانت
                ظاهرة دوماً بتعليق صريح رغم أنها بلا معنى بلا قرض؛ الآن نفس شرط إخفاء بطاقة جدول
                السداد أدناه (مبلغ القرض > 0)، بلا مسح القيم المخزَّنة (WACC والدراسات المحفوظة تقرآنها). -->
                <div class="card analysis-card" id="loanDetailsCard" style="${loanAmount > 0 ? '' : 'display:none'}">
                    <h3 class="card-title">تفاصيل القرض البنكي</h3>
                    <p class="text-muted text-sm mb-3">حدّد معدل الفائدة ومدة القرض إنْ وُجد تمويل بنكي. تُستخدم في جدول السداد والمحرك المالي.</p>
                    ${this.renderLoanDetails(financing)}
                    <div id="loanReadinessWarningSlot">${this.renderLoanReadinessWarning(state)}</div>
                </div>

                <!-- WACC -->
                <div class="card analysis-card">
                    <h3 class="card-title">تكلفة رأس المال المرجح</h3>
                    ${this.renderWACC(financing, totalCapex)}
                </div>

                <!-- Financing Scenario Comparison: مقارنة "ماذا-لو" إضافية بحتة — لا تمسّ financing.sources الحية -->
                <div class="card analysis-card" id="scenarioComparisonCard">
                    <h3 class="card-title">${icon('i-chart')} مقارنة سيناريوهات التمويل (ماذا-لو)</h3>
                    <p class="text-muted text-sm mb-3">عرّف هيكل تمويل بديل (بنكي، صندوق تنمية صناعي، حقوق ملكية أعلى...) وقارنه بالوضع الحالي دون تعديل بيانات الدراسة الفعلية.</p>
                    ${this.renderScenarioComparison(state)}
                </div>

                <!-- Loan Schedule -->
                <div class="card analysis-card" id="loanScheduleCard" style="${loanAmount > 0 ? '' : 'display:none'}">
                    <h3 class="card-title">جدول سداد القرض</h3>
                    ${this.renderLoanSchedule(state)}
                </div>

                <!-- Guarantees & DSCR — تدقيق 2026-07-12: نفس شرط الإخفاء عند غياب القرض (الضمانات
                وعتبة DSCR المستهدفة بلا معنى بلا قرض)؛ القيم المخزَّنة تبقى كما هي. -->
                <div class="card analysis-card" id="guaranteesCard" style="${loanAmount > 0 ? '' : 'display:none'}">
                    <h3 class="card-title">${icon('i-shield')} الضمانات وتغطية خدمة الدين</h3>
                    <p class="text-muted text-sm mb-3">البنوك تطلب ضمانات مقابل القرض ونسبة تغطية كافية لخدمة الدين. حدّدها لتقوية ملف التمويل.</p>
                    ${this.renderGuaranteesAndDSCR(financing)}
                </div>

                <!-- Lender Criteria Comparison: جدول مرجعي (بنك/صندوق تنمية/مستثمر ملاك) — ليس قراراً حياً -->
                <div class="card analysis-card" id="lenderCriteriaCard">
                    <h3 class="card-title">${icon('i-scale')} معايير القبول لدى جهات التمويل (مرجعية)</h3>
                    <p class="text-muted text-sm mb-3">مقارنة نموذجية بين بنك تجاري وصندوق التنمية الاجتماعية ومستثمر ملاك (Angel) — إلى جانب أرقام دراستك الفعلية.</p>
                    ${this.renderLenderCriteriaComparison(state)}
                </div>

                <!-- Navigation -->
                <div class="wizard-nav margin-top-lg">
                    <button class="btn btn--secondary btn-prev-step">السابق</button>
                    <button class="btn btn--primary btn-next-step">التالي</button>
                </div>
            </div>
        `;

        this.bindEvents(totalCapex);
        this.renderFundingChart();
    }

    calculateTotalCapex(state) {
        const breakdown = {
            establishment: 0,
            buildings: 0,
            equipment: 0,
            furniture: 0,
            techResources: 0,
            legal: 0,
            marketing: 0,
            subtotal: 0,
            contingency: 0,
            contingencyRate: 0,
            workingCapital: 0,
            workingCapitalMonths: 0,
            monthlyOpex: 0,
            total: 0
        };
        
        // Technical
        const tech = state.technical || {};
        const estCosts = tech.establishmentCosts || [];
        if (Array.isArray(estCosts)) {
            estCosts.forEach(item => { breakdown.establishment += Number(item.amount || 0); });
        }
        ['buildings', 'equipment', 'furniture'].forEach(key => {
            const items = tech[key];
            if (Array.isArray(items)) {
                items.forEach(item => {
                    const amount = ((item.quantity || 1) * (item.price || item.total || 0));
                    breakdown[key] += amount;
                });
            }
        });
        
        // Tech Resources
        const techResources = state.techResources || state.technical?.techResources || [];
        if (Array.isArray(techResources)) {
            techResources.forEach(item => {
                breakdown.techResources += ((item.quantity || 1) * (item.price || item.total || 0));
            });
        }
        
        // Legal
        const legalLicenses = state.legal?.licenses || [];
        if (Array.isArray(legalLicenses)) {
            legalLicenses.forEach(item => {
                breakdown.legal += ((item.quantity || 1) * (item.price || item.total || 0));
            });
        }
        
        // Marketing Capital
        const campaigns = state.marketing?.campaigns || [];
        if (Array.isArray(campaigns)) {
            campaigns.forEach(c => {
                if (c.type === 'capital') breakdown.marketing += (c.amount || 0);
            });
        }
        
        // Equipment contingency 10%
        breakdown.equipment = breakdown.equipment * 1.10;
        // Calculate subtotal
        breakdown.subtotal = breakdown.establishment + breakdown.buildings + breakdown.equipment + breakdown.furniture + 
                            breakdown.techResources + breakdown.legal + breakdown.marketing;
        
        // Contingency
        breakdown.contingencyRate = state.assumptions?.contingencyRate || 0.10;
        breakdown.contingency = breakdown.subtotal * breakdown.contingencyRate;
        
        // Working Capital
        breakdown.workingCapitalMonths = state.assumptions?.workingCapitalMonths || 3;
        breakdown.monthlyOpex = this.calculateMonthlyOpex(state);
        breakdown.workingCapital = breakdown.monthlyOpex * breakdown.workingCapitalMonths;

        // Total (تقدير محلي احتياطي)
        breakdown.total = Math.round(breakdown.subtotal + breakdown.contingency + breakdown.workingCapital);

        // مصدر واحد للحقيقة: «إجمالي الاستثمار» من المحرك (نفس الرقم الذي تُحسب عليه NPV/IRR/DSCR
        // ويعرضه باقي التطبيق). كان هذا المكوّن يحسب رقماً موازياً أصغر فيظهر رقمان مختلفان لنفس التسمية.
        // نجعل رأس المال العامل هو فرق التسوية كي تبقى تفاصيل التقسيم متطابقة مع الإجمالي الموحّد.
        try {
            const eng = runFullModel(state);
            const engTotal = eng?.capex?.total;
            if (Number.isFinite(engTotal) && engTotal > 0) {
                breakdown.total = Math.round(engTotal);
                breakdown.workingCapital = Math.max(0, Math.round(engTotal - breakdown.subtotal - breakdown.contingency));
                breakdown._fromEngine = true;
            }
        } catch (err) {
            // فشل المحرك لا يُبتلع بصمت: كان السقوط الصامت للتقدير المحلي يعرض هنا رقماً
            // مختلفاً عن بقية الشاشات التي تقرأ المحرك (531,800 هنا مقابل 673,195 في القوائم —
            // تدقيق ٢٠٢٦-٠٧-٠٦)، فيطابق المستخدم تمويله على هدف خاطئ دون أن يدري.
            breakdown._engineError = true;
            console.warn('[FinancingStructure] تعذّر المحرك — الرقم المعروض تقدير محلي:', err?.message || err);
        }

        return breakdown;
    }

    calculateMonthlyOpex(state) {
        let monthly = 0;
        
        // HR
        const positions = state.hr?.positions || [];
        if (Array.isArray(positions)) {
            positions.forEach(p => {
                monthly += ((p.count || 1) * (p.salary || 0));
            });
        }
        
        // Logistics
        const logistics = state.logistics || state.logistics?.logistics || [];
        if (Array.isArray(logistics)) {
            logistics.forEach(l => {
                monthly += (l.monthly || 0);
            });
        }
        
        // Administrative
        const administrative = state.administrative || state.administrative?.administrative || [];
        if (Array.isArray(administrative)) {
            administrative.forEach(a => {
                monthly += (a.monthly || 0);
            });
        }
        
        return monthly;
    }

    renderFundingSources(financing, totalCapex) {
        const sources = financing.sources || {};
        const equity = sources.equity || { amount: 0, percentage: 0 };
        const bankLoan = sources.bankLoan || { amount: 0, percentage: 0 };
        const investors = sources.investors || { amount: 0, percentage: 0 };
        const govSupport = sources.governmentSupport || { amount: 0, percentage: 0 };

        return `
            <div class="funding-sources-grid">
                <!-- Equity -->
                <div class="funding-source equity-source">
                    <div class="source-header">
                        <span class="source-icon">${icon('i-bank')}</span>
                        <span class="source-name">التمويل الذاتي</span>
                    </div>
                    <div class="source-inputs">
                        <label for="funding-equity-amount">المبلغ (ريال)</label>
                        <input type="number" id="funding-equity-amount" class="input funding-amount" data-source="equity"
                               value="${equity.amount || 0}">
                        <label for="funding-equity-pct">النسبة %</label>
                        <input type="number" id="funding-equity-pct" class="input funding-percentage" data-source="equity"
                               value="${equity.percentage || 0}" readonly>
                    </div>
                </div>

                <!-- Bank Loan -->
                <div class="funding-source loan-source">
                    <div class="source-header">
                        <span class="source-icon">${icon('i-bank')}</span>
                        <span class="source-name">قرض بنكي</span>
                    </div>
                    <div class="source-inputs">
                        <label for="funding-loan-amount">المبلغ (ريال)</label>
                        <input type="number" id="funding-loan-amount" class="input funding-amount" data-source="bankLoan"
                               value="${bankLoan.amount || 0}">
                        <label for="funding-loan-pct">النسبة %</label>
                        <input type="number" id="funding-loan-pct" class="input funding-percentage" data-source="bankLoan"
                               value="${bankLoan.percentage || 0}" readonly>
                    </div>
                </div>

                <!-- Investors -->
                <div class="funding-source investors-source">
                    <div class="source-header">
                        <span class="source-icon">${icon('i-users')}</span>
                        <span class="source-name">مستثمرون</span>
                    </div>
                    <div class="source-inputs">
                        <label for="funding-investors-amount">المبلغ (ريال)</label>
                        <input type="number" id="funding-investors-amount" class="input funding-amount" data-source="investors"
                               value="${investors.amount || 0}">
                        <label for="funding-investors-pct">النسبة من التمويل %</label>
                        <input type="number" id="funding-investors-pct" class="input funding-percentage" data-source="investors"
                               value="${investors.percentage || 0}" readonly>
                        <label for="funding-investors-equity">حصة الملكية المُتنازل عنها %
                            <span class="tooltip-icon" title="النسبة من ملكية الشركة التي يحصل عليها المستثمرون مقابل مبلغهم — مختلفة عن نسبة مساهمتهم من إجمالي التمويل">${icon('i-info')}</span>
                        </label>
                        <input type="number" id="funding-investors-equity" class="input investor-input" data-field="equityShare"
                               value="${investors.equityShare || 0}" min="0" max="100" step="1">
                        <label for="funding-investors-premoney">التقييم قبل الجولة (ريال)
                            <span class="tooltip-icon" title="قيمة المشروع قبل ضخّ استثمار هذه الجولة — يُحدّد نسبة الملكية العادلة مقابل المبلغ">${icon('i-info')}</span>
                        </label>
                        <input type="number" id="funding-investors-premoney" class="input investor-input" data-field="preMoneyValuation"
                               value="${investors.preMoneyValuation || 0}" min="0">
                        <div class="text-xs text-muted mt-1">التقييم بعد الجولة: <strong class="investor-post-money">${this.formatCurrency((investors.preMoneyValuation || 0) + (investors.amount || 0))}</strong></div>
                    </div>
                </div>

                <!-- Government Support -->
                <div class="funding-source gov-source">
                    <div class="source-header">
                        <span class="source-icon">${icon('i-flag-sa')}</span>
                        <span class="source-name">دعم حكومي</span>
                    </div>
                    <div class="source-inputs">
                        <label for="funding-gov-amount">المبلغ (ريال)</label>
                        <input type="number" id="funding-gov-amount" class="input funding-amount" data-source="governmentSupport"
                               value="${govSupport.amount || 0}">
                        <select id="funding-gov-program" class="input input--sm" data-source="governmentSupport" data-field="program">
                            <option value="">اختر البرنامج</option>
                            <option value="monshaat" ${govSupport.program === 'monshaat' ? 'selected' : ''}>منشآت</option>
                            <option value="kafalah" ${govSupport.program === 'kafalah' ? 'selected' : ''}>كفالة</option>
                            <option value="sidf" ${govSupport.program === 'sidf' ? 'selected' : ''}>الصندوق الصناعي</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- Funding Chart -->
            <div class="funding-chart-container">
                <canvas id="fundingChart" width="300" height="200"></canvas>
            </div>

            <!-- Total Validation -->
            ${this.renderFundingValidation(sources, totalCapex)}
        `;
    }

    /** يحسب إجمالي التمويل الفعلي مقابل المطلوب، ويعرض حالة حقيقية بدل نص ثابت. */
    renderFundingValidation(sources, totalCapex) {
        const totalFunded = ['equity', 'bankLoan', 'investors', 'governmentSupport']
            .reduce((sum, key) => sum + Number(sources[key]?.amount || 0), 0);
        const gap = totalCapex - totalFunded;
        const isBalanced = Math.abs(gap) < 1;
        // تدقيق 2026-07-08 (ملاحظة منخفضة #65): زر «سدّ الفجوة» يعدّل التمويل الذاتي
        // فقط (autoBalanceFunding) — إن كان الفائض ناتجاً عن مصادر أخرى (قرض/مستثمرون/
        // دعم حكومي) تتجاوز الاستثمار المطلوب وحدها، فتصفير التمويل الذاتي لا يحلّ شيئاً
        // ويبقى التحذير ظاهراً بلا تفسير بعد ضغط الزر "المُقترَح". نُميّز الحالة الآن.
        const othersTotal = ['bankLoan', 'investors', 'governmentSupport']
            .reduce((sum, key) => sum + Number(sources[key]?.amount || 0), 0);
        const surplusFixableByEquity = gap >= 0 || othersTotal <= totalCapex;
        const statusHtml = isBalanced
            ? `<span class="text-success">${icon('i-check')} التمويل مكتمل ويطابق الاستثمار المطلوب</span>`
            : gap > 0
                ? `<span class="text-danger">${icon('i-warning')} ناقص ${this.formatCurrency(gap)} — أضِف المبلغ أو استخدم زر «سدّ الفجوة»</span>`
                : surplusFixableByEquity
                    ? `<span class="text-danger">${icon('i-warning')} زائد ${this.formatCurrency(Math.abs(gap))} عن الاستثمار المطلوب — خفّض أحد المصادر أو استخدم زر «سدّ الفجوة»</span>`
                    : `<span class="text-danger">${icon('i-warning')} زائد ${this.formatCurrency(Math.abs(gap))} عن الاستثمار المطلوب — الفائض ناتج عن القرض/المستثمرين/الدعم الحكومي لا التمويل الذاتي، خفّض أحد هذه المصادر مباشرة</span>`;
        const showAutoBalanceBtn = !isBalanced && (gap > 0 || surplusFixableByEquity);
        const sourceRecommendation = gap > 0 ? this.recommendFundingSource(gap, totalCapex) : '';
        return `
            <div class="funding-validation" id="fundingValidation">
                <span class="validation-label">إجمالي التمويل:</span>
                <span class="validation-value" id="totalFunding">${this.formatCurrency(totalFunded)} / ${this.formatCurrency(totalCapex)}</span>
                <span class="validation-status" id="fundingStatus">${statusHtml}</span>
                ${showAutoBalanceBtn ? `<button type="button" class="btn btn--sm btn--secondary" id="btnAutoBalanceFunding" data-gap="${gap}">${icon('i-scale')} سدّ الفجوة من التمويل الذاتي</button>` : ''}
                ${sourceRecommendation}
            </div>
        `;
    }

    /**
     * توصية استرشادية بنوع مصدر التمويل الأنسب لسدّ فجوة بحجم معيّن — لا تُصدّر رقماً
     * نهائياً، فقط تقترح أي أداة تناسب حجم الفجوة نسبةً للاستثمار الكلي (فجوة صغيرة
     * ← تمويل ذاتي واقعي؛ فجوة كبيرة ← تحتاج أداة تمويل خارجية، ليس تعديل حصة الملّاك
     * فقط). مرجع نسبي بسيط، ليس قراراً ائتمانياً.
     */
    recommendFundingSource(gap, totalCapex) {
        if (!(gap > 0) || !(totalCapex > 0)) return '';
        const gapRatio = gap / totalCapex;
        const text = gapRatio <= 0.15
            ? 'الفجوة صغيرة نسبياً — تمويل ذاتي إضافي غالباً كافٍ.'
            : gapRatio <= 0.40
                ? 'الفجوة متوسطة — فكّر في قرض بنكي إضافي أو صندوق التنمية الصناعية/الاجتماعية بدل تحميلها كاملة على التمويل الذاتي.'
                : 'الفجوة كبيرة نسبة للاستثمار الكلي — تحتاج على الأرجح مستثمرين/شريكاً أو تمويلاً حكومياً داعماً، لا تعديل حصة الملّاك فقط.';
        return `<p class="text-xs text-muted funding-source-hint">${icon('i-lightbulb')} ${text}</p>`;
    }

    getLoanReadinessDiagnostics(state) {
        const financing = state?.financing || {};
        const loan = financing.sources?.bankLoan || {};
        const loanAmount = Number(loan.amount || 0);
        // تدقيق 2026-07-12: كان الاحتياطي 1.25 هنا رقماً محلياً مستقلاً عن resolveDecisionThresholds
        // الموحّدة في engine.js — نفس القيمة صدفةً اليوم، لكن أي تعديل مستقبلي على الافتراضي
        // الموحّد كان سيُفلت من هذه الشاشة تحديداً. القيمة الصريحة المُدخَلة (financing.targetDSCR)
        // تبقى لها الأولوية دائماً؛ التغيير فقط في مصدر الاحتياطي.
        const targetDSCR = Number.isFinite(Number(financing.targetDSCR))
            ? Number(financing.targetDSCR)
            : resolveDecisionThresholds(state?.assumptions?.thresholds, financing).targetDSCR;

        if (loanAmount <= 0) {
            return { loanAmount, targetDSCR, alerts: [], severity: 'success' };
        }

        try {
            const results = runFullModel(state);
            const dscr = results?.indicators?.dscr ?? null;
            const fundingGap = Number(results?.financingCheck?.fundingGap ?? 0);
            // مرآة لعتبة مادية الفجوة في engine.js (تدقيق ٢٠٢٦-٠٧-٠٩) — بلا هذا، أي انحراف
            // تقريب عادي بين خطوة التمويل والاستثمار المُعاد حسابه لاحقاً يُظهر تحذيراً حرجاً هنا.
            const fundingGapThreshold = Number(
                results?.financingCheck?.fundingGapMaterialityThreshold
                ?? Math.max(1000, Number(results?.financingCheck?.totalInvestment ?? 0) * 0.01)
            );
            const y1Ebitda = Number(results?.incomeStatement?.[0]?.ebitda ?? NaN);
            const alerts = [];

            if (fundingGap > fundingGapThreshold) {
                alerts.push(`توجد فجوة تمويل ${this.formatCurrency(fundingGap)} قبل احتساب جاهزية القرض.`);
            }
            if (dscr == null) {
                alerts.push('لا يمكن احتساب DSCR حالياً، راجع الإيرادات والتكاليف وجدول القرض.');
            } else if (dscr < targetDSCR) {
                alerts.push(`DSCR الحالي ${Number(dscr).toFixed(2)}x أقل من المستهدف ${targetDSCR.toFixed(2)}x.`);
            }
            if (Number.isFinite(y1Ebitda) && y1Ebitda <= 0) {
                alerts.push('EBITDA السنة الأولى سالب أو صفري؛ هذا مناسب أحياناً لمستثمر تقني لكنه ضعيف للبنك دون إثبات اشتراكات مبكرة أو ضمانات أقوى.');
            }

            // تلوين ثلاثي (تدقيق 2026-07-12): كانت الحالة ثنائية فقط (تحذير أصفر/نجاح أخضر)
            // فتتساوى بصرياً DSCR=1.24 (قريب من الهدف) مع DSCR=0.3 (خطر حقيقي). «حرج» الآن
            // يستهدف تحديداً العجز الكبير أو استحالة الحساب (EBITDA سالبة)، لا أي انحراف بسيط.
            const dscrCritical = dscr == null || dscr < targetDSCR * 0.75;
            const severity = alerts.length === 0 ? 'success' : (dscrCritical ? 'danger' : 'warning');

            return { loanAmount, targetDSCR, dscr, fundingGap, fundingGapThreshold, y1Ebitda, alerts, severity };
        } catch (err) {
            return {
                loanAmount,
                targetDSCR,
                dscr: null,
                fundingGap: NaN,
                y1Ebitda: NaN,
                alerts: ['تعذر تشغيل المحرك المالي للتحقق من DSCR. أكمل بيانات الإيرادات والتكاليف ثم أعد فتح خطوة التمويل.'],
                severity: 'danger'
            };
        }
    }

    renderLoanReadinessWarning(state) {
        const d = this.getLoanReadinessDiagnostics(state);
        if (d.loanAmount <= 0) return '';

        const hasAlerts = d.alerts.length > 0;
        const dscrText = d.dscr == null ? 'غير محسوب' : `${Number(d.dscr).toFixed(2)}x`;
        const gapText = Number.isFinite(d.fundingGap)
            ? (Math.abs(d.fundingGap) <= (d.fundingGapThreshold ?? 1) ? 'متوازن' : this.formatCurrency(d.fundingGap))
            : 'غير محسوبة';
        const ebitdaText = Number.isFinite(d.y1Ebitda) ? this.formatCurrency(d.y1Ebitda) : 'غير متاح';
        const alertClass = { success: 'alert-success', warning: 'alert-warning', danger: 'alert-danger' }[d.severity] || 'alert-warning';
        const title = d.severity === 'success'
            ? 'القرض يبدو قابلاً للمراجعة البنكية مبدئياً'
            : d.severity === 'warning'
                ? 'يحتاج تحسينات طفيفة قبل رفع الملف للبنك'
                : 'تحقق ائتماني مطلوب قبل رفع الملف للبنك';

        return `
            <div class="alert ${alertClass} mb-3" data-loan-readiness-warning data-severity="${d.severity}">
                <strong>${title}</strong>
                <div class="text-sm mt-2">
                    القرض: ${this.formatCurrency(d.loanAmount)} · DSCR: ${dscrText} / المستهدف ${d.targetDSCR.toFixed(2)}x · فجوة التمويل: ${gapText} · EBITDA سنة 1: ${ebitdaText}
                </div>
                ${hasAlerts ? `<ul class="text-sm mt-2" style="margin-bottom:0;">
                    ${d.alerts.map(alert => `<li>${alert}</li>`).join('')}
                    <li>لتحسين الجاهزية: خفف القرض، ارفع التمويل الذاتي/المستثمرين، مدد فترة السماح، أو أضف إثبات مبيعات واشتراكات مبكرة.</li>
                </ul>` : '<div class="text-sm mt-2">استمر في مراجعة الضمانات وجدول السداد قبل التصدير النهائي.</div>'}
            </div>
        `;
    }

    renderLoanDetails(financing) {
        const loan = financing.sources?.bankLoan || {};
        return `
            <div class="loan-details-grid">
                <div class="loan-field">
                    <label for="loan-interestRate">معدل الفائدة السنوي %</label>
                    <!-- تدقيق 2026-07-08 (ملاحظة متوسطة #37): كانت (loan.interestRate || 0.08) تعامل
                    صفراً صريحاً (قرض بنك تنمية 0%) كقيمة مفقودة فتُعيد عرض 8% بعد كل إعادة رسم،
                    رغم أن المحرك نفسه يحترم الصفر الصريح فعلياً (rateOrDefault) — يستهلكها هذا
                    الحقل الآن أيضاً كي لا يتناقض العرض مع الحساب الفعلي. -->
                    <input type="number" id="loan-interestRate" class="input loan-input" data-field="interestRate"
                           value="${rateOrDefault(loan.interestRate, 0.08) * 100}" step="0.5">
                </div>
                <div class="loan-field">
                    <label for="loan-termYears">مدة القرض (سنوات)</label>
                    <input type="number" id="loan-termYears" class="input loan-input" data-field="termYears"
                           value="${loan.termYears || 5}" min="1" max="20">
                </div>
                <div class="loan-field">
                    <label for="loan-graceMonths">فترة السماح (شهور)</label>
                    <input type="number" id="loan-graceMonths" class="input loan-input" data-field="gracePeriodMonths"
                           value="${loan.gracePeriodMonths ?? 0}" min="0" max="24">
                </div>
                <div class="loan-field">
                    <label for="loan-repaymentType">نوع السداد
                        <span class="tooltip-icon" title="متساوي الأقساط: قسط ثابت شهرياً. متناقص: أصل ثابت وفائدة متناقصة (قسط أعلى بدايةً وأقل فوائد إجمالاً). دفعة أخيرة: فوائد فقط ثم أصل القرض دفعة واحدة عند الاستحقاق">${icon('i-info')}</span>
                    </label>
                    <select id="loan-repaymentType" class="input loan-input" data-field="repaymentType">
                        <option value="equal" ${(loan.repaymentType || 'equal') === 'equal' ? 'selected' : ''}>متساوي الأقساط (Amortizing)</option>
                        <option value="declining" ${loan.repaymentType === 'declining' ? 'selected' : ''}>متناقص (أصل ثابت)</option>
                        <option value="bullet" ${loan.repaymentType === 'bullet' ? 'selected' : ''}>دفعة أخيرة (Bullet)</option>
                    </select>
                </div>
                <div class="loan-field">
                    <label for="loan-bank">البنك</label>
                    <!-- تدقيق 2026-07-08 (ملاحظة منخفضة #63): البنك الأهلي وسامبا اندمجا فعلياً منذ
                    2021 ليشكّلا البنك الأهلي السعودي (SNB) — كانا يُعرَضان ككيانين منفصلين.
                    القيمة تبقى 'ncb' توافقاً مع الدراسات المحفوظة سابقاً؛ نطابق 'samba' القديمة
                    أيضاً كي لا تفقد الدراسات القديمة اختيارها المحفوظ بعد هذا التغيير. -->
                    <select id="loan-bank" class="input loan-input" data-field="bank">
                        <option value="">اختر البنك</option>
                        <option value="rajhi" ${loan.bank === 'rajhi' ? 'selected' : ''}>مصرف الراجحي</option>
                        <option value="ncb" ${(loan.bank === 'ncb' || loan.bank === 'samba') ? 'selected' : ''}>البنك الأهلي السعودي (SNB)</option>
                        <option value="riyad" ${loan.bank === 'riyad' ? 'selected' : ''}>بنك الرياض</option>
                        <option value="other" ${loan.bank === 'other' ? 'selected' : ''}>أخرى</option>
                    </select>
                </div>
            </div>
        `;
    }

    renderGuaranteesAndDSCR(financing) {
        const targetDSCR = Number.isFinite(Number(financing.targetDSCR)) ? Number(financing.targetDSCR) : 1.25;
        const guarantees = Array.isArray(financing.guarantees) ? financing.guarantees : [];
        const typeLabels = {
            mortgage: 'رهن عقار/معدات',
            personal: 'كفالة شخصية',
            kafalah: 'كفالة صندوق الكفالة',
            salaryAssignment: 'تحويل راتب',
            other: 'أخرى'
        };
        const rows = guarantees.map((g, i) => `
            <tr>
                <td>
                    <select class="input input--sm guarantee-input" data-index="${i}" data-field="type">
                        ${Object.entries(typeLabels).map(([v, l]) => `<option value="${v}" ${(g.type || 'mortgage') === v ? 'selected' : ''}>${l}</option>`).join('')}
                    </select>
                </td>
                <td><input type="text" class="input input--sm guarantee-input" data-index="${i}" data-field="description" value="${(g.description || '').replace(/"/g, '&quot;')}" placeholder="وصف الضمان"></td>
                <td><input type="number" class="input input--sm guarantee-input" data-index="${i}" data-field="value" value="${g.value || 0}" min="0"></td>
                <td><button type="button" class="btn btn--sm btn--danger guarantee-remove" data-index="${i}">حذف</button></td>
            </tr>
        `).join('');
        return `
            <div class="dscr-field mb-3" style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">
                <label for="financing-targetDSCR" style="font-weight:bold;">نسبة تغطية خدمة الدين المستهدفة (DSCR)
                    <span class="tooltip-icon" title="DSCR = صافي التدفق النقدي التشغيلي ÷ أقساط الدين. البنوك تطلب عادة ≥ 1.25 لتضمن قدرة المشروع على السداد">${icon('i-info')}</span>
                </label>
                <input type="number" id="financing-targetDSCR" class="input input--sm" style="width:6rem;text-align:center;" value="${targetDSCR}" min="1" max="5" step="0.05">
                ${targetDSCR < 1.25 ? `<span class="text-danger text-sm">${icon('i-warning')} أقل من الحد الائتماني المعتاد (1.25)</span>` : `<span class="text-success text-sm">${icon('i-check')} ضمن النطاق المقبول للبنوك</span>`}
            </div>
            <table class="data-table">
                <thead>
                    <tr><th>نوع الضمان</th><th>الوصف</th><th>القيمة (ريال)</th><th></th></tr>
                </thead>
                <tbody id="guaranteesBody">
                    ${rows || '<tr><td colspan="4" class="text-muted text-center">لا ضمانات مضافة بعد</td></tr>'}
                </tbody>
            </table>
            <button type="button" class="btn btn--sm btn--secondary mt-2" id="btnAddGuarantee">+ إضافة ضمان</button>
        `;
    }

    /**
     * يحسب WACC/NPV/IRR/DSCR سنة 1 لهيكل تمويل بديل بلا أي تعديل على state.financing.sources
     * الحيّة — يستنسخ الحالة محلياً فقط لتشغيل المحرك عليها. sourcesOverride=null يعني «الوضع
     * الحالي كما هو» (تُستخدم نفس الحالة الحية دون استنساخ).
     * @param {object} state
     * @param {{equity:{amount:number}, bankLoan:{amount:number, interestRate:number, termYears:number}}|null} sourcesOverride
     */
    computeScenarioMetrics(state, sourcesOverride) {
        let studyForCalc = state;
        if (sourcesOverride) {
            const liveSources = state.financing?.sources || {};
            studyForCalc = {
                ...state,
                financing: {
                    ...(state.financing || {}),
                    sources: {
                        ...liveSources,
                        equity: { ...(liveSources.equity || {}), amount: Number(sourcesOverride.equity?.amount || 0) },
                        bankLoan: {
                            ...(liveSources.bankLoan || {}),
                            amount: Number(sourcesOverride.bankLoan?.amount || 0),
                            interestRate: Number.isFinite(Number(sourcesOverride.bankLoan?.interestRate))
                                ? Number(sourcesOverride.bankLoan.interestRate)
                                : rateOrDefault(liveSources.bankLoan?.interestRate, 0.08),
                            termYears: Number(sourcesOverride.bankLoan?.termYears || liveSources.bankLoan?.termYears || 5)
                        }
                    }
                }
            };
        }

        let wacc = null, npv = null, irr = null, dscr = null;
        try { wacc = calculateFinancingWACC(studyForCalc); } catch (_) { wacc = null; }
        try {
            const results = runFullModel(studyForCalc);
            npv = results?.indicators?.npv ?? null;
            irr = results?.indicators?.irr ?? null;
            dscr = results?.indicators?.dscr ?? null;
        } catch (_) { /* تبقى null — الجدول يعرض "غير متاح" */ }

        return { wacc, npv, irr, dscr };
    }

    renderScenarioComparison(state) {
        const financing = state.financing || {};
        const scenarios = Array.isArray(financing.comparisonScenarios) ? financing.comparisonScenarios : [];

        const fmtPct = (v) => Number.isFinite(v) ? `${(v * 100).toFixed(2)}%` : 'غير متاح';
        const fmtDscr = (v) => Number.isFinite(v) ? `${v.toFixed(2)}x` : 'غير متاح';

        const liveRow = { label: 'الوضع الحالي (المُدخل فعلياً)', metrics: this.computeScenarioMetrics(state, null), isLive: true };
        const scenarioRows = scenarios.map((sc, i) => ({
            label: sc.label,
            metrics: this.computeScenarioMetrics(state, sc.sources),
            index: i
        }));

        const rowHtml = (r) => `
            <tr>
                <td>${r.label}</td>
                <td>${fmtPct(r.metrics.wacc)}</td>
                <td>${this.formatCurrency(r.metrics.npv)}</td>
                <td>${fmtPct(r.metrics.irr)}</td>
                <td>${fmtDscr(r.metrics.dscr)}</td>
                <td>${r.isLive ? '' : `<button type="button" class="btn btn--sm btn--danger scenario-remove" data-index="${r.index}">حذف</button>`}</td>
            </tr>
        `;

        return `
            <table class="data-table">
                <thead>
                    <tr><th>السيناريو</th><th>WACC</th><th>NPV</th><th>IRR</th><th>DSCR سنة 1</th><th></th></tr>
                </thead>
                <tbody>
                    ${rowHtml(liveRow)}
                    ${scenarioRows.map(rowHtml).join('')}
                </tbody>
            </table>
            <div class="scenario-add-form mt-3" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:0.75rem;align-items:end;">
                <div>
                    <label for="scenario-label">اسم السيناريو</label>
                    <input type="text" id="scenario-label" class="input input--sm" placeholder="مثال: بنكي">
                </div>
                <div>
                    <label for="scenario-equity">التمويل الذاتي (ريال)</label>
                    <input type="number" id="scenario-equity" class="input input--sm" min="0" value="0">
                </div>
                <div>
                    <label for="scenario-loan-amount">القرض البنكي (ريال)</label>
                    <input type="number" id="scenario-loan-amount" class="input input--sm" min="0" value="0">
                </div>
                <div>
                    <label for="scenario-loan-rate">فائدة القرض %</label>
                    <input type="number" id="scenario-loan-rate" class="input input--sm" min="0" step="0.5" value="8">
                </div>
                <div>
                    <label for="scenario-loan-term">مدة القرض (سنوات)</label>
                    <input type="number" id="scenario-loan-term" class="input input--sm" min="1" max="20" value="5">
                </div>
                <div>
                    <button type="button" class="btn btn--sm btn--secondary" id="btnAddScenario">+ إضافة سيناريو للمقارنة</button>
                </div>
            </div>
        `;
    }

    addComparisonScenario() {
        const label = (this.container.querySelector('#scenario-label')?.value || '').trim();
        if (!label) return;
        const equityAmount = parseFloat(this.container.querySelector('#scenario-equity')?.value) || 0;
        const loanAmount = parseFloat(this.container.querySelector('#scenario-loan-amount')?.value) || 0;
        const loanRatePct = parseFloat(this.container.querySelector('#scenario-loan-rate')?.value);
        const loanTermYears = parseInt(this.container.querySelector('#scenario-loan-term')?.value, 10) || 5;

        const state = this.store.getState();
        const financing = { ...(state.financing || {}) };
        const scenarios = Array.isArray(financing.comparisonScenarios) ? [...financing.comparisonScenarios] : [];
        scenarios.push({
            label,
            sources: {
                equity: { amount: equityAmount },
                bankLoan: {
                    amount: loanAmount,
                    interestRate: Number.isFinite(loanRatePct) ? loanRatePct / 100 : 0.08,
                    termYears: loanTermYears
                }
            }
        });
        financing.comparisonScenarios = scenarios;
        this.store.update('financing', financing);
        this.render();
    }

    removeComparisonScenario(index) {
        const state = this.store.getState();
        const financing = { ...(state.financing || {}) };
        const scenarios = Array.isArray(financing.comparisonScenarios) ? [...financing.comparisonScenarios] : [];
        scenarios.splice(index, 1);
        financing.comparisonScenarios = scenarios;
        this.store.update('financing', financing);
        this.render();
    }

    /**
     * جدول مرجعي (بنك تجاري نموذجي / صندوق التنمية الاجتماعية / مستثمر ملاك) مقابل أرقام
     * الدراسة الفعلية — تقديري وليس قرار إقراض حقيقي من أي جهة (يختلف فعلياً حسب سياسة كل جهة).
     */
    renderLenderCriteriaComparison(state) {
        const financing = state.financing || {};
        const loanAmount = Number(financing.sources?.bankLoan?.amount || 0);
        const guarantees = Array.isArray(financing.guarantees) ? financing.guarantees : [];
        const guaranteesValue = guarantees.reduce((sum, g) => sum + (Number(g?.value) || 0), 0);

        let dscr = null, npv = null, irr = null;
        try {
            const results = runFullModel(state);
            dscr = results?.indicators?.dscr ?? null;
            npv = results?.indicators?.npv ?? null;
            irr = results?.indicators?.irr ?? null;
        } catch (_) { /* تبقى null — الجدول يعرض "غير متاح" */ }

        const BANK_MIN_DSCR = 1.25;
        const ANGEL_MIN_IRR = 0.25;

        const bankDscrOk = loanAmount > 0 && dscr != null ? dscr >= BANK_MIN_DSCR : null;
        const bankCollateralOk = loanAmount > 0 ? guaranteesValue >= loanAmount : null;
        const angelReturnOk = (npv != null && irr != null) ? (npv > 0 && irr >= ANGEL_MIN_IRR) : null;

        const yesNo = (b) => b == null
            ? '<span class="text-muted">لا ينطبق</span>'
            : (b ? `<span class="text-success">${icon('i-check')} يحقّقه</span>` : `<span class="text-danger">${icon('i-warning')} لا يحقّقه</span>`);
        const fmtPct = (v) => Number.isFinite(v) ? `${(v * 100).toFixed(1)}%` : 'غير متاح';
        const fmtDscr = (v) => Number.isFinite(v) ? `${v.toFixed(2)}x` : 'غير متاح';

        return `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>المعيار</th>
                        <th>بنك تجاري (نموذجي)</th>
                        <th>صندوق التنمية الاجتماعية (SDB)</th>
                        <th>مستثمر ملاك (Angel)</th>
                        <th>رقم دراستك</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>تغطية خدمة الدين (DSCR)</td>
                        <td>≥ ${BANK_MIN_DSCR.toFixed(2)}x — ${yesNo(bankDscrOk)}</td>
                        <td>قواعد أهلية مختلفة (راجع محاكي بنك التنمية بالأسفل)</td>
                        <td>لا يُشترط عادة (يُستبدل بعائد المشروع)</td>
                        <td>${fmtDscr(dscr)}</td>
                    </tr>
                    <tr>
                        <td>الضمانات/الرهن</td>
                        <td>عادة مطلوبة بتغطية كاملة تقريباً — ${yesNo(bankCollateralOk)}</td>
                        <td>حسب المنتج، غالباً أخف من البنك التجاري</td>
                        <td>غير مطلوبة عادة (مقابلها حصة ملكية)</td>
                        <td>${this.formatCurrency(guaranteesValue)}</td>
                    </tr>
                    <tr>
                        <td>عتبة العائد/الجدوى</td>
                        <td>يهتم بالتغطية والسداد لا بالعائد المرتفع</td>
                        <td>نفس اهتمام البنك (تغطية وسداد)</td>
                        <td>عادة IRR ≥ ${(ANGEL_MIN_IRR * 100).toFixed(0)}% وNPV موجب — ${yesNo(angelReturnOk)}</td>
                        <td>NPV: ${this.formatCurrency(npv || 0)} · IRR: ${fmtPct(irr)}</td>
                    </tr>
                </tbody>
            </table>
            <p class="text-xs text-muted mt-2">جدول مرجعي تقديري لمقارنة معايير شائعة — ليس قراراً حقيقياً من أي جهة تمويل، ويختلف فعلياً حسب سياسة كل جهة وملفك الائتماني.</p>
        `;
    }

    renderWACC(financing, totalCapex) {
        const sources = financing.sources || {};
        const equity = sources.equity?.amount || 0;
        const debt = sources.bankLoan?.amount || 0;
        // تكلفة حقوق الملكية قابلة للإدخال (financing.costOfEquity) مع 15% كافتراض سوقي للمشاريع الصغيرة بالسوق السعودي
        const costOfEquity = Number.isFinite(Number(financing.costOfEquity)) ? Number(financing.costOfEquity) : 0.15;
        const costOfDebt = rateOrDefault(sources.bankLoan?.interestRate, 0.08);
        // الدرع الضريبي للدين: بنظام الزكاة السعودي الاقتطاع الفعلي على الربح =
        // زكاة 2.5% × الحصة السعودية + ضريبة دخل × الحصة الأجنبية (متسق مع المحرك)
        const _a = this.store?.getState?.()?.assumptions || {};
        const _fs = Math.min(1, Math.max(0, Number(_a.foreignOwnershipRate ?? 0)));
        const taxRate = (0.025 * (1 - _fs)) + (Number(_a.taxRate ?? 0.20) * _fs);

        const total = equity + debt || 1;
        const we = equity / total;
        const wd = debt / total;
        const wacc = calculateFinancingWACC({ financing, assumptions: _a }) ?? ((we * costOfEquity) + (wd * costOfDebt * (1 - taxRate)));
        const useWaccAsDiscountRate = Boolean(_a.useWaccAsDiscountRate);

        return `
            <div class="wacc-container">
                <div class="wacc-formula">
                    <code>تكلفة رأس المال المرجح = (حقوق الملكية/القيمة الإجمالية × تكلفة حقوق الملكية) + (الدين/القيمة الإجمالية × تكلفة الدين × (1-الضريبة))</code>
                    <div class="text-xs text-muted mt-2" style="font-family: monospace; direction: ltr; text-align: left;">
                        WACC = (E/V × Re) + (D/V × Rd × (1-T))
                    </div>
                </div>
                <div class="wacc-breakdown">
                    <div class="wacc-item">
                        <span>وزن الملكية (E/V)</span>
                        <span>${(we * 100).toFixed(1)}%</span>
                    </div>
                    <div class="wacc-item">
                        <span>تكلفة الملكية (Re)
                            <span class="tooltip-icon" title="العائد الذي يتوقعه المُلّاك على أموالهم — أعلى من الفائدة البنكية لأنه يحمل مخاطر أعلى. 15% افتراض معتاد للمشاريع الصغيرة">${icon('i-info')}</span>
                        </span>
                        <span><input type="number" id="wacc-costOfEquity" class="input input--sm" style="width:6rem;text-align:center;" value="${(costOfEquity * 100).toFixed(1)}" min="0" max="100" step="0.5">%</span>
                    </div>
                    <div class="wacc-item">
                        <span>وزن الدين (D/V)</span>
                        <span>${(wd * 100).toFixed(1)}%</span>
                    </div>
                    <div class="wacc-item">
                        <span>تكلفة الدين بعد الضريبة</span>
                        <span>${(costOfDebt * (1 - taxRate) * 100).toFixed(2)}%</span>
                    </div>
                </div>
                <div class="wacc-result">
                    <span class="wacc-label">تكلفة رأس المال المرجح</span>
                    <span class="wacc-value">${(wacc * 100).toFixed(2)}%</span>
                </div>
                <label class="flex items-center gap-2 mt-3 text-sm">
                    <input type="checkbox" id="use-wacc-discount-rate" ${useWaccAsDiscountRate ? 'checked' : ''}>
                    <span>استخدم WACC كمعدل الخصم في حساب NPV/IRR</span>
                </label>
                <div class="wacc-disclosure alert alert--warning mt-3" style="font-size: 0.85rem;">
                    ${icon('i-warning')} هذا الرقم إعلامي لمرجعك الشخصي فقط، ولا يُغذّي تلقائياً معدل الخصم الفعلي المستخدم لحساب
                    صافي القيمة الحالية (NPV) والعائد الداخلي (IRR) في هذه الدراسة — ذلك المعدل يُضبط بشكل منفصل
                    ضمن افتراضات الدراسة/الإعدادات المالية. إن رغبت في اعتماد هذا الرقم، انسخه يدوياً إلى حقل
                    «معدل الخصم» هناك.
                </div>
            </div>
        `;
    }

    renderLoanSchedule(state) {
        const financing = state.financing || {};
        const loan = financing.sources?.bankLoan || {};
        if ((loan.amount || 0) <= 0) return '<p class="text-muted">أدخل مبلغ القرض لعرض الجدول</p>';

        // مصدر حقيقة واحد: نستهلك جدول القرض الذي يحسبه المحرك (نفس الفوائد التي تُحمَّل على
        // قائمة الدخل) بدل حساب محلي موازٍ كان يفترض سماحاً افتراضياً مختلفاً (6 مقابل 0 في
        // المحرك) ويُسقط فوائد فترة السماح من «إجمالي الفوائد».
        let results = null;
        try { results = runFullModel(state); } catch (_) { results = null; }
        const loanSchedule = results?.loanSchedule;
        if (!loanSchedule || !Array.isArray(loanSchedule.annualSummary) || loanSchedule.annualSummary.length === 0) {
            return '<p class="text-muted">تعذّر حساب جدول السداد — تحقّق من بيانات القرض.</p>';
        }

        const repaymentLabel = { equal: 'متساوي الأقساط', declining: 'متناقص (أصل ثابت)', bullet: 'دفعة أخيرة (Bullet)' }[loanSchedule.repaymentType] || 'متساوي الأقساط';

        return `
            <div class="schedule-summary">
                <div class="kpi-card">
                    <div class="kpi-label">نمط السداد</div>
                    <div class="kpi-value" style="font-size:1rem;">${repaymentLabel}</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-label">القسط الشهري ${loanSchedule.repaymentType === 'equal' ? '' : '(بعد السماح، سنة 1)'}</div>
                    <div class="kpi-value">${this.formatCurrency(loanSchedule.monthlyPayment)}</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-label">إجمالي الأقساط</div>
                    <div class="kpi-value">${this.formatCurrency(loanSchedule.totalPayment)}</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-label">إجمالي الفوائد</div>
                    <div class="kpi-value text-danger">${this.formatCurrency(loanSchedule.totalInterest)}</div>
                </div>
            </div>
            <table class="data-table loan-schedule-table">
                <thead>
                    <tr>
                        <th>السنة</th>
                        <th>الأقساط</th>
                        <th>الفوائد</th>
                        <th>الأصل</th>
                        <th>الرصيد الختامي</th>
                    </tr>
                </thead>
                <tbody>
                    ${loanSchedule.annualSummary.map(y => `
                            <tr>
                                <td>السنة ${y.year}</td>
                                <td>${this.formatCurrency(y.totalPayment)}</td>
                                <td class="text-danger">${this.formatCurrency(y.totalInterest)}</td>
                                <td>${this.formatCurrency(y.totalPrincipal)}</td>
                                <td>${this.formatCurrency(y.endingBalance)}</td>
                            </tr>
                        `).join('')}
                </tbody>
            </table>
        `;
    }

    getInvestmentTooltip(breakdown) {
        return `إجمالي الاستثمار = (المباني + المعدات + الأثاث + الموارد التقنية + التراخيص + الحملات الرأسمالية) × (1 + نسبة الطوارئ) + رأس المال العامل`;
    }

    renderInvestmentBreakdown(breakdown) {
        return `
            <div class="breakdown-table" style="font-size: 0.85rem;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tbody>
                        ${breakdown.establishment ? `<tr>
                            <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color);">نفقات التأسيس (دراسات، تراخيص، ديكورات حد أدنى)</td>
                            <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color); text-align: left; font-family: monospace;">${this.formatCurrency(breakdown.establishment)}</td>
                        </tr>` : ''}
                        <tr>
                            <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color);">المباني والإنشاءات</td>
                            <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color); text-align: left; font-family: monospace;">${this.formatCurrency(breakdown.buildings)}</td>
                        </tr>
                        <tr>
                            <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color);">المعدات والأجهزة</td>
                            <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color); text-align: left; font-family: monospace;">${this.formatCurrency(breakdown.equipment)}</td>
                        </tr>
                        <tr>
                            <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color);">الأثاث والتجهيزات</td>
                            <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color); text-align: left; font-family: monospace;">${this.formatCurrency(breakdown.furniture)}</td>
                        </tr>
                        <tr>
                            <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color);">الموارد التقنية</td>
                            <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color); text-align: left; font-family: monospace;">${this.formatCurrency(breakdown.techResources)}</td>
                        </tr>
                        <tr>
                            <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color);">التراخيص والرسوم القانونية</td>
                            <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color); text-align: left; font-family: monospace;">${this.formatCurrency(breakdown.legal)}</td>
                        </tr>
                        <tr>
                            <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color);">الحملات التسويقية (رأسمالية)</td>
                            <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color); text-align: left; font-family: monospace;">${this.formatCurrency(breakdown.marketing)}</td>
                        </tr>
                        <tr style="background: var(--bg-secondary);">
                            <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color); font-weight: bold;">المجموع الفرعي</td>
                            <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color); text-align: left; font-family: monospace; font-weight: bold;">${this.formatCurrency(breakdown.subtotal)}</td>
                        </tr>
                        <tr>
                            <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color);">احتياطي الطوارئ (${(breakdown.contingencyRate * 100).toFixed(0)}%)</td>
                            <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color); text-align: left; font-family: monospace;">${this.formatCurrency(breakdown.contingency)}</td>
                        </tr>
                        <tr>
                            <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color);">رأس المال العامل ${breakdown._fromEngine ? '(شامل إيجار مقدّم ودورة النقد — من النموذج المالي)' : `(${breakdown.workingCapitalMonths} أشهر × ${this.formatCurrency(breakdown.monthlyOpex)}/شهر)`}</td>
                            <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color); text-align: left; font-family: monospace;">${this.formatCurrency(breakdown.workingCapital)}</td>
                        </tr>
                        <tr style="background: var(--bg-secondary); border-top: 2px solid var(--gold);">
                            <td style="padding: 0.75rem; font-weight: bold; font-size: 1rem;">إجمالي الاستثمار المطلوب</td>
                            <td style="padding: 0.75rem; text-align: left; font-family: monospace; font-weight: bold; font-size: 1rem; color: var(--gold);">${this.formatCurrency(breakdown.total)}</td>
                        </tr>
                    </tbody>
                </table>
                <div class="breakdown-formula mt-3" style="padding: 1rem; background: var(--bg-secondary); border-radius: 8px; font-size: 0.85rem; color: var(--text-muted);">
                    <strong>الصيغة:</strong><br>
                    الإجمالي = (المجموع الفرعي × (1 + ${(breakdown.contingencyRate * 100).toFixed(0)}%)) + رأس المال العامل<br>
                    = (${this.formatCurrency(breakdown.subtotal)} × ${(1 + breakdown.contingencyRate).toFixed(2)}) + ${this.formatCurrency(breakdown.workingCapital)}<br>
                    = ${this.formatCurrency(breakdown.subtotal + breakdown.contingency)} + ${this.formatCurrency(breakdown.workingCapital)}<br>
                    = <strong style="color: var(--gold);">${this.formatCurrency(breakdown.total)}</strong>
                </div>
            </div>
        `;
    }

    /**
     * حالة مؤقتة (لا تُكتب للمخزن) تعكس قيم حقول القرض/الفائدة/DSCR المستهدف الحالية في
     * الـDOM حتى لو لم تُحفَظ بعد (قبل blur) — تُستهلك فقط لإعادة حساب تشخيص جاهزية القرض
     * حياً أثناء الكتابة، لا لأي غرض آخر.
     */
    buildLiveFinancingState() {
        const state = this.store.getState();
        const financing = { ...(state.financing || {}) };
        financing.sources = { ...(financing.sources || {}) };
        const bankLoan = { ...(financing.sources.bankLoan || {}) };

        const amountEl = this.container.querySelector('.funding-amount[data-source="bankLoan"]');
        if (amountEl) {
            const v = parseFloat(amountEl.value);
            bankLoan.amount = Number.isFinite(v) ? v : 0;
        }
        const rateEl = this.container.querySelector('#loan-interestRate');
        if (rateEl) {
            const v = parseFloat(rateEl.value);
            if (Number.isFinite(v)) bankLoan.interestRate = v / 100;
        }
        const termEl = this.container.querySelector('#loan-termYears');
        if (termEl) {
            const v = parseInt(termEl.value, 10);
            if (Number.isFinite(v)) bankLoan.termYears = v;
        }
        const graceEl = this.container.querySelector('#loan-graceMonths');
        if (graceEl) {
            const v = parseInt(graceEl.value, 10);
            if (Number.isFinite(v)) bankLoan.gracePeriodMonths = v;
        }
        financing.sources.bankLoan = bankLoan;

        const dscrEl = this.container.querySelector('#financing-targetDSCR');
        if (dscrEl) {
            const v = parseFloat(dscrEl.value);
            if (Number.isFinite(v)) financing.targetDSCR = v;
        }

        return { ...state, financing };
    }

    /** يعيد رسم بلوك تحذير جاهزية القرض فقط (بلا render كاملة) من الحالة المؤقتة الحية. */
    refreshLoanReadinessWarning() {
        const slot = this.container.querySelector('#loanReadinessWarningSlot');
        if (!slot) return;
        const liveState = this.buildLiveFinancingState();
        slot.innerHTML = this.renderLoanReadinessWarning(liveState);

        // تدقيق تحقّق حي 2026-07-12: هذه الدالة كانت تُحدِّث نص التحذير فقط — بطاقتا
        // «تفاصيل القرض البنكي» و«الضمانات وتغطية خدمة الدين» كانتا تُخفيان/تُظهران عند
        // render() الكاملة فقط، فتبقيان مخفيتين للمستخدم لحظة إدخال أول مبلغ قرض حتى
        // يغادر الخطوة ويعود إليها. نبدّل ظهورهما حياً هنا أيضاً بلا أي render كاملة.
        const loanAmount = Number(liveState.financing?.sources?.bankLoan?.amount || 0);
        const loanDetailsCard = this.container.querySelector('#loanDetailsCard');
        const guaranteesCard = this.container.querySelector('#guaranteesCard');
        const loanScheduleCard = this.container.querySelector('#loanScheduleCard');
        if (loanDetailsCard) loanDetailsCard.style.display = loanAmount > 0 ? '' : 'none';
        if (guaranteesCard) guaranteesCard.style.display = loanAmount > 0 ? '' : 'none';
        if (loanScheduleCard) loanScheduleCard.style.display = loanAmount > 0 ? '' : 'none';
    }

    /** مستمع input بخنق 350ms على حقول مبلغ القرض/الفائدة/فترة السماح/مدته وDSCR المستهدف. */
    bindLoanReadinessLiveUpdate() {
        const watched = [
            this.container.querySelector('.funding-amount[data-source="bankLoan"]'),
            this.container.querySelector('#loan-interestRate'),
            this.container.querySelector('#loan-termYears'),
            this.container.querySelector('#loan-graceMonths'),
            this.container.querySelector('#financing-targetDSCR')
        ].filter(Boolean);
        if (!watched.length) return;

        let debounceTimer = null;
        const scheduleRefresh = () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => this.refreshLoanReadinessWarning(), 350);
        };
        watched.forEach(input => input.addEventListener('input', scheduleRefresh));
    }

    formatCurrency(n) {
        return new Intl.NumberFormat('ar-SA', {
            style: 'currency',
            currency: 'SAR',
            maximumFractionDigits: 0
        }).format(n || 0);
    }

    bindEvents(totalCapex) {
        // Navigation
        this.container.querySelector('.btn-prev-step')?.addEventListener('click', () => {
            if (this.onNavigate) this.onNavigate(this.stepIndex - 1);
        });
        this.container.querySelector('.btn-next-step')?.addEventListener('click', () => {
            if (this.onNavigate) this.onNavigate(this.stepIndex + 1);
        });

        // Funding amount changes
        this.container.querySelectorAll('.funding-amount').forEach(input => {
            input.addEventListener('change', (e) => this.updateFundingSource(e, totalCapex));
        });

        // Loan details changes
        this.container.querySelectorAll('.loan-input').forEach(input => {
            input.addEventListener('change', (e) => this.updateLoanDetails(e));
        });

        // تحذير جاهزية القرض حياً أثناء الكتابة — تدقيق 2026-07-12 (الفجوة كانت توقيتاً لا
        // منطقاً: التشخيص نفسه موجود فعلاً في getLoanReadinessDiagnostics، لكنه كان يُرسم فقط
        // عند render() الكاملة؛ updateFundingSource/updateLoanDetails أعلاه يتجنبان render
        // كاملة عمداً (Blur Bug) فيبقى بلوك التحذير على قيمة قديمة طوال الكتابة).
        this.bindLoanReadinessLiveUpdate();

        // Investor equity / valuation changes
        this.container.querySelectorAll('.investor-input').forEach(input => {
            input.addEventListener('change', (e) => this.updateInvestorField(e));
        });

        // Cost of equity (WACC input)
        this.container.querySelector('#wacc-costOfEquity')?.addEventListener('change', (e) => {
            const pct = parseFloat(e.target.value);
            const value = Number.isFinite(pct) ? pct / 100 : 0.15;
            const state = this.store.getState();
            this.store.update('financing', { ...state.financing, costOfEquity: value });
            this.render();
        });

        this.container.querySelector('#use-wacc-discount-rate')?.addEventListener('change', (e) => {
            const state = this.store.getState();
            this.store.update('assumptions', {
                ...(state.assumptions || {}),
                useWaccAsDiscountRate: Boolean(e.target.checked)
            });
            this.render();
        });

        // Target DSCR
        this.container.querySelector('#financing-targetDSCR')?.addEventListener('change', (e) => {
            const v = parseFloat(e.target.value);
            const state = this.store.getState();
            this.store.update('financing', { ...state.financing, targetDSCR: Number.isFinite(v) ? v : 1.25 });
            this.render();
        });

        // Guarantees add / edit / remove
        this.container.querySelector('#btnAddGuarantee')?.addEventListener('click', () => this.addGuarantee());
        this.container.querySelectorAll('.guarantee-input').forEach(input => {
            input.addEventListener('change', (e) => this.updateGuarantee(e));
        });
        this.container.querySelectorAll('.guarantee-remove').forEach(btn => {
            btn.addEventListener('click', (e) => this.removeGuarantee(parseInt(e.target.dataset.index, 10)));
        });

        // Government program change
        this.container.querySelector('[data-field="program"]')?.addEventListener('change', (e) => {
            this.updateGovernmentProgram(e);
        });

        // سدّ فجوة التمويل تلقائياً (يضيف/يخصم الفرق من التمويل الذاتي)
        this.container.querySelector('#btnAutoBalanceFunding')?.addEventListener('click', () => {
            this.autoBalanceFunding(totalCapex);
        });

        // مقارنة سيناريوهات التمويل: إضافة/حذف سيناريو "ماذا-لو"
        this.container.querySelector('#btnAddScenario')?.addEventListener('click', () => this.addComparisonScenario());
        this.container.querySelectorAll('.scenario-remove').forEach(btn => {
            btn.addEventListener('click', (e) => this.removeComparisonScenario(parseInt(e.target.dataset.index, 10)));
        });

        // Render funding chart
        this.renderFundingChart();
    }

    /**
     * نسب المصادر تُحسب من مجموع مصادر التمويل نفسها (فتجمع دائماً إلى 100%) —
     * كانت تُقسم على «الاستثمار المطلوب» فيظهر ذاتي 96% + قرض 64% = 160% (تدقيق ٢٠٢٦-٠٧-٠٦)،
     * وتُحدَّث كل المصادر معاً كي لا تبقى نسب قديمة بجوار نسبة محدثة.
     */
    recalcSourcePercentages(sources) {
        const keys = ['equity', 'bankLoan', 'investors', 'governmentSupport'];
        const totalFunded = keys.reduce((sum, k) => sum + Number(sources[k]?.amount || 0), 0);
        keys.forEach(k => {
            const amount = Number(sources[k]?.amount || 0);
            const pct = totalFunded > 0 ? Math.round((amount / totalFunded) * 1000) / 10 : 0;
            sources[k] = { ...(sources[k] || {}), percentage: pct };
        });
        return sources;
    }

    /** يسدّ الفجوة بين إجمالي التمويل والاستثمار المطلوب بتعديل حصة التمويل الذاتي فقط. */
    autoBalanceFunding(totalCapex) {
        const state = this.store.getState();
        const financing = { ...state.financing };
        financing.sources = { ...(financing.sources || {}) };
        const others = ['bankLoan', 'investors', 'governmentSupport']
            .reduce((sum, key) => sum + Number(financing.sources[key]?.amount || 0), 0);
        const newEquity = Math.max(0, totalCapex - others);
        financing.sources.equity = { ...(financing.sources.equity || {}), amount: newEquity };
        this.recalcSourcePercentages(financing.sources);
        financing.totalInvestment = totalCapex;
        this.store.update('financing', financing);
        this.render();
    }

    updateFundingSource(e, totalCapex) {
        const source = e.target.dataset.source;
        const amount = parseFloat(e.target.value) || 0;

        const state = this.store.getState();
        const financing = { ...state.financing };
        financing.sources = { ...(financing.sources || {}) };
        financing.sources[source] = {
            ...(financing.sources[source] || {}),
            amount
        };
        this.recalcSourcePercentages(financing.sources);
        financing.totalInvestment = totalCapex;

        // Skip global render from store subscription
        this.store.update('financing', financing);

        // Update DOM in-place to avoid losing focus (Blur Bug)
        const srcKeys = ['equity', 'bankLoan', 'investors', 'governmentSupport'];
        srcKeys.forEach(k => {
            const pct = financing.sources[k]?.percentage || 0;
            const input = this.container.querySelector(`.funding-percentage[data-source="${k}"]`);
            if (input) input.value = pct + '%';
        });
        this.renderFundingChart();

        // تحديث ملخّص «إجمالي التمويل / حالة الفجوة» حياً (تدقيق 2026-07-11): الكتلة
        // السابقة كانت تستعلم عن #funding-total-display/#required-investment-display وهما
        // غير مرسومين إطلاقاً (المعروض id=totalFunding داخل #fundingValidation) فلا يتحدّث
        // التحذير بعد تعديل مبلغ مصدر. نعيد بناء بلوك التحقق في مكانه بالمعرّفات الصحيحة.
        if (totalCapex) {
            const validationEl = this.container.querySelector('#fundingValidation');
            if (validationEl) {
                const holder = document.createElement('div');
                holder.innerHTML = this.renderFundingValidation(financing.sources, totalCapex).trim();
                const fresh = holder.firstElementChild;
                if (fresh) {
                    validationEl.replaceWith(fresh);
                    // زر «سدّ الفجوة» أُعيد إنشاؤه ضمن الاستبدال — أعِد ربطه.
                    fresh.querySelector('#btnAutoBalanceFunding')?.addEventListener('click', () => this.autoBalanceFunding(totalCapex));
                }
            }
        }
    }

    /** إعادة رسم مؤجّلة تمنع تكرار الرسم وتُخرج الهدم من دورة حدث الإدخال الجارية. */
    scheduleRender() {
        if (this._renderScheduled) return;
        this._renderScheduled = true;
        const run = () => {
            this._renderScheduled = false;
            this.render();
        };
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(run);
        } else {
            setTimeout(run, 0);
        }
    }

    updateLoanDetails(e) {
        const field = e.target.dataset.field;
        let value = e.target.value;

        if (field === 'interestRate') {
            value = parseFloat(value) / 100;
        } else if (['termYears', 'gracePeriodMonths'].includes(field)) {
            value = parseInt(value) || 0;
        }

        const state = this.store.getState();
        const financing = { ...state.financing };
        financing.sources = financing.sources || {};
        financing.sources.bankLoan = { ...financing.sources.bankLoan, [field]: value };

        this.store.update('financing', financing);
        // Do not full render to avoid losing focus
    }

    updateGovernmentProgram(e) {
        const state = this.store.getState();
        const financing = { ...state.financing };
        financing.sources = financing.sources || {};
        financing.sources.governmentSupport = {
            ...financing.sources.governmentSupport,
            program: e.target.value
        };
        this.store.update('financing', financing);
    }

    /** يحدّث حصة الملكية أو التقييم قبل الجولة للمستثمرين دون المساس بمبلغ/نسبة التمويل. */
    updateInvestorField(e) {
        const field = e.target.dataset.field; // equityShare | preMoneyValuation
        const value = parseFloat(e.target.value) || 0;
        const state = this.store.getState();
        const financing = { ...state.financing };
        financing.sources = { ...(financing.sources || {}) };
        const investors = { ...(financing.sources.investors || {}), [field]: value };
        // التقييم بعد الجولة = التقييم قبلها + مبلغ المستثمرين (مشتق، يُخزَّن للعرض في الشاشات الأخرى)
        investors.postMoneyValuation = (investors.preMoneyValuation || 0) + (investors.amount || 0);
        financing.sources.investors = investors;
        this.store.update('financing', financing);
        
        // Update post-money valuation locally without full render
        const postMoneyEl = this.container.querySelector('.investor-post-money');
        if (postMoneyEl) {
            postMoneyEl.textContent = new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(investors.postMoneyValuation);
        }
    }

    addGuarantee() {
        const state = this.store.getState();
        const financing = { ...state.financing };
        const guarantees = Array.isArray(financing.guarantees) ? [...financing.guarantees] : [];
        guarantees.push({ type: 'mortgage', description: '', value: 0 });
        financing.guarantees = guarantees;
        this.store.update('financing', financing);
        this.render();
    }

    updateGuarantee(e) {
        const index = parseInt(e.target.dataset.index, 10);
        const field = e.target.dataset.field; // type | description | value
        const state = this.store.getState();
        const financing = { ...state.financing };
        const guarantees = Array.isArray(financing.guarantees) ? [...financing.guarantees] : [];
        if (!guarantees[index]) return;
        const raw = e.target.value;
        const value = field === 'value' ? (parseFloat(raw) || 0) : raw;
        guarantees[index] = { ...guarantees[index], [field]: value };
        financing.guarantees = guarantees;
        this.store.update('financing', financing);
        // لا حاجة لإعادة render كاملة عند تعديل حقل نصي/رقمي داخل نفس الجدول إلا لتحديث المشتقات؛ نكتفي بالحفظ.
        if (field === 'type') this.render();
    }

    removeGuarantee(index) {
        const state = this.store.getState();
        const financing = { ...state.financing };
        const guarantees = Array.isArray(financing.guarantees) ? [...financing.guarantees] : [];
        guarantees.splice(index, 1);
        financing.guarantees = guarantees;
        this.store.update('financing', financing);
        this.render();
    }

    renderFundingChart() {
        const canvas = document.getElementById('fundingChart');
        if (!canvas || !window.Chart) return;

        // Destroy existing chart if it exists
        if (this.fundingChart) {
            this.fundingChart.destroy();
            this.fundingChart = null;
        }

        const state = this.store.getState();
        const sources = state.financing?.sources || {};

        // Create new chart and store reference
        this.fundingChart = new Chart(canvas.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['تمويل ذاتي', 'قرض بنكي', 'مستثمرون', 'دعم حكومي'],
                datasets: [{
                    data: [
                        sources.equity?.amount || 0,
                        sources.bankLoan?.amount || 0,
                        sources.investors?.amount || 0,
                        sources.governmentSupport?.amount || 0
                    ],
                    backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#888' }
                    }
                }
            }
        });
    }

    // Cleanup method to destroy chart when component is removed
    destroy() {
        if (this.fundingChart) {
            this.fundingChart.destroy();
            this.fundingChart = null;
        }
    }
}
