/**
 * Stress Test Component (Black Swan Analysis)
 * يقرأ الأرقام الفعلية من المحرك (calculateStudy) — لا يختلق شيئاً.
 * كان سابقاً يفبرك كل شيء: الاحتياط النقدي = 20% من الاستثمار، المصروف = 5% من CAPEX،
 * الإيراد = المصروف×1.2 — فيُنتج «أشهر بقاء» وهمية لا علاقة لها بالتدفق النقدي الحقيقي.
 */
import { calculateStudy as runFullModel } from '../core/engine.js';

// سيناريوهات صدمة جاهزة (إزاحة المبيعات %، إزاحة التكاليف %)
const PRESETS = [
    { key: 'recession', label: 'ركود سوقي', salesDrop: 30, costHike: 5, note: 'انكماش الطلب مع ثبات نسبي للتكاليف' },
    { key: 'costShock', label: 'صدمة أسعار المدخلات', salesDrop: 5, costHike: 30, note: 'قفزة في أسعار المواد الخام/الطاقة' },
    { key: 'severe', label: 'أزمة حادة', salesDrop: 50, costHike: 20, note: 'إغلاق جزئي + ارتفاع تكاليف (سيناريو البجعة السوداء)' }
];

export class StressTest {
    constructor(containerId, store) {
        this.container = document.getElementById(containerId);
        this.store = store;
    }

    render() {
        const state = this.store.get();
        const base = this.computeBase(state);

        if (!base.ok) {
            this.container.innerHTML = `
                <div class="stress-test animate-entry">
                    <h2 class="section-title">⛈️ اختبار التحمل (Stress Test)</h2>
                    <div class="alert alert--warning">
                        <p><strong>⚠️ لا تتوفر أرقام كافية لاختبار التحمل.</strong></p>
                        <p class="text-sm mt-2">أكمل الإيرادات والتكاليف (الرواتب والمصاريف التشغيلية) في الخطوات السابقة، ثم عُد لاختبار صمود المشروع أمام الأزمات.</p>
                    </div>
                </div>`;
            return;
        }

        // استرجاع آخر إعداد محفوظ إن وُجد
        const saved = state.stressTest || {};
        const salesDrop = Number.isFinite(saved.salesDrop) ? saved.salesDrop : 30;
        const costHike = Number.isFinite(saved.costHike) ? saved.costHike : 10;

        this.container.innerHTML = `
            <div class="stress-test animate-entry">
                <h2 class="section-title">⛈️ اختبار التحمل (Stress Test)</h2>
                <p class="text-muted mb-4">نقيس صمود مشروعك أمام الأزمات المفاجئة بأرقامك الفعلية — كم شهراً يصمد قبل نفاد السيولة إذا هبطت المبيعات و/أو ارتفعت التكاليف.</p>

                <div class="card glass-card mb-4">
                    <h3 class="card-title mb-2">الأساس (من نموذجك المالي — السنة الأولى)</h3>
                    <div class="stress-base-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;">
                        <div><div class="text-xs text-muted">الإيراد الشهري</div><div class="text-mono">${this.fmt(base.monthlyRevenue)}</div></div>
                        <div><div class="text-xs text-muted">تكاليف ثابتة/شهر</div><div class="text-mono">${this.fmt(base.monthlyFixed)}</div></div>
                        <div><div class="text-xs text-muted">تكاليف متغيرة/شهر</div><div class="text-mono">${this.fmt(base.monthlyVariable)}</div></div>
                        <div><div class="text-xs text-muted">خدمة الدين/شهر</div><div class="text-mono">${this.fmt(base.monthlyDebt)}</div></div>
                        <div><div class="text-xs text-muted">الاحتياطي النقدي المتاح</div><div class="text-mono text-gold">${this.fmt(base.cashReserve)}</div></div>
                    </div>
                    <p class="text-xs text-muted mt-2">الاحتياطي = رأس المال العامل المموَّل + النقد الافتتاحي. التكاليف المتغيرة تنخفض مع هبوط المبيعات (لأنها مرتبطة بها)، والثابتة تبقى.</p>
                </div>

                <div class="card glass-card mb-4">
                    <div class="flex flex-wrap gap-2 mb-4">
                        ${PRESETS.map(p => `<button type="button" class="btn btn--sm btn--secondary stress-preset" data-key="${p.key}" title="${p.note}">${p.label}</button>`).join('')}
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <label class="block mb-2">📉 انخفاض المبيعات المفاجئ</label>
                            <input type="range" class="input-range danger-slider" id="salesDrop" min="0" max="100" value="${salesDrop}">
                            <div class="flex-between font-bold text-danger"><span id="salesDropVal">${salesDrop}</span>% انخفاض</div>
                        </div>
                        <div>
                            <label class="block mb-2">📈 ارتفاع التكاليف</label>
                            <input type="range" class="input-range danger-slider" id="costHike" min="0" max="100" value="${costHike}">
                            <div class="flex-between font-bold text-danger"><span id="costHikeVal">${costHike}</span>% ارتفاع</div>
                        </div>
                    </div>
                </div>

                <div class="results-panel card">
                    <h3 class="card-title">نتائج التحمل</h3>
                    <div class="flex flex-col items-center justify-center p-6">
                        <div class="text-4xl font-bold mb-2" id="survivalMonths">--</div>
                        <div class="text-muted">أشهر البقاء (Runway) تحت الصدمة</div>
                        <div class="w-full rounded-full h-4 mt-4 overflow-hidden" style="background:var(--c-bg-app,#e5e7eb);">
                            <div id="survivalBar" class="h-4" style="width:50%;background:var(--c-success,#22c55e);"></div>
                        </div>
                    </div>
                    <div id="stressBurn" class="text-center text-sm text-muted mb-2"></div>
                    <div id="stressAdvice" class="alert alert--warning mt-2">جاري الحساب...</div>
                </div>
            </div>
        `;

        this.bindEvents(base);
        this.calculateSurvival(salesDrop, costHike, base);
    }

    /** يحسب الأساس الشهري الحقيقي من مخرجات المحرك. */
    computeBase(state) {
        let r = null;
        try { r = runFullModel(state); } catch (_) { r = null; }
        if (!r || !Array.isArray(r.incomeStatement) || !r.incomeStatement.length) return { ok: false };

        const y1 = r.incomeStatement[0];
        const monthlyRevenue = (y1.revenue || 0) / 12;
        const monthlyFixed = ((r.opex?.fixedAnnual) || (y1.fixedCosts || 0)) / 12;
        const monthlyVariable = ((r.opex?.variableAnnual) || (y1.variableCosts || 0)) / 12;
        const annualDebt = r.loanSchedule?.annualSummary?.find(s => s.year === 1)?.totalPayment || 0;
        const monthlyDebt = annualDebt / 12;

        // الاحتياطي النقدي الحقيقي: رأس المال العامل المموَّل + النقد الافتتاحي بالميزانية
        const openingCash = r.balanceSheets?.[0]?.assets?.current?.cash;
        const cashReserve = Math.max(
            Number(r.capex?.workingCapital) || 0,
            Number(openingCash) || 0
        );

        if (monthlyRevenue <= 0 && monthlyFixed <= 0) return { ok: false };
        return { ok: true, monthlyRevenue, monthlyFixed, monthlyVariable, monthlyDebt, cashReserve };
    }

    bindEvents(base) {
        const salesInput = this.container.querySelector('#salesDrop');
        const costInput = this.container.querySelector('#costHike');
        const sync = () => {
            this.container.querySelector('#salesDropVal').textContent = salesInput.value;
            this.container.querySelector('#costHikeVal').textContent = costInput.value;
            this.calculateSurvival(parseInt(salesInput.value), parseInt(costInput.value), base);
        };
        salesInput.addEventListener('input', sync);
        costInput.addEventListener('input', sync);
        this.container.querySelectorAll('.stress-preset').forEach(btn => {
            btn.addEventListener('click', () => {
                const p = PRESETS.find(x => x.key === btn.dataset.key);
                if (!p) return;
                salesInput.value = p.salesDrop;
                costInput.value = p.costHike;
                sync();
            });
        });
    }

    calculateSurvival(salesDropPct, costHikePct, base) {
        const sd = salesDropPct / 100, ch = costHikePct / 100;
        const impactedRevenue = base.monthlyRevenue * (1 - sd);
        // المتغيرة تتبع المبيعات هبوطاً وترتفع بصدمة التكاليف؛ الثابتة ترتفع بصدمة التكاليف فقط
        const impactedVariable = base.monthlyVariable * (1 - sd) * (1 + ch);
        const impactedFixed = base.monthlyFixed * (1 + ch);
        const netBurn = impactedFixed + impactedVariable + base.monthlyDebt - impactedRevenue;

        const months = netBurn <= 0 ? Infinity : (base.cashReserve / netBurn);

        // حفظ في الحالة كي يظهر في التقرير ولوحة القرار
        try {
            this.store.updatePath('stressTest', null, {
                salesDrop: salesDropPct, costHike: costHikePct,
                monthlyNetBurn: Math.round(netBurn),
                survivalMonths: Number.isFinite(months) ? Number(months.toFixed(1)) : null
            });
        } catch (_) {}

        const monthsEl = document.getElementById('survivalMonths');
        const bar = document.getElementById('survivalBar');
        const advice = document.getElementById('stressAdvice');
        const burnEl = document.getElementById('stressBurn');
        if (!monthsEl) return;

        burnEl.textContent = netBurn <= 0
            ? `صافي التدفق الشهري تحت الصدمة موجب (${this.fmt(-netBurn)}) — المشروع يغطّي مصاريفه.`
            : `صافي الحرق النقدي الشهري تحت الصدمة: ${this.fmt(netBurn)}`;

        if (!Number.isFinite(months)) {
            monthsEl.textContent = '∞ (يصمد)';
            monthsEl.className = 'text-4xl font-bold mb-2 text-success';
            bar.style.width = '100%'; bar.style.background = 'var(--c-success,#22c55e)';
            advice.className = 'alert alert--success mt-2';
            advice.textContent = '✅ مشروعك يبقى مغطّياً لمصاريفه حتى تحت هذه الصدمة — مرونة عالية.';
            return;
        }

        const m = months.toFixed(1);
        monthsEl.textContent = `${m} شهر`;
        bar.style.width = Math.min(months / 12 * 100, 100) + '%';
        if (months < 3) {
            monthsEl.className = 'text-4xl font-bold mb-2 text-danger';
            bar.style.background = 'var(--c-danger,#ef4444)';
            advice.className = 'alert alert--danger mt-2';
            advice.innerHTML = '🚨 <strong>خطر سيولة:</strong> الاحتياطي ينفد خلال أقل من 3 أشهر تحت هذه الصدمة. ارفع رأس المال العامل أو خفّض التكاليف الثابتة أو رتّب تسهيلاً ائتمانياً احتياطياً قبل الإطلاق.';
        } else if (months < 6) {
            monthsEl.className = 'text-4xl font-bold mb-2 text-warning';
            bar.style.background = 'var(--c-warning,#f59e0b)';
            advice.className = 'alert alert--warning mt-2';
            advice.innerHTML = '⚠️ <strong>وضع حرج:</strong> يُنصح أن يغطّي الاحتياطي 6 أشهر من صافي الحرق على الأقل. جهّز خطة طوارئ (خفض مؤقت للتكاليف، تأجيل توسّع).';
        } else {
            monthsEl.className = 'text-4xl font-bold mb-2 text-success';
            bar.style.background = 'var(--c-success,#22c55e)';
            advice.className = 'alert alert--success mt-2';
            advice.innerHTML = '✅ <strong>وضع جيد:</strong> سيولة كافية للصمود فترة معقولة تحت الصدمة مع هامش أمان.';
        }
    }

    fmt(n) {
        return new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(Math.round(n || 0));
    }
}
