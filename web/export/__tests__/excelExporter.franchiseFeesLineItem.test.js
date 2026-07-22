/**
 * @vitest-environment jsdom
 *
 * تدقيق حي 2026-07-22 (تقرير جلسة موازية، مُتحقَّق منه): رسوم الامتياز
 * (franchiseFees) كانت تُخصَم صمتاً داخل احتساب EBITDA في engine.js
 * (ebitda = grossProfit - fixedCosts - franchiseFees) بلا أي صفّ ظاهر في
 * قائمة الدخل المُصدَّرة لـExcel — فـ"مجمل الربح − المصاريف الثابتة" لا
 * يساوي EBITDA المعروض أمام القارئ. الواجهة الحية (FinancialStatements.js)
 * كانت تعرض الصفّ بالفعل؛ هذا يثبّت أن التصدير يطابقها الآن.
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

function franchiseStudy() {
    const data = createEmptyStudy();
    data[SECTIONS.PROJECT_INFO] = {
        ...data[SECTIONS.PROJECT_INFO],
        name: 'فرع امتياز اختبار', businessModel: 'Franchise',
        franchiseDetails: { royaltyRate: 5, marketingFee: 2 }
    };
    data.assumptions = { ...data.assumptions, projectionYears: 3, discountRate: 0.10, inflationRate: 0.02, taxRate: 0 };
    data[SECTIONS.TECHNICAL] = { equipment: [{ price: 200000, quantity: 1 }], buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: [] };
    data[SECTIONS.HR] = { positions: [{ position: 'موظف', count: 2, salary: 5000, months: 12, nationality: 'saudi' }] };
    data[SECTIONS.LOGISTICS] = { logistics: [] };
    data[SECTIONS.ADMINISTRATIVE] = { administrative: [{ name: 'إيجار', monthly: 8000 }] };
    data[SECTIONS.MARKETING] = { campaigns: [] };
    data[SECTIONS.REVENUE] = { streams: [{ type: 'operating', customersPerMonth: 2000, avgPrice: 40, variableCostRate: 0.3, growthRate: 0.02 }] };
    data[SECTIONS.SERVICES] = { items: [] };
    data[SECTIONS.FINANCING] = { sources: { equity: { amount: 400000, percentage: 100 } } };
    data[SECTIONS.TECH_RESOURCES] = { techResources: [] };
    data[SECTIONS.LEGAL] = { licenses: [] };
    return data;
}

describe('ExcelExporter — صفّ رسوم الامتياز الصريح في قائمة الدخل', () => {
    beforeEach(() => {
        capturedBlob = null;
        global.URL.createObjectURL = vi.fn((blob) => { capturedBlob = blob; return 'blob:mock-url'; });
        global.URL.revokeObjectURL = vi.fn();
    });

    it('دراسة امتياز حقيقية: EBITDA = مجمل الربح − المصاريف الثابتة − رسوم الامتياز (تُطابق البيانات فعلياً)', () => {
        const study = franchiseStudy();
        const results = calculateStudy(study);

        expect(results.incomeStatement[0].franchiseFees).toBeGreaterThan(0);
        results.incomeStatement.forEach((y) => {
            expect(y.grossProfit - y.fixedCosts - y.franchiseFees).toBeCloseTo(y.ebitda, 2);
        });
    });

    it('ورقة قائمة الدخل المُصدَّرة تتضمن صفّ رسوم الامتياز بقيمة صحيحة، بترتيب صحيح قبل EBITDA', async () => {
        const study = franchiseStudy();
        const results = calculateStudy(study);
        const exporter = new ExcelExporter(study, results, { lang: 'ar' });
        await exporter.export('test');
        expect(capturedBlob).toBeTruthy();

        const wb = await reload(capturedBlob);
        const ws = wb.getWorksheet('قائمة الدخل');
        expect(ws).toBeTruthy();

        const rows = [];
        ws.eachRow((row) => rows.push(row.getCell(1).value));

        const franchiseIdx = rows.findIndex((v) => typeof v === 'string' && v.includes('رسوم الامتياز'));
        const ebitdaIdx = rows.findIndex((v) => v === 'EBITDA');
        expect(franchiseIdx).toBeGreaterThan(-1);
        expect(ebitdaIdx).toBeGreaterThan(franchiseIdx);

        const franchiseRow = ws.getRow(franchiseIdx + 1);
        const year1Value = Number(franchiseRow.getCell(2).value);
        expect(year1Value).toBeCloseTo(-results.incomeStatement[0].franchiseFees, 0);
    });

    it('دراسة غير امتياز (Independent): لا يظهر صفّ رسوم الامتياز إطلاقاً', async () => {
        const study = createEmptyStudy();
        study[SECTIONS.PROJECT_INFO] = { ...study[SECTIONS.PROJECT_INFO], name: 'اختبار', businessModel: 'Independent' };
        study.assumptions = { ...study.assumptions, projectionYears: 2, discountRate: 0.10, inflationRate: 0.02, taxRate: 0 };
        study[SECTIONS.TECHNICAL] = { equipment: [], buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: [] };
        study[SECTIONS.HR] = { positions: [{ position: 'موظف', count: 1, salary: 4000, months: 12, nationality: 'saudi' }] };
        study[SECTIONS.LOGISTICS] = { logistics: [] };
        study[SECTIONS.ADMINISTRATIVE] = { administrative: [] };
        study[SECTIONS.MARKETING] = { campaigns: [] };
        study[SECTIONS.REVENUE] = { streams: [{ type: 'operating', customersPerMonth: 1000, avgPrice: 30, variableCostRate: 0.3, growthRate: 0 }] };
        study[SECTIONS.SERVICES] = { items: [] };
        study[SECTIONS.FINANCING] = { sources: { equity: { amount: 100000, percentage: 100 } } };
        study[SECTIONS.TECH_RESOURCES] = { techResources: [] };
        study[SECTIONS.LEGAL] = { licenses: [] };

        const results = calculateStudy(study);
        const exporter = new ExcelExporter(study, results, { lang: 'ar' });
        await exporter.export('test');
        const wb = await reload(capturedBlob);
        const ws = wb.getWorksheet('قائمة الدخل');
        const rows = [];
        ws.eachRow((row) => rows.push(row.getCell(1).value));
        expect(rows.some((v) => typeof v === 'string' && v.includes('رسوم الامتياز'))).toBe(false);
    });
});
