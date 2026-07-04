/**
 * SensitivityWidget.js
 * Interactive "What-If" Analysis Widget for Dashboard
 * Sliders for Revenue (+/- 20%) and Cost (+/- 20%) to show impact on Net Profit.
 */
import { formatCurrency } from '../../utils/formatters.js';

export class SensitivityWidget {
    constructor(containerId, store) {
        this.container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
        this.store = store;
        this.state = {
            revenueChange: 0, // Percentage -20 to +20
            costChange: 0     // Percentage -20 to +20
        };
        this.baseResults = null;
    }

    render() {
        if (!this.container) return;

        // Calculate base if not available
        const appState = this.store.getState();
        if (!appState.results) return; // Need results to simulate

        const incomeY1 = appState.results.incomeStatement?.[0] || {};
        const baseRevenue = incomeY1.revenue || 0;
        const baseExpense = (incomeY1.variableCosts || 0) + (incomeY1.fixedCosts || 0);
        const baseNet = incomeY1.netIncome || 0;

        this.container.innerHTML = `
            <div class="sensitivity-widget card p-4 animate-entry">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="font-bold text-sm text-gold">⚡ ماذا لو؟ (تحليل الحساسية)</h3>
                    <button class="btn-xs btn-ghost text-xs reset-sim">إعادة تعيين</button>
                </div>
                
                <div class="sim-controls space-y-4 mb-4">
                    <!-- Revenue Slider -->
                    <div>
                        <div class="flex justify-between text-xs mb-1">
                            <span>تغير الإيرادات</span>
                            <span class="val-rev font-bold text-success">0%</span>
                        </div>
                        <input type="range" class="w-full range-slider slider-rev" min="-30" max="30" value="0" step="5">
                        <div class="flex justify-between text-[10px] text-muted mt-1">
                            <span>-30%</span>
                            <span>+30%</span>
                        </div>
                    </div>

                    <!-- Cost Slider -->
                    <div>
                        <div class="flex justify-between text-xs mb-1">
                            <span>تغير التكاليف</span>
                            <span class="val-cost font-bold text-danger">0%</span>
                        </div>
                        <input type="range" class="w-full range-slider slider-cost" min="-30" max="30" value="0" step="5">
                        <div class="flex justify-between text-[10px] text-muted mt-1">
                            <span>-30%</span>
                            <span>+30%</span>
                        </div>
                    </div>
                </div>

                <div class="sim-result p-3 bg-gray-50 rounded-lg border border-gray-200 text-center">
                    <p class="text-xs text-muted mb-1">صافي الربح المتوقع (السنة 1)</p>
                    <div class="sim-net-val text-xl font-bold transition-all duration-300" style="color: var(--c-primary);">${formatCurrency(baseNet)}</div>
                    <div class="sim-delta text-xs mt-1 font-medium"></div>
                </div>
            </div>
            <style>
                .range-slider { -webkit-appearance: none; height: 4px; background: #e2e8f0; border-radius: 2px; }
                .range-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; background: var(--gold); border-radius: 50%; cursor: pointer; border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.2); transition: transform 0.1s; }
                .range-slider::-webkit-slider-thumb:hover { transform: scale(1.2); }
            </style>
        `;

        this.bindEvents(baseRevenue, baseExpense, baseNet);
    }

    bindEvents(baseRev, baseExp, baseNet) {
        const sliderRev = this.container.querySelector('.slider-rev');
        const sliderCost = this.container.querySelector('.slider-cost');
        const labelRev = this.container.querySelector('.val-rev');
        const labelCost = this.container.querySelector('.val-cost');
        const valDisplay = this.container.querySelector('.sim-net-val');
        const deltaDisplay = this.container.querySelector('.sim-delta');
        const resetBtn = this.container.querySelector('.reset-sim');

        const updateCallback = () => {
            const rPct = parseInt(sliderRev.value);
            const cPct = parseInt(sliderCost.value);

            labelRev.textContent = (rPct > 0 ? '+' : '') + rPct + '%';
            labelCost.textContent = (cPct > 0 ? '+' : '') + cPct + '%';

            // Simple Linear Simulation
            const newRev = baseRev * (1 + (rPct / 100));
            const newExp = baseExp * (1 + (cPct / 100)); // Only simulating Opex/COGS change roughly
            // Assuming Zakat/Tax is ratio based, but let's do simple Gross-Exp structure for speed
            // Better: use 'engine.js' calculate call if possible, but for widget speed manual calc is better.

            const newNet = newRev - newExp; // Rough approximation for UI speed

            valDisplay.textContent = formatCurrency(newNet);
            valDisplay.style.color = newNet >= 0 ? 'var(--c-primary)' : '#e53e3e';

            const diff = newNet - baseNet;
            const diffSign = diff >= 0 ? '+' : '';
            deltaDisplay.innerHTML = diff !== 0
                ? `<span class="${diff > 0 ? 'text-success' : 'text-danger'}">${diffSign}${formatCurrency(diff)}</span> عن الأساس`
                : '<span class="text-muted">نفس الأساس</span>';
        };

        sliderRev.addEventListener('input', updateCallback);
        sliderCost.addEventListener('input', updateCallback);
        resetBtn.addEventListener('click', () => {
            sliderRev.value = 0;
            sliderCost.value = 0;
            updateCallback();
        });
    }
}
