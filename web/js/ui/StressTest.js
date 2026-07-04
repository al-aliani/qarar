/**
 * Stress Test Component (Black Swan Analysis)
 * Simulates extreme scenarios to test business resilience.
 */
export class StressTest {
    constructor(containerId, store) {
        this.container = document.getElementById(containerId);
        this.store = store;
    }

    render() {
        const state = this.store.get();
        // Calculate Base Metrics from Financial Statements
        // (Simplified for MVP: Monthly Burn Rate and Cash Reserve)

        const monthlyOpex = this.calculateMonthlyOpex(state);
        const cashReserve = (state.financing?.totalInvestment || 0) * 0.2; // Assume 20% is kept as cash initially or calc from Working Capital

        this.container.innerHTML = `
            <div class="stress-test animate-entry">
                <h2 class="section-title">⛈️ اختبار التحمل (Stress Test)</h2>
                <p class="text-muted mb-6">اختبر صلابة مشروعك أمام الأزمات المفاجئة (مثل: انقطاع المبيعات، أوبئة، ارتفاع مواد خام).</p>

                <div class="card glass-card mb-6 bg-red-50" style="border:1px solid #fee2e2;">
                    <h3 class="font-bold text-danger mb-4">سيناريو "البجعة السوداء" (Black Swan)</h3>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <label class="block mb-2">📉 انخفاض المبيعات المفاجئ</label>
                            <input type="range" class="input-range danger-slider" id="salesDrop" min="0" max="100" value="50">
                            <div class="flex-between font-bold text-danger"><span id="salesDropVal">50</span>% انخفاض</div>
                        </div>

                        <div>
                            <label class="block mb-2">📈 ارتفاع التكاليف التشغيلية</label>
                            <input type="range" class="input-range danger-slider" id="costHike" min="0" max="100" value="20">
                            <div class="flex-between font-bold text-danger"><span id="costHikeVal">20</span>% ارتفاع</div>
                        </div>
                    </div>
                </div>

                <div class="results-panel card">
                    <h3 class="card-title">نتائج التحمل</h3>
                    
                    <div class="flex flex-col items-center justify-center p-6">
                        <div class="text-4xl font-bold mb-2" id="survivalMonths">--</div>
                        <div class="text-muted">أشهر البقاء (Runway)</div>
                        <div class="w-full bg-gray-200 rounded-full h-4 mt-4 overflow-hidden">
                            <div id="survivalBar" class="bg-success h-4" style="width: 50%"></div>
                        </div>
                    </div>

                    <div id="stressAdvice" class="alert alert--warning mt-4">
                        جاري الحساب...
                    </div>
                </div>
            </div>
        `;

        this.bindEvents(monthlyOpex, cashReserve);
        // Initial Run
        this.calculateSurvival(50, 20, monthlyOpex, cashReserve);
    }

    calculateMonthlyOpex(state) {
        let opex = 0;
        // HR
        (state.hr?.positions || []).forEach(p => opex += (p.count || 1) * (p.salary || 0));
        // Rent (Approx from buildings / 12 if rent, assuming building cost is rent for MVP simplification or 0)
        // Let's assume 5% of Capex is annual maintenance/rent if not specified.
        // Better: Use Working Capital estimate from Financing calc
        const wcMonths = state.assumptions?.workingCapitalMonths || 3;
        // If we have no data, assume Opex = 10% of Capex/mo (rough heuristic)
        const capex = state.financing?.totalInvestment || 100000;
        if (opex === 0) opex = capex * 0.05;

        return opex;
    }

    bindEvents(baseOpex, cashReserve) {
        const salesInput = this.container.querySelector('#salesDrop');
        const costInput = this.container.querySelector('#costHike');

        const update = () => {
            salesInput.nextElementSibling.querySelector('span').textContent = salesInput.value;
            costInput.nextElementSibling.querySelector('span').textContent = costInput.value;

            this.calculateSurvival(parseInt(salesInput.value), parseInt(costInput.value), baseOpex, cashReserve);
        };

        salesInput.addEventListener('input', update);
        costInput.addEventListener('input', update);
    }

    calculateSurvival(salesDropPct, costHikePct, baseOpex, cashReserve) {
        // Impacted Opex
        const impactedOpex = baseOpex * (1 + (costHikePct / 100));
        // Revenue (Assume Break-even initially, so Revenue = Base Opex)
        // If Sales drop 50%, Revenue = Base Opex * 0.5
        const baseRevenue = baseOpex * 1.2; // Assume 20% profit margin normally
        const impactedRevenue = baseRevenue * (1 - (salesDropPct / 100));

        const netBurn = impactedOpex - impactedRevenue;

        let months = 0;
        if (netBurn <= 0) {
            months = 999; // Profitable even in crisis!
        } else {
            months = cashReserve / netBurn;
        }

        // Render
        const monthsEl = document.getElementById('survivalMonths');
        const bar = document.getElementById('survivalBar');
        const advice = document.getElementById('stressAdvice');

        if (months >= 999) {
            monthsEl.textContent = '∞ (آمن)';
            monthsEl.className = 'text-4xl font-bold mb-2 text-success';
            bar.style.width = '100%';
            bar.className = 'bg-success h-4';
            advice.className = 'alert alert--success mt-4';
            advice.textContent = '✅ مشروعك مرن جداً ومربح حتى في ظل هذه الأزمة.';
        } else {
            const m = months.toFixed(1);
            monthsEl.textContent = `${m} شهر`;

            if (months < 3) {
                monthsEl.className = 'text-4xl font-bold mb-2 text-danger';
                bar.className = 'bg-danger h-4';
                bar.style.width = Math.min(months * 10, 100) + '%';
                advice.className = 'alert alert--danger mt-4';
                advice.textContent = '🚨 خطر! السيولة النقدية ستنفد بسرعة. يجب زيادة الاحتياطي النقدي أو تقليل التكاليف الثابتة فوراً.';
            } else if (months < 6) {
                monthsEl.className = 'text-4xl font-bold mb-2 text-warning';
                bar.className = 'bg-warning h-4';
                bar.style.width = Math.min(months * 10, 100) + '%';
                advice.className = 'alert alert--warning mt-4';
                advice.textContent = '⚠️ وضع حرج. يُنصح بأن يغطي الاحتياطي النقدي 6 أشهر من المصاريف التشغيلية على الأقل.';
            } else {
                monthsEl.className = 'text-4xl font-bold mb-2 text-success';
                bar.className = 'bg-success h-4';
                bar.style.width = Math.min(months * 10, 100) + '%';
                advice.className = 'alert alert--success mt-4';
                advice.textContent = '✅ وضع جيد. لديك سيولة كافية للصمود لفترة معقولة.';
            }
        }
    }
}
