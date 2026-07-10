/**
 * @vitest-environment jsdom
 *
 * تدقيق مجلس الحرب 2026-07-10: renderQualityStrip كان يفحص `projectInfo` على عنصر
 * قائمة خفيف لا يحمله أبداً — الشرط يفشل دائماً فيختفي الشريط لكل مستخدم حقيقي (كود
 * ميت 100%). أُصلح بتحميل الدراسة الكاملة عند غياب البيانات. لم يكن لهذا السلوك — ولا
 * لتقسيم renderProjectCard إلى رسم فوري + تحميل مؤجَّل لشارة الجودة، ولا لتبديل
 * تبويبات مساحة العمل — أي اختبار آلي قبل هذا الملف.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../supabaseClient.js', () => ({
    getAuthUser: vi.fn(async () => ({ user: null })),
    signOut: vi.fn(async () => {})
}));

const FULL_PROJECT_DATA = {
    projectInfo: { name: 'مطعم تجريبي', concept: 'مطعم مأكولات شعبية بالرياض' },
    marketing: {},
    technical: {},
    financials: {}
};

vi.mock('../../services/ProjectManager.js', () => ({
    ProjectManager: {
        getActiveProjects: vi.fn(async () => []),
        loadProject: vi.fn(async (id) => ({ data: { ...FULL_PROJECT_DATA, id }, source: 'local' }))
    }
}));

function makeView(projects) {
    return import('../DashboardView.js').then(({ DashboardView }) => {
        const view = new DashboardView('dv', { getState: () => ({}), get: () => ({}), subscribe: () => () => {} });
        view.__test_projects = projects;
        return view;
    });
}

describe('DashboardView — شريط الجودة (renderQualityStrip)', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="dv"></div>';
        vi.clearAllMocks();
    });

    it('لا يظهر الشريط بلا أي دراسة محفوظة', async () => {
        const view = await makeView([]);
        expect(await view.renderQualityStrip([])).toBe('');
    });

    it('يظهر الشريط ويحسب نسبة حقيقية حين تكون البيانات عنواناً خفيفاً بلا projectInfo (الحالة الفعلية من ProjectManager)', async () => {
        const { ProjectManager } = await import('../../services/ProjectManager.js');
        const view = await makeView(null);
        const header = { id: 'p1', name: 'مطعمي', lastModified: new Date().toISOString() };

        const html = await view.renderQualityStrip([header]);

        expect(ProjectManager.loadProject).toHaveBeenCalledWith('p1');
        expect(html).toContain('quality-strip');
        expect(html).toMatch(/\d+%/);
        expect(html).toContain('مطعم تجريبي');
    });

    it('لا يتحطم ويُعيد نصاً فارغاً إن فشل تحميل الدراسة الكاملة', async () => {
        const { ProjectManager } = await import('../../services/ProjectManager.js');
        ProjectManager.loadProject.mockRejectedValueOnce(new Error('network down'));
        const view = await makeView(null);

        const html = await view.renderQualityStrip([{ id: 'p2', name: 'مشروع' }]);
        expect(html).toBe('');
    });
});

describe('DashboardView — بطاقة المشروع (renderProjectCard) وتهريب الأسماء', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="dv"></div>';
        vi.clearAllMocks();
    });

    it('ترسم فوراً (متزامنة) مع بديل تحميل بلا انتظار الشبكة عند غياب البيانات المضمَّنة', async () => {
        const view = await makeView(null);
        const project = { id: 'p1', name: 'مشروعي', lastModified: new Date().toISOString(), source: 'local' };

        const html = view.renderProjectCard(project);
        expect(typeof html).toBe('string'); // لا Promise — تزامنية عمداً
        expect(html).toContain('data-completeness-for="p1"');
        expect(html).toContain('dv-quality-mini--pending');
    });

    it('تُهرِّب اسم المشروع في العنوان والسمة معاً — لا حقن HTML', async () => {
        const view = await makeView(null);
        const project = { id: 'p1', name: '<img src=x onerror=alert(1)>', lastModified: new Date().toISOString(), source: 'local' };

        const html = view.renderProjectCard(project);
        expect(html).not.toContain('<img src=x onerror=alert(1)>');
        expect(html).toContain('&lt;img');
        // نضمّن الاسم المُهرَّب داخل عنصر container فعلي ونتأكد أن أي وسم <img> لم يُنشأ في الـDOM
        document.body.innerHTML = `<div id="host">${html}</div>`;
        expect(document.querySelector('#host img')).toBeNull();
    });

    it('hydrateProjectCompleteness يستبدل شارة الانتظار ببيانات حقيقية بعد التحميل', async () => {
        const { ProjectManager } = await import('../../services/ProjectManager.js');
        const view = await makeView(null);
        const project = { id: 'p1', name: 'مشروعي', lastModified: new Date().toISOString(), source: 'local' };

        document.getElementById('dv').innerHTML = `<div class="dv-projects">${view.renderProjectCard(project)}</div>`;
        expect(document.querySelector('[data-completeness-for="p1"]')).not.toBeNull();

        view.hydrateProjectCompleteness([project]);
        await vi.waitFor(() => {
            expect(ProjectManager.loadProject).toHaveBeenCalledWith('p1');
        });
        await new Promise(resolve => setTimeout(resolve, 0)); // flush microtask بعد resolve الـmock

        expect(document.querySelector('[data-completeness-for="p1"]')).toBeNull();
        expect(document.querySelector('.dv-quality-mini')).not.toBeNull();
    });
});

describe('DashboardView — تبديل تبويبات مساحة العمل', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="dv"></div>';
        vi.clearAllMocks();
    });

    it('النقر على تبويب «الأدوات والمحرّكات» يُفعِّله ويُخفي لوحة «دراساتك»', async () => {
        const view = await makeView([]);
        await view.render();

        const enginesTab = document.querySelector('[data-dv-panel-button="engines"]');
        const studiesPanel = document.getElementById('homePanel-studies');
        const enginesPanel = document.getElementById('toolsAndEngines');

        expect(studiesPanel.hidden).toBe(false);
        expect(enginesPanel.hidden).toBe(true);

        enginesTab.click();

        expect(enginesTab.classList.contains('is-active')).toBe(true);
        expect(enginesTab.getAttribute('aria-selected')).toBe('true');
        expect(studiesPanel.hidden).toBe(true);
        expect(enginesPanel.hidden).toBe(false);
    });
});
