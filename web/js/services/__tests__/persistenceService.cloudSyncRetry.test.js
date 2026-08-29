/**
 * @vitest-environment jsdom
 *
 * دفعة 5 من خطة إغلاق فجوات الطبقات الـ16 (2026-08-27، طبقة Availability):
 * محاولة واحدة فاشلة للمزامنة السحابية (مهلة شبكة قصيرة، 503 مؤقت من
 * Supabase) كانت تُسقِط المزامنة فوراً بلا أي إعادة محاولة — نمط فشل شائع
 * (transient) لا يستدعي عادة تدخلاً يدوياً. الآن 3 محاولات بتأخير تصاعدي
 * قبل الاستسلام فعلياً.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../supabaseClient.js', () => ({
    getSupabaseClient: vi.fn(async () => ({ ok: true, supabase: {} })),
    getAuthUser: vi.fn(async () => ({ user: { id: 'u1' } })),
}));

import { PersistenceService } from '../PersistenceService.js';

describe('PersistenceService.save — إعادة محاولة المزامنة السحابية عند فشل عابر', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('فشل المحاولتين الأولى والثانية ثم نجاح الثالثة ⇒ يُبلَّغ نجاحاً كاملاً (location: both)، لا cloudSyncFailed', async () => {
        const saveCloudSpy = vi.spyOn(PersistenceService, '_saveCloud')
            .mockRejectedValueOnce(new Error('network timeout'))
            .mockRejectedValueOnce(new Error('503 temporary'))
            .mockResolvedValueOnce(undefined);

        const result = await PersistenceService.save('study-1', { projectInfo: { id: 'study-1' } });

        expect(saveCloudSpy).toHaveBeenCalledTimes(3);
        expect(result.location).toBe('both');
        expect(result.cloudSyncFailed).toBeUndefined();
    }, 10000);

    it('فشل المحاولات الثلاث جميعها ⇒ يستسلم فعلياً بعد المحاولة الثالثة لا الأولى، ويُبلَّغ cloudSyncFailed', async () => {
        const saveCloudSpy = vi.spyOn(PersistenceService, '_saveCloud').mockRejectedValue(new Error('persistent network down'));

        const result = await PersistenceService.save('study-2', { projectInfo: { id: 'study-2' } });

        expect(saveCloudSpy).toHaveBeenCalledTimes(3);
        expect(result.location).toBe('local');
        expect(result.cloudSyncFailed).toBe(true);
    }, 10000);

    it('[إثبات الحارس] العطل الأصلي: save() كان يستدعي _saveCloud مباشرة بلا غلاف إعادة محاولة', async () => {
        const saveCloudWithRetrySpy = vi.spyOn(PersistenceService, '_saveCloudWithRetry');
        vi.spyOn(PersistenceService, '_saveCloud').mockResolvedValue(undefined);

        await PersistenceService.save('study-3', { projectInfo: { id: 'study-3' } });

        // العطل الأصلي: save() كان يستدعي this._saveCloud(...) مباشرة (بلا غلاف
        // إعادة المحاولة) — فلا معنى لوجود CLOUD_SYNC_RETRY_DELAYS_MS إن لم يمرّ
        // المسار الحقيقي عبر _saveCloudWithRetry. لو أُعيد استدعاء _saveCloud
        // مباشرة كما كانت الحال، هذا الجاسوس على الدالة الحقيقية لن يُستدعى إطلاقاً.
        expect(saveCloudWithRetrySpy).toHaveBeenCalledTimes(1);
    });
});
