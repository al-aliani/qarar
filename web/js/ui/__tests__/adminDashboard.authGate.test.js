/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const isAdmin = vi.fn();
const toastError = vi.fn();

vi.mock('../../middleware/AuthGuard.js', () => ({ AuthGuard: { isAdmin } }));
vi.mock('../../utils/toast.js', () => ({ toast: { error: toastError } }));
vi.mock('../../services/AdminService.js', () => ({}));
vi.mock('../../services/ReviewsService.js', () => ({}));
vi.mock('../../services/TicketService.js', () => ({ getOpenTicketsCount: vi.fn(async () => 0) }));
vi.mock('apexcharts', () => ({ default: class { destroy() {} } }));
vi.mock('sweetalert2', () => ({ default: { fire: vi.fn() } }));

const { AdminDashboardView } = await import('../AdminDashboardView.js');

describe('AdminDashboardView — بوابة الصلاحية قبل تصيير الهيكل', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="admin"></div>';
        window.location.hash = '#/admin';
        isAdmin.mockReset();
        toastError.mockReset();
    });

    it('يرفض غير المدير حتى على localhost ولا يعرض أسماء تبويبات الإدارة', async () => {
        isAdmin.mockResolvedValue(false);

        await new AdminDashboardView('admin').render();

        expect(isAdmin).toHaveBeenCalledTimes(1);
        expect(document.getElementById('admin').textContent).not.toContain('المستخدمون');
        expect(document.getElementById('admin').textContent).not.toContain('الإيرادات');
        expect(toastError).toHaveBeenCalled();
        expect(window.location.hash).toBe('');
    });
});
