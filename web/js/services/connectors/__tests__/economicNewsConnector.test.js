/**
 * Unit tests لـ EconomicNewsConnector — نمط "unavailable دائماً" (لا مزوّد مُهيَّأ
 * بعد): يكفي التحقق من التسجيل الصحيح وثبات نص التعذّر، بلا محاكاة شبكة.
 */
import { describe, it, expect } from 'vitest';

import { PROVENANCE, isUsable, suggest } from '../../DataConnectors.js';
import economicNewsConnector from '../EconomicNewsConnector.js';

describe('EconomicNewsConnector', () => {
    it('يعيد unavailable دائماً بنص واضح يشرح سبب التعذّر', async () => {
        const d = await economicNewsConnector();
        expect(d.provenance).toBe(PROVENANCE.UNAVAILABLE);
        expect(d.value).toBeNull();
        expect(d.note).toBe('يحتاج مزوّد أخبار اقتصادية (مثل NewsAPI) لم يُهيَّأ بعد');
        expect(isUsable(d)).toBe(false);
    });

    it('لا يتأثر بالسياق المُمرَّر — نفس النتيجة دوماً', async () => {
        const d = await economicNewsConnector({ sector: 'تجزئة' });
        expect(d.provenance).toBe(PROVENANCE.UNAVAILABLE);
    });

    it("موصّل 'market.economicNews' مسجّل في السجل الموحّد (suggest يعمل لا 'لا يوجد موصّل')", async () => {
        const d = await suggest('market.economicNews', {});
        expect(d.provenance).toBe(PROVENANCE.UNAVAILABLE);
        expect(d.note).not.toMatch(/لا يوجد موصّل/);
    });
});
