/**
 * PackagePreferenceModal — تفضيل باقة غير مُلزم بعد تحقق الجوال (يُفتح من
 * سلسلة AuthGuard.js حين profile.preferred_tier فارغ). لا زر إغلاق/ESC/
 * نقر-خلفي عمداً — لا يحتاج زر "لاحقاً" منفصل لأن خيار "استخدم مجاناً الآن"
 * يغطي بالضبط نفس المعنى بلا ترك السلسلة معلَّقة. اختيار غير ملزم بالكامل:
 * لا يُنشئ أي صف orders ولا يبدأ أي دفع — الشراء الفعلي يبقى عبر
 * PaywallModal.js وقت التصدير كما هو، وهذا فقط يُميّز البطاقة المطابقة هناك.
 */
import { PRICING_PACKAGES, formatPrice, CURRENCY_SYMBOL } from '../core/pricing.js';
import { updateUserProfile } from '../../supabaseClient.js';
import { trackEvent } from '../utils/analytics.js';

function escapeHtml(str) {
    if (str == null) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export class PackagePreferenceModal {
    constructor(options = {}) {
        this.overlay = null;
        this.options = options;
        this._prevFocus = null;
        this._onTrap = null;
    }

    open() {
        if (this.overlay) return;
        trackEvent('package_preference_view', {});
        this.overlay = document.createElement('div');
        this.overlay.id = 'packagePreferenceModalOverlay';
        this.overlay.className = 'modal-overlay is-open';

        const cards = PRICING_PACKAGES.map((pkg) => `
            <button type="button" class="card" data-tier="${pkg.id}" style="text-align:start;cursor:pointer;padding:16px;border-radius:12px;width:100%;">
                <h4 style="margin:0 0 4px;">${escapeHtml(pkg.name)}</h4>
                <div class="text-gold" style="font-size:1.1rem;font-weight:700;">
                    ${pkg.price != null ? `${formatPrice(pkg.price)} ${CURRENCY_SYMBOL} <span style="font-size:0.85rem;font-weight:400;">${escapeHtml(pkg.unit)}</span>` : ''}
                </div>
            </button>
        `).join('');

        this.overlay.innerHTML = `
            <div class="modal-card" style="max-width: 460px;" role="dialog" aria-modal="true" aria-labelledby="packagePreferenceModalTitle">
                <div class="modal-header">
                    <h3 id="packagePreferenceModalTitle">أي باقة تناسبك؟</h3>
                </div>
                <div class="modal-body">
                    <p class="text-muted text-sm mb-3">هذا اختيار أولي غير مُلزم — تقدر تغيّره أو تشتري لاحقاً وقت التصدير.</p>
                    <div id="packagePreferenceError" class="text-danger text-sm mb-2" role="alert" style="display:none;"></div>
                    <div style="display:grid;gap:10px;">${cards}</div>
                </div>
            </div>
        `;
        document.body.appendChild(this.overlay);
        document.body.style.overflow = 'hidden';

        this._prevFocus = document.activeElement;
        this._onTrap = (e) => {
            if (e.key !== 'Tab' || !this.overlay) return;
            const f = Array.from(this.overlay.querySelectorAll('button, [tabindex]:not([tabindex="-1"])'))
                .filter((el) => !el.disabled && el.offsetParent !== null);
            if (!f.length) return;
            const first = f[0], last = f[f.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        };
        this.overlay.addEventListener('keydown', this._onTrap);

        const errEl = this.overlay.querySelector('#packagePreferenceError');
        const showErr = (msg) => { errEl.textContent = msg || ''; errEl.style.display = msg ? 'block' : 'none'; };

        this.overlay.querySelectorAll('[data-tier]').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const tier = btn.dataset.tier;
                trackEvent('package_preference_selected', { tier });
                this.overlay.querySelectorAll('[data-tier]').forEach((b) => { b.disabled = true; });
                showErr('');
                const { ok, error } = await updateUserProfile({ preferred_tier: tier });
                if (!ok) {
                    showErr(error || 'فشل حفظ اختيارك');
                    this.overlay.querySelectorAll('[data-tier]').forEach((b) => { b.disabled = false; });
                    return;
                }
                this.options.onSelected?.(tier);
                this.close();
            });
        });
    }

    close() {
        if (this.overlay) {
            if (this._onTrap) this.overlay.removeEventListener('keydown', this._onTrap);
            this._onTrap = null;
            this.overlay.classList.remove('is-open');
            this.overlay.remove();
            this.overlay = null;
        }
        document.body.style.overflow = '';
        try { this._prevFocus?.focus?.(); } catch (_) {}
    }
}
