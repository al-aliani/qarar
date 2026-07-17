/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-17: حذف دراسة (نقلها لسلة المحذوفات) كان يضبط deleted:true في طبقة
 * تخزين ProjectManager فقط (feas_project_<id>). لو كانت نفس الدراسة محمَّلة حالياً في
 * store النشط (المعالج مفتوح عليها)، حلقة autosave المستقلة لـstore (مؤقّت cloud-sync حتى
 * 800ms، غير مرتبط بحدث الحذف إطلاقاً) قد تصل لاحقاً فتكتب فوق deleted:true بنسخة قديمة
 * بلا العلم — فتعود الدراسة "المحذوفة" للظهور بعد تحديث الصفحة. الإصلاح: بعد نجاح الحذف،
 * لو كانت الدراسة المحذوفة هي عين الدراسة النشطة بالـstore، نستدعي store.reset() فوراً —
 * يُلغي أي مزامنة سحابية معلَّقة (saveLocal تُصفّر المؤقّت القديم قبل جدولة مؤقّت جديد)
 * ويستبدل الحالة النشطة بدراسة فارغة جديدة لا علاقة لها بالدراسة المحذوفة.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('sweetalert2', () => ({
    default: { fire: vi.fn(async () => ({ isConfirmed: true })) }
}));

vi.mock('../../services/ProjectManager.js', () => ({
    ProjectManager: {
        deleteProject: vi.fn(async () => ({ success: true })),
        getAllProjects: vi.fn(async () => []),
        getActiveProjects: vi.fn(async () => []),
    }
}));

function fakeStore(projectId) {
    return {
        getState: () => ({ projectInfo: { id: projectId } }),
        get: () => ({ projectInfo: { id: projectId } }),
        reset: vi.fn(async () => {}),
    };
}

describe('DashboardView — حذف دراسة نشطة حالياً في store يُعيد ضبطه', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="dv"></div>';
        vi.clearAllMocks();
    });

    it('حذف الدراسة النشطة (نفس id بالـstore): يستدعي store.reset()', async () => {
        const { DashboardView } = await import('../DashboardView.js');
        const store = fakeStore('study-42');
        const view = new DashboardView('dv', store, () => {});

        document.getElementById('dv').innerHTML =
            '<button class="btn-delete" data-id="study-42"></button>';
        view.bindEvents();

        document.querySelector('.btn-delete').click();
        await new Promise((r) => setTimeout(r, 0));
        await new Promise((r) => setTimeout(r, 0));

        const { ProjectManager } = await import('../../services/ProjectManager.js');
        expect(ProjectManager.deleteProject).toHaveBeenCalledWith('study-42');
        expect(store.reset).toHaveBeenCalledTimes(1);
    });

    it('حذف دراسة غير نشطة (id مختلف عن الدراسة الحالية بالـstore): لا يستدعي store.reset()', async () => {
        const { DashboardView } = await import('../DashboardView.js');
        const store = fakeStore('study-current');
        const view = new DashboardView('dv', store, () => {});

        document.getElementById('dv').innerHTML =
            '<button class="btn-delete" data-id="study-other"></button>';
        view.bindEvents();

        document.querySelector('.btn-delete').click();
        await new Promise((r) => setTimeout(r, 0));
        await new Promise((r) => setTimeout(r, 0));

        const { ProjectManager } = await import('../../services/ProjectManager.js');
        expect(ProjectManager.deleteProject).toHaveBeenCalledWith('study-other');
        expect(store.reset).not.toHaveBeenCalled();
    });
});
