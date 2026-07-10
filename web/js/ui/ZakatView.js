/**
 * Zakat & Tax View
 * تعرض الزكاة والضريبة من مخرجات المحرك مباشرة (نفس أرقام قائمة الدخل والتقارير).
 * هيكل الملكية يُقرأ ويُكتب في assumptions.foreignOwnershipRate — مصدر واحد للمحرك والواجهة.
 */
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

        // مصدر الملكية الموحد + سقوط للحقل القديم projectInfo.saudiOwnership
        const legacySaudi = state.projectInfo?.saudiOwnership;
        const foreignShare = Math.min(1, Math.max(0,
            Number(state.assumptions?.foreignOwnershipRate ??
                (legacySaudi != null ? 1 - (legacySaudi / 100) : 0))
        ));
        const saudiOwnership = 1 - foreignShare;

        // الوعاء المعروض = الوعاء الفعلي الذي حُسبت عليه الزكاة في المحرك (y.zakatBase —
        // طريقة مصادر الأموال النظامية أو الربح المعدل، الأعلى). كان يُعرض EBT بتسمية
        // «الوعاء» بينما المبلغ محسوب على وعاء آخر، فيظهر جدول ينقض نفسه:
        // وعاء 32,020 × 2.5% ≠ 6,409 (تدقيق ٢٠٢٦-٠٧-٠٦).
        const rows = (results?.incomeStatement || []).map(y => ({
            year: y.year,
            base: Math.max(0, y.zakatBase ?? Math.max(0, y.ebt || 0)),
            zakat: y.zakat || 0,
            tax: y.tax || 0,
            total: (y.zakat || 0) + (y.tax || 0)
        }));

        const fmt = (n) => Math.round(n).toLocaleString('ar-SA');

        this.container.innerHTML = `
            <div class="zakat-view animate-entry">
                <div class="header-section mb-6">
                    <h2 class="text-xl font-bold flex items-center gap-2">
                        الزكاة والضريبة
                    </h2>
                    <p class="text-muted">تقدير الالتزامات الزكوية والضريبية بناءً على هيكل الملكية — الأرقام مطابقة لقائمة الدخل والتقارير المُصدَّرة.</p>
                </div>

                <!-- Ownership Settings -->
                <div class="card p-4 mb-6 bg-glass">
                    <div class="flex items-center justify-between">
                        <div>
                            <h3 class="font-bold">هيكل الملكية</h3>
                            <p class="text-sm text-muted">الزكاة 2.5% على الحصة السعودية/الخليجية، وضريبة الدخل على حصة الأجانب فقط</p>
                        </div>
                        <div class="flex items-center gap-4">
                            <label class="text-sm" for="inpSaudiShare">نسبة الملكية السعودية:</label>
                            <input type="number" id="inpSaudiShare" class="form-input w-20 text-center"
                                   min="0" max="100" value="${Math.round(saudiOwnership * 100)}">
                            <span class="text-sm">%</span>
                        </div>
                    </div>
                    <div class="mt-2 text-sm">
                        <span class="badge ${foreignShare === 0 ? 'badge--success' : 'badge--warning'}">
                            ${foreignShare === 0 ? 'زكاة فقط (100% سعودي)' : `مختلط: زكاة على ${Math.round(saudiOwnership * 100)}% + ضريبة على ${Math.round(foreignShare * 100)}%`}
                        </span>
                    </div>
                </div>

                <!-- Projection Table -->
                <div class="card overflow-hidden">
                    <h3 class="font-bold p-4 border-b">تقديرات سنوات الدراسة</h3>
                    <div class="table-container">
                        ${rows.length === 0 ? `
                            <div class="p-6 text-center text-muted">
                                لا توجد بيانات مالية بعد — أكمل الإيرادات والتكاليف أولاً ليُحسب الالتزام.
                            </div>
                        ` : `
                        <table class="data-table w-full">
                            <thead>
                                <tr>
                                    <th>البيان</th>
                                    ${rows.map(y => `<th>السنة ${y.year}</th>`).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>
                                        الوعاء الزكوي النظامي (مصادر الأموال أو الربح المعدل — الأعلى)
                                        ${createTooltip('ZAKAT_BASE')}
                                    </td>
                                    ${rows.map(y => `<td class="font-mono text-muted">${fmt(y.base)}</td>`).join('')}
                                </tr>
                                <tr class="bg-glass-heavy">
                                    <td class="font-bold text-success">مبلغ الزكاة (2.5% × ${Math.round(saudiOwnership * 100)}%)</td>
                                    ${rows.map(y => `<td class="font-bold text-success">${fmt(y.zakat)}</td>`).join('')}
                                </tr>
                                ${foreignShare > 0 ? `
                                    <tr class="bg-glass-heavy">
                                        <td class="font-bold text-danger">ضريبة الدخل (${Math.round((state.assumptions?.taxRate ?? 0.20) * 100)}% × ${Math.round(foreignShare * 100)}%)</td>
                                        ${rows.map(y => `<td class="font-bold text-danger">${fmt(y.tax)}</td>`).join('')}
                                    </tr>
                                ` : ''}
                                <tr class="row-total border-t-2">
                                    <td class="font-bold text-lg">إجمالي الالتزام</td>
                                    ${rows.map(y => `<td class="font-bold text-lg">${fmt(y.total)}</td>`).join('')}
                                </tr>
                            </tbody>
                        </table>
                        `}
                    </div>
                    <div class="p-4 text-xs text-muted">
                        * الوعاء محسوب بطريقة مصادر الأموال (حقوق الملكية + الأرباح المحتجزة + رصيد القروض −
                        صافي الأصول الثابتة أول السنة) على ألا يقل عن الربح المعدل — منهجية هيئة الزكاة والضريبة
                        والجمارك. لذلك قد تُستحق زكاة حتى في سنة خاسرة (الوعاء موجب رغم الخسارة).
                        تقدير لأغراض الجدوى — راجع مختصاً زكوياً قبل الإقرار.
                    </div>
                </div>
            </div>
        `;

        this.bindEvents();
    }

    bindEvents() {
        const input = this.container.querySelector('#inpSaudiShare');
        if (input) {
            input.addEventListener('change', (e) => {
                let val = parseFloat(e.target.value);
                if (!Number.isFinite(val)) val = 100;
                if (val < 0) val = 0;
                if (val > 100) val = 100;

                // مصدر واحد: يكتب في الافتراضات التي يقرأها المحرك
                const assumptions = this.store.getState().assumptions || {};
                this.store.update('assumptions', { ...assumptions, foreignOwnershipRate: 1 - (val / 100) });
                this.render();
            });
        }
    }
}
