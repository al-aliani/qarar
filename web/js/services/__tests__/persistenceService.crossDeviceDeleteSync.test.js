/**
 * @vitest-environment jsdom
 *
 * تدقيق شامل 2026-09-16: _listCloudHeaders كان يقرأ عمود status ثم يُسقطه بالكامل
 * دون استخدام، ولا يقرأ إطلاقاً projectInfo.deleted من عمود data (JSONB) — وهو
 * الحقل الوحيد الذي تكتبه ProjectManager.deleteProject/restoreProject فعلياً (عمود
 * status لا يُكتب أبداً عمداً لتفادي مخالفة قيد CHECK). الأثر: دراسة "محذوفة" من
 * جهاز تعود "نشطة" على جهاز/جلسة أخرى بلا فهرس محلي سابق، وتغيب عن سلة المحذوفات
 * هناك. الإصلاح: قراءة data->projectInfo->>deleted/deletedAt مباشرة، نفس الحقل
 * الذي يكتبه deleteProject فعلياً.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('_listCloudHeaders — علم الحذف يصل من عمود data لا عمود status المهمَل', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.doUnmock('../../../supabaseClient.js');
    });

    it('صف سحابي بـ deleted:true (بلا فهرس محلي سابق) يظهر بعلم deleted=true لا undefined', async () => {
        vi.doMock('../../../supabaseClient.js', () => ({
            getSupabaseClient: vi.fn(async () => ({
                supabase: {
                    from: () => ({
                        select: () => ({
                            eq: () => ({
                                order: async () => ({
                                    data: [{ id: 'cloud-deleted-1', title: 'دراسة محذوفة', updated_at: '2026-09-16T00:00:00Z', deleted: 'true', deletedAt: '1757980800000' }],
                                    error: null,
                                }),
                            }),
                        }),
                    }),
                },
            })),
            getAuthUser: vi.fn(async () => ({ user: null, ok: false })),
        }));
        const { PersistenceService: FreshPS } = await import('../PersistenceService.js');

        const headers = await FreshPS._listCloudHeaders('user-1');
        expect(headers[0].deleted).toBe(true);
        expect(headers[0].deletedAt).toBe(1757980800000);
    });

    it('صف سحابي نشط (deleted:false من JSON) يظهر بعلم deleted=false لا نصاً حقيقياً', async () => {
        vi.doMock('../../../supabaseClient.js', () => ({
            getSupabaseClient: vi.fn(async () => ({
                supabase: {
                    from: () => ({
                        select: () => ({
                            eq: () => ({
                                order: async () => ({
                                    data: [{ id: 'cloud-active-1', title: 'دراسة نشطة', updated_at: '2026-09-16T00:00:00Z', deleted: 'false', deletedAt: null }],
                                    error: null,
                                }),
                            }),
                        }),
                    }),
                },
            })),
            getAuthUser: vi.fn(async () => ({ user: null, ok: false })),
        }));
        const { PersistenceService: FreshPS } = await import('../PersistenceService.js');

        const headers = await FreshPS._listCloudHeaders('user-1');
        expect(headers[0].deleted).toBe(false);
        expect(headers[0].deletedAt).toBeNull();
    });

    it('[إثبات العطل الأصلي] صف بلا حقل deleted في الاستجابة (كأن الإصلاح لم يُطبَّق) يُقرأ خطأً كـ deleted=false دائماً', async () => {
        // يحاكي شكل الاستجابة القديم (status بلا data->projectInfo->>deleted) لإثبات
        // أن الفحص أعلاه متّصل فعلياً بوجود الحقل الجديد لا نصاً دائم النجاح.
        vi.doMock('../../../supabaseClient.js', () => ({
            getSupabaseClient: vi.fn(async () => ({
                supabase: {
                    from: () => ({
                        select: () => ({
                            eq: () => ({
                                order: async () => ({
                                    data: [{ id: 'cloud-legacy-shape', title: 'دراسة', updated_at: '2026-09-16T00:00:00Z', status: 'draft' }],
                                    error: null,
                                }),
                            }),
                        }),
                    }),
                },
            })),
            getAuthUser: vi.fn(async () => ({ user: null, ok: false })),
        }));
        const { PersistenceService: FreshPS } = await import('../PersistenceService.js');

        const headers = await FreshPS._listCloudHeaders('user-1');
        // هذا هو بالضبط العطل الأصلي لو عاد الكود لقراءة status وحده: لا معلومة حذف حقيقية
        expect(headers[0].deleted).toBe(false);
    });
});
