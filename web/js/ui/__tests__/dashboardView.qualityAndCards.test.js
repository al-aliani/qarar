/**
 * @vitest-environment jsdom
 *
 * تغطية renderProjectCard (رسم فوري + تحميل مؤجَّل لشارة الجودة)، وتبديل تبويبات
 * مساحة العمل، وشارات حالة المشروع — لم يكن لأيٍّ منها اختبار آلي قبل هذا الملف
 * (تدقيق مجلس الحرب 2026-07-10).
 *
 * حُذفت 2026-07-17 مجموعة اختبارات renderQualityStrip مع الدالة نفسها: أزال المالك
 * شريط «اكتمال بيانات الدراسة» من مساحة العمل، فلم يبقَ للدالة مستدعٍ. لاحظ أن
 * `dv-quality-mini` أدناه شيء آخر تماماً — شارة داخل بطاقة المشروع، ما زالت حيّة.
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

// ─────────────────────────────────────────────────────────────
// إتاحة (a11y): شارات حالة بطاقة المشروع (سحابي/محلي/مشترك) في renderProjectCard
// كل شارة مُميَّزة بلون (badge--info/warning/success)؛ نتحقق أن كل شارة تحمل معاً
// صنف اللون وأيقونة ونصاً ظاهرين، فلا يعتمد التمييز بينها على اللون وحده.
// نفس نمط التحقق في batch6.readinessDimensions.test.js.
// ─────────────────────────────────────────────────────────────
describe('DashboardView — شارات حالة المشروع (سحابي/محلي/مشترك) لا تعتمد على اللون فقط (a11y)', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="dv"></div>';
        vi.clearAllMocks();
    });

    it('شارة "سحابي": صنف badge--info + أيقونة ونص "سحابي" ظاهران معاً', async () => {
        const view = await makeView(null);
        const project = { id: 'p1', name: 'مشروع سحابي', lastModified: new Date().toISOString(), source: 'cloud' };
        const html = view.renderProjectCard(project);
        document.body.innerHTML = `<div id="host">${html}</div>`;

        const badge = document.querySelector('#host .dv-project__badges .badge');
        expect(badge).toBeTruthy();
        expect(badge.className).toContain('badge--info');
        expect(badge.textContent).toContain('سحابي');
        expect(badge.querySelector('svg')).toBeTruthy();
    });

    it('شارة "محلي": صنف badge--warning + أيقونة ونص "محلي" ظاهران معاً', async () => {
        const view = await makeView(null);
        const project = { id: 'p2', name: 'مشروع محلي', lastModified: new Date().toISOString(), source: 'local' };
        const html = view.renderProjectCard(project);
        document.body.innerHTML = `<div id="host">${html}</div>`;

        const badge = document.querySelector('#host .dv-project__badges .badge');
        expect(badge).toBeTruthy();
        expect(badge.className).toContain('badge--warning');
        expect(badge.textContent).toContain('محلي');
        expect(badge.querySelector('svg')).toBeTruthy();
    });

    it('شارة "مشترك": صنف badge--success + أيقونة ونص "مشترك" ظاهران معاً حين توجد بيانات فريق مضمّنة', async () => {
        const view = await makeView(null);
        const project = {
            id: 'p3', name: 'مشروع مشترك', lastModified: new Date().toISOString(), source: 'cloud',
            data: { projectInfo: { name: 'مشروع مشترك', members: [{ name: 'شريك' }] } }
        };
        const html = view.renderProjectCard(project);
        document.body.innerHTML = `<div id="host">${html}</div>`;

        const badges = [...document.querySelectorAll('#host .dv-project__badges .badge')];
        const sharedBadge = badges.find(b => b.textContent.includes('مشترك'));
        expect(sharedBadge).toBeTruthy();
        expect(sharedBadge.className).toContain('badge--success');
        expect(sharedBadge.querySelector('svg')).toBeTruthy();
    });
});
