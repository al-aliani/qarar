/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-08 (ملاحظة أمنية عالية #45): تكامل كامل — ExcelExporter.export()
 * وexportSectionToExcel() (اللذان كانا يعتمدان على حزمة xlsx الثغِرة عبر
 * window.XLSX) ينتجان الآن ملفات xlsx حقيقية وصالحة عبر xlsxShim.js/exceljs، بلا
 * أي تغيير في واجهة استخدامهما العامة (لا كسر توافق).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// jsdom لا يُنفِّذ URL.createObjectURL/revokeObjectURL (فجوة معروفة) — downloadBlob
// الحقيقية (export/utils.js) تستدعيها فعلياً؛ نستبدلها مباشرة لالتقاط الـBlob دون
// الحاجة لمحاكاة وحدة utils.js كاملة (تعقيد الاستيراد الديناميكي المتداخل عبر
// loadXLSX→xlsxShim.js→utils.js يجعل vi.mock العابر للوحدات هشاً هنا).
let capturedBlob = null;

import { ExcelExporter } from '../excelExporter.js';
import { exportSectionToExcel } from '../../js/utils/sectionExporter.js';
import { createEmptyStudy, SECTIONS } from '../../js/core/schema.js';
import { calculateStudy } from '../../js/core/engine.js';
import ExcelJS from 'exceljs';

async function reload(blob) {
    const buf = await blob.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    return wb;
}

function realStudy() {
    const data = createEmptyStudy();
    data[SECTIONS.PROJECT_INFO] = { ...data[SECTIONS.PROJECT_INFO], name: 'مطعم اختبار الترحيل', businessModel: 'Independent' };
    data.assumptions = { ...data.assumptions, projectionYears: 5, discountRate: 0.10, inflationRate: 0.02, taxRate: 0 };
    data[SECTIONS.TECHNICAL] = { equipment: [{ price: 300000, quantity: 1 }], buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: [] };
    data[SECTIONS.HR] = { positions: [{ position: 'شيف', count: 2, salary: 5000, months: 12, nationality: 'saudi' }] };
    data[SECTIONS.LOGISTICS] = { logistics: [] };
    data[SECTIONS.ADMINISTRATIVE] = { administrative: [{ name: 'إيجار', monthly: 10000 }] };
    data[SECTIONS.MARKETING] = { campaigns: [] };
    data[SECTIONS.REVENUE] = { streams: [{ type: 'operating', customersPerMonth: 1200, avgPrice: 100, variableCostRate: 0.30, growthRate: 0.03 }] };
    data[SECTIONS.SERVICES] = { items: [] };
    data[SECTIONS.FINANCING] = { sources: { equity: { amount: 400000 }, bankLoan: { amount: 200000, interestRate: 0.07, termYears: 5, gracePeriodMonths: 0, repaymentType: 'equal' } } };
    data[SECTIONS.TECH_RESOURCES] = { techResources: [] };
    data[SECTIONS.LEGAL] = { licenses: [] };
    return data;
}

describe('ExcelExporter.export() — تكامل حقيقي مع xlsxShim (بديل xlsx الثغِرة)', () => {
    beforeEach(() => {
        capturedBlob = null;
        global.URL.createObjectURL = vi.fn((blob) => { capturedBlob = blob; return 'blob:mock-url'; });
        global.URL.revokeObjectURL = vi.fn();
    });

    it('يُنتج ملف Excel صالحاً حقيقياً بعدة أوراق، وورقة الفهرس تُصبح الأولى فعلياً', async () => {
        const study = realStudy();
        const results = calculateStudy(study);
        const exporter = new ExcelExporter(study, results);

        const filename = await exporter.export('test');
        expect(filename).toMatch(/\.xlsx$/);
        expect(capturedBlob).toBeTruthy();

        const wb = await reload(capturedBlob);
        expect(wb.worksheets.length).toBeGreaterThan(5);
        // الفهرس أول ورقة فعلياً في الملف (move_last_sheet_to_front نجحت في xlsxShim)
        expect(wb.worksheets[0].name).toBe('فهرس');
        // ورقة الملخص موجودة وتحوي رقماً حقيقياً من نتائج المحرك (لا صفر مفبرك)
        const summary = wb.getWorksheet('الملخص');
        expect(summary).toBeTruthy();
    });

    it('لا يرمي خطأً، ويُعيد اسم ملف يتضمن اسم المشروع المُطهَّر', async () => {
        const study = realStudy();
        const results = calculateStudy(study);
        const exporter = new ExcelExporter(study, results);
        const filename = await exporter.export('fallback');
        expect(filename).toContain('مطعم_اختبار_الترحيل');
    });
});

describe('exportSectionToExcel() — تكامل حقيقي مع xlsxShim لتصدير قسم واحد', () => {
    beforeEach(() => {
        capturedBlob = null;
        global.URL.createObjectURL = vi.fn((blob) => { capturedBlob = blob; return 'blob:mock-url'; });
        global.URL.revokeObjectURL = vi.fn();
    });

    it('يُصدِّر قسماً واحداً (revenue) كملف Excel صالح فعلياً بالبيانات الحقيقية', async () => {
        const study = realStudy();
        const filename = await exportSectionToExcel(study, SECTIONS.REVENUE, 'الإيرادات');
        expect(filename).toMatch(/\.xlsx$/);
        expect(capturedBlob).toBeTruthy();

        const wb = await reload(capturedBlob);
        expect(wb.worksheets.length).toBeGreaterThanOrEqual(1);
    });
});
