/**
 * @vitest-environment jsdom
 *
 * دفعة 6 (2026-08-27، اتساق المراقبة): save() يستدعي monitoring.captureException
 * عند فشل المزامنة السحابية (بلوكر #43)، لكن load() وlistHeaders() — نفس فئة
 * الفشل (خطأ شبكة/RLS أثناء تعامل مع Supabase) — كانا يُسجَّلان بconsole.warn
 * فقط، فيختفيان صامتاً حتى لو Sentry مضبوط فعلياً بالإنتاج.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVICE_PATH = resolve(__dirname, '../PersistenceService.js');

const captureExceptionMock = vi.fn();
vi.mock('../../utils/monitoring.js', () => ({
    monitoring: { captureException: captureExceptionMock },
}));

vi.mock('../../../supabaseClient.js', () => ({
    getSupabaseClient: vi.fn(async () => ({ ok: true, supabase: {} })),
    getAuthUser: vi.fn(async () => ({ user: { id: 'u1' } })),
}));

import { PersistenceService } from '../PersistenceService.js';

describe('PersistenceService.load/listHeaders — فشل السحابة يُبلَّغ للمراقبة (اتساق مع save())', () => {
    beforeEach(() => {
        localStorage.clear();
        captureExceptionMock.mockClear();
    });

    it('load(): فشل _loadCloudWithMeta ⇒ يستدعي captureException بسياق واضح، ويظل التراجع للمحلي يعمل', async () => {
        localStorage.setItem('feas_project_study-1', JSON.stringify({ projectInfo: { id: 'study-1' } }));
        vi.spyOn(PersistenceService, '_loadCloudWithMeta').mockRejectedValue(new Error('network down'));

        const result = await PersistenceService.load('study-1');

        expect(result.source).toBe('local');
        expect(captureExceptionMock).toHaveBeenCalledTimes(1);
        const [err, context] = captureExceptionMock.mock.calls[0];
        expect(err.message).toBe('network down');
        expect(context).toMatchObject({ source: 'PersistenceService.load', studyId: 'study-1' });
    });

    it('load(): نجاح التحميل السحابي ⇒ لا يستدعي captureException إطلاقاً', async () => {
        vi.spyOn(PersistenceService, '_loadCloudWithMeta').mockResolvedValue({ data: { projectInfo: { id: 'study-2' } }, updatedAt: new Date().toISOString() });

        await PersistenceService.load('study-2');

        expect(captureExceptionMock).not.toHaveBeenCalled();
    });

    it('listHeaders(): فشل _listCloudHeaders مع وجود محلي ⇒ يستدعي captureException، ويظل التراجع للمحلي يعمل', async () => {
        localStorage.setItem('feas_project_index', JSON.stringify([
            { id: 'local-1', name: 'مصنع تعبئة', lastModified: '2026-08-20T00:00:00.000Z' }
        ]));
        vi.spyOn(PersistenceService, '_listCloudHeaders').mockRejectedValue(new Error('Failed to fetch'));

        const headers = await PersistenceService.listHeaders();

        expect(headers.map(h => h.id)).toEqual(['local-1']);
        expect(captureExceptionMock).toHaveBeenCalledTimes(1);
        const [err, context] = captureExceptionMock.mock.calls[0];
        expect(err.message).toBe('Failed to fetch');
        expect(context).toMatchObject({ source: 'PersistenceService.listHeaders' });
    });

    it('listHeaders(): فشل _listCloudHeaders بلا أي دراسة محلية ⇒ يستدعي captureException أيضاً رغم رفض الوعد لاحقاً', async () => {
        vi.spyOn(PersistenceService, '_listCloudHeaders').mockRejectedValue(new Error('RLS recursion'));

        await expect(PersistenceService.listHeaders()).rejects.toThrow(/تعذّر الوصول إلى دراساتك السحابية/);
        expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    });

    it('listHeaders(): نجاح الجلب السحابي ⇒ لا يستدعي captureException إطلاقاً', async () => {
        vi.spyOn(PersistenceService, '_listCloudHeaders').mockResolvedValue([]);

        await PersistenceService.listHeaders();

        expect(captureExceptionMock).not.toHaveBeenCalled();
    });

    it('[إثبات الحارس] العطل الأصلي: كتلتا catch الحقيقيتان في load()/listHeaders() كانتا تكتفيان بـconsole.warn قبل هذا الإصلاح', () => {
        // العطل الأصلي (قبل دفعة 6): معالجة الفشل كانت تنتهي عند console.warn فقط.
        // الإصلاح الحقيقي *أضاف* استدعاء captureException بجانب console.warn
        // القائم أصلاً (لم يستبدله) — تحقّق من نص الملف الحقيقي نفسه لا نسخة
        // مصطنعة معزولة؛ لو حُذف أحد استدعائي captureException من الكود الفعلي
        // لفشل هذا التوقع.
        const src = readFileSync(SERVICE_PATH, 'utf8');
        expect(src).toMatch(/console\.warn\("Cloud load failed, falling back to local:", e\)/);
        expect(src).toMatch(/console\.warn\("Cloud list failed:", e\)/);
        expect(src).toMatch(/monitoring\.captureException\(e,\s*\{\s*source:\s*'PersistenceService\.load'/);
        expect(src).toMatch(/monitoring\.captureException\(e,\s*\{\s*source:\s*'PersistenceService\.listHeaders'/);
    });
});
