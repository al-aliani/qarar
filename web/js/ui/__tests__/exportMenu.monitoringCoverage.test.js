/**
 * @vitest-environment jsdom
 *
 * سد فجوة مراقبة الدفع/التصدير (2026-08-29): ستة مواضع في ExportMenu.js كانت تبتلع
 * فشلاً حقيقياً — بعضها بلا حتى toast — بلا أي أثر يصل لمراقبة الإنتاج (Sentry).
 * تصدير فاشل صامت لعميل دافع لا يراه أحد. هذا الملف يثبّت وصول
 * monitoring.captureException لكل موضع، مع بقاء السلوك الظاهر للمستخدم
 * (toast/استمرار العملية) كما كان تماماً قبل الإصلاح.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEmptyStudy } from '../../core/schema.js';
import { ExportMenu } from '../ExportMenu.js';

const captureExceptionMock = vi.fn();
vi.mock('../../utils/monitoring.js', () => ({
    monitoring: { captureException: (...a) => captureExceptionMock(...a), captureMessage: vi.fn() },
}));

const hasActivePaymentMock = vi.fn(async () => true);
vi.mock('../../services/PaymentService.js', () => ({
    hasActivePayment: (...a) => hasActivePaymentMock(...a),
    startCheckout: vi.fn(async () => ({ ok: false, error: 'not used in this test' })),
}));

const calculateStudyMock = vi.fn();
vi.mock('../../core/engine.js', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, calculateStudy: (...a) => calculateStudyMock(...a) };
});

const runQAChecksMock = vi.fn();
vi.mock('../../utils/qaChecks.js', () => ({
    runQAChecks: (...a) => runQAChecksMock(...a),
}));

const renderReviewStatusBadgeMock = vi.fn();
vi.mock('../components/ReviewStatusBadge.js', () => ({
    renderReviewStatusBadge: (...a) => renderReviewStatusBadgeMock(...a),
}));

const generateExecutiveSummaryMock = vi.fn();
vi.mock('../../services/AIConnector.js', () => ({
    AIConnector: class {
        generateExecutiveSummary(...a) { return generateExecutiveSummaryMock(...a); }
        generateMarketAnalysisText() { return Promise.resolve(''); }
        generateRisksForReport() { return Promise.resolve([]); }
    },
    generatePitchScript: vi.fn(),
}));

const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
vi.mock('../../utils/toast.js', () => ({
    toast: {
        success: (...a) => toastSuccessMock(...a),
        error: (...a) => toastErrorMock(...a),
        warning: vi.fn(),
        info: vi.fn(),
    },
}));

function fakeStore(state) {
    return { getState: () => state, update: vi.fn(), updateSectionInMemory: vi.fn(), notify: vi.fn() };
}

describe('ExportMenu — تغطية المراقبة عند فشل صامت سابقاً (بلوكر التصدير الصامت، 2026-08-29)', () => {
    beforeEach(() => {
        document.body.innerHTML = `<div id="exportMenuOverlay"></div>`;
        captureExceptionMock.mockClear();
        hasActivePaymentMock.mockReset().mockResolvedValue(true);
        calculateStudyMock.mockReset().mockReturnValue({});
        runQAChecksMock.mockReset().mockResolvedValue({ hardErrors: [], softWarnings: [], validationErrors: [], validationWarnings: [] });
        renderReviewStatusBadgeMock.mockReset().mockResolvedValue('<span>ok</span>');
        generateExecutiveSummaryMock.mockReset().mockResolvedValue('ملخص تجريبي');
        toastSuccessMock.mockClear();
        toastErrorMock.mockClear();
        global.URL.createObjectURL = vi.fn(() => 'blob:mock');
        global.URL.revokeObjectURL = vi.fn();
    });

    it('الموضع 1 — فشل حساب النموذج داخل open() يُبلَّغ للمراقبة، والقائمة تُفتح رغم ذلك (كانت تُبتلع كلياً بلا أي أثر)', async () => {
        calculateStudyMock.mockImplementation(() => { throw new Error('engine boom — open()'); });
        const study = createEmptyStudy();
        study.projectInfo.id = 'study-1';
        const menu = new ExportMenu('exportMenuOverlay', fakeStore(study));

        await menu.open();

        expect(captureExceptionMock).toHaveBeenCalledTimes(1);
        const [err, ctx] = captureExceptionMock.mock.calls[0];
        expect(err.message).toBe('engine boom — open()');
        expect(ctx).toEqual({ source: 'ExportMenu.open', studyId: 'study-1' });
        // السلوك الظاهر: القائمة استمرت بالفتح رغم فشل المحرك — لا كسر.
        expect(menu.overlay.classList.contains('is-open')).toBe(true);
    });

    it('الموضع 2 — فشل جلب شارة حالة المراجعة يُبلَّغ للمراقبة، وبقية القائمة لا تتوقف (كما ينص التعليق الأصلي)', async () => {
        renderReviewStatusBadgeMock.mockRejectedValue(new Error('badge network fail'));
        const study = createEmptyStudy();
        study.projectInfo.id = 'study-2';
        const menu = new ExportMenu('exportMenuOverlay', fakeStore(study));

        await menu.open();

        expect(captureExceptionMock).toHaveBeenCalledTimes(1);
        const [err, ctx] = captureExceptionMock.mock.calls[0];
        expect(err.message).toBe('badge network fail');
        expect(ctx).toEqual({ source: 'ExportMenu.open', studyId: 'study-2' });
        // السلوك الظاهر: القائمة استمرت بالفتح، والشارة بقيت بلا محتوى بدل كسر الصفحة.
        expect(menu.overlay.classList.contains('is-open')).toBe(true);
        expect(document.getElementById('export-review-status-badge')).toBeTruthy();
    });

    it('الموضع 3 — فشل توليد النص التنفيذي تلقائياً يُبلَّغ للمراقبة، ونفس رسالة toast.error السابقة تبقى كما هي', async () => {
        generateExecutiveSummaryMock.mockRejectedValue(new Error('ai endpoint down'));
        const study = createEmptyStudy();
        study.projectInfo.id = 'study-3';
        const menu = new ExportMenu('exportMenuOverlay', fakeStore(study));
        await menu.open();

        document.getElementById('btnExportAutoGenerateText').click();
        await new Promise((r) => setTimeout(r, 0));
        await new Promise((r) => setTimeout(r, 0));
        await new Promise((r) => setTimeout(r, 0));

        expect(captureExceptionMock).toHaveBeenCalledTimes(1);
        const [err, ctx] = captureExceptionMock.mock.calls[0];
        expect(err.message).toBe('ai endpoint down');
        expect(ctx).toEqual({ source: 'ExportMenu.autoGenerateText', studyId: 'study-3' });
        expect(toastErrorMock).toHaveBeenCalledWith('فشل التوليد: ai endpoint down');
    });

    it('الموضع 4 — فشل حساب النموذج داخل handleExport() يُبلَّغ للمراقبة، وتصدير JSON (لا يحتاج results) يكتمل بنجاح رغم ذلك', async () => {
        calculateStudyMock.mockImplementation(() => { throw new Error('engine boom — handleExport'); });
        const study = createEmptyStudy();
        study.projectInfo.id = 'study-4';
        const menu = new ExportMenu('exportMenuOverlay', fakeStore(study));

        await menu.handleExport('json', document.createElement('button'));

        expect(captureExceptionMock).toHaveBeenCalledTimes(1);
        const [err, ctx] = captureExceptionMock.mock.calls[0];
        expect(err.message).toBe('engine boom — handleExport');
        expect(ctx).toEqual({ source: 'ExportMenu.handleExport', type: 'json', studyId: 'study-4' });
        // السلوك الظاهر: تصدير JSON نجح رغم فشل المحرك (لا يعتمد على results أصلاً).
        expect(toastSuccessMock).toHaveBeenCalledWith(expect.stringContaining('تم تنزيل ملف المشروع'));
    });

    it('الموضع 5 — فشل فحص بوابة الجودة يُبلَّغ للمراقبة، والتصدير يستمر متجاوزاً البوابة (نفس سلوك console.warn السابق)', async () => {
        runQAChecksMock.mockRejectedValue(new Error('qa gate crashed'));
        const study = createEmptyStudy();
        study.projectInfo.id = 'study-5';
        const menu = new ExportMenu('exportMenuOverlay', fakeStore(study));
        const generateSpy = vi.spyOn(menu.pdfGenerator, 'generate').mockResolvedValue('test.pdf');

        await menu.handleExport('pdf', document.createElement('button'));

        expect(captureExceptionMock).toHaveBeenCalledTimes(1);
        const [err, ctx] = captureExceptionMock.mock.calls[0];
        expect(err.message).toBe('qa gate crashed');
        expect(ctx).toEqual({ source: 'ExportMenu.handleExport.qaGate', type: 'pdf' });
        // السلوك الظاهر: التصدير أُكمل فعلياً (لم تُفتح بوابة الجودة لأن qa=null).
        expect(generateSpy).toHaveBeenCalled();
        expect(toastSuccessMock).toHaveBeenCalled();
    });

    it('الموضع 6 — فشل عام أثناء توليد الصيغة (البوابة الجامعة لكل الصيغ) يُبلَّغ للمراقبة، ونفس رسالة toast.error السابقة تبقى كما هي', async () => {
        const study = createEmptyStudy();
        study.projectInfo.id = 'study-6';
        const menu = new ExportMenu('exportMenuOverlay', fakeStore(study));
        vi.spyOn(menu.pdfGenerator, 'generate').mockRejectedValue(new Error('pdf render crashed'));

        await menu.handleExport('pdf', document.createElement('button'));

        expect(captureExceptionMock).toHaveBeenCalledTimes(1);
        const [err, ctx] = captureExceptionMock.mock.calls[0];
        expect(err.message).toBe('pdf render crashed');
        expect(ctx).toEqual({ source: 'ExportMenu.handleExport', type: 'pdf', studyId: 'study-6' });
        // السلوك الظاهر: نفس رسالة toast.error العامة السابقة، بلا أي تغيير.
        expect(toastErrorMock).toHaveBeenCalledWith('حدث خطأ أثناء التصدير. إن استمر تحقق من اكتمال البيانات.');
    });
});
