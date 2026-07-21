/**
 * Export module barrel.
 * Re-exports shared utils and main exporters for simpler imports.
 */

export { sanitizeSheetName, sanitizeFilename, loadXLSX, formatExportDateTime, getExportMetadata, exportDateISO, safeNum, safePct, SAFE, formatDscr, downloadBlob } from './utils.js';
export { ExcelExporter, exportToExcel } from './excelExporter.js';
export { exportToCSV } from './csvExporter.js';
export { exportExcel } from './excel.js';
export { PDFGenerator } from './pdfGenerator.js';
// ⛔ exportPDF (pdf.js) أُزيل من الواجهة العامة (تدقيق 2026-07-04):
// مُصدِّر قديم لقالب «مطاعم السعودية» يطبع عنواناً مثبتاً وJSON خاماً داخل التقرير —
// لا يستدعيه أي مسار حي؛ إعادة تصديره هنا كانت تسمح باستخدامه خطأً.
export { adaptRunFullModelForExcel } from './adaptRunFullModelForExcel.js';
