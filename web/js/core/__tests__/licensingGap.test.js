/**
 * findMissingCommonLicenses — يقارن جدول التراخيص الفعلي بقائمة generateLicenses
 * السعرية لنفس القطاع (نفس مصدر زر "اقتراح بنود" لهذا الجدول)، بمطابقة كلمات نفس
 * أسلوب findOfferingsWithoutCustomerValue.
 */
import { describe, it, expect } from 'vitest';
import { findMissingCommonLicenses } from '../licensingGap.js';

describe('findMissingCommonLicenses', () => {
    it('يرصد ترخيصاً شائعاً (سجل تجاري) غير مُدرَج بعد', () => {
        const state = { projectInfo: { sector: 'مطعم صغير' }, legal: { licenses: [] } };
        const missing = findMissingCommonLicenses(state);
        expect(missing.some(n => n.includes('سجل تجاري'))).toBe(true);
    });

    it('لا يرصد ترخيصاً مُدرَجاً فعلاً (تطابق كلمة واحدة كافٍ)', () => {
        const state = {
            projectInfo: { sector: 'مطعم صغير' },
            legal: { licenses: [{ name: 'سجل تجاري' }, { name: 'رخصة بلدية' }] }
        };
        const missing = findMissingCommonLicenses(state);
        expect(missing.some(n => n.includes('سجل تجاري'))).toBe(false);
    });

    it('يُرجع مصفوفة فارغة بلا رمي عند غياب البيانات كلياً', () => {
        expect(() => findMissingCommonLicenses({})).not.toThrow();
        expect(findMissingCommonLicenses({})).toEqual(expect.any(Array));
    });

    it('يرصد ترخيصاً قطاعياً خاصاً بالمطاعم (هيئة الغذاء والدواء) لمطعم بلا تراخيص', () => {
        const state = { projectInfo: { sector: 'مطعم وجبات سريعة' }, legal: { licenses: [] } };
        const missing = findMissingCommonLicenses(state);
        expect(missing.some(n => n.includes('الغذاء والدواء'))).toBe(true);
    });
});
