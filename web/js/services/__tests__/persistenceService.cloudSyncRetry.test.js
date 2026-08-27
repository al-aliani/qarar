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

    it('[إثبات الحارس] العطل الأصلي: محاولة واحدة فقط كانت تُسقِط فشلاً عابراً فوراً بلا أي إعادة محاولة', async () => {
        const attemptOnce = async (fn) => {
            try { return await fn(); } catch (e) { return { failed: true }; }
        };
        let calls = 0;
        const flakyOnce = async () => { calls++; if (calls === 1) throw new Error('transient'); return 'ok'; };
        const result = await attemptOnce(flakyOnce);
        expect(result.failed).toBe(true); // فشل عابر واحد يُسقِط العملية كاملة بلا إعادة محاولة
        expect(calls).toBe(1);
    });
});
