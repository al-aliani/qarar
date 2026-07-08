/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-09: addRevenueSheet() كانت تعتمد على `this.results.revenueProjection`،
 * مفتاح لا يُنتجه calculateStudy() إطلاقاً (تم التأكد تجريبياً)، فقسم تفصيل الإيرادات
 * حسب كل مصدر (streams) كان ميتاً بالكامل ولا يُنفَّذ أبداً في الإنتاج. هذا الاختبار
 * يثبت أن الإصلاح يقرأ البيانات الخام الحقيقية من `study.revenue.streams` ويعرض
 * *كل* المصادر بلا أي سقف (4 مصادر هنا، أكثر من الحد القديم 3 في excel.js)، وأن
 * صف الإجماليات (من incomeStatement) يبقى سليماً دون تأثر بإصلاح تفصيل المصادر.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

let capturedBlob = null;

import { ExcelExporter } from '../excelExporter.js';
import ExcelJS from 'exceljs';

async function reload(blob) {
    const buf = await blob.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    return wb;
}

describe('ExcelExporter.addRevenueSheet() — إصلاح الكود الميت (revenueProjection) بقراءة revenue.streams الحقيقية', () => {
    beforeEach(() => {
        capturedBlob = null;
        global.URL.createObjectURL = vi.fn((blob) => { capturedBlob = blob; return 'blob:mock-url'; });
        global.URL.revokeObjectURL = vi.fn();
    });

    it('يعرض كل مصادر الإيراد الأربعة (بلا سقف 3) مع إجمالي السنة الأولى الصحيح لكل مصدر، وصف الإجماليات يبقى من incomeStatement', async () => {
        const study = {
            revenue: {
                streams: [
                    { name: 'A', customersPerMonth: 500, avgPrice: 100 },
                    { name: 'B', customersPerMonth: 200, avgPrice: 50 },
                    { name: 'C', customersPerMonth: 100, avgPrice: 30 },
                    { name: 'D', customersPerMonth: 50, avgPrice: 20 },
                ],
            },
        };
        const results = {
            incomeStatement: [
                { year: 1, revenue: 500000 },
                { year: 2, revenue: 550000 },
            ],
        };

        const exporter = new ExcelExporter(study, results);
        const filename = await exporter.export('test');
        expect(filename).toMatch(/\.xlsx$/);
        expect(capturedBlob).toBeTruthy();

        const wb = await reload(capturedBlob);
        const sheet = wb.getWorksheet('الإيرادات');
        expect(sheet).toBeTruthy();

        // اجمع كل الصفوف كمصفوفة قيم (تجاهل الفهرس صفر الفارغ من exceljs)
        const rows = [];
        sheet.eachRow((row) => {
            rows.push(row.values.slice(1)); // exceljs: values[0] فارغة دائماً
        });

        // صف الإجماليات: ['الإيرادات', '', 500000, 550000] — سليم وغير متأثر بإصلاح المصادر
        const totalsRow = rows.find((r) => r[0] === 'الإيرادات');
        expect(totalsRow).toBeTruthy();
        expect(totalsRow[2]).toBe(500000);
        expect(totalsRow[3]).toBe(550000);

        // كل الأسماء الأربعة موجودة فعلياً — لا سقف 3 (السقف كان في excel.js فقط، لا هنا)
        const names = rows.map((r) => r[0]);
        expect(names).toContain('A');
        expect(names).toContain('B');
        expect(names).toContain('C');
        expect(names).toContain('D');

        // مصدر D: 50 عميل × 12 شهراً × 20 ريال = 12000 (إيراد السنة الأولى فقط، لا يُختلق نمو متعدد السنوات لكل مصدر)
        const rowD = rows.find((r) => r[0] === 'D');
        expect(rowD[2]).toBe(12000);

        // مصدر A: 500 × 12 × 100 = 600000
        const rowA = rows.find((r) => r[0] === 'A');
        expect(rowA[2]).toBe(600000);
    });
});
