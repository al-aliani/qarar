/**
 * @vitest-environment jsdom
 *
 * تحقق من ربط واجهة المرفقات (رفع/سرد/تنزيل/حذف) في AppendicesView بخدمة
 * AttachmentsService — الخدمة نفسها (اتصال Supabase الحقيقي) مموَّهة هنا؛
 * منطقها الخاص مُختبر في web/js/services/__tests__/AttachmentsService.test.js.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const uploadAttachmentMock = vi.fn();
const listAttachmentsMock = vi.fn();
const getAttachmentSignedUrlMock = vi.fn();
const deleteAttachmentMock = vi.fn();

vi.mock('../../services/AttachmentsService.js', () => ({
    uploadAttachment: (...a) => uploadAttachmentMock(...a),
    listAttachments: (...a) => listAttachmentsMock(...a),
    getAttachmentSignedUrl: (...a) => getAttachmentSignedUrlMock(...a),
    deleteAttachment: (...a) => deleteAttachmentMock(...a),
    ATTACHMENTS_ALLOWED_EXT: ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'docx', 'xlsx', 'csv'],
}));

function fakeStore(initialState) {
    let state = initialState;
    return {
        getState: () => state,
        update: (section, value) => { state = { ...state, [section]: value }; },
    };
}

describe('AppendicesView — المرفقات', () => {
    let container;

    beforeEach(() => {
        document.body.innerHTML = `<div id="c"></div>`;
        container = document.getElementById('c');
        listAttachmentsMock.mockReset().mockResolvedValue({ ok: true, files: [] });
        uploadAttachmentMock.mockReset();
        getAttachmentSignedUrlMock.mockReset();
        deleteAttachmentMock.mockReset();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    async function flush() {
        await new Promise(r => setTimeout(r, 0));
        await new Promise(r => setTimeout(r, 0));
    }

    it('يعرض «لا مرفقات بعد» حين تكون القائمة فارغة', async () => {
        const { AppendicesView } = await import('../AppendicesView.js');
        const store = fakeStore({ projectInfo: { id: 'study-1' }, appendices: {} });
        const view = new AppendicesView('c', store);
        view.render(0);
        await flush();

        expect(listAttachmentsMock).toHaveBeenCalledWith('study-1');
        expect(container.querySelector('#appendices-attachments-list').textContent).toContain('لا مرفقات بعد');
    });

    it('يعرض ملفاً موجوداً باسمه وحجمه مع زري تنزيل وحذف', async () => {
        listAttachmentsMock.mockResolvedValue({
            ok: true,
            files: [{ name: 'عرض سعر.pdf', path: 'u1/study-1/1-عرض سعر.pdf', size: 2048, createdAt: '2026-07-01' }]
        });
        const { AppendicesView } = await import('../AppendicesView.js');
        const store = fakeStore({ projectInfo: { id: 'study-1' }, appendices: {} });
        const view = new AppendicesView('c', store);
        view.render(0);
        await flush();

        const item = container.querySelector('.attachments-list__item');
        expect(item).toBeTruthy();
        expect(item.textContent).toContain('عرض سعر.pdf');
        expect(container.querySelector('.btn-download-attachment')).toBeTruthy();
        expect(container.querySelector('.btn-delete-attachment')).toBeTruthy();
    });

    it('رفع ملف ناجح يستدعي uploadAttachment بمعرّف الدراسة والملف، ثم يعيد تحميل القائمة', async () => {
        uploadAttachmentMock.mockResolvedValue({ ok: true, name: 'a.pdf', path: 'u1/study-1/1-a.pdf' });
        const { AppendicesView } = await import('../AppendicesView.js');
        const store = fakeStore({ projectInfo: { id: 'study-1' }, appendices: {} });
        const view = new AppendicesView('c', store);
        view.render(0);
        await flush();

        const fileInput = container.querySelector('#appendices-file-input');
        const file = new File(['x'], 'a.pdf', { type: 'application/pdf' });
        Object.defineProperty(fileInput, 'files', { value: [file] });

        container.querySelector('#btn-upload-attachment').click();
        await flush();

        expect(uploadAttachmentMock).toHaveBeenCalledWith('study-1', file);
        // استدعاء ثانٍ لإعادة تحميل القائمة بعد نجاح الرفع
        expect(listAttachmentsMock).toHaveBeenCalledTimes(2);
    });

    it('رفع بلا اختيار ملف لا يستدعي uploadAttachment', async () => {
        const { AppendicesView } = await import('../AppendicesView.js');
        const store = fakeStore({ projectInfo: { id: 'study-1' }, appendices: {} });
        const view = new AppendicesView('c', store);
        view.render(0);
        await flush();

        container.querySelector('#btn-upload-attachment').click();
        await flush();

        expect(uploadAttachmentMock).not.toHaveBeenCalled();
    });

    it('حذف مرفق (بعد تأكيد) يستدعي deleteAttachment بالمسار الصحيح ويعيد تحميل القائمة', async () => {
        listAttachmentsMock.mockResolvedValue({
            ok: true,
            files: [{ name: 'a.pdf', path: 'u1/study-1/1-a.pdf', size: 10, createdAt: '' }]
        });
        deleteAttachmentMock.mockResolvedValue({ ok: true });
        vi.stubGlobal('confirm', vi.fn(() => true));

        const { AppendicesView } = await import('../AppendicesView.js');
        const store = fakeStore({ projectInfo: { id: 'study-1' }, appendices: {} });
        const view = new AppendicesView('c', store);
        view.render(0);
        await flush();

        container.querySelector('.btn-delete-attachment').click();
        await flush();

        expect(deleteAttachmentMock).toHaveBeenCalledWith('u1/study-1/1-a.pdf');
        expect(listAttachmentsMock).toHaveBeenCalledTimes(2);
        vi.unstubAllGlobals();
    });

    it('تنزيل مرفق يفتح الرابط الموقَّع في تبويب جديد', async () => {
        listAttachmentsMock.mockResolvedValue({
            ok: true,
            files: [{ name: 'a.pdf', path: 'u1/study-1/1-a.pdf', size: 10, createdAt: '' }]
        });
        getAttachmentSignedUrlMock.mockResolvedValue({ ok: true, url: 'https://signed.example/a.pdf' });
        const openSpy = vi.spyOn(window, 'open').mockImplementation(() => {});

        const { AppendicesView } = await import('../AppendicesView.js');
        const store = fakeStore({ projectInfo: { id: 'study-1' }, appendices: {} });
        const view = new AppendicesView('c', store);
        view.render(0);
        await flush();

        container.querySelector('.btn-download-attachment').click();
        await flush();

        expect(getAttachmentSignedUrlMock).toHaveBeenCalledWith('u1/study-1/1-a.pdf');
        expect(openSpy).toHaveBeenCalledWith('https://signed.example/a.pdf', '_blank', 'noopener');
    });
});
