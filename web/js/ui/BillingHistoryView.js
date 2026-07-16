/**
 * BillingHistoryView — سجل الفواتير/الطلبات. محمية بالدخول (نفس أسلوب
 * UserProfileView.js: فحص getAuthUser() في بداية render() ورسالة بديلة بلا
 * مستخدم)، وتعرض بيانات orders.js عبر PaymentService.listOrders() (RLS تضمن
 * عدم رؤية أي مستخدم لطلبات غيره).
 */
import { getAuthUser } from '../../supabaseClient.js';
import { AuthGuard } from '../middleware/AuthGuard.js';
import { listOrders } from '../services/PaymentService.js';

const TIER_LABELS = {
    self: 'الباقة الذاتية',
    reviewed: 'مراجَعة بخبير',
    full: 'الخدمة الكاملة',
};

const STATUS_META = {
    pending: { label: 'قيد الانتظار', badge: 'badge--warning' },
    paid: { label: 'مدفوع', badge: 'badge--success' },
    failed: { label: 'فشل', badge: 'badge--danger' },
    refunded: { label: 'مسترَد', badge: 'badge--neutral' },
};

function formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric', numberingSystem: 'latn' });
}

function formatAmount(order) {
    const amount = Number(order.amount_sar || 0).toFixed(2);
    const currency = order.currency === 'SAR' ? 'ريال' : (order.currency || '');
    return `${amount} ${currency}`.trim();
}

export class BillingHistoryView {
    /**
     * @param {HTMLElement} container
     * @param {object} options - { onBack: () => void }
     */
    constructor(container, options = {}) {
        this.container = container;
        this.onBack = options.onBack || (() => {});
    }

    async render() {
        if (!this.container) return;

        const { user } = await getAuthUser();
        if (!user) {
            this.container.innerHTML = `
                <div class="billing-history-view" style="max-width:560px;margin:60px auto;text-align:center;padding:24px;">
                    <p class="text-muted mb-4">يجب تسجيل الدخول لعرض سجل الفواتير.</p>
                    <button type="button" id="btnBillingLogin" class="btn btn--primary">تسجيل الدخول</button>
                </div>
            `;
            this.container.querySelector('#btnBillingLogin')?.addEventListener('click', () => {
                AuthGuard.showAuthPrompt(({ isAuthenticated }) => {
                    if (isAuthenticated) this.render();
                });
            });
            return;
        }

        const orders = await listOrders();

        this.container.innerHTML = `
            <div class="billing-history-page" style="max-width: 720px; margin: 0 auto; padding: var(--s-4) 0;">
                <button type="button" id="btnBillingBack" class="btn btn--ghost mb-4" style="display: inline-flex; align-items: center; gap: 8px;">
                    ← العودة للدراسة
                </button>

                <div class="card p-6">
                    <h2 class="text-xl font-bold mb-4" style="border-bottom: 1px solid var(--c-border); padding-bottom: var(--s-2);">سجل الفواتير</h2>

                    ${orders.length === 0 ? `
                        <p class="text-muted">لا توجد عمليات دفع حتى الآن.</p>
                        <a href="#/home" id="billingEmptyPricingLink" class="btn btn--secondary mt-2">عرض الباقات</a>
                    ` : `
                        <div class="space-y-3">
                            ${orders.map((o) => {
                                const status = STATUS_META[o.status] || STATUS_META.pending;
                                return `
                                    <div class="card" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
                                        <div>
                                            <div class="font-bold">${TIER_LABELS[o.tier] || o.tier}</div>
                                            <div class="text-xs text-muted mt-1">${formatDate(o.paid_at || o.created_at)}</div>
                                        </div>
                                        <div style="display:flex;align-items:center;gap:10px;">
                                            <span class="font-bold">${formatAmount(o)}</span>
                                            <span class="badge ${status.badge}">${status.label}</span>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `}
                </div>
            </div>
        `;

        this.container.querySelector('#btnBillingBack')?.addEventListener('click', () => this.onBack());
    }
}
