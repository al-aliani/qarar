/**
 * Shared export utilities: sanitization, XLSX loader, date/num helpers.
 * Used by excelExporter, sectionExporter, csvExporter, and other export modules.
 */


/**
 * @param {string} [name]
 * @returns {string} Excel-safe sheet name (max 31 chars, no \\ / * ? : [ ])
 */
export function sanitizeSheetName(name) {
    return String(name || 'Sheet')
        .replace(/[\\/*?:\[\]]/g, '')
        .substring(0, 31)
        .trim() || 'Sheet';
}

/** @returns {string} تاريخ ووقت التصدير بتنسيق ar-SA (متوسط + قصير) */
export function formatExportDateTime() {
    try {
        return new Date().toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
        const d = new Date();
        return d.toLocaleDateString('ar-SA') + ' ' + d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    }
}

/** @returns {string} تاريخ التصدير بصيغة YYYY-MM-DD (التاريخ المحلي) لاستخدامه في أسماء الملفات */
export function exportDateISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/**
 * @param {unknown} v
 * @returns {number} قيمة رقمية آمنة (0 عند NaN/undefined)
 */
export function safeNum(v) {
    return v != null && Number.isFinite(Number(v)) ? Number(v) : 0;
}

/**
 * @param {unknown} v
 * @returns {number} نسبة آمنة للنشر (0–100)
 */
export function safePct(v) {
    const n = v != null && Number.isFinite(Number(v)) ? Number(v) : 0;
    return (n > 1 ? n / 100 : n) * 100;
}

/** {@see safeNum} {@see safePct} */
export const SAFE = { num: safeNum, pct: safePct };

/**
 * @param {unknown} v
 * @returns {string} تنسيق DSCR: رقم خانتين أو "—" عند الغياب
 */
export function formatDscr(v) {
    return v != null && Number.isFinite(Number(v)) ? safeNum(v).toFixed(2) : '—';
}

/**
 * @param {string} [s]
 * @returns {string} Safe filename (no path chars, spaces → underscores, متتالية الشرطات → شرطة واحدة)
 */
export function sanitizeFilename(s) {
    return String(s || '')
        .replace(/[\\/*?:"<>|\s]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .trim() || 'export';
}

/**
 * تنزيل Blob كملف (إلحاق <a>، نقر، إزالة، إبطال الرابط بعد 200ms).
 * @param {Blob} blob - المحتوى المراد تنزيله
 * @param {string} filename - اسم الملف المُقترح
 */
export function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 200);
}

let _xlsxLoadPromise = null;

/**
 * تأكيد جاهزية SheetJS (XLSX) على window.XLSX — عبر استيراد ديناميكي (npm package مُجمَّع)
 * لا عبر CDN، ولا يُحمَّل إلا عند أول استدعاء فعلي للتصدير (lazy) حتى لا يُثقِل الحزمة الأساسية.
 * الاسم القديم أُبقي عليه للتوافق مع كل استدعاءات excelExporter.js/sectionExporter.js
 * التي تستخدم المتغيّر العام `XLSX` مباشرة.
 * @returns {Promise<void>}
 */
export function loadXLSX() {
    if (typeof globalThis.XLSX !== 'undefined') return Promise.resolve();
    if (_xlsxLoadPromise) return _xlsxLoadPromise;
    _xlsxLoadPromise = import('xlsx')
        .then(({ utils, writeFile }) => { window.XLSX = { utils, writeFile }; })
        .catch((e) => {
            _xlsxLoadPromise = null; // اسمح بإعادة المحاولة عند فشل التحميل
            throw new Error('تعذّر تحميل مكتبة Excel (XLSX): ' + (e?.message || e));
        });
    return _xlsxLoadPromise;
}
