/**
 * Monte Carlo Analysis UI
 * Visualizes risk distribution
 */
import { MonteCarloEngine } from '../core/MonteCarloEngine.js';

export class MonteCarloAnalysis {
    constructor(containerId, store) {
        this.container = document.getElementById(containerId);
        this.store = store;
    }

    render() {
        this.container.innerHTML = `
            <div class="monte-carlo-section">
                <h2 class="section-title">🎲 محاكاة مونت كارلو (تحليل المخاطر)</h2>
                
                <div class="card">
                    <div class="flex-between mb-4">
                        <div>
                            <p class="text-muted">يقوم هذا التحليل بتشغيل 1000 سيناريو محتمل لقياس احتمالية الربح.</p>
                        </div>
                        <button id="btnRunSim" class="btn btn--primary btn-magic">
                            تشغيل المحاكاة 🚀
                        </button>
                    </div>

                    <div id="simResults" class="hidden">
                        <div class="kpi-grid mb-6">
                            <div class="kpi-card">
                                <span class="kpi-label">احتمالية النجاح (صافي القيمة الحالية > 0)</span>
                                <span class="kpi-value" id="probSuccess">--</span>
                            </div>
                            <div class="kpi-card">
                                <span class="kpi-label">متوسط الربح المتوقع</span>
                                <span class="kpi-value" id="avgNPV">--</span>
                            </div>
                            <div class="kpi-card">
                                <span class="kpi-label">درجة المخاطرة</span>
                                <span class="kpi-value" id="riskRating">--</span>
                            </div>
                        </div>

                        <div class="chart-container" style="height: 300px;">
                            <canvas id="histoChart"></canvas>
                        </div>
                    </div>
                </div>
            </div>
        `;


        this.bindEvents();

        // Auto-run simulation on load
        requestAnimationFrame(() => this.run());
    }

    bindEvents() {
        const btn = this.container.querySelector('#btnRunSim');
        if (btn) {
            btn.addEventListener('click', () => this.run());
        }
    }

    async run() {
        const btn = this.container.querySelector('#btnRunSim');
        const resultsDiv = this.container.querySelector('#simResults');

        btn.disabled = true;
        btn.textContent = 'جاري المعالجة... 🎲';

        // Allow UI to update
        await new Promise(r => setTimeout(r, 100));

        try {
            const state = this.store.getState();
            const simulation = MonteCarloEngine.runSimulation(state, 1000, 0.20); // 20% volatility

            this.displayResults(simulation);
            resultsDiv.classList.remove('hidden');
        } catch (err) {
            console.error(err);
            alert('حدث خطأ أثناء المحاكاة');
        } finally {
            btn.disabled = false;
            btn.textContent = 'تشغيل المحاكاة 🚀';
        }
    }

    displayResults(sim) {
        const { successProbability, avgNPV } = sim.stats;

        // Update KPIs
        const probEl = this.container.querySelector('#probSuccess');
        const avgEl = this.container.querySelector('#avgNPV');
        const riskEl = this.container.querySelector('#riskRating');

        probEl.textContent = (successProbability * 100).toFixed(1) + '%';
        probEl.style.color = successProbability > 0.7 ? 'var(--c-success)' : (successProbability > 0.4 ? 'var(--c-warning)' : 'var(--c-danger)');

        avgEl.textContent = new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(avgNPV);

        // Risk Rating
        let risk = 'منخفضة ✅';
        if (successProbability < 0.8) risk = 'متوسطة ⚠️';
        if (successProbability < 0.5) risk = 'عالية ⛔';
        riskEl.textContent = risk;

        // Render Histogram
        this.renderHistogram(sim.results);
    }

    renderHistogram(results) {
        const ctx = document.getElementById('histoChart').getContext('2d');
        const npvs = results.map(r => r.npv);

        // Create buckets
        const bucketCount = 20;
        const min = Math.min(...npvs);
        const max = Math.max(...npvs);
        const range = max - min;
        const width = range / bucketCount;

        const buckets = Array(bucketCount).fill(0);
        const labels = Array(bucketCount).fill(0);

        npvs.forEach(val => {
            const bucketIndex = Math.min(Math.floor((val - min) / width), bucketCount - 1);
            buckets[bucketIndex]++;
        });

        // Generate labels (bucket centers)
        for (let i = 0; i < bucketCount; i++) {
            const center = min + (i * width) + (width / 2);
            labels[i] = (center / 1000).toFixed(0) + 'k';
        }

        // Destroy old chart if exists
        if (this.chart) this.chart.destroy();

        this.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'تكرار السيناريو',
                    data: buckets,
                    backgroundColor: labels.map((l, i) => {
                        const center = min + (i * width) + (width / 2);
                        return center >= 0 ? 'rgba(74, 222, 128, 0.6)' : 'rgba(248, 113, 113, 0.6)';
                    }),
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `${ctx.raw} سيناريو`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255,255,255,0.05)' }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });
    }
}
