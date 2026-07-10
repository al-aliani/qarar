/**
 * Post-Launch Tracker Component
 * Compares Actual performance vs Feasibility Plan
 */
import { calculateStudy as runFullModel } from '../core/engine.js';
import { SECTIONS } from '../core/schema.js';
import { escapeHtml } from '../utils/escape.js';

export class PostLaunchTracker {
    constructor(containerId, store) {
        this.container = document.getElementById(containerId);
        this.store = store;
    }

    render() {
        const state = this.store.get();
        let plannedResults = null;
        try {
            plannedResults = runFullModel(state);
        } catch (e) {
            console.error('Financial Model Error:', e);
        }

        const actuals = state[SECTIONS.ACTUALS] || { months: [] };
        const plannedY1 = plannedResults?.incomeStatement?.[0] || { revenue: 0, variableCosts: 0, fixedCosts: 0 };
        const plannedMonthlyRev = (plannedY1.revenue || 0) / 12;
        const plannedOpexTotal = (plannedY1.variableCosts || 0) + (plannedY1.fixedCosts || 0);
        const plannedMonthlyOpex = plannedOpexTotal / 12;

        this.container.innerHTML = `
            <div class="tracker-container animate-entry">
                <div class="section-header">
                    <h2 class="text-xl font-bold">مراقبة الأداء الفعلي</h2>
                    <p class="text-muted">مقارنة الأداء الحقيقي للمشروع مع ما تم التخطيط له في دراسة الجدوى لمعرفة الانحرافات.</p>
                    <p class="text-sm text-muted">هذه الخطوة اختيارية بالكامل ومخصّصة لما بعد افتتاح المشروع فعلياً — لا حاجة لتعبئتها الآن، ويمكنك العودة إليها لاحقاً بعد بدء التشغيل.</p>
                    <div class="alert alert--info mt-3" style="font-size: 0.85rem;">
                        <strong>حكم النجاح/الفشل:</strong> من الأشهر الأولى: الخسائر يجب أن تتناقص، الأرباح تتزايد. إذا خسارة شهر ن &gt; خسارة شهر ن-1 لمدة 3 أشهر متتالية — انتبه. بعد سنة أعد التقييم جذرياً.
                    </div>
                </div>

                <div class="grid-2-col gap-4">
                    <!-- Tracker Table -->
                    <div class="card glass-card">
                        <h3 class="card-title">إدخال البيانات الشهرية (الفعلية)</h3>
                        <div class="table-container">
                            <table class="data-table small">
                                <thead>
                                    <tr>
                                        <th>الشهر</th>
                                        <th>الإيراد الفعلي</th>
                                        <th>المصاريف الفعلية</th>
                                        <th>ملاحظات</th>
                                    </tr>
                                </thead>
                                <tbody id="actualsBody">
                                    ${actuals.months.map(m => this.renderActualsRow(m)).join('')}
                                </tbody>
                            </table>
                        </div>
                        <button id="btnAddMonth" class="btn btn--secondary mt-3">+ إضافة شهر جديد</button>
                    </div>

                    <!-- Variance Analysis -->
                    <div class="card glass-card">
                        <h3 class="card-title">تحليل الانحرافات (Variance Analysis)</h3>
                        <div class="variance-summary">
                            ${this.renderVarianceSummary(actuals, plannedMonthlyRev, plannedMonthlyOpex)}
                        </div>
                    </div>
                </div>

                <!-- Comparison Chart -->
                <div class="card glass-card mt-4">
                    <h3 class="card-title text-center">مقارنة الإيرادات: المخطط 🤝 الفعلي</h3>
                    <div class="chart-container" style="height: 300px;">
                        <canvas id="trackerChart"></canvas>
                    </div>
                </div>
            </div>
        `;

        this.bindEvents();
        this.renderChart(actuals, plannedMonthlyRev);
    }

    renderActualsRow(month) {
        return `
            <tr>
                <td>شهر ${month.id}</td>
                <td><input type="number" class="input-actual" data-id="${escapeHtml(month.id)}" data-field="revenue" value="${escapeHtml(month.revenue)}"></td>
                <td><input type="number" class="input-actual" data-id="${escapeHtml(month.id)}" data-field="opex" value="${escapeHtml(month.opex)}"></td>
                <td><input type="text" class="input-actual" data-id="${escapeHtml(month.id)}" data-field="notes" value="${escapeHtml(month.notes)}"></td>
            </tr>
        `;
    }

    renderVarianceSummary(actuals, plannedRev, plannedOpex) {
        // نعدّ الأشهر المُدخلة فقط — الأشهر الفارغة ليست «أداءً صفرياً» (كانت تعطي انحرافاً كاذباً -100%)
        const hasNum = (v) => v !== '' && v != null && !Number.isNaN(parseFloat(v));
        const enteredRev = actuals.months.filter(m => hasNum(m.revenue));
        if (enteredRev.length === 0) {
            return `<div class="variance-item">
                <span class="label">انحراف الإيرادات</span>
                <small>ℹ️ لم تُدخل بيانات فعلية بعد — أدخل إيراد شهر واحد على الأقل لبدء تحليل الانحراف.</small>
            </div>`;
        }
        const totalActualRev = enteredRev.reduce((sum, m) => sum + parseFloat(m.revenue), 0);
        const totalPlannedRev = plannedRev * enteredRev.length;
        const revVariance = totalActualRev - totalPlannedRev;
        const revVarPercent = totalPlannedRev > 0 ? (revVariance / totalPlannedRev) * 100 : 0;

        const enteredOpex = actuals.months.filter(m => hasNum(m.opex));
        const totalActualOpex = enteredOpex.reduce((sum, m) => sum + parseFloat(m.opex), 0);
        const totalPlannedOpex = plannedOpex * enteredOpex.length;
        const opexVariance = totalActualOpex - totalPlannedOpex;

        return `
            <div class="variance-item ${revVariance >= 0 ? 'positive' : 'negative'}">
                <span class="label">انحراف الإيرادات (Revenue Variance)</span>
                <span class="value">${this.formatCurrency(revVariance)} (${revVarPercent.toFixed(1)}%)</span>
                <small>${revVariance >= 0 ? '🟢 أداء أعلى من المتوقع' : '🔴 أداء أقل من المخطط'}</small>
            </div>
            <div class="variance-item ${opexVariance <= 0 ? 'positive' : 'negative'} mt-4">
                <span class="label">انحراف المصاريف (Expense Variance)</span>
                <span class="value">${this.formatCurrency(opexVariance)}</span>
                <small>${opexVariance <= 0 ? '🟢 توفير في التكاليف' : '🔴 تجاوز للميزانية المخططة'}</small>
            </div>
            <div class="valuation-tip mt-4">
                <p>💡 <strong>ملاحظة:</strong> الأرقام المخططة مبنية على متوسط أول سنة في دراستك (Year 1 Average).</p>
            </div>
        `;
    }

    bindEvents() {
        this.container.querySelectorAll('.input-actual').forEach(input => {
            input.addEventListener('change', (e) => {
                const id = parseInt(e.target.dataset.id);
                const field = e.target.dataset.field;
                const value = e.target.type === 'number' ? parseFloat(e.target.value) : e.target.value;
                this.updateActual(id, field, value);
            });
        });

        const btnAdd = document.getElementById('btnAddMonth');
        if (btnAdd) {
            btnAdd.addEventListener('click', () => {
                const state = this.store.get();
                const actuals = state[SECTIONS.ACTUALS];
                const nextId = actuals.months.length + 1;
                actuals.months.push({ id: nextId, revenue: '', opex: '', notes: '' }); // فارغ = لم يُدخل بعد (لا صفر يُحسب كأداء)
                this.store.updatePath(SECTIONS.ACTUALS, 'months', actuals.months);
                this.render();
            });
        }
    }

    updateActual(id, field, value) {
        const state = this.store.get();
        const months = state[SECTIONS.ACTUALS].months.map(m => {
            if (m.id === id) {
                return { ...m, [field]: value };
            }
            return m;
        });
        this.store.updatePath(SECTIONS.ACTUALS, 'months', months);
        // We don't full render to avoid losing focus, but summary needs update
        // For simplicity in this demo, we re-render chart/summary
        setTimeout(() => this.render(), 100);
    }

    renderChart(actuals, plannedMonthlyRev) {
        const ctx = document.getElementById('trackerChart')?.getContext('2d');
        if (!ctx || typeof Chart === 'undefined') return;

        const labels = actuals.months.map(m => `شهر ${m.id}`);
        const actualData = actuals.months.map(m => m.revenue);
        const plannedData = actuals.months.map(() => plannedMonthlyRev);

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'الإيراد الفعلي',
                        data: actualData,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        fill: true,
                        tension: 0.3
                    },
                    {
                        label: 'الإيراد المخطط (دراسة الجدوى)',
                        data: plannedData,
                        borderColor: '#8a5f1c',
                        borderDash: [5, 5],
                        fill: false,
                        tension: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: getComputedStyle(document.documentElement).getPropertyValue('--c-text-main').trim() || '#1a1a1a' } }
                },
                scales: {
                    x: { ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--c-text-muted').trim() || '#555' } },
                    y: { ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--c-text-muted').trim() || '#555' }, grid: { color: 'rgba(0,0,0,0.06)' } }
                }
            }
        });
    }

    formatCurrency(n) {
        return new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(n || 0);
    }
}
