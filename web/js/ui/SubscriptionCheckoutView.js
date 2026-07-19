import { PRICING_PACKAGES, formatPrice } from '../core/pricing.js';
import { startCheckout } from '../services/PaymentService.js';
import { store } from '../core/store.js';
import { ProjectManager } from '../services/ProjectManager.js';

const ADDONS = [
    { id: 'priority_support', name: 'دعم أولوية', price: 99 },
    { id: 'extra_review', name: 'مراجعة إضافية', price: 299 },
    { id: 'result_session', name: 'جلسة شرح النتائج', price: 399 }
];

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
        const pkg = PRICING_PACKAGES.find(p => p.id === selected && p.price > 0) || PRICING_PACKAGES.find(p => p.id === 'self');
        this.container.innerHTML = `<div class="p-6 max-w-3xl mx-auto"><button id="checkoutBack" class="btn btn--ghost mb-4">← رجوع</button><h1 class="text-2xl font-bold mb-2">إكمال الطلب</h1><p class="text-muted mb-5">راجع الباقة والخدمات الإضافية قبل الانتقال إلى بوابة الدفع.</p><div class="card p-6"><div class="flex justify-between mb-4"><strong>${pkg.name}</strong><strong>${formatPrice(pkg.price)} ريال</strong></div><h2 class="text-sm font-bold mb-2">خدمات إضافية</h2>${ADDONS.map(a => `<label class="flex justify-between items-center py-2"><span><input type="checkbox" data-addon="${a.id}" data-price="${a.price}"> ${a.name}</span><span>${a.price} ريال</span></label>`).join('')}<div class="form-group mt-4"><label class="text-sm">كوبون الخصم</label><input id="checkoutCoupon" class="form-input w-full" dir="ltr" placeholder="WELCOME10"></div><div class="mt-5" style="border-top:1px solid var(--c-border)"><div class="flex justify-between py-2"><span>الإجمالي (شامل الضريبة)</span><span id="checkoutSubtotal"></span></div><div class="flex justify-between py-2"><span>الخصم المتوقع</span><span id="checkoutDiscount">يُتحقق منه عند الدفع</span></div><div class="flex justify-between py-2 text-muted" style="font-size:.9rem"><span>منها ضريبة القيمة المضافة (15%)</span><span id="checkoutVat"></span></div><div class="flex justify-between py-2 font-bold text-lg"><span>المطلوب دفعه</span><span id="checkoutTotal"></span></div></div><div id="checkoutError" class="text-danger text-sm mt-2" style="display:none"></div><div class="grid grid-cols-3 gap-2 mt-4"><button class="btn btn--primary" data-provider="moyasar">مدى / Apple Pay</button><button class="btn btn--secondary" data-provider="tamara">تمارا</button><button class="btn btn--secondary" data-provider="stripe">بطاقة دولية</button></div></div></div>`;
        this.container.querySelector('#checkoutBack')?.addEventListener('click', () => this.onBack());
        this.container.querySelectorAll('[data-addon]').forEach(el => el.addEventListener('change', () => this.update(pkg)));
        this.container.querySelectorAll('[data-provider]').forEach(btn => btn.addEventListener('click', () => this.pay(pkg, btn)));
        this.update(pkg);
    }

    selectedAddons(){ return [...this.container.querySelectorAll('[data-addon]:checked')].map(el => el.dataset.addon); }
    update(pkg){ const subtotal=pkg.price+[...this.container.querySelectorAll('[data-addon]:checked')].reduce((s,e)=>s+Number(e.dataset.price),0); const vat=subtotal - subtotal/1.15; this.container.querySelector('#checkoutSubtotal').textContent=formatPrice(subtotal)+' ريال'; this.container.querySelector('#checkoutVat').textContent=formatPrice(Math.round(vat))+' ريال'; this.container.querySelector('#checkoutTotal').textContent=formatPrice(subtotal)+' ريال'; }
    async pay(pkg, button){ const errorEl=this.container.querySelector('#checkoutError'); errorEl.style.display='none'; if(!this.studyId){ errorEl.textContent='ابدأ دراستك أولاً ثم ادفع لفتحها.'; errorEl.style.display='block'; return; } button.disabled=true; const old=button.textContent; button.textContent='جاري التجهيز...'; const result=await startCheckout({tier:pkg.id,studyId:this.studyId,provider:button.dataset.provider,addons:this.selectedAddons(),coupon:this.container.querySelector('#checkoutCoupon').value}); if(result.ok){window.location.href=result.checkoutUrl;return;} errorEl.textContent=result.error||'تعذر بدء الدفع';errorEl.style.display='block';button.disabled=false;button.textContent=old;}
}
