/**
 * Sensitivity Analysis Component
 * Impact of changes in Revenue, Costs, and Prices
 */
import { calculateStudy as runFullModel } from '../core/engine.js';

// أيقونة من الـsprite الموحّد بدل إيموجي — تدقيق تنظيف 2026-07-11.
const icon = (id) => `<svg class="ic" aria-hidden="true"><use href="#${id}"/></svg>`;

export class SensitivityAnalysis {
    constructor(containerId, store) {
        this.container = document.getElementById(containerId);
        this.store = store;
    }

    render() {
        const state = this.store.getState();

        // ذاكرة تخزين مؤقت لهذه الدورة فقط: تُنشأ من جديد في بداية كل render() كي
        // لا تُسرّب نتائج قديمة بعد تغيّر البيانات. المفتاح = تمثيل JSON ثابت
        // لمعاملات السيناريو. نفس المعاملات (مثل revenueChange: -0.10) تتكرر بين
        // البطاقات الثلاث ومصفوفة التأثير وجدول مستويات التشغيل — بدل إعادة حساب
        // النموذج المالي الكامل ~22 مرة لكل عرض، نحسب كل تركيبة معاملات مرة واحدة
        // فقط ونعيد استخدام النتيجة. لا يُغيّر هذا أي رقم أو لون معروض.
        const scenarioCache = new Map();
        const runModel = (params) => {
            const key = JSON.stringify(params || {});
            if (scenarioCache.has(key)) return scenarioCache.get(key);
            const res = runFullModel(state, params);
            scenarioCache.set(key, res);
            return res;
        };

        let baseResults = null;
        try {
            baseResults = runModel(undefined);
        } catch (e) {
            console.error('Financial Model Error:', e);
            this.container.innerHTML = '<div class="alert alert-danger">حدث خطأ في حساب النموذج المالي</div>';
            return;
        }

        const baseNPV = baseResults?.indicators?.npv || 0;

        // Helper to run scenario
        // يُرجع null عند تعذّر الحساب (لا صفراً ملفَّقاً) — كي يظهر «--» محايداً لا رقماً أخضر زائفاً
        const runScenario = (params) => {
            try {
                const res = runModel(params);
                const npv = res?.indicators?.npv;
                return (npv == null || Number.isNaN(npv)) ? null : npv;
            } catch (e) {
                return null;
            }
        };
        // فئة اللون: محايدة عند التعذّر، أحمر للسالب، أخضر للموجب
        this._npvClass = (v) => (v == null ? 'text-muted' : (v < 0 ? 'text-danger' : 'text-success'));

        this.container.innerHTML = `
            <div class="sensitivity-analysis">
                <h2 class="section-title">تحليل الحساسية</h2>
                
                <div class="alert alert-warning mb-4" style="font-size: 0.9rem;">
                    <strong>${icon('i-warning')} تحليل الحساسية إلزامي</strong> — أي دراسة بدونه تعتبر غير مكتملة. يقيس مدى تحمّل المشروع لتقلّبات الإيرادات والتكاليف.
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
                            ${[
                                { label: '100% (أساسي)', npv: baseNPV, note: 'المستوى المستهدف' },
                                { label: '90%', npv: runScenario({ revenueChange: -0.10 }), note: 'يعادل -10% إيرادات' },
                                { label: '80%', npv: runScenario({ revenueChange: -0.20 }), note: 'يعادل -20% إيرادات' },
                                { label: '70%', npv: runScenario({ revenueChange: -0.30 }), note: 'يعادل -30% إيرادات' }
                            ].map(row => `
                            <tr>
                                <td>${row.label}</td>
                                <td class="${this._npvClass(row.npv)}">${this.formatCurrency(row.npv)}</td>
                                <td>${row.note}</td>
                            </tr>`).join('')}
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
                        <span class="${this._npvClass(downVP)}">${this.formatCurrency(downVP)}</span>
                    </div>
                    <div class="range-point base">
                        <span>الأساسي</span>
                        <span class="${this._npvClass(baseNPV)}">${this.formatCurrency(baseNPV)}</span>
                    </div>
                    <div class="range-point positive">
                        <span>+10%</span>
                        <span class="${this._npvClass(upVP)}">${this.formatCurrency(upVP)}</span>
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

            return `<td class="${this._npvClass(val)}">${this.formatCurrency(val)}</td>`;
        }).join('')}
            </tr>
        `;
    }

    formatCurrency(n) {
        if (!n && n !== 0) return '--';
        return new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(n);
    }
}
