import { store } from '../core/store.js';

const STORAGE_KEY = 'feasibility_local_export_history_v1';
const MAX_ITEMS = 50;

function readItems() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = JSON.parse(raw || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function writeItems(items) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
    } catch {
        // سجل محلي اختياري؛ لا نكسر التصدير إن امتلأ التخزين.
    }
}

export function inferExportType(filename = '', mimeType = '') {
    const name = String(filename).toLowerCase();
    const mime = String(mimeType).toLowerCase();
    if (name.endsWith('.docx') || mime.includes('word')) return 'word';
    if (name.endsWith('.xlsx') || name.endsWith('.xls') || mime.includes('spreadsheet')) return 'excel';
    if (name.endsWith('.pptx') || mime.includes('presentation')) return 'pptx';
    if (name.endsWith('.csv') || mime.includes('csv')) return 'csv';
    if (name.endsWith('.json') || mime.includes('json')) return 'json';
    if (name.endsWith('.html') || mime.includes('html')) return 'html';
    if (name.endsWith('.pdf') || mime.includes('pdf')) return 'pdf';
    return 'file';
}

export function summarizeQaForExport(qa = {}) {
    const hardCount = (qa.hardErrors || []).length + (qa.validationErrors || []).length;
    const warningCount = (qa.softWarnings || []).length + (qa.validationWarnings || []).length;
    const readiness = Math.max(0, Math.min(100, 100 - Math.min(70, hardCount * 25) - Math.min(45, warningCount * 8)));
    return {
        hardCount,
        warningCount,
        readiness,
        status: hardCount > 0 ? 'blocked' : (warningCount > 0 ? 'warning' : 'ready')
    };
}

export function recordLocalExport(download = {}, context = {}) {
    if (!download?.filename) return null;
    const item = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        filename: download.filename,
        fileType: download.fileType || inferExportType(download.filename, download.mimeType),
        mimeType: download.mimeType || '',
        size: Number(download.size || 0),
        studyId: context.studyId || null,
        studyName: context.studyName || 'دراسة',
        createdAt: new Date().toISOString(),
        qa: context.qa || null,
    };
    const next = [item, ...readItems()].slice(0, MAX_ITEMS);
    writeItems(next);
    return item;
}

export function listLocalExports() {
    return readItems();
}

export function clearLocalExports() {
    writeItems([]);
}

// تدقيق 2026-08-21: كان recordLocalExport() يُستدعى يدوياً من فرع واحد فقط داخل
// ExportMenu.js (تصدير الصيغ عبر Worker) — أي صيغة أخرى (json/csv/pitch/bank/...)
// لا تُسجَّل بالسجل المحلي رغم نزولها فعلياً عبر downloadBlob() (export/utils.js)،
// وهي نقطة الالتقاء الحقيقية الوحيدة لكل صيغ التصدير. الاستماع هنا لحدث
// feasibility:download الذي تُصدره downloadBlob() لكل تنزيل يضمن تسجيل كل الصيغ
// دون ربط كل موقع استدعاء يدوياً؛ الوحدة تُستورَد مرة واحدة فقط (ES module singleton)
// فلا خطر تكرار المستمع عبر فتحات قائمة التصدير المتعددة.
if (typeof window !== 'undefined') {
    window.addEventListener('feasibility:download', (e) => {
        const detail = e?.detail;
        if (!detail?.filename) return;
        const projectInfo = store.getState()?.projectInfo || {};
        recordLocalExport(detail, { studyId: projectInfo.id || null, studyName: projectInfo.name || null });
    });
}
