/**
 * مسح ليلة 2026-08-26: قائمة الدخل في ملف Word كانت تطبع صف الزكاة وحده بلا صف
 * «ضريبة الدخل»، فمشروع بشراكة أجنبية (assumptions.foreignOwnershipRate) يستلم جدولاً
 * لا يُجمَع عموده: EBITDA − إهلاك − فوائد − زكاة ≠ صافي الربح المطبوع، والفجوة تساوي
 * الضريبة بالضبط بلا أي بند يفسّرها أمام محلل ائتمان. نفس العيب أُصلح سابقاً في
 * excelExporter.js:375-377 وBankReportGenerator.js:388 بصف شرطي عند tax > 0.
 */
import { describe, it, expect } from 'vitest';
import { WordExporter } from '../wordExporter.js';

/** يقرأ صفوف جدول docx نصّياً: [[خلية, خلية, …], …]. */
function tableRows(table) {
    return table.root
        .filter((node) => node?.constructor?.name === 'TableRow')
        // أول عنصر في الصف خصائصه لا خلية، وكل خلية تُرجع نصها مكرراً مرتين
        // (TextRun يحمله في root وoptions) — نأخذ أول ظهور فقط.
        .map((row) => (row.root || []).slice(1).map((cell) => (collectText(cell)[0] || '').trim()));
}

function collectText(node, out = []) {
    if (node == null) return out;
    if (typeof node === 'string') { out.push(node); return out; }
    if (Array.isArray(node)) { node.forEach((n) => collectText(n, out)); return out; }
    if (typeof node === 'object') {
        if (typeof node.text === 'string') out.push(node.text);
        for (const key of ['root', 'children', 'options']) {
            if (node[key] !== undefined) collectText(node[key], out);
        }
    }
    return out;
}

/** يحوّل خلية بالأرقام العربية-الهندية إلى عدد. */
function cellToNumber(text) {
    const ascii = text.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
    const digits = ascii.replace(/[^\d-]/g, '');
    return digits === '' ? NaN : Number(digits);
}

/** قيمة السنة الأولى (العمود الثاني) للصف الذي يبدأ عنوانه بـ label. */
function year1(rows, label) {
    const row = rows.find((cells) => cells[0].includes(label));
    return row ? cellToNumber(row[1]) : undefined;
}

function fakeStore(state) {
    return { getState: () => state };
}

// شراكة أجنبية 40% ⇒ المحرك يفرض ضريبة دخل على حصة الأجانب إلى جانب الزكاة.
function foreignPartnershipStudy() {
    return {
        projectInfo: { name: 'مشروع بشراكة أجنبية', businessModel: 'Independent' },
        assumptions: { projectionYears: 3, discountRate: 0.10, inflationRate: 0, foreignOwnershipRate: 0.4 },
        marketSizing: {},
        technical: { equipment: [{ price: 1200000, quantity: 1 }], buildings: [], furniture: [], vehicles: [], establishmentCosts: [], capacityUtilization: [] },
        hr: { positions: [{ position: 'موظف', count: 2, salary: 6000, months: 12, nationality: 'saudi' }] },
        logistics: { logistics: [] },
        administrative: { administrative: [] },
        marketing: { campaigns: [] },
        revenue: { streams: [{ type: 'operating', customersPerMonth: 2000, avgPrice: 150, variableCostRate: 0.25, growthRate: 0 }] },
        services: { items: [] },
        financing: { sources: { equity: { amount: 2000000, percentage: 100 } } },
        techResources: { techResources: [] },
        legal: { licenses: [] }
    };
}

/** نفس الدراسة بملكية سعودية كاملة ⇒ tax = 0 ⇒ لا صف ضريبة (الصف شرطي). */
function saudiOwnedStudy() {
    const s = foreignPartnershipStudy();
    s.assumptions.foreignOwnershipRate = 0;
    return s;
}

describe('WordExporter.createIncomeStatementTable — صف ضريبة الدخل', () => {
    it('شرط البلاغ: المحرك يفرض ضريبة > 0 على حصة الأجانب إلى جانب الزكاة', () => {
        const y = new WordExporter(fakeStore(foreignPartnershipStudy())).results.incomeStatement[0];
        expect(y.tax).toBeGreaterThan(0);
        expect(y.zakat).toBeGreaterThan(0);
    });

    it('الجدول يتضمّن صف «ضريبة الدخل» بقيمة الضريبة من المحرك', () => {
        const exporter = new WordExporter(fakeStore(foreignPartnershipStudy()));
        const rows = tableRows(exporter.createIncomeStatementTable());
        const engineTax = exporter.results.incomeStatement[0].tax;
        expect(year1(rows, 'ضريبة الدخل')).toBe(Math.round(engineTax));
    });

    it('عمود السنة الأولى يُجمَع فعلياً إلى صافي الربح المطبوع', () => {
        const rows = tableRows(new WordExporter(fakeStore(foreignPartnershipStudy())).createIncomeStatementTable());
        // صف مفقود يُحتسب صفراً عمداً — هكذا يقرأ محلل الائتمان العمود، وهكذا تظهر
        // الفجوة كرقم في رسالة الفشل بدل NaN.
        const printed = (label) => year1(rows, label) ?? 0;
        const chain = printed('EBITDA')
            - printed('الإهلاك')
            - printed('الفوائد')
            - printed('الزكاة')
            - printed('ضريبة الدخل');
        // تفاوت ±2 ريال فقط من تقريب كل صف مطبوع إلى أقرب ريال
        expect(Math.abs(chain - printed('صافي الربح'))).toBeLessThanOrEqual(2);
    });

    it('لا يُطبع صف الضريبة لمشروع بملكية سعودية كاملة (tax = 0)', () => {
        const exporter = new WordExporter(fakeStore(saudiOwnedStudy()));
        expect(exporter.results.incomeStatement[0].tax).toBe(0);
        const rows = tableRows(exporter.createIncomeStatementTable());
        expect(rows.some((cells) => cells[0].includes('ضريبة الدخل'))).toBe(false);
    });
});
