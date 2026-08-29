/**
 * @vitest-environment jsdom
 *
 * قرار لجنة 2026-08-27: فتح دراسة قديمة بعد تحديث معادلات المحرك يعيد حسابها
 * صامتاً بلا أي تنبيه — عميل صدَّر PDF لبنك برقم NPV معيّن قد يرى رقماً مختلفاً
 * لاحقاً بلا تفسير. الإصلاح الجزئي: بانر تنبيه حين تختلف _meta.engineVersion
 * المحفوظة عن ENGINE_VERSION الحالي — انظر engine.js وPersistenceService.js.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const loadProjectMock = vi.fn();
const getActiveProjectsMock = vi.fn(async () => []);
const runQAChecksMock = vi.fn(async () => ({ hardErrors: [], softWarnings: [], validationErrors: [], validationWarnings: [] }));

vi.mock('../../services/ProjectManager.js', () => ({
    ProjectManager: {
        loadProject: (...a) => loadProjectMock(...a),
        getActiveProjects: (...a) => getActiveProjectsMock(...a)
    }
}));
// ENGINE_VERSION الحالي ثابت هنا بمعزل عن قيمته الفعلية في engine.js — الاختبار
// يفحص منطق المقارنة نفسه في _renderEngineVersionNotice لا رقم النسخة بعينه.
vi.mock('../../core/engine.js', () => ({
    calculateStudy: vi.fn(() => ({ indicators: {} })),
    ENGINE_VERSION: 'v-current',
}));
vi.mock('../../utils/qaChecks.js', () => ({
    runQAChecks: (...a) => runQAChecksMock(...a)
}));

async function renderWith(meta) {
    const data = { projectInfo: { name: 'مقهى الرياض' }, _meta: meta };
    loadProjectMock.mockResolvedValue({ data, source: 'local' });

    const { ProjectOverviewView } = await import('../ProjectOverviewView.js');
    const store = { set: vi.fn(), getState: () => data };
    const view = new ProjectOverviewView('host', store, {});
    await view.render('p1');
    return document.getElementById('host').innerHTML;
}

describe('ProjectOverviewView — تنبيه تغيّر إصدار المحرك', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="host"></div>';
        vi.clearAllMocks();
    });

    it('لا بانر حين تطابق البصمة المحفوظة الإصدار الحالي', async () => {
        const html = await renderWith({ engineVersion: 'v-current' });
        expect(html).not.toContain('po__engine-notice');
    });

    it('لا بانر حين لا توجد بصمة محفوظة أصلاً (دراسة قديمة قبل هذه الميزة — لا أساس مقارنة)', async () => {
        const html = await renderWith(undefined);
        expect(html).not.toContain('po__engine-notice');
    });

    it('يعرض بانراً صريحاً حين تختلف البصمة المحفوظة عن الإصدار الحالي', async () => {
        const html = await renderWith({ engineVersion: 'v-old' });
        // الصنف صار عاماً في components.css (engine-version-notice) بعد توحيد المنطق
        // في utils/engineVersionNotice.js (بند 4، 2026-08-29) — لم يعد po__engine-notice
        // المحلي القديم، كي تستطيع أسطح أخرى (ShareView، DecisionDashboard، ExecutiveSummary)
        // استخدام نفس الصنف بلا تكرار تنسيق.
        expect(html).toContain('engine-version-notice');
        expect(html).toContain('تحديث معادلات المحرك المالي');
    });

    it('[إثبات الحارس] استدعاء مباشر لـ_renderEngineVersionNotice الحقيقية (لا بديل مصطنع): تعتمد فعلياً على المقارنة', async () => {
        const { ProjectOverviewView } = await import('../ProjectOverviewView.js');
        const view = new ProjectOverviewView('host', { set: vi.fn() }, {});

        // استدعاء الدالة الحقيقية نفسها (لا نسخة بديلة منفصلة) — لو حُذف فحص
        // المقارنة من الكود الفعلي (أعاد '' دوماً كما كانت الحال قبل قرار اللجنة
        // 2026-08-27) لفشل هذا التوقع تحديداً، لا توقعاً على دالة وهمية معزولة.
        expect(view._renderEngineVersionNotice({ _meta: { engineVersion: 'v-old' } })).toContain('engine-version-notice');
        expect(view._renderEngineVersionNotice({ _meta: { engineVersion: 'v-current' } })).toBe('');
        expect(view._renderEngineVersionNotice({ _meta: undefined })).toBe('');
    });
});
