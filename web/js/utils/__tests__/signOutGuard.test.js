/**
 * تدقيق 2026-07-21 (بلوكر #31): الخروج التلقائي بعد خمول (app.js) لا يوجد فيه
 * مستخدم حاضر ليؤكّد تحذير دراسات غير مُزامَنة، فكان signOut() يمسحها صامتة.
 * trySyncUnsyncedProjects يحاول رفعها للسحابة أولاً بأفضل جهد بدل ذلك.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const getAllProjectsMock = vi.fn(async () => []);
const loadProjectMock = vi.fn(async () => null);
const saveProjectMock = vi.fn(async () => ({ success: true }));
vi.mock('../../services/ProjectManager.js', () => ({
    ProjectManager: {
        getAllProjects: (...a) => getAllProjectsMock(...a),
        loadProject: (...a) => loadProjectMock(...a),
        saveProject: (...a) => saveProjectMock(...a),
    },
}));

vi.mock('../../../supabaseClient.js', () => ({ signOut: vi.fn(async () => {}) }));

describe('getUnsyncedLocalProjects', () => {
    beforeEach(() => vi.clearAllMocks());

    it('يفلتر فقط source==="local"', async () => {
        getAllProjectsMock.mockResolvedValue([
            { id: '1', source: 'local' },
            { id: '2', source: 'cloud' },
            { id: '3', source: 'local' },
        ]);
        const { getUnsyncedLocalProjects } = await import('../signOutGuard.js');
        const result = await getUnsyncedLocalProjects();
        expect(result.map((p) => p.id)).toEqual(['1', '3']);
    });

    it('فشل الفحص نفسه ⇒ [] بدل رمي خطأ يمنع الخروج', async () => {
        getAllProjectsMock.mockRejectedValue(new Error('boom'));
        const { getUnsyncedLocalProjects } = await import('../signOutGuard.js');
        expect(await getUnsyncedLocalProjects()).toEqual([]);
    });
});

describe('trySyncUnsyncedProjects', () => {
    beforeEach(() => vi.clearAllMocks());

    it('يحمّل كل دراسة غير مُزامَنة ثم يعيد حفظها (يدفعها للسحابة)', async () => {
        loadProjectMock.mockImplementation(async (id) => ({ data: { projectInfo: { id }, x: 1 }, source: 'local' }));
        const { trySyncUnsyncedProjects } = await import('../signOutGuard.js');
        await trySyncUnsyncedProjects([{ id: 'a' }, { id: 'b' }]);
        expect(loadProjectMock).toHaveBeenCalledWith('a');
        expect(loadProjectMock).toHaveBeenCalledWith('b');
        expect(saveProjectMock).toHaveBeenCalledTimes(2);
    });

    it('فشل رفع دراسة واحدة لا يوقف رفع البقية (أفضل جهد فقط)', async () => {
        loadProjectMock
            .mockRejectedValueOnce(new Error('load failed'))
            .mockResolvedValueOnce({ data: { projectInfo: { id: 'b' } } });
        const { trySyncUnsyncedProjects } = await import('../signOutGuard.js');
        await expect(trySyncUnsyncedProjects([{ id: 'a' }, { id: 'b' }])).resolves.not.toThrow();
        expect(saveProjectMock).toHaveBeenCalledTimes(1);
    });

    it('دراسة بلا بيانات فعلية (data فارغة) ⇒ لا يحاول حفظها', async () => {
        loadProjectMock.mockResolvedValue(null);
        const { trySyncUnsyncedProjects } = await import('../signOutGuard.js');
        await trySyncUnsyncedProjects([{ id: 'a' }]);
        expect(saveProjectMock).not.toHaveBeenCalled();
    });
});
