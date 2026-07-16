import { describe, it, expect, vi, beforeEach } from 'vitest';

const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
};
const fromMock = vi.fn(() => chain);

vi.mock('../../../supabaseClient.js', () => ({
    getSupabaseClient: vi.fn(async () => ({ ok: true, supabase: { from: fromMock } })),
    getAuthUser: vi.fn(async () => ({ user: null })),
}));

import { AuthGuard } from '../AuthGuard.js';

/**
 * isAdmin() (2026-07-16) — نفس بنية اختبار isReviewer() المفقودة أصلاً؛ هذا
 * أول اختبار من نوعه للمنهج (استعلام Supabase مخزَّن مؤقتاً لهوية المستخدم).
 */
describe('AuthGuard.isAdmin', () => {
    beforeEach(() => {
        chain.select.mockReturnThis();
        chain.eq.mockReturnThis();
        fromMock.mockClear();
        AuthGuard._adminCache = null;
        AuthGuard.currentUser = null;
    });

    it('بلا مستخدم حالي ⇒ false بلا استعلام', async () => {
        expect(await AuthGuard.isAdmin()).toBe(false);
        expect(fromMock).not.toHaveBeenCalled();
    });

    it('مستخدم غير مُدرَج بجدول admins ⇒ false', async () => {
        AuthGuard.currentUser = { id: 'u1' };
        chain.maybeSingle.mockResolvedValue({ data: null, error: null });
        expect(await AuthGuard.isAdmin()).toBe(false);
        expect(fromMock).toHaveBeenCalledWith('admins');
    });

    it('مستخدم مُدرَج بجدول admins ⇒ true', async () => {
        AuthGuard.currentUser = { id: 'u2' };
        chain.maybeSingle.mockResolvedValue({ data: { id: 'u2' }, error: null });
        expect(await AuthGuard.isAdmin()).toBe(true);
    });

    it('نتيجة مخزَّنة مؤقتاً لنفس المستخدم — لا استعلام ثانٍ', async () => {
        AuthGuard.currentUser = { id: 'u3' };
        chain.maybeSingle.mockResolvedValue({ data: { id: 'u3' }, error: null });
        expect(await AuthGuard.isAdmin()).toBe(true);
        fromMock.mockClear();
        expect(await AuthGuard.isAdmin()).toBe(true);
        expect(fromMock).not.toHaveBeenCalled();
    });

    it('خطأ الاستعلام ⇒ false (فشل آمن)', async () => {
        AuthGuard.currentUser = { id: 'u4' };
        chain.maybeSingle.mockResolvedValue({ data: null, error: { message: 'network' } });
        expect(await AuthGuard.isAdmin()).toBe(false);
    });
});
