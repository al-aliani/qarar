/**
 * Loan Schedule Display Component
 * Shows amortization table for bank loan.
 * يدعم تعديل معدل الفائدة ومدة السداد مع إعادة حساب الجدول والنموذج.
 */
import { calculateStudy as runFullModel } from '../core/engine.js';

export class LoanScheduleView {
    constructor(containerId, store) {
        this.container = document.getElementById(containerId);
        this.store = store;
    }

    render(loanSchedule) {
        if (!loanSchedule || !loanSchedule.annualSummary?.length) {
            this.container.innerHTML = `
                <div class="card glass-card">
                    <h3 class="card-title"><svg class="ic" aria-hidden="true"><use href="#i-table"/></svg> جدول سداد القرض</h3>
                    <div class="empty-state">
                        <p class="text-muted">لا يوجد قرض بنكي في هيكل التمويل</p>
                        <p class="text-xs text-muted">أضف قرض بنكي في قسم "مصادر التمويل" لعرض جدول السداد</p>
                    </div>
                </div>
            `;
            return;
        }

        const { loanAmount, annualRate, termYears, gracePeriodMonths, monthlyPayment, totalInterest, totalPayment, annualSummary } = loanSchedule;
        const ratePct = (annualRate != null ? annualRate * 100 : 8).toFixed(1);
        const termVal = termYears != null ? termYears : 5;

        this.container.innerHTML = `
            <div class="card glass-card">
                <h3 class="card-title"><svg class="ic" aria-hidden="true"><use href="#i-table"/></svg> جدول سداد القرض البنكي</h3>

                <!-- قابل للتعديل: معدل الفائدة، مدة السداد -->
                <div class="loan-params-edit">
                    <span class="loan-params-label">تعديل معاملات القرض:</span>
                    <div class="loan-params-fields">
                        <label class="loan-param-wrap">
                            <span class="loan-param-name">معدل الفائدة</span>
                            <input type="number" class="input loan-param-input loan-param-interest" value="${ratePct}" step="0.1" min="0" max="30" placeholder="8">
                            <span class="loan-param-unit">% سنوياً</span>
                        </label>
                        <label class="loan-param-wrap">
                            <span class="loan-param-name">مدة السداد</span>
                            <input type="number" class="input loan-param-input loan-param-term" value="${termVal}" min="1" max="25" step="1" placeholder="5">
                            <span class="loan-param-unit">سنة</span>
                        </label>
                    </div>
                </div>

                <!-- Summary Cards -->
                <div class="loan-summary-grid">
                    <div class="summary-card">
                        <span class="summary-label">مبلغ القرض</span>
                        <span class="summary-value">${this.formatCurrency(loanAmount)}</span>
                    </div>
                    <div class="summary-card">
                        <span class="summary-label">معدل الفائدة</span>
                        <span class="summary-value">${ratePct}%</span>
                    </div>
                    <div class="summary-card">
                        <span class="summary-label">مدة السداد</span>
                        <span class="summary-value">${termVal} سنوات</span>
                    </div>
                    <div class="summary-card">
                        <span class="summary-label">القسط الشهري</span>
                        <span class="summary-value highlight">${this.formatCurrency(monthlyPayment)}</span>
                    </div>
                    <div class="summary-card">
                        <span class="summary-label">إجمالي الفوائد</span>
                        <span class="summary-value text-warning">${this.formatCurrency(totalInterest)}</span>
                    </div>
                    <div class="summary-card">
                        <span class="summary-label">إجمالي المدفوعات</span>
                        <span class="summary-value">${this.formatCurrency(totalPayment)}</span>
                    </div>
                </div>

                <!-- Annual Table -->
                <div class="table-responsive mt-4">
                    <table class="data-table striped">
                        <thead>
                            <tr>
                                <th>السنة</th>
                                <th>إجمالي الأقساط</th>
                                <th>الأصل المسدد</th>
                                <th>الفوائد</th>
                                <th>الرصيد المتبقي</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${annualSummary.map(year => `
                                <tr>
                                    <td><strong>السنة ${year.year}</strong></td>
                                    <td>${this.formatCurrency(year.totalPayment)}</td>
                                    <td class="text-success">${this.formatCurrency(year.totalPrincipal)}</td>
                                    <td class="text-warning">${this.formatCurrency(year.totalInterest)}</td>
                                    <td>${this.formatCurrency(year.endingBalance)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                <!-- Visual Chart -->
                <div class="loan-chart mt-4">
                    <h4 class="text-sm font-bold mb-2">توزيع الأقساط (أصل vs فوائد)</h4>
                    <div class="stacked-bar-chart">
                        ${annualSummary.map(year => {
            const total = year.totalPrincipal + year.totalInterest;
            const principalPct = total > 0 ? (year.totalPrincipal / total * 100) : 50;
            return `
                                <div class="bar-row">
                                    <span class="bar-label">س${year.year}</span>
                                    <div class="bar-container">
                                        <div class="bar-principal" style="width: ${principalPct}%"></div>
                                        <div class="bar-interest" style="width: ${100 - principalPct}%"></div>
                                    </div>
                                </div>
                            `;
        }).join('')}
                    </div>
                    <div class="chart-legend">
                        <span class="legend-item"><span class="dot principal"></span> الأصل</span>
                        <span class="legend-item"><span class="dot interest"></span> الفوائد</span>
                    </div>
                </div>
            </div>

            <style>
                .loan-params-edit {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    gap: 12px;
                    padding: 12px 14px;
                    background: rgba(255,255,255,0.04);
                    border-radius: 8px;
                    margin-bottom: 16px;
                    border: 1px solid var(--border-color, rgba(255,255,255,0.1));
                }
                .loan-params-label { font-size: 0.85rem; color: var(--c-text-muted); white-space: nowrap; }
                .loan-params-fields { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; }
                .loan-param-wrap { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
                .loan-param-name { font-size: 0.8rem; color: var(--c-text-muted); }
                .loan-param-input { width: 80px; padding: 6px 8px; font-size: 0.9rem; }
                .loan-param-unit { font-size: 0.8rem; color: var(--c-text-muted); }
                .loan-summary-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
                    gap: 12px;
                    margin-bottom: 16px;
                }
                .summary-card {
                    background: rgba(255,255,255,0.05);
                    border-radius: 8px;
                    padding: 12px;
                    text-align: center;
                }
                .summary-label {
                    display: block;
                    font-size: 0.75rem;
                    color: var(--c-text-muted);
                    margin-bottom: 4px;
                }
                .summary-value {
                    font-size: 1.1rem;
                    font-weight: 600;
                }
                .summary-value.highlight {
                    color: var(--c-p-500);
                }
                .text-warning { color: #f59e0b; }
                .text-success { color: #10b981; }
                
                .stacked-bar-chart {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .bar-row {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .bar-label {
                    width: 30px;
                    font-size: 0.8rem;
                    color: var(--c-text-muted);
                }
                .bar-container {
                    flex: 1;
                    display: flex;
                    height: 20px;
                    border-radius: 4px;
                    overflow: hidden;
                }
                .bar-principal {
                    background: linear-gradient(90deg, #10b981, #34d399);
                }
                .bar-interest {
                    background: linear-gradient(90deg, #f59e0b, #fbbf24);
                }
                .chart-legend {
                    display: flex;
                    gap: 16px;
                    margin-top: 8px;
                    justify-content: center;
                }
                .legend-item {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 0.8rem;
                }
                .dot {
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                }
                .dot.principal { background: #10b981; }
                .dot.interest { background: #f59e0b; }
            </style>
        `;
        this.bindParamChangeHandlers();
    }

    bindParamChangeHandlers() {
        const interestEl = this.container.querySelector('.loan-param-interest');
        const termEl = this.container.querySelector('.loan-param-term');
        if (!interestEl || !termEl) return;

        const apply = () => {
            const state = this.store.getState ? this.store.getState() : this.store.get();
            const financing = { ...(state.financing || {}) };
            const sources = financing.sources || {};
            const bank = sources.bankLoan || {};
            const rateRaw = parseFloat(interestEl.value, 10);
            const termRaw = parseInt(termEl.value, 10);
            const newRate = (!isNaN(rateRaw) && rateRaw >= 0) ? rateRaw / 100 : (bank.interestRate ?? 0.08);
            const newTerm = (!isNaN(termRaw) && termRaw >= 1) ? Math.min(25, termRaw) : (bank.termYears ?? 5);
            const updated = { ...financing, sources: { ...sources, bankLoan: { ...bank, interestRate: newRate, termYears: newTerm } } };
            this.store.update('financing', updated);
            try {
                const results = runFullModel({ ...state, financing: updated });
                this.render(results.loanSchedule);
            } catch (e) {
                console.warn('LoanScheduleView: runFullModel after param change failed', e);
            }
        };

        interestEl.addEventListener('change', apply);
        termEl.addEventListener('change', apply);
    }

    formatCurrency(value) {
        if (!value && value !== 0) return '--';
        return new Intl.NumberFormat('ar-SA', {
            style: 'currency',
            currency: 'SAR',
            maximumFractionDigits: 0
        }).format(value);
    }
}
