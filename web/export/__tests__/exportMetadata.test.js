import { describe, expect, it } from 'vitest';
import { getExportMetadata } from '../utils.js';

describe('export metadata', () => {
    it('يوحّد اسم الدراسة والإصدار والتواريخ بين الصيغ', () => {
        const meta = getExportMetadata({
            id: 'study-1',
            version: '4.2.0',
            createdAt: '2026-01-02T00:00:00.000Z',
            updatedAt: '2026-01-03T00:00:00.000Z',
            projectInfo: { name: 'مقهى الاختبار' },
        }, new Date('2026-01-04T12:00:00.000Z'));

        expect(meta).toMatchObject({
            projectName: 'مقهى الاختبار',
            studyId: 'study-1',
            studyVersion: '4.2.0',
            exportVersion: '1.0',
        });
        expect(meta.createdAt).not.toBe('غير محدد');
        expect(meta.updatedAt).not.toBe('غير محدد');
        expect(meta.exportedAt).not.toBe('');
    });
});
