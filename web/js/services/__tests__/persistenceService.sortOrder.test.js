/**
 * @vitest-environment jsdom
 *
 * تدقيق مجلس الحرب 2026-07-10: listHeaders() كانت تدمج العناوين المحلية والسحابية في
 * Map بلا أي ترتيب نهائي — فـ"الأحدث" (projects[0] في لوحة التحكم وشريط الجودة) لم يكن
 * مضموناً أن يكون فعلاً الأحدث تعديلاً. لا اختبار كان يغطي هذا قبل هذا الملف.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../supabaseClient.js', () => ({
    getAuthUser: vi.fn(async () => ({ user: null })),
    getSupabaseClient: vi.fn(async () => ({ supabase: null }))
}));

describe('PersistenceService.listHeaders — ترتيب زمني مضمون', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
    });

    it('يُرتِّب العناوين المحلية تنازلياً حسب lastModified بغض النظر عن ترتيب الحفظ', async () => {
        const index = [
            { id: 'old', name: 'الأقدم', lastModified: '2026-01-01T00:00:00.000Z' },
            { id: 'newest', name: 'الأحدث', lastModified: '2026-07-09T00:00:00.000Z' },
            { id: 'mid', name: 'وسط', lastModified: '2026-04-01T00:00:00.000Z' },
        ];
        localStorage.setItem('feas_project_index', JSON.stringify(index));

        const { PersistenceService } = await import('../PersistenceService.js');
        const headers = await PersistenceService.listHeaders();

        expect(headers.map(h => h.id)).toEqual(['newest', 'mid', 'old']);
    });
});
