/**
 * @vitest-environment jsdom
 *
 * مسح 2026-08-26: ورقة «الإيرادات» كانت تسرد تفصيل المصادر من this.data.revenue.streams
 * خاماً (customersPerMonth × 12 × avgPrice) بجانب صفّ إجمالي الإيرادات القادم من قائمة
 * الدخل — رقمان تحت بعضهما لا يتصالحان، وفي حالة الخدمات يسرد مصدراً لم يساهم بريال
 * واحد ويُخفي المصدر الذي ولّد الإيراد فعلاً (financial/revenue.js:38 يُلغي صفوف
 * revenue.streams التشغيلية كلياً متى وُجدت خدمات).
 *
 * الاختبار يعيد إنتاج الحالات الثلاث المذكورة في البلاغ بأرقامها الحرفية.
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

const TOTAL_LABEL = 'إجمالي مصادر السنة 1 (كما في قائمة الدخل)';
const ADJUST_LABEL = 'تسوية التصاعد واستغلال الطاقة (السنة 1)';

function baseStudy() {
    const data = createEmptyStudy();
    data[SECTIONS.PROJECT_INFO] = { ...data[SECTIONS.PROJECT_INFO], name: 'اختبار تفصيل الإيراد' };
    data.assumptions = { ...data.assumptions, projectionYears: 3, rampUpMonths: 0 };
    data[SECTIONS.TECHNICAL] = { equipment: [{ price: 100000, quantity: 1 }], buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: [] };
    data[SECTIONS.HR] = { positions: [{ position: 'موظف', count: 1, salary: 5000, months: 12, nationality: 'saudi' }] };
    data[SECTIONS.LOGISTICS] = { logistics: [] };
    data[SECTIONS.ADMINISTRATIVE] = { administrative: [{ name: 'إيجار', monthly: 5000 }] };
    data[SECTIONS.MARKETING] = { campaigns: [] };
    data[SECTIONS.SERVICES] = { ...data[SECTIONS.SERVICES], items: [] };
    data[SECTIONS.REVENUE] = { streams: [] };
    data[SECTIONS.FINANCING] = { sources: { equity: { amount: 300000, percentage: 100 } } };
    data[SECTIONS.TECH_RESOURCES] = { techResources: [] };
    data[SECTIONS.LEGAL] = { licenses: [] };
    return data;
}

/** صفوف ورقة «الإيرادات» كمصفوفة [التسمية، قيمة السنة 1] لصفوف التفصيل فقط. */
async function revenueSheetRows(study) {
    const results = calculateStudy(study);
    const exporter = new ExcelExporter(study, results, { lang: 'ar' });
    await exporter.export('test');
    const wb = await reload(capturedBlob);
    const ws = wb.getWorksheet('الإيرادات');
    const rows = [];
    ws.eachRow((row) => rows.push([row.getCell(1).value, row.getCell(3).value]));
    return { results, rows };
}

describe('ExcelExporter — تفصيل مصادر الإيراد يتصالح مع إيراد قائمة الدخل', () => {
    beforeEach(() => {
        capturedBlob = null;
        global.URL.createObjectURL = vi.fn((blob) => { capturedBlob = blob; return 'blob:mock-url'; });
        global.URL.revokeObjectURL = vi.fn();
    });

    it('(أ) خدمات + مصادر إيراد معاً: يسرد الخدمة التي ولّدت 720,000 لا الاشتراك الذي أهمله المحرك', async () => {
        const study = baseStudy();
        study[SECTIONS.SERVICES].items = [
            { name: 'خدمة أ', customersPerMonth: 300, pricePerUnit: 200, variableCostPerUnit: 40, growthRate: 0 },
        ];
        study[SECTIONS.REVENUE].streams = [
            { name: 'اشتراك شهري', type: 'operating', customersPerMonth: 100, avgPrice: 500, variableCostRate: 0.3, growthRate: 0 },
        ];

        const { results, rows } = await revenueSheetRows(study);
        expect(results.incomeStatement[0].revenue).toBe(720000);

        const labels = rows.map((r) => r[0]);
        expect(labels).toContain('خدمة أ');
        // المصدر الذي أهمله المحرك كلياً يجب ألا يظهر كأنه ساهم بـ600,000
        expect(labels).not.toContain('اشتراك شهري');

        const serviceRow = rows.find((r) => r[0] === 'خدمة أ');
        expect(Number(serviceRow[1])).toBe(720000);

        const totalRow = rows.find((r) => r[0] === TOTAL_LABEL);
        expect(totalRow).toBeTruthy();
        expect(Number(totalRow[1])).toBe(720000);
    });

    it('(ب) تصاعد 6 أشهر: صفّ التسوية يجعل العمود يجمع إلى 1,045,000 بدل 1,320,000', async () => {
        const study = baseStudy();
        study.assumptions.rampUpMonths = 6;
        study[SECTIONS.REVENUE].streams = [
            { name: 'مبيعات', type: 'operating', customersPerMonth: 1000, avgPrice: 110, variableCostRate: 0.3, growthRate: 0 },
        ];

        const { results, rows } = await revenueSheetRows(study);
        const engineY1 = results.incomeStatement[0].revenue;
        expect(Math.round(engineY1)).toBe(1045000);

        const planRow = rows.find((r) => r[0] === 'مبيعات');
        expect(Number(planRow[1])).toBe(1320000);

        const adjustRow = rows.find((r) => r[0] === ADJUST_LABEL);
        const totalRow = rows.find((r) => r[0] === TOTAL_LABEL);
        expect(adjustRow).toBeTruthy();
        expect(totalRow).toBeTruthy();
        expect(Number(adjustRow[1])).toBeCloseTo(engineY1 - 1320000, 6);
        // العمود يجمع بحكم البناء: بنود التفصيل + التسوية = الإجمالي = رقم قائمة الدخل
        expect(Number(planRow[1]) + Number(adjustRow[1])).toBeCloseTo(Number(totalRow[1]), 6);
        expect(Number(totalRow[1])).toBeCloseTo(engineY1, 6);
    });

    it('(ج) استغلال طاقة 70%: العمود يجمع إلى 2,520,000 لا 3,600,000', async () => {
        const study = baseStudy();
        study[SECTIONS.TECHNICAL].capacityUtilization = [{ year: 1, rate: 0.7 }, { year: 2, rate: 0.7 }, { year: 3, rate: 0.7 }];
        study[SECTIONS.REVENUE].streams = [
            { name: 'مبيعات', type: 'operating', customersPerMonth: 1000, avgPrice: 300, variableCostRate: 0.3, growthRate: 0 },
        ];

        const { results, rows } = await revenueSheetRows(study);
        const engineY1 = results.incomeStatement[0].revenue;
        expect(Math.round(engineY1)).toBe(2520000);

        const planRow = rows.find((r) => r[0] === 'مبيعات');
        const adjustRow = rows.find((r) => r[0] === ADJUST_LABEL);
        const totalRow = rows.find((r) => r[0] === TOTAL_LABEL);
        expect(adjustRow).toBeTruthy();
        expect(totalRow).toBeTruthy();
        expect(Number(planRow[1])).toBe(3600000);
        expect(Number(planRow[1]) + Number(adjustRow[1])).toBeCloseTo(Number(totalRow[1]), 6);
        expect(Number(totalRow[1])).toBeCloseTo(engineY1, 6);
    });
});
