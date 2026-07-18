/**
 * Scenario Switcher Component
 * Allows users to toggle between Base, Optimistic, and Pessimistic scenarios
 * and visualize the financial impact immediately.
 */

import { calculateStudy as runFullModel } from '../core/engine.js';
import { DEFAULT_SCENARIOS } from '../core/schema.js';

const icon = (id) => `<svg class="ic" aria-hidden="true"><use href="#${id}"/></svg>`;

export class ScenarioSwitcher {
    constructor(containerId, store) {
        this.container = document.getElementById(containerId);
        this.store = store;
        this.currentScenario = 'base'; // Default
    }

    render() {
        const state = this.store.getState();
        // القراءة من scenarios.current (أو state.scenario لو كان نصاً لمراعاة القديم)
        let sc = state.scenarios?.current;
        if (typeof sc !== 'string') sc = (typeof state.scenario === 'string') ? state.scenario : 'base';
        sc = String(sc).toLowerCase();
        this.currentScenario = ['base', 'optimistic', 'pessimistic'].includes(sc) ? sc : 'base';

        const params = state.scenarios || {};
        // قيم افتراضية عند غياب state.scenarios (مشاريع قديمة) — PlanGuru: Base/Best/Worst في جدول واحد
        // تدقيق 2026-07-09: كانت هذه القيم نسخة محلية مختلفة (0.15/-0.05) عن الثابت
        // المعتمد في schema.js (0.25/-0.10) — استُبدلت بالثابت المشترك DEFAULT_SCENARIOS.
        const DEF = DEFAULT_SCENARIOS;
        const opt = params.optimistic || DEF.optimistic;
        const pess = params.pessimistic || DEF.pessimistic;
        const baseResults = runFullModel(state, params.base || DEF.base);
        const optimisticResults = runFullModel(state, params.optimistic || DEF.optimistic);
        const pessimisticResults = runFullModel(state, params.pessimistic || DEF.pessimistic);

        const scenarios = {
            base: { results: baseResults, label: 'السيناريو الأساسي', icon: icon('i-scale'), color: 'gray' },
            optimistic: { results: optimisticResults, label: 'السيناريو المتفائل', icon: icon('i-rocket'), color: 'green' },
            pessimistic: { results: pessimisticResults, label: 'السيناريو المتشائم', icon: icon('i-warning'), color: 'red' }
        };

        const active = scenarios[this.currentScenario];
        const activeResults = active?.results ?? baseResults;

        // Calculate deltas relative to Base (تجنب القسمة على صفر أو قراءة من undefined)
        const bNpv = baseResults?.indicators?.npv;
        const aNpv = activeResults?.indicators?.npv;
        const bIrr = baseResults?.indicators?.irr ?? 0;
        const aIrr = activeResults?.indicators?.irr ?? 0;
        const npvDelta = (typeof bNpv === 'number' && bNpv !== 0 && typeof aNpv === 'number') ? ((aNpv - bNpv) / bNpv) * 100 : 0;
        const irrDelta = (typeof bIrr === 'number' && bIrr !== 0) ? ((aIrr - bIrr) / bIrr) * 100 : 0;

        this.container.innerHTML = `
            <div class="scenario-switcher-panel">
                <div class="scenario-header">
                    <h3>${icon('i-sparkle')} محاكي السيناريوهات</h3>
                    <p>اختر سيناريو لرؤية تأثيره على نتائج المشروع المالية</p>
                </div>

                <div class="scenario-buttons">
                    ${this.renderButton('optimistic', scenarios.optimistic, this.currentScenario === 'optimistic')}
                    ${this.renderButton('base', scenarios.base, this.currentScenario === 'base')}
                    ${this.renderButton('pessimistic', scenarios.pessimistic, this.currentScenario === 'pessimistic')}
                </div>

                <div class="scenario-impact">
                    ${this.renderImpactSummary(npvDelta, irrDelta, this.currentScenario)}
                </div>

                <div class="comparison-section">
                    <div class="comparison-header">
                        <h4>مقارنة شاملة</h4>
                    </div>
                    <div class="comparison-table-wrapper">
                        <table class="comparison-table">
                            <thead>
                                <tr>
                                    <th>المؤشر</th>
                                    <th>الأسوأ (Worst)</th>
                                    <th>الأساس (Base)</th>
                                    <th>الأفضل (Best)</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>صافي القيمة الحالية</td>
                                    <td class="negative">${this.formatCurrency(scenarios.pessimistic.results?.indicators?.npv)}</td>
                                    <td>${this.formatCurrency(scenarios.base.results?.indicators?.npv)}</td>
                                    <td class="positive">${this.formatCurrency(scenarios.optimistic.results?.indicators?.npv)}</td>
                                </tr>
                                <tr>
                                    <td>معدل العائد الداخلي</td>
                                    <td class="negative">${((scenarios.pessimistic.results?.indicators?.irr ?? 0) * 100).toFixed(1)}%</td>
                                    <td>${((scenarios.base.results?.indicators?.irr ?? 0) * 100).toFixed(1)}%</td>
                                    <td class="positive">${((scenarios.optimistic.results?.indicators?.irr ?? 0) * 100).toFixed(1)}%</td>
                                </tr>
                                <tr>
                                    <td>فترة الاسترداد</td>
                                    <td class="negative">${this.formatPayback(scenarios.pessimistic.results?.indicators?.paybackPeriod ?? scenarios.pessimistic.results?.indicators?.payback)}</td>
                                    <td>${this.formatPayback(scenarios.base.results?.indicators?.paybackPeriod ?? scenarios.base.results?.indicators?.payback)}</td>
                                    <td class="positive">${this.formatPayback(scenarios.optimistic.results?.indicators?.paybackPeriod ?? scenarios.optimistic.results?.indicators?.payback)}</td>
                                </tr>
                                <tr>
                                    <td>صافي الربح (السنة 1)</td>
                                    <td class="negative">${this.formatCurrency(scenarios.pessimistic.results?.incomeStatement?.[0]?.netIncome)}</td>
                                    <td>${this.formatCurrency(scenarios.base.results?.incomeStatement?.[0]?.netIncome)}</td>
                                    <td class="positive">${this.formatCurrency(scenarios.optimistic.results?.incomeStatement?.[0]?.netIncome)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="scenario-params-section mt-4 p-3 rounded-lg border border-white/10 bg-white/5">
                    <h4 class="text-gold mb-2">معاملات السيناريو (تعديل Best/Worst)</h4>
                    <p class="text-xs text-muted mb-3">مثلاً: Best = +15% إيراد، -5% تكلفة. Base ثابت (الافتراضات الحالية).</p>
                    <table class="scenario-params-table w-full text-sm">
                        <thead>
                            <tr>
                                <th>السيناريو</th>
                                <th>تغير الإيراد %</th>
                                <th>تغير التكلفة %</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>الأساس (Base)</td>
                                <td><span class="text-muted">0</span></td>
                                <td><span class="text-muted">0</span></td>
                            </tr>
                            <tr>
                                <td>الأفضل (Best)</td>
                                <td><input type="number" class="input input--sm w-20 scenario-param" data-scenario="optimistic" data-field="revenueChange" value="${(opt.revenueChange * 100).toFixed(0)}" step="5" min="-50" max="100">%</td>
                                <td><input type="number" class="input input--sm w-20 scenario-param" data-scenario="optimistic" data-field="costChange" value="${(opt.costChange * 100).toFixed(0)}" step="5" min="-50" max="100">%</td>
                            </tr>
                            <tr>
                                <td>الأسوأ (Worst)</td>
                                <td><input type="number" class="input input--sm w-20 scenario-param" data-scenario="pessimistic" data-field="revenueChange" value="${(pess.revenueChange * 100).toFixed(0)}" step="5" min="-50" max="100">%</td>
                                <td><input type="number" class="input input--sm w-20 scenario-param" data-scenario="pessimistic" data-field="costChange" value="${(pess.costChange * 100).toFixed(0)}" step="5" min="-50" max="100">%</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        this.bindEvents();
    }

    renderButton(key, data, isActive) {
        return `
            <div class="scenario-btn ${isActive ? 'active' : ''}" data-scenario="${key}">
                ${isActive ? '<span class="active-badge">✓</span>' : ''}
                <span class="scenario-icon">${data.icon}</span>
                <span class="scenario-name">${data.label}</span>
            </div>
        `;
    }

    renderImpactSummary(npvDelta, irrDelta, scenario) {
        if (scenario === 'base') {
            return `
                <div class="impact-neutral">
                    <p>أنت تشاهد النتائج الافتراضية للمشروع.</p>
                </div>
            `;
        }

        const isPositive = scenario === 'optimistic';
        const colorClass = isPositive ? 'positive' : 'negative';
        const sign = isPositive ? '+' : '';

        return `
            <div class="impact-active">
                <div class="impact-item">
                    <span class="impact-label">تأثير صافي القيمة الحالية</span>
                    <span class="impact-value ${colorClass}">${sign}${npvDelta.toFixed(1)}%</span>
                </div>
                <div class="impact-item">
                    <span class="impact-label">تأثير معدل العائد الداخلي</span>
                    <span class="impact-value ${colorClass}">${sign}${irrDelta.toFixed(1)}%</span>
                </div>
            </div>
        `;
    }

    bindEvents() {
        this.container.querySelectorAll('.scenario-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const scenario = btn.dataset.scenario;
                if (!scenario || !['base', 'optimistic', 'pessimistic'].includes(scenario)) return;
                this.store.update('scenarios', { current: scenario });
                try { window.dispatchEvent(new CustomEvent('scenarioChanged', { detail: { scenario } })); } catch (_) {}
                this.render();
            });
        });
        // PlanGuru: تعديل معاملات Best/Worst — حفظ في store وإعادة رسم
        this.container.querySelectorAll('.scenario-param').forEach(input => {
            input.addEventListener('change', () => {
                const scenario = input.dataset.scenario;
                const field = input.dataset.field;
                if (!scenario || !field || !['optimistic', 'pessimistic'].includes(scenario)) return;
                const val = parseFloat(input.value);
                if (isNaN(val)) return;
                const state = this.store.getState();
                const scenarios = { ...(state.scenarios || {}) };
                const current = scenarios[scenario] || {};
                current[field] = val / 100;
                scenarios[scenario] = current;
                this.store.update('scenarios', scenarios);
                this.render();
            });
        });
    }

    formatCurrency(n) {
        return new Intl.NumberFormat('ar-SA', {
            style: 'currency',
            currency: 'SAR',
            maximumFractionDigits: 0
        }).format(n || 0);
    }

    formatPayback(n) {
        const value = Number(n);
        return Number.isFinite(value) && value > 0 ? value.toFixed(1) + ' سنة' : 'غير محقق';
    }
}
