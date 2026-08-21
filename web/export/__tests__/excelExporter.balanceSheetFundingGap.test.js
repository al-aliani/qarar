/**
 * @vitest-environment jsdom
 *
 * تدقيق حي 2026-07-22 (تقرير go/no-go)، مُتحقَّق منه 2026-08-21: ورقة «الميزانية»
 * المُصدَّرة لـExcel كانت تعرض إجمالي الخصوم وإجمالي حقوق الملكية ثم «الخصوم + حقوق
 * الملكية» مباشرة، بينما هذا الإجمالي الأخير يضمّ fundingGap صمتاً
 * (lib/calc/balanceSheet.js: totalLiabilitiesAndEquity = totalLiabilities + totalEquity
 * + fundingGap) — فمجموع الصفّين الظاهرين لا يطابق الإجمالي الظاهر كلما وُجدت فجوة
 * تمويل غير مغطاة (دراسة برأس مال مدفوع أقل من الاستثمار المطلوب).
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

// رأس مال مدفوع أقل عمداً من الاستثمار المطلوب (معدات باهظة) ⇒ fundingGap > 0 مضمون.
function underfundedStudy() {
    const data = createEmptyStudy();
    data[SECTIONS.PROJECT_INFO] = { ...data[SECTIONS.PROJECT_INFO], name: 'دراسة فجوة تمويل', businessModel: 'Independent' };
    data.assumptions = { ...data.assumptions, projectionYears: 3, discountRate: 0.10, inflationRate: 0.02, taxRate: 0 };
    data[SECTIONS.TECHNICAL] = { equipment: [{ price: 500000, quantity: 1 }], buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: [] };
    data[SECTIONS.HR] = { positions: [{ position: 'موظف', count: 1, salary: 4000, months: 12, nationality: 'saudi' }] };
    data[SECTIONS.LOGISTICS] = { logistics: [] };
    data[SECTIONS.ADMINISTRATIVE] = { administrative: [] };
    data[SECTIONS.MARKETING] = { campaigns: [] };
    data[SECTIONS.REVENUE] = { streams: [{ type: 'operating', customersPerMonth: 1000, avgPrice: 30, variableCostRate: 0.3, growthRate: 0 }] };
    data[SECTIONS.SERVICES] = { items: [] };
    // مساهمة المالك صغيرة جداً مقارنة بتكلفة المعدات — لا قرض بنكي يغطي الفارق ⇒ فجوة صريحة.
    data[SECTIONS.FINANCING] = { sources: { equity: { amount: 50000, percentage: 100 } } };
    data[SECTIONS.TECH_RESOURCES] = { techResources: [] };
    data[SECTIONS.LEGAL] = { licenses: [] };
    return data;
}

describe('ExcelExporter — ورقة الميزانية تُظهر فجوة التمويل صراحةً', () => {
    beforeEach(() => {
        capturedBlob = null;
        global.URL.createObjectURL = vi.fn((blob) => { capturedBlob = blob; return 'blob:mock-url'; });
        global.URL.revokeObjectURL = vi.fn();
    });

    it('الدراسة المولَّدة فعلاً لديها fundingGap > 0 (شرط الاختبار)', () => {
        const results = calculateStudy(underfundedStudy());
        expect(results.balanceSheets?.[0]?.fundingGap).toBeGreaterThan(0);
    });

    it('ورقة "الميزانية" تتضمن صفّ فجوة التمويل بقيمة تطابق البيانات، والصفوف الظاهرة تجمع للإجمالي', async () => {
        const study = underfundedStudy();
        const results = calculateStudy(study);
        const exporter = new ExcelExporter(study, results, { lang: 'ar' });
        await exporter.export('test');
        expect(capturedBlob).toBeTruthy();

        const wb = await reload(capturedBlob);
        const ws = wb.getWorksheet('الميزانية');
        expect(ws).toBeTruthy();

        const rows = [];
        ws.eachRow((row) => rows.push([row.getCell(1).value, row.getCell(2).value]));

        const gapRow = rows.find((r) => typeof r[0] === 'string' && r[0].includes('فجوة تمويل'));
        const liabRow = rows.find((r) => r[0] === 'إجمالي الالتزامات');
        const equityRow = rows.find((r) => r[0] === 'إجمالي حقوق الملكية');
        const totalRow = rows.find((r) => r[0] === 'الخصوم + حقوق الملكية');

        expect(gapRow).toBeTruthy();
        const expectedGap = results.balanceSheets[0].fundingGap;
        expect(Number(gapRow[1])).toBeCloseTo(expectedGap, 0);
        expect(Number(gapRow[1])).toBeGreaterThan(0);

        // الآن الصفوف الظاهرة (خصوم + حقوق ملكية + فجوة) تجمع فعلياً للإجمالي الظاهر
        const sum = Number(liabRow[1]) + Number(equityRow[1]) + Number(gapRow[1]);
        expect(sum).toBeCloseTo(Number(totalRow[1]), 0);
    });
});
