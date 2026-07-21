/**
 * AdminDashboardView — لوحة تحكم الأدمن (2026-07-16). صفحة مغمورة بلا شريط
 * جانبي (نفس نمط ReviewerDashboardView.js)، مقصورة على مستخدمين مُدرَجين
 * فعلياً بجدول admins (AuthGuard.isAdmin) — أي مستخدم آخر يصل لهذا المسار
 * يُعاد توجيهه فوراً بلا أي محاولة عرض بيانات. كل الأرقام حقيقية من قاعدة
 * البيانات عبر دوال admin_*_stats (انظر AdminService.js) — لا قيمة مصطنعة.
 *
 * تنسيق: فئات BEM حقيقية في web/css/admin-dashboard.css (متغيرات --c-* و --s-*
 * الموجودة أصلاً، تتبدّل تلقائياً مع الوضع الليلي) — عمداً بلا فئات Tailwind
 * (p-6/bg-white/...) كالتي تستخدمها ReviewerDashboardView.js، لأن تلك الفئات
 * غير مشمولة بـ content الخاص بـ tailwind.config.js (يغطي src/ فقط لا web/js/)
 * فتصل بلا أي تنسيق حقيقي في هذا التطبيق.
 */
import { AuthGuard } from '../middleware/AuthGuard.js';
import * as AdminService from '../services/AdminService.js';
import * as ReviewsService from '../services/ReviewsService.js';
import * as TicketService from '../services/TicketService.js';
import { renderStarsHtml } from '../utils/starRating.js';
import { toast } from '../utils/toast.js';
import { formatCurrency, formatNumber, formatPercent } from '../utils/formatters.js';
import { ADMIN_FEATURE_CATALOG } from '../data/adminFeatureCatalog.js';
import Swal from 'sweetalert2';

const TABS = [
    { key: 'overview', label: 'نظرة عامة' },
    { key: 'studies', label: 'الدراسات' },
    { key: 'users', label: 'المستخدمون' },
    { key: 'revenue', label: 'الإيرادات' },
    { key: 'growth', label: 'النمو والاكتساب' },
    { key: 'ai', label: 'الذكاء الاصطناعي' },
    { key: 'reliability', label: 'الموثوقية' },
    { key: 'security', label: 'الأمان والخصوصية' },
    { key: 'quality', label: 'جودة البيانات' },
    { key: 'investor', label: 'المستثمرون والمشاركة' },
    { key: 'industry', label: 'القطاعات والقوالب' },
    { key: 'platform', label: 'الجمهور والمنصات' },
    { key: 'experiments', label: 'التجارب A/B' },
    { key: 'subscriptions', label: 'الاشتراكات والباقات' },
    { key: 'satisfaction', label: 'الرضا والآراء' },
    { key: 'team', label: 'الفريق والدعم' },
    { key: 'content', label: 'المحتوى والصفحات' },
    { key: 'innovation', label: 'رادار الابتكار' },
    { key: 'strategy', label: 'مؤشرات المستثمرين' },
    { key: 'coverage', label: 'تغطية 300 ميزة' },
    { key: 'reports', label: 'التقارير' },
    { key: 'reviewers', label: 'المراجعة' },
    { key: 'sharing', label: 'المشاركة' },
    { key: 'behavior', label: 'السلوك' },
    { key: 'reviews', label: 'آراء العملاء' },
    { key: 'tickets', label: 'الدعم الفني' },
];

export class AdminDashboardView {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.activeTab = 'overview';
        this.cache = {};
        this.charts = {};
        this.behaviorDays = 30;
        this.executiveDays = 30;
        this.growthDays = 30;
        this.openTicketId = null;
    }

    async render() {
        // التحقق يسبق تصيير الهيكل أو طلب أي بيانات، بما في ذلك localhost. المعاينة
        // المحلية لا يجوز أن تتجاوز صلاحية جدول admins لأن خدمات البيانات محمية أيضاً.
        const isAdmin = await AuthGuard.isAdmin();
        if (!isAdmin) {
            toast.error('هذه الصفحة مخصّصة لمدراء النظام فقط');
            window.location.hash = '';
            return;
        }

        this._renderShell();
        await this._loadTab(this.activeTab);
        this._hydrateTicketsBadge();
    }

    /** شارة عدد التذاكر المفتوحة بجانب زر تبويب "الدعم الفني" — تحميل مؤجَّل بلا
     * انتظار قبل ظهور اللوحة نفسها (نفس مبدأ hydrateAccountTiles في DashboardView.js). */
    async _hydrateTicketsBadge() {
        const count = await TicketService.getOpenTicketsCount();
        const btn = this.container.querySelector('#adminTabs [data-tab="tickets"]');
        if (!btn || !count) return;
        // إعادة استخدام صنف .badge/.badge--warning العام (components.css) بدل صنف جديد —
        // نفس النمط المستخدم لشارة "بانتظار تأكيد الفريق" في UserProfileView.js، متوافق
        // مع الوضع الليلي أصلاً بلا حاجة لفحص تباين جديد.
        const badge = document.createElement('span');
        badge.className = 'badge badge--warning';
        badge.style.marginInlineStart = '6px';
        badge.textContent = String(count);
        btn.appendChild(badge);
    }

    _esc(value) {
        return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    _renderShell() {
        this.container.innerHTML = `
            <div class="admin-dashboard">
                <div class="admin-dashboard__header">
                    <h1 class="admin-dashboard__title">لوحة تحكم الأدمن</h1>
                    <button id="btnExitAdmin" class="btn btn--sm btn--ghost">خروج</button>
                </div>
                <div class="admin-tabs" id="adminTabs">
                    ${TABS.map((t) => `<button class="btn btn--sm ${t.key === this.activeTab ? 'btn--primary' : 'btn--ghost'}" data-tab="${t.key}">${this._esc(t.label)}</button>`).join('')}
                </div>
                <div id="adminTabContent"><p class="admin-loading">جارٍ التحميل…</p></div>
            </div>
        `;

        this.container.querySelector('#btnExitAdmin')?.addEventListener('click', () => {
            window.location.hash = '';
        });

        this.container.querySelectorAll('#adminTabs button').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const tab = btn.dataset.tab;
                if (tab === this.activeTab) return;
                this.activeTab = tab;
                this.container.querySelectorAll('#adminTabs button').forEach((b) => {
                    b.classList.toggle('btn--primary', b.dataset.tab === tab);
                    b.classList.toggle('btn--ghost', b.dataset.tab !== tab);
                });
                await this._loadTab(tab);
            });
        });
    }

    async _loadTab(tabKey) {
        const contentEl = this.container.querySelector('#adminTabContent');
        if (!contentEl) return;

        if (tabKey === 'behavior') {
            await this._renderBehaviorTab(contentEl);
            return;
        }

        if (tabKey === 'growth') {
            await this._renderGrowthTab(contentEl);
            return;
        }

        if (tabKey === 'ai') {
            await this._renderAiTab(contentEl);
            return;
        }

        if (tabKey === 'reliability') {
            await this._renderReliabilityTab(contentEl);
            return;
        }

        if (tabKey === 'security') {
            await this._renderSecurityTab(contentEl);
            return;
        }

        if (tabKey === 'quality') {
            await this._renderQualityTab(contentEl);
            return;
        }

        if (tabKey === 'investor') {
            await this._renderInvestorTab(contentEl);
            return;
        }

        if (tabKey === 'industry') {
            await this._renderIndustryTab(contentEl);
            return;
        }

        if (tabKey === 'platform') {
            await this._renderPlatformTab(contentEl);
            return;
        }

        if (tabKey === 'experiments') {
            await this._renderExperimentsTab(contentEl);
            return;
        }

        if (tabKey === 'subscriptions') {
            await this._renderSubscriptionsTab(contentEl);
            return;
        }

        if (tabKey === 'satisfaction') {
            await this._renderSatisfactionTab(contentEl);
            return;
        }

        if (tabKey === 'team') {
            await this._renderTeamTab(contentEl);
            return;
        }

        if (tabKey === 'content') {
            await this._renderContentTab(contentEl);
            return;
        }

        if (tabKey === 'innovation') {
            await this._renderInnovationTab(contentEl);
            return;
        }

        if (tabKey === 'strategy') {
            await this._renderStrategyTab(contentEl);
            return;
        }

        if (tabKey === 'coverage') {
            await this._renderCoverageTab(contentEl);
            return;
        }

        if (tabKey === 'reports') {
            await this._renderReportsTab(contentEl);
            return;
        }

        if (tabKey === 'reviews') {
            await this._renderReviewsTab(contentEl);
            return;
        }

        if (tabKey === 'tickets') {
            await this._renderTicketsTab(contentEl);
            return;
        }

        if (!this.cache[tabKey]) {
            contentEl.innerHTML = '<p class="admin-loading">جارٍ التحميل…</p>';
            const result = await this._fetchTab(tabKey);
            if (!result.ok) {
                contentEl.innerHTML = `<p class="admin-error">تعذّر تحميل البيانات: ${this._esc(result.error)}</p>`;
                return;
            }
            this.cache[tabKey] = result.data;
        }

        this._renderTab(tabKey, contentEl, this.cache[tabKey]);
    }

    _fetchTab(tabKey) {
        switch (tabKey) {
            case 'overview': return this._fetchExecutiveOverview();
            case 'studies': return AdminService.getStudiesStats();
            case 'users': return this._fetchCustomerHealth();
            case 'revenue': return this._fetchRevenueIntelligence();
            case 'reviewers': return AdminService.getReviewerStats();
            case 'sharing': return AdminService.getSharingStats();
            default: return Promise.resolve({ ok: false, error: 'تبويب غير معروف' });
        }
    }

    async _fetchExecutiveOverview() {
        const days = this.executiveDays;
        const [overview, funnel, revenue, errors, studies, users, events] = await Promise.all([
            AdminService.getOverview(),
            AdminService.getProductFunnelStats(days),
            AdminService.getRevenueStats(),
            AdminService.getEventsStats('payment_error', days, null),
            AdminService.getStudiesStats(),
            AdminService.getUsersStats(),
            AdminService.getEventsStats(null, days, null),
        ]);

        if (!overview.ok) return overview;

        return {
            ok: true,
            data: {
                overview: overview.data || {},
                funnel: funnel.ok ? (funnel.data || {}) : {},
                revenue: revenue.ok ? (revenue.data || {}) : {},
                errors: errors.ok ? (errors.data || {}) : {},
                studies: studies.ok ? (studies.data || {}) : {},
                users: users.ok ? (users.data || {}) : {},
                events: events.ok ? (events.data || {}) : {},
                sourceWarnings: [funnel, revenue, errors, studies, users, events]
                    .filter((result) => !result.ok)
                    .map((result) => result.error)
                    .filter(Boolean),
            },
        };
    }

    async _fetchRevenueIntelligence() {
        const [revenue, funnel, errors] = await Promise.all([
            AdminService.getRevenueStats(),
            AdminService.getProductFunnelStats(30),
            AdminService.getEventsStats('payment_error', 30, null),
        ]);

        if (!revenue.ok) return revenue;

        return {
            ok: true,
            data: {
                revenue: revenue.data || {},
                funnel: funnel.ok ? (funnel.data || {}) : {},
                errors: errors.ok ? (errors.data || {}) : {},
                sourceWarnings: [funnel, errors]
                    .filter((result) => !result.ok)
                    .map((result) => result.error)
                    .filter(Boolean),
            },
        };
    }

    async _fetchCustomerHealth() {
        const [users, funnel, overview] = await Promise.all([
            AdminService.getUsersStats(),
            AdminService.getProductFunnelStats(30),
            AdminService.getOverview(),
        ]);

        if (!users.ok) return users;

        return {
            ok: true,
            data: {
                users: users.data || {},
                funnel: funnel.ok ? (funnel.data || {}) : {},
                overview: overview.ok ? (overview.data || {}) : {},
                sourceWarnings: [funnel, overview]
                    .filter((result) => !result.ok)
                    .map((result) => result.error)
                    .filter(Boolean),
            },
        };
    }

    _renderTab(tabKey, contentEl, data) {
        const renderers = {
            overview: () => this._renderOverview(contentEl, data),
            studies: () => this._renderStudies(contentEl, data),
            users: () => this._renderUsers(contentEl, data),
            revenue: () => this._renderRevenue(contentEl, data),
            reviewers: () => this._renderReviewers(contentEl, data),
            sharing: () => this._renderSharing(contentEl, data),
        };
        renderers[tabKey]?.();
    }

    _tile(label, value) {
        return `<div class="admin-tile">
            <div class="admin-tile__label">${this._esc(label)}</div>
            <div class="admin-tile__value">${this._esc(value)}</div>
        </div>`;
    }

    _table(headers, rows) {
        if (!rows.length) return '<p class="admin-table__empty">لا توجد بيانات بعد.</p>';
        return `<div class="admin-table-wrap">
            <table class="admin-table">
                <thead><tr>${headers.map((h) => `<th>${this._esc(h)}</th>`).join('')}</tr></thead>
                <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${this._esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>
            </table>
        </div>`;
    }

    _destroyChart(id) {
        if (this.charts[id]) {
            try { this.charts[id].destroy(); } catch (_) { /* تجاهل — العنصر قد يكون أُزيل من DOM أصلاً */ }
            delete this.charts[id];
        }
    }

    /** يقرأ ألوان الثيم الفعلية من CSS variables — يضمن تباين الرسم في الوضعين
     * الفاتح والداكن (ApexCharts لا يتبع [data-theme] تلقائياً، ويحتاج ألواناً
     * محسوبة صراحة بدل الاعتماد على "theme: light" ثابتة). */
    _chartTheme() {
        const styles = getComputedStyle(document.documentElement);
        return {
            foreColor: styles.getPropertyValue('--c-text-muted').trim() || '#5b665f',
            borderColor: styles.getPropertyValue('--c-border').trim() || 'rgba(28,36,32,0.14)',
            primary: styles.getPropertyValue('--c-p-500').trim() || '#0e5b44',
        };
    }

    async _renderTrendChart(containerId, seriesName, points) {
        this._destroyChart(containerId);
        const el = document.getElementById(containerId);
        if (!el) return;
        const theme = this._chartTheme();
        const options = {
            chart: { height: 260, type: 'line', fontFamily: 'inherit', toolbar: { show: false }, foreColor: theme.foreColor },
            series: [{ name: seriesName, data: points.map((p) => p.value) }],
            stroke: { width: 3, curve: 'smooth' },
            colors: [theme.primary],
            dataLabels: { enabled: false },
            grid: { borderColor: theme.borderColor },
            xaxis: { categories: points.map((p) => p.label), labels: { rotate: -45 } },
        };
        try {
            const { default: ApexCharts } = await import('apexcharts');
            const currentEl = document.getElementById(containerId);
            if (!currentEl) return;
            const chart = new ApexCharts(currentEl, options);
            chart.render().catch((err) => console.error('ApexCharts render error:', err));
            this.charts[containerId] = chart;
        } catch (err) {
            console.error('ApexCharts init error:', err);
        }
    }

    async _renderBarChart(containerId, seriesName, points, isHorizontal = false) {
        this._destroyChart(containerId);
        const el = document.getElementById(containerId);
        if (!el) return;
        const theme = this._chartTheme();
        const options = {
            chart: { height: 280, type: 'bar', fontFamily: 'inherit', toolbar: { show: false }, foreColor: theme.foreColor },
            series: [{ name: seriesName, data: points.map(p => p.value) }],
            plotOptions: { bar: { horizontal: isHorizontal, borderRadius: 4, distributed: true } },
            colors: ['#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7'],
            dataLabels: { enabled: true, style: { colors: ['#fff'] } },
            grid: { borderColor: theme.borderColor },
            xaxis: { categories: points.map(p => p.label) },
            legend: { show: false }
        };
        try {
            const { default: ApexCharts } = await import('apexcharts');
            const currentEl = document.getElementById(containerId);
            if (!currentEl) return;
            const chart = new ApexCharts(currentEl, options);
            chart.render().catch(err => console.error(err));
            this.charts[containerId] = chart;
        } catch(err) { console.error(err); }
    }

    async _renderPieChart(containerId, seriesName, points) {
        this._destroyChart(containerId);
        const el = document.getElementById(containerId);
        if (!el) return;
        const theme = this._chartTheme();
        const options = {
            chart: { height: 320, type: 'donut', fontFamily: 'inherit', foreColor: theme.foreColor },
            series: points.map(p => p.value),
            labels: points.map(p => p.label),
            stroke: { colors: [theme.borderColor] },
            colors: ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#06b6d4'],
            dataLabels: { enabled: true },
            legend: { position: 'bottom', fontFamily: 'inherit' }
        };
        try {
            const { default: ApexCharts } = await import('apexcharts');
            const currentEl = document.getElementById(containerId);
            if (!currentEl) return;
            const chart = new ApexCharts(currentEl, options);
            chart.render().catch(err => console.error(err));
            this.charts[containerId] = chart;
        } catch(err) { console.error(err); }
    }

    _executiveAlert(label, value, tone, detail) {
        return `<div class="admin-executive-alert admin-executive-alert--${tone}">
            <div class="admin-executive-alert__head">
                <span class="admin-executive-alert__label">${this._esc(label)}</span>
                <strong>${this._esc(value)}</strong>
            </div>
            <p>${this._esc(detail)}</p>
        </div>`;
    }

    _renderOverview(contentEl, payload) {
        const data = payload?.overview || payload || {};
        const funnel = payload?.funnel || {};
        const revenue = payload?.revenue || {};
        const errorStats = payload?.errors || {};
        const studies = payload?.studies || {};
        const users = payload?.users || {};
        const events = payload?.events || {};
        const paidUsers = Number(funnel.paid_users || 0);
        const freeUsers = Number(funnel.free_users || 0);
        const totalUsers = paidUsers + freeUsers;
        const conversion = totalUsers ? paidUsers / totalUsers : null;
        const paymentErrors = Number(funnel.payment_errors || 0);
        const pendingReviews = Number(data.pending_reviews || 0);
        const errorEvents = (errorStats.daily || []).reduce((sum, item) => sum + Number(item.count || 0), 0);
        const totalEvents = (events.totals_by_event || []).reduce((sum, item) => sum + Number(item.count || 0), 0);
        const averageCompletion = Number(funnel.avg_completion_minutes || 0);
        const refreshedAt = new Intl.DateTimeFormat('ar-SA', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date());
        const periodLabel = { 7: '٧ أيام', 30: '٣٠ يوماً', 90: '٩٠ يوماً' }[this.executiveDays] || `${this.executiveDays} يوماً`;
        const alerts = [];

        if (paymentErrors > 0) {
            alerts.push(this._executiveAlert('أولوية مالية', formatNumber(paymentErrors), 'danger', `أخطاء دفع خلال آخر ${periodLabel} تحتاج مراجعة قبل زيادة الإنفاق التسويقي.`));
        }
        if (pendingReviews > 0) {
            alerts.push(this._executiveAlert('أولوية تشغيلية', formatNumber(pendingReviews), 'warning', 'طلبات تنتظر المراجعة؛ تسريعها يحسن زمن التسليم وتجربة العميل.'));
        }
        if (conversion != null && conversion < 0.05) {
            alerts.push(this._executiveAlert('فرصة نمو', formatPercent(conversion), 'info', 'نسبة العملاء المدفوعين منخفضة؛ راجع نقاط التسرب والعرض المدفوع.'));
        }
        if (!alerts.length) {
            alerts.push(this._executiveAlert('الحالة العامة', 'مستقرة', 'success', 'لا توجد أولوية حرجة من المؤشرات المتاحة حالياً.'));
        }

        contentEl.innerHTML = `
            <section class="admin-executive-hero">
                <div>
                    <span class="admin-eyebrow">مركز القرارات التنفيذي</span>
                    <h2>صورة سريعة لاتجاه العمل</h2>
                    <p>ملخص تشغيلي ومالي مبني على آخر ${this._esc(periodLabel)}، مع الأولويات التي تستحق انتباهك الآن.</p>
                    <div class="admin-executive-meta">
                        <span>آخر تحديث: ${this._esc(refreshedAt)}</span>
                        <label>النطاق:
                            <select id="executivePeriodSelect" class="admin-select" aria-label="فترة المؤشرات">
                                <option value="7" ${this.executiveDays === 7 ? 'selected' : ''}>٧ أيام</option>
                                <option value="30" ${this.executiveDays === 30 ? 'selected' : ''}>٣٠ يوماً</option>
                                <option value="90" ${this.executiveDays === 90 ? 'selected' : ''}>٩٠ يوماً</option>
                            </select>
                        </label>
                        <button id="btnExecutiveRefresh" class="btn btn--sm btn--ghost">تحديث البيانات</button>
                    </div>
                </div>
                <span class="admin-period-badge">تحديث مباشر</span>
            </section>

            <div class="admin-tile-grid admin-tile-grid--executive">
                ${this._tile('إجمالي الدراسات', formatNumber(data.total_studies ?? 0))}
                ${this._tile('إجمالي المستخدمين', formatNumber(data.total_users ?? 0))}
                ${this._tile('إجمالي الإيرادات', formatCurrency(data.total_revenue_sar ?? 0))}
                ${this._tile('العملاء المدفوعون', formatNumber(paidUsers))}
                ${this._tile('التحويل إلى مدفوع', conversion == null ? '—' : formatPercent(conversion))}
                ${this._tile('متوسط قيمة الطلب', formatCurrency(revenue.avg_order_value_sar ?? 0))}
                ${this._tile('مستخدمون مجانيون', formatNumber(freeUsers))}
                ${this._tile('دراسات جديدة', formatNumber(funnel.new_studies ?? 0))}
                ${this._tile('طلبات مدفوعة', formatNumber(funnel.paid_orders ?? 0))}
                ${this._tile('متوسط الإنجاز', averageCompletion ? `${formatNumber(averageCompletion)} دقيقة` : '—')}
                ${this._tile('مراجعات قيد الانتظار', formatNumber(pendingReviews))}
                ${this._tile('أخطاء الدفع', formatNumber(paymentErrors))}
                ${this._tile('إجمالي الأحداث', formatNumber(totalEvents))}
                ${this._tile('أخطاء مسجلة', formatNumber(errorEvents))}
            </div>

            <div class="admin-section-grid admin-section-grid--executive">
                <section class="admin-card admin-executive-panel">
                    <div class="admin-card__heading-row">
                        <div>
                            <span class="admin-eyebrow">قرارات اليوم</span>
                            <h3 class="admin-card__title">ما يحتاج انتباهك</h3>
                        </div>
                        <span class="admin-live-dot" aria-label="بيانات حديثة"></span>
                    </div>
                    <div class="admin-executive-alerts">${alerts.join('')}</div>
                </section>

                <section class="admin-card admin-executive-panel">
                    <div class="admin-card__heading-row">
                        <div>
                            <span class="admin-eyebrow">صحة المنتج</span>
                            <h3 class="admin-card__title">الإشارات التشغيلية</h3>
                        </div>
                        <span class="admin-period-badge">${periodLabel}</span>
                    </div>
                    <div class="admin-signal-list">
                        <div class="admin-signal-row"><span>دراسات جديدة</span><strong>${this._esc(formatNumber(funnel.new_studies ?? 0))}</strong></div>
                        <div class="admin-signal-row"><span>طلبات مدفوعة</span><strong>${this._esc(formatNumber(funnel.paid_orders ?? 0))}</strong></div>
                        <div class="admin-signal-row"><span>أحداث أخطاء الدفع</span><strong>${this._esc(formatNumber(errorEvents))}</strong></div>
                        <div class="admin-signal-row"><span>روابط مشاركة نشطة</span><strong>${this._esc(formatNumber(data.active_shares ?? 0))}</strong></div>
                    </div>
                </section>
            </div>

            <div class="admin-executive-chart-grid">
                <section class="admin-card">
                    <h3 class="admin-card__title">إنشاء الدراسات</h3>
                    <div id="chartExecutiveStudies"></div>
                </section>
                <section class="admin-card">
                    <h3 class="admin-card__title">الإيراد اليومي</h3>
                    <div id="chartExecutiveRevenue"></div>
                </section>
                <section class="admin-card">
                    <h3 class="admin-card__title">التسجيل اليومي</h3>
                    <div id="chartExecutiveSignups"></div>
                </section>
            </div>

            <div class="admin-executive-breakdown-grid">
                <section class="admin-card">
                    <h3 class="admin-card__title">الإيراد حسب الباقة</h3>
                    ${this._table(['الباقة', 'الطلبات', 'الإيراد'], (revenue.by_tier || []).map((row) => [row.tier || '—', row.count, formatCurrency(row.revenue_sar || 0)]))}
                </section>
                <section class="admin-card">
                    <h3 class="admin-card__title">الإيراد حسب مزوّد الدفع</h3>
                    ${this._table(['المزوّد', 'الطلبات', 'الإيراد'], (revenue.by_provider || []).map((row) => [row.provider || '—', row.count, formatCurrency(row.revenue_sar || 0)]))}
                </section>
                <section class="admin-card">
                    <h3 class="admin-card__title">حالات الطلبات</h3>
                    ${this._table(['الحالة', 'العدد'], (revenue.by_status || []).map((row) => [row.status || '—', row.count]))}
                </section>
                <section class="admin-card">
                    <h3 class="admin-card__title">حالات الدراسات</h3>
                    ${this._table(['الحالة', 'العدد'], (studies.by_status || []).map((row) => [row.status || '—', row.count]))}
                </section>
                <section class="admin-card">
                    <h3 class="admin-card__title">قطاعات الدراسات</h3>
                    ${this._table(['القطاع', 'العدد'], (studies.by_sector || []).map((row) => [row.sector || '—', row.count]))}
                </section>
                <section class="admin-card">
                    <h3 class="admin-card__title">توزيع الباقات</h3>
                    ${this._table(['الباقة', 'العدد'], (users.by_tier || []).map((row) => [row.tier || '—', row.count]))}
                </section>
            </div>

            ${payload?.sourceWarnings?.length ? `<p class="admin-data-note">تعذر تحديث بعض المؤشرات الثانوية: ${this._esc(payload.sourceWarnings.join('، '))}</p>` : ''}
        `;

        const studyDaily = (studies.daily_created || []).map((row) => ({ label: row.day, value: Number(row.count || 0) }));
        const revenueDaily = (revenue.daily_revenue || []).map((row) => ({ label: row.day, value: Number(row.revenue_sar || 0) }));
        const signupDaily = (users.daily_signups || []).map((row) => ({ label: row.day, value: Number(row.count || 0) }));
        this._renderTrendChart('chartExecutiveStudies', 'دراسات', studyDaily);
        this._renderTrendChart('chartExecutiveRevenue', 'ريال سعودي', revenueDaily);
        this._renderTrendChart('chartExecutiveSignups', 'مستخدمون', signupDaily);
        this._bindExecutiveControls(contentEl);
    }

    _bindExecutiveControls(contentEl) {
        const periodSelect = contentEl.querySelector('#executivePeriodSelect');
        periodSelect?.addEventListener('change', async () => {
            this.executiveDays = Number(periodSelect.value);
            delete this.cache.overview;
            await this._loadTab('overview');
        });

        contentEl.querySelector('#btnExecutiveRefresh')?.addEventListener('click', async (event) => {
            const button = event.currentTarget;
            button.disabled = true;
            button.textContent = 'جارٍ التحديث...';
            delete this.cache.overview;
            await this._loadTab('overview');
        });
    }

    _renderStudies(contentEl, data) {
        contentEl.innerHTML = `
            <div class="admin-tile-grid">
                ${this._tile('إجمالي الدراسات', data.total ?? 0)}
                ${this._tile('قوالب', data.templates ?? 0)}
                ${this._tile('دراسات حقيقية', (data.total ?? 0) - (data.templates ?? 0))}
            </div>
            <div class="admin-card">
                <h3 class="admin-card__title">الإنشاء اليومي (٩٠ يوماً)</h3>
                <div id="chartStudiesDaily"></div>
            </div>
            <div class="admin-section-grid">
                <div>
                    <h3 class="admin-card__title">حسب الحالة</h3>
                    ${this._table(['الحالة', 'العدد'], (data.by_status || []).map((r) => [r.status || '—', r.count]))}
                </div>
                <div>
                    <h3 class="admin-card__title">حسب القطاع</h3>
                    ${this._table(['القطاع', 'العدد'], (data.by_sector || []).map((r) => [r.sector || '—', r.count]))}
                </div>
            </div>
        `;
        const daily = data.daily_created || [];
        this._renderTrendChart('chartStudiesDaily', 'دراسات', daily.map((d) => ({ label: d.day, value: d.count })));
    }

    _renderUsers(contentEl, payload) {
        const data = payload?.users || payload || {};
        const funnel = payload?.funnel || {};
        const overview = payload?.overview || {};
        const paidUsers = Number(funnel.paid_users || 0);
        const freeUsers = Number(funnel.free_users || 0);
        const totalUsers = paidUsers + freeUsers || Number(data.total || overview.total_users || 0);
        const conversion = totalUsers ? paidUsers / totalUsers : null;
        const tierRows = data.by_tier || [];

        contentEl.innerHTML = `
            <div class="admin-tile-grid">
                ${this._tile('إجمالي المستخدمين', formatNumber(data.total ?? overview.total_users ?? 0))}
                ${this._tile('العملاء المدفوعون', formatNumber(paidUsers))}
                ${this._tile('العملاء المجانيون', formatNumber(freeUsers))}
                ${this._tile('نسبة التحويل', conversion == null ? '—' : formatPercent(conversion))}
            </div>
            <div class="admin-section-grid admin-section-grid--executive">
                <section class="admin-card admin-customer-health">
                    <div class="admin-card__heading-row">
                        <div>
                            <span class="admin-eyebrow">صحة العملاء</span>
                            <h3 class="admin-card__title">مزيج العملاء الحالي</h3>
                        </div>
                        <span class="admin-period-badge">تحديث مباشر</span>
                    </div>
                    <div class="admin-signal-list">
                        <div class="admin-signal-row"><span>دراسات جديدة (٣٠ يوماً)</span><strong>${this._esc(formatNumber(funnel.new_studies ?? 0))}</strong></div>
                        <div class="admin-signal-row"><span>طلبات مدفوعة (٣٠ يوماً)</span><strong>${this._esc(formatNumber(funnel.paid_orders ?? 0))}</strong></div>
                        <div class="admin-signal-row"><span>روابط مشاركة نشطة</span><strong>${this._esc(formatNumber(overview.active_shares ?? 0))}</strong></div>
                        <div class="admin-signal-row"><span>متوسط الإنجاز</span><strong>${this._esc(funnel.avg_completion_minutes ? `${formatNumber(funnel.avg_completion_minutes)} دقيقة` : '—')}</strong></div>
                    </div>
                </section>
                <section class="admin-card">
                    <h3 class="admin-card__title">توازن الشرائح</h3>
                    <div id="chartCustomerTiers"></div>
                </section>
            </div>
            <div class="admin-card">
                <h3 class="admin-card__title">التسجيل اليومي (٩٠ يوماً)</h3>
                <div id="chartUsersDaily"></div>
            </div>
            <h3 class="admin-card__title">حسب الباقة</h3>
            ${this._table(['الباقة', 'العدد'], (data.by_tier || []).map((r) => [r.tier || '—', r.count]))}
            <div class="admin-card">
                <h3 class="admin-card__title">جوالات بانتظار تأكيد واتساب</h3>
                <div id="unverifiedPhonesList"><p class="admin-loading">جارٍ التحميل…</p></div>
            </div>
            ${conversion != null && conversion < 0.05 ? this._executiveAlert('فرصة احتفاظ ونمو', formatPercent(conversion), 'info', 'نسبة العملاء المدفوعين منخفضة؛ راجع تجربة التفعيل والعرض قبل توسيع الاستحواذ.') : ''}
            ${payload?.sourceWarnings?.length ? `<p class="admin-data-note">تعذر تحديث بعض مؤشرات العملاء: ${this._esc(payload.sourceWarnings.join('، '))}</p>` : ''}
        `;
        const daily = data.daily_signups || [];
        this._renderTrendChart('chartUsersDaily', 'مستخدمون جدد', daily.map((d) => ({ label: d.day, value: d.count })));
        this._renderPieChart('chartCustomerTiers', 'المستخدمون', tierRows.map((row) => ({ label: row.tier || '—', value: Number(row.count || 0) })));
        this._loadUnverifiedPhones(contentEl);
    }

    /**
     * قائمة عملاء بانتظار تأكيد يدوي لجوالهم (تواصلوا أو لم يتواصلوا عبر
     * واتساب — انظر WhatsAppContactModal.js وmigration 20260717020000).
     * مستقلة عن تخزين this.cache المؤقت للتبويب (بخلاف بقية بيانات هذا
     * التبويب) لأنها تحتاج تحديثاً فورياً بعد كل تأكيد، لا مرة واحدة فقط.
     */
    async _loadUnverifiedPhones(contentEl) {
        const listEl = contentEl.querySelector('#unverifiedPhonesList');
        if (!listEl) return;
        listEl.innerHTML = '<p class="admin-loading">جارٍ التحميل…</p>';

        const result = await AdminService.getUnverifiedPhones();
        if (!result.ok) {
            listEl.innerHTML = `<p class="admin-error">تعذّر تحميل القائمة: ${this._esc(result.error)}</p>`;
            return;
        }

        const rows = result.data || [];
        if (!rows.length) {
            listEl.innerHTML = '<p class="admin-table__empty">لا يوجد جوالات بانتظار التأكيد حالياً.</p>';
            return;
        }

        listEl.innerHTML = `
            <div class="admin-table-wrap">
                <table class="admin-table">
                    <thead><tr><th>الاسم</th><th>الجوال</th><th>تاريخ التسجيل</th><th></th></tr></thead>
                    <tbody>
                        ${rows.map((r) => `
                            <tr>
                                <td>${this._esc(r.full_name || '—')}</td>
                                <td dir="ltr">${this._esc(r.phone)}</td>
                                <td>${this._esc(new Date(r.created_at).toLocaleDateString('ar-SA'))}</td>
                                <td><button class="btn btn--sm btn--primary btn-confirm-phone" data-id="${this._esc(r.id)}">تأكيد</button></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        listEl.querySelectorAll('.btn-confirm-phone').forEach((btn) => {
            btn.addEventListener('click', async () => {
                btn.disabled = true;
                btn.textContent = 'جارٍ التأكيد...';
                const res = await AdminService.confirmPhoneVerified(btn.dataset.id);
                if (!res.ok) {
                    toast.error(res.error || 'فشل التأكيد');
                    btn.disabled = false;
                    btn.textContent = 'تأكيد';
                    return;
                }
                toast.success('تم تأكيد الجوال');
                this._loadUnverifiedPhones(contentEl);
            });
        });
    }

    _renderRevenue(contentEl, payload) {
        const data = payload?.revenue || payload || {};
        const funnel = payload?.funnel || {};
        const errorStats = payload?.errors || {};
        const paidUsers = Number(funnel.paid_users || 0);
        const freeUsers = Number(funnel.free_users || 0);
        const totalUsers = paidUsers + freeUsers;
        const conversion = totalUsers ? paidUsers / totalUsers : null;
        const paymentErrors = Number(funnel.payment_errors || 0);
        const paidOrders30d = Number(funnel.paid_orders || 0);
        const errorEvents = (errorStats.daily || []).reduce((sum, item) => sum + Number(item.count || 0), 0);
        const statusRows = data.by_status || [];
        const totalOrders = statusRows.reduce((sum, row) => sum + Number(row.count || 0), 0);
        const failedOrders = statusRows
            .filter((row) => ['failed', 'cancelled', 'refunded'].includes(String(row.status).toLowerCase()))
            .reduce((sum, row) => sum + Number(row.count || 0), 0);
        const topTier = [...(data.by_tier || [])].sort((a, b) => Number(b.revenue_sar || 0) - Number(a.revenue_sar || 0))[0];
        const topTierShare = topTier && Number(data.total_revenue_sar || 0)
            ? Number(topTier.revenue_sar || 0) / Number(data.total_revenue_sar)
            : null;

        contentEl.innerHTML = `
            <div class="admin-tile-grid">
                ${this._tile('إجمالي الإيرادات', formatCurrency(data.total_revenue_sar ?? 0))}
                ${this._tile('متوسط قيمة الطلب', formatCurrency(data.avg_order_value_sar ?? 0))}
                ${this._tile('طلبات مدفوعة (٣٠ يوماً)', paidOrders30d)}
                ${this._tile('التحويل إلى مدفوع', conversion == null ? '—' : formatPercent(conversion))}
                ${this._tile('العملاء المجانيون', freeUsers)}
                ${this._tile('أخطاء الدفع', paymentErrors)}
            </div>
            <div class="admin-section-grid admin-section-grid--executive">
                <section class="admin-card admin-revenue-health">
                    <div class="admin-card__heading-row">
                        <div>
                            <span class="admin-eyebrow">صحة الإيرادات</span>
                            <h3 class="admin-card__title">الإشارات التي تستحق المتابعة</h3>
                        </div>
                        <span class="admin-period-badge">٣٠ يوماً</span>
                    </div>
                    <div class="admin-signal-list">
                        <div class="admin-signal-row"><span>طلبات مسجلة</span><strong>${this._esc(totalOrders)}</strong></div>
                        <div class="admin-signal-row"><span>طلبات فاشلة أو ملغاة</span><strong>${this._esc(failedOrders)}</strong></div>
                        <div class="admin-signal-row"><span>معدل فشل الطلبات</span><strong>${this._esc(totalOrders ? formatPercent(failedOrders / totalOrders) : '—')}</strong></div>
                        <div class="admin-signal-row"><span>تركيز أعلى باقة</span><strong>${this._esc(topTierShare == null ? '—' : formatPercent(topTierShare))}</strong></div>
                        <div class="admin-signal-row"><span>أحداث أخطاء الدفع</span><strong>${this._esc(errorEvents)}</strong></div>
                    </div>
                </section>
                <section class="admin-card admin-revenue-alerts">
                    <span class="admin-eyebrow">مراقبة الإيرادات</span>
                    <h3 class="admin-card__title">إشعارات مالية</h3>
                    ${paymentErrors > 0
                        ? this._executiveAlert('أخطاء دفع', formatNumber(paymentErrors), 'danger', 'راجع حالات الدفع قبل إطلاق أي حملة أو تغيير سعري.')
                        : this._executiveAlert('بوابة الدفع', 'مستقرة', 'success', 'لا توجد أخطاء دفع مسجلة خلال الفترة المختارة.')}
                    ${topTierShare != null && topTierShare > 0.7
                        ? this._executiveAlert('تركيز الإيراد', formatPercent(topTierShare), 'warning', 'جزء كبير من الإيراد يأتي من باقة واحدة؛ راقب مخاطر الاعتماد.')
                        : ''}
                </section>
            </div>
            <div class="admin-card">
                <h3 class="admin-card__title">الإيراد اليومي (٩٠ يوماً)</h3>
                <div id="chartRevenueDaily"></div>
            </div>
            <div class="admin-section-grid">
                <div>
                    <h3 class="admin-card__title">حسب الباقة</h3>
                    ${this._table(['الباقة', 'العدد', 'الإيراد'], (data.by_tier || []).map((r) => [r.tier || '—', r.count, formatCurrency(r.revenue_sar || 0)]))}
                </div>
                <div>
                    <h3 class="admin-card__title">حسب مزوّد الدفع</h3>
                    ${this._table(['المزوّد', 'العدد', 'الإيراد'], (data.by_provider || []).map((r) => [r.provider || '—', r.count, formatCurrency(r.revenue_sar || 0)]))}
                </div>
                <div>
                    <h3 class="admin-card__title">حسب الحالة</h3>
                    ${this._table(['الحالة', 'العدد'], (data.by_status || []).map((r) => [r.status || '—', r.count]))}
                </div>
            </div>
            ${payload?.sourceWarnings?.length ? `<p class="admin-data-note">تعذر تحديث بعض مؤشرات الإيرادات: ${this._esc(payload.sourceWarnings.join('، '))}</p>` : ''}
        `;
        const daily = data.daily_revenue || [];
        this._renderTrendChart('chartRevenueDaily', 'الإيراد', daily.map((d) => ({ label: d.day, value: Number(d.revenue_sar || 0) })));
    }

    _renderReviewers(contentEl, data) {
        contentEl.innerHTML = `
            <div class="admin-tile-grid">
                ${this._tile('في الطابور', data.queued ?? 0)}
                ${this._tile('قيد المراجعة', data.in_review ?? 0)}
                ${this._tile('شهادات صادرة', data.certified_total ?? 0)}
                ${this._tile('مرفوضة', data.rejected_total ?? 0)}
                ${this._tile('متوسط زمن الإنجاز (ساعة)', data.avg_turnaround_hours ?? 0)}
                ${this._tile('مراجعون نشطون', data.active_reviewers ?? 0)}
            </div>
        `;
    }

    _renderSharing(contentEl, data) {
        contentEl.innerHTML = `
            <div class="admin-tile-grid">
                ${this._tile('إجمالي الروابط', data.total ?? 0)}
                ${this._tile('نشطة', data.active ?? 0)}
                ${this._tile('ملغاة', data.revoked ?? 0)}
                ${this._tile('منتهية', data.expired ?? 0)}
            </div>
        `;
    }

    async _renderReviewsTab(contentEl) {
        contentEl.innerHTML = '<p class="admin-loading">جارٍ التحميل…</p>';
        const result = await ReviewsService.getAllReviews();
        if (!result.ok) {
            contentEl.innerHTML = `<p class="admin-error">تعذّر تحميل التقييمات: ${this._esc(result.error)}</p>`;
            return;
        }
        const reviews = result.reviews || [];

        contentEl.innerHTML = `
            <div class="admin-card">
                <h3 class="admin-card__title">إضافة تقييم</h3>
                <form id="reviewAddForm" class="admin-review-form">
                    <div class="form-group">
                        <label for="revName">اسم العميل</label>
                        <input type="text" id="revName" required maxlength="120">
                    </div>
                    <div class="form-group">
                        <label for="revSector">القطاع (اختياري)</label>
                        <input type="text" id="revSector" maxlength="60" placeholder="مثال: مطاعم ومقاهي">
                    </div>
                    <div class="form-group admin-review-form__full">
                        <label for="revText">نص التقييم</label>
                        <textarea id="revText" required maxlength="600"></textarea>
                    </div>
                    <div class="form-group admin-review-form__full">
                        <label>التقييم</label>
                        <div class="admin-star-picker" role="radiogroup" aria-label="التقييم">
                            ${[1, 2, 3, 4, 5].map((n) => `
                                <label class="admin-star-picker__option">
                                    <input type="radio" name="revRating" value="${n}" required>
                                    <span>${renderStarsHtml(n, { size: 18 })}</span>
                                </label>
                            `).join('')}
                        </div>
                    </div>
                    <div class="form-group admin-review-form__full admin-review-form__row">
                        <label class="admin-review-form__checkbox">
                            <input type="checkbox" id="revPublished">
                            نشر فوراً
                        </label>
                        <button type="submit" class="btn btn--sm btn--primary">إضافة تقييم</button>
                    </div>
                </form>
            </div>
            <div class="admin-card">
                <h3 class="admin-card__title">كل التقييمات (${reviews.length})</h3>
                ${reviews.length ? `
                    <div class="admin-table-wrap">
                        <table class="admin-table">
                            <thead><tr><th>الاسم</th><th>التقييم</th><th>القطاع</th><th>الحالة</th><th>النص</th><th></th></tr></thead>
                            <tbody>
                                ${reviews.map((r) => `
                                    <tr>
                                        <td>${this._esc(r.customer_name)}</td>
                                        <td>${renderStarsHtml(r.rating, { size: 14 })}</td>
                                        <td>${this._esc(r.sector_label || '—')}</td>
                                        <td>${r.published ? 'منشور' : 'مسودة'}</td>
                                        <td>${this._esc((r.review_text || '').slice(0, 60))}${(r.review_text || '').length > 60 ? '…' : ''}</td>
                                        <td>
                                            <button class="btn btn--sm btn--ghost btn-toggle-review" data-id="${this._esc(r.id)}" data-published="${r.published ? '1' : '0'}">${r.published ? 'إخفاء' : 'نشر'}</button>
                                            <button class="btn btn--sm btn--ghost btn-delete-review" data-id="${this._esc(r.id)}" style="color:#c53030;">حذف</button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : '<p class="admin-table__empty">لا توجد تقييمات بعد.</p>'}
            </div>
        `;

        contentEl.querySelector('#reviewAddForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const ratingInput = contentEl.querySelector('input[name="revRating"]:checked');
            if (!ratingInput) {
                toast.error('يرجى اختيار عدد النجوم');
                return;
            }

            const submitBtn = e.target.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            const result = await ReviewsService.createReview({
                customer_name: contentEl.querySelector('#revName').value,
                review_text: contentEl.querySelector('#revText').value,
                rating: Number(ratingInput.value),
                sector_label: contentEl.querySelector('#revSector').value,
                published: contentEl.querySelector('#revPublished').checked,
            });
            submitBtn.disabled = false;

            if (!result.ok) {
                toast.error(result.error || 'فشل إضافة التقييم');
                return;
            }
            toast.success('تمت إضافة التقييم');
            await this._renderReviewsTab(contentEl);
        });

        contentEl.querySelectorAll('.btn-toggle-review').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const currentlyPublished = btn.dataset.published === '1';
                const result = await ReviewsService.updateReview(btn.dataset.id, { published: !currentlyPublished });
                if (!result.ok) {
                    toast.error(result.error || 'فشل تحديث الحالة');
                    return;
                }
                toast.success(currentlyPublished ? 'أُخفي التقييم' : 'نُشر التقييم');
                await this._renderReviewsTab(contentEl);
            });
        });

        contentEl.querySelectorAll('.btn-delete-review').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const confirmResult = await Swal.fire({
                    title: 'حذف التقييم؟',
                    text: 'لا يمكن التراجع عن هذا الإجراء.',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'نعم، احذف',
                    cancelButtonText: 'إلغاء',
                    customClass: { confirmButton: 'btn btn--sm btn--primary', cancelButton: 'btn btn--sm btn--ghost' },
                    buttonsStyling: false,
                });
                if (!confirmResult.isConfirmed) return;

                const result = await ReviewsService.deleteReview(btn.dataset.id);
                if (!result.ok) {
                    toast.error(result.error || 'فشل حذف التقييم');
                    return;
                }
                toast.success('تم حذف التقييم');
                await this._renderReviewsTab(contentEl);
            });
        });
    }

    /** نفس نمط _renderReviewsTab: بلا كاش (تحتاج جلباً حياً)، بناء HTML كامل ثم ربط
     * الأحداث، تحديث بإعادة-جلب-وإعادة-رسم كامل لا تحديث متفائل. */
    async _renderTicketsTab(contentEl) {
        contentEl.innerHTML = '<p class="admin-loading">جارٍ التحميل…</p>';
        const tickets = await TicketService.listAllTickets();

        const statusLabel = { open: 'مفتوحة', answered: 'تم الرد', closed: 'مُغلقة' };

        contentEl.innerHTML = `
            <div class="admin-card">
                <h3 class="admin-card__title">تذاكر الدعم الفني (${tickets.length})</h3>
                ${tickets.length ? tickets.map((t) => `
                    <div class="admin-card" data-ticket-admin-row="${this._esc(t.id)}" style="cursor:pointer;margin-top:12px;">
                        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
                            <div>
                                <div class="font-bold">
                                    ${t.category === 'funding_introduction' ? '<span class="badge badge--info" style="margin-inline-end:6px;">طلب تعريف تمويل</span>' : ''}${this._esc(t.subject)}
                                </div>
                                <div class="text-xs text-muted mt-1">${this._esc(t.user_id)} — ${new Date(t.updated_at).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric', numberingSystem: 'latn' })}</div>
                            </div>
                            <span class="badge ${t.status === 'open' ? 'badge--warning' : t.status === 'answered' ? 'badge--success' : 'badge--neutral'}">${statusLabel[t.status] || t.status}</span>
                        </div>
                        <div class="ticket-admin-thread mt-3" id="adminTicketThread-${this._esc(t.id)}" style="display:none;"></div>
                    </div>
                `).join('') : '<p class="admin-table__empty">لا توجد تذاكر دعم بعد.</p>'}
            </div>
        `;

        contentEl.querySelectorAll('[data-ticket-admin-row]').forEach((row) => {
            row.addEventListener('click', (e) => {
                if (e.target.closest('.ticket-admin-thread')) return;
                this._toggleAdminThread(contentEl, row.dataset.ticketAdminRow);
            });
        });
    }

    async _toggleAdminThread(contentEl, ticketId) {
        const threadEl = contentEl.querySelector(`#adminTicketThread-${ticketId}`);
        if (!threadEl) return;

        if (this.openTicketId === ticketId) {
            threadEl.style.display = 'none';
            this.openTicketId = null;
            return;
        }
        if (this.openTicketId) {
            const prev = contentEl.querySelector(`#adminTicketThread-${this.openTicketId}`);
            if (prev) prev.style.display = 'none';
        }
        this.openTicketId = ticketId;

        threadEl.style.display = 'block';
        threadEl.innerHTML = '<p class="admin-loading">جارٍ التحميل…</p>';
        const { ok, ticket, messages, error } = await TicketService.getTicketWithMessages(ticketId);
        if (!ok) { threadEl.innerHTML = `<p class="admin-error">${this._esc(error || 'تعذّر تحميل المحادثة')}</p>`; return; }

        this._renderAdminThread(contentEl, threadEl, ticket, messages);
    }

    _renderAdminThread(contentEl, threadEl, ticket, messages) {
        threadEl.innerHTML = `
            <div class="space-y-2 mb-3" style="max-height:260px;overflow-y:auto;">
                ${messages.map((m) => `
                    <div class="p-2 rounded text-sm" style="background:var(--c-surface-2);">
                        <div class="text-xs text-muted mb-1">${m.sender_type === 'admin' ? 'أنت (الدعم)' : 'العميل'} — ${new Date(m.created_at).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric', numberingSystem: 'latn' })}</div>
                        <div>${this._esc(m.body)}</div>
                    </div>
                `).join('')}
            </div>
            <div class="flex gap-2 mb-2">
                <textarea id="adminTicketReplyBody-${ticket.id}" class="form-input flex-1" rows="2" placeholder="اكتب رداً..."></textarea>
                <button type="button" class="btn btn--sm btn--primary" id="adminTicketReplyBtn-${ticket.id}">إرسال الرد</button>
            </div>
            <div id="adminTicketReplyError-${ticket.id}" class="text-danger text-sm mb-2" style="display:none;"></div>
            ${ticket.status !== 'closed'
                ? `<button type="button" class="btn btn--sm btn--ghost btn-close-ticket" data-id="${this._esc(ticket.id)}" style="color:#c53030;">إغلاق التذكرة</button>`
                : `<button type="button" class="btn btn--sm btn--ghost btn-reopen-ticket" data-id="${this._esc(ticket.id)}">إعادة فتح التذكرة</button>`}
        `;

        const replyBody = threadEl.querySelector(`#adminTicketReplyBody-${ticket.id}`);
        const replyErr = threadEl.querySelector(`#adminTicketReplyError-${ticket.id}`);
        threadEl.querySelector(`#adminTicketReplyBtn-${ticket.id}`)?.addEventListener('click', async (e) => {
            e.stopPropagation();
            const result = await TicketService.addMessage(ticket.id, replyBody.value);
            if (!result.ok) {
                replyErr.textContent = result.error || 'فشل إرسال الرد';
                replyErr.style.display = 'block';
                return;
            }
            toast.success('تم إرسال الرد');
            this.openTicketId = null;
            await this._renderTicketsTab(contentEl);
            await this._toggleAdminThread(contentEl, ticket.id);
        });

        threadEl.querySelector('.btn-close-ticket')?.addEventListener('click', async (e) => {
            e.stopPropagation();
            const confirmResult = await Swal.fire({
                title: 'إغلاق هذه التذكرة؟',
                text: 'يمكن للعميل إعادة فتحها لاحقاً بإرسال رسالة جديدة.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'نعم، أغلقها',
                cancelButtonText: 'إلغاء',
                customClass: { confirmButton: 'btn btn--sm btn--primary', cancelButton: 'btn btn--sm btn--ghost' },
                buttonsStyling: false,
            });
            if (!confirmResult.isConfirmed) return;

            const result = await TicketService.updateTicketStatus(ticket.id, 'closed');
            if (!result.ok) { toast.error(result.error || 'فشل إغلاق التذكرة'); return; }
            toast.success('تم إغلاق التذكرة');
            this.openTicketId = null;
            await this._renderTicketsTab(contentEl);
        });

        threadEl.querySelector('.btn-reopen-ticket')?.addEventListener('click', async (e) => {
            e.stopPropagation();
            const result = await TicketService.updateTicketStatus(ticket.id, 'open');
            if (!result.ok) { toast.error(result.error || 'فشل إعادة فتح التذكرة'); return; }
            toast.success('أُعيد فتح التذكرة');
            this.openTicketId = null;
            await this._renderTicketsTab(contentEl);
        });
    }

    _behaviorControlsHtml() {
        return `
            <div class="admin-behavior-controls">
                <h3 class="admin-card__title" style="margin:0;">السلوك خلال</h3>
                <select id="behaviorDaysSelect" class="admin-select">
                    <option value="7">٧ أيام</option>
                    <option value="30">٣٠ يوماً</option>
                    <option value="90">٩٠ يوماً</option>
                </select>
            </div>
        `;
    }

    async _renderBehaviorTab(contentEl) {
        contentEl.innerHTML = `${this._behaviorControlsHtml()}<p class="admin-loading">جارٍ التحميل…</p>`;

        const [totals, stepDropoff, exportFormats, wandUsage, errors, funnel] = await Promise.all([
            AdminService.getEventsStats(null, this.behaviorDays, null),
            AdminService.getEventsStats('wizard_step_view', this.behaviorDays, 'stepId'),
            AdminService.getEventsStats('export_click', this.behaviorDays, 'format'),
            AdminService.getEventsStats('ai_wand_use', this.behaviorDays, 'type'),
            AdminService.getEventsStats('error', this.behaviorDays, null),
            AdminService.getProductFunnelStats(this.behaviorDays),
        ]);

        if (!totals.ok) {
            contentEl.innerHTML = `${this._behaviorControlsHtml()}<p class="admin-error">تعذّر تحميل بيانات السلوك: ${this._esc(totals.error)}</p>`;
            this._bindBehaviorSelect(contentEl);
            return;
        }

        const totalsByEvent = totals.data.totals_by_event || [];
        const stepBreakdown = stepDropoff.ok ? (stepDropoff.data.by_prop || []) : [];
        const formatBreakdown = exportFormats.ok ? (exportFormats.data.by_prop || []) : [];
        const wandBreakdown = wandUsage.ok ? (wandUsage.data.by_prop || []) : [];
        const errorDaily = errors.ok ? (errors.data.daily || []) : [];
        const errorTotal = errorDaily.reduce((sum, d) => sum + Number(d.count || 0), 0);
        const totalEvents = totalsByEvent.reduce((sum, e) => sum + Number(e.count || 0), 0);
        const funnelData = funnel.ok ? (funnel.data || {}) : {};
        const totalUsers = Number(funnelData.paid_users || 0) + Number(funnelData.free_users || 0);
        const conversionRate = totalUsers ? `${((Number(funnelData.paid_users || 0) / totalUsers) * 100).toFixed(1)}%` : '—';

        // Calculate retention/dropoff table
        // Ensure steps are sorted numerically/logically
        const sortedSteps = [...stepBreakdown].sort((a, b) => Number(a.value) - Number(b.value));
        const maxViews = sortedSteps.length > 0 ? Number(sortedSteps[0].count) : 1;
        const stepTableRows = sortedSteps.map((e, index) => {
            const count = Number(e.count);
            const prevCount = index === 0 ? count : Number(sortedSteps[index - 1].count);
            // Relative to previous step (Drop-off)
            const dropOffPercent = prevCount === 0 ? 0 : Math.round(((prevCount - count) / prevCount) * 100);
            // Relative to max (Retention)
            const retentionPercent = Math.round((count / maxViews) * 100);

            // _table يعقّم كل خلية عبر _esc (يهرّب < و>)، فتمرير HTML هنا يعرض الوسوم
            // كنص خام. نمرّر قيماً نصية بسيطة (نسبة النجاة/التسرب) بدل أشرطة/وسوم HTML.
            const dropoffLabel = dropOffPercent > 0 ? `-${dropOffPercent}%` : '—';

            return [
                `خطوة ${e.value}`,
                count,
                `${retentionPercent}%`,
                dropoffLabel
            ];
        });

        // Time to complete cohorts (mocked from average since backend only provides avg right now)
        // Ideally we fetch a distribution from the backend, but we'll use the raw average and bucket it.
        let timeCohort = 'غير معروف';
        if (funnelData.avg_completion_minutes) {
            const mins = funnelData.avg_completion_minutes;
            if (mins < 60) timeCohort = 'أقل من ساعة (سريع جداً)';
            else if (mins < 24 * 60) timeCohort = 'أقل من يوم';
            else if (mins < 7 * 24 * 60) timeCohort = 'عدة أيام (من يوم لأسبوع)';
            else timeCohort = 'بطيء (أكثر من أسبوع)';
        }

        contentEl.innerHTML = `
            ${this._behaviorControlsHtml()}

            <!-- Quick Stats -->
            <div class="admin-tile-grid mb-4">
                ${this._tile('دراسات جديدة', funnelData.new_studies ?? '—')}
                ${this._tile('التحويل إلى مدفوع', conversionRate)}
                ${this._tile('أخطاء الدفع', funnelData.payment_errors ?? '—')}
                ${this._tile('وتيرة الإنجاز', timeCohort)}
                ${this._tile('إجمالي الأحداث', totalEvents)}
            ${this._tile('أخطاء مسجَّلة', errorTotal)}
            </div>

            <!-- Visual Funnel & Export Pie -->
            <div class="admin-section-grid" style="margin-bottom: var(--s-4);">
                <div class="admin-card" style="margin: 0; display: flex; flex-direction: column;">
                    <h3 class="admin-card__title">قمع التحويل (Conversion Funnel)</h3>
                    <div id="chartFunnel" style="flex: 1;"></div>
                </div>
                <div class="admin-card" style="margin: 0; display: flex; flex-direction: column;">
                    <h3 class="admin-card__title">صيغ التصدير المفضلة</h3>
                    <div id="chartExportPie" style="flex: 1; display: flex; align-items: center; justify-content: center;"></div>
                </div>
            </div>

            <!-- Retention Analysis -->
            <div class="admin-card mb-4" style="margin-bottom: var(--s-4);">
                <h3 class="admin-card__title">تحليل تسرب الويزارد (Drop-off Rate)</h3>
                <p class="text-sm text-muted mb-3">يوضح الجدول معدل النجاة (Retention) لكل خطوة بناءً على المشاهدات، ونسبة التسرب (Drop-off) مقارنة بالخطوة التي تسبقها. اللون الأحمر يدل على وجود عائق في تلك الخطوة.</p>
                ${this._table(['الخطوة', 'المشاهدات', 'النجاة (نسبة للمرحلة الأولى)', 'التسرب (عن الخطوة السابقة)'], stepTableRows)}
            </div>

            <div class="admin-section-grid">
                <div>
                    <h3 class="admin-card__title">أكثر الأحداث تكراراً</h3>
                    ${this._table(['الحدث', 'العدد'], totalsByEvent.map((e) => [e.event_name, e.count]))}
                </div>
                <div>
                    <h3 class="admin-card__title">استخدام العصا السحرية</h3>
                    ${this._table(['النوع', 'العدد'], wandBreakdown.map((e) => [e.value, e.count]))}
                </div>
            </div>
        `;

        this._bindBehaviorSelect(contentEl);

        // Render Funnel Chart
        // We will construct funnel points. We assume views > signups > starts > pays
        const funnelViews = totalEvents; // approximation for total traffic
        const funnelSignups = totalUsers;
        const funnelStudies = funnelData.new_studies || 0;
        const funnelPaid = funnelData.paid_users || 0;

        const funnelPoints = [
            { label: 'إنشاء دراسة', value: funnelStudies },
            { label: 'تحويل لمدفوع', value: funnelPaid }
        ];

        this._renderBarChart('chartFunnel', 'المستخدمون', funnelPoints, false);

        // Render Pie Chart
        const exportPoints = formatBreakdown.map(e => ({ label: e.value, value: Number(e.count) }));
        if (exportPoints.length > 0) {
            this._renderPieChart('chartExportPie', 'صيغة التصدير', exportPoints);
        } else {
            const pieContainer = document.getElementById('chartExportPie');
            if (pieContainer) pieContainer.innerHTML = '<p class="text-muted text-sm">لا توجد بيانات تصدير في هذه الفترة.</p>';
        }
    }

    _growthControlsHtml() {
        return `
            <div class="admin-behavior-controls">
                <div>
                    <span class="admin-eyebrow">النمو والاكتساب</span>
                    <h3 class="admin-card__title" style="margin:4px 0 0;">رحلة العميل من التسجيل إلى الدفع</h3>
                </div>
                <label class="admin-period-control">الفترة
                    <select id="growthDaysSelect" class="admin-select" aria-label="فترة النمو">
                        <option value="7">٧ أيام</option>
                        <option value="30">٣٠ يوماً</option>
                        <option value="90">٩٠ يوماً</option>
                    </select>
                </label>
            </div>
        `;
    }

    async _renderGrowthTab(contentEl) {
        contentEl.innerHTML = `${this._growthControlsHtml()}<p class="admin-loading">جارٍ تحميل مؤشرات النمو…</p>`;

        const days = this.growthDays;
        const [totals, signups, created, started, completed, checkout, paymentSuccess, paymentErrors, sources, campaigns, exports] = await Promise.all([
            AdminService.getEventsStats(null, days, null),
            AdminService.getEventsStats('signup_complete', days, null),
            AdminService.getEventsStats('study_created', days, null),
            AdminService.getEventsStats('study_start', days, null),
            AdminService.getEventsStats('study_complete', days, null),
            AdminService.getEventsStats('checkout_start', days, null),
            AdminService.getEventsStats('payment_success', days, null),
            AdminService.getEventsStats('payment_error', days, null),
            AdminService.getEventsStats(null, days, 'utm_source'),
            AdminService.getEventsStats(null, days, 'utm_campaign'),
            AdminService.getEventsStats('export_click', days, 'format'),
        ]);

        const eventCount = (result) => (result.ok ? (result.data?.daily || []).reduce((sum, row) => sum + Number(row.count || 0), 0) : 0);
        const totalEventCount = (totals.ok ? (totals.data?.totals_by_event || []) : [])
            .reduce((sum, row) => sum + Number(row.count || 0), 0);
        const signupCount = eventCount(signups);
        const createdCount = eventCount(created);
        const startedCount = eventCount(started);
        const completedCount = eventCount(completed);
        const checkoutCount = eventCount(checkout);
        const successCount = eventCount(paymentSuccess);
        const paymentErrorCount = eventCount(paymentErrors);
        const rate = (numerator, denominator) => denominator ? formatPercent(numerator / denominator) : '—';
        const warnings = [totals, signups, created, started, completed, checkout, paymentSuccess, paymentErrors, sources, campaigns, exports]
            .filter((result) => !result.ok)
            .map((result) => result.error)
            .filter(Boolean);

        contentEl.innerHTML = `
            ${this._growthControlsHtml()}
            <div class="admin-tile-grid admin-tile-grid--executive">
                ${this._tile('التسجيلات', formatNumber(signupCount))}
                ${this._tile('الدراسات المنشأة', formatNumber(createdCount))}
                ${this._tile('بدء المعالج', formatNumber(startedCount))}
                ${this._tile('إكمال المعالج', formatNumber(completedCount))}
                ${this._tile('بدء الدفع', formatNumber(checkoutCount))}
                ${this._tile('نجاح الدفع', formatNumber(successCount))}
                ${this._tile('أخطاء الدفع', formatNumber(paymentErrorCount))}
                ${this._tile('إجمالي الأحداث', formatNumber(totalEventCount))}
            </div>

            <div class="admin-section-grid admin-section-grid--executive">
                <section class="admin-card">
                    <span class="admin-eyebrow">معدلات الانتقال</span>
                    <h3 class="admin-card__title">أين يفقد المنتج المستخدمين؟</h3>
                    <div class="admin-signal-list">
                        <div class="admin-signal-row"><span>تسجيل ← إنشاء دراسة</span><strong>${this._esc(rate(createdCount, signupCount))}</strong></div>
                        <div class="admin-signal-row"><span>إنشاء ← بدء المعالج</span><strong>${this._esc(rate(startedCount, createdCount))}</strong></div>
                        <div class="admin-signal-row"><span>بدء ← إكمال المعالج</span><strong>${this._esc(rate(completedCount, startedCount))}</strong></div>
                        <div class="admin-signal-row"><span>بدء الدفع ← نجاح الدفع</span><strong>${this._esc(rate(successCount, checkoutCount))}</strong></div>
                    </div>
                </section>
                <section class="admin-card">
                    <span class="admin-eyebrow">قرار النمو</span>
                    <h3 class="admin-card__title">أولوية التحسين</h3>
                    ${paymentErrorCount > 0
                        ? this._executiveAlert('بوابة الدفع', formatNumber(paymentErrorCount), 'danger', 'أصلح تجربة الدفع قبل زيادة الإنفاق على اكتساب العملاء.')
                        : completedCount < startedCount
                            ? this._executiveAlert('إكمال المعالج', rate(completedCount, startedCount), 'warning', 'راجع الخطوات التي يتوقف عندها المستخدمون قبل الإكمال.')
                            : this._executiveAlert('رحلة العميل', 'جيدة', 'success', 'لا توجد إشارة حرجة في المسار المتاح خلال هذه الفترة.')}
                </section>
            </div>

            <div class="admin-card admin-growth-funnel-card">
                <h3 class="admin-card__title">قمع النمو</h3>
                <div id="chartGrowthFunnel"></div>
            </div>

            <div class="admin-section-grid">
                <div>
                    <h3 class="admin-card__title">مصادر الاكتساب</h3>
                    ${this._table(['المصدر', 'الأحداث'], (sources.data?.by_prop || []).map((row) => [row.value || 'مباشر/غير محدد', row.count]))}
                </div>
                <div>
                    <h3 class="admin-card__title">الحملات</h3>
                    ${this._table(['الحملة', 'الأحداث'], (campaigns.data?.by_prop || []).map((row) => [row.value || 'غير محددة', row.count]))}
                </div>
                <div>
                    <h3 class="admin-card__title">صيغ التصدير المستخدمة</h3>
                    ${this._table(['الصيغة', 'العدد'], (exports.data?.by_prop || []).map((row) => [row.value || '—', row.count]))}
                </div>
            </div>

            ${warnings.length ? `<p class="admin-data-note">تعذر تحديث بعض مؤشرات النمو: ${this._esc(warnings.join('، '))}</p>` : ''}
        `;

        this._renderBarChart('chartGrowthFunnel', 'الأحداث', [
            { label: 'تسجيل', value: signupCount },
            { label: 'إنشاء دراسة', value: createdCount },
            { label: 'بدء', value: startedCount },
            { label: 'إكمال', value: completedCount },
            { label: 'دفع ناجح', value: successCount },
        ], false);

        const select = contentEl.querySelector('#growthDaysSelect');
        if (select) {
            select.value = String(this.growthDays);
            select.addEventListener('change', async () => {
                this.growthDays = Number(select.value);
                await this._renderGrowthTab(contentEl);
            });
        }
    }

    async _renderAiTab(contentEl) {
        contentEl.innerHTML = `${this._growthControlsHtml().replace('growthDaysSelect', 'aiDaysSelect').replace('النمو والاكتساب', 'حوكمة الذكاء الاصطناعي').replace('رحلة العميل من التسجيل إلى الدفع', 'الاستخدام والجودة والتكلفة التشغيلية') }<p class="admin-loading">جارٍ تحميل مؤشرات الذكاء الاصطناعي…</p>`;

        const days = this.behaviorDays;
        const [completed, sources, outcomes, types, cacheHits, wandUsage, errors] = await Promise.all([
            AdminService.getEventsStats('ai_request_completed', days, null),
            AdminService.getEventsStats('ai_request_completed', days, 'source'),
            AdminService.getEventsStats('ai_request_completed', days, 'outcome'),
            AdminService.getEventsStats('ai_request_completed', days, 'type'),
            AdminService.getEventsStats('ai_cache_hit', days, null),
            AdminService.getEventsStats('ai_wand_use', days, 'type'),
            AdminService.getEventsStats('error', days, 'type'),
        ]);
        const count = (result) => result.ok ? (result.data?.daily || []).reduce((sum, row) => sum + Number(row.count || 0), 0) : 0;
        const byProp = (result) => result.ok ? (result.data?.by_prop || []) : [];
        const total = count(completed);
        const cache = count(cacheHits);
        const success = byProp(outcomes).find((row) => row.value === 'success')?.count || 0;
        const fallback = byProp(sources).filter((row) => ['fallback', 'internal'].includes(row.value)).reduce((sum, row) => sum + Number(row.count || 0), 0);
        const errorsCount = byProp(outcomes).filter((row) => ['error', 'empty'].includes(row.value)).reduce((sum, row) => sum + Number(row.count || 0), 0);
        const sourceRows = byProp(sources).map((row) => [row.value || '—', row.count]);
        const outcomeRows = byProp(outcomes).map((row) => [row.value || '—', row.count]);
        const warnings = [completed, sources, outcomes, types, cacheHits, wandUsage, errors].filter((result) => !result.ok).map((result) => result.error).filter(Boolean);

        contentEl.innerHTML = `
            ${this._growthControlsHtml().replace('growthDaysSelect', 'aiDaysSelect').replace('النمو والاكتساب', 'حوكمة الذكاء الاصطناعي').replace('رحلة العميل من التسجيل إلى الدفع', 'الاستخدام والجودة والتكلفة التشغيلية')}
            <div class="admin-tile-grid admin-tile-grid--executive">
                ${this._tile('طلبات الذكاء', formatNumber(total))}
                ${this._tile('نجاح التوليد', formatNumber(success))}
                ${this._tile('Fallback داخلي', formatNumber(fallback))}
                ${this._tile('أخطاء أو نتائج فارغة', formatNumber(errorsCount))}
                ${this._tile('إصابات الكاش', formatNumber(cache))}
                ${this._tile('نسبة الكاش', total + cache ? formatPercent(cache / (total + cache)) : '—')}
                ${this._tile('استخدام العصا السحرية', formatNumber(count(wandUsage)))}
                ${this._tile('أحداث أخطاء مرتبطة بالذكاء', formatNumber(count(errors)))}
            </div>
            <div class="admin-section-grid admin-section-grid--executive">
                <section class="admin-card">
                    <span class="admin-eyebrow">مصدر التوليد</span>
                    <h3 class="admin-card__title">داخلي، خادم، أو fallback</h3>
                    ${this._table(['المصدر', 'العدد'], sourceRows)}
                </section>
                <section class="admin-card">
                    <span class="admin-eyebrow">نتيجة الطلب</span>
                    <h3 class="admin-card__title">جودة التنفيذ</h3>
                    ${this._table(['النتيجة', 'العدد'], outcomeRows)}
                </section>
            </div>
            <div class="admin-section-grid">
                <div>
                    <h3 class="admin-card__title">أكثر أنواع الطلبات</h3>
                    ${this._table(['النوع', 'العدد'], byProp(types).map((row) => [row.value || '—', row.count]))}
                </div>
                <div>
                    <h3 class="admin-card__title">استخدام العصا السحرية</h3>
                    ${this._table(['النوع', 'العدد'], byProp(wandUsage).map((row) => [row.value || '—', row.count]))}
                </div>
            </div>
            ${warnings.length ? `<p class="admin-data-note">تعذر تحديث بعض مؤشرات الذكاء الاصطناعي: ${this._esc(warnings.join('، '))}</p>` : ''}
        `;

        const select = contentEl.querySelector('#aiDaysSelect');
        if (select) {
            select.value = String(this.behaviorDays);
            select.addEventListener('change', async () => {
                this.behaviorDays = Number(select.value);
                await this._renderAiTab(contentEl);
            });
        }
    }

    async _renderReliabilityTab(contentEl) {
        contentEl.innerHTML = `${this._growthControlsHtml().replace('growthDaysSelect', 'reliabilityDaysSelect').replace('النمو والاكتساب', 'الموثوقية').replace('رحلة العميل من التسجيل إلى الدفع', 'الأخطاء والأداء ومصادر التعثر')}<p class="admin-loading">جارٍ تحميل مؤشرات الموثوقية…</p>`;
        const days = this.behaviorDays;
        const [errors, allEvents, paths, types] = await Promise.all([
            AdminService.getEventsStats('error', days, null),
            AdminService.getEventsStats(null, days, null),
            AdminService.getEventsStats('error', days, 'path'),
            AdminService.getEventsStats('error', days, 'type'),
        ]);
        const count = (result) => result.ok ? (result.data?.daily || []).reduce((sum, row) => sum + Number(row.count || 0), 0) : 0;
        const errorTotal = count(errors);
        const totalEvents = (allEvents.ok ? (allEvents.data?.totals_by_event || []) : []).reduce((sum, row) => sum + Number(row.count || 0), 0);
        const errorRate = totalEvents ? formatPercent(errorTotal / totalEvents) : '—';
        const warnings = [errors, allEvents, paths, types].filter((result) => !result.ok).map((result) => result.error).filter(Boolean);

        contentEl.innerHTML = `
            ${this._growthControlsHtml().replace('growthDaysSelect', 'reliabilityDaysSelect').replace('النمو والاكتساب', 'الموثوقية').replace('رحلة العميل من التسجيل إلى الدفع', 'الأخطاء والأداء ومصادر التعثر')}
            <div class="admin-tile-grid admin-tile-grid--executive">
                ${this._tile('الأخطاء', formatNumber(errorTotal))}
                ${this._tile('إجمالي الأحداث', formatNumber(totalEvents))}
                ${this._tile('معدل الخطأ', errorRate)}
                ${this._tile('المسارات المتأثرة', formatNumber((paths.data?.by_prop || []).length))}
                ${this._tile('أنواع الخطأ', formatNumber((types.data?.by_prop || []).length))}
                ${this._tile('نافذة القياس', `${days} يومًا`)}
            </div>
            <div class="admin-section-grid admin-section-grid--executive">
                <section class="admin-card">
                    <span class="admin-eyebrow">اتجاه الاستقرار</span>
                    <h3 class="admin-card__title">الأخطاء اليومية</h3>
                    <div id="chartReliabilityErrors"></div>
                </section>
                <section class="admin-card">
                    <span class="admin-eyebrow">قرار التشغيل</span>
                    <h3 class="admin-card__title">حالة الخدمة</h3>
                    ${errorTotal > 0
                        ? this._executiveAlert('تحتاج متابعة', errorRate, errorTotal / Math.max(totalEvents, 1) > 0.05 ? 'danger' : 'warning', 'ابدأ بالمسار الأكثر تكراراً ثم راجع سجل الحدث قبل تعديل الكود.')
                        : this._executiveAlert('مستقرة', '0', 'success', 'لم تسجل أحداث أخطاء في الفترة الحالية.')}
                </section>
            </div>
            <div class="admin-section-grid">
                <div>
                    <h3 class="admin-card__title">أكثر المسارات تأثراً</h3>
                    ${this._table(['المسار', 'الأخطاء'], (paths.data?.by_prop || []).map((row) => [row.value || 'غير محدد', row.count]))}
                </div>
                <div>
                    <h3 class="admin-card__title">أنواع الأخطاء</h3>
                    ${this._table(['النوع', 'الأخطاء'], (types.data?.by_prop || []).map((row) => [row.value || 'غير محدد', row.count]))}
                </div>
            </div>
            ${warnings.length ? `<p class="admin-data-note">تعذر تحديث بعض مؤشرات الموثوقية: ${this._esc(warnings.join('، '))}</p>` : ''}
        `;
        this._renderTrendChart('chartReliabilityErrors', 'أخطاء', (errors.data?.daily || []).map((row) => ({ label: row.day, value: Number(row.count || 0) })));
        const select = contentEl.querySelector('#reliabilityDaysSelect');
        if (select) {
            select.value = String(this.behaviorDays);
            select.addEventListener('change', async () => {
                this.behaviorDays = Number(select.value);
                await this._renderReliabilityTab(contentEl);
            });
        }
    }

    async _renderSecurityTab(contentEl) {
        contentEl.innerHTML = `${this._growthControlsHtml().replace('growthDaysSelect', 'securityDaysSelect').replace('النمو والاكتساب', 'الأمان والخصوصية').replace('رحلة العميل من التسجيل إلى الدفع', 'صحة المصادقة والخصوصية')}<p class="admin-loading">جاري تحميل مؤشرات الأمان…</p>`;
        const days = this.behaviorDays;
        const eventStats = (name, group = null) => AdminService.getEventsStats(name, days, group);
        const [loginSuccess, loginFailed, signupSuccess, signupFailed, mfaFailed, errors, phones] = await Promise.all([
            eventStats('login_complete'),
            eventStats('login_failed'),
            eventStats('signup_complete'),
            eventStats('signup_error'),
            eventStats('mfa_failed'),
            eventStats('error', 'path'),
            typeof AdminService.getUnverifiedPhones === 'function' ? AdminService.getUnverifiedPhones() : Promise.resolve({ ok: true, data: [] }),
        ]);
        const total = (result) => result?.ok ? (result.data?.daily || []).reduce((sum, row) => sum + Number(row.count || 0), 0) : 0;
        const successfulLogins = total(loginSuccess);
        const failedLogins = total(loginFailed);
        const successfulSignups = total(signupSuccess);
        const failedSignups = total(signupFailed);
        const mfaFailures = total(mfaFailed);
        const attempts = successfulLogins + failedLogins;
        const authFailureRate = attempts ? formatPercent(failedLogins / attempts) : '—';
        const unverifiedCount = Array.isArray(phones.data) ? phones.data.length : Number(phones.data?.count || 0);
        const warnings = [loginSuccess, loginFailed, signupSuccess, signupFailed, mfaFailed, errors, phones]
            .filter((result) => !result.ok).map((result) => result.error).filter(Boolean);
        const topErrorPaths = errors.ok ? (errors.data?.by_prop || []) : [];

        contentEl.innerHTML = `
            ${this._growthControlsHtml().replace('growthDaysSelect', 'securityDaysSelect').replace('النمو والاكتساب', 'الأمان والخصوصية').replace('رحلة العميل من التسجيل إلى الدفع', 'صحة المصادقة والخصوصية')}
            <div class="admin-tile-grid admin-tile-grid--executive">
                ${this._tile('تسجيلات الدخول الناجحة', formatNumber(successfulLogins))}
                ${this._tile('محاولات الدخول الفاشلة', formatNumber(failedLogins))}
                ${this._tile('معدل فشل الدخول', authFailureRate)}
                ${this._tile('الحسابات المنشأة', formatNumber(successfulSignups))}
                ${this._tile('أخطاء إنشاء الحساب', formatNumber(failedSignups))}
                ${this._tile('إخفاقات MFA', formatNumber(mfaFailures))}
                ${this._tile('هواتف بانتظار التحقق', formatNumber(unverifiedCount))}
                ${this._tile('نافذة القياس', `${days} يومًا`)}
            </div>
            <div class="admin-section-grid admin-section-grid--executive">
                <section class="admin-card">
                    <span class="admin-eyebrow">مؤشر الحماية</span>
                    <h3 class="admin-card__title">حالة المصادقة</h3>
                    ${failedLogins > 0
                        ? this._executiveAlert('تحتاج متابعة', authFailureRate, failedLogins / Math.max(attempts, 1) > 0.2 ? 'danger' : 'warning', 'راجع مسارات الدخول الفاشلة وتأكد من عدم وجود نمط تخمين أو مشكلة في مزود المصادقة.')
                        : this._executiveAlert('مستقرة', '0', 'success', 'لم تسجل محاولات دخول فاشلة خلال نافذة القياس الحالية.')}
                </section>
                <section class="admin-card">
                    <span class="admin-eyebrow">ضوابط الخصوصية</span>
                    <h3 class="admin-card__title">بيانات حساسة خارج التحليلات</h3>
                    <p class="admin-data-note">تسجل الأحداث نوع النتيجة والسبب العام ومزود الدخول فقط. لا يتم إرسال البريد أو كلمة المرور أو محتوى الدراسة إلى لوحة الإدارة.</p>
                    ${unverifiedCount > 0 ? this._executiveAlert('إجراء مطلوب', formatNumber(unverifiedCount), 'warning', 'تابع قائمة الهواتف غير المؤكدة قبل استخدامها في التواصل التشغيلي.') : ''}
                </section>
            </div>
            <div class="admin-section-grid">
                <div>
                    <h3 class="admin-card__title">أكثر المسارات تسجيلًا للأخطاء</h3>
                    ${this._table(['المسار', 'الأخطاء'], topErrorPaths.map((row) => [row.value || 'غير محدد', row.count]))}
                </div>
                <div>
                    <h3 class="admin-card__title">فحوصات الحوكمة</h3>
                    ${this._table(['الفحص', 'النتيجة'], [
                        ['تتبع الدخول الناجح', successfulLogins > 0 ? 'متصل' : 'لا توجد بيانات'],
                        ['تتبع الدخول الفاشل', loginFailed.ok ? 'متصل' : 'تحذير'],
                        ['تتبع MFA', mfaFailed.ok ? 'متصل' : 'تحذير'],
                        ['قائمة التحقق الهاتفي', phones.ok ? 'متصل' : 'تحذير'],
                    ])}
                </div>
            </div>
            ${warnings.length ? `<p class="admin-data-note">تعذر تحديث بعض فحوصات الأمان: ${this._esc(warnings.join('، '))}</p>` : ''}
        `;
        const select = contentEl.querySelector('#securityDaysSelect');
        if (select) {
            select.value = String(this.behaviorDays);
            select.addEventListener('change', async () => {
                this.behaviorDays = Number(select.value);
                await this._renderSecurityTab(contentEl);
            });
        }
    }

    async _renderQualityTab(contentEl) {
        contentEl.innerHTML = `${this._growthControlsHtml().replace('growthDaysSelect', 'qualityDaysSelect').replace('النمو والاكتساب', 'جودة البيانات').replace('رحلة العميل من التسجيل إلى الدفع', 'اكتمال البيانات وتناسقها')}<p class="admin-loading">جاري فحص جودة البيانات…</p>`;
        const days = this.behaviorDays;
        const [overview, studies, users, revenue, funnel, events, phones] = await Promise.all([
            AdminService.getOverview(),
            AdminService.getStudiesStats(),
            AdminService.getUsersStats(),
            AdminService.getRevenueStats(),
            AdminService.getProductFunnelStats(days),
            AdminService.getEventsStats(null, days, null),
            typeof AdminService.getUnverifiedPhones === 'function' ? AdminService.getUnverifiedPhones() : Promise.resolve({ ok: true, data: [] }),
        ]);
        const results = { overview, studies, users, revenue, funnel, events, phones };
        const healthySources = Object.values(results).filter((result) => result.ok).length;
        const sourceCount = Object.keys(results).length;
        const qualityScore = Math.round((healthySources / sourceCount) * 100);
        const eventTotal = events.ok ? (events.data?.totals_by_event || []).reduce((sum, row) => sum + Number(row.count || 0), 0) : 0;
        const studyTotal = Number(overview.data?.total_studies || 0);
        const userTotal = Number(overview.data?.total_users || 0);
        const missingPhoneCount = Array.isArray(phones.data) ? phones.data.length : Number(phones.data?.count || 0);
        const warnings = Object.entries(results).filter(([, result]) => !result.ok).map(([key, result]) => `${key}: ${result.error || 'غير متاح'}`);
        const checks = [
            ['مصدر النظرة العامة', overview.ok && studyTotal >= 0],
            ['إحصاءات الدراسات', studies.ok],
            ['إحصاءات المستخدمين', users.ok],
            ['إحصاءات الإيرادات', revenue.ok],
            ['قمع المنتج', funnel.ok],
            ['سجل الأحداث', events.ok && eventTotal >= 0],
            ['بيانات التحقق الهاتفي', phones.ok],
        ];

        contentEl.innerHTML = `
            ${this._growthControlsHtml().replace('growthDaysSelect', 'qualityDaysSelect').replace('النمو والاكتساب', 'جودة البيانات').replace('رحلة العميل من التسجيل إلى الدفع', 'اكتمال البيانات وتناسقها')}
            <div class="admin-tile-grid admin-tile-grid--executive">
                ${this._tile('درجة جودة المصادر', `${qualityScore}%`)}
                ${this._tile('مصادر متصلة', `${healthySources}/${sourceCount}`)}
                ${this._tile('إجمالي الدراسات', formatNumber(studyTotal))}
                ${this._tile('إجمالي المستخدمين', formatNumber(userTotal))}
                ${this._tile('أحداث نافذة القياس', formatNumber(eventTotal))}
                ${this._tile('هواتف غير مؤكدة', formatNumber(missingPhoneCount))}
            </div>
            <div class="admin-section-grid admin-section-grid--executive">
                <section class="admin-card">
                    <span class="admin-eyebrow">التحقق الآلي</span>
                    <h3 class="admin-card__title">سلامة مصادر البيانات</h3>
                    ${qualityScore < 100
                        ? this._executiveAlert('تحتاج إصلاحًا', `${qualityScore}%`, qualityScore < 70 ? 'danger' : 'warning', 'أصلح مصادر البيانات غير المتاحة قبل اعتماد التقرير التنفيذي.')
                        : this._executiveAlert('مكتملة', '100%', 'success', 'كل مصادر لوحة الإدارة متاحة ويمكن استخدامها في التقارير.')}
                </section>
                <section class="admin-card">
                    <span class="admin-eyebrow">الاكتمال</span>
                    <h3 class="admin-card__title">إشارات جودة إضافية</h3>
                    <p class="admin-data-note">تتم مقارنة المصادر معًا لمنع عرض أرقام معزولة. يظهر عدد الأحداث والهواتف غير المؤكدة كإشارات تشغيلية مستقلة.</p>
                </section>
            </div>
            <div class="admin-section-grid">
                <div>
                    <h3 class="admin-card__title">فحوصات المصادر</h3>
                    ${this._table(['المصدر', 'الحالة'], checks.map(([label, ok]) => [label, ok ? 'سليم' : 'يحتاج مراجعة']))}
                </div>
                <div>
                    <h3 class="admin-card__title">البيانات المرجعية</h3>
                    ${this._table(['المؤشر', 'القيمة'], [
                        ['الفترة', `${days} يومًا`],
                        ['آخر يوم مسجل', events.data?.daily?.at?.(-1)?.day || 'غير متاح'],
                        ['إشارات النقص', warnings.length],
                        ['بيانات هاتف تحتاج متابعة', missingPhoneCount],
                    ])}
                </div>
            </div>
            ${warnings.length ? `<p class="admin-data-note">مصادر تحتاج مراجعة: ${this._esc(warnings.join('، '))}</p>` : ''}
        `;
        const select = contentEl.querySelector('#qualityDaysSelect');
        if (select) {
            select.value = String(this.behaviorDays);
            select.addEventListener('change', async () => {
                this.behaviorDays = Number(select.value);
                await this._renderQualityTab(contentEl);
            });
        }
    }

    async _renderInvestorTab(contentEl) {
        const days = this.behaviorDays;
        contentEl.innerHTML = `${this._growthControlsHtml().replace('growthDaysSelect', 'investorDaysSelect')}<p class="admin-loading">جاري تحميل سلوك المستثمرين…</p>`;
        const stats = (name, group = null) => AdminService.getEventsStats(name, days, group);
        const [sharing, views, prints, referrals, created, revoked, feedback] = await Promise.all([
            AdminService.getSharingStats(),
            stats('share_view', 'view_mode'),
            stats('share_print'),
            stats('share_referral_click'),
            stats('share_link_created'),
            stats('share_link_revoked'),
            stats('share_feedback_submitted', 'kind'),
        ]);
        const total = (result) => result?.ok ? (result.data?.daily || []).reduce((sum, row) => sum + Number(row.count || 0), 0) : 0;
        const shareTotal = Number(sharing.data?.total || 0);
        const activeShares = Number(sharing.data?.active || 0);
        const shareViews = total(views);
        const printCount = total(prints);
        const referralCount = total(referrals);
        const createdCount = total(created);
        const revokedCount = total(revoked);
        const warnings = [sharing, views, prints, referrals, created, revoked, feedback].filter((result) => !result.ok).map((result) => result.error).filter(Boolean);
        const viewRate = createdCount ? formatPercent(shareViews / createdCount) : '—';

        contentEl.innerHTML = `
            ${this._growthControlsHtml().replace('growthDaysSelect', 'investorDaysSelect')}
            <div class="admin-tile-grid admin-tile-grid--executive">
                ${this._tile('إجمالي روابط المشاركة', formatNumber(shareTotal))}
                ${this._tile('الروابط النشطة', formatNumber(activeShares))}
                ${this._tile('مشاهدات المستثمرين', formatNumber(shareViews))}
                ${this._tile('معدل المشاهدة للرابط', viewRate)}
                ${this._tile('محاولات الطباعة', formatNumber(printCount))}
                ${this._tile('نقرات الإحالة', formatNumber(referralCount))}
                ${this._tile('روابط أنشئت', formatNumber(createdCount))}
                ${this._tile('روابط ألغيت', formatNumber(revokedCount))}
            </div>
            <div class="admin-section-grid admin-section-grid--executive">
                <section class="admin-card">
                    <span class="admin-eyebrow">قيمة المشاركة</span>
                    <h3 class="admin-card__title">هل وصلت الدراسة إلى المستثمر؟</h3>
                    ${shareViews > 0
                        ? this._executiveAlert('نشطة', formatNumber(shareViews), 'success', 'توجد مشاهدات خارجية فعلية يمكن ربطها بمحتوى العرض وتحسينه.')
                        : this._executiveAlert('لا توجد مشاهدات', '0', 'warning', 'تحقق من نشر الروابط أو من إعدادات تسجيل أحداث صفحة المستثمر.')}
                </section>
                <section class="admin-card">
                    <span class="admin-eyebrow">الخصوصية</span>
                    <h3 class="admin-card__title">مخرجات آمنة للمشاركة</h3>
                    <p class="admin-data-note">يتم تسجيل نوع التفاعل فقط. لا يتم إرسال رمز الرابط أو اسم المشروع أو بيانات المستثمر إلى سجل الأحداث.</p>
                </section>
            </div>
            <div class="admin-section-grid">
                <div>
                    <h3 class="admin-card__title">أنواع المشاهدة</h3>
                    ${this._table(['الوضع', 'المشاهدات'], (views.data?.by_prop || []).map((row) => [row.value || 'غير محدد', row.count]))}
                </div>
                <div>
                    <h3 class="admin-card__title">تفاعل المستثمر</h3>
                    ${this._table(['التفاعل', 'العدد'], [
                        ['مشاهدة الرابط', shareViews],
                        ['طباعة / PDF', printCount],
                        ['العودة للتجربة', referralCount],
                        ['ملاحظات المشاركة', total(feedback)],
                    ])}
                </div>
            </div>
            ${warnings.length ? `<p class="admin-data-note">تعذر تحديث بعض مؤشرات المشاركة: ${this._esc(warnings.join('، '))}</p>` : ''}
        `;
        const select = contentEl.querySelector('#investorDaysSelect');
        if (select) {
            select.value = String(this.behaviorDays);
            select.addEventListener('change', async () => {
                this.behaviorDays = Number(select.value);
                await this._renderInvestorTab(contentEl);
            });
        }
    }

    async _renderIndustryTab(contentEl) {
        const days = this.behaviorDays;
        contentEl.innerHTML = `${this._growthControlsHtml().replace('growthDaysSelect', 'industryDaysSelect')}<p class="admin-loading">جاري تحليل القطاعات والقوالب…</p>`;
        const [studies, created, completed, steps, exports] = await Promise.all([
            AdminService.getStudiesStats(),
            AdminService.getEventsStats('study_created', days, 'source'),
            AdminService.getEventsStats('study_complete', days, null),
            AdminService.getEventsStats('wizard_step_view', days, 'stepId'),
            AdminService.getEventsStats('export_click', days, 'format'),
        ]);
        const total = (result) => result?.ok ? (result.data?.daily || []).reduce((sum, row) => sum + Number(row.count || 0), 0) : 0;
        const bySector = studies.data?.by_sector || [];
        const sourceRows = created.data?.by_prop || [];
        const studyCreated = total(created);
        const studyCompleted = total(completed);
        const completionRate = studyCreated ? formatPercent(studyCompleted / studyCreated) : '—';
        const warnings = [studies, created, completed, steps, exports].filter((result) => !result.ok).map((result) => result.error).filter(Boolean);
        const topSector = bySector[0]?.sector || bySector[0]?.value || 'غير متاح';

        contentEl.innerHTML = `
            ${this._growthControlsHtml().replace('growthDaysSelect', 'industryDaysSelect')}
            <div class="admin-tile-grid admin-tile-grid--executive">
                ${this._tile('أكثر قطاع طلبًا', this._esc(topSector))}
                ${this._tile('دراسات منشأة', formatNumber(studyCreated))}
                ${this._tile('دراسات مكتملة', formatNumber(studyCompleted))}
                ${this._tile('معدل الإكمال', completionRate)}
                ${this._tile('خطوات الويزارد المرصودة', formatNumber((steps.data?.by_prop || []).length))}
                ${this._tile('صيغ التصدير', formatNumber((exports.data?.by_prop || []).length))}
            </div>
            <div class="admin-section-grid admin-section-grid--executive">
                <section class="admin-card">
                    <span class="admin-eyebrow">الطلب القطاعي</span>
                    <h3 class="admin-card__title">ترتيب القطاعات لبناء القوالب</h3>
                    ${this._table(['القطاع', 'الدراسات'], bySector.map((row) => [row.sector || row.value || 'غير محدد', row.count]))}
                </section>
                <section class="admin-card">
                    <span class="admin-eyebrow">مصدر الإنشاء</span>
                    <h3 class="admin-card__title">قالب أم بداية فارغة؟</h3>
                    ${this._table(['المصدر', 'العدد'], sourceRows.map((row) => [row.value || 'غير محدد', row.count]))}
                </section>
            </div>
            <div class="admin-section-grid">
                <div>
                    <h3 class="admin-card__title">أكثر خطوات الويزارد مشاهدة</h3>
                    ${this._table(['الخطوة', 'المشاهدات'], (steps.data?.by_prop || []).map((row) => [row.value || 'غير محدد', row.count]))}
                </div>
                <div>
                    <h3 class="admin-card__title">أشكال التصدير المطلوبة</h3>
                    ${this._table(['الصيغة', 'العدد'], (exports.data?.by_prop || []).map((row) => [row.value || 'غير محدد', row.count]))}
                </div>
            </div>
            ${warnings.length ? `<p class="admin-data-note">تعذر تحديث بعض مؤشرات القطاعات: ${this._esc(warnings.join('، '))}</p>` : ''}
        `;
        const select = contentEl.querySelector('#industryDaysSelect');
        if (select) {
            select.value = String(this.behaviorDays);
            select.addEventListener('change', async () => {
                this.behaviorDays = Number(select.value);
                await this._renderIndustryTab(contentEl);
            });
        }
    }

    async _renderPlatformTab(contentEl) {
        const days = this.behaviorDays;
        contentEl.innerHTML = '<p class="admin-loading">جاري تحليل الجمهور والمنصات…</p>';
        const stats = (key) => AdminService.getEventsStats(null, days, key);
        const [events, devices, browsers, languages, timezones, sources] = await Promise.all([
            AdminService.getEventsStats(null, days, null),
            stats('device_type'),
            stats('browser'),
            stats('language'),
            stats('timezone'),
            stats('utm_source'),
        ]);
        const totalEvents = events.ok ? (events.data?.totals_by_event || []).reduce((sum, row) => sum + Number(row.count || 0), 0) : 0;
        const warnings = [events, devices, browsers, languages, timezones, sources].filter((result) => !result.ok).map((result) => result.error).filter(Boolean);
        const rows = (result) => (result.data?.by_prop || []).map((row) => [row.value || 'غير محدد', row.count]);

        contentEl.innerHTML = `
            <div class="admin-behavior-controls">
                <div><span class="admin-eyebrow">الجمهور والمنصات</span><h3 class="admin-card__title" style="margin:4px 0 0;">من يستخدم التطبيق وكيف يصل إليه؟</h3></div>
                <label class="admin-period-control">الفترة<select id="platformDaysSelect" class="admin-select"><option value="7">7 أيام</option><option value="30">30 يومًا</option><option value="90">90 يومًا</option></select></label>
            </div>
            <div class="admin-tile-grid admin-tile-grid--executive">
                ${this._tile('الأحداث المرصودة', formatNumber(totalEvents))}
                ${this._tile('أنواع الأجهزة', formatNumber((devices.data?.by_prop || []).length))}
                ${this._tile('المتصفحات', formatNumber((browsers.data?.by_prop || []).length))}
                ${this._tile('اللغات', formatNumber((languages.data?.by_prop || []).length))}
                ${this._tile('المناطق الزمنية', formatNumber((timezones.data?.by_prop || []).length))}
                ${this._tile('مصادر UTM', formatNumber((sources.data?.by_prop || []).length))}
            </div>
            <div class="admin-section-grid admin-section-grid--executive">
                <section class="admin-card"><span class="admin-eyebrow">الأجهزة والمتصفحات</span><h3 class="admin-card__title">أولوية المنصة</h3>${this._table(['الجهاز', 'الأحداث'], rows(devices))}${this._table(['المتصفح', 'الأحداث'], rows(browsers))}</section>
                <section class="admin-card"><span class="admin-eyebrow">اللغة والمنطقة</span><h3 class="admin-card__title">سياق الوصول</h3>${this._table(['اللغة', 'الأحداث'], rows(languages))}${this._table(['المنطقة الزمنية', 'الأحداث'], rows(timezones))}</section>
            </div>
            <section class="admin-card"><h3 class="admin-card__title">مصادر الاكتساب</h3>${this._table(['المصدر', 'الأحداث'], rows(sources))}</section>
            <p class="admin-data-note">السياق المضاف مجهول ومحدود إلى نوع الجهاز والمتصفح واللغة والمنطقة الزمنية. لا يتم حفظ عنوان IP أو بصمة الجهاز.</p>
            ${warnings.length ? `<p class="admin-data-note">تعذر تحديث بعض شرائح الجمهور: ${this._esc(warnings.join('، '))}</p>` : ''}
        `;
        const select = contentEl.querySelector('#platformDaysSelect');
        if (select) {
            select.value = String(this.behaviorDays);
            select.addEventListener('change', async () => {
                this.behaviorDays = Number(select.value);
                await this._renderPlatformTab(contentEl);
            });
        }
    }

    async _renderExperimentsTab(contentEl) {
        const days = this.behaviorDays;
        contentEl.innerHTML = '<p class="admin-loading">جاري تحليل التجارب…</p>';
        const [checkout, success, errors, preference] = await Promise.all([
            AdminService.getEventsStats('checkout_start', days, 'experiment_pricing_cards'),
            AdminService.getEventsStats('payment_success', days, 'experiment_pricing_cards'),
            AdminService.getEventsStats('payment_error', days, 'experiment_pricing_cards'),
            AdminService.getEventsStats('package_preference_selected', days, 'tier'),
        ]);
        const checkoutRows = checkout.data?.by_prop || [];
        const successRows = success.data?.by_prop || [];
        const errorRows = errors.data?.by_prop || [];
        const variants = [...new Set([...checkoutRows, ...successRows, ...errorRows].map((row) => row.value).filter(Boolean))];
        const countFor = (rows, value) => Number(rows.find((row) => row.value === value)?.count || 0);
        const total = (result) => result?.ok ? (result.data?.daily || []).reduce((sum, row) => sum + Number(row.count || 0), 0) : 0;
        const warnings = [checkout, success, errors, preference].filter((result) => !result.ok).map((result) => result.error).filter(Boolean);
        const variantTable = variants.map((variant) => {
            const starts = countFor(checkoutRows, variant);
            const wins = countFor(successRows, variant);
            const failed = countFor(errorRows, variant);
            return [variant, starts, wins, failed, starts ? formatPercent(wins / starts) : '—'];
        });

        contentEl.innerHTML = `
            <div class="admin-behavior-controls"><div><span class="admin-eyebrow">التجارب A/B</span><h3 class="admin-card__title" style="margin:4px 0 0;">قرار مبني على نتيجة الدفع</h3></div><label class="admin-period-control">الفترة<select id="experimentsDaysSelect" class="admin-select"><option value="7">7 أيام</option><option value="30">30 يومًا</option><option value="90">90 يومًا</option></select></label></div>
            <div class="admin-tile-grid admin-tile-grid--executive">
                ${this._tile('التجربة النشطة', 'ترتيب الباقات')}
                ${this._tile('بدء الدفع', formatNumber(total(checkout)))}
                ${this._tile('نجاح الدفع', formatNumber(total(success)))}
                ${this._tile('أخطاء الدفع', formatNumber(total(errors)))}
                ${this._tile('البدائل المرصودة', formatNumber(variants.length))}
                ${this._tile('اختيارات الباقة', formatNumber(total(preference)))}
            </div>
            <section class="admin-card"><span class="admin-eyebrow">النتيجة الأساسية</span><h3 class="admin-card__title">التحويل حسب النسخة</h3>${this._table(['النسخة', 'بدء الدفع', 'نجاح الدفع', 'الفشل', 'التحويل'], variantTable)}</section>
            <div class="admin-section-grid"><section class="admin-card"><h3 class="admin-card__title">اختيارات الباقات</h3>${this._table(['الباقة', 'الاختيارات'], (preference.data?.by_prop || []).map((row) => [row.value || 'غير محدد', row.count]))}</section><section class="admin-card"><h3 class="admin-card__title">قاعدة القرار</h3><p class="admin-data-note">لا يتم إعلان نسخة فائزة قبل توفر حجم كافٍ من عمليات الدفع الناجحة. النقرات وحدها لا تكفي لاتخاذ قرار تسعيري.</p></section></div>
            ${warnings.length ? `<p class="admin-data-note">تعذر تحديث بعض بيانات التجربة: ${this._esc(warnings.join('، '))}</p>` : ''}
        `;
        const select = contentEl.querySelector('#experimentsDaysSelect');
        if (select) {
            select.value = String(this.behaviorDays);
            select.addEventListener('change', async () => {
                this.behaviorDays = Number(select.value);
                await this._renderExperimentsTab(contentEl);
            });
        }
    }

    async _renderSubscriptionsTab(contentEl) {
        const days = this.behaviorDays;
        contentEl.innerHTML = '<p class="admin-loading">جاري تحليل الاشتراكات والباقات…</p>';
        const [revenue, starts, successes, errors, preferences] = await Promise.all([
            AdminService.getRevenueStats(),
            AdminService.getEventsStats('checkout_start', days, 'tier'),
            AdminService.getEventsStats('payment_success', days, null),
            AdminService.getEventsStats('payment_error', days, 'provider'),
            AdminService.getEventsStats('package_preference_selected', days, 'tier'),
        ]);
        const revenueData = revenue.ok ? (revenue.data || {}) : {};
        const tierRows = Array.isArray(revenueData.by_tier) ? revenueData.by_tier : [];
        const providerRows = Array.isArray(revenueData.by_provider) ? revenueData.by_provider : [];
        const startRows = starts.data?.by_prop || [];
        const preferenceRows = preferences.data?.by_prop || [];
        const successTotal = successes.ok ? (successes.data?.daily || []).reduce((sum, row) => sum + Number(row.count || 0), 0) : 0;
        const errorTotal = errors.ok ? (errors.data?.daily || []).reduce((sum, row) => sum + Number(row.count || 0), 0) : 0;
        const warnings = [revenue, starts, successes, errors, preferences].filter((result) => !result.ok).map((result) => result.error).filter(Boolean);
        const tierTable = tierRows.map((row) => {
            const tier = row.tier || row.value || 'غير محدد';
            const startsForTier = Number(startRows.find((item) => item.value === tier)?.count || 0);
            const orders = Number(row.count || 0);
            return [tier, startsForTier, orders, formatCurrency(row.revenue_sar || 0), startsForTier ? formatPercent(orders / startsForTier) : '—'];
        });
        const providerTable = providerRows.map((row) => [row.provider || row.value || 'غير محدد', row.count || 0, formatCurrency(row.revenue_sar || 0)]);

        contentEl.innerHTML = `
            <div class="admin-behavior-controls"><div><span class="admin-eyebrow">الاشتراكات والباقات</span><h3 class="admin-card__title" style="margin:4px 0 0;">صحة الباقات ومزوّدي الدفع</h3></div><label class="admin-period-control">الفترة<select id="subscriptionsDaysSelect" class="admin-select"><option value="7">7 أيام</option><option value="30">30 يومًا</option><option value="90">90 يومًا</option></select></label></div>
            <div class="admin-tile-grid admin-tile-grid--executive">
                ${this._tile('الإيراد الكلي', formatCurrency(revenueData.total_revenue_sar || 0))}
                ${this._tile('الطلبات المدفوعة', formatNumber(revenueData.paid_orders || 0))}
                ${this._tile('نجاح الدفع في الفترة', formatNumber(successTotal))}
                ${this._tile('أخطاء الدفع في الفترة', formatNumber(errorTotal))}
                ${this._tile('الباقات النشطة', formatNumber(tierRows.length))}
                ${this._tile('المزوّدون', formatNumber(providerRows.length))}
            </div>
            <div class="admin-section-grid admin-section-grid--executive">
                <section class="admin-card"><span class="admin-eyebrow">التحويل حسب الباقة</span><h3 class="admin-card__title">من بدء الدفع إلى طلب مدفوع</h3>${this._table(['الباقة', 'بدء الدفع', 'مدفوع', 'الإيراد', 'التحويل'], tierTable)}</section>
                <section class="admin-card"><span class="admin-eyebrow">مزيج الدفع</span><h3 class="admin-card__title">الإيراد حسب المزوّد</h3>${this._table(['المزوّد', 'الطلبات', 'الإيراد'], providerTable)}</section>
            </div>
            <div class="admin-section-grid"><section class="admin-card"><h3 class="admin-card__title">اختيار الباقة قبل الدفع</h3>${this._table(['الباقة', 'الاختيارات'], preferenceRows.map((row) => [row.value || 'غير محدد', row.count]))}</section><section class="admin-card"><h3 class="admin-card__title">حدود القياس</h3><p class="admin-data-note">لا تظهر هذه اللوحة اشتراكات شهرية أو سنوية لأن المنتج الحالي يبيع طلبات باقات منفردة. ستظهر تلك المؤشرات تلقائياً عند إضافة مصدر تجديد فعلي.</p></section></div>
            ${warnings.length ? `<p class="admin-data-note">تعذر تحديث بعض بيانات الاشتراكات: ${this._esc(warnings.join('، '))}</p>` : ''}
        `;
        const select = contentEl.querySelector('#subscriptionsDaysSelect');
        if (select) {
            select.value = String(this.behaviorDays);
            select.addEventListener('change', async () => {
                this.behaviorDays = Number(select.value);
                await this._renderSubscriptionsTab(contentEl);
            });
        }
    }

    async _renderSatisfactionTab(contentEl) {
        const days = this.behaviorDays;
        contentEl.innerHTML = '<p class="admin-loading">جاري تحليل الرضا والآراء…</p>';
        const [reviews, feedback] = await Promise.all([
            ReviewsService.getAllReviews(),
            AdminService.getEventsStats('share_feedback_submitted', days, 'kind'),
        ]);
        const reviewRows = reviews.ok ? (reviews.reviews || []) : [];
        const published = reviewRows.filter((review) => review.published);
        const average = reviewRows.length ? reviewRows.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviewRows.length : null;
        const distribution = [5, 4, 3, 2, 1].map((rating) => [String(rating), reviewRows.filter((review) => Number(review.rating) === rating).length]);
        const warnings = [reviews, feedback].filter((result) => !result.ok).map((result) => result.error).filter(Boolean);

        contentEl.innerHTML = `
            <div class="admin-behavior-controls"><div><span class="admin-eyebrow">الرضا والآراء</span><h3 class="admin-card__title" style="margin:4px 0 0;">إشارات صوت العميل</h3></div><label class="admin-period-control">الفترة<select id="satisfactionDaysSelect" class="admin-select"><option value="7">7 أيام</option><option value="30">30 يومًا</option><option value="90">90 يومًا</option></select></label></div>
            <div class="admin-tile-grid admin-tile-grid--executive">
                ${this._tile('كل التقييمات', formatNumber(reviewRows.length))}
                ${this._tile('التقييمات المنشورة', formatNumber(published.length))}
                ${this._tile('متوسط التقييم', average == null ? '—' : `${average.toFixed(1)} / 5`)}
                ${this._tile('ملاحظات المشاركة', formatNumber((feedback.data?.daily || []).reduce((sum, row) => sum + Number(row.count || 0), 0)))}
                ${this._tile('تغطية النشر', reviewRows.length ? formatPercent(published.length / reviewRows.length) : '—')}
            </div>
            <div class="admin-section-grid admin-section-grid--executive"><section class="admin-card"><span class="admin-eyebrow">التقييمات المدارة</span><h3 class="admin-card__title">توزيع النجوم</h3>${this._table(['النجوم', 'العدد'], distribution)}</section><section class="admin-card"><span class="admin-eyebrow">ملاحظات المستثمرين</span><h3 class="admin-card__title">نوع الملاحظة</h3>${this._table(['النوع', 'العدد'], (feedback.data?.by_prop || []).map((row) => [row.value || 'غير محدد', row.count]))}</section></div>
            <p class="admin-data-note">هذه اللوحة تقيس التقييمات وملاحظات المشاركة المتاحة فعليًا. لا يتم اشتقاق NPS أو رضا المراجع من متوسط النجوم تلقائيًا.</p>
            ${warnings.length ? `<p class="admin-data-note">تعذر تحديث بعض بيانات الرضا: ${this._esc(warnings.join('، '))}</p>` : ''}
        `;
        const select = contentEl.querySelector('#satisfactionDaysSelect');
        if (select) {
            select.value = String(this.behaviorDays);
            select.addEventListener('change', async () => { this.behaviorDays = Number(select.value); await this._renderSatisfactionTab(contentEl); });
        }
    }

    async _renderTeamTab(contentEl) {
        const days = this.behaviorDays;
        contentEl.innerHTML = '<p class="admin-loading">جاري تحليل الفريق والدعم…</p>';
        const [reviewers, tickets, replies] = await Promise.all([
            AdminService.getReviewerStats(),
            AdminService.getEventsStats('support_ticket_created', days, null),
            AdminService.getEventsStats('support_ticket_reply_sent', days, null),
        ]);
        const data = reviewers.ok ? (reviewers.data || {}) : {};
        const warnings = [reviewers, tickets, replies].filter((result) => !result.ok).map((result) => result.error).filter(Boolean);
        const total = (result) => result.ok ? (result.data?.daily || []).reduce((sum, row) => sum + Number(row.count || 0), 0) : 0;
        contentEl.innerHTML = `
            <div class="admin-behavior-controls"><div><span class="admin-eyebrow">الفريق والدعم</span><h3 class="admin-card__title" style="margin:4px 0 0;">قدرة الفريق على الاستجابة</h3></div><span class="admin-period-badge">${days} يومًا</span></div>
            <div class="admin-tile-grid admin-tile-grid--executive">${this._tile('مراجعون نشطون', formatNumber(data.active_reviewers || 0))}${this._tile('في الطابور', formatNumber(data.queued || 0))}${this._tile('قيد المراجعة', formatNumber(data.in_review || 0))}${this._tile('متوسط الإنجاز', `${formatNumber(data.avg_turnaround_hours || 0)} ساعة`)}${this._tile('تذاكر جديدة', formatNumber(total(tickets)))}${this._tile('ردود الدعم', formatNumber(total(replies)))}</div>
            <div class="admin-section-grid"><section class="admin-card"><span class="admin-eyebrow">المراجعة</span><h3 class="admin-card__title">حالة القدرة الحالية</h3>${this._table(['المؤشر', 'القيمة'], [['شهادات صادرة', data.certified_total || 0], ['مرفوضة', data.rejected_total || 0], ['زمن الإنجاز بالساعات', data.avg_turnaround_hours || 0]])}</section><section class="admin-card"><span class="admin-eyebrow">الدعم</span><h3 class="admin-card__title">النشاط خلال الفترة</h3>${this._table(['الحدث', 'العدد'], [['تذاكر جديدة', total(tickets)], ['ردود مرسلة', total(replies)]])}</section></div>
            <p class="admin-data-note">المناوبات والإجازات غير موجودة كمصدر تشغيلي مستقل؛ لا يتم عرض توزيع ورديات أو مؤشر ضغط تقديري.</p>
            ${warnings.length ? `<p class="admin-data-note">تعذر تحديث بعض بيانات الفريق: ${this._esc(warnings.join('، '))}</p>` : ''}
        `;
    }

    async _renderContentTab(contentEl) {
        const days = this.behaviorDays;
        contentEl.innerHTML = '<p class="admin-loading">جاري تحليل المحتوى والصفحات…</p>';
        const [pages, applications, sources] = await Promise.all([
            AdminService.getEventsStats('public_page_view', days, 'page'),
            AdminService.getEventsStats('public_application_submitted', days, 'application_type'),
            AdminService.getEventsStats(null, days, 'utm_source'),
        ]);
        const total = (result) => result.ok ? (result.data?.daily || []).reduce((sum, row) => sum + Number(row.count || 0), 0) : 0;
        const warnings = [pages, applications, sources].filter((result) => !result.ok).map((result) => result.error).filter(Boolean);
        contentEl.innerHTML = `
            <div class="admin-behavior-controls"><div><span class="admin-eyebrow">المحتوى والصفحات</span><h3 class="admin-card__title" style="margin:4px 0 0;">ما الذي يجذب الزوار ويحوّلهم؟</h3></div><span class="admin-period-badge">${days} يومًا</span></div>
            <div class="admin-tile-grid admin-tile-grid--executive">${this._tile('مشاهدات الصفحات', formatNumber(total(pages)))}${this._tile('طلبات عامة', formatNumber(total(applications)))}${this._tile('صفحات مرصودة', formatNumber((pages.data?.by_prop || []).length))}${this._tile('مصادر UTM', formatNumber((sources.data?.by_prop || []).length))}</div>
            <div class="admin-section-grid admin-section-grid--executive"><section class="admin-card"><span class="admin-eyebrow">أداء الصفحات</span><h3 class="admin-card__title">الزيارات العامة</h3>${this._table(['الصفحة', 'المشاهدات'], (pages.data?.by_prop || []).map((row) => [row.value || 'غير محدد', row.count]))}</section><section class="admin-card"><span class="admin-eyebrow">التحويل</span><h3 class="admin-card__title">الطلبات حسب النوع</h3>${this._table(['النوع', 'الطلبات'], (applications.data?.by_prop || []).map((row) => [row.value || 'غير محدد', row.count]))}</section></div>
            <section class="admin-card"><h3 class="admin-card__title">مصادر الوصول</h3>${this._table(['المصدر', 'الأحداث'], (sources.data?.by_prop || []).map((row) => [row.value || 'غير محدد', row.count]))}</section>
            ${warnings.length ? `<p class="admin-data-note">تعذر تحديث بعض بيانات المحتوى: ${this._esc(warnings.join('، '))}</p>` : ''}
        `;
    }

    async _renderInnovationTab(contentEl) {
        const days = this.behaviorDays;
        contentEl.innerHTML = '<p class="admin-loading">جاري بناء رادار الابتكار…</p>';
        const [ai, exports, shares, applications] = await Promise.all([
            AdminService.getEventsStats('ai_request_completed', days, 'type'),
            AdminService.getEventsStats('export_click', days, 'format'),
            AdminService.getEventsStats('share_link_created', days, null),
            AdminService.getEventsStats('public_application_submitted', days, 'application_type'),
        ]);
        const total = (result) => result.ok ? (result.data?.daily || []).reduce((sum, row) => sum + Number(row.count || 0), 0) : 0;
        const warnings = [ai, exports, shares, applications].filter((result) => !result.ok).map((result) => result.error).filter(Boolean);
        contentEl.innerHTML = `
            <div class="admin-behavior-controls"><div><span class="admin-eyebrow">رادار الابتكار</span><h3 class="admin-card__title" style="margin:4px 0 0;">تبنّي القدرات الجديدة</h3></div><span class="admin-period-badge">${days} يومًا</span></div>
            <div class="admin-tile-grid admin-tile-grid--executive">${this._tile('طلبات الذكاء', formatNumber(total(ai)))}${this._tile('التصديرات', formatNumber(total(exports)))}${this._tile('روابط المشاركة', formatNumber(total(shares)))}${this._tile('طلبات الشراكة', formatNumber(total(applications)))}</div>
            <div class="admin-section-grid admin-section-grid--executive"><section class="admin-card"><h3 class="admin-card__title">أنواع استخدام الذكاء</h3>${this._table(['النوع', 'العدد'], (ai.data?.by_prop || []).map((row) => [row.value || 'غير محدد', row.count]))}</section><section class="admin-card"><h3 class="admin-card__title">صيغ التصدير</h3>${this._table(['الصيغة', 'العدد'], (exports.data?.by_prop || []).map((row) => [row.value || 'غير محدد', row.count]))}</section></div>
            <p class="admin-data-note">الرادار يقيس تبنّي قدرات موجودة فعلاً، ولا يحوّل أفكارًا مستقبلية مثل تطبيق جوال أو نموذج B2B إلى ميزات منجزة.</p>
            ${warnings.length ? `<p class="admin-data-note">تعذر تحديث بعض إشارات الابتكار: ${this._esc(warnings.join('، '))}</p>` : ''}
        `;
    }

    async _renderStrategyTab(contentEl) {
        contentEl.innerHTML = '<p class="admin-loading">جاري إعداد مؤشرات المستثمرين…</p>';
        const result = await this._fetchExecutiveOverview();
        if (!result.ok) {
            contentEl.innerHTML = `<p class="admin-error">تعذر إعداد المؤشرات: ${this._esc(result.error)}</p>`;
            return;
        }
        const { overview = {}, funnel = {}, revenue = {}, events = {} } = result.data;
        const paidUsers = Number(funnel.paid_users || 0);
        const totalUsers = Number(overview.total_users || 0);
        const conversion = totalUsers ? paidUsers / totalUsers : null;
        const paidOrders = Number(funnel.paid_orders || 0);
        const revenueTotal = Number(overview.total_revenue_sar || 0);
        const supportEvents = Number((events.totals_by_event || []).find((row) => row.event_name === 'error')?.count || 0);
        const dataGaps = ['CAC', 'LTV', 'churn', 'geography'].filter((key) => funnel[key] == null && overview[key] == null && revenue[key] == null);

        contentEl.innerHTML = `
            <section class="admin-executive-hero">
                <div><span class="admin-eyebrow">جاهزية المستثمرين</span><h2>لوحة أرقام قابلة للتدقيق</h2><p>ملخص موحد للنمو والإيرادات وجودة التشغيل مع فصل واضح بين البيانات المتاحة والفجوات التي تحتاج تكاملًا إضافيًا.</p></div>
                <span class="admin-period-badge">${this.executiveDays} يومًا</span>
            </section>
            <div class="admin-tile-grid admin-tile-grid--executive">
                ${this._tile('المستخدمون', formatNumber(totalUsers))}
                ${this._tile('المستخدمون المدفوعون', formatNumber(paidUsers))}
                ${this._tile('التحويل', conversion == null ? '—' : formatPercent(conversion))}
                ${this._tile('الطلبات المدفوعة', formatNumber(paidOrders))}
                ${this._tile('الإيرادات', formatCurrency(revenueTotal))}
                ${this._tile('إشارات الأخطاء', formatNumber(supportEvents))}
            </div>
            <div class="admin-section-grid admin-section-grid--executive">
                <section class="admin-card"><span class="admin-eyebrow">البيانات الجاهزة</span><h3 class="admin-card__title">مقاييس يمكن عرضها الآن</h3>${this._table(['المقياس', 'الحالة'], [['النمو الأساسي', 'جاهز'], ['تنوع الإيرادات', (revenue.by_tier || []).length ? 'جاهز' : 'يحتاج بيانات'], ['التفاعل النشط', overview.active_shares != null ? 'جاهز' : 'يحتاج بيانات'], ['جودة التشغيل', supportEvents >= 0 ? 'جاهز' : 'يحتاج بيانات']])}</section>
                <section class="admin-card"><span class="admin-eyebrow">فجوات القياس</span><h3 class="admin-card__title">تكاملات لازمة للمقاييس المتقدمة</h3>${dataGaps.length ? this._table(['المقياس', 'الحالة'], dataGaps.map((key) => [key.toUpperCase(), 'يحتاج مصدرًا'])) : this._executiveAlert('مكتملة', '100%', 'success', 'كل المقاييس المطلوبة متاحة في مصادر الإدارة الحالية.')}</section>
            </div>
            <p class="admin-data-note">لا يتم احتساب CAC أو LTV أو معدل الانسحاب من دون تكلفة اكتساب وفترات اشتراك موثوقة؛ إبقاؤها معلّقة أفضل من عرض تقدير مضلل.</p>
        `;
    }

    async _renderCoverageTab(contentEl) {
        const connected = ADMIN_FEATURE_CATALOG.filter((feature) => feature.status === 'connected').length;
        const instrumented = ADMIN_FEATURE_CATALOG.filter((feature) => feature.status === 'instrumented').length;
        const planned = ADMIN_FEATURE_CATALOG.filter((feature) => feature.status === 'planned').length;
        const categories = [...new Set(ADMIN_FEATURE_CATALOG.map((feature) => feature.category))];
        const renderRows = (category = '', status = '', query = '') => ADMIN_FEATURE_CATALOG
            .filter((feature) => !category || feature.category === category)
            .filter((feature) => !status || feature.status === status)
            .filter((feature) => !query || `${feature.id} ${feature.category} ${feature.title}`.toLowerCase().includes(query.toLowerCase()))
            .map((feature) => `<tr><td>${feature.id}</td><td>${this._esc(feature.category)}</td><td>${this._esc(feature.title)}</td><td><span class="admin-status admin-status--${feature.status}">${this._esc(feature.statusLabel)}</span></td></tr>`)
            .join('');

        contentEl.innerHTML = `
            <section class="admin-executive-hero">
                <div><span class="admin-eyebrow">مصفوفة التغطية</span><h2>تغطية 300 ميزة</h2><p>مرجع حي يبين حالة كل فائدة داخل لوحة الإدارة. «متصل» يعني مصدرًا وواجهة، و«مقاس» يعني حدثًا موثقًا، و«يحتاج مصدرًا» يعني أن التكامل لم يكتمل بعد.</p></div>
                <span class="admin-period-badge">${ADMIN_FEATURE_CATALOG.length} بند</span>
            </section>
            <div class="admin-tile-grid admin-tile-grid--executive">
                ${this._tile('إجمالي المزايا', formatNumber(ADMIN_FEATURE_CATALOG.length))}
                ${this._tile('متصل', formatNumber(connected))}
                ${this._tile('مقاس', formatNumber(instrumented))}
                ${this._tile('يحتاج مصدرًا', formatNumber(planned))}
                ${this._tile('تغطية فعلية', formatPercent((connected + instrumented) / ADMIN_FEATURE_CATALOG.length))}
            </div>
            <div class="admin-card admin-coverage-controls">
                <label>بحث <input id="coverageSearch" class="admin-input" type="search" placeholder="رقم أو فائدة أو قطاع" /></label>
                <label>القسم <select id="coverageCategory" class="admin-select"><option value="">كل الأقسام</option>${categories.map((category) => `<option value="${this._esc(category)}">${this._esc(category)}</option>`).join('')}</select></label>
                <label>الحالة <select id="coverageStatus" class="admin-select"><option value="">كل الحالات</option><option value="connected">متصل</option><option value="instrumented">مقاس</option><option value="planned">يحتاج مصدرًا</option></select></label>
            </div>
            <div class="admin-table-wrap admin-coverage-table-wrap">
                <table class="admin-table"><thead><tr><th>#</th><th>القسم</th><th>الميزة</th><th>الحالة</th></tr></thead><tbody id="coverageRows">${renderRows()}</tbody></table>
            </div>
        `;

        const update = () => {
            const search = contentEl.querySelector('#coverageSearch')?.value || '';
            const category = contentEl.querySelector('#coverageCategory')?.value || '';
            const status = contentEl.querySelector('#coverageStatus')?.value || '';
            const rows = contentEl.querySelector('#coverageRows');
            if (rows) rows.innerHTML = renderRows(category, status, search) || '<tr><td colspan="4">لا توجد نتائج</td></tr>';
        };
        contentEl.querySelector('#coverageSearch')?.addEventListener('input', update);
        contentEl.querySelector('#coverageCategory')?.addEventListener('change', update);
        contentEl.querySelector('#coverageStatus')?.addEventListener('change', update);
    }

    async _renderReportsTab(contentEl) {
        contentEl.innerHTML = '<p class="admin-loading">جارٍ إعداد التقرير التنفيذي…</p>';
        const result = await this._fetchExecutiveOverview();
        if (!result.ok) {
            contentEl.innerHTML = `<p class="admin-error">تعذر إعداد التقرير: ${this._esc(result.error)}</p>`;
            return;
        }
        const payload = result.data;
        const overview = payload.overview || {};
        const funnel = payload.funnel || {};
        const report = {
            generated_at: new Date().toISOString(),
            period_days: this.executiveDays,
            total_studies: Number(overview.total_studies || 0),
            total_users: Number(overview.total_users || 0),
            total_revenue_sar: Number(overview.total_revenue_sar || 0),
            paid_users: Number(funnel.paid_users || 0),
            free_users: Number(funnel.free_users || 0),
            paid_orders: Number(funnel.paid_orders || 0),
            payment_errors: Number(funnel.payment_errors || 0),
            avg_completion_minutes: Number(funnel.avg_completion_minutes || 0),
        };

        contentEl.innerHTML = `
            <section class="admin-executive-hero">
                <div>
                    <span class="admin-eyebrow">مركز التقارير</span>
                    <h2>لقطة تنفيذية قابلة للمشاركة</h2>
                    <p>ملف خفيف يضم الأرقام الأساسية الحالية، صالح للأرشفة أو الإرسال الداخلي.</p>
                </div>
                <span class="admin-period-badge">${this._esc(`${this.executiveDays} يومًا`)}</span>
            </section>
            <div class="admin-tile-grid admin-tile-grid--executive">
                ${this._tile('الدراسات', formatNumber(report.total_studies))}
                ${this._tile('المستخدمون', formatNumber(report.total_users))}
                ${this._tile('الإيرادات', formatCurrency(report.total_revenue_sar))}
                ${this._tile('المدفوعون', formatNumber(report.paid_users))}
                ${this._tile('الطلبات المدفوعة', formatNumber(report.paid_orders))}
                ${this._tile('أخطاء الدفع', formatNumber(report.payment_errors))}
            </div>
            <div class="admin-card admin-report-actions">
                <h3 class="admin-card__title">الإجراءات</h3>
                <button id="btnDownloadAdminSnapshot" class="btn btn--sm btn--primary">تنزيل التقرير JSON</button>
                <button id="btnCopyAdminSnapshot" class="btn btn--sm btn--ghost">نسخ الملخص</button>
                <p id="adminReportStatus" class="admin-data-note" aria-live="polite"></p>
            </div>
        `;

        const reportJson = JSON.stringify(report, null, 2);
        contentEl.querySelector('#btnDownloadAdminSnapshot')?.addEventListener('click', () => {
            const blob = new Blob([reportJson], { type: 'application/json;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `qarar-admin-report-${new Date().toISOString().slice(0, 10)}.json`;
            link.click();
            URL.revokeObjectURL(url);
            contentEl.querySelector('#adminReportStatus').textContent = 'تم تجهيز التقرير للتنزيل.';
        });
        contentEl.querySelector('#btnCopyAdminSnapshot')?.addEventListener('click', async () => {
            const text = `الدراسات: ${report.total_studies}\nالمستخدمون: ${report.total_users}\nالإيرادات: ${formatCurrency(report.total_revenue_sar)}\nالمدفوعون: ${report.paid_users}\nأخطاء الدفع: ${report.payment_errors}`;
            try {
                await navigator.clipboard.writeText(text);
                contentEl.querySelector('#adminReportStatus').textContent = 'تم نسخ الملخص.';
            } catch (_) {
                contentEl.querySelector('#adminReportStatus').textContent = 'تعذر النسخ التلقائي؛ استخدم التنزيل.';
            }
        });
    }


    _bindBehaviorSelect(contentEl) {
        const select = contentEl.querySelector('#behaviorDaysSelect');
        if (!select) return;
        select.value = String(this.behaviorDays);
        select.addEventListener('change', async () => {
            this.behaviorDays = Number(select.value);
            await this._renderBehaviorTab(contentEl);
        });
    }
}
