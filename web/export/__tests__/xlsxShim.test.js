/**
 * تدقيق 2026-07-08 (ملاحظة أمنية عالية #45): حزمة xlsx (SheetJS) بها ثغرة
 * Prototype Pollution عالية الخطورة (CVSS 7.8) بلا إصلاح متاح عبر سجل npm.
 * استُبدلت بـxlsxShim.js (واجهة متوافقة جزئياً مبنية على exceljs الآمنة). هذا
 * يثبّت أن الواجهة البديلة تُنتج ملف xlsx حقيقياً صالحاً (تحميل واسترجاع كامل عبر
 * exceljs نفسها) لا مجرد استدعاءات لا تُفشل بصمت.
 */
import { describe, it, expect, vi } from 'vitest';

let capturedBlob = null;
vi.mock('../utils.js', async (importOriginal) => {
    const orig = await importOriginal();
    return { ...orig, downloadBlob: (blob) => { capturedBlob = blob; } };
});

import { utils, writeFile } from '../xlsxShim.js';
import ExcelJS from 'exceljs';

async function reload(blob) {
    const buf = await blob.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    return wb;
}

describe('xlsxShim — واجهة متوافقة مع أنماط استخدام excelExporter.js/sectionExporter.js', () => {
    it('book_new→aoa_to_sheet→book_append_sheet→writeFile: ينتج ملف xlsx حقيقياً بصفوف وأعمدة صحيحة', async () => {
        capturedBlob = null;
        const wb = utils.book_new();
        const ws = utils.aoa_to_sheet([
            ['الاسم', 'القيمة'],
            ['الإيراد', 500000],
            ['التكلفة', 300000],
        ]);
        ws['!cols'] = [{ wch: 20 }, { wch: 15 }];
        utils.book_append_sheet(wb, ws, 'ورقة1');

        await writeFile(wb, 'test.xlsx');
        expect(capturedBlob).toBeTruthy();
        expect(capturedBlob.type).toContain('spreadsheetml');

        const reloaded = await reload(capturedBlob);
        const sheet = reloaded.getWorksheet('ورقة1');
        expect(sheet).toBeTruthy();
        expect(sheet.getCell('A1').value).toBe('الاسم');
        expect(sheet.getCell('B2').value).toBe(500000);
        expect(sheet.getCell('B3').value).toBe(300000);
        // عرض العمود المطلوب عبر !cols وصل فعلياً لملف XLSX الحقيقي
        expect(sheet.getColumn(1).width).toBe(20);
        expect(sheet.getColumn(2).width).toBe(15);
    });

    it('يدعم أوراقاً متعددة بنفس الترتيب المُضاف', async () => {
        capturedBlob = null;
        const wb = utils.book_new();
        utils.book_append_sheet(wb, utils.aoa_to_sheet([['أ']]), 'الأولى');
        utils.book_append_sheet(wb, utils.aoa_to_sheet([['ب']]), 'الثانية');
        utils.book_append_sheet(wb, utils.aoa_to_sheet([['ج']]), 'الثالثة');

        await writeFile(wb, 'multi.xlsx');
        const reloaded = await reload(capturedBlob);
        expect(reloaded.worksheets.map(w => w.name)).toEqual(['الأولى', 'الثانية', 'الثالثة']);
    });

    it('move_last_sheet_to_front: الورقة الأخيرة المُضافة (الفهرس عادة) تصبح أول ورقة فعلياً في الملف المُصدَّر', async () => {
        capturedBlob = null;
        const wb = utils.book_new();
        utils.book_append_sheet(wb, utils.aoa_to_sheet([['محتوى1']]), 'محتوى1');
        utils.book_append_sheet(wb, utils.aoa_to_sheet([['محتوى2']]), 'محتوى2');
        utils.book_append_sheet(wb, utils.aoa_to_sheet([['فهرس']]), 'فهرس'); // يُضاف أخيراً كما في addIndexSheet الحقيقي

        expect(wb.SheetNames).toEqual(['محتوى1', 'محتوى2', 'فهرس']);
        utils.move_last_sheet_to_front(wb);
        expect(wb.SheetNames).toEqual(['فهرس', 'محتوى1', 'محتوى2']); // القائمة الوصفية تعكس الترتيب الجديد

        await writeFile(wb, 'reorder.xlsx');
        const reloaded = await reload(capturedBlob);
        // الأهم: الترتيب الفعلي داخل ملف XLSX الحقيقي (لا فقط القائمة الوصفية في الذاكرة)
        expect(reloaded.worksheets.map(w => w.name)).toEqual(['فهرس', 'محتوى1', 'محتوى2']);
    });

    it('SheetNames يبقى قابلاً للقراءة (map) بعد كل book_append_sheet — يطابق استخدام addIndexSheet الفعلي', () => {
        const wb = utils.book_new();
        utils.book_append_sheet(wb, utils.aoa_to_sheet([['x']]), 'ورقة أ');
        utils.book_append_sheet(wb, utils.aoa_to_sheet([['y']]), 'ورقة ب');
        const rows = wb.SheetNames.map(name => [name, `وصف ${name}`]);
        expect(rows).toEqual([['ورقة أ', 'وصف ورقة أ'], ['ورقة ب', 'وصف ورقة ب']]);
    });
});
