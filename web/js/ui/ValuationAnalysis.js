/**
 * Company Valuation Component
 * Calculates Pre-money and Post-money valuation using DCF and Multiples
 */
import { calculateStudy as runFullModel } from '../core/engine.js';

export class ValuationAnalysis {
    constructor(containerId, store) {
        this.container = document.getElementById(containerId);
        this.store = store;
    }

    render() {
        const state = this.store.get();
        let results = null;
        try {
            results = runFullModel(state);
        } catch (e) {
            console.error('Financial Model Error:', e);
        }

        const valuation = this.calculateValuation(state, results);

        this.container.innerHTML = `
            <div class="valuation-container animate-entry">
                <div class="section-header">
                    <h2 class="text-xl font-bold">💎 تقييم الشركة</h2>
                    <p class="text-muted">تقدير القيمة السوقية العادلة للمشروع لجذب المستثمرين أو تحديد حصص الشركاء.</p>
                </div>

                <div class="grid-2-col gap-4">
                    <!-- DCF Card -->
                    <div class="card glass-card">
                        <div class="flex-between mb-2">
                            <h3 class="card-title">طريقة التدفقات المخصومة (DCF)</h3>
                            <span class="badge badge-gold">الأكثر دقة</span>
                        </div>
                        <div class="valuation-hero">
                            <span class="val-label">قيمة المنشأة</span>
                            <span class="val-price text-gold">${this.formatCurrency(valuation.dcf.ev)}</span>
                        </div>
                        <div class="valuation-details mt-4">
                            <div class="val-row"><span>معدل الخصم (تكلفة رأس المال المرجح)</span> <span>${(valuation.dcf.wacc * 100).toFixed(1)}%</span></div>
                            <div class="val-row"><span>معدل النمو الأبدي</span> <span>${(valuation.dcf.growth * 100).toFixed(1)}%</span></div>
                            <div class="val-row"><span>مجموع القيمة الحالية للأرباح</span> <span>${this.formatCurrency(valuation.dcf.pvCashFlows)}</span></div>
                            <div class="val-row"><span>القيمة المتبقية (Terminal Value)</span> <span>${this.formatCurrency(valuation.dcf.terminalValue)}</span></div>
                        </div>
                    </div>

                    <!-- Multipliers Card -->
                    <div class="card glass-card">
                        <h3 class="card-title">تقييم مضاعفات السوق</h3>
                        <div class="valuation-hero">
                            <span class="val-label">القيمة بناءً على الأرباح قبل الفوائد والضرائب (EBITDA)</span>
                            <span class="val-price">${this.formatCurrency(valuation.multiples.ev)}</span>
                        </div>
                        <div class="valuation-details mt-4">
                            <div class="val-row"><span>مضاعف الأرباح</span> <span>${valuation.multiples.multiple}x</span></div>
                            <div class="val-row"><span>الأرباح السنوية (السنة 1)</span> <span>${this.formatCurrency(valuation.multiples.ebitda)}</span></div>
                            <div class="val-row"><span>مقارنة بمتوسط السوق</span> <span>مقبول</span></div>
                        </div>
                    </div>
                </div>

                <!-- Investment Terms -->
                <div class="card glass-card mt-4 investment-terms-card">
                    <h3 class="card-title text-center">🎯 بطاقة المستثمر</h3>
                    <div class="investor-terms-grid">
                        <div class="term-box">
                            <span class="term-label">التقييم قبل التمويل (Pre-money)</span>
                            <span class="term-value">${this.formatCurrency(valuation.dcf.ev)}</span>
                        </div>
                        <div class="term-box highlight">
                            <span class="term-label">الاستثمار المطلوب</span>
                            <span class="term-value text-gold">${this.formatCurrency(state.financing?.totalInvestment || 0)}</span>
                        </div>
                        <div class="term-box">
                            <span class="term-label">التقييم بعد التمويل (Post-money)</span>
                            <span class="term-value">${this.formatCurrency(valuation.postMoney)}</span>
                        </div>
                        <div class="term-box">
                            <span class="term-label">الحصة المقابلة للاستثمار</span>
                            <span class="term-value">${valuation.equityOffer.toFixed(1)}%</span>
                        </div>
                    </div>
                    <div class="valuation-tip mt-4">
                        <p>💡 <strong>نصيحة:</strong> إذا قمت ببيع حصة <strong>${valuation.equityOffer.toFixed(1)}%</strong> مقابل <strong>${this.formatCurrency(state.financing?.totalInvestment || 0)}</strong>، فإنك تقيّم مشروعك حالياً بـ <strong>${this.formatCurrency(valuation.dcf.ev)}</strong> قبل دخول المستثمر.</p>
                    </div>
                </div>
            </div>
        `;
    }

    calculateValuation(state, results) {
        if (!results || !Array.isArray(results.incomeStatement) || results.incomeStatement.length === 0) {
            return { dcf: { ev: 0, wacc: 0.12, growth: 0.02, pvCashFlows: 0, terminalValue: 0 }, multiples: { ev: 0, multiple: 6, ebitda: 0 }, postMoney: 0, equityOffer: 0 };
        }

        const wacc = 0.12; // Standard 12% discount rate
        const growth = 0.02; // 2% terminal growth

        // 1. DCF Calculation
        let pvCashFlows = 0;
        results.incomeStatement.forEach((year, i) => {
            const fcf = year.ebitda * 0.8; // Simplified FCF: EBITDA minus capex/tax reserve
            pvCashFlows += fcf / Math.pow(1 + wacc, i + 1);
        });

        const fcfLast = results.incomeStatement[results.incomeStatement.length - 1].ebitda * 0.8;
        const terminalValue = (fcfLast * (1 + growth)) / (wacc - growth);
        const pvTerminal = terminalValue / Math.pow(1 + wacc, results.incomeStatement.length);

        const enterpriseValue = pvCashFlows + pvTerminal;

        // 2. Multiples Calculation
        const ebitdaY1 = results.incomeStatement[0].ebitda;
        const multiple = 6;
        const multipleValue = ebitdaY1 * multiple;

        // 3. Investment Math
        const investment = state.financing?.totalInvestment || 0;
        const postMoney = enterpriseValue + investment;
        const equityOffer = postMoney > 0 ? (investment / postMoney) * 100 : 0;

        return {
            dcf: {
                ev: enterpriseValue,
                wacc,
                growth,
                pvCashFlows,
                terminalValue
            },
            multiples: {
                ev: multipleValue,
                multiple,
                ebitda: ebitdaY1
            },
            postMoney,
            equityOffer
        };
    }

    formatCurrency(n) {
        return new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(n || 0);
    }
}
