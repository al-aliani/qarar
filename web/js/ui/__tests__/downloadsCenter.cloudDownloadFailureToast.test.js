/**
 * @vitest-environment jsdom
 *
 * الخلل: فشل تنزيل ملف محفوظ سحابياً كان صامتاً تماماً — createSignedUrl تفشل
 * (bucket/RLS/شبكة/جلسة منتهية) فيُستخرَج `error` ولا يُستخدَم أبداً، بلا فرع
 * else وبلا toast، والزر يعود إلى "تنزيل" وكأن شيئاً لم يكن. انظر
 * SWEEP_CONFIRMED.md: "web/js/ui/DownloadsCenterView.js:118".
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const toastErrorMock = vi.fn();
const createSignedUrlMock = vi.fn();

const cloudItem = {
    id: '1', study_name: 'دراسة تجريبية', file_type: 'word',
    storage_path: 'u1/study.docx', created_at: '2026-08-01T00:00:00Z',
};

const mockSupabase = {
    from: (table) => {
        if (table === 'export_history') {
            return { select: () => ({ order: async () => ({ data: [cloudItem] }) }) };
        }
        return {};
    },
    storage: { from: () => ({ createSignedUrl: createSignedUrlMock }) },
};

vi.mock('../../utils/toast.js', () => ({
    toast: { error: (...a) => toastErrorMock(...a), success: vi.fn(), info: vi.fn(), warning: vi.fn() },
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
}

describe('DownloadsCenterView — فشل تنزيل ملف سحابي', () => {
    beforeEach(() => {
        document.body.innerHTML = '<main id="downloads"></main>';
        toastErrorMock.mockClear();
        createSignedUrlMock.mockReset();
        window.open = vi.fn();
    });

    it('يعرض toast.error صريحاً عند فشل createSignedUrl بدل الصمت', async () => {
        createSignedUrlMock.mockResolvedValue({ data: null, error: { message: 'Object not found' } });

        const { DownloadsCenterView } = await import('../DownloadsCenterView.js');
        const view = new DownloadsCenterView(document.getElementById('downloads'), {});
        await view.render();

        const btn = document.querySelector('.dv-download-item');
        expect(btn).not.toBeNull();
        btn.click();
        await flush();

        expect(window.open).not.toHaveBeenCalled();
        expect(toastErrorMock).toHaveBeenCalledTimes(1);
        expect(toastErrorMock).toHaveBeenCalledWith(
            'تعذّر تحضير رابط التنزيل — سجّل الدخول من جديد أو أعد التصدير من دراستك'
        );
        expect(btn.disabled).toBe(false);
        expect(btn.textContent).toBe('تنزيل');
    });

    it('ينجح التنزيل ويفتح الرابط عند نجاح createSignedUrl (لا رسالة خطأ)', async () => {
        createSignedUrlMock.mockResolvedValue({ data: { signedUrl: 'https://example.com/signed' }, error: null });

        const { DownloadsCenterView } = await import('../DownloadsCenterView.js');
        const view = new DownloadsCenterView(document.getElementById('downloads'), {});
        await view.render();

        const btn = document.querySelector('.dv-download-item');
        btn.click();
        await flush();

        expect(window.open).toHaveBeenCalledWith('https://example.com/signed', '_blank', 'noopener');
        expect(toastErrorMock).not.toHaveBeenCalled();
    });
});
