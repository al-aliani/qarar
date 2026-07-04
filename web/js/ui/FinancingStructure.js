/**
 * Financing Structure Component
 * Sources of funding, loan schedule, and WACC calculation
 * Based on UNIDO and Monsha'at requirements
 */

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
                </div>

                <!-- WACC -->
                <div class="card analysis-card">
                    <h3 class="card-title">تكلفة رأس المال المرجح</h3>
                    ${this.renderWACC(financing, totalCapex)}
                </div>

                <!-- Loan Schedule -->
                <div class="card analysis-card" id="loanScheduleCard" style="${(financing.sources?.bankLoan?.amount || 0) > 0 ? '' : 'display:none'}">
                    <h3 class="card-title">جدول سداد القرض</h3>
                    ${this.renderLoanSchedule(financing)}
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
        
        // Total
        breakdown.total = Math.round(breakdown.subtotal + breakdown.contingency + breakdown.workingCapital);

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
                        <label for="funding-investors-pct">النسبة %</label>
                        <input type="number" id="funding-investors-pct" class="input funding-percentage" data-source="investors"
                               value="${investors.percentage || 0}" readonly>
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
        const statusHtml = isBalanced
            ? '<span class="text-success">✓ التمويل مكتمل ويطابق الاستثمار المطلوب</span>'
            : gap > 0
                ? `<span class="text-danger">⚠️ ناقص ${this.formatCurrency(gap)} — أضِف المبلغ أو استخدم زر «سدّ الفجوة»</span>`
                : `<span class="text-danger">⚠️ زائد ${this.formatCurrency(Math.abs(gap))} عن الاستثمار المطلوب — خفّض أحد المصادر</span>`;
        return `
            <div class="funding-validation" id="fundingValidation">
                <span class="validation-label">إجمالي التمويل:</span>
                <span class="validation-value" id="totalFunding">${this.formatCurrency(totalFunded)} / ${this.formatCurrency(totalCapex)}</span>
                <span class="validation-status" id="fundingStatus">${statusHtml}</span>
                ${!isBalanced ? `<button type="button" class="btn btn--sm btn--secondary" id="btnAutoBalanceFunding" data-gap="${gap}">⚖️ سدّ الفجوة من التمويل الذاتي</button>` : ''}
            </div>
        `;
    }

    renderLoanDetails(financing) {
        const loan = financing.sources?.bankLoan || {};
        return `
            <div class="loan-details-grid">
                <div class="loan-field">
                    <label for="loan-interestRate">معدل الفائدة السنوي %</label>
                    <input type="number" id="loan-interestRate" class="input loan-input" data-field="interestRate"
                           value="${(loan.interestRate || 0.08) * 100}" step="0.5">
                </div>
                <div class="loan-field">
                    <label for="loan-termYears">مدة القرض (سنوات)</label>
                    <input type="number" id="loan-termYears" class="input loan-input" data-field="termYears"
                           value="${loan.termYears || 5}" min="1" max="20">
                </div>
                <div class="loan-field">
                    <label for="loan-graceMonths">فترة السماح (شهور)</label>
                    <input type="number" id="loan-graceMonths" class="input loan-input" data-field="gracePeriodMonths"
                           value="${loan.gracePeriodMonths || 6}" min="0" max="24">
                </div>
                <div class="loan-field">
                    <label for="loan-bank">البنك</label>
                    <select id="loan-bank" class="input loan-input" data-field="bank">
                        <option value="">اختر البنك</option>
                        <option value="rajhi" ${loan.bank === 'rajhi' ? 'selected' : ''}>مصرف الراجحي</option>
                        <option value="ncb" ${loan.bank === 'ncb' ? 'selected' : ''}>البنك الأهلي</option>
                        <option value="riyad" ${loan.bank === 'riyad' ? 'selected' : ''}>بنك الرياض</option>
                        <option value="samba" ${loan.bank === 'samba' ? 'selected' : ''}>بنك سامبا</option>
                        <option value="other" ${loan.bank === 'other' ? 'selected' : ''}>أخرى</option>
                    </select>
                </div>
            </div>
        `;
    }

    renderWACC(financing, totalCapex) {
        const sources = financing.sources || {};
        const equity = sources.equity?.amount || 0;
        const debt = sources.bankLoan?.amount || 0;
        const costOfEquity = 0.15; // تكلفة حقوق الملكية 15%: افتراض سوقي للمشاريع الصغيرة في السوق السعودي
        const costOfDebt = (sources.bankLoan?.interestRate || 0.08);
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
                        <span>تكلفة الملكية (Re)</span>
                        <span>${(costOfEquity * 100).toFixed(1)}%</span>
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
            </div>
        `;
    }

    renderLoanSchedule(financing) {
        const loan = financing.sources?.bankLoan || {};
        const principal = loan.amount || 0;
        const rate = (loan.interestRate || 0.08) / 12;
        const term = (loan.termYears || 5) * 12;
        const grace = loan.gracePeriodMonths || 6;

        if (principal <= 0) return '<p class="text-muted">أدخل مبلغ القرض لعرض الجدول</p>';

        const monthlyPayment = rate > 0 ?
            (principal * rate * Math.pow(1 + rate, term - grace)) / (Math.pow(1 + rate, term - grace) - 1) :
            principal / (term - grace);

        // Generate first 12 months + yearly summary
        let balance = principal;
        let totalInterest = 0;

        return `
            <div class="schedule-summary">
                <div class="kpi-card">
                    <div class="kpi-label">القسط الشهري</div>
                    <div class="kpi-value">${this.formatCurrency(monthlyPayment)}</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-label">إجمالي الأقساط</div>
                    <div class="kpi-value">${this.formatCurrency(monthlyPayment * (term - grace))}</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-label">إجمالي الفوائد</div>
                    <div class="kpi-value text-danger">${this.formatCurrency(monthlyPayment * (term - grace) - principal)}</div>
                </div>
            </div>
            <table class="data-table loan-schedule-table">
                <thead>
                    <tr>
                        <th>السنة</th>
                        <th>الرصيد الافتتاحي</th>
                        <th>الأقساط</th>
                        <th>الفوائد</th>
                        <th>الأصل</th>
                        <th>الرصيد الختامي</th>
                    </tr>
                </thead>
                <tbody>
                    ${Array.from({ length: loan.termYears || 5 }, (_, year) => {
            const openingBalance = balance;
            let yearlyInterest = 0;
            let yearlyPrincipal = 0;

            for (let month = 0; month < 12; month++) {
                const monthNum = year * 12 + month;
                if (monthNum < grace) continue;

                const interest = balance * rate;
                const principalPayment = monthlyPayment - interest;
                yearlyInterest += interest;
                yearlyPrincipal += principalPayment;
                balance = Math.max(0, balance - principalPayment);
            }

            return `
                            <tr>
                                <td>السنة ${year + 1}</td>
                                <td>${this.formatCurrency(openingBalance)}</td>
                                <td>${year === 0 && grace >= 6 ? this.formatCurrency(monthlyPayment * (12 - Math.min(grace, 12))) : this.formatCurrency(monthlyPayment * 12)}</td>
                                <td class="text-danger">${this.formatCurrency(yearlyInterest)}</td>
                                <td>${this.formatCurrency(yearlyPrincipal)}</td>
                                <td>${this.formatCurrency(balance)}</td>
                            </tr>
                        `;
        }).join('')}
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
                            <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color);">رأس المال العامل (${breakdown.workingCapitalMonths} أشهر × ${this.formatCurrency(breakdown.monthlyOpex)}/شهر)</td>
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

    /** يسدّ الفجوة بين إجمالي التمويل والاستثمار المطلوب بتعديل حصة التمويل الذاتي فقط. */
    autoBalanceFunding(totalCapex) {
        const state = this.store.getState();
        const financing = { ...state.financing };
        financing.sources = { ...(financing.sources || {}) };
        const others = ['bankLoan', 'investors', 'governmentSupport']
            .reduce((sum, key) => sum + Number(financing.sources[key]?.amount || 0), 0);
        const newEquity = Math.max(0, totalCapex - others);
        const percentage = totalCapex > 0 ? Math.round((newEquity / totalCapex) * 1000) / 10 : 0;
        financing.sources.equity = { ...(financing.sources.equity || {}), amount: newEquity, percentage };
        financing.totalInvestment = totalCapex;
        this.store.update('financing', financing);
        this.render();
    }

    updateFundingSource(e, totalCapex) {
        const source = e.target.dataset.source;
        const amount = parseFloat(e.target.value) || 0;
        const percentage = totalCapex > 0 ? (amount / totalCapex) * 100 : 0;

        const state = this.store.getState();
        const financing = { ...state.financing };
        financing.sources = financing.sources || {};
        financing.sources[source] = {
            ...financing.sources[source],
            amount,
            percentage: Math.round(percentage * 10) / 10
        };
        financing.totalInvestment = totalCapex;

        this.store.update('financing', financing);
        this.render();
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
        this.render();
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
