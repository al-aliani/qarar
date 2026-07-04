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
                    <p class="text-muted text-sm mb-3">المتشائم vs الأساسي vs المتفائل</p>
                    ${this.renderScenarioComparison(scenarios, baseResults)}
                </div>

                <!-- Sensitivity Analysis -->
                <div class="card analysis-card">
                    <h3 class="card-title">تحليل الحساسية</h3>
                    <p class="text-muted text-sm mb-3">تأثير تغير المتغيرات الرئيسية على الربحية</p>
                    ${this.renderSensitivityAnalysis(scenarios, baseResults)}
                </div>

                <!-- Break-Even Chart -->
                <div class="card analysis-card">
                    <h3 class="card-title">نقطة التعادل</h3>
                    <p class="text-muted text-sm mb-3">تحليل نقطة التعادل التفاعلي</p>
                    ${this.renderBreakEven(baseResults)}
                </div>

                <!-- Navigation -->
                <div class="wizard-nav margin-top-lg">
                    <button class="btn btn--secondary btn-prev-step">السابق</button>
                    <button class="btn btn--primary btn-next-step">التالي</button>
                </div>
            </div>
        `;

        this.bindEvents();
        this.renderCharts(baseResults);
    }

    renderScenarioComparison(scenarios, baseResults) {
        const pessimistic = scenarios.pessimistic || { revenueChange: -0.20, costChange: 0.15 };
        const base = scenarios.base || { revenueChange: 0, costChange: 0 };
        const optimistic = scenarios.optimistic || { revenueChange: 0.25, costChange: -0.10 };

        // Calculate scenario-adjusted results using the REAL engine
        const getResults = (s) => {
            try {
                // Run full model with scenario parameters
                const res = runFullModel(this.store.getState(), {
                    revenueChange: s.revenueChange,
                    costChange: s.costChange
                });
                return res.indicators || {};
            } catch (e) {
                console.error("Scenario Eval Error", e);
                return { npv: 0, irr: 0, paybackPeriod: 0 };
            }
        };

        const pessResults = getResults(pessimistic);
        const baseResultsCalc = baseResults?.indicators || { npv: 0, irr: 0, paybackPeriod: 0 }; // Use Base from main run
        const optResults = getResults(optimistic);

        // Alias for template usage (mapping indicators names to what template expects)
        //Template expects: npv, irr, payback. Model returns: npv, irr, paybackPeriod.
        const mapToView = (r) => ({
            npv: r.npv || 0,
            irr: r.irr || 0,
            payback: (r.paybackPeriod != null && Number.isFinite(r.paybackPeriod)) ? r.paybackPeriod : null
        });
        const fmtPayback = (p) => (p != null && p > 0) ? `${p.toFixed(1)} سنة` : 'غير محقق';

        const viewPess = mapToView(pessResults);
        const viewBase = mapToView(baseResultsCalc);
        const viewOpt = mapToView(optResults);

        const formatCurrency = (n) => new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(n);
        const formatPercent = (n) => `${(n * 100).toFixed(1)}%`;

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

            <!-- Feasibility Verdict -->
            <div class="verdict-box ${viewPess.npv > 0 ? 'verdict-success' : 'verdict-warning'}">
                ${viewPess.npv > 0
                ? '✅ المشروع مجدي حتى في السيناريو المتشائم'
                : '⚠️ المشروع قد لا يكون مجدياً في السيناريو المتشائم'}
            </div>
        `;
    }

    renderSensitivityAnalysis(scenarios, baseResults) {
        const sensitivity = scenarios.sensitivity || { selectedVariable: 'revenue', range: [-0.30, 0.30] };
        const variables = [
            { key: 'revenue', label: 'الإيرادات' },
            { key: 'costs', label: 'التكاليف' },
            { key: 'price', label: 'سعر البيع' },
            { key: 'volume', label: 'حجم المبيعات' }
        ];

        const baseNPV = baseResults?.kpis?.npv || 0;

        return `
            <div class="sensitivity-container">
                <div class="sensitivity-controls">
                    <label for="sensitivity-variable">المتغير:</label>
                    <select id="sensitivity-variable" class="input input--sm sensitivity-variable">
                        ${variables.map(v => `
                            <option value="${v.key}" ${sensitivity.selectedVariable === v.key ? 'selected' : ''}>${v.label}</option>
                        `).join('')}
                    </select>
                </div>
                
                <div class="sensitivity-slider-container">
                    <span class="slider-label">-30%</span>
                    <input type="range" class="sensitivity-slider" 
                           min="-30" max="30" value="0" step="5">
                    <span class="slider-label">+30%</span>
                </div>
                
                <div class="sensitivity-result">
                    <span class="result-label">التغير في صافي القيمة الحالية:</span>
                    <span class="result-value" id="sensitivityNPV">${this.formatCurrency(baseNPV)}</span>
                </div>

                <canvas id="sensitivityChart" width="400" height="200"></canvas>
            </div>
        `;
    }

    renderBreakEven(baseResults) {
        const fixedCosts = baseResults?.costs?.totalFixed || 0;
        const variableCostRatio = baseResults?.costs?.variableRatio || 0.3;
        const price = baseResults?.revenue?.avgPrice || 100;
        const contributionMargin = price * (1 - variableCostRatio);
        const breakEvenUnits = contributionMargin > 0 ? Math.ceil(fixedCosts / contributionMargin) : 0;
        const breakEvenValue = breakEvenUnits * price;

        return `
            <div class="breakeven-container">
                <div class="breakeven-kpis">
                    <div class="kpi-card">
                        <div class="kpi-label">التكاليف الثابتة</div>
                        <div class="kpi-value">${this.formatCurrency(fixedCosts)}</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-label">هامش المساهمة</div>
                        <div class="kpi-value">${((1 - variableCostRatio) * 100).toFixed(1)}%</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-label">نقطة التعادل (وحدات)</div>
                        <div class="kpi-value text-gold">${breakEvenUnits.toLocaleString('ar-SA')}</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-label">نقطة التعادل (ريال)</div>
                        <div class="kpi-value text-gold">${this.formatCurrency(breakEvenValue)}</div>
                    </div>
                </div>
                <canvas id="breakEvenChart" width="400" height="250"></canvas>
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

    renderCharts(baseResults) {
        // Sensitivity Chart
        const sensitivityCanvas = document.getElementById('sensitivityChart');
        if (sensitivityCanvas && window.Chart) {
            const baseNPV = baseResults?.kpis?.npv || 100000;
            const ctx = sensitivityCanvas.getContext('2d');
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['-30%', '-20%', '-10%', '0%', '+10%', '+20%', '+30%'],
                    datasets: [{
                        label: 'صافي القيمة الحالية',
                        data: [-30, -20, -10, 0, 10, 20, 30].map(p => baseNPV * (1 + p / 100)),
                        borderColor: '#ffd700',
                        backgroundColor: 'rgba(255, 215, 0, 0.1)',
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: {
                            grid: { color: 'rgba(255,255,255,0.1)' },
                            ticks: { color: '#888' }
                        },
                        x: {
                            grid: { color: 'rgba(255,255,255,0.1)' },
                            ticks: { color: '#888' }
                        }
                    }
                }
            });
        }

        // Break-Even Chart
        const breakEvenCanvas = document.getElementById('breakEvenChart');
        if (breakEvenCanvas && window.Chart) {
            const fixedCosts = baseResults?.costs?.totalFixed || 100000;
            const variableRatio = baseResults?.costs?.variableRatio || 0.3;
            const maxUnits = 1000;
            const price = 100;

            const ctx = breakEvenCanvas.getContext('2d');
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: Array.from({ length: 11 }, (_, i) => i * 100),
                    datasets: [
                        {
                            label: 'الإيرادات',
                            data: Array.from({ length: 11 }, (_, i) => i * 100 * price),
                            borderColor: '#4ade80',
                            tension: 0
                        },
                        {
                            label: 'التكاليف الكلية',
                            data: Array.from({ length: 11 }, (_, i) => fixedCosts + (i * 100 * price * variableRatio)),
                            borderColor: '#f87171',
                            tension: 0
                        },
                        {
                            label: 'التكاليف الثابتة',
                            data: Array.from({ length: 11 }, () => fixedCosts),
                            borderColor: '#888',
                            borderDash: [5, 5],
                            tension: 0
                        }
                    ]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            labels: { color: '#888' }
                        }
                    },
                    scales: {
                        y: {
                            grid: { color: 'rgba(255,255,255,0.1)' },
                            ticks: { color: '#888' }
                        },
                        x: {
                            grid: { color: 'rgba(255,255,255,0.1)' },
                            ticks: { color: '#888' },
                            title: { display: true, text: 'الكمية', color: '#888' }
                        }
                    }
                }
            });
        }
    }

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

        // Sensitivity slider
        const slider = this.container.querySelector('.sensitivity-slider');
        if (slider) {
            slider.addEventListener('input', (e) => this.updateSensitivity(e));
        }

        // Sensitivity variable
        const varSelect = this.container.querySelector('.sensitivity-variable');
        if (varSelect) {
            varSelect.addEventListener('change', (e) => this.changeSensitivityVariable(e));
        }
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

    updateSensitivity(e) {
        const value = parseInt(e.target.value);
        const state = this.store.getState();
        let baseResults = null;
        try {
            baseResults = runFullModel(state);
        } catch (err) { }

        const baseNPV = baseResults?.kpis?.npv || 100000;
        const adjustedNPV = baseNPV * (1 + value / 100);

        const resultEl = document.getElementById('sensitivityNPV');
        if (resultEl) {
            resultEl.textContent = this.formatCurrency(adjustedNPV);
            resultEl.className = `result-value ${adjustedNPV >= 0 ? 'text-success' : 'text-danger'}`;
        }
    }

    changeSensitivityVariable(e) {
        const state = this.store.getState();
        const scenarios = { ...state.scenarios };
        scenarios.sensitivity = { ...scenarios.sensitivity, selectedVariable: e.target.value };
        this.store.update('scenarios', scenarios);
    }
}
