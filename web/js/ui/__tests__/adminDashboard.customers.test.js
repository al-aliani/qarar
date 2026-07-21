/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../middleware/AuthGuard.js', () => ({ AuthGuard: { isAdmin: vi.fn() } }));
vi.mock('../../utils/toast.js', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('../../services/ReviewsService.js', () => ({}));
vi.mock('../../services/TicketService.js', () => ({
    getOpenTicketsCount: vi.fn(async () => 0),
    listAllTickets: vi.fn(async () => []),
}));
vi.mock('apexcharts', () => ({ default: class { destroy() {} render() { return Promise.resolve(); } } }));
vi.mock('sweetalert2', () => ({ default: { fire: vi.fn() } }));
vi.mock('../../services/AdminService.js', () => ({
    getUsersStats: vi.fn(),
    getProductFunnelStats: vi.fn(),
    getOverview: vi.fn(),
    getUnverifiedPhones: vi.fn(async () => ({ ok: true, data: [] })),
}));

const { AdminDashboardView } = await import('../AdminDashboardView.js');

describe('AdminDashboardView — صحة العملاء', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="admin"></div>';
    });

    it('يعرض مزيج العملاء ونسبة التحويل وتوزيع الباقات', () => {
        const view = new AdminDashboardView('admin');
        const content = document.getElementById('admin');
        view._renderUsers(content, {
            users: { total: 100, daily_signups: [], by_tier: [{ tier: 'free', count: 90 }, { tier: 'pro', count: 10 }] },
            funnel: { paid_users: 4, free_users: 96, new_studies: 12, paid_orders: 8, avg_completion_minutes: 42 },
            overview: { active_shares: 4, total_users: 100 },
        });

        expect(content.textContent).toContain('العملاء المدفوعون');
        expect(content.textContent).toContain('نسبة التحويل');
        expect(content.textContent).toContain('مزيج العملاء الحالي');
        expect(content.querySelector('#chartCustomerTiers')).not.toBeNull();
        expect(content.textContent).toContain('فرصة احتفاظ ونمو');
    });
});
