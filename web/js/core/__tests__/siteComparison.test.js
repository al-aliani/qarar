import { describe, it, expect } from 'vitest';
import { compareSiteOptions } from '../siteComparison.js';

describe('compareSiteOptions — مقارنة مواقع تقريبية', () => {
    it('مرشّح بسوق أكبر بكثير (سكان×دخل) يتصدّر مرشّحاً أصغر بكثير لنفس القطاع', () => {
        const result = compareSiteOptions(
            [{ city: 'الرياض' }, { city: 'نجران' }],
            'fnb'
        );
        expect(result.candidates.length).toBe(2);
        expect(result.candidates[0].city).toBe('الرياض');
        expect(result.candidates[0].rank).toBe(1);
        expect(result.candidates[0].score).toBeGreaterThan(result.candidates[1].score);
    });

    it('يعكس عدد المنافسين المُمرَّر في competitorScore (أكثر منافسين = نتيجة أدنى)', () => {
        const result = compareSiteOptions(
            [{ city: 'الرياض' }, { city: 'جدة' }],
            'fnb',
            { 'الرياض': 30, 'جدة': 2 }
        );
        const riyadh = result.candidates.find(c => c.city === 'الرياض');
        const jeddah = result.candidates.find(c => c.city === 'جدة');
        expect(riyadh.competitorCount).toBe(30);
        expect(jeddah.competitorCount).toBe(2);
        expect(jeddah.competitorScore).toBeGreaterThan(riyadh.competitorScore);
    });

    it('بلا معامل منافسين: العامل محايد (competitorScore=100 للجميع) — لا بيانات لا تخمين', () => {
        const result = compareSiteOptions([{ city: 'الرياض' }, { city: 'نجران' }], 'fnb');
        result.candidates.forEach(c => {
            expect(c.competitorCount).toBeNull();
            expect(c.competitorScore).toBe(100);
        });
    });

    it('مصفوفة مرشحين فارغة لا ترمي وتعيد candidates: []', () => {
        const result = compareSiteOptions([], 'fnb');
        expect(result.candidates).toEqual([]);
    });

    it('sectorKey غير معروف أو مفقود يستخدم المعيار العام دون رمي خطأ', () => {
        expect(() => compareSiteOptions([{ city: 'الرياض' }, { city: 'جدة' }], 'قطاع-غير-موجود')).not.toThrow();
        expect(() => compareSiteOptions([{ city: 'الرياض' }, { city: 'جدة' }])).not.toThrow();
    });

    it('الترتيب (rank) تسلسلي 1..n مطابق للترتيب التنازلي للنتيجة', () => {
        const result = compareSiteOptions(
            [{ city: 'الرياض' }, { city: 'جدة' }, { city: 'نجران' }],
            'retail'
        );
        const ranks = result.candidates.map(c => c.rank);
        expect(ranks).toEqual([1, 2, 3]);
        for (let i = 1; i < result.candidates.length; i++) {
            expect(result.candidates[i - 1].score).toBeGreaterThanOrEqual(result.candidates[i].score);
        }
    });
});
