/**
 * Monte Carlo Analysis UI
 * Visualizes risk distribution
 */
import { MonteCarloEngine } from '../core/MonteCarloEngine.js';
import { SECTIONS } from '../core/schema.js';

export class MonteCarloAnalysis {
    constructor(containerId, store) {
        this.container = document.getElementById(containerId);
        this.store = store;
    }

    render() {
        // نتائج محفوظة من تشغيل سابق (إن وُجدت) — لا نُشغّل 1000 تكرار تلقائياً عند كل زيارة
        // للخطوة (كان يجمّد الخيط الرئيسي — تدقيق 2026-07-08)؛ التشغيل بزر صريح فقط الآن.
        const saved = this.store.getState()[SECTIONS.MONTE_CARLO]?.lastRun || null;

        this.container.innerHTML = `
            <div class="monte-carlo-section">
                <h2 class="section-title"><svg class="ic" aria-hidden="true"><use href="#i-chart"/></svg> محاكاة مونت كارلو (تحليل المخاطر)</h2>

                <div class="card">
                    <div class="flex-between mb-4">
                        <div>
                            <p class="text-muted">يقوم هذا التحليل بتشغيل 1000 سيناريو محتمل لقياس احتمالية الربح.</p>
                            ${saved ? `<p class="text-xs text-muted mt-1">آخر تشغيل: ${new Date(saved.runAt).toLocaleString('ar-SA')} — بذرة ثابتة (نفس المدخلات = نفس النتيجة)</p>` : ''}
                        </div>
                        <button id="btnRunSim" class="btn btn--primary btn-magic">
                            <svg class="ic" aria-hidden="true"><use href="#i-bolt"/></svg> تشغيل المحاكاة
                        </button>
                    </div>

                    <div id="simResults" class="${saved ? '' : 'hidden'}">
                        <div class="kpi-grid mb-6">
                            <div class="kpi-card">
                                <span class="kpi-label">احتمالية النجاح (صافي القيمة الحالية > 0)</span>
                                <span class="kpi-value" id="probSuccess">--</span>
                            </div>
                            <div class="kpi-card">
                                <span class="kpi-label">متوسط صافي القيمة الحالية (NPV)</span>
                                <span class="kpi-value" id="avgNPV">--</span>
                            </div>
                            <div class="kpi-card">
                                <span class="kpi-label">درجة المخاطرة</span>
                                <span class="kpi-value" id="riskRating">--</span>
                            </div>
                        </div>

                        <div class="kpi-grid mb-6" aria-label="نطاق NPV حسب شدة السيناريو">
                            <div class="kpi-card">
                                <span class="kpi-label">متشائم (p10) — 10% احتمال أسوأ من هذا</span>
                                <span class="kpi-value text-danger" id="npvP10">--</span>
                            </div>
                            <div class="kpi-card">
                                <span class="kpi-label">وسيط (p50)</span>
                                <span class="kpi-value" id="npvP50">--</span>
                            </div>
                            <div class="kpi-card">
                                <span class="kpi-label">متفائل (p90) — 10% احتمال أفضل من هذا</span>
                                <span class="kpi-value text-success" id="npvP90">--</span>
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

        // إن وُجدت نتيجة محفوظة نعرضها فوراً بلا إعادة حساب (رسم المدرّج يحتاج النتائج
        // الخام، لا نحتفظ بها في الحالة — نعرض المؤشرات فقط ونطلب زر التشغيل للمدرّج)
        if (saved) this.displaySavedSummary(saved);
    }

    displaySavedSummary(saved) {
        const probEl = this.container.querySelector('#probSuccess');
        const avgEl = this.container.querySelector('#avgNPV');
        const riskEl = this.container.querySelector('#riskRating');
        if (!probEl) return;
        probEl.textContent = (saved.successProbability * 100).toFixed(1) + '%';
        probEl.style.color = saved.successProbability > 0.7 ? 'var(--c-success)' : (saved.successProbability > 0.4 ? 'var(--c-warning)' : 'var(--c-danger)');
        avgEl.textContent = new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(saved.avgNPV);
        let risk = 'منخفضة ✅';
        if (saved.successProbability < 0.8) risk = 'متوسطة ⚠️';
        if (saved.successProbability < 0.5) risk = 'عالية ⛔';
        riskEl.textContent = risk;
        this.fillPercentiles(saved.p10, saved.p50, saved.p90);
    }

    fillPercentiles(p10, p50, p90) {
        const fmt = (n) => new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(n);
        const p10El = this.container.querySelector('#npvP10');
        const p50El = this.container.querySelector('#npvP50');
        const p90El = this.container.querySelector('#npvP90');
        if (p10El && p10 != null) p10El.textContent = fmt(p10);
        if (p50El && p50 != null) p50El.textContent = fmt(p50);
        if (p90El && p90 != null) p90El.textContent = fmt(p90);
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
        btn.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#i-reset"/></svg> جاري المعالجة...';

        // Allow UI to update
        await new Promise(r => setTimeout(r, 100));

        try {
            const state = this.store.getState();
            // بذرة ثابتة: نفس بيانات الدراسة تُنتج نفس الاحتمالية والمدرّج في كل تشغيل
            // (قابلية تدقيق) بدل نتيجة عشوائية مختلفة كل مرة.
            const simulation = MonteCarloEngine.runSimulation(state, 1000, 0.20);

            this.displayResults(simulation);
            resultsDiv.classList.remove('hidden');

            if (simulation && simulation.ok !== false) {
                this.store.updatePath(SECTIONS.MONTE_CARLO, 'lastRun', {
                    successProbability: simulation.stats.successProbability,
                    avgNPV: simulation.stats.avgNPV,
                    p10: simulation.stats.p10,
                    p50: simulation.stats.p50,
                    p90: simulation.stats.p90,
                    iterations: simulation.iterations ?? 1000,
                    volatility: 0.20,
                    runAt: new Date().toISOString(),
                });
            }
        } catch (err) {
            console.error(err);
            alert('حدث خطأ أثناء المحاكاة');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#i-bolt"/></svg> تشغيل المحاكاة';
        }
    }

    displayResults(sim) {
        // Update KPIs
        const probEl = this.container.querySelector('#probSuccess');
        const avgEl = this.container.querySelector('#avgNPV');
        const riskEl = this.container.querySelector('#riskRating');

        // Guard: if every iteration failed (invalid/empty state), the engine returns
        // ok:false with zeroed stats. Show an honest "insufficient data" state instead
        // of rendering a fake 0% success / high-risk verdict to the user.
        if (sim && sim.ok === false) {
            probEl.textContent = '—';
            probEl.style.color = 'var(--c-muted, #888)';
            avgEl.textContent = '—';
            riskEl.textContent = 'تعذّرت المحاكاة — بيانات غير كافية';
            return;
        }

        const { successProbability, avgNPV, p10, p50, p90 } = sim.stats;

        probEl.textContent = (successProbability * 100).toFixed(1) + '%';
        probEl.style.color = successProbability > 0.7 ? 'var(--c-success)' : (successProbability > 0.4 ? 'var(--c-warning)' : 'var(--c-danger)');

        avgEl.textContent = new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(avgNPV);

        // Risk Rating
        let risk = 'منخفضة ✅';
        if (successProbability < 0.8) risk = 'متوسطة ⚠️';
        if (successProbability < 0.5) risk = 'عالية ⛔';
        riskEl.textContent = risk;

        this.fillPercentiles(p10, p50, p90);

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
        // حارس القسمة على صفر: إن تطابقت كل قيم NPV (تقلّب صفري)، width=0 يُنتج فهرس
        // NaN لكل تكرار فتُهمَل البيانات صامتة (مدرّج فارغ رغم اكتمال المحاكاة).
        const width = range > 0 ? range / bucketCount : 1;

        const buckets = Array(bucketCount).fill(0);
        const labels = Array(bucketCount).fill(0);

        npvs.forEach(val => {
            const bucketIndex = Math.min(Math.floor((val - min) / width), bucketCount - 1);
            buckets[bucketIndex]++;
        });

        // Generate labels (bucket centers) — «ألف» عربية بدل 'k' الإنجليزية في واجهة عربية
        const arNum = new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 0 });
        for (let i = 0; i < bucketCount; i++) {
            const center = min + (i * width) + (width / 2);
            labels[i] = arNum.format(Math.round(center / 1000)) + ' ألف';
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
