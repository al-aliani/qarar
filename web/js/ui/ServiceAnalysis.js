/**
 * Service Analysis Component
 * Provides detailed analysis for each service (Pool, Padel, Gym, etc.)
 * Including individual Break-even, NPV, IRR calculations
 */
import { calculateStudy as runFullModel } from '../core/engine.js';
import { investmentDataWarning, investmentDataWarningHtml, productCatalogWarning } from '../utils/dataQuality.js';
import { stepIndexById } from '../core/wizardSteps.js';
import { escapeHtml } from '../utils/escape.js';

export class ServiceAnalysis {
    constructor(containerId, store, onNavigate) {
        this.container = document.getElementById(containerId);
        this.store = store;
        this.onNavigate = onNavigate;
        this.stepIndex = 11; // Default index for services step (index 13 in app.js actually, need to manage this dynamically or just use onNavigate (+1 / -1))
        // Better to just rely on render passing the index or not needing it if onNavigate handles absolute indices, 
        // but typically onNavigate(newIndex).
        // In app.js: components.serviceAnalysis.render(index); -> render receives the index!
    }

    render(stepIndex) {
        if (typeof stepIndex === 'number') this.stepIndex = stepIndex;
        if (!this.container) return;

        const studyData = this.store.get();

        // دمج مصدرين: services.items (النموذج) + revenue.streams (مصادر الإيرادات)
        const itemsFromForm = studyData.services?.items || [];
        const streams = studyData.revenue?.streams || [];

        const namesInList = new Set(itemsFromForm.map(s => (s.name || '').trim()).filter(Boolean));
        const services = [...itemsFromForm];

        for (const stream of streams) {
            const name = (stream.service || stream.name || '').trim() || 'خدمة';
            if (namesInList.has(name)) continue; // تجنّب التكرار إذا وُجدت نفس الخدمة في النموذج
            namesInList.add(name);

            let g = stream.growthRate;
            if (typeof g === 'number' && g > 1) g = g / 100; // إذا أُدخلت كنسبة مئوية (مثل 7)
            if (typeof g !== 'number' || !Number.isFinite(g)) g = 0.07;

            // نحمل نسبة التكلفة المتغيرة من مصدر الإيراد كي لا يظهر هامش الخدمة 100% وعائد داخلي وهمي.
            // كانت variableCostPerUnit = 0 دائماً فتُحتسب أرباح الخدمة على إيراد شبه صافٍ بلا تكلفة.
            const price = parseFloat(stream.avgPrice || stream.price) || 0;
            const vcRate = (typeof stream.variableCostRate === 'number')
                ? stream.variableCostRate
                : ((stream.type || 'operating') === 'operating' ? 0.30 : 0);
            services.push({
                name,
                icon: '📊',
                capex: 0,
                fixedCosts: 0,
                variableCostPerUnit: Math.round(price * vcRate * 100) / 100,
                pricePerUnit: price,
                customersPerMonth: parseFloat(stream.customersPerMonth) || 0,
                growthRate: g,
                _fromRevenue: true
            });
        }

        const assumptions = studyData.assumptions || {};
        const items = studyData.services?.items || [];

        // C1: توزيع إجمالي الاستثمار والتكاليف الثابتة للمشروع على المنتجات حسب حصة كل منتج
        // من الإيراد السنوي (تكلفة على أساس النشاط تقريبية). بدون هذا التوزيع كان الاستثمار
        // لكل منتج = 0 فينفجر العائد الداخلي (>900%) وتظهر فترة استرداد 0.0 سنة و«صافي ربح»
        // هو في الحقيقة هامش المساهمة. نستخدم أرقام المحرك (المصدر الموحّد) كي تتصالح مجاميع
        // المنتجات مع مؤشرات المشروع بدل أن تناقضها.
        let projectTotals = null;
        let dataWarnHtml = '';
        try {
            const r = runFullModel(studyData);
            projectTotals = { investment: r?.capex?.total || 0, fixedAnnual: r?.opex?.fixedAnnual || 0 };
            dataWarnHtml = investmentDataWarningHtml(investmentDataWarning(studyData, r));
        } catch (_) { projectTotals = null; }
        // تدقيق 2026-07-08 (ملاحظة عالية #23): تنبيه عند عزلة كتالوج مقدمة الجدوى
        // الوصفي (projectInfo.products/introServices) عن هذا الكتالوج المالي.
        dataWarnHtml += investmentDataWarningHtml(productCatalogWarning(studyData));
        const revY1 = (s) => (parseFloat(s.customersPerMonth) || 0) * 12 * (parseFloat(s.pricePerUnit || s.avgPrice) || 0);
        const totalRevY1 = services.reduce((acc, s) => acc + revY1(s), 0);
        const hasAllocation = !!(projectTotals && projectTotals.investment > 0 && totalRevY1 > 0);

        // Calculate analysis for each service
        const analyses = services.map(service => {
            const share = hasAllocation ? revY1(service) / totalRevY1 : 0;
            const allocated = hasAllocation
                ? { capex: projectTotals.investment * share, fixedAnnual: projectTotals.fixedAnnual * share }
                : null;
            return this.analyzeService(service, assumptions, allocated);
        });

        this.container.innerHTML = `
            <h2 class="text-lg slide-up" style="margin-bottom: var(--s-3)">تحليل الخدمات المفصل</h2>
            ${dataWarnHtml}

            <!-- تفاصيل المنتجات/الخدمات — نموذج إضافة -->
            <div class="card analysis-card mb-4">
                <h3 class="text-gold mb-2">تفاصيل المنتجات/الخدمات</h3>
                <p class="text-muted text-sm mb-3">أضف كل خدمة أو منتج تقدمه (وجبة، اشتراك، استشارة، منتج، إلخ) مع السعر وعدد العملاء المتوقع شهرياً.</p>
                <form id="formAddService" class="services-add-form" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap:10px; align-items:end;">
                    <div class="form-group">
                        <label class="text-xs text-muted" for="inpServiceName">اسم الخدمة/المنتج</label>
                        <input type="text" id="inpServiceName" class="input" placeholder="مثال: وجبة غداء" required>
                    </div>
                    <div class="form-group">
                        <label class="text-xs text-muted" for="inpPrice">سعر الوحدة (ر.س)</label>
                        <input type="number" id="inpPrice" class="input" min="0" step="0.01" placeholder="50" required>
                    </div>
                    <div class="form-group">
                        <label class="text-xs text-muted" for="inpCustomers">عملاء/شهر</label>
                        <input type="number" id="inpCustomers" class="input" min="0" step="1" placeholder="100" required>
                    </div>
                    <div class="form-group">
                        <label class="text-xs text-muted" for="inpVarCost">تكلفة متغيرة/وحدة (ر.س)</label>
                        <input type="number" id="inpVarCost" class="input" min="0" step="0.01" value="0" placeholder="0">
                    </div>
                    <div class="form-group">
                        <label class="text-xs text-muted" for="inpFixed">تكاليف ثابتة/شهر (ر.س)</label>
                        <input type="number" id="inpFixed" class="input" min="0" step="0.01" value="0" placeholder="0">
                    </div>
                    <div class="form-group">
                        <label class="text-xs text-muted" for="inpGrowth">نمو سنوي %</label>
                        <input type="number" id="inpGrowth" class="input" min="0" step="0.01" value="7" placeholder="7">
                    </div>
                    <div class="form-group">
                        <button type="submit" class="btn btn--primary">إضافة خدمة</button>
                    </div>
                </form>
                ${items.length > 0 ? `
                <div class="mt-3 pt-3" style="border-top:1px solid var(--c-border);">
                    <div class="text-xs text-muted mb-2">الخدمات المضافة (${items.length}):</div>
                    <div class="flex flex-wrap gap-2">
                        ${items.map((it, i) => `
                            <span class="badge" style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;background:var(--c-bg-app);border-radius:6px;">
                                ${escapeHtml(it.name) || 'بدون اسم'} — ${(it.pricePerUnit||0)} ر.س × ${(it.customersPerMonth||0)}/شهر
                                <button type="button" class="btn-remove-service btn-xs" data-idx="${i}" title="حذف" aria-label="حذف الخدمة">✕</button>
                            </span>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
                <p class="text-xs text-muted mt-3">إن وُلدت لك تدفقات في <strong>مصادر الإيرادات</strong> فستُعرض تلقائياً أدناه. أو <button type="button" class="btn-link-go-revenue btn--text" style="font-size:inherit;">انتقل إلى مصادر الإيرادات ←</button></p>
            </div>
            
            <!-- Service Cards Grid -->
            <div class="services-grid fade-in">
                ${analyses.map(a => this.renderServiceCard(a)).join('')}
            </div>
            ${hasAllocation ? `
            <p class="text-xs text-muted mt-2">وُزِّع إجمالي الاستثمار (${this.formatCurrency(projectTotals.investment)}) والتكاليف الثابتة على المنتجات حسب حصة كل منتج من الإيراد السنوي، لذا تُقرأ مؤشرات العائد الداخلي وفترة الاسترداد لكل منتج على أساس هذه الحصة.</p>
            ` : `
            <p class="text-xs text-muted mt-2">مؤشرات العائد الداخلي/فترة الاسترداد على مستوى المنتج تظهر فقط عند اكتمال بيانات الاستثمار في الدراسة الفنية؛ وإلا يُكتفى بهامش المساهمة وصافي الربح.</p>
            `}

            ${analyses.length > 0 ? `
                <!-- Comparison Table -->
                <div class="card mt-4 fade-in">
                    <h3 class="text-gold">مقارنة الخدمات</h3>
                    ${this.renderComparisonTable(analyses)}
                </div>

                <!-- Ranking -->
                <div class="card mt-4 fade-in">
                    <h3 class="text-gold">ترتيب الخدمات حسب الربحية</h3>
                    ${this.renderRanking(analyses)}
                </div>

                <!-- Charts Container -->
                <div class="card mt-4 fade-in">
                    <h3 class="text-gold">الرسوم البيانية</h3>
                    <div class="charts-row">
                        <div class="chart-container">
                            <canvas id="servicesRevenueChart" height="250"></canvas>
                        </div>
                        <div class="chart-container">
                            <canvas id="servicesProfitChart" height="250"></canvas>
                        </div>
                    </div>
                </div>
            ` : `
                <div class="card mt-4 text-center text-muted">
                    <p>لم تُضف خدمات بعد.</p>
                    <p class="text-sm mt-2">استخدم النموذج أعلاه «تفاصيل المنتجات/الخدمات» لإضافة خدماتك، أو انتقل إلى <strong>مصادر الإيرادات</strong>.</p>
                </div>
            `}
            
            <!-- Navigation -->
            <div class="wizard-nav margin-top-lg">
                <button class="btn btn--secondary btn-prev-step">السابق</button>
                <button class="btn btn--primary btn-next-step">التالي</button>
            </div>
        `;

        // Render charts
        if (analyses.length > 0) {
            this.renderCharts(analyses);
        }

        this.bindEvents();
    }

    bindEvents() {
        // Navigation
        this.container.querySelector('.btn-prev-step')?.addEventListener('click', () => {
            if (this.onNavigate) this.onNavigate(this.stepIndex - 1);
        });
        this.container.querySelector('.btn-next-step')?.addEventListener('click', () => {
            if (this.onNavigate) this.onNavigate(this.stepIndex + 1);
        });

        // إضافة خدمة
        this.container.querySelector('#formAddService')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = (this.container.querySelector('#inpServiceName')?.value || '').trim();
            const pricePerUnit = parseFloat(this.container.querySelector('#inpPrice')?.value) || 0;
            const customersPerMonth = parseFloat(this.container.querySelector('#inpCustomers')?.value) || 0;
            const variableCostPerUnit = parseFloat(this.container.querySelector('#inpVarCost')?.value) || 0;
            const fixedCosts = parseFloat(this.container.querySelector('#inpFixed')?.value) || 0;
            const growthRate = (parseFloat(this.container.querySelector('#inpGrowth')?.value) || 7) / 100;
            if (!name) return;
            const state = this.store.get ? this.store.get() : this.store.getState();
            const svc = state.services || {};
            const items = [...(svc.items || []), { name, icon: '📦', capex: 0, fixedCosts, variableCostPerUnit, pricePerUnit, customersPerMonth, growthRate }];
            this.store.update('services', { ...svc, items });
            this.container.querySelector('#inpServiceName').value = '';
            this.container.querySelector('#inpPrice').value = '';
            this.container.querySelector('#inpCustomers').value = '';
            this.render(this.stepIndex);
        });

        // حذف خدمة
        this.container.querySelectorAll('.btn-remove-service').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.idx, 10);
                if (isNaN(idx)) return;
                const state = this.store.get ? this.store.get() : this.store.getState();
                const svc = state.services || {};
                const items = (svc.items || []).filter((_, i) => i !== idx);
                this.store.update('services', { ...svc, items });
                this.render(this.stepIndex);
            });
        });

        // الانتقال إلى مصادر الإيرادات (بحث بالمعرّف بدل الفهرس الثابت الذي كان منحرفاً)
        this.container.querySelector('.btn-link-go-revenue')?.addEventListener('click', () => {
            const revenueIdx = stepIndexById('revenue');
            if (this.onNavigate && revenueIdx >= 0) this.onNavigate(revenueIdx);
        });
    }

    /**
     * Analyze a single service
     */
    /**
     * Analyze a single service
     */
    analyzeService(service, assumptions, allocated = null) {
        const {
            name = 'خدمة',
            icon = '📊',
            capex = 0,
            fixedCosts = 0,
            variableCostPerUnit = 0,
            pricePerUnit = 0,
            customersPerMonth = 0,
            growthRate = 0.07
        } = service;

        const discountRate = assumptions.discountRate || 0.10;
        // اقتطاع فعلي متسق مع المحرك: زكاة 2.5% على الحصة السعودية + ضريبة على حصة الأجانب
        const foreignShare = Math.min(1, Math.max(0, Number(assumptions.foreignOwnershipRate ?? 0)));
        const taxRate = (0.025 * (1 - foreignShare)) + (Number(assumptions.taxRate ?? 0.20) * foreignShare);
        const years = assumptions.projectionYears || 5;

        // C1: عند توفر توزيع من المحرك نستخدم الحصة المخصّصة (بدل capex/fixedCosts للبند وحده)
        // — لأن إجمالي المحرك يتضمن أصلاً capex/fixed الخدمات، فجمعها ثانيةً يكرّر العدّ.
        const capexEff = allocated ? (allocated.capex || 0) : (Number(capex) || 0);
        const fixedCostsAnnual = allocated ? (allocated.fixedAnnual || 0) : ((Number(fixedCosts) || 0) * 12);

        // Annual calculations
        const customersYear1 = customersPerMonth * 12;
        const revenueYear1 = customersYear1 * pricePerUnit;
        const variableCostsYear1 = customersYear1 * variableCostPerUnit;
        const hasAllocatedInvestment = capexEff > 0;
        const hasAllocatedFixedCosts = fixedCostsAnnual > 0;
        const grossProfitYear1 = revenueYear1 - variableCostsYear1 - fixedCostsAnnual;
        const netProfitYear1 = grossProfitYear1 > 0 ? grossProfitYear1 * (1 - taxRate) : grossProfitYear1;

        // Contribution margin
        const contributionMargin = pricePerUnit - variableCostPerUnit;

        // Break-even (units per month)
        // لا تعرض "0 عميل/شهر" عندما لا تكون التكاليف الثابتة موزعة على المنتج.
        const breakEvenUnits = (contributionMargin > 0 && hasAllocatedFixedCosts)
            ? Math.ceil(fixedCostsAnnual / contributionMargin / 12)
            : null;

        // Break-even revenue
        const breakEvenRevenue = Number.isFinite(breakEvenUnits)
            ? breakEvenUnits * pricePerUnit * 12
            : null;

        // Cash flows for NPV/IRR
        const cashFlows = hasAllocatedInvestment ? [{ year: 0, cashFlow: -capexEff }] : [];
        if (hasAllocatedInvestment) {
            for (let y = 1; y <= years; y++) {
                const growthFactor = Math.pow(1 + growthRate, y - 1);
                const customers = customersYear1 * growthFactor;
                const revenue = customers * pricePerUnit;
                const varCosts = customers * variableCostPerUnit;
                const profit = (revenue - varCosts - fixedCostsAnnual) * (1 - taxRate);
                cashFlows.push({ year: y, cashFlow: profit });
            }
        }

        // NPV
        const npv = hasAllocatedInvestment ? this.calculateNPV(cashFlows, discountRate) : null;

        // IRR لا يكون ذا معنى بدون استثمار مخصص للمنتج.
        const irr = hasAllocatedInvestment ? this.calculateIRR(cashFlows) : null;

        // Payback period
        const paybackPeriod = hasAllocatedInvestment ? this.calculatePayback(cashFlows) : null;

        // ROI
        const roi = hasAllocatedInvestment ? (netProfitYear1 / capexEff) : null;

        // Profit margin
        const profitMargin = revenueYear1 > 0 ? netProfitYear1 / revenueYear1 : 0;

        // Status
        const unitEconomicsPositive = revenueYear1 > 0 && contributionMargin > 0 && profitMargin > 0;
        const isViable = hasAllocatedInvestment
            ? (npv > 0 && (irr === null || irr > discountRate))
            : unitEconomicsPositive;

        return {
            ...service,
            name,
            icon,
            revenueYear1,
            grossProfitYear1,
            netProfitYear1,
            breakEvenUnits,
            breakEvenRevenue,
            contributionMargin,
            npv,
            irr,
            paybackPeriod,
            roi,
            profitMargin,
            isViable,
            hasAllocatedInvestment,
            hasAllocatedFixedCosts,
            unitEconomicsPositive,
            cashFlows
        };
    }

    /**
     * Calculate NPV
     */
    calculateNPV(cashFlows, discountRate) {
        return cashFlows.reduce((npv, cf) => {
            return npv + cf.cashFlow / Math.pow(1 + discountRate, cf.year);
        }, 0);
    }

    /**
     * Calculate IRR using Newton-Raphson
     */
    calculateIRR(cashFlows, maxIter = 100, tolerance = 0.0001) {
        let rate = 0.1;

        // Check if all positive or all negative (no IRR)
        const hasPositive = cashFlows.some(cf => cf.cashFlow > 0);
        const hasNegative = cashFlows.some(cf => cf.cashFlow < 0);
        if (!hasPositive || !hasNegative) return null;

        for (let i = 0; i < maxIter; i++) {
            let npv = 0, derivative = 0;
            cashFlows.forEach(cf => {
                const den = Math.pow(1 + rate, cf.year);
                npv += cf.cashFlow / den;
                derivative -= cf.year * cf.cashFlow / (den * (1 + rate));
            });
            if (Math.abs(npv) < tolerance) return rate;
            if (Math.abs(derivative) < 1e-9) break; // Avoid div by zero
            rate = rate - npv / derivative;
            if (rate <= -1) rate = -0.99; // Lower bound
            if (rate > 100) rate = 100; // Upper bound cap
        }
        return rate; // Return best guess or null? Stick with rate if converged reasonably, else maybe null.
    }

    /**
     * Calculate Payback Period
     */
    calculatePayback(cashFlows) {
        let cumulative = 0;
        // بدون تدفق استثماري سالب لا توجد فترة استرداد ذات معنى.
        if (!Array.isArray(cashFlows) || cashFlows.length === 0 || cashFlows[0].cashFlow >= 0) return null;

        for (let i = 0; i < cashFlows.length; i++) {
            const prevCum = cumulative;
            cumulative += cashFlows[i].cashFlow;

            if (cumulative >= 0) {
                if (i === 0) return 0;
                // Fraction: how much of this year's cashflow was needed to cover the remaining negative balance
                // Remaining negative was 'prevCum' (which is negative).
                // Fraction = -prevCum / thisYearCashFlow
                const fraction = -prevCum / cashFlows[i].cashFlow;
                return (i - 1) + fraction;
            }
        }
        return Infinity;
    }

    metricClass(n) {
        if (!Number.isFinite(n)) return 'text-muted';
        return n >= 0 ? 'text-gold' : 'text-danger';
    }

    formatBreakEvenUnits(n) {
        if (n === Infinity) return '∞';
        if (!Number.isFinite(n)) return 'غير محسوب';
        return n + ' عميل/شهر';
    }

    formatPayback(n) {
        if (n === Infinity) return '∞';
        if (!Number.isFinite(n)) return 'غير محسوب';
        return n.toFixed(1) + ' سنة';
    }

    /**
     * Render a service card
     */
    renderServiceCard(analysis) {
        const statusClass = analysis.isViable ? 'service-viable' : 'service-not-viable';
        const statusText = analysis.hasAllocatedInvestment
            ? (analysis.isViable ? 'مجدي ✅' : 'غير مجدي ⚠️')
            : (analysis.unitEconomicsPositive ? 'هامش إيجابي' : 'يحتاج تسعير/تكلفة');

        return `
            <div class="service-card ${statusClass}">
                <div class="service-header">
                    <span class="service-icon">${analysis.icon}</span>
                    <span class="service-name">${escapeHtml(analysis.name)}</span>
                    <span class="service-status">${statusText}</span>
                </div>
                <div class="service-kpis">
                    <div class="service-kpi">
                        <span class="kpi-label">الإيراد السنوي</span>
                        <span class="kpi-value">${this.formatCurrency(analysis.revenueYear1)}</span>
                    </div>
                    <div class="service-kpi">
                        <span class="kpi-label">${analysis.hasAllocatedFixedCosts ? 'صافي الربح (بعد حصة الثوابت)' : 'مجمل الربح بعد الزكاة (قبل الثوابت)'}</span>
                        <span class="kpi-value ${analysis.netProfitYear1 >= 0 ? 'text-success' : 'text-danger'}"
                              title="${analysis.hasAllocatedFixedCosts ? 'الإيراد − المتغيرة − حصة المنتج من الثوابت − الزكاة التقديرية' : 'قبل توزيع الإيجار والرواتب والثوابت — لا يمثل ربحية نهائية'}">
                            ${this.formatCurrency(analysis.netProfitYear1)}
                        </span>
                    </div>
                    <div class="service-kpi">
                        <span class="kpi-label">صافي القيمة الحالية</span>
                        <span class="kpi-value ${this.metricClass(analysis.npv)}">
                            ${this.formatCurrency(analysis.npv)}
                        </span>
                    </div>
                    <div class="service-kpi">
                        <span class="kpi-label">معدل العائد الداخلي</span>
                        <span class="kpi-value">${this.formatPercent(analysis.irr)}</span>
                    </div>
                    <div class="service-kpi">
                        <span class="kpi-label">نقطة التعادل</span>
                        <span class="kpi-value">${this.formatBreakEvenUnits(analysis.breakEvenUnits)}</span>
                    </div>
                    <div class="service-kpi">
                        <span class="kpi-label">فترة الاسترداد</span>
                        <span class="kpi-value">${this.formatPayback(analysis.paybackPeriod)}</span>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render comparison table
     */
    renderComparisonTable(analyses) {
        return `
            <div class="table-wrapper">
                <table class="service-comparison-table">
                    <thead>
                        <tr>
                            <th>الخدمة</th>
                            <th>الإيراد السنوي</th>
                            <th>صافي الربح</th>
                            <th>صافي القيمة الحالية</th>
                            <th>معدل العائد الداخلي</th>
                            <th>العائد على الاستثمار</th>
                            <th>نقطة التعادل</th>
                            <th>الحالة</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${analyses.map(a => `
                            <tr class="${a.isViable ? '' : 'row-warning'}">
                                <td><span class="service-icon-sm">${a.icon}</span> ${escapeHtml(a.name)}</td>
                                <td class="text-mono">${this.formatCompact(a.revenueYear1)}</td>
                                <td class="text-mono ${a.netProfitYear1 >= 0 ? 'text-success' : 'text-danger'}">${this.formatCompact(a.netProfitYear1)}</td>
                                <td class="text-mono ${this.metricClass(a.npv)}">${this.formatCompact(a.npv)}</td>
                                <td class="text-mono">${this.formatPercent(a.irr)}</td>
                                <td class="text-mono">${this.formatPercent(a.roi)}</td>
                                <td class="text-mono">${this.formatBreakEvenUnits(a.breakEvenUnits)}</td>
                                <td>${a.hasAllocatedInvestment ? (a.isViable ? '✅' : '⚠️') : 'هامش'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    /**
     * Render ranking
     */
    renderRanking(analyses) {
        const rankingScore = (a) => Number.isFinite(a.npv) ? a.npv : a.netProfitYear1;
        const sorted = [...analyses].sort((a, b) => rankingScore(b) - rankingScore(a));

        return `
            <div class="ranking-list">
                ${sorted.map((a, i) => `
                    <div class="ranking-item ${i === 0 ? 'ranking-top' : ''}">
                        <span class="ranking-position">${i + 1}</span>
                        <span class="ranking-icon">${a.icon}</span>
                        <span class="ranking-name">${escapeHtml(a.name)}</span>
                        <span class="ranking-npv ${this.metricClass(rankingScore(a))}">
                            ${Number.isFinite(a.npv) ? 'صافي القيمة الحالية' : 'صافي ربح سنة 1'}: ${this.formatCurrency(rankingScore(a))}
                        </span>
                        ${i === 0 ? '<span class="ranking-badge">🏆 الأعلى ربحية</span>' : ''}
                    </div>
                `).join('')}
            </div>
        `;
    }

    /**
     * Render charts
     */
    renderCharts(analyses) {
        if (typeof Chart === 'undefined') return;

        // Revenue chart
        const revenueCtx = document.getElementById('servicesRevenueChart');
        if (revenueCtx) {
            new Chart(revenueCtx, {
                type: 'bar',
                data: {
                    labels: analyses.map(a => a.name),
                    datasets: [{
                        label: 'الإيراد السنوي',
                        data: analyses.map(a => a.revenueYear1),
                        backgroundColor: 'rgba(138, 95, 28, 0.7)',
                        borderColor: '#8a5f1c',
                        borderWidth: 1
                    }]
                },
                options: this.getChartOptions('الإيرادات السنوية')
            });
        }

        // Profit chart
        const profitCtx = document.getElementById('servicesProfitChart');
        if (profitCtx) {
            new Chart(profitCtx, {
                type: 'bar',
                data: {
                    labels: analyses.map(a => a.name),
                    datasets: [{
                        label: 'صافي الربح',
                        data: analyses.map(a => a.netProfitYear1),
                        backgroundColor: analyses.map(a =>
                            a.netProfitYear1 >= 0 ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.7)'
                        ),
                        borderColor: analyses.map(a =>
                            a.netProfitYear1 >= 0 ? '#22c55e' : '#ef4444'
                        ),
                        borderWidth: 1
                    }]
                },
                options: this.getChartOptions('صافي الربح السنوي')
            });
        }
    }

    getChartOptions(title) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: {
                    display: true,
                    text: title,
                    color: '#8b949e'
                }
            },
            scales: {
                y: {
                    ticks: {
                        color: '#8b949e',
                        callback: (value) => this.formatCompact(value)
                    },
                    grid: { color: '#30363d' }
                },
                x: {
                    ticks: { color: '#8b949e' },
                    grid: { display: false }
                }
            }
        };
    }

    formatCurrency(n) {
        if (!Number.isFinite(n)) return 'غير محسوب';
        return new Intl.NumberFormat('ar-SA', {
            style: 'currency',
            currency: 'SAR',
            maximumFractionDigits: 0
        }).format(n);
    }

    formatCompact(n) {
        if (!Number.isFinite(n)) return 'غير محسوب';
        if (n === 0) return '0';
        if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (Math.abs(n) >= 1000) return (n / 1000).toFixed(0) + 'K';
        return n.toFixed(0);
    }

    formatPercent(n) {
        if (n === null || n === undefined) return 'غير محسوب';
        if (!Number.isFinite(n)) return 'غير محسوب';
        if (n > 9) return '> 900%'; // Cap for display
        return (n * 100).toFixed(1) + '%';
    }
}
