/**
 * Financing Structure Component
 * Sources of funding, loan schedule, and WACC calculation
 * Based on UNIDO and Monsha'at requirements
 */

import { calculateStudy as runFullModel, rateOrDefault } from '../core/engine.js';

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

        this.container.innerHTML = `
            <div class="financing-structure">
                <h2 class="section-title">💰 مصادر وهيكلة التمويل</h2>
                
                <!-- Investment Summary -->
                <div class="card analysis-card">
                    <h3 class="card-title">ملخص الاستثمار</h3>
                    <div class="investment-summary">
                        <div class="kpi-card">
                            <div class="kpi-label">
                                إجمالي الاستثمار المطلوب
                                <span class="tooltip-icon" title="${this.getInvestmentTooltip(capexBreakdown)}">ℹ️</span>
                            </div>
                            <div class="kpi-value text-gold">${this.formatCurrency(totalCapex)}</div>
                        </div>
                    </div>
                    <!-- Investment Breakdown -->
                    <div class="investment-breakdown mt-4" style="border-top: 1px solid var(--border-color); padding-top: 1rem;">
                        <details class="breakdown-details">
                            <summary style="cursor: pointer; color: var(--text-muted); font-size: 0.9rem;">
                                📊 تفاصيل الحساب (اضغط للعرض)
                            </summary>
                            <div class="breakdown-content mt-3" style="padding-right: 1rem;">
                                ${this.renderInvestmentBreakdown(capexBreakdown)}
                            </div>
                        </details>
                    </div>
                <h2 class="section-title">💰 هيكل التمويل</h2>
                <div class="alert alert-warning mb-3" style="font-size: 0.85rem;">
                    <strong>رأس المال العامل حاسم</strong> — معظم أزمات السيولة ناتجة عن عدم تقديره. المبلغ اللازم قبل التشغيل (مخزون، رواتب أشهر، بنزين...) يجب أن يُموّل مسبقاً.
                </div>
                <div class="alert alert--info mb-3" style="font-size: 0.85rem;">
                    <strong>قبل الاستقالة:</strong> مصروف بيت 6 أشهر + احتياطي المشروع 6 أشهر. <strong>فترة الدوران:</strong> انتبه لفترة دوران المخزون والذمم — بضاعة تمثل 30 شهر دوران = مشكلة سيولة.
                </div>
                <div class="alert alert-info">
                    إجمالي رأس المال المطلوب (التكاليف الرأسمالية + التكاليف التشغيلية): <strong>${this.formatCurrency(totalCapex)}</strong>
                </div>
                ${capexBreakdown._engineError ? `
                <div class="alert alert--warning">
                    ⚠️ تعذّر حساب المحرك المالي — الرقم أعلاه <strong>تقدير مبدئي محلي</strong> وقد يختلف عن القوائم المالية.
                    أكمل/راجع بيانات الدراسة (الإيرادات، الأصول) ثم أعد فتح هذه الخطوة قبل مطابقة التمويل.
                </div>` : ''}

                <!-- نسب التمويل المقترحة (الفجوة المعيارية) -->
                <div class="card analysis-card">
                    <h3 class="card-title">📋 نسب التمويل المقترحة</h3>
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

                <!-- تفاصيل القرض البنكي: نسبة الفائدة ومدة السداد (ظاهرة دوماً) -->
                <div class="card analysis-card">
                    <h3 class="card-title">تفاصيل القرض البنكي</h3>
                    <p class="text-muted text-sm mb-3">حدّد معدل الفائدة ومدة القرض إنْ وُجد تمويل بنكي. تُستخدم في جدول السداد والمحرك المالي.</p>
                    ${this.renderLoanDetails(financing)}
                    ${this.renderLoanReadinessWarning(state)}
                </div>

                <!-- WACC -->
                <div class="card analysis-card">
                    <h3 class="card-title">تكلفة رأس المال المرجح</h3>
                    ${this.renderWACC(financing, totalCapex)}
                </div>

                <!-- Loan Schedule -->
                <div class="card analysis-card" id="loanScheduleCard" style="${(financing.sources?.bankLoan?.amount || 0) > 0 ? '' : 'display:none'}">
                    <h3 class="card-title">جدول سداد القرض</h3>
                    ${this.renderLoanSchedule(state)}
                </div>

                <!-- Guarantees & DSCR -->
                <div class="card analysis-card">
                    <h3 class="card-title">🛡️ الضمانات وتغطية خدمة الدين</h3>
                    <p class="text-muted text-sm mb-3">البنوك تطلب ضمانات مقابل القرض ونسبة تغطية كافية لخدمة الدين. حدّدها لتقوية ملف التمويل.</p>
                    ${this.renderGuaranteesAndDSCR(financing)}
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
                        <span class="source-icon">🏦</span>
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
                        <span class="source-icon">🏛️</span>
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
                        <span class="source-icon">👥</span>
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
                            <span class="tooltip-icon" title="النسبة من ملكية الشركة التي يحصل عليها المستثمرون مقابل مبلغهم — مختلفة عن نسبة مساهمتهم من إجمالي التمويل">ℹ️</span>
                        </label>
                        <input type="number" id="funding-investors-equity" class="input investor-input" data-field="equityShare"
                               value="${investors.equityShare || 0}" min="0" max="100" step="1">
                        <label for="funding-investors-premoney">التقييم قبل الجولة (ريال)
                            <span class="tooltip-icon" title="قيمة المشروع قبل ضخّ استثمار هذه الجولة — يُحدّد نسبة الملكية العادلة مقابل المبلغ">ℹ️</span>
                        </label>
                        <input type="number" id="funding-investors-premoney" class="input investor-input" data-field="preMoneyValuation"
                               value="${investors.preMoneyValuation || 0}" min="0">
                        <div class="text-xs text-muted mt-1">التقييم بعد الجولة: <strong>${this.formatCurrency((investors.preMoneyValuation || 0) + (investors.amount || 0))}</strong></div>
                    </div>
                </div>

                <!-- Government Support -->
                <div class="funding-source gov-source">
                    <div class="source-header">
                        <span class="source-icon">🇸🇦</span>
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
            ? '<span class="text-success">✓ التمويل مكتمل ويطابق الاستثمار المطلوب</span>'
            : gap > 0
                ? `<span class="text-danger">⚠️ ناقص ${this.formatCurrency(gap)} — أضِف المبلغ أو استخدم زر «سدّ الفجوة»</span>`
                : surplusFixableByEquity
                    ? `<span class="text-danger">⚠️ زائد ${this.formatCurrency(Math.abs(gap))} عن الاستثمار المطلوب — خفّض أحد المصادر أو استخدم زر «سدّ الفجوة»</span>`
                    : `<span class="text-danger">⚠️ زائد ${this.formatCurrency(Math.abs(gap))} عن الاستثمار المطلوب — الفائض ناتج عن القرض/المستثمرين/الدعم الحكومي لا التمويل الذاتي، خفّض أحد هذه المصادر مباشرة</span>`;
        const showAutoBalanceBtn = !isBalanced && (gap > 0 || surplusFixableByEquity);
        return `
            <div class="funding-validation" id="fundingValidation">
                <span class="validation-label">إجمالي التمويل:</span>
                <span class="validation-value" id="totalFunding">${this.formatCurrency(totalFunded)} / ${this.formatCurrency(totalCapex)}</span>
                <span class="validation-status" id="fundingStatus">${statusHtml}</span>
                ${showAutoBalanceBtn ? `<button type="button" class="btn btn--sm btn--secondary" id="btnAutoBalanceFunding" data-gap="${gap}">⚖️ سدّ الفجوة من التمويل الذاتي</button>` : ''}
            </div>
        `;
    }

    getLoanReadinessDiagnostics(state) {
        const financing = state?.financing || {};
        const loan = financing.sources?.bankLoan || {};
        const loanAmount = Number(loan.amount || 0);
        const targetDSCR = Number.isFinite(Number(financing.targetDSCR)) ? Number(financing.targetDSCR) : 1.25;

        if (loanAmount <= 0) {
            return { loanAmount, targetDSCR, alerts: [] };
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

            return { loanAmount, targetDSCR, dscr, fundingGap, fundingGapThreshold, y1Ebitda, alerts };
        } catch (err) {
            return {
                loanAmount,
                targetDSCR,
                dscr: null,
                fundingGap: NaN,
                y1Ebitda: NaN,
                alerts: ['تعذر تشغيل المحرك المالي للتحقق من DSCR. أكمل بيانات الإيرادات والتكاليف ثم أعد فتح خطوة التمويل.']
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
        const title = hasAlerts
            ? 'تحقق ائتماني مطلوب قبل رفع الملف للبنك'
            : 'القرض يبدو قابلاً للمراجعة البنكية مبدئياً';

        return `
            <div class="alert ${hasAlerts ? 'alert-warning' : 'alert-success'} mb-3" data-loan-readiness-warning>
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
                        <span class="tooltip-icon" title="متساوي الأقساط: قسط ثابت شهرياً. متناقص: أصل ثابت وفائدة متناقصة (قسط أعلى بدايةً وأقل فوائد إجمالاً). دفعة أخيرة: فوائد فقط ثم أصل القرض دفعة واحدة عند الاستحقاق">ℹ️</span>
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
                    <span class="tooltip-icon" title="DSCR = صافي التدفق النقدي التشغيلي ÷ أقساط الدين. البنوك تطلب عادة ≥ 1.25 لتضمن قدرة المشروع على السداد">ℹ️</span>
                </label>
                <input type="number" id="financing-targetDSCR" class="input input--sm" style="width:6rem;text-align:center;" value="${targetDSCR}" min="1" max="5" step="0.05">
                ${targetDSCR < 1.25 ? '<span class="text-danger text-sm">⚠️ أقل من الحد الائتماني المعتاد (1.25)</span>' : '<span class="text-success text-sm">✓ ضمن النطاق المقبول للبنوك</span>'}
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
        const wacc = (we * costOfEquity) + (wd * costOfDebt * (1 - taxRate));

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
                            <span class="tooltip-icon" title="العائد الذي يتوقعه المُلّاك على أموالهم — أعلى من الفائدة البنكية لأنه يحمل مخاطر أعلى. 15% افتراض معتاد للمشاريع الصغيرة">ℹ️</span>
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
                <div class="wacc-disclosure alert alert--warning mt-3" style="font-size: 0.85rem;">
                    ⚠️ هذا الرقم إعلامي لمرجعك الشخصي فقط، ولا يُغذّي تلقائياً معدل الخصم الفعلي المستخدم لحساب
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
        
        // Update total capex display if we have it
        const fundingTotalEl = this.container.querySelector('#funding-total-display');
        if (fundingTotalEl) {
            const totalFunded = srcKeys.reduce((sum, k) => sum + Number(financing.sources[k]?.amount || 0), 0);
            fundingTotalEl.textContent = new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(totalFunded);
            
            const reqInvEl = this.container.querySelector('#required-investment-display');
            if (reqInvEl && totalCapex) {
                reqInvEl.textContent = new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(totalCapex);
                if (Math.abs(totalFunded - totalCapex) > 1) {
                    fundingTotalEl.classList.add('text-danger');
                    reqInvEl.classList.add('text-danger');
                } else {
                    fundingTotalEl.classList.remove('text-danger');
                    reqInvEl.classList.remove('text-danger');
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
