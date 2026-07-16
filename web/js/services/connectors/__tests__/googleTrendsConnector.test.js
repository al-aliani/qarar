/**
 * Unit tests لـ GoogleTrendsConnector — نمط "unavailable دائماً" (لا مزوّد مُهيَّأ
 * بعد): يكفي التحقق من التسجيل الصحيح وثبات نص التعذّر، بلا محاكاة شبكة.
 */
import { describe, it, expect } from 'vitest';

import { PROVENANCE, isUsable, suggest } from '../../DataConnectors.js';
import googleTrendsConnector from '../GoogleTrendsConnector.js';

describe('GoogleTrendsConnector', () => {
    it('يعيد unavailable دائماً بنص واضح يشرح سبب التعذّر', async () => {
        const d = await googleTrendsConnector();
        expect(d.provenance).toBe(PROVENANCE.UNAVAILABLE);
        expect(d.value).toBeNull();
        expect(d.note).toBe('يحتاج مزوّد بيانات اتجاهات البحث (مثل SerpApi) لم يُهيَّأ بعد');
        expect(isUsable(d)).toBe(false);
    });

    it('لا يتأثر بالسياق المُمرَّر — نفس النتيجة دوماً', async () => {
        const d = await googleTrendsConnector({ city: 'الرياض', sector: 'مطاعم' });
        expect(d.provenance).toBe(PROVENANCE.UNAVAILABLE);
    });

    it("موصّل 'market.demandTrend' مسجّل في السجل الموحّد (suggest يعمل لا 'لا يوجد موصّل')", async () => {
        const d = await suggest('market.demandTrend', { city: 'الرياض' });
        expect(d.provenance).toBe(PROVENANCE.UNAVAILABLE);
        expect(d.note).not.toMatch(/لا يوجد موصّل/);
    });
});
