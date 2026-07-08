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

    /**
     * تدقيق 2026-07-08 (ملاحظة متوسطة #33): كانت عتبات لون نسبة النجاح (٪) ونص
     * «درجة المخاطرة» مكرَّرتين بمنطقين مستقلين في دالتين (displaySavedSummary/
     * displayResults) بعتبات غير متطابقة (لون ينجح عند >70%، نص يتوسّط عند <80%) —
     * فيظهر رقم أخضر «نجاح» بجانب نص «متوسطة ⚠️» لنفس الاحتمالية في نفس اللحظة.
     * الآن مصدر واحد يضمن أن اللون والنص يعكسان نفس العتبة دائماً.
     */
    static getRiskRating(successProbability) {
        if (successProbability > 0.7) return { text: 'منخفضة ✅', color: 'var(--c-success)' };
        if (successProbability > 0.4) return { text: 'متوسطة ⚠️', color: 'var(--c-warning)' };
        return { text: 'عالية ⛔', color: 'var(--c-danger)' };
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
                            <!-- تدقيق 2026-07-08 (ملاحظة متوسطة #32): كانت نسبة التقلّب المستخدمة فعلياً
                            (20%) غير مُفصَح عنها للمستخدم إطلاقاً رغم أنها أساس كل الأرقام أدناه. -->
                            <p class="text-xs text-muted mt-1">افتراض التقلّب: ±20% على الإيراد (تقديري)، وتقلّب أقل تناسبياً على التكلفة والاستثمار الرأسمالي.</p>
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
                            <!-- تدقيق 2026-07-08 (ملاحظة متوسطة #35): نتيجة محفوظة من زيارة سابقة تملأ
                            بطاقات المؤشرات بأرقام حقيقية، لكن المدرّج يبقى فارغاً تماماً بلا تفسير —
                            لا نحتفظ بالنتائج الخام (1000 قيمة) في التخزين المحلي لتوفير المساحة، فلا
                            يمكن إعادة رسمه بلا تشغيل فعلي جديد. -->
                            ${saved ? '<p id="histoPlaceholder" class="text-xs text-muted text-center" style="padding-top:1rem;">هذه أرقام محفوظة من زيارة سابقة — اضغط «تشغيل المحاكاة» لعرض المدرّج التكراري (لا تُحفَظ التفاصيل الخام لتوفير المساحة).</p>' : ''}
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
        const savedRating = MonteCarloAnalysis.getRiskRating(saved.successProbability);
        probEl.style.color = savedRating.color;
        avgEl.textContent = new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(saved.avgNPV);
        riskEl.textContent = savedRating.text;
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
        const rating = MonteCarloAnalysis.getRiskRating(successProbability);
        probEl.style.color = rating.color;

        avgEl.textContent = new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(avgNPV);

        // Risk Rating
        riskEl.textContent = rating.text;

        this.fillPercentiles(p10, p50, p90);

        // Render Histogram — نستهلك histogram الجاهزة من المحرك (لا نُعيد تجميع النتائج
        // الخام هنا؛ انظر ملاحظة #61 أدناه).
        this.renderHistogram(sim.histogram);
    }

    /**
     * تدقيق 2026-07-08 (ملاحظة منخفضة #61): كانت هذه الدالة تُعيد تجميع نتائج NPV
     * الخام إلى 20 فئة بمنطق مستقل خاص بها (مع حارس صفر منفصل خاص به)، رغم أن
     * MonteCarloEngine.runSimulation يُخرج histogram جاهزة بنفس المواصفات (20 فئة،
     * حارس صفر مطابق) — منطقان للتجميع قد يتباعدان لاحقاً بلا داعٍ. الآن تُستهلَك
     * histogram الجاهزة من المحرك مباشرة (مصدر واحد للحقيقة لا نسخة مكرَّرة).
     * @param {Array<{binStart:number, binEnd:number, count:number}>} histogram
     */
    renderHistogram(histogram) {
        // رسم فعلي جديد ⇒ رسالة "نتيجة محفوظة، اضغط تشغيل" لم تعد صحيحة
        this.container.querySelector('#histoPlaceholder')?.remove();
        const ctx = document.getElementById('histoChart').getContext('2d');

        const buckets = histogram.map(b => b.count);
        // Generate labels (bucket centers) — «ألف» عربية بدل 'k' الإنجليزية في واجهة عربية
        const arNum = new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 0 });
        const centers = histogram.map(b => (b.binStart + b.binEnd) / 2);
        const labels = centers.map(center => arNum.format(Math.round(center / 1000)) + ' ألف');

        // Destroy old chart if exists
        if (this.chart) this.chart.destroy();

        this.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'تكرار السيناريو',
                    data: buckets,
                    backgroundColor: centers.map(center => center >= 0 ? 'rgba(74, 222, 128, 0.6)' : 'rgba(248, 113, 113, 0.6)'),
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
