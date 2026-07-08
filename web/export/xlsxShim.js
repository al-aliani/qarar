/**
 * واجهة متوافقة جزئياً مع SheetJS (XLSX) مبنية على exceljs — بديل لحزمة xlsx بعد
 * اكتشاف ثغرة Prototype Pollution عالية الخطورة فيها بلا إصلاح متاح عبر سجل npm
 * (تدقيق 2026-07-08، ملاحظة أمنية عالية #45). تغطّي فقط سطح الاستخدام الفعلي في
 * هذا المشروع (excelExporter.js/sectionExporter.js): book_new/aoa_to_sheet/
 * book_append_sheet/writeFile + عرض الأعمدة (!cols) + SheetNames/Workbook.Views
 * وإعادة ترتيب الورقة الأخيرة للمقدمة — لا كل واجهة SheetJS.
 */
import ExcelJS from 'exceljs';
import { downloadBlob } from './utils.js';

function book_new() {
    return {
        _wb: new ExcelJS.Workbook(),
        // SheetNames: قائمة حقيقية تُحدَّث مع كل book_append_sheet — تُستخدم للقراءة
        // فقط (مثال: بناء فهرس الأوراق)؛ .Workbook دمية متوافقة (RTL يُطبَّق فعلياً
        // لكل ورقة عند addWorksheet في book_append_sheet، لا عبر هذا الكائن).
        SheetNames: [],
        Workbook: {},
    };
}

// exceljs يربط الورقة بمصنّف محدد عند الإنشاء (لا كائن ورقة مستقل كـSheetJS) —
// نحتفظ بالصفوف هنا مؤقتاً، ونبنيها فعلياً داخل book_append_sheet.
function aoa_to_sheet(rows) {
    return { _rows: Array.isArray(rows) ? rows : [] };
}

function book_append_sheet(workbook, ws, name) {
    const cleanName = String(name || 'Sheet').substring(0, 31);
    const sheet = workbook._wb.addWorksheet(cleanName, { views: [{ rightToLeft: true }] });
    (ws._rows || []).forEach(row => sheet.addRow(row));
    const cols = ws['!cols'];
    if (Array.isArray(cols)) {
        cols.forEach((c, i) => {
            if (c && c.wch) sheet.getColumn(i + 1).width = c.wch;
        });
    }
    workbook.SheetNames.push(cleanName);
}

// exceljs يرتّب الأوراق فعلياً عبر worksheet.orderNo (رقم قابل للكتابة) لا عبر ترتيب
// مصفوفة .worksheets نفسها (وهي getter يبني مصفوفة جديدة كل مرة — إعادة ترتيبها
// مباشرة لا أثر لها). هذه تُطابق فعلياً نمط الاستخدام الوحيد في الكود:
// `workbook.SheetNames.unshift(workbook.SheetNames.pop())` — تحريك آخر ورقة مُضافة
// (الفهرس عادة) لأول القائمة.
function move_last_sheet_to_front(workbook) {
    if (!Array.isArray(workbook.SheetNames) || workbook.SheetNames.length < 2) return;
    workbook.SheetNames.unshift(workbook.SheetNames.pop());
    const sheets = workbook._wb.worksheets;
    const last = sheets[sheets.length - 1];
    const minOrder = Math.min(...sheets.map(s => s.orderNo));
    last.orderNo = minOrder - 1;
}

async function writeFile(workbook, filename) {
    const buffer = await workbook._wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    downloadBlob(blob, filename);
}

export const utils = { book_new, aoa_to_sheet, book_append_sheet, move_last_sheet_to_front };
export { writeFile };
