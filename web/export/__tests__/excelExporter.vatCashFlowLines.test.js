/**
 * @vitest-environment jsdom
 *
 * تدقيق شامل 2026-09-16: ورقة «التدفقات النقدية» في Excel كانت تفتقد صفّي
 * vatNetPayable وcashFlowAfterVat تماماً، رغم وجودهما في Word لنفس البيانات
 * (createCashFlowTable). نفس الدراسة تُنتج قصتين ماليتين مختلفتين حسب الصيغة —
 * عميل يفتح Excel لا يرى أثر ضريبة القيمة المضافة على السيولة إطلاقاً.
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

function studyWithRevenue() {
    const data = createEmptyStudy();
    data[SECTIONS.PROJECT_INFO] = { ...data[SECTIONS.PROJECT_INFO], name: 'مقهى' };
    data.assumptions = { ...data.assumptions, projectionYears: 3, rampUpMonths: 0 };
    data[SECTIONS.TECHNICAL] = { equipment: [{ price: 200000, quantity: 1, life: 7 }], buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: [] };
    data[SECTIONS.HR] = { positions: [{ position: 'باريستا', count: 2, salary: 4000, months: 12, nationality: 'saudi' }] };
    data[SECTIONS.LOGISTICS] = { logistics: [] };
    data[SECTIONS.ADMINISTRATIVE] = { administrative: [{ name: 'إيجار', monthly: 8000 }] };
    data[SECTIONS.MARKETING] = { campaigns: [] };
    data[SECTIONS.SERVICES] = { ...data[SECTIONS.SERVICES], items: [] };
    data[SECTIONS.REVENUE] = { streams: [{ name: 'مشروبات', type: 'operating', customersPerMonth: 2500, avgPrice: 22, variableCostRate: 0.30, growthRate: 0.03 }] };
    data[SECTIONS.FINANCING] = { sources: { equity: { amount: 200000, percentage: 100 } } };
    data[SECTIONS.TECH_RESOURCES] = { techResources: [] };
    data[SECTIONS.LEGAL] = { licenses: [] };
    return data;
}

describe('ExcelExporter — صفوف ضريبة القيمة المضافة في التدفقات النقدية (مطابقة لـWord)', () => {
    beforeEach(() => {
        capturedBlob = null;
        global.URL.createObjectURL = vi.fn((blob) => { capturedBlob = blob; return 'blob:mock-url'; });
        global.URL.revokeObjectURL = vi.fn();
    });

    it('صفّا vatNetPayable وcashFlowAfterVat يظهران في Excel ويطابقان قيم المحرك رقمياً', async () => {
        const study = studyWithRevenue();
        const results = calculateStudy(study);

        // شرط الحالة: VAT فعلية غير صفرية — وإلا فالاختبار لا يغطي المسار المعنيّ
        const cf = results.cashFlow;
        expect(cf.some((c) => Math.abs(c.vatNetPayable || 0) > 0)).toBe(true);

        const exporter = new ExcelExporter(study, results, { lang: 'ar' });
        await exporter.export('test');
        const wb = await reload(capturedBlob);
        const ws = wb.getWorksheet('التدفقات النقدية');
        expect(ws).toBeTruthy();

        const rows = [];
        ws.eachRow((row) => rows.push(row.values.slice(1)));
        const byLabel = (label) => rows.find((r) => r[0] === label);

        const vatRow = byLabel('صافي ضريبة القيمة المضافة المستحقة');
        const afterVatRow = byLabel('التدفق النقدي بعد ضريبة القيمة المضافة');
        expect(vatRow, 'صفّ صافي ضريبة القيمة المضافة يجب أن يظهر').toBeTruthy();
        expect(afterVatRow, 'صفّ التدفق النقدي بعد الضريبة يجب أن يظهر').toBeTruthy();

        // سنة 0 (أول عنصر) هي صفّ الاستثمار الأولي فقط — لا vatNetPayable/cashFlowAfterVat
        // لها أصلاً في المحرك (engine.js:1385)، فالمقارنة تبدأ من السنة 1 فعلياً.
        for (let col = 2; col <= cf.length; col++) {
            expect(Number(vatRow[col])).toBeCloseTo(cf[col - 1].vatNetPayable, 2);
            expect(Number(afterVatRow[col])).toBeCloseTo(cf[col - 1].cashFlowAfterVat, 2);
        }
    });
});
