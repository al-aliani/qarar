/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../middleware/AuthGuard.js', () => ({ AuthGuard: { isAdmin: vi.fn() } }));
vi.mock('../../utils/toast.js', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('../../services/ReviewsService.js', () => ({}));
vi.mock('../../services/TicketService.js', () => ({ getOpenTicketsCount: vi.fn(async () => 0) }));
vi.mock('apexcharts', () => ({ default: class { destroy() {} render() { return Promise.resolve(); } } }));
vi.mock('sweetalert2', () => ({ default: { fire: vi.fn() } }));
vi.mock('../../services/AdminService.js', () => ({
    getEventsStats: vi.fn(),
    getOverview: vi.fn(),
    getProductFunnelStats: vi.fn(),
    getRevenueStats: vi.fn(),
    getStudiesStats: vi.fn(),
    getUsersStats: vi.fn(),
}));

const { AdminDashboardView } = await import('../AdminDashboardView.js');
const AdminService = await import('../../services/AdminService.js');

describe('AdminDashboardView — التشغيل والتقارير', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="admin"></div>';
        AdminService.getEventsStats.mockResolvedValue({ ok: true, data: { daily: [{ day: '2026-07-21', count: 2 }], by_prop: [{ value: 'wizard', count: 2 }], totals_by_event: [{ event_name: 'error', count: 2 }] } });
        AdminService.getOverview.mockResolvedValue({ ok: true, data: { total_studies: 10, total_users: 20, total_revenue_sar: 1000, pending_reviews: 0, active_shares: 2 } });
        AdminService.getProductFunnelStats.mockResolvedValue({ ok: true, data: { paid_users: 2, free_users: 18, paid_orders: 3, payment_errors: 1, avg_completion_minutes: 20, new_studies: 4 } });
        AdminService.getRevenueStats.mockResolvedValue({ ok: true, data: { avg_order_value_sar: 333, by_tier: [], by_provider: [], by_status: [], daily_revenue: [] } });
        AdminService.getStudiesStats.mockResolvedValue({ ok: true, data: { daily_created: [], by_status: [], by_sector: [] } });
        AdminService.getUsersStats.mockResolvedValue({ ok: true, data: { daily_signups: [], by_tier: [] } });
    });

    it('يعرض معدل الأخطاء والمسارات المتأثرة', async () => {
        const view = new AdminDashboardView('admin');
        const content = document.getElementById('admin');
        await view._renderReliabilityTab(content);

        expect(content.textContent).toContain('معدل الخطأ');
        expect(content.textContent).toContain('المسارات المتأثرة');
        expect(content.textContent).toContain('wizard');
        expect(content.querySelector('#chartReliabilityErrors')).not.toBeNull();
    });

    it('ينشئ تقريراً تنفيذياً مع إجراءات التنزيل والنسخ', async () => {
        const view = new AdminDashboardView('admin');
        const content = document.getElementById('admin');
        await view._renderReportsTab(content);

        expect(content.textContent).toContain('لقطة تنفيذية قابلة للمشاركة');
        expect(content.querySelector('#btnDownloadAdminSnapshot')).not.toBeNull();
        expect(content.querySelector('#btnCopyAdminSnapshot')).not.toBeNull();
        expect(content.textContent).toContain('أخطاء الدفع');
    });
});
