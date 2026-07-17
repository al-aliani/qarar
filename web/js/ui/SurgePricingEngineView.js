/**
 * حساسية السعر: ماذا لو؟ — معاينة مختصرة، لا أداة تسعير موازية.
 *
 * أُعيدت صياغة هذا الملف بالكامل: النسخة السابقة كانت مخطط "محرك تسعير ديناميكي"
 * يربط الأسعار بالطقس ونفاد مخزون المنافسين لحظياً — لا يوجد أي مصدر بيانات حقيقي
 * لذلك في هذا المشروع (لا API طقس، لا مراقبة مخزون منافسين)، وكل الأرقام كانت وهمية.
 *
 * التدقيق (تريّاج) أكد أن هذا يكرر أداة حقيقية موجودة وشغّالة فعلاً:
 * web/js/ui/PricingOptimizerView.js (خطوة "التسعير المثالي" في المعالج، id: pricingOptimizer)
 * تحسب سعراً مقترحاً من بيانات دراستك الفعلية (تكلفة/سعر الوحدة من revenue.streams) + سعر
 * المنافسين واستعداد الدفع اللذين يُدخلهما المستخدم، وتتضمن أصلاً معامل سعر ذروة اختيارياً
 * ومعامل مرونة سعرية لتقدير تغيّر الطلب — وهو نفس مفهوم "Surge Pricing" في هذا المخطط، لكن
 * بلا حاجة لأي API خارجي.
 *
 * لذلك هذا الملف لم يعد يبني لوحة موازية لتلك الأداة (كان سيكرر منطقها أو يعرض رقماً
 * مختلفاً لنفس المفهوم في شاشتين). بدل ذلك هو معاينة للبيانات الحقيقية المحفوظة فعلاً
 * (أسعارك الحالية من revenue.streams + الافتراضات المحفوظة في marketing.pricingOptimization
 * إن وُجدت) مع اختصار مباشر لفتح الأداة الكاملة لتعديل أي شيء. حساب تغيّر الطلب المقدّر
 * يُستورد من الدالة النقية الحقيقية في PricingOptimizerView بدل إعادة كتابته هنا لتفادي رقمين
 * متعارضين لنفس المفهوم.
 */
import { computeElasticityVolumeChange } from './PricingOptimizerView.js';
import { stepIndexById } from '../core/wizardSteps.js';
import { formatCurrency, formatPercent, formatNumber } from '../utils/formatters.js';
import { escapeHtml } from '../utils/escape.js';

const toNumber = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};

export class SurgePricingEngineView {
    constructor(containerId, store) {
        this.container = document.getElementById(containerId);
        this.store = store;
    }

    async render() {
        if (!this.container) return;

        const state = this.store.get();
        const streams = Array.isArray(state?.revenue?.streams) ? state.revenue.streams : [];
        const settings = state?.marketing?.pricingOptimization || null;

        this.container.innerHTML = `
            <div class="surge-pricing-view" style="max-width:860px;margin:0 auto;padding:var(--s-4) 0;">
                <button type="button" id="btnSurgePricingBack" class="btn btn--ghost mb-4" style="display:inline-flex;align-items:center;gap:8px;">← العودة للوحة التحكم</button>
                <h2 class="section-title"><svg class="ic" aria-hidden="true"><use href="#i-scale"/></svg> حساسية السعر: ماذا لو؟</h2>
                <p class="text-muted mb-4">معاينة سريعة لأسعارك الحالية وتأثير تغيير السعر على الطلب، من نفس البيانات والافتراضات المحفوظة في أداة «التسعير المثالي». لتعديل الأسعار أو الافتراضات افتح الأداة الكاملة أدناه.</p>
                <div id="surgePricingBody"></div>
            </div>
        `;

        this.container.querySelector('#btnSurgePricingBack')?.addEventListener('click', () => {
            window.location.hash = '#/home';
        });

        const body = this.container.querySelector('#surgePricingBody');

        if (streams.length === 0) {
            body.innerHTML = `
                <div class="alert alert--info">
                    <p>لا توجد مصادر إيراد وأسعار بعد. أضف منتجاتك أو خدماتك وأسعارها، ثم اضبط افتراضات حساسية السعر من أداة «التسعير المثالي».</p>
                </div>
                <button type="button" class="btn btn--primary mt-3" id="btnOpenPricingOptimizer">فتح أداة التسعير المثالي</button>
            `;
            this.bindOpenTool(body);
            return this.container;
        }

        const rows = streams.map((stream, index) => {
            const price = toNumber(stream.avgPrice ?? stream.price, 0);
            const storedUnitCost = toNumber(stream.unitCost ?? stream.variableCostPerUnit, NaN);
            const rate = toNumber(stream.variableCostRate, NaN);
            let unitCost = null;
            if (Number.isFinite(storedUnitCost)) unitCost = storedUnitCost;
            else if (Number.isFinite(rate) && price > 0) unitCost = price * rate;
            const margin = (unitCost != null && price > 0) ? (price - unitCost) / price : null;
            return {
                name: stream.service || stream.name || `مصدر إيراد ${index + 1}`,
                price,
                unitCost,
                margin
            };
        });

        const rowsHtml = rows.map(row => `
            <tr style="border-bottom:1px solid var(--c-border);">
                <td style="padding:8px 12px;">${escapeHtml(row.name)}</td>
                <td style="padding:8px 12px;" class="text-mono">${formatCurrency(row.price)}</td>
                <td style="padding:8px 12px;" class="text-mono">${row.unitCost != null ? formatCurrency(row.unitCost) : '—'}</td>
                <td style="padding:8px 12px;" class="text-mono">${row.margin != null ? formatPercent(row.margin) : '—'}</td>
            </tr>
        `).join('');

        const sensitivityHtml = settings ? this.renderSensitivity(settings) : `
            <div class="alert alert--info">
                <p>لم تُضبط بعد افتراضات حساسية السعر (المرونة ومعامل سعر الذروة) — الجدول أعلاه يعرض أسعارك الحالية فقط.</p>
            </div>
        `;

        body.innerHTML = `
            <div class="card" style="padding:0;overflow-x:auto;margin-bottom:16px;">
                <table style="width:100%;border-collapse:collapse;">
                    <thead>
                        <tr style="text-align:right;border-bottom:1px solid var(--c-border);">
                            <th style="padding:8px 12px;">مصدر الإيراد</th>
                            <th style="padding:8px 12px;">السعر الحالي</th>
                            <th style="padding:8px 12px;">تكلفة الوحدة</th>
                            <th style="padding:8px 12px;">الهامش الحالي</th>
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>
            <div class="card glass-card mb-4">
                <h3 class="card-title mb-2">حساسية الطلب للسعر</h3>
                ${sensitivityHtml}
            </div>
            <button type="button" class="btn btn--primary" id="btnOpenPricingOptimizer">فتح أداة التسعير المثالي الكاملة</button>
        `;

        this.bindOpenTool(body);
        return this.container;
    }

    renderSensitivity(settings) {
        const elasticity = toNumber(settings.elasticity, NaN);
        const priceChangePercent = toNumber(settings.illustrativePriceChangePercent, NaN);
        const peakMultiplier = toNumber(settings.peakMultiplier, NaN);
        const hasElasticity = Number.isFinite(elasticity) && Number.isFinite(priceChangePercent);
        const volumeChangePercent = hasElasticity ? computeElasticityVolumeChange(elasticity, priceChangePercent) : null;

        const elasticityHtml = hasElasticity ? `
            <p class="text-sm mb-2">افتراضك المحفوظ لمعامل المرونة السعرية: <strong class="text-mono">${formatNumber(elasticity)}</strong>.
            عند تغيير السعر بنسبة <strong>${formatPercent(priceChangePercent / 100)}</strong>، يقدّر هذا الافتراض تغيّراً في الكمية المطلوبة بنحو
            <strong class="${volumeChangePercent < 0 ? 'text-danger' : 'text-success'}">${formatPercent(volumeChangePercent / 100)}</strong>.</p>
            <p class="text-xs text-muted mb-0">تقدير توضيحي مبني على افتراض أدخلته أنت في أداة التسعير المثالي، وليس قياساً فعلياً من مبيعاتك.</p>
        ` : `<p class="text-sm text-muted mb-0">لم يُضبط معامل المرونة السعرية بعد.</p>`;

        const peakHtml = Number.isFinite(peakMultiplier) && peakMultiplier > 1.001 ? `
            <p class="text-sm mt-3 mb-0">معامل سعر ساعة الذروة المحفوظ: <strong class="text-mono">${formatNumber(peakMultiplier)}×</strong> — يُطبَّق على السعر المقترح داخل أداة التسعير المثالي، وليس على السعر الحالي أعلاه.</p>
        ` : `<p class="text-sm text-muted mt-3 mb-0">معامل سعر ساعة الذروة غير مُفعّل حالياً.</p>`;

        return elasticityHtml + peakHtml;
    }

    bindOpenTool(scope) {
        scope.querySelector('#btnOpenPricingOptimizer')?.addEventListener('click', () => {
            const idx = stepIndexById('pricingOptimizer');
            if (idx >= 0) window.location.hash = '#/step/' + idx;
        });
    }
}
