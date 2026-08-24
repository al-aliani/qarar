/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-18 — قسم "لمن ترسل هذه الدراسة؟" + "تصدير مباشر" الجديدان في
 * ShareStudyView.js. القيد الأمني/المالي الإلزامي المُكتشَف أثناء التخطيط: أي صيغة
 * ضمن PREMIUM_EXPORT_TYPES (بنك/Word/Excel/PowerPoint) يجب أن تمر ببوابة الدفع
 * (hasActivePayment + PaywallModal) قبل التوليد — بالضبط كما في ExportMenu.js —
 * وإلا يكون هذا القسم الجديد التفافاً فعلياً على بوابة الدفع. أهم اختبار هنا هو
 * إثبات أن التصدير المدفوع بلا اشتراك فعّال يفتح PaywallModal ولا يُصدِّر الملف.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const createShareLinkMock = vi.fn();
const listSharesMock = vi.fn();
const listStudyShareFeedbackMock = vi.fn();
const revokeShareMock = vi.fn();
const runFullModelMock = vi.fn(() => ({}));
const calculateProjectScoreMock = vi.fn(() => ({ recommendation: 'go' }));
const analyzePartnerNeedsMock = vi.fn(() => []);
const hasActivePaymentMock = vi.fn(async () => false);
const getCertificationForStudyMock = vi.fn(async () => null);
const submitTicketMock = vi.fn(async () => ({ ok: true, ticketId: 'ticket-1' }));
const generateHTMLMock = vi.fn(() => '<html>bank report</html>');
const downloadBlobMock = vi.fn();
const wordExportMock = vi.fn(async () => ({ success: true, fileName: 'study.docx', blob: new Blob() }));
const pptxExportMock = vi.fn(async () => ({ success: true, fileName: 'study.pptx' }));
const exportToExcelMock = vi.fn(async () => 'study.xlsx');

vi.mock('../../services/ShareService.js', () => ({
    createShareLink: (...a) => createShareLinkMock(...a),
    listShares: (...a) => listSharesMock(...a),
    listStudyShareFeedback: (...a) => listStudyShareFeedbackMock(...a),
    revokeShare: (...a) => revokeShareMock(...a),
}));

vi.mock('../ShareModal.js', () => ({
    buildShareUrl: (token) => `https://qarar.example/#/share/${token}`,
}));

vi.mock('../../../supabaseClient.js', () => ({
    getAuthUser: vi.fn(async () => ({ user: { id: 'u1' } })),
}));

vi.mock('../../core/engine.js', () => ({
    calculateStudy: (...a) => runFullModelMock(...a),
}));

vi.mock('../../core/scoring.js', () => ({
    calculateProjectScore: (...a) => calculateProjectScoreMock(...a),
}));

vi.mock('../../core/partnerNeeds.js', () => ({
    analyzePartnerNeeds: (...a) => analyzePartnerNeedsMock(...a),
}));

vi.mock('../../services/PaymentService.js', () => ({
    hasActivePayment: (...a) => hasActivePaymentMock(...a),
}));

vi.mock('../../services/ReviewerService.js', () => ({
    getCertificationForStudy: (...a) => getCertificationForStudyMock(...a),
}));

vi.mock('../../services/TicketService.js', () => ({
    submitTicket: (...a) => submitTicketMock(...a),
}));

vi.mock('../../../export/BankReportGenerator.js', () => ({
    BankReportGenerator: { generateHTML: (...a) => generateHTMLMock(...a) },
}));

vi.mock('../../../export/utils.js', () => ({
    downloadBlob: (...a) => downloadBlobMock(...a),
}));

vi.mock('../../../export/wordExporter.js', () => ({
    WordExporter: class { async export() { return wordExportMock(); } },
}));

vi.mock('../../../export/pptxExporter.js', () => ({
    PPTXExporter: class { async export() { return pptxExportMock(); } },
}));

vi.mock('../../../export/excelExporter.js', () => ({
    exportToExcel: (...a) => exportToExcelMock(...a),
}));

function fakeStore(projectInfo) {
    return { getState: () => ({ projectInfo }), get: () => ({ projectInfo }), update: vi.fn() };
}

async function flush() {
    await new Promise((r) => setTimeout(r, 0));
}

describe('ShareStudyView — قسم "لمن ترسل؟" (توجيه المتلقي)', () => {
    beforeEach(() => {
        listStudyShareFeedbackMock.mockResolvedValue([]);
        document.body.innerHTML = '';
        createShareLinkMock.mockReset();
        listSharesMock.mockReset().mockResolvedValue([]);
        revokeShareMock.mockReset();
        runFullModelMock.mockReset().mockReturnValue({});
        calculateProjectScoreMock.mockReset().mockReturnValue({ recommendation: 'go' });
        analyzePartnerNeedsMock.mockReset().mockReturnValue([]);
        hasActivePaymentMock.mockReset().mockResolvedValue(false);
        getCertificationForStudyMock.mockReset().mockResolvedValue(null);
        submitTicketMock.mockReset().mockResolvedValue({ ok: true, ticketId: 'ticket-1' });
        generateHTMLMock.mockReset().mockReturnValue('<html>bank report</html>');
        downloadBlobMock.mockReset();
        wordExportMock.mockReset().mockResolvedValue({ success: true, fileName: 'study.docx', blob: new Blob() });
        pptxExportMock.mockReset().mockResolvedValue({ success: true, fileName: 'study.pptx' });
        exportToExcelMock.mockReset().mockResolvedValue('study.xlsx');
        window.open = vi.fn(() => ({ document: { write: vi.fn(), close: vi.fn() } }));
        navigator.clipboard = { writeText: vi.fn().mockResolvedValue() };
    });

    it('زر "شريك" لا يظهر إطلاقاً لو partnerNeeds فارغة', async () => {
        const { ShareStudyView } = await import('../ShareStudyView.js');
        const view = new ShareStudyView('shareOverlay', fakeStore({ id: 'study-1' }));
        await view.render();

        expect(document.getElementById('btnRecipientPartner')).toBeNull();
    });

    it('زر "شريك" يظهر ويبني ملخصاً من الأسباب الفعلية لو partnerNeeds غير فارغة', async () => {
        analyzePartnerNeedsMock.mockReturnValue([
            { type: 'financial_equity', reason: 'الدراسة تحتاج تمويل بالأسهم' },
            { type: 'supplier', reason: 'تعتمد على مورّد واحد رئيسي' },
        ]);
        const { ShareStudyView } = await import('../ShareStudyView.js');
        const view = new ShareStudyView('shareOverlay', fakeStore({ id: 'study-1' }));
        await view.render();

        const btn = document.getElementById('btnRecipientPartner');
        expect(btn).toBeTruthy();
        btn.click();

        const area = document.getElementById('recipientActionArea');
        expect(area.textContent).toContain('الدراسة تحتاج تمويل بالأسهم');
        expect(area.textContent).toContain('تعتمد على مورّد واحد رئيسي');
    });

    it('توصية "nogo": تحذير غير حاجب يظهر عند مسار البنك، لا يمنع المتابعة', async () => {
        calculateProjectScoreMock.mockReturnValue({ recommendation: 'nogo' });
        const { ShareStudyView } = await import('../ShareStudyView.js');
        const view = new ShareStudyView('shareOverlay', fakeStore({ id: 'study-1' }));
        await view.render();

        document.getElementById('btnRecipientBank').click();

        const area = document.getElementById('recipientActionArea');
        expect(area.textContent).toContain('عدم المضي');
        // غير حاجب: الأزرار الفعلية ما زالت موجودة وقابلة للنقر
        expect(document.getElementById('btnExportBankDirect')).toBeTruthy();
    });

    it('توصية "go": لا تحذير جودة يظهر', async () => {
        calculateProjectScoreMock.mockReturnValue({ recommendation: 'go' });
        const { ShareStudyView } = await import('../ShareStudyView.js');
        const view = new ShareStudyView('shareOverlay', fakeStore({ id: 'study-1' }));
        await view.render();

        document.getElementById('btnRecipientBank').click();

        const area = document.getElementById('recipientActionArea');
        expect(area.querySelector('.alert--warning')).toBeNull();
    });

    it('مسار "بنك" → "اطلب تعريفاً بجهة تمويل" يستدعي submitTicket بـcategory=funding_introduction', async () => {
        const { ShareStudyView } = await import('../ShareStudyView.js');
        const view = new ShareStudyView('shareOverlay', fakeStore({ id: 'study-1', name: 'مقهى القمة' }));
        await view.render();

        document.getElementById('btnRecipientBank').click();
        document.getElementById('btnRequestFundingIntro').click();
        await flush();

        expect(submitTicketMock).toHaveBeenCalledWith(
            expect.objectContaining({ category: 'funding_introduction' })
        );
        expect(submitTicketMock.mock.calls[0][0].subject).toContain('مقهى القمة');
    });

    it('مسار "مستثمر" يوجّه لرابط المشاركة الحقيقي أعلاه، لا يُنشئ نظاماً موازياً', async () => {
        const { ShareStudyView } = await import('../ShareStudyView.js');
        const view = new ShareStudyView('shareOverlay', fakeStore({ id: 'study-1' }));
        await view.render();

        document.getElementById('btnRecipientInvestor').click();

        const area = document.getElementById('recipientActionArea');
        expect(area.textContent).toContain('رابط المشاركة');
        expect(createShareLinkMock).not.toHaveBeenCalled();
    });
});

describe('ShareStudyView — تصدير مباشر: بوابة الدفع إلزامية للصيغ المدفوعة', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        createShareLinkMock.mockReset();
        listSharesMock.mockReset().mockResolvedValue([]);
        revokeShareMock.mockReset();
        runFullModelMock.mockReset().mockReturnValue({});
        calculateProjectScoreMock.mockReset().mockReturnValue({ recommendation: 'go' });
        analyzePartnerNeedsMock.mockReset().mockReturnValue([]);
        hasActivePaymentMock.mockReset().mockResolvedValue(false);
        getCertificationForStudyMock.mockReset().mockResolvedValue(null);
        generateHTMLMock.mockReset().mockReturnValue('<html>bank report</html>');
        downloadBlobMock.mockReset();
        wordExportMock.mockReset().mockResolvedValue({ success: true, fileName: 'study.docx', blob: new Blob() });
        pptxExportMock.mockReset().mockResolvedValue({ success: true, fileName: 'study.pptx' });
        exportToExcelMock.mockReset().mockResolvedValue('study.xlsx');
        window.open = vi.fn(() => ({ document: { write: vi.fn(), close: vi.fn() } }));
    });

    it('⚠️ Word بلا دفع فعّال: يفتح PaywallModal، لا يستدعي WordExporter ولا downloadBlob إطلاقاً', async () => {
        hasActivePaymentMock.mockResolvedValue(false);
        const { ShareStudyView } = await import('../ShareStudyView.js');
        const view = new ShareStudyView('shareOverlay', fakeStore({ id: 'study-1' }));
        await view.render();

        document.querySelector('.btn-direct-export[data-format="word"]').click();
        await flush();

        expect(wordExportMock).not.toHaveBeenCalled();
        expect(downloadBlobMock).not.toHaveBeenCalled();
        const paywallOverlay = document.getElementById('paywallModalOverlay');
        expect(paywallOverlay?.classList.contains('is-open')).toBe(true);
        expect(paywallOverlay.textContent).toContain('الملف القابل للتعديل');
    });

    it('⚠️ Excel بلا دفع فعّال: يفتح PaywallModal، لا يستدعي exportToExcel', async () => {
        hasActivePaymentMock.mockResolvedValue(false);
        const { ShareStudyView } = await import('../ShareStudyView.js');
        const view = new ShareStudyView('shareOverlay', fakeStore({ id: 'study-1' }));
        await view.render();

        document.querySelector('.btn-direct-export[data-format="excel"]').click();
        await flush();

        expect(exportToExcelMock).not.toHaveBeenCalled();
        expect(document.getElementById('paywallModalOverlay')?.classList.contains('is-open')).toBe(true);
    });

    it('⚠️ PowerPoint بلا دفع فعّال: يفتح PaywallModal، لا يستدعي PPTXExporter', async () => {
        hasActivePaymentMock.mockResolvedValue(false);
        const { ShareStudyView } = await import('../ShareStudyView.js');
        const view = new ShareStudyView('shareOverlay', fakeStore({ id: 'study-1' }));
        await view.render();

        document.querySelector('.btn-direct-export[data-format="pptx"]').click();
        await flush();

        expect(pptxExportMock).not.toHaveBeenCalled();
        expect(document.getElementById('paywallModalOverlay')?.classList.contains('is-open')).toBe(true);
    });

    it('⚠️ تقرير البنك بلا دفع فعّال (عبر مسار "بنك"): يفتح PaywallModal، لا يستدعي BankReportGenerator', async () => {
        hasActivePaymentMock.mockResolvedValue(false);
        const { ShareStudyView } = await import('../ShareStudyView.js');
        const view = new ShareStudyView('shareOverlay', fakeStore({ id: 'study-1' }));
        await view.render();

        document.getElementById('btnRecipientBank').click();
        document.getElementById('btnExportBankDirect').click();
        await flush();

        expect(generateHTMLMock).not.toHaveBeenCalled();
        expect(document.getElementById('paywallModalOverlay')?.classList.contains('is-open')).toBe(true);
    });

    it('Word بدفع فعّال: يستدعي WordExporter.export ثم downloadBlob بالملف الفعلي، لا PaywallModal', async () => {
        hasActivePaymentMock.mockResolvedValue(true);
        const { ShareStudyView } = await import('../ShareStudyView.js');
        const view = new ShareStudyView('shareOverlay', fakeStore({ id: 'study-1' }));
        await view.render();

        document.querySelector('.btn-direct-export[data-format="word"]').click();
        await flush();

        expect(wordExportMock).toHaveBeenCalledTimes(1);
        expect(downloadBlobMock).toHaveBeenCalledWith(expect.any(Blob), 'study.docx');
        expect(document.getElementById('paywallModalOverlay')?.classList.contains('is-open')).not.toBe(true);
    });

    it('تقرير البنك بدفع فعّال: يجلب الاعتماد ثم يفتح نافذة جديدة بالتقرير', async () => {
        hasActivePaymentMock.mockResolvedValue(true);
        getCertificationForStudyMock.mockResolvedValue({ reviewerName: 'م. أحمد' });
        const { ShareStudyView } = await import('../ShareStudyView.js');
        const view = new ShareStudyView('shareOverlay', fakeStore({ id: 'study-1' }));
        await view.render();

        document.getElementById('btnRecipientBank').click();
        document.getElementById('btnExportBankDirect').click();
        await flush();

        expect(getCertificationForStudyMock).toHaveBeenCalledWith('study-1');
        expect(generateHTMLMock).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ certification: { reviewerName: 'م. أحمد' } })
        );
        expect(window.open).toHaveBeenCalled();
    });

    it('JSON: مجاني بلا أي بوابة — لا يستدعي hasActivePayment إطلاقاً، يُصدِّر مباشرة', async () => {
        const { ShareStudyView } = await import('../ShareStudyView.js');
        const view = new ShareStudyView('shareOverlay', fakeStore({ id: 'study-1', name: 'مشروعي' }));
        await view.render();
        hasActivePaymentMock.mockClear();

        document.querySelector('.btn-direct-export[data-format="json"]').click();
        await flush();

        expect(hasActivePaymentMock).not.toHaveBeenCalled();
        expect(downloadBlobMock).toHaveBeenCalledTimes(1);
        expect(downloadBlobMock.mock.calls[0][0]).toBeInstanceOf(Blob);
        expect(downloadBlobMock.mock.calls[0][1]).toContain('.json');
    });
});
