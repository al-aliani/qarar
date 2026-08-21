/**
 * @vitest-environment jsdom
 *
 * تدقيق حي 2026-07-22 (تقرير go/no-go)، مُتحقَّق منه 2026-08-21: ورقة «السيناريوهات»
 * كانت تعرض NPV=0 لكل سيناريو (متشائم/أساسي/متفائل) — السبب الفعلي مصدران خاطئان معاً:
 * (1) تُقرأ من this.data.scenarios (مدخلات خام: revenueChange/costChange فقط، بلا نتائج)
 * بدل this.results.scenarios (النتائج المحسوبة فعلياً في engine.js)، و(2) حتى لو صحّ
 * المصدر، المسار المقروء (.results.indicators.npv) غير موجود أصلاً — الشكل الفعلي
 * scenarios[key].kpis.npv. الحاصل: SAFE.num(undefined) = 0 دائماً، لكل سيناريو بما فيه
 * الأساسي رغم أن NPV الأساسي معروض بشكل صحيح في ورقة المؤشرات لنفس الدراسة.
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

function basicStudy() {
    const data = createEmptyStudy();
    data[SECTIONS.PROJECT_INFO] = { ...data[SECTIONS.PROJECT_INFO], name: 'اختبار سيناريوهات', businessModel: 'Independent' };
    data.assumptions = { ...data.assumptions, projectionYears: 3, discountRate: 0.10, inflationRate: 0.02, taxRate: 0 };
    data[SECTIONS.TECHNICAL] = { equipment: [{ price: 100000, quantity: 1 }], buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: [] };
    data[SECTIONS.HR] = { positions: [{ position: 'موظف', count: 2, salary: 5000, months: 12, nationality: 'saudi' }] };
    data[SECTIONS.LOGISTICS] = { logistics: [] };
    data[SECTIONS.ADMINISTRATIVE] = { administrative: [{ name: 'إيجار', monthly: 8000 }] };
    data[SECTIONS.MARKETING] = { campaigns: [] };
    data[SECTIONS.REVENUE] = { streams: [{ type: 'operating', customersPerMonth: 3000, avgPrice: 40, variableCostRate: 0.3, growthRate: 0.02 }] };
    data[SECTIONS.SERVICES] = { items: [] };
    data[SECTIONS.FINANCING] = { sources: { equity: { amount: 400000, percentage: 100 } } };
    data[SECTIONS.TECH_RESOURCES] = { techResources: [] };
    data[SECTIONS.LEGAL] = { licenses: [] };
    return data;
}

describe('ExcelExporter — ورقة السيناريوهات تعرض NPV/IRR فعليين لا صفراً', () => {
    beforeEach(() => {
        capturedBlob = null;
        global.URL.createObjectURL = vi.fn((blob) => { capturedBlob = blob; return 'blob:mock-url'; });
        global.URL.revokeObjectURL = vi.fn();
    });

    it('results.scenarios يحتوي kpis.npv غير صفري لكل من الأساسي والمتفائل والمتشائم', () => {
        const study = basicStudy();
        const results = calculateStudy(study);
        expect(results.scenarios?.base?.kpis?.npv).not.toBe(0);
        expect(results.scenarios?.optimistic?.kpis?.npv).toBeDefined();
        expect(results.scenarios?.pessimistic?.kpis?.npv).toBeDefined();
        // المتفائل يجب أن يفوق الأساسي، والمتشائم يجب أن يقل عنه — أدنى فحص تماسك
        expect(results.scenarios.optimistic.kpis.npv).toBeGreaterThan(results.scenarios.base.kpis.npv);
        expect(results.scenarios.pessimistic.kpis.npv).toBeLessThan(results.scenarios.base.kpis.npv);
    });

    it('ورقة "السيناريوهات" المُصدَّرة: صفّ الأساسي يطابق results.scenarios.base.kpis.npv (لا صفراً)', async () => {
        const study = basicStudy();
        const results = calculateStudy(study);
        const exporter = new ExcelExporter(study, results, { lang: 'ar' });
        await exporter.export('test');
        expect(capturedBlob).toBeTruthy();

        const wb = await reload(capturedBlob);
        const ws = wb.getWorksheet('السيناريوهات');
        expect(ws).toBeTruthy();

        const rows = [];
        ws.eachRow((row) => rows.push([row.getCell(1).value, row.getCell(5).value]));

        const baseRow = rows.find((r) => r[0] === 'أساسي');
        const optRow = rows.find((r) => r[0] === 'متفائل');
        const pessRow = rows.find((r) => r[0] === 'متشائم');
        expect(baseRow).toBeTruthy();

        const expectedBase = results.scenarios.base.kpis.npv;
        expect(Number(baseRow[1])).toBeCloseTo(expectedBase, 0);
        expect(Number(baseRow[1])).not.toBe(0);
        expect(Number(optRow[1])).toBeCloseTo(results.scenarios.optimistic.kpis.npv, 0);
        expect(Number(pessRow[1])).toBeCloseTo(results.scenarios.pessimistic.kpis.npv, 0);
    });
});
