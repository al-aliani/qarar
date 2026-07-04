/**
 * Service Analysis Component
 * Provides detailed analysis for each service (Pool, Padel, Gym, etc.)
 * Including individual Break-even, NPV, IRR calculations
 */

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

            services.push({
                name,
                icon: '📊',
                capex: 0,
                fixedCosts: 0,
                variableCostPerUnit: 0,
                pricePerUnit: parseFloat(stream.avgPrice || stream.price) || 0,
                customersPerMonth: parseFloat(stream.customersPerMonth) || 0,
                growthRate: g,
                _fromRevenue: true
            });
        }

        const assumptions = studyData.assumptions || {};
        const items = studyData.services?.items || [];

        // Calculate analysis for each service
        const analyses = services.map(service => this.analyzeService(service, assumptions));

        this.container.innerHTML = `
            <h2 class="text-lg slide-up" style="margin-bottom: var(--s-3)">تحليل الخدمات المفصل</h2>

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
                                ${it.name || 'بدون اسم'} — ${(it.pricePerUnit||0)} ر.س × ${(it.customersPerMonth||0)}/شهر
                                <button type="button" class="btn-remove-service btn-xs" data-idx="${i}" title="حذف">✕</button>
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

        // الانتقال إلى مصادر الإيرادات (خطوة 13 في STEPS)
        this.container.querySelector('.btn-link-go-revenue')?.addEventListener('click', () => {
            if (this.onNavigate) this.onNavigate(13);
        });
    }

    /**
     * Analyze a single service
     */
    /**
     * Analyze a single service
     */
    analyzeService(service, assumptions) {
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

        // Annual calculations
        const customersYear1 = customersPerMonth * 12;
        const revenueYear1 = customersYear1 * pricePerUnit;
        const variableCostsYear1 = customersYear1 * variableCostPerUnit;
        const fixedCostsAnnual = fixedCosts * 12;
        const grossProfitYear1 = revenueYear1 - variableCostsYear1 - fixedCostsAnnual;
        const netProfitYear1 = grossProfitYear1 > 0 ? grossProfitYear1 * (1 - taxRate) : grossProfitYear1;

        // Contribution margin
        const contributionMargin = pricePerUnit - variableCostPerUnit;

        // Break-even (units per month)
        // If contribution margin is <= 0, we never break even
        const breakEvenUnits = (contributionMargin > 0 && fixedCostsAnnual >= 0)
            ? Math.ceil(fixedCostsAnnual / contributionMargin / 12)
            : Infinity;

        // Break-even revenue
        const breakEvenRevenue = breakEvenUnits !== Infinity
            ? breakEvenUnits * pricePerUnit * 12
            : 0;

        // Cash flows for NPV/IRR
        const cashFlows = [{ year: 0, cashFlow: -capex }];
        for (let y = 1; y <= years; y++) {
            const growthFactor = Math.pow(1 + growthRate, y - 1);
            const customers = customersYear1 * growthFactor;
            const revenue = customers * pricePerUnit;
            const varCosts = customers * variableCostPerUnit;
            const profit = (revenue - varCosts - fixedCostsAnnual) * (1 - taxRate);
            cashFlows.push({ year: y, cashFlow: profit });
        }

        // NPV
        const npv = this.calculateNPV(cashFlows, discountRate);

        // IRR - Only calculate if we have investment (capex > 0) or negative cashflows initially
        let irr = null;
        if (capex > 0) {
            irr = this.calculateIRR(cashFlows);
        } else {
            // No investment? If profit > 0, return is infinite. If profit < 0, return is undefined (-100%?)
            // We'll treat as null (N/A) for consistency or specific indicator
            irr = netProfitYear1 > 0 ? 9.99 : 0; // 999% indicates infinite
        }

        // Payback period
        const paybackPeriod = this.calculatePayback(cashFlows);

        // ROI
        // If capex is 0, ROI is infinite if profit > 0, else 0.
        let roi = 0;
        if (capex > 0) {
            roi = netProfitYear1 / capex;
        } else {
            roi = netProfitYear1 > 0 ? 9.99 : 0;
        }

        // Profit margin
        const profitMargin = revenueYear1 > 0 ? netProfitYear1 / revenueYear1 : 0;

        // Status
        // Viable if NPV > 0 and IRR > Discount Rate (or IRR is Infinite/Good)
        const isViable = npv > 0 && (irr === null || irr > discountRate);

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
        // Check if capex is 0 (Payback is 0)
        if (cashFlows[0].cashFlow >= 0) return 0;

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

    /**
     * Render a service card
     */
    renderServiceCard(analysis) {
        const statusClass = analysis.isViable ? 'service-viable' : 'service-not-viable';
        const statusText = analysis.isViable ? 'مجدي ✅' : 'غير مجدي ⚠️';

        return `
            <div class="service-card ${statusClass}">
                <div class="service-header">
                    <span class="service-icon">${analysis.icon}</span>
                    <span class="service-name">${analysis.name}</span>
                    <span class="service-status">${statusText}</span>
                </div>
                <div class="service-kpis">
                    <div class="service-kpi">
                        <span class="kpi-label">الإيراد السنوي</span>
                        <span class="kpi-value">${this.formatCurrency(analysis.revenueYear1)}</span>
                    </div>
                    <div class="service-kpi">
                        <span class="kpi-label">صافي الربح</span>
                        <span class="kpi-value ${analysis.netProfitYear1 >= 0 ? 'text-success' : 'text-danger'}">
                            ${this.formatCurrency(analysis.netProfitYear1)}
                        </span>
                    </div>
                    <div class="service-kpi">
                        <span class="kpi-label">صافي القيمة الحالية</span>
                        <span class="kpi-value ${analysis.npv >= 0 ? 'text-gold' : 'text-danger'}">
                            ${this.formatCurrency(analysis.npv)}
                        </span>
                    </div>
                    <div class="service-kpi">
                        <span class="kpi-label">معدل العائد الداخلي</span>
                        <span class="kpi-value">${this.formatPercent(analysis.irr)}</span>
                    </div>
                    <div class="service-kpi">
                        <span class="kpi-label">نقطة التعادل</span>
                        <span class="kpi-value">${analysis.breakEvenUnits === Infinity ? '∞' : analysis.breakEvenUnits + ' عميل/شهر'}</span>
                    </div>
                    <div class="service-kpi">
                        <span class="kpi-label">فترة الاسترداد</span>
                        <span class="kpi-value">${analysis.paybackPeriod === Infinity ? '∞' : analysis.paybackPeriod.toFixed(1) + ' سنة'}</span>
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
                                <td><span class="service-icon-sm">${a.icon}</span> ${a.name}</td>
                                <td class="text-mono">${this.formatCompact(a.revenueYear1)}</td>
                                <td class="text-mono ${a.netProfitYear1 >= 0 ? 'text-success' : 'text-danger'}">${this.formatCompact(a.netProfitYear1)}</td>
                                <td class="text-mono ${a.npv >= 0 ? 'text-gold' : 'text-danger'}">${this.formatCompact(a.npv)}</td>
                                <td class="text-mono">${this.formatPercent(a.irr)}</td>
                                <td class="text-mono">${this.formatPercent(a.roi)}</td>
                                <td class="text-mono">${a.breakEvenUnits === Infinity ? '∞' : a.breakEvenUnits}</td>
                                <td>${a.isViable ? '✅' : '⚠️'}</td>
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
        const sorted = [...analyses].sort((a, b) => b.npv - a.npv);

        return `
            <div class="ranking-list">
                ${sorted.map((a, i) => `
                    <div class="ranking-item ${i === 0 ? 'ranking-top' : ''}">
                        <span class="ranking-position">${i + 1}</span>
                        <span class="ranking-icon">${a.icon}</span>
                        <span class="ranking-name">${a.name}</span>
                        <span class="ranking-npv ${a.npv >= 0 ? 'text-gold' : 'text-danger'}">
                            صافي القيمة الحالية: ${this.formatCurrency(a.npv)}
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
                        backgroundColor: 'rgba(212, 175, 55, 0.7)',
                        borderColor: '#d4af37',
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
        if (!Number.isFinite(n)) return '--';
        return new Intl.NumberFormat('ar-SA', {
            style: 'currency',
            currency: 'SAR',
            maximumFractionDigits: 0
        }).format(n);
    }

    formatCompact(n) {
        if (!Number.isFinite(n)) return '--';
        if (n === 0) return '0';
        if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (Math.abs(n) >= 1000) return (n / 1000).toFixed(0) + 'K';
        return n.toFixed(0);
    }

    formatPercent(n) {
        if (n === null || n === undefined) return '--';
        if (!Number.isFinite(n)) return '--';
        if (n > 9) return '> 900%'; // Cap for display
        return (n * 100).toFixed(1) + '%';
    }
}
