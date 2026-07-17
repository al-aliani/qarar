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
import { formatCurrency } from '../utils/formatters.js';
import ApexCharts from 'apexcharts';
import Swal from 'sweetalert2';

const TABS = [
    { key: 'overview', label: 'نظرة عامة' },
    { key: 'studies', label: 'الدراسات' },
    { key: 'users', label: 'المستخدمون' },
    { key: 'revenue', label: 'الإيرادات' },
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
        this.openTicketId = null;
    }

    async render() {
        // TEMP (طلب صريح من المالك 2026-07-16): تعطيل بوابة isAdmin() مؤقتاً
        // للمعاينة المحلية قبل تطبيق migration جدول admins على Supabase الفعلي.
        // مقصور على localhost عمداً — لو نُسي هذا السطر ونُشر التطبيق، البوابة
        // الحقيقية تبقى سارية على أي نطاق حقيقي. يجب حذف هذا الاستثناء بالكامل
        // قبل أي نشر فعلي (المالك وعد صراحة بطلب ذلك: "تقفل الثغرات").
        const isLocalPreview = ['localhost', '127.0.0.1'].includes(window.location.hostname);
        const isAdmin = isLocalPreview || await AuthGuard.isAdmin();
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
            case 'overview': return AdminService.getOverview();
            case 'studies': return AdminService.getStudiesStats();
            case 'users': return AdminService.getUsersStats();
            case 'revenue': return AdminService.getRevenueStats();
            case 'reviewers': return AdminService.getReviewerStats();
            case 'sharing': return AdminService.getSharingStats();
            default: return Promise.resolve({ ok: false, error: 'تبويب غير معروف' });
        }
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

    _renderTrendChart(containerId, seriesName, points) {
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
            const chart = new ApexCharts(el, options);
            chart.render().catch((err) => console.error('ApexCharts render error:', err));
            this.charts[containerId] = chart;
        } catch (err) {
            console.error('ApexCharts init error:', err);
        }
    }

    _renderOverview(contentEl, data) {
        contentEl.innerHTML = `
            <div class="admin-tile-grid">
                ${this._tile('إجمالي الدراسات', data.total_studies ?? 0)}
                ${this._tile('إجمالي المستخدمين', data.total_users ?? 0)}
                ${this._tile('إجمالي الإيرادات', formatCurrency(data.total_revenue_sar ?? 0))}
                ${this._tile('مراجعات قيد الانتظار', data.pending_reviews ?? 0)}
                ${this._tile('روابط مشاركة نشطة', data.active_shares ?? 0)}
            </div>
        `;
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

    _renderUsers(contentEl, data) {
        contentEl.innerHTML = `
            <div class="admin-tile-grid">
                ${this._tile('إجمالي المستخدمين', data.total ?? 0)}
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
        `;
        const daily = data.daily_signups || [];
        this._renderTrendChart('chartUsersDaily', 'مستخدمون جدد', daily.map((d) => ({ label: d.day, value: d.count })));
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

    _renderRevenue(contentEl, data) {
        contentEl.innerHTML = `
            <div class="admin-tile-grid">
                ${this._tile('إجمالي الإيرادات', formatCurrency(data.total_revenue_sar ?? 0))}
                ${this._tile('متوسط قيمة الطلب', formatCurrency(data.avg_order_value_sar ?? 0))}
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

        const [totals, stepDropoff, exportFormats, wandUsage, errors] = await Promise.all([
            AdminService.getEventsStats(null, this.behaviorDays, null),
            AdminService.getEventsStats('wizard_step_view', this.behaviorDays, 'stepId'),
            AdminService.getEventsStats('export_click', this.behaviorDays, 'format'),
            AdminService.getEventsStats('ai_wand_use', this.behaviorDays, 'type'),
            AdminService.getEventsStats('error', this.behaviorDays, null),
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

        contentEl.innerHTML = `
            ${this._behaviorControlsHtml()}
            <div class="admin-tile-grid">
                ${this._tile('إجمالي الأحداث', totalEvents)}
                ${this._tile('أخطاء مسجَّلة', errorTotal)}
            </div>
            <div class="admin-section-grid" style="margin-bottom: var(--s-4);">
                <div>
                    <h3 class="admin-card__title">أكثر الأحداث تكراراً</h3>
                    ${this._table(['الحدث', 'العدد'], totalsByEvent.map((e) => [e.event_name, e.count]))}
                </div>
                <div>
                    <h3 class="admin-card__title">صيغ التصدير الأكثر استخداماً</h3>
                    ${this._table(['الصيغة', 'العدد'], formatBreakdown.map((e) => [e.value, e.count]))}
                </div>
            </div>
            <div class="admin-section-grid">
                <div>
                    <h3 class="admin-card__title">مشاهدات خطوات الويزارد</h3>
                    ${this._table(['الخطوة', 'مشاهدات'], stepBreakdown.map((e) => [e.value, e.count]))}
                </div>
                <div>
                    <h3 class="admin-card__title">استخدام العصا السحرية</h3>
                    ${this._table(['النوع', 'العدد'], wandBreakdown.map((e) => [e.value, e.count]))}
                </div>
            </div>
        `;

        this._bindBehaviorSelect(contentEl);
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
