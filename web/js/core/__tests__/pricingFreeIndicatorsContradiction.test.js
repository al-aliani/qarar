/**
 * تناقض مؤكد من قائمة مراجعة 2026-08-27 (fable backlog، مجموعة
 * pricing-content-consistency): pricing.html يعرض بطاقة الباقة المجانية
 * تقول إنها تتضمن "لوحة المؤشرات الأساسية" (PRICING_PACKAGES.free.features)،
 * ثم يعرض في نفس الصفحة (جدول المقارنة، عمود "يفتح عند الترقية") نصاً يقول
 * إن "المؤشرات" نفسها لا تُفتح إلا بالترقية (PRICING_COMPARISON.free.unlock
 * القديم: "المؤشرات والتصدير الاحترافي ومراجعة الخبير") — تناقض ظاهر لزائر
 * واحد يقرأ الصفحة من أعلى لأسفل.
 *
 * الواقع الفعلي (تحقق عبر PaywallModal/ExportMenu/ShareStudyView): التصدير
 * الاحترافي والمشاركة ومراجعة الخبير هي المحجوبة فعلياً خلف الدفع — عرض
 * المؤشرات الأساسية على الشاشة مجاني دائماً. الإصلاح: تمييز "تفسير
 * المؤشرات" (بوابة الجودة، مطابق self.features) عن مجرد عرضها، لا حذف
 * الكلمة كلياً ولا تركها بصيغة تناقض بطاقة الباقة المجانية.
 */
import { describe, it, expect } from 'vitest';
import { PRICING_PACKAGES, PRICING_COMPARISON } from '../pricing.js';

describe('تناقض: عرض المؤشرات مجاني، لكن نص الترقية كان يدّعي أنه محجوب', () => {
    it('بطاقة الباقة المجانية تَعِد بلوحة مؤشرات أساسية', () => {
        const free = PRICING_PACKAGES.find((p) => p.id === 'free');
        expect(free.features.some((f) => f.includes('المؤشرات'))).toBe(true);
    });

    it('نص "يفتح عند الترقية" للمجانية لا يدّعي أن المؤشرات نفسها محجوبة (فقط تفسيرها المتقدم)', () => {
        const unlock = PRICING_COMPARISON.free.unlock;
        expect(unlock).not.toBe('المؤشرات والتصدير الاحترافي ومراجعة الخبير');
        // يجب أن يذكر تفسير المؤشرات (بوابة الجودة) لا "المؤشرات" وحدها كأنها محجوبة بالكامل
        expect(unlock).toMatch(/تفسير المؤشرات/);
        expect(unlock).toContain('التصدير الاحترافي');
        expect(unlock).toContain('مراجعة الخبير');
    });

    it('[إثبات الحارس] إعادة الصياغة القديمة يدوياً تُفشِل فحص التناقض', () => {
        const reverted = { ...PRICING_COMPARISON.free, unlock: 'المؤشرات والتصدير الاحترافي ومراجعة الخبير' };
        expect(reverted.unlock).toBe('المؤشرات والتصدير الاحترافي ومراجعة الخبير');
        expect(reverted.unlock).not.toMatch(/تفسير المؤشرات/);
    });
});
