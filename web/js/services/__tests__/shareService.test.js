import { describe, it, expect, vi, beforeEach } from 'vitest';

const getAuthUserMock = vi.fn(async () => ({ user: null }));

const chain = {
    insert: vi.fn(),
    select: vi.fn(),
    single: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    update: vi.fn(),
};
const fromMock = vi.fn(() => chain);
const rpcChain = { single: vi.fn() };
const rpcMock = vi.fn(() => rpcChain);

vi.mock('../../../supabaseClient.js', () => ({
    getSupabaseClient: vi.fn(async () => ({
        ok: true,
        supabase: { from: fromMock, rpc: rpcMock },
    })),
    getAuthUser: (...a) => getAuthUserMock(...a),
}));

describe('createShareLink', () => {
    beforeEach(() => {
        getAuthUserMock.mockReset().mockResolvedValue({ user: { id: 'u1' } });
        chain.insert.mockReturnThis();
        chain.select.mockReturnThis();
        chain.single.mockResolvedValue({ data: { share_token: 'tok-123' }, error: null });
        fromMock.mockClear();
    });

    it('بلا studyId ⇒ خطأ فوراً بلا أي استعلام', async () => {
        const { createShareLink } = await import('../ShareService.js');
        const result = await createShareLink(null);
        expect(result.ok).toBe(false);
        expect(fromMock).not.toHaveBeenCalled();
    });

    it('بلا مستخدم مسجَّل ⇒ خطأ واضح', async () => {
        getAuthUserMock.mockResolvedValue({ user: null });
        const { createShareLink } = await import('../ShareService.js');
        const result = await createShareLink('study-1');
        expect(result.ok).toBe(false);
        expect(fromMock).not.toHaveBeenCalled();
    });

    it('نجاح: يُدرج صلاحية view ويُعيد shareToken', async () => {
        const { createShareLink } = await import('../ShareService.js');
        const result = await createShareLink('study-1');
        expect(fromMock).toHaveBeenCalledWith('study_shares');
        expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({ study_id: 'study-1', permission: 'view' }));
        expect(result.ok).toBe(true);
        expect(result.shareToken).toBe('tok-123');
    });

    it('فشل الإدراج ⇒ ok:false برسالة الخطأ', async () => {
        chain.single.mockResolvedValue({ data: null, error: { message: 'insert failed' } });
        const { createShareLink } = await import('../ShareService.js');
        const result = await createShareLink('study-1');
        expect(result.ok).toBe(false);
        expect(result.error).toBe('insert failed');
    });
});

describe('listShares', () => {
    beforeEach(() => {
        chain.select.mockReturnThis();
        chain.eq.mockReturnThis();
        chain.order.mockResolvedValue({
            data: [{ id: 's1', share_token: 'tok-1', created_at: '2026-07-14', expires_at: null, revoked: false }],
            error: null,
        });
        fromMock.mockClear();
    });

    it('بلا studyId ⇒ مصفوفة فارغة بلا استعلام', async () => {
        const { listShares } = await import('../ShareService.js');
        expect(await listShares(null)).toEqual([]);
        expect(fromMock).not.toHaveBeenCalled();
    });

    it('يُعيد الروابط محوَّلة لأسماء camelCase', async () => {
        const { listShares } = await import('../ShareService.js');
        const result = await listShares('study-1');
        expect(result).toEqual([{ id: 's1', shareToken: 'tok-1', createdAt: '2026-07-14', expiresAt: null, revoked: false }]);
    });

    it('خطأ الاستعلام ⇒ مصفوفة فارغة (فشل آمن)', async () => {
        chain.order.mockResolvedValue({ data: null, error: { message: 'network' } });
        const { listShares } = await import('../ShareService.js');
        expect(await listShares('study-1')).toEqual([]);
    });
});

describe('revokeShare', () => {
    beforeEach(() => {
        chain.update.mockReturnThis();
        chain.eq.mockResolvedValue({ error: null });
        fromMock.mockClear();
    });

    it('بلا shareId ⇒ خطأ فوراً', async () => {
        const { revokeShare } = await import('../ShareService.js');
        const result = await revokeShare(null);
        expect(result.ok).toBe(false);
        expect(fromMock).not.toHaveBeenCalled();
    });

    it('نجاح: يضبط revoked=true', async () => {
        const { revokeShare } = await import('../ShareService.js');
        const result = await revokeShare('share-1');
        expect(chain.update).toHaveBeenCalledWith({ revoked: true });
        expect(result.ok).toBe(true);
    });
});

describe('getSharedStudy', () => {
    beforeEach(() => {
        rpcChain.single.mockResolvedValue({
            data: { title: 'مشروعي', sector: 'مطاعم', data: { projectInfo: { name: 'مشروعي' } }, permission: 'view' },
            error: null,
        });
        rpcMock.mockClear();
    });

    it('بلا shareToken ⇒ null فوراً بلا استعلام', async () => {
        const { getSharedStudy } = await import('../ShareService.js');
        expect(await getSharedStudy(null)).toBeNull();
        expect(rpcMock).not.toHaveBeenCalled();
    });

    it('رمز صالح ⇒ يُعيد بيانات الدراسة المشتركة', async () => {
        const { getSharedStudy } = await import('../ShareService.js');
        const result = await getSharedStudy('tok-123');
        expect(rpcMock).toHaveBeenCalledWith('get_study_by_share_token', { p_token: 'tok-123' });
        expect(result.title).toBe('مشروعي');
        expect(result.permission).toBe('view');
    });

    it('رمز ملغى/منتهٍ (لا صف من RPC) ⇒ null', async () => {
        rpcChain.single.mockResolvedValue({ data: null, error: { message: 'no rows' } });
        const { getSharedStudy } = await import('../ShareService.js');
        expect(await getSharedStudy('tok-expired')).toBeNull();
    });
});
