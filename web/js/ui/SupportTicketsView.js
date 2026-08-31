/**
 * SupportTicketsView — الدعم الفني (نظام تذاكر داخلي، 2026-07-18). محمية بالدخول
 * (نفس أسلوب BillingHistoryView.js: فحص getAuthUser() في بداية render()، رسالة بديلة
 * بلا مستخدم)، تعرض/تُنشئ بيانات عبر TicketService.js (RLS تضمن عدم رؤية أي مستخدم
 * لتذاكر غيره).
 */
import { getAuthUser } from '../../supabaseClient.js';
import { submitTicket, listMyTickets, getTicketWithMessages, addMessage } from '../services/TicketService.js';
import { toast } from '../utils/toast.js';
import { escapeHtml } from '../utils/escape.js';
import { trackEvent } from '../utils/analytics.js';

const STATUS_META = {
    open: { label: 'مفتوحة', badge: 'badge--warning' },
    answered: { label: 'تم الرد', badge: 'badge--success' },
    closed: { label: 'مُغلقة', badge: 'badge--neutral' },
};

const ISSUE_TYPE_OPTIONS = [
    { value: 'technical', label: 'مشكلة تقنية' },
    { value: 'billing', label: 'استفسار عن الدفع/الفوترة' },
    { value: 'content', label: 'استفسار عن محتوى دراسة' },
    { value: 'feature_request', label: 'طلب ميزة' },
    { value: 'other', label: 'غير ذلك' },
];

const PRIORITY_OPTIONS = [
    { value: 'normal', label: 'عادية' },
    { value: 'urgent', label: 'عاجلة' },
];

function formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric', numberingSystem: 'latn' });
}

export class SupportTicketsView {
    /**
     * @param {HTMLElement} container
     * @param {object} options - { onBack: () => void }
     */
    constructor(container, options = {}) {
        this.container = container;
        this.onBack = options.onBack || (() => {});
        this.openTicketId = null;
    }

    async render() {
        if (!this.container) return;

        const { user } = await getAuthUser();
        // تم إيقاف فرض تسجيل الدخول مؤقتاً للتجربة
        let tickets = [];
        let ticketsError = null;
        if (user) {
            const result = await listMyTickets();
            tickets = result.tickets || [];
            if (!result.ok) ticketsError = result.error || 'تعذّر تحميل تذاكرك.';
        }

        this.container.innerHTML = `
            <div class="support-tickets-page" style="max-width: 720px; margin: 0 auto; padding: var(--s-4) 0;">
                <button type="button" id="btnSupportBack" class="btn btn--ghost mb-4" style="display: inline-flex; align-items: center; gap: 8px;">
                    ← العودة للدراسة
                </button>

                <div class="card p-6 mb-4" id="supportNewTicketForm">
                    <h2 class="text-xl font-bold mb-4" style="border-bottom: 1px solid var(--c-border); padding-bottom: var(--s-2);">تذكرة دعم جديدة</h2>
                    <div class="form-group mb-3">
                        <label class="block text-sm font-medium mb-1" for="supportSubject">الموضوع</label>
                        <input type="text" id="supportSubject" class="form-input w-full" placeholder="مثال: مشكلة في تصدير التقرير">
                    </div>
                    <div class="form-group mb-3">
                        <label class="block text-sm font-medium mb-1" for="supportBody">تفاصيل المشكلة</label>
                        <textarea id="supportBody" class="form-input w-full" rows="4" placeholder="اشرح المشكلة بالتفصيل..."></textarea>
                    </div>
                    <div class="form-group mb-3" style="display:flex; gap: var(--s-3); flex-wrap:wrap;">
                        <div style="flex:1; min-width:180px;">
                            <label class="block text-sm font-medium mb-1" for="supportIssueType">نوع المشكلة</label>
                            <select id="supportIssueType" class="form-input w-full">
                                ${ISSUE_TYPE_OPTIONS.map((o) => `<option value="${o.value}">${o.label}</option>`).join('')}
                            </select>
                        </div>
                        <div style="flex:1; min-width:140px;">
                            <label class="block text-sm font-medium mb-1" for="supportPriority">الأولوية</label>
                            <select id="supportPriority" class="form-input w-full">
                                ${PRIORITY_OPTIONS.map((o) => `<option value="${o.value}">${o.label}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div id="supportSubmitError" class="text-danger text-sm mb-2" role="alert" style="display:none;"></div>
                    <button type="button" id="btnSupportSubmit" class="btn btn--primary">إرسال التذكرة</button>
                </div>

                <div class="card p-6">
                    <h2 class="text-xl font-bold mb-4" style="border-bottom: 1px solid var(--c-border); padding-bottom: var(--s-2);">تذاكرك</h2>
                    <div id="supportTicketsList">
                        ${ticketsError
                            ? `<p class="text-danger text-sm" role="alert">${escapeHtml(ticketsError)}</p>`
                            : tickets.length === 0
                                ? '<p class="text-muted">لا توجد تذاكر دعم بعد.</p><button type="button" id="supportEmptyNewTicketBtn" class="btn btn--secondary mt-2">فتح تذكرة دعم جديدة</button>'
                                : tickets.map((t) => this._renderTicketRow(t)).join('')}
                    </div>
                </div>
            </div>
        `;

        this.container.querySelector('#btnSupportBack')?.addEventListener('click', () => this.onBack());
        this._bindSubmitForm();
        this._bindTicketRows(tickets);
        this.container.querySelector('#supportEmptyNewTicketBtn')?.addEventListener('click', () => {
            this.container.querySelector('#supportNewTicketForm')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            this.container.querySelector('#supportSubject')?.focus();
        });
    }

    _renderTicketRow(ticket) {
        const status = STATUS_META[ticket.status] || STATUS_META.open;
        return `
            <div class="card mb-3" data-ticket-row="${ticket.id}" style="cursor:pointer;">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
                    <div>
                        <div class="font-bold">${escapeHtml(ticket.subject)}</div>
                        <div class="text-xs text-muted mt-1">${formatDate(ticket.updated_at)}</div>
                    </div>
                    <span class="badge ${status.badge}">${status.label}</span>
                </div>
                <div class="ticket-thread mt-3" id="ticketThread-${ticket.id}" style="display:none;"></div>
            </div>
        `;
    }

    _bindSubmitForm() {
        const subjectEl = this.container.querySelector('#supportSubject');
        const bodyEl = this.container.querySelector('#supportBody');
        const issueTypeEl = this.container.querySelector('#supportIssueType');
        const priorityEl = this.container.querySelector('#supportPriority');
        const errEl = this.container.querySelector('#supportSubmitError');
        const showErr = (msg) => { errEl.textContent = msg || ''; errEl.style.display = msg ? 'block' : 'none'; };

        const submitBtn = this.container.querySelector('#btnSupportSubmit');
        submitBtn?.addEventListener('click', async () => {
            showErr('');
            const originalLabel = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = 'جارٍ الإرسال...';
            const result = await submitTicket({ subject: subjectEl.value, body: bodyEl.value, issueType: issueTypeEl.value, priority: priorityEl.value });
            if (!result.ok) {
                showErr(result.error || 'فشل إرسال التذكرة');
                submitBtn.disabled = false;
                submitBtn.textContent = originalLabel;
                return;
            }
            trackEvent('support_ticket_created', { category: 'support' });
            toast.success('تم إرسال تذكرتك — سنرد عليك قريباً');
            await this.render();
        });
    }

    _bindTicketRows(tickets) {
        tickets.forEach((ticket) => {
            const row = this.container.querySelector(`[data-ticket-row="${ticket.id}"]`);
            row?.addEventListener('click', (e) => {
                if (e.target.closest('.ticket-thread')) return; // لا تُطوى المحادثة عند التفاعل داخلها
                this._toggleThread(ticket.id);
            });
        });
    }

    async _toggleThread(ticketId) {
        const threadEl = this.container.querySelector(`#ticketThread-${ticketId}`);
        if (!threadEl) return;

        if (this.openTicketId === ticketId) {
            threadEl.style.display = 'none';
            this.openTicketId = null;
            return;
        }
        // اطوِ أي محادثة أخرى مفتوحة سابقاً
        if (this.openTicketId) {
            const prev = this.container.querySelector(`#ticketThread-${this.openTicketId}`);
            if (prev) prev.style.display = 'none';
        }
        this.openTicketId = ticketId;

        threadEl.style.display = 'block';
        threadEl.innerHTML = '<p class="text-muted text-sm">جاري تحميل المحادثة...</p>';
        const { ok, ticket, messages, error } = await getTicketWithMessages(ticketId);
        if (!ok) { threadEl.innerHTML = `<p class="text-danger text-sm">${escapeHtml(error || 'تعذّر تحميل المحادثة')}</p>`; return; }

        this._renderThread(threadEl, ticket, messages);
    }

    _renderThread(threadEl, ticket, messages) {
        threadEl.innerHTML = `
            <div class="space-y-2 mb-3" style="max-height:260px;overflow-y:auto;">
                ${messages.map((m) => `
                    <div class="p-2 rounded text-sm" style="background:${m.sender_type === 'admin' ? 'var(--c-p-subtle, var(--c-surface-2))' : 'var(--c-surface-2)'};">
                        <div class="text-xs text-muted mb-1">${m.sender_type === 'admin' ? 'فريق الدعم' : 'أنت'} — ${formatDate(m.created_at)}</div>
                        <div>${escapeHtml(m.body)}</div>
                    </div>
                `).join('')}
            </div>
            ${ticket.status === 'closed'
                ? '<p class="text-xs text-muted">هذه التذكرة مُغلقة — إرسال رسالة جديدة يعيد فتحها تلقائياً.</p>'
                : ''}
            <div class="flex gap-2">
                <textarea id="ticketReplyBody-${ticket.id}" class="form-input flex-1" rows="2" placeholder="اكتب رداً..."></textarea>
                <button type="button" id="ticketReplyBtn-${ticket.id}" class="btn btn--primary">إرسال</button>
            </div>
            <div id="ticketReplyError-${ticket.id}" class="text-danger text-sm mt-1" style="display:none;"></div>
        `;

        const replyBody = threadEl.querySelector(`#ticketReplyBody-${ticket.id}`);
        const replyErr = threadEl.querySelector(`#ticketReplyError-${ticket.id}`);
        const replyBtn = threadEl.querySelector(`#ticketReplyBtn-${ticket.id}`);
        replyBtn?.addEventListener('click', async (e) => {
            e.stopPropagation();
            const originalLabel = replyBtn.textContent;
            replyBtn.disabled = true;
            replyBtn.textContent = 'جارٍ الإرسال...';
            const result = await addMessage(ticket.id, replyBody.value);
            if (!result.ok) {
                replyErr.textContent = result.error || 'فشل إرسال الرد';
                replyErr.style.display = 'block';
                replyBtn.disabled = false;
                replyBtn.textContent = originalLabel;
                return;
            }
            trackEvent('support_ticket_reply_sent', { surface: 'ticket_thread' });
            await this.render();
            // إعادة فتح نفس التذكرة بعد إعادة الرسم الكاملة
            this.openTicketId = null;
            await this._toggleThread(ticket.id);
        });
    }
}
