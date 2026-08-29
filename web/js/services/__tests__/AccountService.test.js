/**
 * تنفيذ حذف الحساب (2026-08-29، تفويض مالك صريح: فترة سماح 7 أيام) — يثبت
 * [اختبار 3 المطلوب]: الإلغاء يمنع فعلياً معالجة الطلب لاحقاً — أي أن
 * cancelAccountDeletionRequest() يستهدف بالضبط الصف status='requested' لهذا
 * المستخدم (نفس الشرط الذي تستعلم عنه process-account-deletions)، فتحويله
 * إلى 'cancelled' يُخرِجه من نطاق أي استعلام مستقبلي بـ.eq('status','requested').
 * نفس نمط TicketService.test.js: موك supabaseClient.js (لا @supabase/supabase-js
 * نفسه) عبر chainOf قابلة للسلسلة.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const getAuthUserMock = vi.fn(async () => ({ user: null, ok: false }));
const fromMock = vi.fn();

vi.mock('../../../supabaseClient.js', () => ({
    getSupabaseClient: vi.fn(async () => ({ ok: true, supabase: { from: fromMock } })),
    getAuthUser: (...a) => getAuthUserMock(...a),
}));

function chainOf(result) {
    const obj = {
        select: vi.fn(() => obj),
        upsert: vi.fn(() => obj),
        update: vi.fn(() => obj),
        eq: vi.fn(() => obj),
        maybeSingle: vi.fn(async () => result),
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    };
    return obj;
}

beforeEach(() => {
    getAuthUserMock.mockReset().mockResolvedValue({ user: { id: 'u1' }, ok: true });
    fromMock.mockReset();
});

describe('requestAccountDeletion', () => {
    it('بلا مستخدم مسجَّل ⇒ خطأ واضح، لا يستدعي القاعدة', async () => {
        getAuthUserMock.mockResolvedValue({ user: null });
        const { requestAccountDeletion } = await import('../AccountService.js');
        const result = await requestAccountDeletion();
        expect(result.ok).toBe(false);
        expect(fromMock).not.toHaveBeenCalled();
    });

    it('نجاح: upsert بـstatus=requested وonConflict user_id,status', async () => {
        const chain = chainOf({ error: null });
        fromMock.mockImplementation(() => chain);
        const { requestAccountDeletion } = await import('../AccountService.js');
        const result = await requestAccountDeletion();
        expect(fromMock).toHaveBeenCalledWith('account_deletion_requests');
        expect(chain.upsert).toHaveBeenCalledWith({ user_id: 'u1', status: 'requested' }, { onConflict: 'user_id,status' });
        expect(result).toEqual({ ok: true });
    });
});

describe('getPendingAccountDeletionRequest', () => {
    it('بلا مستخدم مسجَّل ⇒ ok:false، لا يستدعي القاعدة', async () => {
        getAuthUserMock.mockResolvedValue({ user: null });
        const { getPendingAccountDeletionRequest } = await import('../AccountService.js');
        const result = await getPendingAccountDeletionRequest();
        expect(result.ok).toBe(false);
        expect(fromMock).not.toHaveBeenCalled();
    });

    it('يوجد طلب requested ⇒ يُعيده', async () => {
        const row = { id: 'req-1', created_at: '2026-08-20T00:00:00Z' };
        const chain = chainOf({ data: row, error: null });
        fromMock.mockImplementation(() => chain);
        const { getPendingAccountDeletionRequest } = await import('../AccountService.js');
        const result = await getPendingAccountDeletionRequest();

        expect(fromMock).toHaveBeenCalledWith('account_deletion_requests');
        expect(chain.eq).toHaveBeenCalledWith('user_id', 'u1');
        expect(chain.eq).toHaveBeenCalledWith('status', 'requested');
        expect(result).toEqual({ ok: true, request: row });
    });

    it('لا يوجد طلب معلَّق ⇒ request: null (لا خطأ)', async () => {
        const chain = chainOf({ data: null, error: null });
        fromMock.mockImplementation(() => chain);
        const { getPendingAccountDeletionRequest } = await import('../AccountService.js');
        const result = await getPendingAccountDeletionRequest();
        expect(result).toEqual({ ok: true, request: null });
    });

    it('خطأ استعلام ⇒ ok:false مع رسالة الخطأ', async () => {
        const chain = chainOf({ data: null, error: { message: 'boom' } });
        fromMock.mockImplementation(() => chain);
        const { getPendingAccountDeletionRequest } = await import('../AccountService.js');
        const result = await getPendingAccountDeletionRequest();
        expect(result).toEqual({ ok: false, error: 'boom' });
    });
});

describe('cancelAccountDeletionRequest — [اختبار 3] الإلغاء يمنع فعلياً المعالجة اللاحقة', () => {
    it('بلا مستخدم مسجَّل ⇒ خطأ واضح، لا يستدعي القاعدة', async () => {
        getAuthUserMock.mockResolvedValue({ user: null });
        const { cancelAccountDeletionRequest } = await import('../AccountService.js');
        const result = await cancelAccountDeletionRequest();
        expect(result.ok).toBe(false);
        expect(fromMock).not.toHaveBeenCalled();
    });

    it('نجاح: يحدّث status إلى cancelled مستهدفاً بالضبط user_id + status=requested الحاليَّين — نفس الشرط الذي تستعلم عنه process-account-deletions، فيخرج الصف من نطاقها فوراً', async () => {
        const chain = chainOf({ error: null });
        fromMock.mockImplementation(() => chain);
        const { cancelAccountDeletionRequest } = await import('../AccountService.js');
        const result = await cancelAccountDeletionRequest();

        expect(fromMock).toHaveBeenCalledWith('account_deletion_requests');
        expect(chain.update).toHaveBeenCalledWith({ status: 'cancelled' });
        expect(chain.eq).toHaveBeenCalledWith('user_id', 'u1');
        expect(chain.eq).toHaveBeenCalledWith('status', 'requested');
        expect(result).toEqual({ ok: true });
    });

    it('فشل التحديث (مثلاً RLS رفضته لأن الطلب لم يعد requested) ⇒ ok:false مع رسالة الخطأ', async () => {
        const chain = chainOf({ error: { message: 'update rejected' } });
        fromMock.mockImplementation(() => chain);
        const { cancelAccountDeletionRequest } = await import('../AccountService.js');
        const result = await cancelAccountDeletionRequest();
        expect(result).toEqual({ ok: false, error: 'update rejected' });
    });
});
