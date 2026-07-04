/**
 * Risk Matrix Component
 * Visual risk matrix with interactive risk register
 */

import { generateTableSuggestions } from '../services/AIConnector.js';

export class RiskMatrix {
    constructor(containerId, store, onNavigate) {
        this.container = document.getElementById(containerId);
        this.store = store;
        this.onNavigate = onNavigate;
        this.stepIndex = 0;
        this.isGenerating = false;
    }

    render(stepIndex) {
        if (typeof stepIndex === 'number') this.stepIndex = stepIndex;
        const state = this.store.getState();
        const riskAnalysis = state.riskAnalysis || {};
        const risks = riskAnalysis.risks || [];

        this.container.innerHTML = `
            <div class="risk-analysis">
                <h2 class="section-title">⚠️ تحليل المخاطر</h2>
                <div class="alert alert--info mb-4" style="font-size: 0.85rem;">
                    <strong>مخاطر التقنية:</strong> المشاريع التقنية تحمل مخاطر عالية — تقنية جديدة قد تنسف المشروع (مثال: نوكيا). إذا مشروعك يعتمد على التقنية، أضف خطر «اختراق تقني / تقادم تقني» من نوع تقني.
                </div>
                
                <!-- Risk Matrix Visual -->
                <div class="card analysis-card">
                    <h3 class="card-title">مصفوفة المخاطر</h3>
                    <p class="text-muted text-sm mb-3">توزيع المخاطر حسب الاحتمالية والأثر</p>
                    ${this.renderMatrix(risks)}
                </div>

                <!-- Risk Register -->
                <div class="card analysis-card">
                    <h3 class="card-title">سجل المخاطر</h3>
                    <p class="text-muted text-sm mb-3">قائمة تفصيلية بالمخاطر وخطط المواجهة</p>
                    ${this.renderRiskRegister(risks)}
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

    renderMatrix(risks) {
        // Create 3x3 matrix cells
        const matrix = {
            'high-high': [], 'high-medium': [], 'high-low': [],
            'medium-high': [], 'medium-medium': [], 'medium-low': [],
            'low-high': [], 'low-medium': [], 'low-low': []
        };

        risks.forEach((risk, idx) => {
            const key = `${risk.probability || 'low'}-${risk.impact || 'low'}`;
            if (matrix[key]) {
                matrix[key].push({ ...risk, idx });
            }
        });

        const getCellClass = (prob, impact) => {
            const probScore = { low: 1, medium: 2, high: 3 };
            const impactScore = { low: 1, medium: 3, high: 5 };
            const score = probScore[prob] * impactScore[impact];
            if (score >= 9) return 'risk-critical';
            if (score >= 6) return 'risk-high';
            if (score >= 3) return 'risk-medium';
            return 'risk-low';
        };

        return `
            <div class="risk-matrix-container">
                <div class="risk-matrix-grid">
                    <div class="matrix-y-label">
                        <span>الأثر</span>
                    </div>
                    <div class="matrix-content">
                        <!-- Y Axis Labels -->
                        <div class="y-labels">
                            <span>عالي</span>
                            <span>متوسط</span>
                            <span>منخفض</span>
                        </div>
                        <!-- Matrix Cells -->
                        <div class="matrix-cells">
                            ${['high', 'medium', 'low'].map(impact => `
                                <div class="matrix-row">
                                    ${['low', 'medium', 'high'].map(prob => {
            const key = `${prob}-${impact}`;
            const cellRisks = matrix[key];
            return `
                                            <div class="matrix-cell ${getCellClass(prob, impact)}">
                                                ${cellRisks.map(r => `
                                                    <div class="risk-dot" title="${r.name}">${r.idx + 1}</div>
                                                `).join('')}
                                            </div>
                                        `;
        }).join('')}
                                </div>
                            `).join('')}
                        </div>
                        <!-- X Axis Labels -->
                        <div class="x-labels">
                            <span>منخفض</span>
                            <span>متوسط</span>
                            <span>عالي</span>
                        </div>
                    </div>
                </div>
                <div class="matrix-x-label">
                    <span>الاحتمالية</span>
                </div>
                <!-- Legend -->
                <div class="risk-legend">
                    <span class="legend-item"><span class="legend-box risk-critical"></span>حرج (9-15)</span>
                    <span class="legend-item"><span class="legend-box risk-high"></span>عالي (6-8)</span>
                    <span class="legend-item"><span class="legend-box risk-medium"></span>متوسط (3-5)</span>
                    <span class="legend-item"><span class="legend-box risk-low"></span>منخفض (1-2)</span>
                </div>
            </div>
        `;
    }

    renderRiskRegister(risks) {
        const typeLabels = {
            operational: 'تشغيلي',
            financial: 'مالي',
            market: 'سوقي',
            legal: 'قانوني',
            technical: 'تقني'
        };

        const probLabels = { low: 'منخفض', medium: 'متوسط', high: 'عالي' };
        const impactLabels = { low: 'منخفض', medium: 'متوسط', high: 'عالي' };

        const getScore = (prob, impact) => {
            const probScore = { low: 1, medium: 2, high: 3 };
            const impactScore = { low: 1, medium: 3, high: 5 };
            return probScore[prob] * impactScore[impact];
        };

        const getScoreBadge = (score) => {
            if (score >= 9) return 'badge--danger';
            if (score >= 6) return 'badge--warning';
            if (score >= 3) return 'badge--info';
            return 'badge--success';
        };

        return `
            <div class="risk-register">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>الخطر</th>
                            <th>النوع</th>
                            <th>الاحتمالية</th>
                            <th>الأثر</th>
                            <th>الدرجة</th>
                            <th>خطة المواجهة</th>
                            <th>المسؤول</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody id="riskRegisterBody">
                        ${risks.map((risk, idx) => {
            const score = getScore(risk.probability, risk.impact);
            return `
                                <tr data-idx="${idx}">
                                    <td class="text-center">${idx + 1}</td>
                                    <td><input type="text" class="input input--sm risk-field" data-field="name" value="${risk.name || ''}"></td>
                                    <td>
                                        <select class="input input--sm risk-field" data-field="type">
                                            ${Object.entries(typeLabels).map(([k, v]) => `
                                                <option value="${k}" ${risk.type === k ? 'selected' : ''}>${v}</option>
                                            `).join('')}
                                        </select>
                                    </td>
                                    <td>
                                        <select class="input input--sm risk-field" data-field="probability">
                                            <option value="low" ${risk.probability === 'low' ? 'selected' : ''}>🟢 منخفض</option>
                                            <option value="medium" ${risk.probability === 'medium' ? 'selected' : ''}>🟡 متوسط</option>
                                            <option value="high" ${risk.probability === 'high' ? 'selected' : ''}>🔴 عالي</option>
                                        </select>
                                    </td>
                                    <td>
                                        <select class="input input--sm risk-field" data-field="impact">
                                            <option value="low" ${risk.impact === 'low' ? 'selected' : ''}>🟢 منخفض</option>
                                            <option value="medium" ${risk.impact === 'medium' ? 'selected' : ''}>🟡 متوسط</option>
                                            <option value="high" ${risk.impact === 'high' ? 'selected' : ''}>🔴 عالي</option>
                                        </select>
                                    </td>
                                    <td class="text-center"><span class="badge ${getScoreBadge(score)}">${score}</span></td>
                                    <td><input type="text" class="input input--sm risk-field" data-field="mitigation" value="${risk.mitigation || ''}"></td>
                                    <td><input type="text" class="input input--sm risk-field" data-field="owner" value="${risk.owner || ''}"></td>
                                    <td><button class="btn-icon btn-remove-risk" data-idx="${idx}">🗑️</button></td>
                                </tr>
                            `;
        }).join('')}
                    </tbody>
                </table>
                <div class="actions-row" style="display: flex; gap: 10px; margin-top: 10px;">
                    <button class="btn btn--sm btn--ghost btn-add-risk">+ إضافة خطر</button>
                    <button class="btn btn--sm btn--secondary btn-suggest-risk" ${this.isGenerating ? 'disabled' : ''}>
                        ${this.isGenerating ? '<span class="spinner-sm"></span> جاري الاقتراح...' : '🪄 اقتراح بنود'}
                    </button>
                </div>
            </div>
        `;
    }

    bindEvents() {
        // Navigation
        this.container.querySelector('.btn-prev-step')?.addEventListener('click', () => {
            if (this.onNavigate) this.onNavigate(this.stepIndex - 1);
        });
        this.container.querySelector('.btn-next-step')?.addEventListener('click', () => {
            if (this.onNavigate) this.onNavigate(this.stepIndex + 1);
        });

        // Risk field updates
        this.container.querySelectorAll('.risk-field').forEach(input => {
            input.addEventListener('change', (e) => this.updateRisk(e));
        });

        // Add risk
        this.container.querySelector('.btn-add-risk')?.addEventListener('click', () => this.addRisk());

        // Suggest risks
        this.container.querySelector('.btn-suggest-risk')?.addEventListener('click', () => this.handleSuggestRisks());

        // Remove risk
        this.container.querySelectorAll('.btn-remove-risk').forEach(btn => {
            btn.addEventListener('click', (e) => this.removeRisk(e));
        });
    }

    updateRisk(e) {
        const row = e.target.closest('tr');
        const idx = parseInt(row.dataset.idx);
        const field = e.target.dataset.field;
        const value = e.target.value;

        const state = this.store.getState();
        const risks = [...(state.riskAnalysis?.risks || [])];

        if (risks[idx]) {
            risks[idx] = { ...risks[idx], [field]: value };
            this.store.update('riskAnalysis', { ...state.riskAnalysis, risks });
            this.render(); // Re-render to update matrix
        }
    }

    addRisk() {
        const state = this.store.getState();
        const risks = [...(state.riskAnalysis?.risks || [])];
        risks.push({
            name: '',
            type: 'operational',
            probability: 'medium',
            impact: 'medium',
            mitigation: '',
            owner: ''
        });
        this.store.update('riskAnalysis', { ...state.riskAnalysis, risks });
        this.render();
    }

    removeRisk(e) {
        const idx = parseInt(e.target.dataset.idx);
        const state = this.store.getState();
        const risks = (state.riskAnalysis?.risks || []).filter((_, i) => i !== idx);
        this.store.update('riskAnalysis', { ...state.riskAnalysis, risks });
        this.render();
    }

    async handleSuggestRisks() {
        this.isGenerating = true;
        this.render();

        try {
            const state = this.store.getState();
            const projectInfo = state.projectInfo || {};

            const suggestions = await generateTableSuggestions('suggest_risks', projectInfo);

            if (suggestions && suggestions.length > 0) {
                const currentRisks = state.riskAnalysis?.risks || [];
                const newRisks = [...currentRisks, ...suggestions];
                this.store.update('riskAnalysis', {
                    ...state.riskAnalysis,
                    risks: newRisks
                });
            }
        } catch (error) {
            console.error('Failed to generate risks:', error);
            alert('حدث خطأ أثناء توليد الاقتراحات');
        } finally {
            this.isGenerating = false;
            this.render();
        }
    }
}
