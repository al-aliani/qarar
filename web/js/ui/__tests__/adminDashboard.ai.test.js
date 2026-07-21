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

describe('AdminDashboardView — حوكمة الذكاء الاصطناعي', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="admin"></div>';
        AdminService.getEventsStats.mockResolvedValue({
            ok: true,
            data: { daily: [{ count: 4 }], by_prop: [{ value: 'internal', count: 3 }, { value: 'success', count: 4 }], totals_by_event: [] },
        });
    });

    it('يعرض المصدر والنتيجة والكاش وأنواع الطلبات', async () => {
        const view = new AdminDashboardView('admin');
        const content = document.getElementById('admin');
        await view._renderAiTab(content);

        expect(content.textContent).toContain('حوكمة الذكاء الاصطناعي');
        expect(content.textContent).toContain('Fallback داخلي');
        expect(content.textContent).toContain('إصابات الكاش');
        expect(content.textContent).toContain('مصدر التوليد');
        expect(content.textContent).toContain('internal');
        expect(AdminService.getEventsStats).toHaveBeenCalledWith('ai_request_completed', 30, 'source');
    });
});
