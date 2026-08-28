/**
 * @vitest-environment jsdom
 *
 * قرار لجنة 2026-08-27 (خبير ثقة عملاء + مهندس + مدير منتج): إعادة حساب دراسة
 * قديمة بمعادلات محرك مُحدَّثة تحدث صامتاً بلا أي أثر يقارَن لاحقاً. الإصلاح
 * الجزئي المتفَق عليه: بصمة إصدار (ENGINE_VERSION من engine.js) تُخزَّن في
 * _meta.engineVersion وقت كل حفظ، محلياً *وسحابياً معاً*.
 *
 * فخّ حقيقي اكتُشف أثناء البناء: _meta.updatedAt يُرفَع للمحلي فقط عمداً (عمود
 * updated_at المستقل هو مصدر الحقيقة للسحابة) — لو طُبِّق نفس المنطق حرفياً على
 * engineVersion لاختفت البصمة كلياً للمستخدمين المسجَّلين (تحميلهم من السحابة
 * أولاً حسب PersistenceService.load)، رغم نجاحها للمحلي فقط. هذا الاختبار يثبّت
 * الحالتين معاً — لا يكفي التحقق من المحلي وحده.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ENGINE_VERSION } from '../../core/engine.js';

vi.mock('../../../supabaseClient.js', () => ({
    getSupabaseClient: vi.fn(async () => ({ ok: true, supabase: {} })),
    getAuthUser: vi.fn(async () => ({ user: { id: 'u1' } })),
}));

import { PersistenceService } from '../PersistenceService.js';

describe('PersistenceService.save — بصمة إصدار المحرك تصل محلياً وسحابياً معاً', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('يُدرِج _meta.engineVersion الحالي في الحفظ المحلي', async () => {
        vi.spyOn(PersistenceService, '_saveCloud').mockResolvedValue(undefined);
        const saveLocalSpy = vi.spyOn(PersistenceService, '_saveLocal');

        await PersistenceService.save('study-1', { projectInfo: { id: 'study-1' } });

        const [, localPayload] = saveLocalSpy.mock.calls[0];
        expect(localPayload._meta.engineVersion).toBe(ENGINE_VERSION);
    });

    it('[إثبات الحارس] يُدرِج نفس البصمة في الحفظ السحابي أيضاً — لا يكفي المحلي وحده', async () => {
        const saveCloudSpy = vi.spyOn(PersistenceService, '_saveCloud').mockResolvedValue(undefined);

        await PersistenceService.save('study-2', { projectInfo: { id: 'study-2' } });

        expect(saveCloudSpy).toHaveBeenCalledTimes(1);
        const [, cloudPayload] = saveCloudSpy.mock.calls[0];
        expect(cloudPayload._meta?.engineVersion).toBe(ENGINE_VERSION);
    });

    it('لا يكسر الحفظ إن تعذّر استيراد engine.js لأي سبب (تجريبي: نفس مسار try/catch القائم)', async () => {
        vi.spyOn(PersistenceService, '_saveCloud').mockResolvedValue(undefined);
        const result = await PersistenceService.save('study-3', { projectInfo: { id: 'study-3' } });
        expect(result.success).toBe(true);
    });
});
