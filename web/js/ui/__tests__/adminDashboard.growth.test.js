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
vi.mock('../../services/AdminService.js', () => ({ getEventsStats: vi.fn() }));

const { AdminDashboardView } = await import('../AdminDashboardView.js');
const AdminService = await import('../../services/AdminService.js');

describe('AdminDashboardView — النمو والاكتساب', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="admin"></div>';
        AdminService.getEventsStats.mockResolvedValue({ ok: true, data: { daily: [{ count: 10 }], by_prop: [{ value: 'organic', count: 6 }], totals_by_event: [{ event_name: 'x', count: 10 }] } });
    });

    it('يعرض القمع ومعدلات الانتقال ومصادر الاكتساب', async () => {
        const view = new AdminDashboardView('admin');
        const content = document.getElementById('admin');
        await view._renderGrowthTab(content);

        expect(content.textContent).toContain('رحلة العميل من التسجيل إلى الدفع');
        expect(content.textContent).toContain('معدلات الانتقال');
        expect(content.textContent).toContain('مصادر الاكتساب');
        expect(content.textContent).toContain('organic');
        expect(content.querySelector('#chartGrowthFunnel')).not.toBeNull();
        expect(AdminService.getEventsStats).toHaveBeenCalledWith('payment_success', 30, null);
        expect(AdminService.getEventsStats).toHaveBeenCalledWith(null, 30, 'utm_source');
    });
});
