/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-08 (ملاحظة عالية #28): كانت بطاقات kpi-card/insight-item في لوحة
 * التحكم المالي تستخدم rgba(255,255,255,0.0x) صريحة (تراكب أبيض ثابت لا يتبع الثيم)
 * بدل var(--c-surface-2) المُعرَّف لهذا الغرض تحديداً — فتبدو غير متناسقة على الثيم
 * الفاتح (أرضية ورقية دافئة لا رمادية).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FinancialDashboard } from '../FinancialDashboard.js';
import { SECTIONS } from '../../core/schema.js';

function fakeStore(state) {
    return { getState: () => state, get: () => state, update: () => {}, notify: () => {} };
}

function buildStudy() {
    return {
        [SECTIONS.PROJECT_INFO]: { businessModel: 'Independent' },
        assumptions: { projectionYears: 5, discountRate: 0.10, inflationRate: 0.02, taxRate: 0 },
        [SECTIONS.TECHNICAL]: { equipment: [{ price: 250000, quantity: 1 }], buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: [] },
        [SECTIONS.HR]: { positions: [] },
        [SECTIONS.LOGISTICS]: { logistics: [] },
        [SECTIONS.ADMINISTRATIVE]: { administrative: [{ name: 'إيجار', monthly: 17000 }] },
        [SECTIONS.MARKETING]: { campaigns: [] },
        [SECTIONS.REVENUE]: { streams: [{ type: 'operating', customersPerMonth: 400, avgPrice: 100, variableCostRate: 0.30, growthRate: 0 }] },
        [SECTIONS.SERVICES]: { items: [] },
        [SECTIONS.FINANCING]: { sources: {} },
        [SECTIONS.TECH_RESOURCES]: { techResources: [] },
        [SECTIONS.LEGAL]: { licenses: [] }
    };
}

describe('FinancialDashboard — بطاقات KPI تتبع متغيرات الثيم لا rgba(255,255,255,..) ثابتة (#28)', () => {
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; });
    afterEach(() => { document.body.innerHTML = ''; });

    it('لا يحقن أي inline-style بـ rgba(255,255,255,..) في المخرج المُصيَّر', () => {
        const dashboard = new FinancialDashboard('c', fakeStore(buildStudy()));
        dashboard.render();
        const html = document.getElementById('c').innerHTML;
        expect(html).not.toMatch(/rgba\(\s*255\s*,\s*255\s*,\s*255/);
    });

    it('بطاقات kpi-card تستخدم var(--c-surface-2) فعلياً كخلفية', () => {
        const dashboard = new FinancialDashboard('c', fakeStore(buildStudy()));
        dashboard.render();
        const cards = [...document.querySelectorAll('#simpleViewPanel .kpi-card, #unifiedKpiPanel .kpi-card')];
        expect(cards.length).toBeGreaterThan(0);
        cards.forEach(card => {
            expect(card.getAttribute('style')).toContain('var(--c-surface-2)');
        });
    });
});
