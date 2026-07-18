import { calculateStudy as runFullModel } from '../core/engine.js';
import { animateCounter } from '../utils/ui.js';

export class LivePanel {
    constructor(store) {
        this.store = store;
        this.chart = null;
        this.lastResults = null;
        this._updateTimer = null;

        // اشتراك مُهدأ: كل notify كان يشغّل update() فوراً، وupdate تستدعي المحرك الكامل
        // (الذي يشغّل داخلياً ~17 نسخة من نفسه للحساسية/التورنادو/السيناريوهات) + هدم وإنشاء
        // مخطط Chart.js — فدفعة إدخال سريعة (لصق/تعبئة جدول) تعني مئات تشغيلات المحرك
        // وتباطؤاً يتفاقم مع طول الجلسة حتى يبدو المنتج مجمّداً (تدقيق ٢٠٢٦-٠٧-٠٦).
        this.store.subscribe(() => this.scheduleUpdate());
    }

    /** تهدئة زنادية: آخر تغيير في العاصفة هو الذي يشغّل الحساب — مرة واحدة. */
    scheduleUpdate() {
        if (this._updateTimer) clearTimeout(this._updateTimer);
        this._updateTimer = setTimeout(() => {
            this._updateTimer = null;
            this.update();
        }, 250);
    }

    /**
     * Initialize the live panel
     */
    init() {
        this.update();
    }

    /**
     * Update all live panel elements (panel + header KPI mini)
     */
    update() {
        try {
            const studyData = this.store.get();
            this.lastResults = runFullModel(studyData);

            this.updateNPV();
            this.updateIRR();
            this.updateChart();
            this.updateQAStatus();
        } catch (error) {
            console.warn('LivePanel update error:', error);
        }
    }

    /**
     * Update NPV display (panel + header mini)
     */
    updateNPV() {
        const el = document.getElementById('liveNPV');
        const headerEl = document.getElementById('headerKpiNpv');
        if (!this.lastResults) return;

        const npv = this.lastResults.indicators?.npv;
        const valueStr = Number.isFinite(npv)
            ? new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(npv)
            : '--';

        if (el) {
            if (Number.isFinite(npv)) {
                animateCounter(el, npv, { isCurrency: true });
                el.classList.remove('text-danger');
                if (npv < 0) el.classList.add('text-danger');
            } else {
                el.textContent = '--';
                el.setAttribute('data-value', '0');
            }
        }
        if (headerEl) {
            headerEl.textContent = valueStr;
            headerEl.classList.remove('text-danger');
            if (Number.isFinite(npv) && npv < 0) headerEl.classList.add('text-danger');
        }
        // شريط الجوّال الحيّ
        const mobileNpvEl = document.getElementById('mobileKpiNpv');
        if (mobileNpvEl) {
            mobileNpvEl.textContent = valueStr;
            mobileNpvEl.classList.toggle('text-danger', Number.isFinite(npv) && npv < 0);
        }
    }

    /**
     * Update IRR display (panel + header mini)
     */
    updateIRR() {
        const el = document.getElementById('liveIRR');
        const headerEl = document.getElementById('headerKpiIrr');
        if (!this.lastResults) return;

        const irr = this.lastResults.indicators?.irr;
        const valueStr = Number.isFinite(irr)
            ? (irr * 100).toFixed(1) + '%'
            : '--';
        // تدقيق 2026-07-08: كانت 5% ثابتة هنا (لوحة حية نشطة فعلياً) بينما عتبة القرار
        // الفعلية minIRR=15% — نفس دراسة تظهر ذهبية هنا وREVISE في لوحة القرار المجاورة.
        const minIRR = this.lastResults.assumptionsApplied?.thresholds?.minIRR ?? 0.15;

        if (el) {
            if (Number.isFinite(irr)) {
                animateCounter(el, irr, { isPercent: true });
                el.classList.remove('text-danger', 'text-gold');
                if (irr >= minIRR) el.classList.add('text-gold');
                else if (irr < 0) el.classList.add('text-danger');
            } else {
                el.textContent = '--';
                el.setAttribute('data-value', '0');
            }
        }
        if (headerEl) {
            headerEl.textContent = valueStr;
            headerEl.classList.remove('text-danger', 'text-gold');
            if (Number.isFinite(irr)) {
                if (irr >= minIRR) headerEl.classList.add('text-gold');
                else if (irr < 0) headerEl.classList.add('text-danger');
            }
        }
    }

    /**
     * Update live chart
     */
    updateChart() {
        const canvas = document.getElementById('liveChart');
        if (!canvas || !this.lastResults?.cashFlow) return;

        const cf = this.lastResults.cashFlow;
        const ctx = canvas.getContext('2d');

        // إعادة استخدام المخطط القائم بتحديث بياناته — الهدم/الإنشاء مع كل تغيير كان
        // يستنزف الذاكرة والمعالج تدريجياً (canvas contexts متراكمة) ويبطئ الجلسات الطويلة.
        if (this.chart) {
            if (this.chart.canvas === canvas) {
                this.chart.data.labels = cf.map(c => c.year === 0 ? 'البداية' : `س${c.year}`);
                this.chart.data.datasets[0].data = cf.map(c => c.cumulative);
                this.chart.update('none');
                return;
            }
            // الكانفس تغيّر (إعادة رسم للوحة) — الهدم هنا مشروع
            this.chart.destroy();
            this.chart = null;
        }

        if (typeof Chart !== 'undefined') {
            this.chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: cf.map(c => c.year === 0 ? 'البداية' : `س${c.year}`),
                    datasets: [{
                        label: 'التراكمي',
                        data: cf.map(c => c.cumulative),
                        borderColor: '#8a5f1c',
                        backgroundColor: 'rgba(138, 95, 28, 0.1)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 3,
                        pointBackgroundColor: '#8a5f1c'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: {
                        duration: 500
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (context) => {
                                    return this.formatCurrency(context.raw);
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            ticks: {
                                color: '#8b949e',
                                callback: (value) => {
                                    if (Math.abs(value) >= 1000000) {
                                        return (value / 1000000).toFixed(1) + 'M';
                                    }
                                    if (Math.abs(value) >= 1000) {
                                        return (value / 1000).toFixed(0) + 'K';
                                    }
                                    return value;
                                }
                            },
                            grid: { color: '#30363d' }
                        },
                        x: {
                            ticks: { color: '#8b949e' },
                            grid: { display: false }
                        }
                    }
                }
            });
        }
    }

    /**
     * Update QA status display
     */
    updateQAStatus() {
        const el = document.getElementById('qaStatusList');
        if (!el || !this.lastResults) return;

        const { indicators, decision, _meta, assumptionsApplied } = this.lastResults;
        const checks = [];
        // تدقيق 2026-07-08: كانت 5%/5-سنوات ثوابت هنا منفصلة عن عتبات القرار الفعلية
        // (minIRR=15%، maxPayback=3.5) — فتُظهر ✅ في اللوحة الحية بينما نفس الدراسة
        // REVISE في لوحة القرار/تحليل المستثمر المجاورين. الآن نفس المصدر الموحّد.
        const thresholds = assumptionsApplied?.thresholds || { minIRR: 0.15, maxPayback: 3.5 };

        if (_meta?.revenueFromBridge) {
            checks.push({ label: 'مصدر الإيرادات', pass: true, value: 'مشتق من قسم الخدمات <svg class="ic" aria-hidden="true"><use href="#i-info"/></svg>' });
        }

        // NPV Check
        if (Number.isFinite(indicators.npv)) {
            checks.push({
                label: 'صافي القيمة الحالية',
                pass: indicators.npv > 0,
                value: indicators.npv > 0 ? 'موجب <svg class="ic" aria-hidden="true"><use href="#i-check"/></svg>' : 'سالب <svg class="ic" aria-hidden="true"><use href="#i-warning"/></svg>'
            });
        }

        // IRR Check
        if (Number.isFinite(indicators.irr)) {
            const irrPass = indicators.irr >= thresholds.minIRR;
            checks.push({
                label: 'معدل العائد الداخلي',
                pass: irrPass,
                value: irrPass ? `> ${(thresholds.minIRR * 100).toFixed(0)}% <svg class="ic" aria-hidden="true"><use href="#i-check"/></svg>` : `< ${(thresholds.minIRR * 100).toFixed(0)}% <svg class="ic" aria-hidden="true"><use href="#i-warning"/></svg>`
            });
        }

        // Payback Period Check
        if (Number.isFinite(indicators.paybackPeriod) && indicators.paybackPeriod !== Infinity) {
            const paybackPass = indicators.paybackPeriod <= thresholds.maxPayback;
            checks.push({
                label: 'فترة الاسترداد',
                pass: paybackPass,
                value: paybackPass ? `${indicators.paybackPeriod.toFixed(1)} سنة <svg class="ic" aria-hidden="true"><use href="#i-check"/></svg>` : `${indicators.paybackPeriod.toFixed(1)} سنة <svg class="ic" aria-hidden="true"><use href="#i-warning"/></svg>`
            });
        }

        // Overall Decision
        checks.push({
            label: 'القرار النهائي',
            pass: decision === 'GO',
            value: decision === 'GO' ? '<svg class="ic" aria-hidden="true"><use href="#i-check"/></svg> مجدي' : '<svg class="ic" aria-hidden="true"><use href="#i-x"/></svg> غير مجدي'
        });

        // Render checks
        const headerQuality = document.getElementById('headerKpiQuality');
        const mobileDecision = document.getElementById('mobileKpiDecision');
        if (checks.length === 0) {
            el.innerHTML = `<span class="badge">جاري انتظار البيانات...</span>`;
            if (headerQuality) headerQuality.textContent = '--';
            if (mobileDecision) mobileDecision.textContent = 'في انتظار البيانات';
        } else {
            el.innerHTML = checks.map(check => `
                <div class="qa-check ${check.pass ? 'qa-pass' : 'qa-fail'}">
                    <span class="qa-label">${check.label}</span>
                    <span class="qa-value">${check.value}</span>
                </div>
            `).join('');
            const decisionCheck = checks.find(c => c.label === 'القرار النهائي');
            if (headerQuality) {
                headerQuality.textContent = decisionCheck ? decisionCheck.value : 'جاري...';
            }
            if (mobileDecision) {
                mobileDecision.textContent = decisionCheck ? decisionCheck.value : 'جاري...';
            }
        }
    }

    /**
     * Format currency in SAR
     */
    formatCurrency(n) {
        if (!Number.isFinite(n)) return '--';
        return new Intl.NumberFormat('ar-SA', {
            style: 'currency',
            currency: 'SAR',
            maximumFractionDigits: 0
        }).format(n);
    }
}
