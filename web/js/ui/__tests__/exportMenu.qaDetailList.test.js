/**
 * @vitest-environment jsdom
 *
 * دفعة 3 (2026-07-12، اختبار عميل بقالة): نافذة التصدير كانت تعرض «تحذيرات: 6» بلا أي
 * تفصيل. الآن #export-qa-badge يعرض قائمة مفصّلة قابلة للنقر (كل بند يقفز لخطوته عبر
 * حدث feasibility:navigateToStep الذي يلتقطه app.js)، وحوار بوابة الجودة (_qaGate) يتيح
 * نفس القفز لبنوده أيضاً.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEmptyStudy } from '../../core/schema.js';
import { stepIndexById } from '../../core/wizardSteps.js';
import { ExportMenu } from '../ExportMenu.js';

function fakeStore(state) {
    return {
        getState: () => state,
        get: () => state,
        update: vi.fn(),
        notify: vi.fn(),
        updatePath: vi.fn((section, path, value) => {
            if (!state[section]) state[section] = {};
            const keys = path.split('.');
            let target = state[section];
            for (let i = 0; i < keys.length - 1; i += 1) {
                if (!target[keys[i]]) target[keys[i]] = {};
                target = target[keys[i]];
            }
            target[keys[keys.length - 1]] = value;
        })
    };
}

describe('ExportMenu — قائمة تحذيرات فحص الجودة المفصّلة (#export-qa-badge)', () => {
    beforeEach(() => {
        document.body.innerHTML = `<div id="exportMenuOverlay"></div>`;
    });

    it('دراسة فارغة (بلا إيرادات) تعرض تفصيلاً قابلاً للنقر بدل عدد مجرّد فقط', async () => {
        const menu = new ExportMenu('exportMenuOverlay', fakeStore(createEmptyStudy()));
        await menu.open();

        const badge = document.getElementById('export-qa-badge');
        expect(badge.innerHTML).toContain('qa-detail-list');
        const items = badge.querySelectorAll('.qa-detail-item');
        expect(items.length).toBeGreaterThan(0);
    });

    it('بند مرتبط بمسار "revenue" (لا إيرادات) قابل للنقر ويحمل فهرس خطوة مصادر الإيرادات الصحيح', async () => {
        const menu = new ExportMenu('exportMenuOverlay', fakeStore(createEmptyStudy()));
        await menu.open();

        const badge = document.getElementById('export-qa-badge');
        const jumpButtons = Array.from(badge.querySelectorAll('button.qa-detail-item[data-step-index]'));
        const revenueBtn = jumpButtons.find((b) => /إيراد/.test(b.textContent));
        expect(revenueBtn).toBeTruthy();
        expect(Number(revenueBtn.dataset.stepIndex)).toBe(stepIndexById('revenue'));
    });

    it('النقر على بند قابل للنقر يُطلق feasibility:navigateToStep بفهرس الخطوة الصحيح ويُغلق القائمة', async () => {
        const menu = new ExportMenu('exportMenuOverlay', fakeStore(createEmptyStudy()));
        await menu.open();
        menu.overlay.classList.add('is-open'); // يثبّت الحالة الأولية قبل النقر

        const badge = document.getElementById('export-qa-badge');
        const jumpButtons = Array.from(badge.querySelectorAll('button.qa-detail-item[data-step-index]'));
        expect(jumpButtons.length).toBeGreaterThan(0);
        const target = jumpButtons[0];
        const expectedIndex = Number(target.dataset.stepIndex);

        const handler = vi.fn();
        window.addEventListener('feasibility:navigateToStep', handler);
        target.click();
        window.removeEventListener('feasibility:navigateToStep', handler);

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler.mock.calls[0][0].detail.stepIndex).toBe(expectedIndex);
        expect(menu.overlay.classList.contains('is-open')).toBe(false);
    });

    it('دراسة تجتاز الفحص دون تحذيرات تعرض الشارة الخضراء بلا قائمة تفصيل', async () => {
        const el = document.createElement('div');
        el.id = 'export-qa-badge';
        const menu = new ExportMenu('exportMenuOverlay', fakeStore(createEmptyStudy()));
        menu._renderQaSummary(el, { hardErrors: [], softWarnings: [], validationErrors: [], validationWarnings: [] });

        expect(el.innerHTML).toContain('اجتازت فحص الجودة');
        expect(el.innerHTML).not.toContain('qa-detail-list');
    });

    it('_renderQaSummary يهرّب HTML في نص التحذير (لا حقن Stored XSS)', () => {
        const el = document.createElement('div');
        const menu = new ExportMenu('exportMenuOverlay', fakeStore(createEmptyStudy()));
        menu._renderQaSummary(el, {
            hardErrors: [{ code: 'X', message: '<img src=x onerror=alert(1)>', path: 'system' }],
            softWarnings: [], validationErrors: [], validationWarnings: []
        });

        expect(el.innerHTML).not.toContain('<img');
        expect(el.innerHTML).toContain('&lt;img');
    });

    it('قائمة التصدير تبدأ بثلاثة مسارات رئيسية وتفلتر الصيغ حسب المسار المختار', async () => {
        const menu = new ExportMenu('exportMenuOverlay', fakeStore(createEmptyStudy()));
        await menu.open();

        const paths = Array.from(document.querySelectorAll('.export-path-card'));
        expect(paths).toHaveLength(3);

        expect(document.querySelector('[data-type="lending_ready"]').hidden).toBe(false);
        expect(document.querySelector('[data-type="pitch"]').hidden).toBe(true);
        expect(document.querySelector('[data-type="json"]').hidden).toBe(true);

        document.querySelector('[data-export-path="investor"]').click();
        expect(document.querySelector('[data-type="pitch"]').hidden).toBe(false);
        expect(document.querySelector('[data-type="pptx"]').hidden).toBe(false);
        expect(document.querySelector('[data-type="accelerator_pitch"]').hidden).toBe(false);
        expect(document.querySelector('[data-type="grant"]').hidden).toBe(false);
        expect(document.querySelector('[data-type="lending_ready"]').hidden).toBe(true);

        document.querySelector('[data-export-path="data"]').click();
        expect(document.querySelector('[data-type="json"]').hidden).toBe(false);
        expect(document.querySelector('[data-type="share_link"]').hidden).toBe(false);
        expect(document.querySelector('[data-type="folder_json"]').hidden).toBe(false);
        expect(document.querySelector('[data-type="gsheets"]').hidden).toBe(false);
        expect(document.querySelector('[data-type="pitch"]').hidden).toBe(true);
    });

    it('حزمة ZIP واستشارة الخبير تبقيان ظاهرتين تحت المسارات الثلاثة كلها (تدقيق 2026-07-21: كانتا مبنيتين وتعملان لكن أخفاهما تبسيط المسارات الثلاثة كلياً)', async () => {
        const menu = new ExportMenu('exportMenuOverlay', fakeStore(createEmptyStudy()));
        await menu.open();

        for (const path of ['lending', 'investor', 'data']) {
            document.querySelector(`[data-export-path="${path}"]`).click();
            expect(document.querySelector('[data-type="batch_zip"]').hidden).toBe(false);
            expect(document.querySelector('[data-type="consultation"]').hidden).toBe(false);
        }
    });

    it('مركز الإصلاح يعرض السبب والأثر ويطبّق إصلاحاً آمناً لاسم المشروع', async () => {
        const study = createEmptyStudy();
        study.projectInfo.concept = 'مقهى مختص';
        const store = fakeStore(study);
        const menu = new ExportMenu('exportMenuOverlay', store);
        await menu.open();

        document.getElementById('btnOpenQaFixCenter').click();

        const fixCenter = document.getElementById('qaFixCenterOverlay');
        expect(fixCenter).toBeTruthy();
        expect(fixCenter.textContent).toContain('السبب:');
        expect(fixCenter.textContent).toContain('الأثر على التقرير:');

        const nameFix = Array.from(fixCenter.querySelectorAll('.qa-fix-action'))
            .find((btn) => btn.dataset.action === 'project_name');
        expect(nameFix).toBeTruthy();
        nameFix.click();

        expect(store.updatePath).toHaveBeenCalledWith('projectInfo', 'name', 'مقهى مختص');
        expect(study.projectInfo.name).toBe('مقهى مختص');
    });
});

describe('ExportMenu confidence and download history', () => {
    beforeEach(() => {
        document.body.innerHTML = `<div id="exportMenuOverlay"></div>`;
    });

    it('shows the confidence disclosure and a direct route to download history', async () => {
        const menu = new ExportMenu('exportMenuOverlay', fakeStore(createEmptyStudy()));
        await menu.open();

        expect(document.getElementById('export-confidence-panel').textContent).toContain('درجة موثوقية النتائج');
        expect(document.getElementById('btnOpenDownloadsCenter')).toBeTruthy();
    });
});
