/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../middleware/AuthGuard.js', () => ({ AuthGuard: { isAdmin: vi.fn() } }));
vi.mock('../../utils/toast.js', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('../../services/ReviewsService.js', () => ({ getAllReviews: vi.fn() }));
vi.mock('../../services/TicketService.js', () => ({ getOpenTicketsCount: vi.fn(async () => 0) }));
vi.mock('apexcharts', () => ({ default: class { destroy() {} render() { return Promise.resolve(); } } }));
vi.mock('sweetalert2', () => ({ default: { fire: vi.fn() } }));
vi.mock('../../services/AdminService.js', () => ({
    getEventsStats: vi.fn(),
    getOverview: vi.fn(),
    getStudiesStats: vi.fn(),
    getUsersStats: vi.fn(),
    getRevenueStats: vi.fn(),
    getProductFunnelStats: vi.fn(),
    getUnverifiedPhones: vi.fn(),
    getSharingStats: vi.fn(),
    getReviewerStats: vi.fn(),
}));

const { AdminDashboardView } = await import('../AdminDashboardView.js');
const AdminService = await import('../../services/AdminService.js');
const ReviewsService = await import('../../services/ReviewsService.js');

const eventResult = (count = 0, byProp = []) => ({
    ok: true,
    data: { daily: [{ day: '2026-07-21', count }], by_prop: byProp, totals_by_event: [{ event_name: 'event', count }] },
});

describe('AdminDashboardView - security and data quality', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="admin"></div>';
        AdminService.getEventsStats.mockImplementation(async (eventName, _days, group) => {
            if (eventName === 'login_complete') return eventResult(80);
            if (eventName === 'login_failed') return eventResult(20);
            if (eventName === 'signup_complete') return eventResult(12);
            if (eventName === 'signup_error') return eventResult(3);
            if (eventName === 'mfa_failed') return eventResult(1);
            if (eventName === 'error' && group === 'path') return eventResult(2, [{ value: '/checkout', count: 2 }]);
            if (group === 'device_type') return eventResult(10, [{ value: 'desktop', count: 7 }, { value: 'mobile', count: 3 }]);
            if (group === 'browser') return eventResult(10, [{ value: 'chrome', count: 8 }]);
            if (group === 'experiment_pricing_cards') return eventResult(10, [{ value: 'control', count: 6 }, { value: 'recommended_first', count: 4 }]);
            if (group === 'tier') return eventResult(4, [{ value: 'self', count: 4 }]);
            return eventResult(10);
        });
        AdminService.getUnverifiedPhones.mockResolvedValue({ ok: true, data: [{ id: 'u1' }, { id: 'u2' }] });
        AdminService.getOverview.mockResolvedValue({ ok: true, data: { total_studies: 24, total_users: 120 } });
        AdminService.getStudiesStats.mockResolvedValue({ ok: true, data: {} });
        AdminService.getUsersStats.mockResolvedValue({ ok: true, data: {} });
        AdminService.getRevenueStats.mockResolvedValue({ ok: true, data: {} });
        AdminService.getProductFunnelStats.mockResolvedValue({ ok: true, data: {} });
        AdminService.getSharingStats.mockResolvedValue({ ok: true, data: { total: 5, active: 3, revoked: 1, expired: 1 } });
        AdminService.getReviewerStats.mockResolvedValue({ ok: true, data: { active_reviewers: 2, queued: 1, in_review: 2, certified_total: 9, rejected_total: 1, avg_turnaround_hours: 4 } });
        ReviewsService.getAllReviews.mockResolvedValue({ ok: true, reviews: [{ rating: 5, published: true }, { rating: 3, published: false }] });
    });

    it('يعرض صحة الدخول وقيود الخصوصية والمسارات المتأثرة', async () => {
        const view = new AdminDashboardView('admin');
        const content = document.getElementById('admin');
        await view._renderSecurityTab(content);

        expect(content.textContent).toContain('الأمان والخصوصية');
        expect(content.textContent).toContain('معدل فشل الدخول');
        expect(content.textContent).toContain('/checkout');
        expect(content.textContent).toContain('لا يتم إرسال البريد');
        expect(AdminService.getEventsStats).toHaveBeenCalledWith('login_failed', 30, null);
    });

    it('يفحص اتصال المصادر ويحسب درجة جودة قابلة للتفسير', async () => {
        const view = new AdminDashboardView('admin');
        const content = document.getElementById('admin');
        await view._renderQualityTab(content);

        expect(content.textContent).toContain('جودة البيانات');
        expect(content.textContent).toContain('درجة جودة المصادر');
        expect(content.textContent).toContain('مصادر متصلة');
        expect(content.textContent).toContain('سليم');
        expect(AdminService.getProductFunnelStats).toHaveBeenCalledWith(30);
    });

    it('يعرض قيمة المشاركة الخارجية وتفاعل المستثمر', async () => {
        const view = new AdminDashboardView('admin');
        const content = document.getElementById('admin');
        await view._renderInvestorTab(content);

        expect(content.textContent).toContain('إجمالي روابط المشاركة');
        expect(content.textContent).toContain('مشاهدات المستثمرين');
        expect(content.textContent).toContain('مخرجات آمنة للمشاركة');
        expect(AdminService.getSharingStats).toHaveBeenCalled();
    });

    it('يربط القطاعات بمصادر إنشاء الدراسات وصيغ التصدير', async () => {
        AdminService.getStudiesStats.mockResolvedValue({ ok: true, data: { by_sector: [{ sector: 'تقنية', count: 7 }] } });
        const view = new AdminDashboardView('admin');
        const content = document.getElementById('admin');
        await view._renderIndustryTab(content);

        expect(content.textContent).toContain('ترتيب القطاعات لبناء القوالب');
        expect(content.textContent).toContain('تقنية');
        expect(content.textContent).toContain('أشكال التصدير المطلوبة');
    });

    it('يعرض مصفوفة 300 ميزة مع بحث وحالات مصدر واضحة', async () => {
        const view = new AdminDashboardView('admin');
        const content = document.getElementById('admin');
        await view._renderCoverageTab(content);

        expect(content.textContent).toContain('تغطية 300 ميزة');
        expect(content.querySelectorAll('#coverageRows tr')).toHaveLength(300);
        const search = content.querySelector('#coverageSearch');
        search.value = 'CAC';
        search.dispatchEvent(new Event('input'));
        expect(content.querySelectorAll('#coverageRows tr')).toHaveLength(1);
        expect(content.textContent).toContain('يحتاج مصدرًا');
    });

    it('يعرض شرائح الأجهزة والمتصفحات واللغة ومصادر UTM', async () => {
        const view = new AdminDashboardView('admin');
        const content = document.getElementById('admin');
        await view._renderPlatformTab(content);

        expect(content.textContent).toContain('الجمهور والمنصات');
        expect(content.textContent).toContain('desktop');
        expect(content.textContent).toContain('chrome');
        expect(AdminService.getEventsStats).toHaveBeenCalledWith(null, 30, 'device_type');
    });

    it('يقارن تجربة ترتيب الباقات بنتيجة الدفع', async () => {
        const view = new AdminDashboardView('admin');
        const content = document.getElementById('admin');
        await view._renderExperimentsTab(content);

        expect(content.textContent).toContain('التجارب A/B');
        expect(content.textContent).toContain('recommended_first');
        expect(content.textContent).toContain('التحويل');
        expect(AdminService.getEventsStats).toHaveBeenCalledWith('payment_success', 30, 'experiment_pricing_cards');
    });

    it('يعرض صحة الباقات ومزيج مزودي الدفع من المصدر المالي الحقيقي', async () => {
        AdminService.getRevenueStats.mockResolvedValue({
            ok: true,
            data: {
                total_revenue_sar: 900,
                paid_orders: 3,
                by_tier: [{ tier: 'self', count: 2, revenue_sar: 600 }],
                by_provider: [{ provider: 'moyasar', count: 2, revenue_sar: 600 }],
            },
        });
        const view = new AdminDashboardView('admin');
        const content = document.getElementById('admin');
        await view._renderSubscriptionsTab(content);

        expect(content.textContent).toContain('الاشتراكات والباقات');
        expect(content.textContent).toContain('moyasar');
        expect(content.textContent).toContain('self');
        expect(AdminService.getEventsStats).toHaveBeenCalledWith('checkout_start', 30, 'tier');
    });

    it('يربط الرضا والفريق والمحتوى ورادار الابتكار بمصادر قابلة للقياس', async () => {
        const view = new AdminDashboardView('admin');
        const content = document.getElementById('admin');

        await view._renderSatisfactionTab(content);
        expect(content.textContent).toContain('صوت العميل');
        expect(content.textContent).toContain('متوسط التقييم');

        await view._renderTeamTab(content);
        expect(content.textContent).toContain('قدرة الفريق على الاستجابة');
        expect(content.textContent).toContain('مراجعون نشطون');

        await view._renderContentTab(content);
        expect(content.textContent).toContain('المحتوى والصفحات');
        expect(AdminService.getEventsStats).toHaveBeenCalledWith('public_page_view', 30, 'page');

        await view._renderInnovationTab(content);
        expect(content.textContent).toContain('رادار الابتكار');
        expect(AdminService.getEventsStats).toHaveBeenCalledWith('ai_request_completed', 30, 'type');
    });

    it('يحافظ على اكتمال مصفوفة 300 بندًا بلا حالة مجهولة', async () => {
        const view = new AdminDashboardView('admin');
        const content = document.getElementById('admin');
        await view._renderCoverageTab(content);
        expect(content.querySelectorAll('#coverageRows tr')).toHaveLength(300);
        expect(content.textContent).toContain('تغطية فعلية');
    });
});
