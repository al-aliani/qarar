/**
 * @vitest-environment jsdom
 *
 * مسح 2026-08-26: ورقة «التدفقات النقدية» في Excel كانت تطبع أربعة صفوف فقط — صافي
 * الربح، «(+) الإهلاك»، صافي التدفق النقدي، التراكمي — بينما صفوف المحرك
 * (engine.js:1366-1392) تحمل investment وloanInflow وloanPrincipalPaid
 * وreplacementCost. علامة `(+)` الصريحة تُقدّم الجدول كعملية جمع، فيقرؤه محلل التمويل
 * كخطأ حسابي: مخبز بقرض 500,000 يطبع سنة 1 «428,342 + 99,000» ثم صافي تدفق 442,622،
 * والفارق 84,720 هو سداد أصل القرض بلا صفّ. وسنة 0 تُظهر صافي تدفق سالباً من العدم.
 *
 * الاختبار يتحقق من الخاصية البنيوية: **كل** صفوف المكوّنات تجمع إلى صفّ صافي التدفق
 * المطبوع، في كل سنة بما فيها سنة الصفر.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExcelExporter } from '../excelExporter.js';
import { createEmptyStudy, SECTIONS } from '../../js/core/schema.js';
import { calculateStudy } from '../../js/core/engine.js';
import ExcelJS from 'exceljs';

let capturedBlob = null;

async function reload(blob) {
    const buf = await blob.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    return wb;
}

/** مخبز بقرض بنكي 500,000 لخمس سنوات بفائدة 8% — نفس حالة البلاغ. */
function bakeryWithLoan() {
    const data = createEmptyStudy();
    data[SECTIONS.PROJECT_INFO] = { ...data[SECTIONS.PROJECT_INFO], name: 'مخبز' };
    data.assumptions = { ...data.assumptions, projectionYears: 5, rampUpMonths: 0 };
    data[SECTIONS.TECHNICAL] = { equipment: [{ price: 700000, quantity: 1, life: 7 }], buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: [] };
    data[SECTIONS.HR] = { positions: [{ position: 'خباز', count: 4, salary: 5000, months: 12, nationality: 'saudi' }] };
    data[SECTIONS.LOGISTICS] = { logistics: [] };
    data[SECTIONS.ADMINISTRATIVE] = { administrative: [{ name: 'إيجار', monthly: 15000 }] };
    data[SECTIONS.MARKETING] = { campaigns: [] };
    data[SECTIONS.SERVICES] = { ...data[SECTIONS.SERVICES], items: [] };
    data[SECTIONS.REVENUE] = { streams: [{ name: 'مخبوزات', type: 'operating', customersPerMonth: 6000, avgPrice: 40, variableCostRate: 0.35, growthRate: 0.03 }] };
    data[SECTIONS.FINANCING] = {
        sources: {
            equity: { amount: 400000, percentage: 45 },
            bankLoan: { amount: 500000, percentage: 55, interestRate: 0.08, termYears: 5, gracePeriodMonths: 0 },
        },
    };
    data[SECTIONS.TECH_RESOURCES] = { techResources: [] };
    data[SECTIONS.LEGAL] = { licenses: [] };
    return data;
}

describe('ExcelExporter — ورقة التدفقات النقدية تجمع فعلاً إلى صافي التدفق المطبوع', () => {
    beforeEach(() => {
        capturedBlob = null;
        global.URL.createObjectURL = vi.fn((blob) => { capturedBlob = blob; return 'blob:mock-url'; });
        global.URL.revokeObjectURL = vi.fn();
    });

    it('سداد أصل القرض والاستثمار ودخول القرض لها صفوف، والعمود يتوازن في كل سنة بما فيها سنة الصفر', async () => {
        const study = bakeryWithLoan();
        const results = calculateStudy(study);

        // شرط الحالة: قرض فعلي بأصل مسدَّد — وإلا فالاختبار لا يختبر شيئاً
        const cf = results.cashFlow;
        expect(cf[0].investment).toBeLessThan(0);
        expect(cf[0].loanInflow).toBe(500000);
        expect(cf[1].loanPrincipalPaid).toBeGreaterThan(0);

        const exporter = new ExcelExporter(study, results, { lang: 'ar' });
        await exporter.export('test');
        const wb = await reload(capturedBlob);
        const ws = wb.getWorksheet('التدفقات النقدية');
        expect(ws).toBeTruthy();

        const rows = [];
        ws.eachRow((row) => rows.push(row.values.slice(1)));

        const byLabel = (label) => rows.find((r) => r[0] === label);
        const netRow = byLabel('صافي التدفق النقدي');
        expect(netRow).toBeTruthy();

        const componentRows = rows.filter((r) => r[0] !== 'صافي التدفق النقدي'
            && r[0] !== 'التدفق النقدي التراكمي'
            && r[0] !== 'البند'
            && r[0] !== 'قائمة التدفقات النقدية');

        // العمود يتوازن في كل سنة: مجموع المكوّنات = صافي التدفق المطبوع
        for (let col = 1; col <= results.cashFlow.length; col++) {
            const sum = componentRows.reduce((a, r) => a + Number(r[col] || 0), 0);
            expect(sum, `العمود ${col}`).toBeCloseTo(Number(netRow[col]), 2);
        }

        // الصفوف المكوِّنة كلها موجودة (كان صافي الربح والإهلاك فقط يُطبعان)
        const componentLabels = [
            'صافي الربح',
            '(+) الإهلاك',
            '(-) الاستثمار الرأسمالي',
            '(+) دخول القرض',
            '(-) سداد أصل القرض',
        ];
        componentLabels.forEach((label) => expect(byLabel(label), label).toBeTruthy());

        // سنة 0 لم تعد «تظهر من العدم»: الاستثمار ودخول القرض صفّان صريحان
        expect(Number(byLabel('(-) الاستثمار الرأسمالي')[1])).toBeCloseTo(cf[0].investment, 2);
        expect(Number(byLabel('(+) دخول القرض')[1])).toBe(500000);

        // سنة 1: صافي الربح + الإهلاك وحدهما لا يساويان صافي التدفق — الفارق له صفّ الآن
        const netIncome1 = Number(byLabel('صافي الربح')[2]);
        const dep1 = Number(byLabel('(+) الإهلاك')[2]);
        expect(netIncome1 + dep1).not.toBeCloseTo(Number(netRow[2]), 2);
        expect(Number(byLabel('(-) سداد أصل القرض')[2])).toBeCloseTo(-results.cashFlow[1].loanPrincipalPaid, 2);
    });
});
