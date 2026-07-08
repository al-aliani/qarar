import { describe, it, expect } from 'vitest';
import { selectExcelExportPath } from '../utils.js';

describe('selectExcelExportPath', () => {
    it('لا يتجاوز السعة: 5 سنوات و3 منتجات (حدود القالب المعياري بالضبط)', () => {
        const results = { incomeStatement: [1, 2, 3, 4, 5] };
        const state = { revenue: { streams: [{}, {}, {}] } };
        const r = selectExcelExportPath(results, state);
        expect(r.exceedsTemplateCapacity).toBe(false);
        expect(r.yearsCount).toBe(5);
        expect(r.streamsCount).toBe(3);
    });

    it('يتجاوز السعة عند 7 سنوات و3 منتجات', () => {
        const results = { incomeStatement: [1, 2, 3, 4, 5, 6, 7] };
        const state = { revenue: { streams: [{}, {}, {}] } };
        const r = selectExcelExportPath(results, state);
        expect(r.exceedsTemplateCapacity).toBe(true);
        expect(r.yearsCount).toBe(7);
        expect(r.streamsCount).toBe(3);
    });

    it('يتجاوز السعة عند 5 سنوات و4 منتجات', () => {
        const results = { incomeStatement: [1, 2, 3, 4, 5] };
        const state = { revenue: { streams: [{}, {}, {}, {}] } };
        const r = selectExcelExportPath(results, state);
        expect(r.exceedsTemplateCapacity).toBe(true);
        expect(r.yearsCount).toBe(5);
        expect(r.streamsCount).toBe(4);
    });

    it('لا يرمي خطأ عند غياب state.revenue تماماً، ويُعامَل كصفر منتجات', () => {
        const results = { incomeStatement: [1, 2, 3, 4, 5] };
        const state = {};
        const r = selectExcelExportPath(results, state);
        expect(() => selectExcelExportPath(results, state)).not.toThrow();
        expect(r.exceedsTemplateCapacity).toBe(false);
        expect(r.streamsCount).toBe(0);
    });

    it('لا يرمي خطأ عند results فارغة/غير معرّفة، وسنوات = صفر', () => {
        expect(() => selectExcelExportPath(null, undefined)).not.toThrow();
        expect(() => selectExcelExportPath(undefined, undefined)).not.toThrow();
        const r = selectExcelExportPath(null, undefined);
        expect(r.yearsCount).toBe(0);
        expect(r.exceedsTemplateCapacity).toBe(false);
    });
});
