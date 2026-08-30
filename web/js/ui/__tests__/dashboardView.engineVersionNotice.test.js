/**
 * @vitest-environment jsdom
 *
 * بلوكر بانر إصدار المحرك — مراجعة عدائية 2026-08-29 لبند #49 وجدت نفس نمط
 * store.set(data) غير المشروط الذي أُصلح في ProjectOverviewView.render() موجوداً
 * بلا تعديل في DashboardView.loadProject() — يستدعيها زر «آخر ما فتحته»
 * (dv-recent-strip__item) وأيقونة المشاركة/التصدير (btn-share) على بطاقة المشروع.
 * كلا المسارين *سلبي* من منظور المستخدم (إعادة فتح دراسة حديثة، أو فتح قائمة
 * تصدير) بلا أي مرور بصفحة الخلاصة (ProjectOverviewView) التي تعرض هذا التنبيه —
 * الوجهة الفعلية بعد «آخر ما فتحته» خطوة إدخال بالويزارد (لا تعرض البانر إطلاقاً)،
 * وتحذير ExportMenu لا يظهر إلا عند الضغط على تصدير فعلي داخل القائمة، لا عند
 * مجرّد فتحها. store.set() يُشغّل سلسلة الحفظ الكاملة (saveLocalDebounced 1000ms
 * → _syncToCloud 800ms → PersistenceService.save) فتُعيد وسم _meta.engineVersion
 * صامتاً، فتُمحى بصمة الإصدار القديمة بلا أن يرى المستخدم أي تحذير على أيٍّ من
 * الوجهتين. الإصلاح: loadProject() يتحقق من بصمة الإصدار (isEngineVersionStale،
 * نفس أداة engineVersionNotice.js الموحّدة المستخدمة في كل الأسطح الأخرى) على
 * البيانات الطازجة قبل استبدالها في المخزن، ويُطلِق toast.warning — لا بانر HTML
 * لأن كلا الوجهتين يُغادران لوحة التحكم فوراً فلا مكان لبانر ثابت.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../supabaseClient.js', () => ({
    getAuthUser: vi.fn(async () => ({ user: null })),
    signOut: vi.fn(async () => {}),
    getUserProfile: vi.fn(async () => null),
}));

const toastWarningMock = vi.fn();
const toastSuccessMock = vi.fn();
vi.mock('../../utils/toast.js', () => ({
    toast: {
        warning: (...a) => toastWarningMock(...a),
        success: (...a) => toastSuccessMock(...a),
        error: vi.fn(),
        info: vi.fn(),
    },
}));

// نفس نمط centralAssumptionsView.financialExtras.test.js — نمنع ExportMenu الحقيقية
// (تبعيات ثقيلة: PDF/Excel/Word generators) من التحميل، ونثبّت فقط أنها فُتحت فعلاً.
vi.mock('../ExportMenu.js', () => ({
    ExportMenu: vi.fn().mockImplementation(() => ({ open: vi.fn() })),
}));

function projectSummary(id, name) {
    return {
        id,
        name,
        source: 'local',
        lastModified: new Date().toISOString(),
        // بيانات مضمَّنة (hasInlineData) كي يتجاوز hydrateProjectCompleteness أي
        // نداء إضافي غير ذي صلة بموضوع هذا الاختبار لـProjectManager.loadProject.
        data: { projectInfo: { id, name, concept: 'مشروع تجريبي' } },
    };
}

function loadResultWithMeta(id, name, meta) {
    return {
        data: { projectInfo: { id, name, concept: 'مشروع تجريبي' }, ...(meta ? { _meta: meta } : {}) },
        source: 'local',
    };
}

const PROJECTS = [projectSummary('p1', 'مشروع الأول'), projectSummary('p2', 'مشروع الثاني')];

vi.mock('../../services/ProjectManager.js', () => ({
    ProjectManager: {
        getActiveProjects: vi.fn(async () => PROJECTS),
        loadProject: vi.fn(),
    },
}));

function fakeStore() {
    let state = {};
    return {
        getState: () => state,
        get: () => state,
        set: vi.fn((data) => { state = data; }),
        notify: vi.fn(),
        subscribe: () => () => {},
        flush: vi.fn(async () => {}),
        saveLocal: vi.fn(async () => {}),
    };
}

async function makeRenderedView() {
    const { DashboardView } = await import('../DashboardView.js');
    document.body.innerHTML = '<div id="dv"></div>';
    const view = new DashboardView('dv', fakeStore());
    await view.render();
    return view;
}

describe('DashboardView — تحذير إصدار المحرك عند «آخر ما فتحته» (dv-recent-strip__item)', () => {
    beforeEach(async () => {
        toastWarningMock.mockReset();
        toastSuccessMock.mockReset();
        const { ProjectManager } = await import('../../services/ProjectManager.js');
        ProjectManager.getActiveProjects.mockReset().mockResolvedValue(PROJECTS);
        ProjectManager.loadProject.mockReset();
    });

    it('بصمة محفوظة قديمة ⇒ toast.warning عند الضغط على زر «آخر ما فتحته» الحقيقي', async () => {
        const { ProjectManager } = await import('../../services/ProjectManager.js');
        ProjectManager.loadProject.mockResolvedValue(
            loadResultWithMeta('p1', 'مشروع الأول', { engineVersion: 'an-old-version-that-will-never-match-current' })
        );

        const view = await makeRenderedView();
        const btn = view.container.querySelector('.dv-recent-strip__item[data-recent-id="p1"]');
        expect(btn).toBeTruthy(); // إثبات وجود الزر الحقيقي المرسوم من القالب الفعلي، لا بديل مصطنع

        btn.click();

        await vi.waitFor(() => {
            expect(toastWarningMock).toHaveBeenCalledTimes(1);
        });
        expect(toastWarningMock.mock.calls[0][0]).toContain('تحديث معادلات المحرك المالي');
    });

    it('بصمة مطابقة للإصدار الحالي ⇒ لا تحذير عند «آخر ما فتحته»', async () => {
        const { ENGINE_VERSION } = await import('../../core/engine.js');
        const { ProjectManager } = await import('../../services/ProjectManager.js');
        ProjectManager.loadProject.mockResolvedValue(
            loadResultWithMeta('p1', 'مشروع الأول', { engineVersion: ENGINE_VERSION })
        );

        const view = await makeRenderedView();
        const btn = view.container.querySelector('.dv-recent-strip__item[data-recent-id="p1"]');
        btn.click();

        await vi.waitFor(() => {
            expect(toastSuccessMock).toHaveBeenCalled(); // إشارة اكتمال loadProject() الحقيقية
        });
        expect(toastWarningMock).not.toHaveBeenCalled();
    });

    it('لا بصمة محفوظة أصلاً (دراسة أقدم من هذه الميزة) ⇒ لا تحذير', async () => {
        const { ProjectManager } = await import('../../services/ProjectManager.js');
        ProjectManager.loadProject.mockResolvedValue(loadResultWithMeta('p1', 'مشروع الأول', undefined));

        const view = await makeRenderedView();
        const btn = view.container.querySelector('.dv-recent-strip__item[data-recent-id="p1"]');
        btn.click();

        await vi.waitFor(() => {
            expect(toastSuccessMock).toHaveBeenCalled();
        });
        expect(toastWarningMock).not.toHaveBeenCalled();
    });
});

describe('DashboardView — تحذير إصدار المحرك عند فتح أيقونة المشاركة/التصدير (btn-share)', () => {
    beforeEach(async () => {
        toastWarningMock.mockReset();
        toastSuccessMock.mockReset();
        const { ProjectManager } = await import('../../services/ProjectManager.js');
        ProjectManager.getActiveProjects.mockReset().mockResolvedValue(PROJECTS);
        ProjectManager.loadProject.mockReset();
        const { ExportMenu } = await import('../ExportMenu.js');
        ExportMenu.mockClear();
    });

    it('بصمة محفوظة قديمة ⇒ toast.warning عند الضغط على أيقونة المشاركة الحقيقية، وقائمة التصدير ما زالت تُفتح بعده', async () => {
        const { ProjectManager } = await import('../../services/ProjectManager.js');
        ProjectManager.loadProject.mockResolvedValue(
            loadResultWithMeta('p2', 'مشروع الثاني', { engineVersion: 'an-old-version-that-will-never-match-current' })
        );

        const view = await makeRenderedView();
        const btn = view.container.querySelector('.btn-share[data-id="p2"]');
        expect(btn).toBeTruthy();

        btn.click();

        await vi.waitFor(() => {
            expect(toastWarningMock).toHaveBeenCalledTimes(1);
        });
        expect(toastWarningMock.mock.calls[0][0]).toContain('تحديث معادلات المحرك المالي');

        // لم يكسر الإصلاح السبب الحقيقي وراء استدعاء loadProject() هنا: فتح قائمة
        // التصدير الفعلية بعد تحميل الدراسة المختارة في المخزن.
        const { ExportMenu } = await import('../ExportMenu.js');
        await vi.waitFor(() => {
            expect(ExportMenu).toHaveBeenCalledWith('exportMenuOverlay', expect.anything());
        });
    });

    it('بصمة مطابقة للإصدار الحالي ⇒ لا تحذير عند فتح أيقونة المشاركة', async () => {
        const { ENGINE_VERSION } = await import('../../core/engine.js');
        const { ProjectManager } = await import('../../services/ProjectManager.js');
        ProjectManager.loadProject.mockResolvedValue(
            loadResultWithMeta('p2', 'مشروع الثاني', { engineVersion: ENGINE_VERSION })
        );

        const view = await makeRenderedView();
        const btn = view.container.querySelector('.btn-share[data-id="p2"]');
        btn.click();

        await vi.waitFor(() => {
            expect(toastSuccessMock).toHaveBeenCalled();
        });
        expect(toastWarningMock).not.toHaveBeenCalled();
    });
});
