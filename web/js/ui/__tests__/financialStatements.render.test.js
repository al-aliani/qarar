/**
 * @vitest-environment jsdom
 *
 * FinancialStatements.js لم يكن له ملف اختبار مخصَّص إطلاقاً (تدقيق 2026-08-22) رغم
 * كونه 625 سطراً يُعرَض للمستخدم مباشرة داخل المعالج (قائمة الدخل/التدفقات/الميزانية).
 * يغطي هذا الملف: حالتَي التحذير (بلا إيراد، بلا استثمار)، الرسم الناجح الكامل لدراسة
 * واقعية عبر المحرك الحقيقي (لا نتائج مصطنعة)، تبديل قسم الموسمية، وأزرار التنقّل.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FinancialStatements } from '../FinancialStatements.js';
import { SECTIONS } from '../../core/schema.js';

// نفس دراسة GO الواقعية المستخدَمة في ui.test.js (DecisionDashboard) — تُنتج قوائم
// مالية حقيقية عبر calculateStudy الفعلي.
function createGoStudy(overrides = {}) {
    return {
        [SECTIONS.PROJECT_INFO]: { businessModel: 'Independent' },
        assumptions: { projectionYears: 5, discountRate: 0.10, inflationRate: 0.02, taxRate: 0 },
        [SECTIONS.TECHNICAL]: {
            equipment: [{ price: 250000, quantity: 1 }],
            buildings: [], furniture: [{ price: 50000, quantity: 1 }],
            establishmentCosts: [], capacityUtilization: []
        },
        [SECTIONS.HR]: {
            positions: [
                { position: 'مدير', count: 1, salary: 9000, months: 12, nationality: 'saudi' },
                { position: 'موظف', count: 3, salary: 4000, months: 12, nationality: 'saudi' }
            ]
        },
        [SECTIONS.LOGISTICS]: { logistics: [{ name: 'نقل', monthly: 2000 }] },
        [SECTIONS.ADMINISTRATIVE]: { administrative: [{ name: 'إيجار', monthly: 15000 }] },
        [SECTIONS.MARKETING]: { campaigns: [{ name: 'إعلانات', monthly: 3000 }] },
        [SECTIONS.REVENUE]: {
            streams: [{ type: 'operating', customersPerMonth: 1200, avgPrice: 100, variableCostRate: 0.30, growthRate: 0.03 }]
        },
        [SECTIONS.SERVICES]: { items: [] },
        [SECTIONS.FINANCING]: { sources: {} },
        [SECTIONS.TECH_RESOURCES]: { techResources: [] },
        [SECTIONS.LEGAL]: { licenses: [{ name: 'رخصة', cost: 5000 }] },
        ...overrides
    };
}

function fakeStore(state) {
    return { getState: () => state };
}

describe('FinancialStatements — حالات التحذير (بيانات ناقصة)', () => {
    beforeEach(() => {
        document.body.innerHTML = `<div id="fsContainer"></div>`;
    });
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('يعرض تحذير "لا توجد بيانات إيرادات" حين تكون streams فارغة (بدل قوائم مضلِّلة)', () => {
        const state = createGoStudy();
        state[SECTIONS.REVENUE] = { streams: [] };
        const fs = new FinancialStatements('fsContainer', fakeStore(state));
        fs.render();
        expect(document.body.textContent).toContain('لا توجد بيانات إيرادات');
        expect(document.querySelector('.data-table')).toBeNull();
    });

    it('يعرض رسالة "فشل في حساب النموذج" حين تُرجِع calculateStudy نتيجة فارغة (state غير صالحة)', () => {
        // calculateStudy(null) تُرجِع null فعلياً (لا تَرمي) — نفس فرع !results في render().
        const fs = new FinancialStatements('fsContainer', fakeStore(null));
        expect(() => fs.render()).not.toThrow();
        expect(document.body.textContent).toContain('فشل في حساب النموذج المالي');
        expect(document.querySelector('.data-table')).toBeNull();
    });
});

describe('FinancialStatements — رسم ناجح لدراسة كاملة', () => {
    beforeEach(() => {
        document.body.innerHTML = `<div id="fsContainer"></div>`;
    });
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('يرسم قائمة الدخل والتدفقات النقدية والميزانية بلا استثناء لدراسة GO حقيقية', () => {
        const fs = new FinancialStatements('fsContainer', fakeStore(createGoStudy()));
        expect(() => fs.render()).not.toThrow();

        const tables = document.querySelectorAll('.data-table');
        // 3 جداول أساسية: الدخل، التدفقات السنوية، التدفقات الربعية (+ الميزانية بجدول مختلف الشكل)
        expect(tables.length).toBeGreaterThanOrEqual(3);
        expect(document.body.textContent).toContain('صافي الربح');
        expect(document.body.textContent).toContain('إجمالي الأصول');
        expect(document.body.textContent).toContain('إجمالي الخصوم وحقوق الملكية');
    });

    it('لا يعرض قسم الموسمية حين يكون النمط "flat" (الافتراضي)', () => {
        const fs = new FinancialStatements('fsContainer', fakeStore(createGoStudy()));
        fs.render();
        expect(document.body.textContent).not.toContain('التوزيع الشهري للإيراد');
    });

    it('يعرض قسم الموسمية وذروتها/أدناها حين يُضبط نمط رمضان', () => {
        const state = createGoStudy({ assumptions: { projectionYears: 5, discountRate: 0.10, inflationRate: 0.02, taxRate: 0, seasonalityProfile: 'ramadan' } });
        const fs = new FinancialStatements('fsContainer', fakeStore(state));
        fs.render();
        expect(document.body.textContent).toContain('التوزيع الشهري للإيراد');
        expect(document.body.textContent).toContain('ذروة رمضان والأعياد');
    });

    it('أزرار السابق/التالي تستدعي onNavigate بفهرس الخطوة الصحيح', () => {
        const calls = [];
        const fs = new FinancialStatements('fsContainer', fakeStore(createGoStudy()), (idx) => calls.push(idx));
        fs.render(7);
        document.querySelector('.btn-prev-step').click();
        document.querySelector('.btn-next-step').click();
        expect(calls).toEqual([6, 8]);
    });
});
