import { advanceWorkRequest, listAssignedRequests, sendRequestMessage, submitSupplierQuote } from '../services/ConnectedWorkspaceService.js';
import { escapeHtml } from '../utils/escape.js';
import { toast } from '../utils/toast.js';

const labels = { new: 'جديد', received: 'مستلم', processing: 'قيد العمل', waiting_customer: 'بانتظار العميل', offered: 'تم تقديم النتيجة', completed: 'مكتمل', rejected: 'مرفوض', cancelled: 'ملغي' };

export class ExternalPartyPortalView {
    constructor(containerId) { this.container = document.getElementById(containerId); }

    async render() {
        this.container.innerHTML = '<p class="p-6 text-muted">جاري تحميل الطلبات المسندة…</p>';
        const result = await listAssignedRequests();
        if (!result.ok) { this.container.innerHTML = `<div class="card p-6">${escapeHtml(result.error)}</div>`; return; }
        this.requests = result.data;
        this.container.innerHTML = `<div class="p-6 max-w-5xl mx-auto" dir="rtl"><header class="card p-6 mb-5"><span class="text-xs text-gold">بوابة الجهات</span><h1 class="text-2xl font-bold">الطلبات المسندة إليك</h1><p class="text-muted mt-2">استلم الطلب، حدّث حالته، راسل صاحب المشروع وقدّم النتيجة من هنا.</p></header><div class="space-y-4">${this.requests.map(item => `<article class="card p-5"><div class="flex justify-between gap-3"><div><strong>${escapeHtml(item.title)}</strong><p class="text-sm text-muted mt-1">${escapeHtml(item.details || '')}</p></div><span class="badge">${escapeHtml(labels[item.status] || item.status)}</span></div>${item.next_action ? `<p class="mt-3"><strong>الإجراء التالي:</strong> ${escapeHtml(item.next_action)}</p>` : ''}<div class="flex flex-wrap gap-2 mt-4"><button class="btn btn--secondary btn--sm" data-status="received" data-request="${item.id}">استلام</button><button class="btn btn--secondary btn--sm" data-status="processing" data-request="${item.id}">بدء العمل</button><button class="btn btn--ghost btn--sm" data-message="${item.id}">رسالة</button>${item.request_type === 'supplier_quote' ? `<button class="btn btn--primary btn--sm" data-quote="${item.id}">تقديم عرض</button>` : `<button class="btn btn--primary btn--sm" data-status="completed" data-request="${item.id}">إنهاء الطلب</button>`}</div></article>`).join('') || '<div class="card p-6 text-muted">لا توجد طلبات مسندة إليك حاليًا.</div>'}</div></div>`;
        this._bind();
    }

    _bind() {
        this.container.querySelectorAll('[data-status]').forEach(button => button.addEventListener('click', async () => {
            const saved = await advanceWorkRequest(button.dataset.request, button.dataset.status); if (!saved.ok) return toast.error(saved.error); toast.success('تم تحديث الطلب'); await this.render();
        }));
        this.container.querySelectorAll('[data-message]').forEach(button => button.addEventListener('click', async () => {
            const body = window.prompt('الرسالة لصاحب المشروع'); if (!body) return; const sent = await sendRequestMessage(button.dataset.message, body); sent.ok ? toast.success('تم إرسال الرسالة') : toast.error(sent.error);
        }));
        this.container.querySelectorAll('[data-quote]').forEach(button => button.addEventListener('click', async () => {
            const request = this.requests.find(item => item.id === button.dataset.quote); if (!request) return;
            const itemLabel = window.prompt('اسم بند التكلفة'); const amount = Number(window.prompt('قيمة العرض بالريال'));
            if (!itemLabel || !Number.isFinite(amount) || amount < 0) return toast.error('أدخل اسماً ومبلغاً صحيحاً');
            const sectionKey = window.prompt('قسم الدراسة المرتبط', 'technical') || 'technical';
            const itemKey = window.prompt('مسار الحقل داخل القسم (اختياري)', '') || null;
            const validUntil = window.prompt('تاريخ انتهاء العرض YYYY-MM-DD', '') || null;
            const saved = await submitSupplierQuote(request, { itemLabel, amount, sectionKey, itemKey, validUntil });
            if (!saved.ok) return toast.error(saved.error); toast.success('تم تقديم العرض وربطه بالمشروع'); await this.render();
        }));
    }
}
