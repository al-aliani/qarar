/**
 * Zakat & Tax View
 * Displays detailed calculation of Zakat and Corporate Tax
 */
import { calculateZakatAndTax, projectZakatAndTax } from '../core/zakatTax.js';
import { calculateStudy as runFullModel } from '../core/engine.js';
import { createTooltip } from '../utils/glossary.js';

export class ZakatView {
    constructor(containerId, store) {
        this.container = document.getElementById(containerId);
        this.store = store;
    }

    render() {
        if (!this.container) return;
        const state = this.store.getState();
        let results = null;
        try {
            results = runFullModel(state);
        } catch (err) { console.warn(err); }

        const saudiOwnership = (state.projectInfo?.saudiOwnership ?? 100) / 100;

        let projection = [];
        if (results && results.incomeStatement && results.balanceSheets) {
            projection = projectZakatAndTax(
                results.incomeStatement,
                results.balanceSheets,
                saudiOwnership
            );
        }

        this.container.innerHTML = `
            <div class="zakat-view animate-entry">
                <div class="header-section mb-6">
                    <h2 class="text-xl font-bold flex items-center gap-2">
                        🕌 الزكاة والضريبة
                    </h2>
                    <p class="text-muted">تقدير الالتزامات الزكوية والضريبية بناءً على هيكل الملكية والقوائم المالية.</p>
                </div>

                <!-- Ownership Settings -->
                <div class="card p-4 mb-6 bg-glass">
                    <div class="flex items-center justify-between">
                        <div>
                            <h3 class="font-bold">هيكل الملكية</h3>
                            <p class="text-sm text-muted">يؤثر في طريقة الاحتساب (زكاة vs ضريبة دخل)</p>
                        </div>
                        <div class="flex items-center gap-4">
                            <label class="text-sm" for="inpSaudiShare">نسبة الشريك السعودي:</label>
                            <input type="number" id="inpSaudiShare" class="form-input w-20 text-center" 
                                   min="0" max="100" value="${Math.round(saudiOwnership * 100)}">
                            <span class="text-sm">%</span>
                        </div>
                    </div>
                    <div class="mt-2 text-sm">
                        <span class="badge ${saudiOwnership === 1 ? 'badge--success' : 'badge--warning'}">
                            ${saudiOwnership === 1 ? 'زكاة فقط (100% سعودي)' : 'مختلط (زكاة + ضريبة)'}
                        </span>
                    </div>
                </div>

                <!-- Projection Table -->
                <div class="card overflow-hidden">
                    <h3 class="font-bold p-4 border-b">تقديرات 5 سنوات</h3>
                    <div class="table-container">
                        <table class="data-table w-full">
                            <thead>
                                <tr>
                                    <th>البيان</th>
                                    ${projection.map(year => `<th>السنة ${year.fiscalYear}</th>`).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>
                                        الوعاء الزكوي التقريبي
                                        ${createTooltip('ZAKAT_BASE')}
                                    </td>
                                    ${projection.map(y => `<td class="font-mono text-muted">${y.zakat.base.toLocaleString()}</td>`).join('')}
                                </tr>
                                <tr class="bg-glass-heavy">
                                    <td class="font-bold text-success">مبلغ الزكاة (2.5%)</td>
                                    ${projection.map(y => `<td class="font-bold text-success">${y.zakat.amount.toLocaleString()}</td>`).join('')}
                                </tr>
                                ${saudiOwnership < 1 ? `
                                    <tr>
                                        <td>الربح الخاضع للضريبة (أجنبي)</td>
                                        ${projection.map(y => `<td class="font-mono text-muted">${y.tax.taxableIncome.toLocaleString()}</td>`).join('')}
                                    </tr>
                                    <tr class="bg-glass-heavy">
                                        <td class="font-bold text-danger">ضريبة الدخل (20%)</td>
                                        ${projection.map(y => `<td class="font-bold text-danger">${y.tax.amount.toLocaleString()}</td>`).join('')}
                                    </tr>
                                ` : ''}
                                <tr class="row-total border-t-2">
                                    <td class="font-bold text-lg">إجمالي الالتزام</td>
                                    ${projection.map(y => `<td class="font-bold text-lg">${y.total.toLocaleString()}</td>`).join('')}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div class="p-4 text-xs text-muted">
                        * حساب تقريبي بناءً على المعادلة: الوعاء = حقوق الملكية + الديون الطويلة - الأصول الثابتة.
                    </div>
                </div>
            </div>
        `;

        this.bindEvents(saudiOwnership);
    }

    bindEvents(currentOwnership) {
        const input = this.container.querySelector('#inpSaudiShare');
        if (input) {
            input.addEventListener('change', (e) => {
                let val = parseFloat(e.target.value);
                if (val < 0) val = 0;
                if (val > 100) val = 100;

                // Update in store
                const projectInfo = this.store.getState().projectInfo || {};
                this.store.update('projectInfo', { ...projectInfo, saudiOwnership: val });
                this.render();
            });
        }
    }
}
