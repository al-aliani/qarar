/**
 * PaymentReturnView — صفحة العودة بعد الدفع (Moyasar/Stripe يُعيدان توجيه
 * المتصفح هنا بعد إتمام/إلغاء الدفع في صفحتهما المُستضافة).
 *
 * لماذا الاستطلاع (polling) لا افتراض النجاح فوراً: إعادة التوجيه من مزوّد
 * الدفع تحدث فور نجاح الدفع من منظور المستخدم، لكن الـwebhook (المصدر الوحيد
 * الموثوق لتحديث orders.status، انظر supabase/functions/webhook-*) قد يصل
 * بعد أجزاء من الثانية إلى بضع ثوانٍ — فروق توقيت شبكة طبيعية. الاعتماد على
 * أي معامل في رابط العودة نفسه (مثل ?success=1) غير آمن لأن العميل يمكنه
 * تزوير أي رابط، فالحالة الحقيقية الوحيدة هي orders.status من القاعدة.
 */
import { getOrderStatus } from '../services/PaymentService.js';

const POLL_INTERVAL_MS = 2000;
const MAX_ATTEMPTS = 10; // ~20 ثانية إجمالاً قبل عرض رسالة "لا يزال قيد المعالجة"

export class PaymentReturnView {
    constructor(container, { orderId, onContinue } = {}) {
        this.container = typeof container === 'string' ? document.getElementById(container) : container;
        this.orderId = orderId || null;
        this.onContinue = onContinue || (() => {});
        this._stopped = false;
    }

    async render() {
        if (!this.container) return;
        if (!this.orderId) {
            this._renderState('error', 'لا يوجد رقم طلب صالح في الرابط.');
            return;
        }
        this._renderState('loading');
        await this._pollUntilResolved();
    }

    async _pollUntilResolved() {
        for (let attempt = 0; attempt < MAX_ATTEMPTS && !this._stopped; attempt++) {
            const status = await getOrderStatus(this.orderId);
            if (status === 'paid') return this._renderState('paid');
            if (status === 'failed') return this._renderState('failed');
            if (status === 'refunded') return this._renderState('refunded');
            await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        }
        if (!this._stopped) this._renderState('still_pending');
    }

    destroy() {
        this._stopped = true;
    }

    _renderState(state, extraMessage = '') {
        if (!this.container) return;
        const messages = {
            loading: { icon: '⏳', title: 'جاري تأكيد الدفع...', body: 'لحظات فقط بينما نتحقق من نجاح عملية الدفع.', showContinue: false },
            paid: { icon: '✅', title: 'تم الدفع بنجاح', body: 'تم تفعيل الوصول لتصدير التقرير النهائي لهذه الدراسة.', showContinue: true },
            failed: { icon: '❌', title: 'لم تكتمل عملية الدفع', body: 'يمكنك المحاولة مرة أخرى، أو التواصل معنا عبر واتساب.', showContinue: true },
            refunded: { icon: 'ℹ️', title: 'تم استرداد هذا الطلب', body: 'إن كان هذا غير متوقّع، تواصل معنا عبر واتساب.', showContinue: true },
            still_pending: { icon: '⏳', title: 'الدفع قيد المعالجة', body: 'يستغرق التأكيد وقتاً أطول من المعتاد أحياناً — سنحدّث الحالة تلقائياً عند فتح الدراسة لاحقاً.', showContinue: true },
            error: { icon: '⚠️', title: 'تعذّر عرض حالة الدفع', body: extraMessage, showContinue: true },
        };
        const m = messages[state] || messages.error;

        this.container.innerHTML = `
            <div class="payment-return-view" style="max-width:480px;margin:60px auto;text-align:center;padding:24px;">
                <div style="font-size:2.5rem;margin-bottom:12px;">${m.icon}</div>
                <h2 style="margin-bottom:8px;">${m.title}</h2>
                <p class="text-muted">${m.body}</p>
                ${m.showContinue ? `<button type="button" id="btnPaymentReturnContinue" class="btn btn--primary mt-4">متابعة</button>` : ''}
            </div>
        `;

        this.container.querySelector('#btnPaymentReturnContinue')?.addEventListener('click', () => this.onContinue());
    }
}
