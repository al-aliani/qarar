/**
 * Sensitivity Analysis Component
 * Impact of changes in Revenue, Costs, and Prices
 */
import { calculateStudy as runFullModel } from '../core/engine.js';

export class SensitivityAnalysis {
    constructor(containerId, store) {
        this.container = document.getElementById(containerId);
        this.store = store;
    }

    render() {
        const state = this.store.getState();
        let baseResults = null;
        try {
            baseResults = runFullModel(state);
        } catch (e) {
            console.error('Financial Model Error:', e);
            this.container.innerHTML = '<div class="alert alert-danger">حدث خطأ في حساب النموذج المالي</div>';
            return;
        }

        const baseNPV = baseResults?.indicators?.npv || 0;

        // Helper to run scenario
        const runScenario = (params) => {
            try {
                const res = runFullModel(state, params);
                return res?.indicators?.npv || 0;
            } catch (e) {
                return 0;
            }
        };

        this.container.innerHTML = `
            <div class="sensitivity-analysis">
                <h2 class="section-title">🔍 تحليل الحساسية (Sensitivity Analysis)</h2>
                
                <div class="alert alert-warning mb-4" style="font-size: 0.9rem;">
                    <strong>⚠️ تحليل الحساسية إلزامي</strong> — أي دراسة بدونه تعتبر غير مكتملة. يقيس مدى تحمّل المشروع لتقلّبات الإيرادات والتكاليف.
                </div>

                <div class="card glass-card">
                    <p class="description">يقيس هذا التحليل مدى تأثر <strong>صافي القيمة الحالية</strong> بتغير العوامل الرئيسية للمشروع.</p>
                </div>

                <div class="sensitivity-grid">
                    ${this.renderSensitivityCard('تغير الإيرادات', baseNPV, runScenario, 'revenueChange')}
                    ${this.renderSensitivityCard('تغير التكاليف التشغيلية', baseNPV, runScenario, 'opexChange')}
                    ${this.renderSensitivityCard('تغير التكاليف الرأسمالية', baseNPV, runScenario, 'capexChange')}
                </div>

                <div class="card analysis-card mt-4">
                    <h3 class="card-title">مصفوفة التأثير على صافي القيمة الحالية</h3>
                    <div class="sensitivity-matrix-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>المتغير</th>
                                    <th>-20%</th>
                                    <th>-10%</th>
                                    <th>الأساسي</th>
                                    <th>+10%</th>
                                    <th>+20%</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${this.renderMatrixRow('الإيرادات', baseNPV, runScenario, 'revenueChange')}
                                ${this.renderMatrixRow('التكاليف التشغيلية', baseNPV, runScenario, 'opexChange')}
                                ${this.renderMatrixRow('التكاليف الرأسمالية', baseNPV, runScenario, 'capexChange')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="card analysis-card mt-4">
                    <h3 class="card-title">تحليل الحساسية بمستويات التشغيل</h3>
                    <p class="text-muted text-sm mb-3">تأثير مستوى التشغيل (نسبة الاستغلال) على النتائج — يعادل تخفيض الإيرادات</p>
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>مستوى التشغيل</th>
                                <th>صافي القيمة الحالية</th>
                                <th>ملاحظة</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>100% (أساسي)</td>
                                <td class="${baseNPV < 0 ? 'text-danger' : 'text-success'}">${this.formatCurrency(baseNPV)}</td>
                                <td>المستوى المستهدف</td>
                            </tr>
                            <tr>
                                <td>90%</td>
                                <td class="${runScenario({ revenueChange: -0.10 }) < 0 ? 'text-danger' : 'text-success'}">${this.formatCurrency(runScenario({ revenueChange: -0.10 }))}</td>
                                <td>يعادل -10% إيرادات</td>
                            </tr>
                            <tr>
                                <td>80%</td>
                                <td class="${runScenario({ revenueChange: -0.20 }) < 0 ? 'text-danger' : 'text-success'}">${this.formatCurrency(runScenario({ revenueChange: -0.20 }))}</td>
                                <td>يعادل -20% إيرادات</td>
                            </tr>
                            <tr>
                                <td>70%</td>
                                <td class="${runScenario({ revenueChange: -0.30 }) < 0 ? 'text-danger' : 'text-success'}">${this.formatCurrency(runScenario({ revenueChange: -0.30 }))}</td>
                                <td>يعادل -30% إيرادات</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    renderSensitivityCard(label, baseNPV, runner, paramKey) {
        // Calculate real impacts
        const downVP = runner({ [paramKey]: -0.10 }); // -10%
        const upVP = runner({ [paramKey]: 0.10 });    // +10%

        return `
            <div class="card sensitivity-item-card">
                <h4 class="mini-title">${label}</h4>
                <div class="sensitivity-range">
                    <div class="range-point negative">
                        <span>-10%</span>
                        <span class="${downVP < 0 ? 'text-danger' : 'text-success'}">${this.formatCurrency(downVP)}</span>
                    </div>
                    <div class="range-point base">
                        <span>الأساسي</span>
                        <span class="${baseNPV < 0 ? 'text-danger' : 'text-success'}">${this.formatCurrency(baseNPV)}</span>
                    </div>
                    <div class="range-point positive">
                        <span>+10%</span>
                        <span class="${upVP < 0 ? 'text-danger' : 'text-success'}">${this.formatCurrency(upVP)}</span>
                    </div>
                </div>
            </div>
        `;
    }

    renderMatrixRow(label, baseNPV, runner, paramKey) {
        const variations = [-0.20, -0.10, 0, 0.10, 0.20]; // Changed 0.2 to 0.20 for clarity

        return `
            <tr>
                <td>${label}</td>
                ${variations.map(v => {
            let val;
            if (v === 0) val = baseNPV;
            else val = runner({ [paramKey]: v });

            return `<td class="${val < 0 ? 'text-danger' : 'text-success'}">${this.formatCurrency(val)}</td>`;
        }).join('')}
            </tr>
        `;
    }

    formatCurrency(n) {
        if (!n && n !== 0) return '--';
        return new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(n);
    }
}
