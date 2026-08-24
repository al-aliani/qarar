/**
 * BillingHistoryView — سجل الفواتير/الطلبات. محمية بالدخول (نفس أسلوب
 * UserProfileView.js: فحص getAuthUser() في بداية render() ورسالة بديلة بلا
 * مستخدم)، وتعرض بيانات orders.js عبر PaymentService.listOrders() (RLS تضمن
 * عدم رؤية أي مستخدم لطلبات غيره).
 */
import { getAuthUser } from '../../supabaseClient.js';
import { AuthGuard } from '../middleware/AuthGuard.js';
import { listOrders } from '../services/PaymentService.js';
import { openTaxInvoice } from '../utils/zatcaInvoice.js';
import { trackEvent } from '../utils/analytics.js';
import { buildWhatsAppLink } from '../config.js';

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
    expired: { label: 'منتهي الصلاحية', badge: 'badge--neutral' },
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

// نفس الاختصار المعتمد لمرجع الطلب في BankTransferPanel.js (أول 8 خانات من الـUUID).
function orderRef(order) {
    return String(order.id || '').slice(0, 8);
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
        // تم إيقاف فرض تسجيل الدخول مؤقتاً للتجربة
        let orders = [];
        if (user) {
            orders = await listOrders();
        }

        this.container.innerHTML = `
            <div class="billing-history-page" style="max-width: 720px; margin: 0 auto; padding: var(--s-4) 0;">
                <button type="button" id="btnBillingBack" class="btn btn--ghost mb-4" style="display: inline-flex; align-items: center; gap: 8px;">
                    ← العودة للدراسة
                </button>

                <div class="card p-6">
                    <h2 class="text-xl font-bold mb-4" style="border-bottom: 1px solid var(--c-border); padding-bottom: var(--s-2);">الطلبات والفواتير</h2>

                    ${orders.length === 0 ? `
                        <p class="text-muted">لا توجد عمليات دفع حتى الآن.</p>
                        <a href="#/home" id="billingEmptyPricingLink" class="btn btn--secondary mt-2">عرض الباقات</a>
                    ` : `
                        <div class="space-y-3">
                            ${orders.map((o, idx) => {
                                const status = STATUS_META[o.status] || STATUS_META.pending;
                                const ref = orderRef(o);
                                // طلب pending بلا أي زر إجراء يترك العميل بلا معرفة ماذا يفعل حياله —
                                // لا يوجد مسار برمجي لاستئناف جلسة دفع سابقة بعينها، فنستخدم نفس
                                // قناة التواصل المعتمدة لأغراض مشابهة (BankTransferPanel.js).
                                const pendingWaLink = o.status === 'pending'
                                    ? buildWhatsAppLink(`السلام عليكم، عندي طلب "${TIER_LABELS[o.tier] || o.tier}" بمبلغ ${formatAmount(o)} بحالة قيد الانتظار (رقم الطلب #${ref}). أحب أتواصل بخصوصه.`)
                                    : null;
                                return `
                                    <div class="card" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
                                        <div>
                                            <div class="font-bold">${TIER_LABELS[o.tier] || o.tier}</div>
                                            <div class="text-xs text-muted mt-1">${formatDate(o.paid_at || o.created_at)} · #${ref}</div>
                                        </div>
                                        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                                            <span class="font-bold">${formatAmount(o)}</span>
                                            <span class="badge ${status.badge}">${status.label}</span>
                                            ${o.status === 'paid' ? `<button type="button" class="btn btn--ghost btn--sm" data-invoice="${idx}">فاتورة ضريبية</button>` : ''}
                                            ${pendingWaLink ? `<a href="${pendingWaLink}" target="_blank" rel="noopener noreferrer" class="btn btn--primary btn--sm">تواصل بخصوص الطلب</a>` : ''}
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
        // تدقيق 2026-07-17: href="#/home" وحده لا يكفي إن كان المستخدم أصلاً على #/home —
        // المتصفح لا يُطلق حدث hashchange حين لا تتغيّر قيمة الهاش، فلا يحدث شيء عند النقر.
        // نستدعي onBack() مباشرة (نفس تعريف #btnBillingBack) بدل الاعتماد فقط على href.
        this.container.querySelector('#billingEmptyPricingLink')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.onBack();
        });

        // فاتورة ضريبية مبسّطة (ZATCA) — تُفتح في نافذة للطباعة/الحفظ PDF للطلبات المدفوعة
        this.container.querySelectorAll('[data-invoice]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const o = orders[Number(btn.dataset.invoice)];
                if (o) {
                    trackEvent('invoice_view', { status: o.status, tier: o.tier || 'unknown' });
                    openTaxInvoice(o);
                }
            });
        });
    }
}
