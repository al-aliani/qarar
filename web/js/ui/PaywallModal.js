/**
 * نافذة قفل الترقية (Paywall Modal) — تدقيق 2026-07-08 (ملاحظة عالية #39، قرار
 * المالك): كان الموقع يسوّق ثلاث باقات مدفوعة (249/990/2900 ريال) بلا أي حاجز
 * فعلي يمنع الوصول المجاني للتقرير النهائي — فجوة ثقة مباشرة بين التسويق والمنتج.
 * لا بوابة دفع فعلية متاحة بعد (لا Stripe/Moyasar/PayTabs)، فالترقية للباقات
 * الثلاث كلها عبر تواصل واتساب يدوي حالياً (قرار صريح: الأصدق الآن من زر دفع
 * مكسور أو وهمي).
 */
import { PRICING_PACKAGES, formatPrice, CURRENCY_SYMBOL } from '../core/pricing.js';
import { buildWhatsAppLink } from '../config.js';

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
        const projectName = this.store?.getState?.()?.projectInfo?.name || 'مشروعي';

        const cards = PRICING_PACKAGES.map(pkg => {
            const features = PACKAGE_FEATURES[pkg.id] || [];
            const message = `مرحباً، أرغب بترقية دراسة «${projectName}» لباقة «${pkg.name}» (${formatPrice(pkg.price)} ${CURRENCY_SYMBOL}) للحصول على ${this.formatLabel}.`;
            const waLink = buildWhatsAppLink(message);
            return `
                <div class="card paywall-package-card" style="padding:16px;border-radius:12px;">
                    <h4 style="margin:0 0 4px;">${escapeHtml(pkg.name)}</h4>
                    <div class="text-gold" style="font-size:1.4rem;font-weight:700;margin-bottom:8px;">${formatPrice(pkg.price)} <span style="font-size:0.9rem;font-weight:400;">${escapeHtml(pkg.unit)}</span></div>
                    <ul style="margin:0 0 12px;padding-inline-start:18px;font-size:0.85rem;color:var(--c-text-muted,#94a3b8);">
                        ${features.map(f => `<li>${escapeHtml(f)}</li>`).join('')}
                    </ul>
                    <a href="${escapeHtml(waLink)}" target="_blank" rel="noopener noreferrer" class="btn btn--primary btn-block btn-whatsapp-upgrade" data-package="${pkg.id}">
                        📱 تواصل عبر واتساب للترقية
                    </a>
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
                    <p class="text-muted mb-4">${escapeHtml(this.formatLabel)} متاح ضمن الباقات المدفوعة. لا يوجد نظام دفع آلي بعد — تواصل معنا مباشرة عبر واتساب لأي من الباقات وسنفعّلها لك يدوياً.</p>
                    <div class="paywall-packages-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;">
                        ${cards}
                    </div>
                </div>
                <div class="modal-footer">
                    <p class="text-xs text-muted text-center w-full">الأدوات المجانية (JSON، CSV، لوحة المستثمر للمشاركة) تبقى بلا قيود.</p>
                </div>
            </div>
        `;

        this.overlay.querySelector('.paywall-close')?.addEventListener('click', () => this.close());
        this.overlay.addEventListener('click', (e) => { if (e.target === this.overlay) this.close(); });
    }
}
