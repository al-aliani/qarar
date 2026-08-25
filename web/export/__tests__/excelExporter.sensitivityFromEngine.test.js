/**
 * @vitest-environment jsdom
 *
 * مسح 2026-08-26: ورقة «الحساسية» كانت تقرأ this.data.scenarios.sensitivity — إعدادات
 * إدخال فقط (schema.js:628) — فتُصدَّر بلا رقم واحد: «المتغير المختار | revenue»، ثم
 * قائمة revenue/costs/price/volume بأربع خانات قيمة فارغة حرفياً، بينما المحرك حسب
 * results.tornado بخمسة محاور ورسمها التقرير PDF لنفس الدراسة. نفس نمط عيب
 * addScenariosSheet المُصلَح في 2026-08-21 ولم تُشمَل به الورقة المجاورة.
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

function cafeStudy() {
    const data = createEmptyStudy();
    data[SECTIONS.PROJECT_INFO] = { ...data[SECTIONS.PROJECT_INFO], name: 'مقهى' };
    data.assumptions = { ...data.assumptions, projectionYears: 5, rampUpMonths: 0 };
    data[SECTIONS.TECHNICAL] = { equipment: [{ price: 400000, quantity: 1, life: 7 }], buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: [] };
    data[SECTIONS.HR] = { positions: [{ position: 'باريستا', count: 3, salary: 5000, months: 12, nationality: 'saudi' }] };
    data[SECTIONS.LOGISTICS] = { logistics: [] };
    data[SECTIONS.ADMINISTRATIVE] = { administrative: [{ name: 'إيجار', monthly: 12000 }] };
    data[SECTIONS.MARKETING] = { campaigns: [] };
    data[SECTIONS.SERVICES] = { ...data[SECTIONS.SERVICES], items: [] };
    data[SECTIONS.REVENUE] = { streams: [{ name: 'مشروبات', type: 'operating', customersPerMonth: 3000, avgPrice: 25, variableCostRate: 0.3, growthRate: 0.03 }] };
    data[SECTIONS.FINANCING] = { sources: { equity: { amount: 600000, percentage: 100 } } };
    data[SECTIONS.TECH_RESOURCES] = { techResources: [] };
    data[SECTIONS.LEGAL] = { licenses: [] };
    return data;
}

describe('ExcelExporter — ورقة الحساسية تُبنى من ناتج المحرك لا من إعدادات الإدخال', () => {
    beforeEach(() => {
        capturedBlob = null;
        global.URL.createObjectURL = vi.fn((blob) => { capturedBlob = blob; return 'blob:mock-url'; });
        global.URL.revokeObjectURL = vi.fn();
    });

    it('تعرض محاور Tornado بأرقام NPV فعلية — لا مفاتيح إنجليزية بخانات فارغة', async () => {
        const study = cafeStudy();
        const results = calculateStudy(study);
        expect(results.tornado.length).toBe(5);

        const exporter = new ExcelExporter(study, results, { lang: 'ar' });
        await exporter.export('test');
        const wb = await reload(capturedBlob);
        const ws = wb.getWorksheet('الحساسية');
        expect(ws).toBeTruthy();

        const rows = [];
        ws.eachRow((row) => rows.push(row.values.slice(1)));

        // المفاتيح الإنجليزية النائبة اختفت
        const labels = rows.map((r) => String(r[0] ?? ''));
        expect(labels).not.toContain('revenue');
        expect(labels).not.toContain('volume');
        expect(labels).not.toContain('المتغيرات المدعومة');

        // كل محور من محاور المحرك له صفّ بأرقامه الثلاثة
        results.tornado.forEach((axis) => {
            const row = rows.find((r) => r[0] === axis.variable);
            expect(row, axis.variable).toBeTruthy();
            expect(Number(row[1])).toBeCloseTo(axis.npvLow, 2);
            expect(Number(row[2])).toBeCloseTo(axis.npvHigh, 2);
            expect(Number(row[3])).toBeCloseTo(axis.swing, 2);
        });

        // حالات results.sensitivity حاضرة بأرقامها أيضاً
        expect(results.sensitivity.length).toBeGreaterThan(0);
        const revCase = results.sensitivity[0].cases[0];
        const caseRow = rows.find((r) => r[0] === results.sensitivity[0].dim && r[1] === revCase.value);
        expect(caseRow).toBeTruthy();
        expect(Number(caseRow[2])).toBeCloseTo(revCase.kpis.npv, 2);

        // لا خانة قيمة فارغة في أي صفّ بيانات
        const dataRows = rows.filter((r) => results.tornado.some((a) => a.variable === r[0]));
        dataRows.forEach((r) => expect(r[1]).not.toBe(''));
    });

    it('تُحذف الورقة كلياً عند غياب ناتج الحساسية بدل طباعة قائمة نائبة', async () => {
        const study = cafeStudy();
        const exporter = new ExcelExporter(study, { incomeStatement: [{ year: 1, revenue: 100000, netIncome: 10000 }] }, { lang: 'ar' });
        await exporter.export('test');
        const wb = await reload(capturedBlob);
        expect(wb.getWorksheet('الحساسية')).toBeFalsy();
    });
});
