/**
 * نافذة قفل الترقية (Paywall Modal) — تدقيق 2026-07-08 (ملاحظة عالية #39، قرار
 * المالك): كان الموقع يسوّق ثلاث باقات مدفوعة (249/990/2900 ريال) بلا أي حاجز
 * فعلي يمنع الوصول المجاني للتقرير النهائي — فجوة ثقة مباشرة بين التسويق والمنتج.
 *
 * تدقيق 2026-07-09 (أتمتة الدفع): أُضيف دفع فعلي (Moyasar/Stripe عبر
 * PaymentService.js → Edge Functions) لكل الباقات الثلاث. الباقة "ذاتي" (self)
 * تعتمد الدفع المباشر كخيار أول (channel:'app' أصلاً في pricing.js)؛ باقتا
 * "مراجَع بخبير"/"خدمة كاملة" (channel:'whatsapp') تُبقي واتساب كخيار أول عمداً
 * (تتطلبان تدخلاً بشرياً فعلياً — مراجعة/إعداد يدوي — لا مجرد فتح قفل تلقائي)
 * مع إضافة الدفع المباشر كخيار ثانٍ لمن يفضّل الدفع فوراً دون انتظار محادثة.
 */
import { PRICING_PACKAGES, formatPrice, CURRENCY_SYMBOL } from '../core/pricing.js';
import { buildWhatsAppLink, REFUND_POLICY } from '../config.js';
import { startCheckout } from '../services/PaymentService.js';
import { trackEvent } from '../utils/analytics.js';

const PACKAGE_FEATURES = {
    self: ['قوالب مختصين', 'مؤشرات فورية', 'تصدير PDF/Excel/Word', 'تعديل حي غير محدود'],
    reviewed: ['كل ما في الباقة الذاتية', 'مراجعة مختص لدراستك', 'تحليل حساسية موسّع', 'تسليم خلال 24–48 ساعة'],
    full: ['كل ما في المراجَعة', 'جمع وتنظيم المدخلات نيابة عنك', 'تقرير مُعَدّ للممول', 'جلسة شرح + قائمة تعديلات'],
};

function escapeHtml(str) {
    if (str == null) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export class PaywallModal {
    constructor(overlayId, store) {
        this.overlay = document.getElementById(overlayId);
        if (!this.overlay) {
            this.overlay = document.createElement('div');
            this.overlay.id = overlayId || 'paywallModalOverlay';
            this.overlay.className = 'modal-overlay';
            document.body.appendChild(this.overlay);
        }
        this.store = store;
    }

    /** @param {string} formatLabel - اسم صيغة التصدير المطلوبة (تُعرض في الرسالة، مثال: "تقرير PDF شامل") */
    open(formatLabel) {
        this.formatLabel = formatLabel || 'هذا التقرير';
        this.render();
        this.overlay.classList.add('is-open');
        document.body.style.overflow = 'hidden';
        this._onEscape = (e) => { if (e.key === 'Escape') this.close(); };
        document.addEventListener('keydown', this._onEscape);
    }

    close() {
        this.overlay.classList.remove('is-open');
        document.body.style.overflow = '';
        if (this._onEscape) {
            document.removeEventListener('keydown', this._onEscape);
            this._onEscape = null;
        }
    }

    render() {
        const state = this.store?.getState?.() || {};
        const projectName = state.projectInfo?.name || 'مشروعي';
        this.studyId = state.projectInfo?.id || state.id || null;

        const cards = PRICING_PACKAGES.map(pkg => {
            const features = PACKAGE_FEATURES[pkg.id] || [];
            const message = `مرحباً، أرغب بترقية دراسة «${projectName}» لباقة «${pkg.name}» (${formatPrice(pkg.price)} ${CURRENCY_SYMBOL}) للحصول على ${this.formatLabel}.`;
            const waLink = buildWhatsAppLink(message);
            // waLink يكون null إن كان رقم واتساب غير مضبوط بعد (web/public/whatsapp-config.js) —
            // نُخفي الزر بدل عرض رابط مكسور بلا مستلم يبدو كأن لا أحد يرد على طلبات الشراء.
            const waButton = waLink
                ? `<a href="${escapeHtml(waLink)}" target="_blank" rel="noopener noreferrer" class="btn btn--secondary btn-block btn-whatsapp-upgrade" data-package="${pkg.id}">
                    📱 تواصل عبر واتساب للترقية
                </a>`
                : `<p class="text-xs text-muted" style="margin:4px 0;">قناة واتساب غير متاحة حالياً — استخدم الدفع المباشر أدناه.</p>`;
            const payButtons = `
                <div class="paywall-pay-buttons" style="display:flex;flex-direction:column;gap:6px;">
                    <button type="button" class="btn btn--primary btn-block btn-pay-now" data-package="${pkg.id}" data-provider="moyasar">
                        ادفع الآن (مدى / Apple Pay / STC Pay)
                    </button>
                    <button type="button" class="btn btn--outline btn-block btn-pay-now" data-package="${pkg.id}" data-provider="tamara">
                        قسّطها مع تمارا
                    </button>
                    <button type="button" class="btn btn--outline btn-block btn-pay-now" data-package="${pkg.id}" data-provider="stripe">
                        ادفع ببطاقة دولية
                    </button>
                </div>`;
            // channel='app' (الباقة الذاتية): الدفع المباشر أولاً. channel='whatsapp'
            // (الباقتان الأخريان): واتساب أولاً عمداً — تتطلبان تدخلاً بشرياً فعلياً،
            // مع إبقاء الدفع المباشر خياراً ثانياً لمن لا يريد الانتظار.
            const buttonsHtml = pkg.channel === 'app'
                ? `${payButtons}<div class="mt-2">${waButton}</div>`
                : `${waButton}<div class="mt-2">${payButtons}</div>`;
            return `
                <div class="card paywall-package-card" style="padding:16px;border-radius:12px;">
                    <h4 style="margin:0 0 4px;">${escapeHtml(pkg.name)}</h4>
                    <div class="text-gold" style="font-size:1.4rem;font-weight:700;margin-bottom:8px;">${formatPrice(pkg.price)} <span style="font-size:0.9rem;font-weight:400;">${escapeHtml(pkg.unit)}</span></div>
                    <ul style="margin:0 0 12px;padding-inline-start:18px;font-size:0.85rem;color:var(--c-text-muted,#94a3b8);">
                        ${features.map(f => `<li>${escapeHtml(f)}</li>`).join('')}
                    </ul>
                    ${buttonsHtml}
                </div>
            `;
        }).join('');

        this.overlay.innerHTML = `
            <div class="modal-card paywall-modal animate-scale-in" role="dialog" aria-modal="true" aria-labelledby="paywall-modal-title">
                <div class="modal-header">
                    <h3 id="paywall-modal-title">🔒 ترقية مطلوبة</h3>
                    <button type="button" class="btn-close paywall-close" aria-label="إغلاق">×</button>
                </div>
                <div class="modal-body">
                    <p class="text-muted mb-4">${escapeHtml(this.formatLabel)} متاح ضمن الباقات المدفوعة. ادفع مباشرة الآن، أو تواصل معنا عبر واتساب.</p>
                    <div id="paywallPayError" class="text-danger text-sm mb-2" style="display:none;"></div>
                    <div class="paywall-packages-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;">
                        ${cards}
                    </div>
                </div>
                <div class="modal-footer">
                    <p class="text-xs text-muted text-center w-full">${escapeHtml(REFUND_POLICY.shortTitle)} على الباقات المدفوعة إن لم تُقنعك النتيجة.</p>
                    <p class="text-xs text-muted text-center w-full">الأدوات المجانية (JSON، CSV، لوحة المستثمر للمشاركة) تبقى بلا قيود.</p>
                </div>
            </div>
        `;

        this.overlay.querySelector('.paywall-close')?.addEventListener('click', () => this.close());
        this.overlay.addEventListener('click', (e) => { if (e.target === this.overlay) this.close(); });

        this.overlay.querySelectorAll('.btn-pay-now').forEach(btn => {
            btn.addEventListener('click', () => this._handlePayNow(btn));
        });
    }

    async _handlePayNow(btn) {
        const tier = btn.dataset.package;
        const provider = btn.dataset.provider;
        const errEl = this.overlay.querySelector('#paywallPayError');
        const showErr = (msg) => { if (errEl) { errEl.textContent = msg || ''; errEl.style.display = msg ? 'block' : 'none'; } };

        if (!this.studyId) {
            showErr('احفظ الدراسة أولاً قبل الدفع (تحتاج معرّف دراسة صالحاً).');
            return;
        }

        const orig = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'جاري تجهيز الدفع...';
        showErr('');

        trackEvent('checkout_start', { tier, provider });
        const result = await startCheckout({ tier, studyId: this.studyId, provider });
        if (result.ok && result.checkoutUrl) {
            window.location.href = result.checkoutUrl;
            return;
        }

        showErr(result.error || 'تعذّر بدء عملية الدفع. جرّب واتساب بدلاً من ذلك أو حاول لاحقاً.');
        btn.disabled = false;
        btn.textContent = orig;
    }
}
