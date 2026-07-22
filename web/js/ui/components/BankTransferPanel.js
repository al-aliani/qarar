/**
 * BankTransferPanel — عرض بيانات التحويل البنكي (آيبان/اسم مستفيد/بنك) + رابط
 * واتساب لإرسال إثبات الحوالة، بعد إنشاء طلب pending عبر create-checkout
 * (provider: 'bank_transfer'). مصدر وحيد مشترك بين PaywallModal.js
 * (من داخل الدراسة) وSubscriptionCheckoutView.js (من صفحة التسعير) بدل تكرار
 * نفس المنطق غير التافه بملفين.
 */
import { PRICING_PACKAGES, formatPrice } from '../../core/pricing.js';
import { getBankTransferConfig, buildWhatsAppLink } from '../../config.js';
import { trackEvent } from '../../utils/analytics.js';
import { escapeHtml } from '../../utils/escape.js';

/**
 * @param {HTMLElement} container - يُستبدَل محتواه بالكامل بلوحة التحويل.
 * @param {{tier:string, orderId:string, amount:number, onBack:() => void}} params
 * @returns {boolean} false إن كان إعداد التحويل البنكي غير صالح (لا يوجد شيء لعرضه)
 */
export function renderBankTransferPanel(container, { tier, orderId, amount, onBack }) {
    const b = getBankTransferConfig();
    if (!b) return false;
    const pkg = PRICING_PACKAGES.find((p) => p.id === tier) || {};
    const amountText = `${formatPrice(amount ?? pkg.price)} ريال`;
    const ref = String(orderId || '').slice(0, 8);
    const waText = `السلام عليكم، حوّلت مبلغ باقة «${pkg.name || ''}» (${amountText}) بنكياً.\nرقم الطلب المرجعي: ${ref}\nمرفق إثبات الحوالة.`;
    const waLink = buildWhatsAppLink(waText);

    const row = (label, value, copyable) => `
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid var(--c-border,rgba(255,255,255,.08));">
            <span class="text-xs text-muted">${escapeHtml(label)}</span>
            <span style="font-weight:700;direction:ltr;text-align:left;" dir="ltr">${escapeHtml(value)}${copyable ? ` <button type="button" class="btn--text bank-copy" data-copy="${escapeHtml(value)}" title="نسخ" style="font-weight:400;">نسخ</button>` : ''}</span>
        </div>`;

    container.innerHTML = `
        <button type="button" id="bankBack" class="btn--text text-sm text-muted mb-2">← رجوع للباقات</button>
        <div class="alert alert--warning mb-3">حوّل المبلغ التالي إلى حساب الشركة، ثم أرسل إثبات الحوالة عبر واتساب. يُفعّل التصدير خلال ساعات العمل بعد التحقق من وصول المبلغ.</div>
        <div class="card" style="padding:14px;border-radius:12px;">
            ${row('المبلغ المطلوب', amountText)}
            ${row('اسم المستفيد', b.beneficiaryName || '')}
            ${row('البنك', b.bankName || '')}
            ${row('الآيبان (IBAN)', b.iban || '', true)}
            ${b.accountNumber ? row('رقم الحساب', b.accountNumber, true) : ''}
            ${row('رقم الطلب المرجعي', ref, true)}
        </div>
        <p class="text-xs text-muted mt-2">اذكر رقم الطلب المرجعي (${escapeHtml(ref)}) في تفاصيل التحويل ليسهل مطابقته بسرعة.</p>
        ${waLink ? `<a href="${waLink}" target="_blank" rel="noopener" class="btn btn--primary btn-block mt-3">أرسلت الحوالة — إرسال الإثبات عبر واتساب</a>` : '<p class="text-xs text-danger mt-3">رقم واتساب الدعم غير مضبوط — تواصل عبر قنوات الاتصال في الموقع لإرسال الإثبات.</p>'}
    `;
    container.querySelector('#bankBack')?.addEventListener('click', () => onBack?.());
    container.querySelectorAll('.bank-copy').forEach((btn) => {
        btn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(btn.dataset.copy || '');
                btn.textContent = 'تم النسخ ✓';
                setTimeout(() => { btn.textContent = 'نسخ'; }, 1500);
            } catch { /* تجاهل */ }
        });
    });
    trackEvent('bank_transfer_shown', { tier, orderId: ref });
    return true;
}
