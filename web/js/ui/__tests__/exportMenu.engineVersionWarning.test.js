/**
 * @vitest-environment jsdom
 *
 * بند 4 (بانر إصدار المحرك، 2026-08-29): من يُصدِّر تقريراً يستحق نفس التحذير الذي
 * يراه صاحب الدراسة في صفحة الخلاصة — قبل هذا الإصلاح لم يكن لهذه القائمة أي وعي
 * بإصدار المحرك إطلاقاً.
 *
 * كذلك يثبّت هذا الملف بلوكر «المحو الذاتي»: handleExport كان يستدعي
 * store.update('results', ...) العادية قبل أي تصدير فعلي — بصرف النظر عن الصيغة —
 * فيُفعِّل سلسلة الحفظ الكاملة ويُعيد وسم _meta.engineVersion. الآن يستخدم
 * updateSectionInMemory التي لا تلمس مسار الحفظ.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEmptyStudy } from '../../core/schema.js';
import { ExportMenu } from '../ExportMenu.js';

const hasActivePaymentMock = vi.fn(async () => true); // نتجاوز بوابة الترقية — ليست موضوع هذا الاختبار
vi.mock('../../services/PaymentService.js', () => ({
    hasActivePayment: (...a) => hasActivePaymentMock(...a),
    startCheckout: vi.fn(async () => ({ ok: false, error: 'not used in this test' })),
}));

const toastWarningMock = vi.fn();
vi.mock('../../utils/toast.js', () => ({
    toast: {
        warning: (...a) => toastWarningMock(...a),
        success: vi.fn(), error: vi.fn(), info: vi.fn(),
    },
}));

function studyWithMeta(meta) {
    const s = createEmptyStudy();
    s._meta = meta;
    return s;
}

function fakeStore(state) {
    return { getState: () => state, update: vi.fn(), updateSectionInMemory: vi.fn(), notify: vi.fn() };
}

describe('ExportMenu — تحذير إصدار المحرك قبل التصدير + بلا محو ذاتي لبصمته', () => {
    beforeEach(() => {
        document.body.innerHTML = `<div id="exportMenuOverlay"></div>`;
        toastWarningMock.mockReset();
        global.URL.createObjectURL = vi.fn(() => 'blob:mock');
        global.URL.revokeObjectURL = vi.fn();
    });

    it('بصمة محفوظة قديمة ⇒ toast.warning يُطلَق قبل تصدير صيغة تقرير فعلية (pdf)', async () => {
        const study = studyWithMeta({ engineVersion: 'an-old-version-that-will-never-match-current' });
        const menu = new ExportMenu('exportMenuOverlay', fakeStore(study));
        vi.spyOn(menu, '_qaGate').mockResolvedValue(true);
        vi.spyOn(menu.pdfGenerator, 'generate').mockResolvedValue('test.pdf');

        await menu.handleExport('pdf', document.createElement('button'));

        expect(toastWarningMock).toHaveBeenCalledTimes(1);
        expect(toastWarningMock.mock.calls[0][0]).toContain('تحديث معادلات المحرك المالي');
    });

    it('لا بصمة محفوظة أصلاً ⇒ لا تحذير', async () => {
        const study = studyWithMeta(undefined);
        const menu = new ExportMenu('exportMenuOverlay', fakeStore(study));
        vi.spyOn(menu, '_qaGate').mockResolvedValue(true);
        vi.spyOn(menu.pdfGenerator, 'generate').mockResolvedValue('test.pdf');

        await menu.handleExport('pdf', document.createElement('button'));

        expect(toastWarningMock).not.toHaveBeenCalled();
    });

    it('بصمة مطابقة للإصدار الحالي ⇒ لا تحذير', async () => {
        const { ENGINE_VERSION } = await import('../../core/engine.js');
        const study = studyWithMeta({ engineVersion: ENGINE_VERSION });
        const menu = new ExportMenu('exportMenuOverlay', fakeStore(study));
        vi.spyOn(menu, '_qaGate').mockResolvedValue(true);
        vi.spyOn(menu.pdfGenerator, 'generate').mockResolvedValue('test.pdf');

        await menu.handleExport('pdf', document.createElement('button'));

        expect(toastWarningMock).not.toHaveBeenCalled();
    });

    it('تصدير بيانات خام (json) يُستثنى من تحذير إصدار المحرك — ليس "تقريراً"', async () => {
        const study = studyWithMeta({ engineVersion: 'an-old-version-that-will-never-match-current' });
        const menu = new ExportMenu('exportMenuOverlay', fakeStore(study));
        const btn = document.createElement('button');
        btn.innerHTML = 'ملف المشروع (JSON)';

        await menu.handleExport('json', btn);

        expect(toastWarningMock).not.toHaveBeenCalled();
    });

    it('يحدّث نتائج المحرك عبر updateSectionInMemory لا update() — لا يُفعِّل سلسلة الحفظ لمجرّد الضغط على تصدير', async () => {
        const study = studyWithMeta(undefined);
        const store = fakeStore(study);
        const menu = new ExportMenu('exportMenuOverlay', store);
        vi.spyOn(menu, '_qaGate').mockResolvedValue(true);
        vi.spyOn(menu.pdfGenerator, 'generate').mockResolvedValue('test.pdf');

        await menu.handleExport('pdf', document.createElement('button'));

        expect(store.updateSectionInMemory).toHaveBeenCalledWith('results', expect.any(Object));
        expect(store.update).not.toHaveBeenCalled();
    });
});
