/**
 * @vitest-environment jsdom
 *
 * بند 4 (بانر إصدار المحرك، 2026-08-29) — أعلى أولوية بين الأسطح المضافة: من يفتح
 * رابط مشاركة (بنك/مستثمر) لا يملك وصولاً لـProjectOverviewView أصلاً، فهذا كان
 * السطح الوحيد الذي يُطلعه على أن الأرقام قد تغيّرت منذ إنشاء الرابط. يعيد استخدام
 * نفس منطق المقارنة الحقيقي في utils/engineVersionNotice.js (لا نسخة مصطنعة).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const getSharedStudyMock = vi.fn();
const recordShareViewMock = vi.fn();

vi.mock('../../services/ShareService.js', () => ({
    getSharedStudy: (...a) => getSharedStudyMock(...a),
    recordShareView: (...a) => recordShareViewMock(...a),
}));
vi.mock('../../services/InternalAIGenerator.js', () => ({
    generateExecutiveSummary: vi.fn(() => 'ملخص تنفيذي تجريبي.'),
}));
// ENGINE_VERSION الحالي ثابت هنا بمعزل عن قيمته الفعلية في engine.js — نفس نمط
// projectOverviewView.engineVersionNotice.test.js: الاختبار يفحص منطق المقارنة
// نفسه لا رقم النسخة بعينه.
vi.mock('../../core/engine.js', () => ({
    calculateStudy: vi.fn(() => ({ indicators: {} })),
    ENGINE_VERSION: 'v-current',
}));

async function renderWith(meta) {
    getSharedStudyMock.mockResolvedValue({
        title: 'مشروعي', sector: 'fnb', permission: 'view',
        data: { projectInfo: { name: 'مشروعي' }, engineResults: {}, _meta: meta },
    });
    const { ShareView } = await import('../ShareView.js');
    const view = new ShareView('root', {}, null);
    await view.render('tok-abc');
    return document.getElementById('root').innerHTML;
}

describe('ShareView — تنبيه تغيّر إصدار المحرك (أهم سطح: رابط عام بلا وصول لصفحة الخلاصة)', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="root"></div>';
        getSharedStudyMock.mockReset();
        recordShareViewMock.mockReset();
    });

    it('لا بانر حين تطابق البصمة المحفوظة الإصدار الحالي', async () => {
        const html = await renderWith({ engineVersion: 'v-current' });
        expect(html).not.toContain('engine-version-notice');
    });

    it('لا بانر حين لا توجد بصمة محفوظة أصلاً (رابط أُنشئ قبل هذه الميزة)', async () => {
        const html = await renderWith(undefined);
        expect(html).not.toContain('engine-version-notice');
    });

    it('يعرض بانراً صريحاً حين تختلف البصمة المحفوظة عن الإصدار الحالي', async () => {
        const html = await renderWith({ engineVersion: 'v-old' });
        expect(html).toContain('engine-version-notice');
        expect(html).toContain('تحديث معادلات المحرك المالي');
    });
});
