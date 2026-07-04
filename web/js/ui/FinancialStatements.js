/**
 * Financial Statements Component
 * Displays Income Statement, Cash Flow, and Balance Sheet for 5 years
 */
import { calculateStudy as runFullModel } from '../core/engine.js';

export class FinancialStatements {
    constructor(containerId, store, onNavigate) {
        this.container = document.getElementById(containerId);
        this.store = store;
        this.onNavigate = onNavigate;
        this.stepIndex = 0;
    }

    render(stepIndex) {
        if (typeof stepIndex === 'number') this.stepIndex = stepIndex;
        const state = this.store.getState();
        let results = null;
        let errorMessage = null;
        
        try {
            results = runFullModel(state);
            
            // Validate that we have minimum required data
            if (!results) {
                errorMessage = 'فشل في حساب النموذج المالي. يرجى التحقق من البيانات المدخلة.';
            } else if (!results.revenueProjection || results.revenueProjection.length === 0) {
                errorMessage = 'لا توجد بيانات إيرادات. يرجى إضافة مصادر الإيرادات في خطوة "مصادر الإيرادات".';
            } else if (!results.capex || results.capex.total === 0) {
                errorMessage = 'لا توجد بيانات استثمارات. يرجى إضافة التكاليف الرأسمالية في خطوة "الدراسة الفنية".';
            }
        } catch (e) {
            console.error('Financial Model Error:', e);
            errorMessage = `خطأ في الحساب: ${e.message || 'خطأ غير معروف'}`;
        }
        
        // Show error message if any
        if (errorMessage) {
            this.container.innerHTML = `
                <div class="financial-statements">
                    <h2 class="section-title">📊 القوائم المالية التقديرية</h2>
                    <div class="card analysis-card">
                        <div class="alert alert--warning">
                            <p><strong>⚠️ ${errorMessage}</strong></p>
                            <p class="text-sm mt-2">تأكد من إكمال:</p>
                            <ul class="text-sm mt-2" style="list-style: disc; padding-right: 20px;">
                                <li>مصادر الإيرادات (خطوة "مصادر الإيرادات")</li>
                                <li>التكاليف الرأسمالية (خطوة "الدراسة الفنية")</li>
                                <li>التكاليف التشغيلية (خطوة "الموارد البشرية" و "الموارد اللوجستية" و "الموارد الإدارية")</li>
                            </ul>
                        </div>
                    </div>
                    <div class="wizard-nav margin-top-lg">
                        <button class="btn btn--secondary btn-prev-step">السابق</button>
                        <button class="btn btn--primary btn-next-step">التالي</button>
                    </div>
                </div>
            `;
            this.bindEvents();
            return;
        }

        this.container.innerHTML = `
            <div class="financial-statements">
                <h2 class="section-title">📊 القوائم المالية التقديرية</h2>
                
                <div class="card analysis-card">
                    <h3 class="card-title">💵 قائمة الدخل التقديرية (5 سنوات)</h3>
                    ${this.renderIncomeStatement(results)}
                </div>

                <div class="card analysis-card">
                    <h3 class="card-title">🌊 قائمة التدفقات النقدية</h3>
                    ${this.renderCashFlow(results)}
                </div>

                <div class="card analysis-card">
                    <h3 class="card-title">📅 قائمة التدفقات النقدية ربع سنوية (السنة الأولى)</h3>
                    <p class="text-muted text-sm mb-3">توزيع الإيرادات: الربع الأول 10%، باقي الأرباع 30% لكل ربع (تمثيل البداية البطيئة)</p>
                    ${this.renderQuarterlyCashFlow(results)}
                </div>

                <div class="card analysis-card">
                    <h3 class="card-title">⚖️ الميزانية العمومية التقديرية (الافتتاحية)</h3>
                    ${this.renderBalanceSheet(results, state)}
                </div>

                <!-- Navigation -->
                <div class="wizard-nav margin-top-lg">
                    <button class="btn btn--secondary btn-prev-step">السابق</button>
                    <button class="btn btn--primary btn-next-step">التالي</button>
                </div>
            </div>
        `;

        this.bindEvents();
    }

    bindEvents() {
        this.container.querySelector('.btn-prev-step')?.addEventListener('click', () => {
            if (this.onNavigate) this.onNavigate(this.stepIndex - 1);
        });
        this.container.querySelector('.btn-next-step')?.addEventListener('click', () => {
            if (this.onNavigate) this.onNavigate(this.stepIndex + 1);
        });
    }

    renderIncomeStatement(results) {
        if (!results || !results.incomeStatement || !Array.isArray(results.incomeStatement) || results.incomeStatement.length === 0) {
            return '<p class="text-muted">بيانات غير كافية. يرجى إكمال البيانات المالية الأساسية (الإيرادات، التكاليف، الاستثمارات).</p>';
        }

        const incomeStatement = results.incomeStatement;

        return `
            <div class="table-container scrollable-x">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>البند</th>
                            ${incomeStatement.map((yearData) => `<th>السنة ${yearData.year}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>إجمالي الإيرادات</td>
                            ${incomeStatement.map(y => `<td class="text-mono">${this.formatCurrency(y.revenue)}</td>`).join('')}
                        </tr>
                        <tr>
                            <td>(-) التكاليف المتغيرة</td>
                            ${incomeStatement.map(y => `<td class="text-mono">${this.formatCurrency(-y.variableCosts)}</td>`).join('')}
                        </tr>
                        <tr>
                            <td>(-) التكاليف الثابتة</td>
                            ${incomeStatement.map(y => `<td class="text-mono">${this.formatCurrency(-y.fixedCosts)}</td>`).join('')}
                        </tr>
                        <tr class="row-subtotal">
                            <td><strong>EBITDA</strong></td>
                            ${incomeStatement.map(y => `<td class="text-mono"><strong>${this.formatCurrency(y.ebitda)}</strong></td>`).join('')}
                        </tr>
                        <tr>
                            <td>(-) الإهلاك</td>
                            ${incomeStatement.map(y => `<td class="text-mono">${this.formatCurrency(-y.depreciation)}</td>`).join('')}
                        </tr>
                        <tr>
                            <td>(-) مصروفات الفوائد</td>
                            ${incomeStatement.map(y => `<td class="text-mono">${this.formatCurrency(-(y.interestExpense || 0))}</td>`).join('')}
                        </tr>
                        <tr>
                            <td>الأرباح قبل الضريبة (EBT)</td>
                            ${incomeStatement.map(y => `<td class="text-mono">${this.formatCurrency(y.ebt || y.ebit)}</td>`).join('')}
                        </tr>
                        <tr>
                            <td>(-) الضريبة</td>
                            ${incomeStatement.map(y => `<td class="text-mono">${this.formatCurrency(-y.tax)}</td>`).join('')}
                        </tr>
                        <tr class="row-total">
                            <td><strong>صافي الربح</strong></td>
                            ${incomeStatement.map(y => `<td class="text-mono"><strong>${this.formatCurrency(y.netIncome)}</strong></td>`).join('')}
                        </tr>
                        <tr>
                            <td>هامش الربح الصافي</td>
                            ${incomeStatement.map(y => `<td>${((y.netMargin || 0) * 100).toFixed(1)}%</td>`).join('')}
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
    }

    renderQuarterlyCashFlow(results) {
        if (!results || !results.incomeStatement || results.incomeStatement.length === 0) {
            return '<p class="text-muted">بيانات غير كافية.</p>';
        }
        const y1 = results.incomeStatement[0];
        const totalInvestment = results.capex?.total ?? 0;
        const annualRevenue = y1.revenue || 0;
        const annualOpex = (y1.fixedCosts || 0) + (y1.variableCosts || 0);
        const annualDepreciation = y1.depreciation || 0;
        // توزيع الإيرادات: Q1=10%, Q2=30%, Q3=30%, Q4=30%
        const qShares = [0.10, 0.30, 0.30, 0.30];
        const qRevenue = qShares.map(s => annualRevenue * s);
        const qOpex = qShares.map(() => annualOpex / 4);
        let cashBalance = -totalInvestment;
        const rows = [];
        for (let i = 0; i < 4; i++) {
            const operatingCF = qRevenue[i] - qOpex[i]; // نقدي: إيرادات - نفقات
            cashBalance += operatingCF;
            rows.push({
                quarter: `الربع ${i + 1}`,
                revenue: qRevenue[i],
                opex: -qOpex[i],
                operatingCF,
                cashBalance
            });
        }
        return `
            <div class="table-container scrollable-x">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>الفترة</th>
                            <th>الإيرادات</th>
                            <th>(-) النفقات التشغيلية</th>
                            <th>التدفق التشغيلي</th>
                            <th>الرصيد التراكمي</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>بداية السنة (بعد الاستثمار)</td>
                            <td>-</td>
                            <td>-</td>
                            <td>-</td>
                            <td class="text-mono text-danger">${this.formatCurrency(-totalInvestment)}</td>
                        </tr>
                        ${rows.map(r => `
                            <tr>
                                <td>${r.quarter}</td>
                                <td class="text-mono">${this.formatCurrency(r.revenue)}</td>
                                <td class="text-mono">${this.formatCurrency(r.opex)}</td>
                                <td class="text-mono ${r.operatingCF >= 0 ? 'text-success' : 'text-danger'}">${this.formatCurrency(r.operatingCF)}</td>
                                <td class="text-mono ${r.cashBalance < 0 ? 'text-danger' : 'text-success'}">${this.formatCurrency(r.cashBalance)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    renderCashFlow(results) {
        if (!results || !results.cashFlow || !Array.isArray(results.cashFlow) || results.cashFlow.length === 0) {
            return '<p class="text-muted">بيانات غير كافية. يرجى إكمال البيانات المالية الأساسية (الإيرادات، التكاليف، الاستثمارات).</p>';
        }

        const cashFlow = results.cashFlow;
        const incomeStatement = results.incomeStatement || [];

        return `
            <div class="table-container scrollable-x">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>الفترة</th>
                            ${cashFlow.map(cf => `<th>${cf.year === 0 ? 'التأسيس' : 'السنة ' + cf.year}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>صافي الربح</td>
                            ${cashFlow.map((cf, idx) => {
                                if (idx === 0) return '<td class="text-mono">-</td>';
                                const income = incomeStatement[idx - 1];
                                return `<td class="text-mono">${this.formatCurrency(income?.netIncome || 0)}</td>`;
                            }).join('')}
                        </tr>
                        <tr>
                            <td>(+) الإهلاك</td>
                            ${cashFlow.map((cf, idx) => {
                                if (idx === 0) return '<td class="text-mono">-</td>';
                                const income = incomeStatement[idx - 1];
                                return `<td class="text-mono">${this.formatCurrency(income?.depreciation || 0)}</td>`;
                            }).join('')}
                        </tr>
                        <tr>
                            <td>(-) الاستثمار الأولي</td>
                            ${cashFlow.map(cf => `<td class="text-mono ${cf.year === 0 ? 'text-danger' : ''}">${cf.year === 0 ? this.formatCurrency(cf.cashFlow) : '-'}</td>`).join('')}
                        </tr>
                        <tr class="row-total">
                            <td><strong>صافي التدفق النقدي</strong></td>
                            ${cashFlow.map(cf => `<td class="text-mono"><strong>${this.formatCurrency(cf.cashFlow)}</strong></td>`).join('')}
                        </tr>
                        <tr>
                            <td>الرصيد التراكمي</td>
                            ${cashFlow.map(cf => `<td class="text-mono">${this.formatCurrency(cf.cumulative || 0)}</td>`).join('')}
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
    }

    renderBalanceSheet(results, state) {
        if (!results) {
            return '<p class="text-muted">بيانات غير كافية. يرجى إكمال البيانات المالية الأساسية (الإيرادات، التكاليف، الاستثمارات).</p>';
        }

        // Try to get from results first, then fallback to state
        const balanceSheets = results.balanceSheets;
        const capex = results.capex || {};
        const financing = state.financing || {};
        const technical = state.technical || {};

        // Calculate CAPEX from technical data if not in results
        let capexTotal = capex.total || 0;
        if (capexTotal === 0) {
            capexTotal = (technical.buildings?.reduce((s, b) => s + ((b.total || b.price || 0) * (b.quantity || 1)), 0) || 0) +
                (technical.equipment?.reduce((s, b) => s + ((b.total || b.price || 0) * (b.quantity || 1)), 0) || 0) +
                (technical.furniture?.reduce((s, b) => s + ((b.total || b.price || 0) * (b.quantity || 1)), 0) || 0);
        }

        // Use first balance sheet if available, otherwise use opening balance
        const openingBalance = balanceSheets && balanceSheets.length > 0 ? balanceSheets[0] : null;

        const assets = {
            cash: openingBalance?.assets?.current?.cash || capex.workingCapital || (capexTotal * 0.1),
            fixed: openingBalance?.assets?.fixed?.net || capexTotal,
            total: openingBalance?.assets?.total || capexTotal
        };

        const liabilities = {
            loans: openingBalance?.liabilities?.loans || financing.sources?.bankLoan?.amount || 0,
            total: openingBalance?.liabilities?.total || (financing.sources?.bankLoan?.amount || 0)
        };

        const equity = {
            capital: openingBalance?.equity?.capital || financing.sources?.equity?.amount || (capexTotal - liabilities.loans),
            retained: openingBalance?.equity?.retainedEarnings || 0,
            total: openingBalance?.equity?.total || (capexTotal - liabilities.loans)
        };

        return `
            <div class="balance-sheet-grid">
                <div class="balance-section">
                    <h4>الأصول</h4>
                    <div class="balance-item">
                        <span>نقد وما في حكمه</span>
                        <span class="text-mono">${this.formatCurrency(assets.cash)}</span>
                    </div>
                    <div class="balance-item">
                        <span>الأصول الثابتة (صافي)</span>
                        <span class="text-mono">${this.formatCurrency(assets.fixed)}</span>
                    </div>
                    <div class="balance-total">
                        <span><strong>إجمالي الأصول</strong></span>
                        <span class="text-mono text-gold"><strong>${this.formatCurrency(assets.total)}</strong></span>
                    </div>
                </div>
                <div class="balance-section">
                    <h4>الالتزامات وحقوق الملكية</h4>
                    <div class="balance-item">
                        <span>قروض بنكية</span>
                        <span class="text-mono">${this.formatCurrency(liabilities.loans)}</span>
                    </div>
                    <div class="balance-item">
                        <span>رأس المال المساهم</span>
                        <span class="text-mono">${this.formatCurrency(equity.capital)}</span>
                    </div>
                    ${(equity.retained || 0) > 0 ? `
                    <div class="balance-item">
                        <span>الأرباح المحتجزة</span>
                        <span class="text-mono">${this.formatCurrency(equity.retained)}</span>
                    </div>
                    ` : ''}
                    <div class="balance-total">
                        <span><strong>إجمالي الخصوم وحقوق الملكية</strong></span>
                        <span class="text-mono text-gold"><strong>${this.formatCurrency(liabilities.total + equity.total)}</strong></span>
                    </div>
                </div>
            </div>
        `;
    }

    formatCurrency(n) {
        return new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(n || 0);
    }
}
