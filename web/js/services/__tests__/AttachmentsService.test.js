import { describe, it, expect, vi, beforeEach } from 'vitest';

const getAuthUserMock = vi.fn(async () => ({ user: null, ok: false }));
const uploadMock = vi.fn(async () => ({ error: null }));
const listMock = vi.fn(async () => ({ data: [], error: null }));
const createSignedUrlMock = vi.fn(async () => ({ data: { signedUrl: 'https://signed.example/x' }, error: null }));
const removeMock = vi.fn(async () => ({ error: null }));
const fromMock = vi.fn(() => ({
    upload: uploadMock,
    list: listMock,
    createSignedUrl: createSignedUrlMock,
    remove: removeMock,
}));

vi.mock('../../../supabaseClient.js', () => ({
    getSupabaseClient: vi.fn(async () => ({ ok: true, supabase: { storage: { from: fromMock } } })),
    getAuthUser: (...a) => getAuthUserMock(...a),
}));

function fakeFile(name, size = 1024) {
    return { name, size };
}

describe('AttachmentsService — uploadAttachment', () => {
    beforeEach(() => {
        getAuthUserMock.mockReset().mockResolvedValue({ user: { id: 'user-1' }, ok: true });
        uploadMock.mockReset().mockResolvedValue({ error: null });
        fromMock.mockClear();
    });

    it('بلا studyId ⇒ خطأ فوري بلا أي اتصال', async () => {
        const { uploadAttachment } = await import('../AttachmentsService.js');
        const r = await uploadAttachment(null, fakeFile('a.pdf'));
        expect(r.ok).toBe(false);
        expect(fromMock).not.toHaveBeenCalled();
    });

    it('بلا ملف ⇒ خطأ فوري', async () => {
        const { uploadAttachment } = await import('../AttachmentsService.js');
        const r = await uploadAttachment('study-1', null);
        expect(r.ok).toBe(false);
    });

    it('ملف أكبر من 10 ميجابايت ⇒ يُرفض قبل أي اتصال', async () => {
        const { uploadAttachment } = await import('../AttachmentsService.js');
        const r = await uploadAttachment('study-1', fakeFile('big.pdf', 11 * 1024 * 1024));
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/10 ميجابايت/);
        expect(fromMock).not.toHaveBeenCalled();
    });

    it('امتداد غير مدعوم (exe) ⇒ يُرفض قبل أي اتصال', async () => {
        const { uploadAttachment } = await import('../AttachmentsService.js');
        const r = await uploadAttachment('study-1', fakeFile('virus.exe'));
        expect(r.ok).toBe(false);
        expect(fromMock).not.toHaveBeenCalled();
    });

    it('زائر غير مسجَّل ⇒ خطأ صريح يطلب تسجيل الدخول', async () => {
        getAuthUserMock.mockResolvedValue({ user: null, ok: false });
        const { uploadAttachment } = await import('../AttachmentsService.js');
        const r = await uploadAttachment('study-1', fakeFile('a.pdf'));
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/تسجيل الدخول/);
        expect(fromMock).not.toHaveBeenCalled();
    });

    it('رفع ناجح ⇒ مسار يبدأ بمعرّف المستخدم ثم معرّف الدراسة (مطابق لسياسات RLS)', async () => {
        const { uploadAttachment } = await import('../AttachmentsService.js');
        const r = await uploadAttachment('study-1', fakeFile('عرض سعر.pdf'));
        expect(r.ok).toBe(true);
        expect(fromMock).toHaveBeenCalledWith('attachments');
        expect(r.path.startsWith('user-1/study-1/')).toBe(true);
        expect(uploadMock).toHaveBeenCalledWith(r.path, expect.anything(), expect.objectContaining({ upsert: false }));
    });

    it('bucket غير موجود ⇒ رسالة توجّه لتشغيل ترحيل SQL بدل خطأ تقني مبهم', async () => {
        uploadMock.mockResolvedValue({ error: { message: 'Bucket not found' } });
        const { uploadAttachment } = await import('../AttachmentsService.js');
        const r = await uploadAttachment('study-1', fakeFile('a.pdf'));
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/supabase_setup\.sql/);
    });
});

describe('AttachmentsService — listAttachments', () => {
    beforeEach(() => {
        getAuthUserMock.mockReset().mockResolvedValue({ user: { id: 'user-1' }, ok: true });
        listMock.mockReset().mockResolvedValue({ data: [], error: null });
        fromMock.mockClear();
    });

    it('بلا studyId ⇒ قائمة فارغة بلا اتصال', async () => {
        const { listAttachments } = await import('../AttachmentsService.js');
        const r = await listAttachments(null);
        expect(r).toEqual({ ok: true, files: [] });
        expect(fromMock).not.toHaveBeenCalled();
    });

    it('زائر غير مسجَّل ⇒ قائمة فارغة بلا خطأ مزعج', async () => {
        getAuthUserMock.mockResolvedValue({ user: null, ok: false });
        const { listAttachments } = await import('../AttachmentsService.js');
        const r = await listAttachments('study-1');
        expect(r).toEqual({ ok: true, files: [] });
    });

    it('يحوّل نتائج storage.list إلى شكل موحّد (name/path/size) وينزع بادئة الطابع الزمني', async () => {
        listMock.mockResolvedValue({
            data: [{ name: '1699999999-quote.pdf', metadata: { size: 2048 }, created_at: '2026-07-01' }],
            error: null
        });
        const { listAttachments } = await import('../AttachmentsService.js');
        const r = await listAttachments('study-1');
        expect(r.ok).toBe(true);
        expect(r.files).toEqual([{
            name: 'quote.pdf',
            path: 'user-1/study-1/1699999999-quote.pdf',
            size: 2048,
            createdAt: '2026-07-01'
        }]);
    });

    it('bucket غير موجود ⇒ قائمة فارغة بلا خطأ (لا نزعج المستخدم قبل تشغيل الترحيل)', async () => {
        listMock.mockResolvedValue({ data: null, error: { message: 'Bucket not found' } });
        const { listAttachments } = await import('../AttachmentsService.js');
        const r = await listAttachments('study-1');
        expect(r).toEqual({ ok: true, files: [] });
    });
});

describe('AttachmentsService — deleteAttachment / getAttachmentSignedUrl', () => {
    beforeEach(() => {
        removeMock.mockReset().mockResolvedValue({ error: null });
        createSignedUrlMock.mockReset().mockResolvedValue({ data: { signedUrl: 'https://signed.example/x' }, error: null });
        fromMock.mockClear();
    });

    it('deleteAttachment بلا مسار ⇒ خطأ فوري', async () => {
        const { deleteAttachment } = await import('../AttachmentsService.js');
        const r = await deleteAttachment('');
        expect(r.ok).toBe(false);
        expect(fromMock).not.toHaveBeenCalled();
    });

    it('deleteAttachment ناجح يستدعي remove بالمسار الصحيح', async () => {
        const { deleteAttachment } = await import('../AttachmentsService.js');
        const r = await deleteAttachment('user-1/study-1/x.pdf');
        expect(r.ok).toBe(true);
        expect(removeMock).toHaveBeenCalledWith(['user-1/study-1/x.pdf']);
    });

    it('getAttachmentSignedUrl يعيد رابطاً موقّعاً صالحاً', async () => {
        const { getAttachmentSignedUrl } = await import('../AttachmentsService.js');
        const r = await getAttachmentSignedUrl('user-1/study-1/x.pdf');
        expect(r.ok).toBe(true);
        expect(r.url).toBe('https://signed.example/x');
        expect(createSignedUrlMock).toHaveBeenCalledWith('user-1/study-1/x.pdf', 3600);
    });
});
