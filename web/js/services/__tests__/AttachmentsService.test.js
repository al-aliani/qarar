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

// تدقيق 2026-08-27: uploadAttachment صار يفحص البايتات الأولى الفعلية مقابل
// توقيع الصيغة المعلنة (validateFileSignature) — File وهمي بلا محتوى حقيقي
// (كائن {name,size} خام) كان يكسر هذا الفحص. الآن يُبنى File حقيقي بمحتوى
// يحمل توقيع الصيغة الصحيح افتراضياً، مع إمكانية تمرير header مخصَّص لاختبار
// الرفض (توقيع خاطئ/خطر).
const VALID_HEADERS = {
    pdf: [0x25, 0x50, 0x44, 0x46],
    png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    jpg: [0xff, 0xd8, 0xff],
    jpeg: [0xff, 0xd8, 0xff],
    webp: [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50],
    docx: [0x50, 0x4b, 0x03, 0x04],
    xlsx: [0x50, 0x4b, 0x03, 0x04],
};

function fakeFile(name, size = 1024, headerBytes) {
    const ext = /\.([a-zA-Z0-9]+)$/.exec(name)?.[1]?.toLowerCase() || '';
    const header = headerBytes ?? VALID_HEADERS[ext] ?? [];
    const bytes = new Uint8Array(Math.max(size, header.length));
    bytes.set(header, 0);
    return new File([bytes], name);
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

    it('ملف تنفيذي (MZ) بامتداد ".pdf" ⇒ يُرفض بمحتوى لا اسم — لا يصل التخزين', async () => {
        const { uploadAttachment } = await import('../AttachmentsService.js');
        const r = await uploadAttachment('study-1', fakeFile('invoice.pdf', 1024, [0x4d, 0x5a]));
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/تنفيذي|سكربت/);
        expect(fromMock).not.toHaveBeenCalled();
    });

    it('ملف نصي عادي بامتداد ".xlsx" (توقيع لا يطابق ZIP) ⇒ يُرفض', async () => {
        const { uploadAttachment } = await import('../AttachmentsService.js');
        const r = await uploadAttachment('study-1', fakeFile('sheet.xlsx', 1024, [0x68, 0x65, 0x6c, 0x6c, 0x6f]));
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/لا يطابق امتداده/);
        expect(fromMock).not.toHaveBeenCalled();
    });

    it('ملف PNG حقيقي بامتداد ".png" ⇒ يمر بلا مشكلة', async () => {
        const { uploadAttachment } = await import('../AttachmentsService.js');
        const r = await uploadAttachment('study-1', fakeFile('site.png'));
        expect(r.ok).toBe(true);
    });

    it('ملف CSV (بلا بصمة ثابتة) بمحتوى نصي عادي ⇒ يمر (لا فحص إيجابي لصيغ نصية)', async () => {
        const { uploadAttachment } = await import('../AttachmentsService.js');
        const r = await uploadAttachment('study-1', fakeFile('data.csv', 1024, [0x61, 0x2c, 0x62, 0x0a])); // "a,b\n"
        expect(r.ok).toBe(true);
    });

    it('ملف CSV يحمل توقيع ELF تنفيذياً ⇒ يُرفض رغم كونه صيغة نصية بلا فحص إيجابي', async () => {
        const { uploadAttachment } = await import('../AttachmentsService.js');
        const r = await uploadAttachment('study-1', fakeFile('data.csv', 1024, [0x7f, 0x45, 0x4c, 0x46]));
        expect(r.ok).toBe(false);
        expect(fromMock).not.toHaveBeenCalled();
    });
});

describe('AttachmentsService — validateFileSignature (مباشرة)', () => {
    it('كل صيغة بتوقيعها الصحيح تجتاز الفحص', async () => {
        const { validateFileSignature } = await import('../AttachmentsService.js');
        for (const [ext, header] of Object.entries(VALID_HEADERS)) {
            const file = fakeFile(`x.${ext}`, 32, header);
            const r = await validateFileSignature(file, ext);
            expect(r.ok, `${ext} كان يجب أن يجتاز`).toBe(true);
        }
    });

    it('[إثبات الحارس] بلا فحص التوقيع، ملف MZ بامتداد pdf كان سيمر كملف عادي', async () => {
        // يحاكي غياب الفحص: لا استدعاء لـvalidateFileSignature إطلاقاً — فقط فحص الامتداد.
        const ext = 'pdf';
        const ALLOWED_EXT = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'docx', 'xlsx', 'csv'];
        expect(ALLOWED_EXT.includes(ext)).toBe(true); // الفحص القديم الوحيد كان سيمرّره
        // بينما الفحص الجديد يرفضه فعلياً:
        const { validateFileSignature } = await import('../AttachmentsService.js');
        const r = await validateFileSignature(fakeFile('a.pdf', 32, [0x4d, 0x5a]), ext);
        expect(r.ok).toBe(false);
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
