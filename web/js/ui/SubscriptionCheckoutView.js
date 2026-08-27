import { PRICING_PACKAGES, ADDONS, formatPrice } from '../core/pricing.js';
import { startCheckout } from '../services/PaymentService.js';
import { store } from '../core/store.js';
import { ProjectManager } from '../services/ProjectManager.js';
import { getBankTransferConfig } from '../config.js';
import { trackEvent } from '../utils/analytics.js';
import { monitoring } from '../utils/monitoring.js';
import { renderBankTransferPanel } from './components/BankTransferPanel.js';

export class SubscriptionCheckoutView {
    constructor(container, options = {}) { this.container = container; this.onBack = options.onBack || (() => {}); this.studyId = null; }

    async render() {
        this.container.innerHTML = `<div class="p-6 max-w-3xl mx-auto"><p class="text-muted">جارٍ التحضير…</p></div>`;
        // الدفع يفتح دراسة محفوظة بعينها (نموذج الدفع لفتح كل دراسة). نربط الطلب بمعرّف
        // الدراسة النشطة المحفوظة فقط — لا نُنشئ معرّفاً عشوائياً يتيماً كان يؤدي لدفع
        // حقيقي بلا فتح فعلي (إذ لا يطابق أي دراسة يفتحها العميل لاحقاً). العميل القادم
        // من الهبوط بلا دراسة يُوجَّه لبدء واحدة ثم الدفع لفتحها من داخلها.
        const state = store.getState() || {};
        const candidateId = state.projectInfo?.id || state.id || null;
        let saved = null;
        if (candidateId) {
            try { saved = (await ProjectManager.loadProject(candidateId))?.data || null; } catch (_) { saved = null; }
        }
        // لا يكفي أن تكون الدراسة "محفوظة": الزائر القادم من الهبوط تُنشأ له دراسة فارغة
        // تلقائياً وتُزامَن خلال أقل من ثانية (feas_project_<id>)، فيمرّ وجودها ويدفع على
        // دراسة مؤقتة يهجرها ثم يبني دراسته الحقيقية فيبقى تقريرها مقفلاً رغم الدفع.
        // نشترط دراسة "ذات معنى" (لها اسم فعلي — أول ما يلتقطه المعالج، وهو "" في الفارغة)
        // وإلا نوجّهه لبناء دراسته والدفع من داخلها. الفحص يخطئ في الاتجاه الآمن: إن اعتُبرت
        // دراسة حقيقية فارغةً فأسوأ أثر توجيهٌ لبدء دراسة، لا دفعٌ يضيع.
        // الاسم يُقرأ من الحالة الحيّة (ما يعمل عليه العميل الآن) لا من النسخة المحفوظة
        // (قد تتأخّر مزامنتها)، مع بقاء اشتراط أن الدراسة محفوظة فعلاً (saved) ليصحّ ربط الطلب.
        const isMeaningful = !!saved && String(state.projectInfo?.name || '').trim().length > 0;
        if (!isMeaningful) { this._renderNoStudy(); return; }
        this.studyId = candidateId;
        this._renderCheckout();
    }

    _renderNoStudy() {
        this.container.innerHTML = `<div class="p-6 max-w-3xl mx-auto">
            <button id="checkoutBack" class="btn btn--ghost mb-4">← رجوع</button>
            <div class="card p-6" style="max-width:520px;margin:24px auto;text-align:center">
                <h1 class="text-2xl font-bold mb-3">ابدأ دراستك أولاً</h1>
                <p class="text-muted mb-5">الدفع يفتح دراسة محدّدة لتصديرها وتعديلها بالكامل. أنشئ دراستك واملأ بياناتها، ثم ادفع لفتحها من داخلها — بهذا يُربط طلبك بالدراسة الصحيحة.</p>
                <button id="checkoutStartStudy" class="btn btn--primary">ابدأ دراستي الآن</button>
            </div>
        </div>`;
        this.container.querySelector('#checkoutBack')?.addEventListener('click', () => this.onBack());
        this.container.querySelector('#checkoutStartStudy')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('feasibility:newStudy')));
    }

    _renderCheckout() {
        const selected = sessionStorage.getItem('selected_package') || 'self';
        const paidPackages = PRICING_PACKAGES.filter(p => p.price > 0);
        const pkg = paidPackages.find(p => p.id === selected) || paidPackages.find(p => p.id === 'self');
        this._pkg = pkg;
        // الدفع الوحيد المتاح تحويل بنكي (قرار مالك 2026-07-22 — بلا بوابات إلكترونية).
        const bankReady = !!getBankTransferConfig();
        const payAction = bankReady
            ? `<button class="btn btn--primary btn-block mt-4" id="checkoutPayBank">الدفع بتحويل بنكي</button>`
            : `<p class="text-danger text-sm mt-4">الدفع بتحويل بنكي غير متاح مؤقتاً — تواصل معنا لإتمام الطلب.</p>`;
        // مفتاح تبديل الباقة (self/reviewed/full) — إضافة سلوكية عن التصميم المُسلَّم،
        // بموافقة صريحة: الكود الحي سابقاً كان يثق فقط بالباقة المُختارة مسبقاً
        // (sessionStorage.selected_package) بلا فرصة لتغييرها من هذه الشاشة نفسها.
        const tiersHtml = paidPackages.map(p => `
            <button type="button" class="checkout-tier ${p.id === pkg.id ? 'is-active' : ''}" data-tier="${p.id}">
                <span class="checkout-tier__name">${p.name}</span>
                <span class="checkout-tier__price">${formatPrice(p.price)}</span>
                <span class="checkout-tier__unit">${p.unit}</span>
            </button>`).join('');
        // نفس مؤشرات الثقة الثلاثة الظاهرة بجوار زر الدفع في PaywallModal.js (تذييل
        // الفاتورة/الضريبة، الاسترداد، الأدوات المجانية) — تُكرَّر هنا لأن هذه شاشة
        // الدفع الرئيسية القادمة من صفحة التسعير، لا PaywallModal فقط. نص الاسترداد
        // ثابت هنا (لا REFUND_POLICY.shortTitle) بلا استيراد إضافي من config.js.
        const trustHtml = `<p class="text-xs text-muted text-center w-full mt-3">جميع الأسعار شاملة ضريبة القيمة المضافة (15%) — لا رسوم إضافية عند الدفع.</p><p class="text-xs text-muted text-center w-full">ضمان استرداد خلال 15 يوم على الباقات المدفوعة إن لم تُقنعك النتيجة.</p><p class="text-xs text-muted text-center w-full">الأدوات المجانية (JSON، CSV، لوحة المستثمر للمشاركة) تبقى بلا قيود.</p>`;
        this.container.innerHTML = `<div class="p-6 max-w-3xl mx-auto"><button id="checkoutBack" class="btn btn--ghost mb-4">← رجوع</button><h1 class="text-2xl font-bold mb-2">إكمال الطلب</h1><p class="text-muted mb-5">راجع الباقة والخدمات الإضافية، ثم أرسل طلب الدفع بتحويل بنكي.</p><div class="card p-6" id="checkoutCard"><h2 class="text-sm font-bold mb-2">الباقة</h2><div class="checkout-tiers mb-2">${tiersHtml}</div><p class="text-xs text-muted mb-4" id="checkoutPkgAudience">${pkg.audience} · التسليم: ${pkg.delivery}</p><h2 class="text-sm font-bold mb-2">خدمات إضافية</h2>${ADDONS.map(a => this._addonRowHtml(a, pkg)).join('')}<div class="form-group mt-4"><label class="text-sm">كوبون الخصم</label><input id="checkoutCoupon" class="form-input w-full" dir="ltr" placeholder="أدخل كود الخصم إن وُجد"></div><div class="mt-5" style="border-top:1px solid var(--c-border)"><div class="flex justify-between py-2"><span id="checkoutPkgName">${pkg.name}</span><span id="checkoutPkgPrice">${formatPrice(pkg.price)} ريال</span></div><div class="flex justify-between py-2"><span>الإجمالي (شامل الضريبة)</span><span id="checkoutSubtotal"></span></div><div class="flex justify-between py-2"><span>الخصم المتوقع</span><span id="checkoutDiscount">يُتحقق منه عند الدفع</span></div><div class="flex justify-between py-2 text-muted" style="font-size:.9rem"><span>منها ضريبة القيمة المضافة (15%)</span><span id="checkoutVat"></span></div><div class="flex justify-between py-2 font-bold text-lg"><span>المطلوب دفعه</span><span id="checkoutTotal"></span></div></div><div id="checkoutError" class="text-danger text-sm mt-2" role="alert" style="display:none"></div>${payAction}${trustHtml}</div></div>`;
        this.container.querySelector('#checkoutBack')?.addEventListener('click', () => this.onBack());
        this.container.querySelectorAll('[data-addon]').forEach(el => el.addEventListener('change', () => this.update(this._pkg)));
        this.container.querySelector('#checkoutPayBank')?.addEventListener('click', (e) => this.payBankTransfer(this._pkg, e.currentTarget));
        this.container.querySelectorAll('[data-tier]').forEach(btn => btn.addEventListener('click', () => this._selectTier(btn.dataset.tier)));
        this.update(pkg);
    }

    /**
     * إضافة مشمولة أصلاً في الباقة (result_session ضمن full — انظر ADDONS في
     * core/pricing.js) تُعرض مؤشَّرة ومعطَّلة بدل قابلة للتحديد، فلا تُحتسَب
     * ضمن «المطلوب دفعه» ولا تُرسَل في addons عند الدفع (selectedAddons أدناه).
     */
    _addonRowHtml(a, pkg) {
        const included = !!a.includedIn?.includes(pkg.id);
        return `<label class="flex justify-between items-center py-2" data-addon-row="${a.id}"><span><input type="checkbox" data-addon="${a.id}" data-price="${a.price}"${included ? ' checked disabled' : ''}> ${a.name}<span class="text-xs text-muted" data-addon-note style="${included ? '' : 'display:none'}"> (مشمولة في باقتك)</span></span><span>${a.price} ريال</span></label>`;
    }

    /**
     * تُستدعى بعد تبديل الباقة (_selectTier) — لا تعيد بناء صفوف الإضافات (لتفادي
     * فقد اختيار المستخدم الحالي)، بل تُفعّل/تُعطّل كل صف حسب انتماء إضافته
     * لباقتها الجديدة. تحفظ اختيار المستخدم اليدوي لغير المشمولة عبر التبديلات،
     * ولا تُصفّر التحديد إلا لإضافة كانت مشمولة إجبارياً في الباقة السابقة.
     */
    _syncAddonsForPackage(pkg) {
        ADDONS.forEach((a) => {
            const included = !!a.includedIn?.includes(pkg.id);
            const checkbox = this.container.querySelector(`[data-addon="${a.id}"]`);
            if (!checkbox) return;
            const wasForcedByInclusion = checkbox.disabled;
            if (included) checkbox.checked = true;
            else if (wasForcedByInclusion) checkbox.checked = false;
            checkbox.disabled = included;
            const note = this.container.querySelector(`[data-addon-row="${a.id}"] [data-addon-note]`);
            if (note) note.style.display = included ? '' : 'none';
        });
    }

    /**
     * تحديث DOM مباشر بدل إعادة رسم الصفحة كاملة (this._renderCheckout()) — التبديل
     * بين الباقات كان يعيد بناء الكرت كله (شرائح الأسعار/الإضافات/الكوبون) في كل ضغطة،
     * ما يمسح تركيز المستخدم ويسبب وميضاً بصرياً. لأن DOM لا يُعاد بناؤه هنا، حالة
     * الخدمات الإضافية المُحدَّدة تبقى كما هي تلقائياً بلا حاجة لحفظ/استعادتها — عدا
     * إضافة مشمولة في باقة (_syncAddonsForPackage) التي تُفعَّل/تُعطَّل صراحة.
     */
    _selectTier(tierId) {
        const pkg = PRICING_PACKAGES.find(p => p.id === tierId && p.price > 0);
        if (!pkg || pkg.id === this._pkg?.id) return;
        try { sessionStorage.setItem('selected_package', tierId); } catch (_) { /* تجاهل بيئات بلا sessionStorage */ }
        trackEvent('checkout_tier_change', { tier: tierId });
        this._pkg = pkg;
        this.container.querySelectorAll('[data-tier]').forEach((btn) => {
            btn.classList.toggle('is-active', btn.dataset.tier === pkg.id);
        });
        const audienceEl = this.container.querySelector('#checkoutPkgAudience');
        if (audienceEl) audienceEl.textContent = `${pkg.audience} · التسليم: ${pkg.delivery}`;
        const nameEl = this.container.querySelector('#checkoutPkgName');
        if (nameEl) nameEl.textContent = pkg.name;
        const priceEl = this.container.querySelector('#checkoutPkgPrice');
        if (priceEl) priceEl.textContent = `${formatPrice(pkg.price)} ريال`;
        this._syncAddonsForPackage(pkg);
        this.update(pkg);
    }

    // :not(:disabled) يستبعد إضافة مشمولة في الباقة (معطَّلة عمداً في _addonRowHtml) —
    // بلا هذا الاستبعاد كانت تُحتسَب في الإجمالي المعروض وتُرسَل ضمن addons عند الدفع
    // رغم كونها مجانية فعلياً ضمن الباقة المختارة.
    selectedAddons(){ return [...this.container.querySelectorAll('[data-addon]:checked:not(:disabled)')].map(el => el.dataset.addon); }
    update(pkg){ const subtotal=pkg.price+[...this.container.querySelectorAll('[data-addon]:checked:not(:disabled)')].reduce((s,e)=>s+Number(e.dataset.price),0); const vat=subtotal - subtotal/1.15; this.container.querySelector('#checkoutSubtotal').textContent=formatPrice(subtotal)+' ريال'; this.container.querySelector('#checkoutVat').textContent=formatPrice(Math.round(vat))+' ريال'; this.container.querySelector('#checkoutTotal').textContent=formatPrice(subtotal)+' ريال'; }

    /**
     * تحويل بنكي (قناة يدوية وحيدة — قرار مالك 2026-07-22): يُنشئ طلباً pending عبر
     * create-checkout بلا رابط دفع خارجي، ثم يعرض بيانات حساب الشركة عبر اللوحة
     * المشتركة BankTransferPanel (نفس منطق PaywallModal.js المُثبَت). يؤكّده الأدمن
     * يدوياً بعد وصول الحوالة فيصبح status='paid' ويُفتح التصدير.
     */
    async payBankTransfer(pkg, button) {
        const errorEl = this.container.querySelector('#checkoutError');
        errorEl.style.display = 'none';
        if (!this.studyId) { errorEl.textContent = 'ابدأ دراستك أولاً ثم ادفع لفتحها.'; errorEl.style.display = 'block'; return; }
        button.disabled = true;
        const old = button.textContent;
        button.textContent = 'جاري تجهيز الطلب...';
        trackEvent('checkout_start', { tier: pkg.id, provider: 'bank_transfer' });
        const result = await startCheckout({ tier: pkg.id, studyId: this.studyId, provider: 'bank_transfer', addons: this.selectedAddons(), coupon: this.container.querySelector('#checkoutCoupon').value });
        if (result.ok && result.bankTransfer) {
            const card = this.container.querySelector('#checkoutCard');
            renderBankTransferPanel(card, { tier: pkg.id, orderId: result.orderId, amount: result.amount, onBack: () => this._renderCheckout() });
            return;
        }
        trackEvent('payment_error', { tier: pkg.id, provider: 'bank_transfer', message: result.error || 'bank_transfer_failed' });
        // بلوكر #43 (نفس نمط PaymentReturnView.js): فشل الدفع لا يصل لأي مراقبة بلا هذا
        // الاستدعاء — يظهر للعميل فقط برسالة الخطأ أدناه، بلا أثر يراه الأدمن عبر Sentry.
        monitoring.captureMessage(`Payment error: bank_transfer checkout failed (tier ${pkg.id})`, 'warning', { tier: pkg.id, provider: 'bank_transfer', studyId: this.studyId, message: result.error || 'bank_transfer_failed' });
        errorEl.textContent = result.error || 'تعذّر إنشاء طلب التحويل البنكي. حاول لاحقاً.';
        errorEl.style.display = 'block';
        button.disabled = false;
        button.textContent = old;
    }
}
