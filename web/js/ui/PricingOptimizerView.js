import { SECTIONS } from '../core/schema.js';
import { stepIndexById } from '../core/wizardSteps.js';
import { formatCurrency } from '../utils/formatters.js';
import { escapeHtml } from '../utils/escape.js';
import { toast } from '../utils/toast.js';

const toNumber = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export class PricingOptimizerView {
    constructor(containerId, store, onNavigate) {
        this.container = document.getElementById(containerId);
        this.store = store;
        this.onNavigate = onNavigate;
        this.stepIndex = 0;
    }

    render(stepIndex) {
        if (typeof stepIndex === 'number') this.stepIndex = stepIndex;
        if (!this.container) return;

        const state = this.store.getState ? this.store.getState() : this.store.get();
        const marketing = state.marketing || {};
        const settings = {
            targetGrossMargin: 0.55,
            willingnessToPay: 0,
            competitorAveragePrice: 0,
            positioning: 'balanced',
            notes: '',
            ...(marketing.pricingOptimization || {})
        };
        const streams = Array.isArray(state.revenue?.streams) ? state.revenue.streams : [];
        const rows = streams.map((stream, index) => this.analyzeStream(stream, settings, index));

        this.container.innerHTML = `
            <div class="pricing-optimizer animate-entry">
                <h2 class="section-title">التسعير المثالي</h2>
                <p class="text-muted mb-4">اضبط السعر قبل اعتماده في الإيرادات: تكلفة الوحدة، هامش الربح، سعر المنافسين، واستعداد العميل للدفع.</p>

                <div class="card mb-4">
                    <h3 class="text-gold mb-3">إعدادات التسعير</h3>
                    <div class="form-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;">
                        <div class="form-group">
                            <label for="pricingTargetMargin">هامش الربح المستهدف %</label>
                            <input id="pricingTargetMargin" class="input" type="number" min="5" max="95" step="1" value="${Math.round(toNumber(settings.targetGrossMargin, 0.55) * 100)}">
                        </div>
                        <div class="form-group">
                            <label for="pricingCompetitorPrice">متوسط سعر المنافسين</label>
                            <input id="pricingCompetitorPrice" class="input" type="number" min="0" step="0.01" value="${toNumber(settings.competitorAveragePrice, 0)}">
                        </div>
                        <div class="form-group">
                            <label for="pricingWtp">أعلى سعر يقبله العميل</label>
                            <input id="pricingWtp" class="input" type="number" min="0" step="0.01" value="${toNumber(settings.willingnessToPay, 0)}">
                        </div>
                        <div class="form-group">
                            <label for="pricingPositioning">تموضع السعر</label>
                            <select id="pricingPositioning" class="input input--select">
                                ${this.option('value', 'قيمة اقتصادية', settings.positioning)}
                                ${this.option('balanced', 'متوازن', settings.positioning)}
                                ${this.option('premium', 'علاوة/تميّز', settings.positioning)}
                            </select>
                        </div>
                    </div>
                    <div class="form-group mt-3">
                        <label for="pricingNotes">ملاحظات التسعير</label>
                        <textarea id="pricingNotes" class="input input--textarea" rows="2" placeholder="مثال: سعّرنا أقل من المنافس الرئيسي لجذب أول 3 أشهر...">${escapeHtml(settings.notes || '')}</textarea>
                    </div>
                </div>

                ${rows.length ? this.renderRows(rows) : this.renderEmptyState()}

                <div class="wizard-nav margin-top-lg">
                    <button class="btn btn--secondary btn-prev-step" type="button">السابق</button>
                    <button class="btn btn--primary btn-next-step" type="button">التالي</button>
                </div>
            </div>
        `;

        this.bindEvents(rows);
    }

    option(value, label, current) {
        return `<option value="${value}" ${value === current ? 'selected' : ''}>${label}</option>`;
    }

    analyzeStream(stream, settings, index) {
        const price = toNumber(stream.avgPrice ?? stream.price, 0);
        const variableCostRate = clamp(toNumber(stream.variableCostRate, 0.3), 0, 0.95);
        const storedUnitCost = toNumber(stream.unitCost ?? stream.variableCostPerUnit, NaN);
        const unitCost = Number.isFinite(storedUnitCost) ? storedUnitCost : (price > 0 ? price * variableCostRate : 0);
        const targetMargin = clamp(toNumber(settings.targetGrossMargin, 0.55), 0.05, 0.95);
        const competitor = toNumber(settings.competitorAveragePrice, 0);
        const willingness = toNumber(settings.willingnessToPay, 0);
        const floorPrice = unitCost / (1 - Math.max(0.1, Math.min(targetMargin - 0.15, 0.85)));
        const targetPrice = unitCost / (1 - targetMargin);
        const marketAnchor = [competitor, willingness].filter(n => n > 0).sort((a, b) => a - b);
        const marketCap = marketAnchor.length ? marketAnchor[0] : 0;
        const premiumMultiplier = settings.positioning === 'premium' ? 1.12 : settings.positioning === 'value' ? 0.92 : 1;
        const idealRaw = targetPrice * premiumMultiplier;
        const idealPrice = marketCap > 0 ? Math.min(idealRaw, marketCap) : idealRaw;
        const finalPrice = Math.max(floorPrice, idealPrice);
        const margin = finalPrice > 0 ? (finalPrice - unitCost) / finalPrice : 0;
        const monthlyRevenue = toNumber(stream.customersPerMonth, 0) * finalPrice;
        const currentMargin = price > 0 ? (price - unitCost) / price : 0;

        return {
            index,
            name: stream.service || stream.name || `مصدر إيراد ${index + 1}`,
            currentPrice: price,
            unitCost,
            currentMargin,
            floorPrice,
            targetPrice,
            idealPrice: finalPrice,
            margin,
            monthlyRevenue
        };
    }

    renderRows(rows) {
        return `
            <div class="card">
                <div class="table-wrapper">
                    <table class="service-comparison-table">
                        <thead>
                            <tr>
                                <th>مصدر الإيراد</th>
                                <th>السعر الحالي</th>
                                <th>تكلفة الوحدة</th>
                                <th>هامش حالي</th>
                                <th>سعر أدنى</th>
                                <th>السعر المقترح</th>
                                <th>إيراد شهري مقترح</th>
                                <th>إجراء</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows.map(row => `
                                <tr>
                                    <td>${escapeHtml(row.name)}</td>
                                    <td class="text-mono">${formatCurrency(row.currentPrice)}</td>
                                    <td>
                                        <input
                                            class="input input-unit-cost"
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value="${Math.round(row.unitCost * 100) / 100}"
                                            data-index="${row.index}"
                                            aria-label="تكلفة الوحدة"
                                            style="min-width:110px;"
                                        >
                                    </td>
                                    <td class="text-mono ${row.currentMargin >= 0.25 ? 'text-success' : 'text-danger'}">${this.formatPercent(row.currentMargin)}</td>
                                    <td class="text-mono">${formatCurrency(row.floorPrice)}</td>
                                    <td class="text-mono text-gold"><strong>${formatCurrency(row.idealPrice)}</strong><br><span class="text-muted text-xs">هامش ${this.formatPercent(row.margin)}</span></td>
                                    <td class="text-mono">${formatCurrency(row.monthlyRevenue)}</td>
                                    <td><button class="btn btn--secondary btn-sm btn-apply-price" type="button" data-index="${row.index}">تطبيق</button></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <p class="text-muted text-sm mt-3">السعر المقترح استرشادي: لا يقل عن حد تغطية التكلفة، ويحترم سقف المنافسين/استعداد الدفع عند إدخاله.</p>
            </div>
        `;
    }

    renderEmptyState() {
        return `
            <div class="card text-center">
                <p class="text-muted mb-3">لا توجد مصادر إيراد بعد. أضف منتجاتك وأسعارك في خطوة «المنتجات والخدمات» أولاً، ثم ارجع لهذه الخطوة لضبط السعر.</p>
                <button class="btn btn--secondary btn-go-offering" type="button">الانتقال للمنتجات والخدمات</button>
            </div>
        `;
    }

    bindEvents(rows) {
        const saveSettings = () => {
            const state = this.store.getState ? this.store.getState() : this.store.get();
            const marketing = state.marketing || {};
            this.store.update(SECTIONS.MARKETING, {
                ...marketing,
                pricingOptimization: {
                    targetGrossMargin: clamp(toNumber(this.container.querySelector('#pricingTargetMargin')?.value, 55) / 100, 0.05, 0.95),
                    competitorAveragePrice: toNumber(this.container.querySelector('#pricingCompetitorPrice')?.value, 0),
                    willingnessToPay: toNumber(this.container.querySelector('#pricingWtp')?.value, 0),
                    positioning: this.container.querySelector('#pricingPositioning')?.value || 'balanced',
                    notes: this.container.querySelector('#pricingNotes')?.value || ''
                }
            });
            this.render(this.stepIndex);
        };

        ['pricingTargetMargin', 'pricingCompetitorPrice', 'pricingWtp', 'pricingPositioning', 'pricingNotes'].forEach(id => {
            this.container.querySelector(`#${id}`)?.addEventListener('change', saveSettings);
        });

        this.container.querySelectorAll('.btn-apply-price').forEach(button => {
            button.addEventListener('click', () => {
                const row = rows.find(item => item.index === Number(button.dataset.index));
                if (!row) return;
                const state = this.store.getState ? this.store.getState() : this.store.get();
                const streams = Array.isArray(state.revenue?.streams) ? [...state.revenue.streams] : [];
                const nextPrice = Math.round(row.idealPrice * 100) / 100;
                streams[row.index] = {
                    ...streams[row.index],
                    avgPrice: nextPrice,
                    unitCost: Math.round(row.unitCost * 100) / 100,
                    variableCostRate: nextPrice > 0 ? Math.round((row.unitCost / nextPrice) * 10000) / 10000 : 0
                };
                this.store.updatePath(SECTIONS.REVENUE, 'streams', streams);
                toast.success('تم تطبيق السعر المقترح على مصدر الإيراد.');
                this.render(this.stepIndex);
            });
        });

        this.container.querySelectorAll('.input-unit-cost').forEach(input => {
            input.addEventListener('change', () => {
                const state = this.store.getState ? this.store.getState() : this.store.get();
                const streams = Array.isArray(state.revenue?.streams) ? [...state.revenue.streams] : [];
                const index = Number(input.dataset.index);
                if (!streams[index]) return;
                const unitCost = Math.max(0, toNumber(input.value, 0));
                const price = toNumber(streams[index].avgPrice ?? streams[index].price, 0);
                streams[index] = {
                    ...streams[index],
                    unitCost,
                    variableCostRate: price > 0 ? Math.round((unitCost / price) * 10000) / 10000 : toNumber(streams[index].variableCostRate, 0)
                };
                this.store.updatePath(SECTIONS.REVENUE, 'streams', streams);
                this.render(this.stepIndex);
            });
        });

        this.container.querySelector('.btn-go-offering')?.addEventListener('click', () => {
            const offeringIndex = stepIndexById('projectDetails');
            if (this.onNavigate && offeringIndex >= 0) this.onNavigate(offeringIndex);
        });
        this.container.querySelector('.btn-prev-step')?.addEventListener('click', () => {
            if (this.onNavigate) this.onNavigate(this.stepIndex - 1);
        });
        this.container.querySelector('.btn-next-step')?.addEventListener('click', () => {
            if (this.onNavigate) this.onNavigate(this.stepIndex + 1);
        });
    }

    formatPercent(value) {
        if (!Number.isFinite(value)) return '—';
        return `${Math.round(value * 1000) / 10}%`;
    }
}
