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
    getRevenueStats: vi.fn(),
    getProductFunnelStats: vi.fn(),
    getEventsStats: vi.fn(),
}));

const { AdminDashboardView } = await import('../AdminDashboardView.js');
const AdminService = await import('../../services/AdminService.js');

describe('AdminDashboardView — ذكاء الإيرادات', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="admin"></div>';
        AdminService.getRevenueStats.mockResolvedValue({
            ok: true,
            data: {
                total_revenue_sar: 10000,
                avg_order_value_sar: 500,
                by_tier: [{ tier: 'pro', count: 15, revenue_sar: 8500 }],
                by_provider: [],
                by_status: [{ status: 'paid', count: 20 }, { status: 'failed', count: 2 }],
                daily_revenue: [],
            },
        });
        AdminService.getProductFunnelStats.mockResolvedValue({
            ok: true,
            data: { paid_users: 15, free_users: 85, paid_orders: 20, payment_errors: 3 },
        });
        AdminService.getEventsStats.mockResolvedValue({ ok: true, data: { daily: [{ count: 3 }] } });
    });

    it('يعرض مؤشرات التحويل والفشل وتركيز الإيراد', () => {
        const view = new AdminDashboardView('admin');
        const content = document.getElementById('admin');
        view._renderRevenue(content, {
            revenue: {
                total_revenue_sar: 10000,
                avg_order_value_sar: 500,
                by_tier: [{ tier: 'pro', count: 15, revenue_sar: 8500 }],
                by_provider: [],
                by_status: [{ status: 'paid', count: 20 }, { status: 'failed', count: 2 }],
                daily_revenue: [],
            },
            funnel: { paid_users: 15, free_users: 85, paid_orders: 20, payment_errors: 3 },
            errors: { daily: [{ count: 3 }] },
        });

        expect(content.textContent).toContain('طلبات مدفوعة');
        expect(content.textContent).toContain('معدل فشل الطلبات');
        expect(content.textContent).toContain('تركيز أعلى باقة');
        expect(content.textContent).toContain('أخطاء دفع');
        expect(content.textContent).toContain('تركيز الإيراد');
    });
});
