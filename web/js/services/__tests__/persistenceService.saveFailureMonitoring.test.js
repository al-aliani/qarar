/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-21 (بلوكر #43): فشل مزامنة سحابية بـPersistenceService.save كان
 * يُسجَّل بconsole.error فقط — لا يصل لأي مراقبة (Sentry أو حتى تسجيل تحليلات)،
 * فيختفي صامتاً حتى لو Sentry مضبوط فعلياً بالإنتاج. الإصلاح: استدعاء
 * monitoring.captureException عند فشل المزامنة.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const captureExceptionMock = vi.fn();
vi.mock('../../utils/monitoring.js', () => ({
    monitoring: { captureException: captureExceptionMock },
}));

vi.mock('../../../supabaseClient.js', () => ({
    getSupabaseClient: vi.fn(async () => ({ ok: true, supabase: {} })),
    getAuthUser: vi.fn(async () => ({ user: { id: 'u1' } })),
}));

import { PersistenceService } from '../PersistenceService.js';

describe('PersistenceService.save — فشل المزامنة السحابية يُبلَّغ للمراقبة (بلوكر #43)', () => {
    beforeEach(() => {
        localStorage.clear();
        captureExceptionMock.mockClear();
    });

    it('فشل _saveCloud ⇒ يستدعي monitoring.captureException بسياق واضح، ويظل الحفظ المحلي ناجحاً', async () => {
        vi.spyOn(PersistenceService, '_saveCloud').mockRejectedValue(new Error('network down'));

        const result = await PersistenceService.save('study-1', { projectInfo: { id: 'study-1' } });

        expect(result.success).toBe(true);
        expect(result.cloudSyncFailed).toBe(true);
        expect(captureExceptionMock).toHaveBeenCalledTimes(1);
        const [err, context] = captureExceptionMock.mock.calls[0];
        expect(err.message).toBe('network down');
        expect(context).toMatchObject({ source: 'PersistenceService.save', studyId: 'study-1' });
    });

    it('نجاح المزامنة السحابية ⇒ لا يستدعي captureException إطلاقاً', async () => {
        vi.spyOn(PersistenceService, '_saveCloud').mockResolvedValue(undefined);

        await PersistenceService.save('study-2', { projectInfo: { id: 'study-2' } });

        expect(captureExceptionMock).not.toHaveBeenCalled();
    });
});
