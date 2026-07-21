/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const isAdmin = vi.fn();

vi.mock('../../middleware/AuthGuard.js', () => ({ AuthGuard: { isAdmin } }));
vi.mock('../../utils/toast.js', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('../../services/ReviewsService.js', () => ({}));
vi.mock('../../services/TicketService.js', () => ({ getOpenTicketsCount: vi.fn(async () => 0) }));
vi.mock('apexcharts', () => ({ default: class { destroy() {} render() { return Promise.resolve(); } } }));
vi.mock('sweetalert2', () => ({ default: { fire: vi.fn() } }));
vi.mock('../../services/AdminService.js', () => ({
    getOverview: vi.fn(),
    getProductFunnelStats: vi.fn(),
    getRevenueStats: vi.fn(),
    getEventsStats: vi.fn(),
    getStudiesStats: vi.fn(),
    getUsersStats: vi.fn(),
}));

const { AdminDashboardView } = await import('../AdminDashboardView.js');
const AdminService = await import('../../services/AdminService.js');

describe('AdminDashboardView — مركز القرارات التنفيذي', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="admin"></div>';
        window.location.hash = '#/admin';
        isAdmin.mockReset();
        isAdmin.mockResolvedValue(true);
        AdminService.getOverview.mockResolvedValue({
            ok: true,
            data: {
                total_studies: 120,
                total_users: 80,
                total_revenue_sar: 9000,
                pending_reviews: 3,
                active_shares: 10,
            },
        });
        AdminService.getProductFunnelStats.mockResolvedValue({
            ok: true,
            data: { paid_users: 4, free_users: 76, new_studies: 20, paid_orders: 5, payment_errors: 2 },
        });
        AdminService.getRevenueStats.mockResolvedValue({ ok: true, data: { avg_order_value_sar: 1800 } });
        AdminService.getEventsStats.mockResolvedValue({ ok: true, data: { daily: [{ count: 2 }] } });
        AdminService.getStudiesStats.mockResolvedValue({ ok: true, data: { daily_created: [], by_status: [], by_sector: [] } });
        AdminService.getUsersStats.mockResolvedValue({ ok: true, data: { daily_signups: [], by_tier: [] } });
    });

    it('يعرض مؤشرات القرار والتنبيه المالي من البيانات الفعلية', async () => {
        await new AdminDashboardView('admin').render();

        const dashboard = document.getElementById('admin');
        expect(dashboard.querySelector('.admin-executive-hero')).not.toBeNull();
        expect(dashboard.textContent).toContain('مركز القرارات التنفيذي');
        expect(dashboard.textContent).toContain('أخطاء الدفع');
        expect(dashboard.textContent).toContain('أولوية مالية');
        expect(AdminService.getEventsStats).toHaveBeenCalledWith('payment_error', 30, null);
        expect(AdminService.getEventsStats).toHaveBeenCalledWith(null, 30, null);
        expect(AdminService.getProductFunnelStats).toHaveBeenCalledWith(30);
        expect(dashboard.querySelectorAll('.admin-executive-chart-grid .admin-card')).toHaveLength(3);
        expect(dashboard.querySelectorAll('.admin-executive-breakdown-grid .admin-card')).toHaveLength(6);
        expect(dashboard.querySelector('#executivePeriodSelect')).not.toBeNull();
        expect(dashboard.querySelector('#btnExecutiveRefresh')).not.toBeNull();
    });
});
