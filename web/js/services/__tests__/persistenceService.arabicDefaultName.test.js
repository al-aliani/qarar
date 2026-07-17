/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-17: PersistenceService._saveLocal (فهرس محلي) و_listCloudHeaders
 * (فهرس سحابي) كانا يستخدمان نصاً إنجليزياً حرفياً ("Untitled"/"Untitled Project")
 * لدراسة بلا اسم، بينما _saveCloud في نفس الملف (سطر 306) يستخدم بالفعل "مشروع جديد" —
 * تناقض مباشر يجعل "Untitled" يظهر للمستخدم في قائمة الدراسات المحلية أو عناوين
 * الدراسات المستوردة من السحابة بلا عنوان.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PersistenceService } from '../PersistenceService.js';

describe('PersistenceService — اسم افتراضي عربي بدل "Untitled"', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('_saveLocal: دراسة بلا projectInfo.name تُفهرَس محلياً باسم "مشروع جديد" لا "Untitled"', async () => {
        await PersistenceService._saveLocal('study-1', { projectInfo: {} });
        const headers = PersistenceService._listLocalHeaders();

        const entry = headers.find((h) => h.id === 'study-1');
        expect(entry?.name).toBe('مشروع جديد');
        expect(entry?.name).not.toBe('Untitled');
    });

    it('_listCloudHeaders: صف سحابي بعنوان فارغ يظهر باسم "مشروع جديد" لا "Untitled Project"', async () => {
        vi.doMock('../../../supabaseClient.js', () => ({
            getSupabaseClient: vi.fn(async () => ({
                supabase: {
                    from: () => ({
                        select: () => ({
                            eq: () => ({
                                order: async () => ({
                                    data: [{ id: 'cloud-1', title: '', updated_at: '2026-07-17T00:00:00Z' }],
                                    error: null,
                                }),
                            }),
                        }),
                    }),
                },
            })),
            getAuthUser: vi.fn(async () => ({ user: null, ok: false })),
        }));
        vi.resetModules();
        const { PersistenceService: FreshPS } = await import('../PersistenceService.js');

        const headers = await FreshPS._listCloudHeaders('user-1');
        expect(headers[0].name).toBe('مشروع جديد');
        expect(headers[0].name).not.toBe('Untitled Project');

        vi.doUnmock('../../../supabaseClient.js');
    });
});
