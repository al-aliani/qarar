/**
 * CSV Exporter — ملخص دراسة الجدوى بصيغة CSV
 * لا يعتمد على XLSX؛ مناسب للاستيراد في Excel أو جداول أخرى.
 */

import { sanitizeFilename, exportDateISO, formatExportDateTime, SAFE, formatDscr, downloadBlob } from './utils.js';

function escapeCsvCell(val) {
    const s = String(val ?? '');
    if (/[",\n\r\t]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

function toCSV(rows) {
    return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
}

/**
 * تصدير ملخص الدراسة كـ CSV
 * @param {object} studyData
 * @param {object} financialResults
 * @param {string} [filename]
 * @returns {string} اسم الملف المُصدَّر
 */
export function exportToCSV(studyData, financialResults, filename = 'feasibility_study') {
    const ind = financialResults?.indicators || {};
    const cap = financialResults?.capex || {};
    const op = financialResults?.opex || {};
    const proj = financialResults?.revenueProjection?.[0] || financialResults?.incomeStatement?.[0];
    const exportedAt = formatExportDateTime();

    const rows = [
        ['ملخص دراسة الجدوى', ''],
        ['', ''],
        ['اسم المشروع', studyData?.projectInfo?.name || 'غير محدد'],
        ['المدينة', studyData?.projectInfo?.city || 'غير محدد'],
        ['تاريخ الدراسة', new Date().toLocaleDateString('ar-SA')],
        ['تاريخ ووقت التصدير', exportedAt],
        ['', ''],
        ['المؤشرات المالية الرئيسية', ''],
        ['إجمالي الاستثمار', SAFE.num(cap.total)],
        ['التكاليف التشغيلية السنوية', SAFE.num(op.totalAnnual)],
        ['الإيرادات السنة الأولى', SAFE.num(proj?.total ?? proj?.revenue)],
        ['صافي القيمة الحالية', SAFE.num(ind.npv)],
        ['معدل العائد الداخلي', SAFE.pctText(ind.irr)],
        ['فترة الاسترداد', SAFE.payback(ind.paybackPeriod ?? ind.payback)],
        ['نسبة DSCR', formatDscr(ind.dscr)],
        ['', ''],
        ['القرار', financialResults?.decision || 'غير محدد'],
        ['', ''],
        ['ملاحظة', 'جميع المبالغ بالريال السعودي (SAR) إلا إن ذُكر غير ذلك.'],
        ['', ''],
        ['مُنشأ بواسطة', 'محاكي الجدوى | دراسة الجدوى الذكية'],
    ];

    const csv = '\uFEFF' + toCSV(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const outFilename = `${sanitizeFilename(studyData?.projectInfo?.name || filename)}_summary_${exportDateISO()}.csv`;
    downloadBlob(blob, outFilename);
    return outFilename;
}
