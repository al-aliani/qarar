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
