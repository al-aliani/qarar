/**
 * Break-even Analysis Component
 */
import { calculateStudy as runFullModel } from '../core/engine.js';
import Chart from 'chart.js/auto';

// أيقونة من الـsprite الموحّد بدل إيموجي — تدقيق تنظيف 2026-07-11.
const icon = (id) => `<svg class="ic" aria-hidden="true"><use href="#${id}"/></svg>`;

export class BreakEvenAnalysis {
    constructor(containerId, store) {
        this.container = document.getElementById(containerId);
        this.store = store;
    }

    render() {
        const state = this.store.getState();
        let results = null;
        try {
            results = runFullModel(state);
        } catch (e) {
            console.error('Financial Model Error:', e);
        }

        if (!results) {
            this.container.innerHTML = `
                <div class="break-even-analysis">
                    <h2 class="section-title">تحليل نقطة التعادل</h2>
                    <div class="card analysis-card">
                        <p class="text-muted">${icon('i-warning')} لا توجد بيانات كافية لحساب نقطة التعادل. يرجى إكمال البيانات المالية الأساسية.</p>
                    </div>
                </div>
            `;
            return;
        }

        // Get data from income statement or indicators
        const incomeStatement = results.incomeStatement || [];
        const year1 = incomeStatement[0];
        
        if (!year1) {
            this.container.innerHTML = `
                <div class="break-even-analysis">
                    <h2 class="section-title">تحليل نقطة التعادل</h2>
                    <div class="card analysis-card">
                        <p class="text-muted">${icon('i-warning')} لا توجد بيانات للسنة الأولى. يرجى إكمال البيانات المالية الأساسية.</p>
                    </div>
                </div>
            `;
            return;
        }

        // نقطة التعادل: مصدر واحد فقط — إندكاتور المحرك (indicators.breakEvenPointValue).
        // كانت هذه الشاشة تعيد حسابها محلياً من fixedCosts/contributionMarginRatio، فتُنتج
        // رقماً قد يختلف عن رقم المحرك ولوحة القرار (نفس علة «ثلاث قيم مختلفة» الموثقة في
        // engine.js عند تعريف breakEvenValue — تدقيق دفعة 6).
        const bepValue = results.indicators?.breakEvenPointValue || 0;
        const totalRevenue = year1.revenue || 0;
        // عرض توزيع التكاليف فقط (لا يُستخدم لإعادة اشتقاق نقطة التعادل) — بنفس تعريف
        // المحرك (ثوابت السنة الأولى + الإهلاك) كي يتّسق مع رقم bepValue أعلاه.
        const fixedCosts = (year1.fixedCosts || 0) + (year1.depreciation || 0);
        // نفس علة DecisionDashboard.js (تدقيق 2026-07-20، الأسطر 97-101): breakEvenPointValue=0
        // يحتمل معنيين متعاكسين — تعادل مستحيل (هامش مساهمة ≤ 0) أو بلا تكاليف ثابتة — وإيراد صفر
        // ينتج نفس اللبس. بلا هذا الحارس تُعرض «هامش أمان 100%» ناجحاً حتى بلا إيراد فعلي؛ نعتمد
        // علَم المحرك breakEvenAchievable مع شرط الإيراد، فتُعرض حالة محايدة (—) بدل نسبة كاذبة.
        const breakEvenAchievable = results.indicators?.breakEvenAchievable !== false;
        const bepPercentage = (breakEvenAchievable && totalRevenue > 0) ? (bepValue / totalRevenue) : null;

        this.container.innerHTML = `
            <div class="break-even-analysis">
                <h2 class="section-title">تحليل نقطة التعادل</h2>
                
                <div class="card bep-hero animate-entry">
                    <div class="bep-chart-container">
                        <canvas id="bepCanvas"></canvas>
                    </div>
                    <div class="bep-summary">
                        <div class="bep-stat">
                            <span class="label">نقطة التعادل (سنوياً)</span>
                            <span class="value text-gold">${this.formatCurrency(bepValue)}</span>
                        </div>
                        <div class="bep-stat">
                            <span class="label">نسبة التعادل من الإيراد</span>
                            <span class="value">${bepPercentage === null ? '—' : (bepPercentage * 100).toFixed(1) + '%'}</span>
                        </div>
                        <div class="bep-stat">
                            <span class="label">هامش الأمان</span>
                            <span class="value ${bepPercentage === null ? 'text-muted' : (bepPercentage <= 1 ? 'text-success' : 'text-danger')}">${bepPercentage === null ? '—' : ((1 - bepPercentage) * 100).toFixed(1) + '%'}</span>
                        </div>
                    </div>
                </div>

                <div class="card analysis-card">
                    <h3 class="card-title">توزيع التكاليف (سنوياً)</h3>
                    <div class="cost-breakdown">
                        <div class="cost-item">
                            <span>التكاليف الثابتة للتعادل (تشمل الاستهلاك)</span>
                            <span>${this.formatCurrency(fixedCosts)}</span>
                        </div>
                        <div class="cost-item">
                            <span>الإيراد المتوقع (السنة الأولى)</span>
                            <span>${this.formatCurrency(totalRevenue)}</span>
                        </div>
                    </div>
                    <div class="bep-interpretation">
                        <p>${icon('i-lightbulb')} يحتاج المشروع لتحقيق مبيعات لا تقل عن <strong>${this.formatCurrency(bepValue)}</strong> سنوياً لتغطية كافة تكاليفه دون ربح أو خسارة.</p>
                        ${bepPercentage === null
                            ? `<p class="text-muted">${icon('i-warning')} لا يمكن حساب هامش الأمان — لا يوجد إيراد فعلي أو هامش مساهمة موجب للسنة الأولى بهذه الأرقام.</p>`
                            : bepPercentage <= 1
                                ? `<p>المشروع في منطقة الأمان بهامش <strong>${((1 - bepPercentage) * 100).toFixed(0)}%</strong> من إيراداته المستهدفة.</p>`
                                : `<p class="text-danger">${icon('i-warning')} الإيراد المتوقع <strong>دون نقطة التعادل بنسبة ${((bepPercentage - 1) * 100).toFixed(0)}%</strong> — المشروع يعمل بخسارة في السنة الأولى بهذه الأرقام. ارفع المبيعات أو خفّض الثوابت.</p>`}
                    </div>
                </div>
            </div>
        `;

        this.renderChart(fixedCosts, totalRevenue, bepValue);
    }

    renderChart(fixed, total, bepValue) {
        const ctx = document.getElementById('bepCanvas')?.getContext('2d');
        if (!ctx || typeof Chart === 'undefined') return;

        // ميل خط التكلفة مشتقّ من نقطة التعادل الفعلية (bepValue) لا من نسبة ثابتة 40%:
        // عند التعادل الإيراد = التكلفة، فنسبة التكلفة المتغيرة = 1 − fixed/bepValue.
        // بهذا يتقاطع الخطان بصرياً عند bepValue تماماً بدل تقاطع اعتباطي يناقض الرقم المعروض.
        const vcRatio = (Number.isFinite(bepValue) && bepValue > fixed)
            ? Math.max(0, Math.min(0.95, 1 - fixed / bepValue))
            : 0.4;
        const fractions = [0, 0.25, 0.5, 0.75, 1.0, 1.25];

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['0', '25%', '50%', '75%', '100%', '125%'],
                datasets: [
                    {
                        label: 'الإيرادات',
                        data: fractions.map((f) => total * f),
                        borderColor: '#8a5f1c',
                        borderWidth: 3,
                        fill: false
                    },
                    {
                        label: 'التكاليف المدمجة',
                        data: fractions.map((f) => fixed + vcRatio * total * f),
                        borderColor: '#ef4444',
                        borderDash: [5, 5],
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    // ألوان من متغيّرات السمة بدل '#fff' الثابت (كان نص وسيلة الإيضاح أبيض على خلفية فاتحة = غير مرئي)
                    legend: { labels: { color: getComputedStyle(document.documentElement).getPropertyValue('--c-text-main').trim() || '#1a1a1a' } }
                },
                scales: {
                    x: { ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--c-text-muted').trim() || '#555' } },
                    y: { ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--c-text-muted').trim() || '#555' } }
                }
            }
        });
    }

    formatCurrency(n) {
        return new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(n || 0);
    }
}
