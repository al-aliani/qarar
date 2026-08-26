/**
 * @vitest-environment jsdom
 *
 * مسح ليلة 2026-08-26 — ثلاثة عيوب في جدول واحد (FinancialDashboard.js «ملخص التكاليف
 * الرأسمالية»)، قرأها المُدقِّق حرفياً من السطر:
 *   <tr><td>التجهيزات والمعدات</td><td>${this.formatCurrency(capex.subtotal)}</td></tr>
 *
 * (1) تسمية كاذبة: capex.subtotal هو مجموع كل بنود capexBreakdown (مبانٍ، أثاث، مركبات،
 *     موارد تقنية، تأسيس، تراخيص…) لا «التجهيزات والمعدات» — يعرض 223,000 بينما المعدات
 *     200,000.
 * (2) فجوة توازن: البند الأخير كان يقرأ capex.workingCapital، والمخزون الافتتاحي بند
 *     رأسمالي مستقل خارجه (engine.js: totalInvestment = totalCapex + openingInventory +
 *     workingCapital)، فتجمع الصفوف 354,340 تحت إجمالي مطبوع 414,340 — فجوة 60,000 هي
 *     المخزون الافتتاحي بالضبط. أُغلقت في تقرير PDF الليلة وبقيت حيّة على الشاشة.
 * (3) صف ميت: «احتياطي طوارئ (10%)» يقرأ capex.contingency المثبَّت صفراً في
 *     engine.js:1408 — يعرض ٠ دائماً.
 *
 * الاختبار الحاسم يثبّت **المعادلة** (مجموع الصفوف = الإجمالي المطبوع) لا قيمة مفردة:
 * أي بند رأسمالي يضيفه المحرك مستقبلاً خارج subtotal/workingCapital يكسر الاختبار فوراً.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FinancialDashboard } from '../FinancialDashboard.js';
import { calculateStudy } from '../../core/engine.js';
import { SECTIONS, createEmptyStudy } from '../../core/schema.js';

function fakeStore(state) {
    return { getState: () => state, get: () => state, update: () => {}, notify: () => {} };
}

/** متجر بمعدات 200,000 + أثاث 23,000 + مخزون افتتاحي 60,000 — نفس بنية دراسة السيناريو. */
function inventoryStudy() {
    const d = createEmptyStudy();
    d[SECTIONS.PROJECT_INFO] = { ...d[SECTIONS.PROJECT_INFO], name: 'متجر تجزئة' };
    d.assumptions = { ...d.assumptions, projectionYears: 5, discountRate: 0.10, taxRate: 0 };
    d[SECTIONS.TECHNICAL] = {
        ...d[SECTIONS.TECHNICAL],
        equipment: [{ price: 200000, quantity: 1 }],
        furniture: [{ price: 23000, quantity: 1 }],
        openingInventory: 60000
    };
    d[SECTIONS.REVENUE] = { streams: [{ type: 'operating', customersPerMonth: 500, avgPrice: 150, variableCostRate: 0.40 }] };
    d[SECTIONS.HR] = { positions: [{ position: 'بائع', count: 2, salary: 5000, months: 12, nationality: 'saudi' }] };
    d[SECTIONS.ADMINISTRATIVE] = { administrative: [{ name: 'إيجار', monthly: 10000 }] };
    d[SECTIONS.FINANCING] = { sources: { equity: { amount: 500000 } } };
    return d;
}

/** الأرقام تُعرض بأرقام هندية عربية مع فواصل — نُحوّلها لعدد قابل للجمع. */
function parseMoney(text) {
    const ascii = String(text).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
    const negative = /[-−؜]/.test(ascii);
    const digits = (ascii.match(/\d/g) || []).join('');
    if (!digits) return NaN;
    return (negative ? -1 : 1) * Number(digits);
}

function capexRows() {
    const card = [...document.querySelectorAll('#c .card')]
        .find(c => c.querySelector('h3')?.textContent.includes('ملخص التكاليف الرأسمالية'));
    expect(card).toBeDefined();
    return [...card.querySelectorAll('table.summary-table tr')];
}

describe('FinancialDashboard — جدول التكاليف الرأسمالية يتوازن مع إجماليه بحكم البناء', () => {
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; });
    afterEach(() => { document.body.innerHTML = ''; });

    it('تثبيت المدخل: المخزون الافتتاحي خارج subtotal وخارج workingCapital، والاحتياطي صفر', () => {
        const { capex } = calculateStudy(inventoryStudy());
        expect(capex.openingInventory).toBe(60000);
        expect(capex.contingency).toBe(0);
        // الفجوة التي كان الجدول يُسقطها: الإجمالي − subtotal ≠ workingCapital
        expect(capex.total - capex.subtotal).not.toBe(capex.workingCapital);
        expect(capex.total - capex.subtotal - capex.workingCapital).toBe(60000);
    });

    it('مجموع صفوف الجدول يساوي الإجمالي المطبوع تحتها (المعادلة لا رقم مفرد)', () => {
        new FinancialDashboard('c', fakeStore(inventoryStudy())).render();

        const rows = capexRows();
        const totalRow = rows.find(tr => tr.classList.contains('total-row'));
        const itemRows = rows.filter(tr => !tr.classList.contains('total-row'));
        expect(itemRows.length).toBeGreaterThan(0);

        const printedTotal = parseMoney(totalRow.querySelectorAll('td')[1].textContent);
        const sum = itemRows.reduce((acc, tr) => acc + parseMoney(tr.querySelectorAll('td')[1].textContent), 0);
        expect(Number.isNaN(printedTotal)).toBe(false);
        expect(sum).toBe(printedTotal);
    });

    it('لا تسمية «التجهيزات والمعدات» فوق رقم ليس المعدات', () => {
        const study = inventoryStudy();
        const { capex } = calculateStudy(study);
        // subtotal يشمل الأثاث أيضاً، فأي صف باسم «التجهيزات والمعدات» يحمله يكون كاذباً
        expect(capex.subtotal).not.toBe(capex.breakdown.equipment);

        new FinancialDashboard('c', fakeStore(study)).render();
        const text = capexRows().map(tr => tr.textContent).join(' ');
        expect(text).not.toContain('التجهيزات والمعدات');
    });

    it('صف «احتياطي طوارئ» لا يُرسم حين تكون قيمته صفراً', () => {
        new FinancialDashboard('c', fakeStore(inventoryStudy())).render();

        const text = capexRows().map(tr => tr.textContent).join(' ');
        expect(text).not.toContain('احتياطي طوارئ');
    });
});
