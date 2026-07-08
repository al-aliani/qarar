/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-08 (ملاحظة عالية #29): عناوين البطاقات وأزرار الإجراء الرئيسية في
 * لوحة التحكم المالي كانت تستخدم إيموجي خام (📌📊💵📈🤖🧠🔍) بينما لوحة القرار
 * (DecisionDashboard.js) اعتمدت أيقونات SVG من مكتبة index.html الموحّدة — تناقض
 * بصري بين شاشتين لنفس المفهوم. الآن تستخدم نفس نمط <svg class="ic"><use href="#i-..."/></svg>.
 * ملاحظة تصميمية: الرموز التعبيرية داخل النصوص الديناميكية (⚠️✅❌✋💡🚀 ونسب
 * COGS/Labor/Rent) بقيت كما هي عمداً — هذه ملصقات حالة داخل نص المستشار الذكي،
 * لا عناوين/أزرار هيكلية، فليست ضمن نطاق هذا الإصلاح.
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

describe('FinancialDashboard — عناوين/أزرار توحّدت على أيقونات SVG بدل الإيموجي (#29)', () => {
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; });
    afterEach(() => { document.body.innerHTML = ''; });

    it('يستخدم أيقونات SVG (i-bolt/i-chart/i-bank/i-auto/i-shield) في عناوين البطاقات والأزرار الرئيسية', () => {
        const dashboard = new FinancialDashboard('c', fakeStore(buildStudy()));
        dashboard.render();
        const html = document.getElementById('c').innerHTML;

        expect(html).toContain('href="#i-bolt"');
        expect(html).toContain('href="#i-chart"');
        expect(html).toContain('href="#i-bank"');
        expect(html).toContain('href="#i-auto"');
        expect(html).toContain('href="#i-shield"');
    });

    it('لا تظهر إيموجي العناوين القديمة (📌💵🤖🔍) في نص عنوان أي بطاقة', () => {
        const dashboard = new FinancialDashboard('c', fakeStore(buildStudy()));
        dashboard.render();
        const titleTexts = [...document.querySelectorAll('.card-title')].map(el => el.textContent);
        titleTexts.forEach(t => {
            expect(t).not.toMatch(/[📌💵🤖🔍]/u);
        });
    });

    it('يحافظ على الرموز التعبيرية غير الهيكلية (⚠️/✅/❌) داخل نصوص الحالة الديناميكية دون مساس', () => {
        const dashboard = new FinancialDashboard('c', fakeStore(buildStudy()));
        dashboard.render();
        const html = document.getElementById('c').innerHTML;
        // بطاقة "هل المشروع ربح؟" تحتوي ✅ أو ❌ حسب صافي الربح — لم تُمس
        expect(html).toMatch(/نعم ✅|لا ❌/);
    });
});
