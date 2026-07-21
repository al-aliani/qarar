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
import { buildWhatsAppLink } from '../config.js';
import { trackEvent } from '../utils/analytics.js';

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
        if (state === 'paid') trackEvent('payment_success', { orderId: this.orderId });
        if (state === 'failed' || state === 'refunded') trackEvent('payment_error', { orderId: this.orderId, status: state });
        const messages = {
            loading: { icon: 'i-reset', title: 'جاري تأكيد الدفع...', body: 'لحظات فقط بينما نتحقق من نجاح عملية الدفع.', showContinue: false, showWhatsApp: false },
            paid: { icon: 'i-check', title: 'تم الدفع بنجاح', body: 'تم تفعيل الوصول لتصدير التقرير النهائي لهذه الدراسة.', showContinue: true, showWhatsApp: false },
            failed: { icon: 'i-x', title: 'لم تكتمل عملية الدفع', body: 'يمكنك المحاولة مرة أخرى، أو التواصل مع الدعم الفني عبر واتساب.', showContinue: true, showWhatsApp: true, waMessage: 'مرحباً، واجهت مشكلة أثناء إتمام دفع طلب رقم ' + this.orderId + ' في منصة «قرار» ولم يكتمل. أحتاج مساعدة.' },
            refunded: { icon: 'i-warning', title: 'تم استرداد هذا الطلب', body: 'إن كان هذا غير متوقّع، تواصل مع الدعم الفني عبر واتساب.', showContinue: true, showWhatsApp: true, waMessage: 'مرحباً، ألاحظ أن طلبي رقم ' + this.orderId + ' في منصة «قرار» أصبح "مُسترَداً" وهذا غير متوقَّع مني. هل يمكن المساعدة؟' },
            still_pending: { icon: 'i-reset', title: 'الدفع قيد المعالجة', body: 'يستغرق التأكيد وقتاً أطول من المعتاد أحياناً — سنحدّث الحالة تلقائياً عند فتح الدراسة لاحقاً. إن استمر الأمر، تواصل مع الدعم الفني.', showContinue: true, showWhatsApp: true, waMessage: 'مرحباً، طلب الدفع رقم ' + this.orderId + ' في منصة «قرار» لا يزال "قيد المعالجة" منذ فترة. هل يمكن التحقق من حالته؟' },
            error: { icon: 'i-warning', title: 'تعذّر عرض حالة الدفع', body: extraMessage, showContinue: true, showWhatsApp: false },
        };
        const m = messages[state] || messages.error;
        const waLink = m.showWhatsApp ? buildWhatsAppLink(m.waMessage) : null;
        // waLink يكون null إن كان رقم واتساب غير مضبوط بعد — لا نعرض رابطاً مكسوراً
        // (href="null") في مسار دعم دفع فاشل تحديداً، أهم لحظة يحتاج فيها العميل تواصلاً
        // حقيقياً (نفس منطق التراجع الرشيق في PaywallModal.js وDashboardView.js).
        const waAction = m.showWhatsApp
            ? (waLink
                ? `<a href="${waLink}" target="_blank" rel="noopener noreferrer" class="btn btn--secondary">تواصل مع الدعم عبر واتساب</a>`
                : `<p class="text-xs text-muted" style="margin:4px 0;">قناة واتساب غير متاحة حالياً.</p>`)
            : '';

        this.container.innerHTML = `
            <div class="payment-return-view" style="max-width:480px;margin:60px auto;text-align:center;padding:24px;">
                <div style="font-size:2.5rem;margin-bottom:12px;"><svg class="ic" aria-hidden="true" style="width:2.5rem;height:2.5rem;"><use href="#${m.icon}"/></svg></div>
                <h2 style="margin-bottom:8px;">${m.title}</h2>
                <p class="text-muted">${m.body}</p>
                <div class="d-flex gap-2 justify-center mt-4" style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
                    ${waAction}
                    ${m.showContinue ? `<button type="button" id="btnPaymentReturnContinue" class="btn btn--primary">متابعة</button>` : ''}
                </div>
            </div>
        `;

        this.container.querySelector('#btnPaymentReturnContinue')?.addEventListener('click', () => this.onContinue());
    }
}
