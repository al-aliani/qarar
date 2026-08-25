/**
 * @vitest-environment jsdom
 *
 * فشل جلب قائمة الدراسات السحابية كان يُبتلع بـconsole.warn وتُرجَع قائمة محلية
 * فارغة (مسح ليلة 2026-08-26). عميل دفع 4999 ريال وعنده 5 دراسات في السحابة يفتح
 * لوحة التحكم من جهاز مكتب جديد خلف بروكسي يقطع الطلب ⟶ لوحة التحكم ترسم
 * «ابدأ أول دراسة جدوى لمشروعك / لا توجد دراسات محفوظة بعد» وتفتح ترحيب المستخدم
 * الجديد: يُبلَّغ صراحةً أن دراساته المدفوعة غير موجودة.
 *
 * الثابت المُختبَر: قائمة فارغة من listHeaders تعني فراغاً حقيقياً — لا فشل قراءة.
 * (لوحة التحكم تلتقط الرفض في try/catch القائم وترسم «حدث خطأ + إعادة المحاولة».)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../supabaseClient.js', () => ({
    getAuthUser: vi.fn(async () => ({ user: { id: 'user-paid-1' } })),
    getSupabaseClient: vi.fn(async () => ({ supabase: null }))
}));

const { PersistenceService } = await import('../PersistenceService.js');

describe('PersistenceService.listHeaders — فشل السحابة لا يُعرَض كـ«لا توجد دراسات»', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    it('فشل الجلب السحابي بلا أي دراسة محلية ⟵ يُرفَض الوعد بدل إرجاع قائمة فارغة كاذبة', async () => {
        vi.spyOn(PersistenceService, '_listCloudHeaders').mockRejectedValue(new Error('Failed to fetch'));

        await expect(PersistenceService.listHeaders()).rejects.toThrow(/تعذّر الوصول إلى دراساتك السحابية/);
    });

    it('فشل الجلب السحابي مع وجود دراسات محلية ⟵ تُعرَض المحلية كما كان (بلا تراجع)', async () => {
        localStorage.setItem('feas_project_index', JSON.stringify([
            { id: 'local-1', name: 'مصنع تعبئة', lastModified: '2026-08-20T00:00:00.000Z' }
        ]));
        vi.spyOn(PersistenceService, '_listCloudHeaders').mockRejectedValue(new Error('Failed to fetch'));

        const headers = await PersistenceService.listHeaders();

        expect(headers.map(h => h.id)).toEqual(['local-1']);
    });

    it('نجاح الجلب بقائمة فارغة فعلاً ⟵ قائمة فارغة (فراغ حقيقي لا يُرفَض)', async () => {
        vi.spyOn(PersistenceService, '_listCloudHeaders').mockResolvedValue([]);

        await expect(PersistenceService.listHeaders()).resolves.toEqual([]);
    });

    it('نجاح الجلب بخمس دراسات سحابية ⟵ تُعرَض كلها', async () => {
        vi.spyOn(PersistenceService, '_listCloudHeaders').mockResolvedValue(
            [1, 2, 3, 4, 5].map(i => ({ id: `cloud-${i}`, name: `دراسة ${i}`, lastModified: `2026-08-0${i}T00:00:00.000Z` }))
        );

        const headers = await PersistenceService.listHeaders();

        expect(headers).toHaveLength(5);
    });
});
