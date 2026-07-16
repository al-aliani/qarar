/**
 * Unit tests لـ SocialGrowthConnector — نمط "unavailable دائماً" (لا تسجيل تطبيق
 * على منصة تواصل اجتماعي بعد): يكفي التحقق من التسجيل الصحيح وثبات نص التعذّر،
 * بلا محاكاة شبكة.
 */
import { describe, it, expect } from 'vitest';

import { PROVENANCE, isUsable, suggest } from '../../DataConnectors.js';
import socialGrowthConnector from '../SocialGrowthConnector.js';

describe('SocialGrowthConnector', () => {
    it('يعيد unavailable دائماً بنص واضح يشرح سبب التعذّر', async () => {
        const d = await socialGrowthConnector();
        expect(d.provenance).toBe(PROVENANCE.UNAVAILABLE);
        expect(d.value).toBeNull();
        expect(d.note).toBe('يحتاج تسجيل تطبيق على منصة تواصل اجتماعي (Instagram/X Graph API) لم يتم بعد');
        expect(isUsable(d)).toBe(false);
    });

    it('لا يتأثر بالسياق المُمرَّر — نفس النتيجة دوماً', async () => {
        const d = await socialGrowthConnector({ handle: '@example' });
        expect(d.provenance).toBe(PROVENANCE.UNAVAILABLE);
    });

    it("موصّل 'market.socialGrowth' مسجّل في السجل الموحّد (suggest يعمل لا 'لا يوجد موصّل')", async () => {
        const d = await suggest('market.socialGrowth', {});
        expect(d.provenance).toBe(PROVENANCE.UNAVAILABLE);
        expect(d.note).not.toMatch(/لا يوجد موصّل/);
    });
});
