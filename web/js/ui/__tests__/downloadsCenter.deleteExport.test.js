/**
 * @vitest-environment jsdom
 *
 * الخلل: لا صلاحية للعميل لحذف ملف تصدير واحد بعينه من مركز التنزيلات — لا
 * زر حذف في DownloadsCenterView.js أصلاً، ولا سياسة RLS DELETE على جدول
 * export_history أو bucket 'exports' (انظر migration جديدة
 * 20260827020000_export_history_delete_own.sql). هذا الاختبار يثبّت سلوك
 * الواجهة الجديد: زر حذف يستدعي كلا الحذفين (Storage + الصف) بعد تأكيد
 * المستخدم، ويعرض toast.error صريحاً بدل الصمت عند فشل أيهما.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const toastErrorMock = vi.fn();
const toastSuccessMock = vi.fn();
const removeMock = vi.fn();
const deleteEqMock = vi.fn();

const cloudItem = {
    id: 'exp-1', study_name: 'دراسة تجريبية', file_type: 'word',
    storage_path: 'u1/study.docx', created_at: '2026-08-01T00:00:00Z',
};

const mockSupabase = {
    from: (table) => {
        if (table === 'export_history') {
            return {
                select: () => ({ order: async () => ({ data: [cloudItem] }) }),
                delete: () => ({ eq: deleteEqMock }),
            };
        }
        return {};
    },
    storage: { from: () => ({ createSignedUrl: vi.fn(), remove: removeMock }) },
};

vi.mock('../../utils/toast.js', () => ({
    toast: { error: (...a) => toastErrorMock(...a), success: (...a) => toastSuccessMock(...a), info: vi.fn(), warning: vi.fn() },
}));

vi.mock('../../../supabaseClient.js', () => ({
    getAuthUser: vi.fn(async () => ({ user: { id: 'u1' } })),
    getSupabaseClient: vi.fn(async () => ({ ok: true, supabase: mockSupabase })),
}));

vi.mock('../../services/LocalExportHistory.js', () => ({
    listLocalExports: vi.fn(() => []),
}));

async function flush() {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
}

describe('DownloadsCenterView — حذف ملف تصدير واحد', () => {
    beforeEach(() => {
        document.body.innerHTML = '<main id="downloads"></main>';
        toastErrorMock.mockClear();
        toastSuccessMock.mockClear();
        removeMock.mockReset();
        deleteEqMock.mockReset();
        window.confirm = vi.fn(() => true);
    });

    it('زر الحذف موجود لكل عنصر سحابي له storage_path', async () => {
        removeMock.mockResolvedValue({ error: null });
        deleteEqMock.mockResolvedValue({ error: null });

        const { DownloadsCenterView } = await import('../DownloadsCenterView.js');
        const view = new DownloadsCenterView(document.getElementById('downloads'), {});
        await view.render();

        expect(document.querySelector('.dv-delete-item')).not.toBeNull();
    });

    it('يطلب تأكيداً ثم يحذف من Storage والجدول معاً، ويزيل البطاقة من الواجهة', async () => {
        removeMock.mockResolvedValue({ error: null });
        deleteEqMock.mockResolvedValue({ error: null });

        const { DownloadsCenterView } = await import('../DownloadsCenterView.js');
        const view = new DownloadsCenterView(document.getElementById('downloads'), {});
        await view.render();

        const btn = document.querySelector('.dv-delete-item');
        btn.click();
        await flush();

        expect(window.confirm).toHaveBeenCalledTimes(1);
        expect(removeMock).toHaveBeenCalledWith(['u1/study.docx']);
        expect(deleteEqMock).toHaveBeenCalledWith('id', 'exp-1');
        expect(document.querySelector('.dv-delete-item')).toBeNull();
        expect(toastSuccessMock).toHaveBeenCalledTimes(1);
        expect(toastErrorMock).not.toHaveBeenCalled();
    });

    it('لا يحذف شيئاً إذا رفض المستخدم التأكيد', async () => {
        window.confirm = vi.fn(() => false);

        const { DownloadsCenterView } = await import('../DownloadsCenterView.js');
        const view = new DownloadsCenterView(document.getElementById('downloads'), {});
        await view.render();

        document.querySelector('.dv-delete-item').click();
        await flush();

        expect(removeMock).not.toHaveBeenCalled();
        expect(deleteEqMock).not.toHaveBeenCalled();
        expect(document.querySelector('.dv-delete-item')).not.toBeNull();
    });

    it('عند فشل حذف Storage، لا يُحاوَل حذف صف export_history إطلاقاً (تجنّب سجل يتيم بلا ملف فعلي)', async () => {
        removeMock.mockResolvedValue({ error: { message: 'Object not found' } });
        deleteEqMock.mockResolvedValue({ error: null });

        const { DownloadsCenterView } = await import('../DownloadsCenterView.js');
        const view = new DownloadsCenterView(document.getElementById('downloads'), {});
        await view.render();

        document.querySelector('.dv-delete-item').click();
        await flush();

        expect(removeMock).toHaveBeenCalledTimes(1);
        expect(deleteEqMock).not.toHaveBeenCalled();
        expect(toastErrorMock).toHaveBeenCalledTimes(1);
    });

    it('[إثبات الحارس] فشل الحذف (مثلاً بلا سياسة RLS DELETE) يعرض toast.error صريحاً ويُبقي البطاقة', async () => {
        // يحاكي بالضبط العطل الأصلي: قبل إضافة سياسة RLS DELETE، كان استدعاء
        // .remove()/.delete() يفشل بصمت (RLS تمنع افتراضياً بلا سياسة مطابقة).
        removeMock.mockResolvedValue({ error: { message: 'new row violates row-level security policy' } });
        deleteEqMock.mockResolvedValue({ error: null });

        const { DownloadsCenterView } = await import('../DownloadsCenterView.js');
        const view = new DownloadsCenterView(document.getElementById('downloads'), {});
        await view.render();

        const btn = document.querySelector('.dv-delete-item');
        btn.click();
        await flush();

        expect(toastErrorMock).toHaveBeenCalledTimes(1);
        expect(toastErrorMock).toHaveBeenCalledWith('تعذّر حذف الملف — حاول مرة أخرى');
        expect(document.querySelector('.dv-delete-item')).not.toBeNull();
        expect(btn.disabled).toBe(false);
        expect(btn.textContent).toBe('حذف');
    });
});
