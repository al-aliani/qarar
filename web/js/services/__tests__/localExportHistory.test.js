/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { clearLocalExports, inferExportType, listLocalExports, recordLocalExport, summarizeQaForExport } from '../LocalExportHistory.js';

describe('LocalExportHistory', () => {
    beforeEach(() => {
        localStorage.clear();
        clearLocalExports();
    });

    it('يستنتج نوع الملف ويسجل آخر تنزيل محلي مع بيانات الجودة', () => {
        const qa = summarizeQaForExport({
            hardErrors: [{ message: 'missing revenue' }],
            softWarnings: [{ message: 'warning' }],
            validationErrors: [],
            validationWarnings: []
        });

        const item = recordLocalExport(
            { filename: 'study.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 1200 },
            { studyName: 'مقهى', qa }
        );

        expect(inferExportType('report.docx')).toBe('word');
        expect(item.fileType).toBe('excel');
        expect(item.qa.status).toBe('blocked');
        expect(item.qa.readiness).toBe(67);
        expect(listLocalExports()).toHaveLength(1);
        expect(listLocalExports()[0].studyName).toBe('مقهى');
    });
});
