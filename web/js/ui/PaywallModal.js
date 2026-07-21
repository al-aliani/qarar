/**
 * نافذة قفل الترقية (Paywall Modal) — تدقيق 2026-07-08 (ملاحظة عالية #39، قرار
 * المالك): كان الموقع يسوّق ثلاث باقات مدفوعة (299/1999/4999 ريال) بلا أي حاجز
 * فعلي يمنع الوصول المجاني للتقرير النهائي — فجوة ثقة مباشرة بين التسويق والمنتج.
 *
 * تدقيق 2026-07-09 (أتمتة الدفع): أُضيف دفع فعلي (Moyasar/Stripe عبر
 * PaymentService.js → Edge Functions) لكل الباقات المدفوعة. القرار الحالي:
 * الباقات المدفوعة الثلاث (ذاتي/مراجَع بخبير/خدمة كاملة) كلها channel:'app'
 * في pricing.js، وتُعرض بنفس أزرار الدفع المباشر داخل المنصة (مدى/تمارا/Stripe)
 * بلا أي مسار واتساب. المراجعة/الإعداد اليدوي في باقتَي «مراجَع بخبير»/«خدمة
 * كاملة» يجريان بعد إتمام الدفع لا قبله.
 */
import { PRICING_PACKAGES, formatPrice } from '../core/pricing.js';
import { REFUND_POLICY, getBankTransferConfig, buildWhatsAppLink } from '../config.js';
import { startCheckout } from '../services/PaymentService.js';
import { getExperimentVariant, trackEvent } from '../utils/analytics.js';
import { trapFocus } from '../utils/focusTrap.js';

function escapeHtml(str) {
    if (str == null) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// المحرّك قد يحفظ NO-GO افتراضياً عندما تكون كل المؤشرات أصفاراً. لا نعرض
// هذه النتيجة للمستخدم كقرار فعلي داخل بوابة الدفع قبل وجود نموذج مالي حقيقي.
function hasRealModelResults(results) {
    const indicators = results?.indicators || {};
    const hasNonZeroIndicator = [
        indicators.npv,
        indicators.irr,
        indicators.roi,
        indicators.breakEvenPointValue,
        indicators.profitMargin
    ].some(value => Number(value) !== 0 && Number.isFinite(Number(value)));
    return hasNonZeroIndicator || Number(indicators.paybackPeriod) > 0;
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
        this._removeFocusTrap?.();
        this._removeFocusTrap = trapFocus(this.overlay.querySelector('[role="dialog"]'), { initial: '.paywall-close' });
    }

    close() {
        this.overlay.classList.remove('is-open');
        document.body.style.overflow = '';
        if (this._onEscape) {
            document.removeEventListener('keydown', this._onEscape);
            this._onEscape = null;
        }
        this._removeFocusTrap?.();
        this._removeFocusTrap = null;
    }

    render() {
        const state = this.store?.getState?.() || {};
        this.studyId = state.projectInfo?.id || state.id || null;
        // إعداد التحويل البنكي (null إن كان معطّلاً أو الآيبان غير محقّق) — يُضاف زره فقط حينها.
        this.bankCfg = getBankTransferConfig();

        // ملاحظة شفافية: لو زار العميل لوحة القرار قبل التصدير (النسق المعتاد) تكون
        // results.decision محفوظة بالفعل بمخزن الحالة (انظر DecisionDashboard.js) — لا
        // تمنع الشراء، تُوضّح فقط أن التقرير سيشرح توصية غير إيجابية لا أن الدفع "يفتح" GO.
        const decision = hasRealModelResults(state.results) ? state.results?.decision : null;
        const decisionNote = decision === 'NO-GO'
            ? '<div class="alert alert--danger mb-3">دراستك أظهرت توصية عدم المضي (NO-GO) حالياً — هذا التقرير يوضّح لماذا، وهو ما يحميك من قرار استثماري خاطئ لا أنه يمنعك من الشراء.</div>'
            : decision === 'REVISE'
                ? '<div class="alert alert--warning mb-3">دراستك تحتاج مراجعة (REVISE) حالياً — هذا التقرير يوضّح النقاط التي تحتاج تعديلاً.</div>'
                : '';

        const pricingVariant = getExperimentVariant('pricing_cards', ['control', 'recommended_first']);
        const paidPackages = PRICING_PACKAGES.filter(pkg => pkg.price > 0);
        const orderedPackages = pricingVariant === 'recommended_first'
            ? [...paidPackages].sort((a, b) => Number(b.recommended) - Number(a.recommended))
            : paidPackages;
        const cards = orderedPackages.map(pkg => {
            const features = pkg.features || [];
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
                    ${this.bankCfg ? `
                    <button type="button" class="btn btn--outline btn-block btn-pay-now" data-package="${pkg.id}" data-provider="bank_transfer">
                        تحويل بنكي على حساب الشركة
                    </button>` : ''}
                </div>`;
            return `
                <div class="card paywall-package-card ${pkg.recommended ? 'paywall-package-card--recommended' : ''}" data-package-card="${pkg.id}" style="padding:16px;border-radius:12px;">
                    ${pkg.recommended ? '<span class="paywall-recommended">الأكثر مناسبة للتقديم</span>' : ''}
                    <h4 style="margin:0 0 4px;">${escapeHtml(pkg.name)}</h4>
                    <div class="text-gold" style="font-size:1.4rem;font-weight:700;margin-bottom:8px;">${formatPrice(pkg.price)} <span style="font-size:0.9rem;font-weight:400;">${escapeHtml(pkg.unit)}</span></div>
                    <p class="text-xs" style="margin:0 0 4px;">${escapeHtml(pkg.audience || '')}</p>
                    <p class="text-xs text-muted" style="margin:0 0 8px;">التسليم: ${escapeHtml(pkg.delivery || 'فوري')}</p>
                    <ul style="margin:0 0 12px;padding-inline-start:18px;font-size:0.85rem;color:var(--c-text-muted,#94a3b8);">
                        ${features.map(f => `<li>${escapeHtml(f)}</li>`).join('')}
                    </ul>
                    ${payButtons}
                </div>
            `;
        }).join('');

        this.overlay.innerHTML = `
            <div class="modal-card paywall-modal animate-scale-in" role="dialog" aria-modal="true" aria-labelledby="paywall-modal-title">
                <div class="modal-header">
                    <h3 id="paywall-modal-title"><svg class="ic" aria-hidden="true"><use href="#i-shield"/></svg> ترقية مطلوبة</h3>
                    <button type="button" class="btn-close paywall-close" aria-label="إغلاق">×</button>
                </div>
                <div class="modal-body">
                    <p class="text-muted mb-4">${escapeHtml(this.formatLabel)} متاح ضمن الباقات المدفوعة. اختر الباقة وطريقة الدفع لإكمال الطلب داخل المنصة.</p>
                    <button type="button" id="btnPreviewLockedReport" class="btn btn--secondary btn-block mb-3"><svg class="ic" aria-hidden="true"><use href="#i-doc"/></svg> معاينة التقرير قبل الشراء</button>
                    <div id="paywallPayError" class="text-danger text-sm mb-2" style="display:none;"></div>
                    ${decisionNote}
                    <div class="paywall-packages-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;">
                        ${cards}
                    </div>
                </div>
                <div class="modal-footer">
                    <p class="text-xs text-muted text-center w-full">جميع الأسعار شاملة ضريبة القيمة المضافة (15%) — لا رسوم إضافية عند الدفع.</p>
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
        this.overlay.querySelector('#btnPreviewLockedReport')?.addEventListener('click', async () => {
            const { ReportPreviewModal } = await import('./ReportPreviewModal.js');
            const formatLabel = this.formatLabel;
            this.close();
            await new ReportPreviewModal(this.store, 'reportPreviewOverlay', () => this.open(formatLabel)).open(formatLabel);
        });

        this._applyPreferredTierHighlight();
    }

    /**
     * تمييز بصري بحت للباقة المفضّلة (اختيار غير مُلزم يحفظه PackagePreferenceModal
     * عند التسجيل، إن وُجد) — لا يغيّر مسار الشراء الفعلي إطلاقاً، ولا يمنع/يؤخّر
     * فتح النافذة (يُشغَّل بعد render() لا قبله، ويفشل بصمت عند أي خطأ).
     */
    async _applyPreferredTierHighlight() {
        try {
            const { getUserProfile } = await import('../../supabaseClient.js');
            const { ok, profile } = await getUserProfile();
            const tier = profile?.preferred_tier;
            if (!ok || !['self', 'reviewed', 'full'].includes(tier)) return;

            const card = this.overlay?.querySelector(`[data-package-card="${tier}"]`);
            if (!card) return;
            card.style.borderColor = 'var(--c-gold-500, #8a5f1c)';
            const badge = document.createElement('div');
            badge.className = 'text-xs text-gold mb-1';
            badge.textContent = 'اختيارك المفضّل';
            card.insertBefore(badge, card.firstChild);
        } catch {}
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

        if (provider === 'bank_transfer') {
            return this._handleBankTransfer(btn, tier, showErr);
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
        // كوبون خصم 100%: الخادم أكّد الطلب paid مباشرة بلا مزوّد دفع — نوجّه لنفس
        // صفحة نتيجة الدفع التي يعود لها العميل بعد أي مزوّد حقيقي، لإعادة استخدام
        // منطقها الموجود (فتح التصدير + رسالة النجاح) بدل بناء مسار جديد.
        if (result.ok && result.freeViaCoupon) {
            window.location.hash = `#/payment-return?order=${result.orderId}`;
            return;
        }

        showErr(result.error || 'تعذّر بدء عملية الدفع. حاول مرة أخرى لاحقاً.');
        trackEvent('payment_error', { tier, provider, message: result.error || 'checkout_failed' });
        btn.disabled = false;
        btn.textContent = orig;
    }

    /**
     * تحويل بنكي (قناة يدوية): يُنشئ طلباً pending عبر create-checkout (بلا رابط دفع
     * خارجي)، ثم يعرض بيانات حساب الشركة + المبلغ + رقم مرجعي، وزر واتساب لإرسال إثبات
     * الحوالة. يؤكّده الأدمن يدوياً بعد وصولها فيصبح status='paid' ويُفتح التصدير.
     */
    async _handleBankTransfer(btn, tier, showErr) {
        const orig = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'جاري تجهيز الطلب...';
        showErr('');

        trackEvent('checkout_start', { tier, provider: 'bank_transfer' });
        const result = await startCheckout({ tier, studyId: this.studyId, provider: 'bank_transfer' });
        if (result.ok && result.bankTransfer) {
            this._renderBankPanel(tier, result.orderId, result.amount);
            return;
        }
        showErr(result.error || 'تعذّر إنشاء طلب التحويل البنكي. حاول لاحقاً.');
        trackEvent('payment_error', { tier, provider: 'bank_transfer', message: result.error || 'bank_transfer_failed' });
        btn.disabled = false;
        btn.textContent = orig;
    }

    _renderBankPanel(tier, orderId, amount) {
        const b = this.bankCfg || {};
        const pkg = PRICING_PACKAGES.find(p => p.id === tier) || {};
        const amountText = `${formatPrice(amount ?? pkg.price)} ريال`;
        const ref = String(orderId || '').slice(0, 8);
        const waText = `السلام عليكم، حوّلت مبلغ باقة «${pkg.name || ''}» (${amountText}) بنكياً.\nرقم الطلب المرجعي: ${ref}\nمرفق إثبات الحوالة.`;
        const waLink = buildWhatsAppLink(waText);
        const body = this.overlay.querySelector('.modal-body');
        if (!body) return;
        const row = (label, value, copyable) => `
            <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid var(--c-border,rgba(255,255,255,.08));">
                <span class="text-xs text-muted">${escapeHtml(label)}</span>
                <span style="font-weight:700;direction:ltr;text-align:left;" dir="ltr">${escapeHtml(value)}${copyable ? ` <button type="button" class="btn--text bank-copy" data-copy="${escapeHtml(value)}" title="نسخ" style="font-weight:400;">نسخ</button>` : ''}</span>
            </div>`;
        body.innerHTML = `
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
        body.querySelector('#bankBack')?.addEventListener('click', () => this.render());
        body.querySelectorAll('.bank-copy').forEach(btn => {
            btn.addEventListener('click', async () => {
                try { await navigator.clipboard.writeText(btn.dataset.copy || ''); btn.textContent = 'تم النسخ ✓'; setTimeout(() => { btn.textContent = 'نسخ'; }, 1500); } catch { /* تجاهل */ }
            });
        });
        trackEvent('bank_transfer_shown', { tier, orderId: ref });
    }
}
