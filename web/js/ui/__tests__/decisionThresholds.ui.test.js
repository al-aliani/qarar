/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-08: تثبّت أن شاشتي "تحليل الجدوى الاستثمارية" و"لوحة التحكم المالي"
 * تعرضان فعلياً نفس عتبات القرار الموحّدة (engine.js عبر assumptionsApplied.thresholds)
 * بدل عتبات احتياطية محلية كانت تناقض القرار الحقيقي (استرداد 7 سنوات بدل 3.5،
 * IRR≥5%/ROI>0% بدل 15%/20% الفعليين).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InvestorAnalysis } from '../InvestorAnalysis.js';
import { FinancialDashboard } from '../FinancialDashboard.js';
import { SECTIONS } from '../../core/schema.js';

function fakeStore(state) {
    return { getState: () => state, get: () => state };
}

// دراسة تُنتج استرداداً ~3.6 سنة (بين 3.5 الفعلية و7 القديمة الخاطئة) وIRR~13.6%
// (بين 5% القديمة و15% الفعلية) — بالضبط منطقة التناقض التي وثّقها التدقيق.
function createBorderlineRevisedStudy() {
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

describe('InvestorAnalysis — عتبة الاسترداد الموحّدة', () => {
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; });
    afterEach(() => { document.body.innerHTML = ''; });

    it('تعرض "< 3.5 سنوات" (لا "< 7") وتُعلِّم البند كغير محقَّق لمشروع استرداده ~3.6 سنة', () => {
        const view = new InvestorAnalysis('c', fakeStore(createBorderlineRevisedStudy()));
        view.render();
        const text = document.getElementById('c').textContent;
        expect(text).toContain('< 3.5 سنوات');
        expect(text).not.toContain('< 7 سنوات');

        const items = [...document.querySelectorAll('.investor-readiness-grid > div')];
        const paybackItem = items.find(el => el.textContent.includes('فترة استرداد معقولة'));
        expect(paybackItem).toBeTruthy();
        // ○ = غير محقَّق؛ قبل الإصلاح كان يظهر ✓ لأن 3.6 < 7 القديمة
        expect(paybackItem.textContent.trim().startsWith('○')).toBe(true);
    });
});

describe('FinancialDashboard — عتبات IRR/ROI الموحّدة', () => {
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; });
    afterEach(() => { document.body.innerHTML = ''; });

    it('بطاقة IRR تُصنَّف kpi-negative (لا kpi-positive) لمشروع IRR~10.5% بين 5% القديمة و15% الفعلية', () => {
        const dashboard = new FinancialDashboard('c', fakeStore(createBorderlineRevisedStudy()));
        dashboard.render();
        expect(dashboard.results.indicators.irr).toBeGreaterThan(0.05);
        expect(dashboard.results.indicators.irr).toBeLessThan(0.15);

        const irrCard = [...document.querySelectorAll('.kpi-card')].find(el => el.textContent.includes('معدل العائد الداخلي'));
        expect(irrCard).toBeTruthy();
        // قبل الإصلاح: irr >= 0.05 ثابتة ⇒ kpi-positive رغم أن القرار الفعلي REVISE بسبب IRR<15%.
        expect(irrCard.className).toContain('kpi-negative');
        expect(irrCard.className).not.toContain('kpi-positive');
    });
});
