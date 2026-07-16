import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpcMock = vi.fn();

vi.mock('../../../supabaseClient.js', () => ({
    getSupabaseClient: vi.fn(async () => ({ ok: true, supabase: { rpc: rpcMock } })),
}));

describe('AdminService', () => {
    beforeEach(() => {
        rpcMock.mockReset().mockResolvedValue({ data: { total: 1 }, error: null });
    });

    it('getOverview يستدعي admin_overview_stats', async () => {
        const { getOverview } = await import('../AdminService.js');
        const result = await getOverview();
        expect(rpcMock).toHaveBeenCalledWith('admin_overview_stats', {});
        expect(result.ok).toBe(true);
        expect(result.data).toEqual({ total: 1 });
    });

    it('getStudiesStats يستدعي admin_studies_stats', async () => {
        const { getStudiesStats } = await import('../AdminService.js');
        await getStudiesStats();
        expect(rpcMock).toHaveBeenCalledWith('admin_studies_stats', {});
    });

    it('getUsersStats يستدعي admin_users_stats', async () => {
        const { getUsersStats } = await import('../AdminService.js');
        await getUsersStats();
        expect(rpcMock).toHaveBeenCalledWith('admin_users_stats', {});
    });

    it('getRevenueStats يستدعي admin_revenue_stats', async () => {
        const { getRevenueStats } = await import('../AdminService.js');
        await getRevenueStats();
        expect(rpcMock).toHaveBeenCalledWith('admin_revenue_stats', {});
    });

    it('getReviewerStats يستدعي admin_reviewer_stats', async () => {
        const { getReviewerStats } = await import('../AdminService.js');
        await getReviewerStats();
        expect(rpcMock).toHaveBeenCalledWith('admin_reviewer_stats', {});
    });

    it('getSharingStats يستدعي admin_sharing_stats', async () => {
        const { getSharingStats } = await import('../AdminService.js');
        await getSharingStats();
        expect(rpcMock).toHaveBeenCalledWith('admin_sharing_stats', {});
    });

    it('getEventsStats يمرّر الفلاتر بالاسم الصحيح', async () => {
        const { getEventsStats } = await import('../AdminService.js');
        await getEventsStats('wizard_step_view', 7, 'stepId');
        expect(rpcMock).toHaveBeenCalledWith('admin_events_stats', {
            event_name_filter: 'wizard_step_view',
            days: 7,
            group_by_prop_key: 'stepId',
        });
    });

    it('getEventsStats بلا وسائط ⇒ افتراضيات معقولة', async () => {
        const { getEventsStats } = await import('../AdminService.js');
        await getEventsStats();
        expect(rpcMock).toHaveBeenCalledWith('admin_events_stats', {
            event_name_filter: null,
            days: 30,
            group_by_prop_key: null,
        });
    });

    it('خطأ RPC (مثال: مستخدم غير أدمن) ⇒ ok:false برسالة الخطأ', async () => {
        rpcMock.mockResolvedValue({ data: null, error: { message: 'not authorized' } });
        const { getOverview } = await import('../AdminService.js');
        const result = await getOverview();
        expect(result.ok).toBe(false);
        expect(result.error).toBe('not authorized');
    });
});
