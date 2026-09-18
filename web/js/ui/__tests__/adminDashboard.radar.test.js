/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../middleware/AuthGuard.js', () => ({ AuthGuard: { isAdmin: vi.fn(async () => true) } }));
vi.mock('../../utils/toast.js', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('../../services/ReviewsService.js', () => ({}));
vi.mock('../../services/TicketService.js', () => ({ getOpenTicketsCount: vi.fn(async () => 0) }));
vi.mock('apexcharts', () => ({ default: class { destroy() {} render() { return Promise.resolve(); } } }));
vi.mock('sweetalert2', () => ({ default: { fire: vi.fn() } }));
vi.mock('../../services/AdminService.js', () => ({ getActivityRadar: vi.fn() }));

const { AdminDashboardView } = await import('../AdminDashboardView.js');
const AdminService = await import('../../services/AdminService.js');

describe('AdminDashboardView — رادار الموقع', () => {
    let view;

    beforeEach(() => {
        vi.useFakeTimers();
        document.body.innerHTML = '<div id="admin"></div>';
        AdminService.getActivityRadar.mockResolvedValue({
            ok: true,
            data: {
                generated_at: '2026-09-16T12:00:00Z', active_now: 2, sessions: 8,
                authenticated_sessions: 3, events: 24, errors: 2,
                current_period: { event_count: 24, session_count: 8, error_count: 2 },
                previous_period: { event_count: 12, session_count: 4, error_count: 0 },
                top_events: [{ event_name: 'study_start', count: 5, sessions: 4 }],
                top_pages: [{ page: 'index.html', count: 8, sessions: 6 }],
                funnel: [{ stage: 'زيارة عامة', sessions: 8 }, { stage: 'بدء دراسة', sessions: 4 }],
                recent_activity: [{ created_at: '2026-09-16T11:59:30Z', event_name: 'study_start', session_label: 'a1b2c3d4', authenticated: true, safe_props: { page: 'dashboard' } }],
                active_journeys: [{ session_label: 'a1b2c3d4', authenticated: true, event_count: 3, error_count: 0, last_seen_at: '2026-09-16T11:59:30Z', recent_events: ['study_start', 'login_complete'] }],
            },
        });
        view = new AdminDashboardView('admin');
        view.activeTab = 'radar';
    });

    afterEach(() => {
        if (view?.radarTimer) clearInterval(view.radarTimer);
        vi.useRealTimers();
    });

    it('يعرض النشاط الحي والقمع والرحلات المستعارة بلا بيانات شخصية', async () => {
        const content = document.getElementById('admin');
        await view._renderRadarTab(content);

        expect(AdminService.getActivityRadar).toHaveBeenCalledWith(60);
        expect(content.textContent).toContain('نبض الموقع الآن');
        expect(content.textContent).toContain('من الزيارة إلى الدفع');
        expect(content.textContent).toContain('a1b2c3d4');
        expect(content.textContent).toContain('تحديث كل 30 ثانية');
        expect(content.textContent).not.toContain('user_id');
        expect(content.querySelectorAll('.admin-activity-item')).toHaveLength(1);
    });
});
