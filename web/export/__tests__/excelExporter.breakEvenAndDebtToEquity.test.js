/**
 * @vitest-environment jsdom
 *
 * مسح 2026-08-26، بلاغان في ورقة «المؤشرات»:
 * (1) «نقطة التعادل (وحدات/شهر) = 0» لمطعم توصيل يخسر على كل وحدة (تكلفة متغيرة 90%
 *     + هدر 10% + عمولة منصة 10% = 110% من الإيراد ⟶ هامش مساهمة سالب). المحرك يُرجع
 *     breakEvenAchievable = false وbreakEvenReason = 'no_contribution_margin' خصيصاً
 *     لهذه الحالة (engine.js:1487-1495) ولا يقرأهما أي مصدِّر — فيقرأ موظف الائتمان
 *     الصفر كـ«يتعادل من أول وحدة»، أفضل قراءة ممكنة لأسوأ مشروع ممكن.
 * (2) نسبة الدين إلى حقوق الملكية مضاعف (ratios.js:55 = خصوم ÷ حقوق ملكية) يطبعه
 *     التقرير PDF «1.85x» بينما كانت ورقة Excel تطبعه «185.0%» لنفس الدراسة.
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

function baseStudy() {
    const data = createEmptyStudy();
    data[SECTIONS.PROJECT_INFO] = { ...data[SECTIONS.PROJECT_INFO], name: 'اختبار المؤشرات' };
    data.assumptions = { ...data.assumptions, projectionYears: 3, rampUpMonths: 0 };
    data[SECTIONS.TECHNICAL] = { equipment: [{ price: 300000, quantity: 1, life: 7 }], buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: [] };
    data[SECTIONS.HR] = { positions: [{ position: 'موظف', count: 3, salary: 5000, months: 12, nationality: 'saudi' }] };
    data[SECTIONS.LOGISTICS] = { logistics: [] };
    data[SECTIONS.ADMINISTRATIVE] = { administrative: [{ name: 'إيجار', monthly: 20000 }] };
    data[SECTIONS.MARKETING] = { campaigns: [] };
    data[SECTIONS.SERVICES] = { ...data[SECTIONS.SERVICES], items: [] };
    data[SECTIONS.FINANCING] = { sources: { equity: { amount: 500000, percentage: 100 } } };
    data[SECTIONS.TECH_RESOURCES] = { techResources: [] };
    data[SECTIONS.LEGAL] = { licenses: [] };
    return data;
}

async function indicatorRows(study) {
    const results = calculateStudy(study);
    const exporter = new ExcelExporter(study, results, { lang: 'ar' });
    await exporter.export('test');
    const wb = await reload(capturedBlob);
    const ws = wb.getWorksheet('المؤشرات');
    const rows = [];
    ws.eachRow((row) => rows.push(row.values.slice(1)));
    return { results, rows };
}

describe('ExcelExporter — ورقة المؤشرات: التعادل المستحيل ووحدة نسبة الدين', () => {
    beforeEach(() => {
        capturedBlob = null;
        global.URL.createObjectURL = vi.fn((blob) => { capturedBlob = blob; return 'blob:mock-url'; });
        global.URL.revokeObjectURL = vi.fn();
    });

    it('مطعم توصيل بهامش مساهمة سالب: البند نصّ صريح لا صفر', async () => {
        const study = baseStudy();
        study[SECTIONS.REVENUE] = {
            streams: [{
                name: 'طلبات التوصيل', type: 'operating',
                customersPerMonth: 2000, avgPrice: 60,
                variableCostRate: 0.9, wasteRate: 0.1, platformCommissionRate: 0.1,
                growthRate: 0,
            }],
        };

        const { results, rows } = await indicatorRows(study);
        // شرط الحالة كما في البلاغ: تعادل مستحيل + خسارة سنة 1
        expect(results.indicators.breakEvenAchievable).toBe(false);
        expect(results.indicators.breakEvenReason).toBe('no_contribution_margin');
        expect(results.indicators.breakEvenPointValue).toBe(0);
        expect(results.indicators.breakEvenUnits).toBe(0);
        expect(results.incomeStatement[0].netIncome).toBeLessThan(0);

        const row = rows.find((r) => r[0] === 'نقطة التعادل (وحدات/شهر)');
        expect(row).toBeTruthy();
        expect(row[1]).toBe('غير قابل للتعادل — هامش المساهمة سالب');
        expect(row[1]).not.toBe(0);
    });

    it('مشروع رابح عادي: البند يبقى رقم الوحدات الشهرية', async () => {
        const study = baseStudy();
        study[SECTIONS.REVENUE] = {
            streams: [{ name: 'مبيعات', type: 'operating', customersPerMonth: 2000, avgPrice: 60, variableCostRate: 0.3, growthRate: 0 }],
        };

        const { results, rows } = await indicatorRows(study);
        expect(results.indicators.breakEvenAchievable).toBe(true);
        expect(results.indicators.breakEvenUnits).toBeGreaterThan(0);

        const row = rows.find((r) => r[0] === 'نقطة التعادل (وحدات/شهر)');
        expect(typeof row[1]).toBe('number');
        expect(row[1]).toBe(Math.round(results.indicators.breakEvenUnits / 12));
    });

    it('نسبة الدين إلى حقوق الملكية تُطبع كمضاعف (x) لا كنسبة مئوية', async () => {
        const study = baseStudy();
        study[SECTIONS.REVENUE] = {
            streams: [{ name: 'مبيعات', type: 'operating', customersPerMonth: 2000, avgPrice: 60, variableCostRate: 0.3, growthRate: 0 }],
        };
        study[SECTIONS.FINANCING] = {
            sources: {
                equity: { amount: 300000, percentage: 40 },
                bankLoan: { amount: 450000, percentage: 60, interestRate: 0.08, termYears: 5, gracePeriodMonths: 0 },
            },
        };

        const { results, rows } = await indicatorRows(study);
        const de = results.ratios[0].debtToEquity;
        expect(Number.isFinite(de)).toBe(true);

        const row = rows.find((r) => r[0] === 'نسبة الدين إلى حقوق الملكية');
        expect(row).toBeTruthy();
        expect(String(row[1])).toBe(Number(de).toFixed(2) + 'x');
        expect(String(row[1])).not.toContain('%');
    });
});
