/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-08 (ملاحظة عالية #39، قرار المالك): كان الموقع يسوّق ثلاث باقات
 * (249/990/2900 ريال) بلا أي حاجز فعلي يمنع تصدير التقرير النهائي مجاناً — فجوة
 * ثقة مباشرة. هذا يثبّت أن PaywallModal يعرض الباقات المدفوعة بأسعارها الحقيقية
 * (من pricing.js، مصدر الحقيقة الوحيد) والدفع داخل المنصة بلا طلب عبر واتساب.
 *
 * قرار مالك 2026-07-22 (بلا بوابات إلكترونية): كانت هذه النافذة (تدقيق حي)
 * لا تزال تعرض Moyasar/تمارا/Stripe فعلياً رغم أن القرار طُبِّق فعلاً في
 * SubscriptionCheckoutView.js — هذا يثبّت التوحيد: زر تحويل بنكي وحيد فقط.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PaywallModal } from '../PaywallModal.js';
import { PRICING_PACKAGES, formatPrice } from '../../core/pricing.js';

const startCheckoutMock = vi.fn(async () => ({ ok: true, bankTransfer: true, orderId: 'order-1', amount: 299 }));
const listOrdersMock = vi.fn(async () => []);
vi.mock('../../services/PaymentService.js', () => ({
    startCheckout: (...a) => startCheckoutMock(...a),
    listOrders: (...a) => listOrdersMock(...a),
}));

const toastSuccessMock = vi.fn();
vi.mock('../../utils/toast.js', () => ({
    toast: { success: (...a) => toastSuccessMock(...a) },
}));

const getBankTransferConfigMock = vi.fn(() => ({ beneficiaryName: 'شركة شفق الأعمال التجارية', bankName: 'بنك البلاد', iban: 'SA5815000900142467710006' }));
vi.mock('../../config.js', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, getBankTransferConfig: (...a) => getBankTransferConfigMock(...a) };
});

const renderBankTransferPanelMock = vi.fn();
vi.mock('../components/BankTransferPanel.js', () => ({
    renderBankTransferPanel: (...a) => renderBankTransferPanelMock(...a),
}));

function fakeStore(state = {}) {
    return { getState: () => state };
}

describe('PaywallModal — عرض الباقات المدفوعة بأسعار pricing.js الحقيقية', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        startCheckoutMock.mockClear();
        listOrdersMock.mockReset().mockResolvedValue([]);
        toastSuccessMock.mockClear();
        renderBankTransferPanelMock.mockClear();
        getBankTransferConfigMock.mockReset().mockReturnValue({ beneficiaryName: 'شركة شفق الأعمال التجارية', bankName: 'بنك البلاد', iban: 'SA5815000900142467710006' });
        delete window.location;
        window.location = { href: '' };
    });

    it('يعرض بطاقة واحدة لكل باقة من PRICING_PACKAGES بالضبط (لا أكثر ولا أقل)', () => {
        const modal = new PaywallModal('paywallOverlay', fakeStore());
        modal.open('تقرير PDF شامل');

        const cards = document.querySelectorAll('.paywall-package-card');
        const paidPackages = PRICING_PACKAGES.filter(pkg => pkg.price > 0);
        expect(cards).toHaveLength(paidPackages.length);
        paidPackages.forEach(pkg => {
            const found = [...cards].some(c => c.textContent.includes(pkg.name) && c.textContent.includes(String(formatPrice(pkg.price))));
            expect(found, `باقة ${pkg.name} (${pkg.price}) غير معروضة بسعرها الصحيح`).toBe(true);
        });
    });

    it('لا يعرض أي زر طلب أو ترقية عبر واتساب', () => {
        const modal = new PaywallModal('paywallOverlay', fakeStore({ projectInfo: { id: 'study-1' } }));
        modal.open('ملف Excel التفصيلي');
        expect(document.querySelector('.btn-whatsapp-upgrade')).toBeNull();
    });

    it('كل باقة تعرض زر تحويل بنكي وحيداً، بلا أي مزوّد إلكتروني (moyasar/tamara/stripe)', () => {
        const modal = new PaywallModal('paywallOverlay', fakeStore({ projectInfo: { id: 'study-1' } }));
        modal.open('تقرير PDF شامل');

        const paidCount = PRICING_PACKAGES.filter(pkg => pkg.price > 0).length;
        expect(document.querySelectorAll('.btn-pay-now[data-provider="bank_transfer"]')).toHaveLength(paidCount);
        expect(document.querySelector('[data-provider="moyasar"]')).toBeNull();
        expect(document.querySelector('[data-provider="tamara"]')).toBeNull();
        expect(document.querySelector('[data-provider="stripe"]')).toBeNull();
    });

    it('باقة "ذاتي" تعرض الدفع داخل المنصة فقط', () => {
        const modal = new PaywallModal('paywallOverlay', fakeStore({ projectInfo: { id: 'study-1' } }));
        modal.open('تقرير PDF شامل');

        const selfPkg = PRICING_PACKAGES.find(p => p.id === 'self');
        const card = [...document.querySelectorAll('.paywall-package-card')].find(c => c.textContent.includes(selfPkg.name));
        const payBtnIndex = card.innerHTML.indexOf('btn-pay-now');
        expect(payBtnIndex).toBeGreaterThan(-1);
        expect(card.querySelector('.btn-whatsapp-upgrade')).toBeNull();
    });

    it('باقتا "مراجَع بخبير" و"خدمة كاملة" تعرضان الدفع داخل المنصة', () => {
        const modal = new PaywallModal('paywallOverlay', fakeStore({ projectInfo: { id: 'study-1' } }));
        modal.open('تقرير PDF شامل');

        ['reviewed', 'full'].forEach(id => {
            const pkg = PRICING_PACKAGES.find(p => p.id === id);
            const card = [...document.querySelectorAll('.paywall-package-card')].find(c => c.textContent.includes(pkg.name));
            const payBtnIndex = card.innerHTML.indexOf('btn-pay-now');
            expect(payBtnIndex).toBeGreaterThan(-1);
            expect(card.querySelector('.btn-whatsapp-upgrade')).toBeNull();
        });
    });

    it('إعداد بنكي غير صالح (null) ⇒ رسالة "غير متاح" بدل زر مكسور', () => {
        getBankTransferConfigMock.mockReturnValue(null);
        const modal = new PaywallModal('paywallOverlay', fakeStore({ projectInfo: { id: 'study-1' } }));
        modal.open('تقرير PDF شامل');

        expect(document.querySelector('.btn-pay-now')).toBeNull();
        expect(document.querySelector('.paywall-modal').textContent).toContain('غير متاح');
    });

    it('النقر على زر التحويل البنكي ينشئ طلباً بـprovider=bank_transfer ويعرض لوحة الحساب البنكي', async () => {
        const modal = new PaywallModal('paywallOverlay', fakeStore({ projectInfo: { id: 'study-42' } }));
        modal.open('تقرير PDF شامل');

        const btn = document.querySelector('.btn-pay-now[data-package="self"][data-provider="bank_transfer"]');
        btn.click();
        await new Promise(r => setTimeout(r, 0));

        expect(startCheckoutMock).toHaveBeenCalledWith({ tier: 'self', studyId: 'study-42', provider: 'bank_transfer' });
        expect(renderBankTransferPanelMock).toHaveBeenCalledTimes(1);
    });

    it('بلا معرّف دراسة صالح: يعرض خطأً واضحاً ولا يستدعي startCheckout', async () => {
        const modal = new PaywallModal('paywallOverlay', fakeStore({}));
        modal.open('تقرير PDF شامل');

        const btn = document.querySelector('.btn-pay-now[data-package="self"][data-provider="bank_transfer"]');
        btn.click();
        await new Promise(r => setTimeout(r, 0));

        expect(startCheckoutMock).not.toHaveBeenCalled();
        const errEl = document.getElementById('paywallPayError');
        expect(errEl.style.display).toBe('block');
        expect(errEl.textContent.length).toBeGreaterThan(0);
    });

    it('فشل startCheckout: يعرض رسالة الخطأ ويُعيد تفعيل الزر', async () => {
        startCheckoutMock.mockResolvedValueOnce({ ok: false, error: 'مزوّد الدفع غير متاح حالياً' });
        const modal = new PaywallModal('paywallOverlay', fakeStore({ projectInfo: { id: 'study-1' } }));
        modal.open('تقرير PDF شامل');

        const btn = document.querySelector('.btn-pay-now[data-package="self"][data-provider="bank_transfer"]');
        btn.click();
        await new Promise(r => setTimeout(r, 0));

        expect(document.getElementById('paywallPayError').textContent).toContain('مزوّد الدفع غير متاح حالياً');
        expect(btn.disabled).toBe(false);
    });

    it("تدقيق 2026-08-31: كوبون 100% (freeViaCoupon) ⇒ toast نجاح ويُغلق النافذة، لا رسالة خطأ رغم نجاح الطلب فعلياً", async () => {
        startCheckoutMock.mockResolvedValueOnce({ ok: true, freeViaCoupon: true, orderId: 'order-1' });
        const modal = new PaywallModal('paywallOverlay', fakeStore({ projectInfo: { id: 'study-1' } }));
        modal.open('تقرير PDF شامل');

        const btn = document.querySelector('.btn-pay-now[data-package="self"][data-provider="bank_transfer"]');
        btn.click();
        await new Promise(r => setTimeout(r, 0));

        expect(renderBankTransferPanelMock).not.toHaveBeenCalled();
        expect(toastSuccessMock).toHaveBeenCalledTimes(1);
        expect(document.getElementById('paywallOverlay').classList.contains('is-open')).toBe(false);
        const errEl = document.getElementById('paywallPayError');
        expect(errEl.style.display).not.toBe('block'); // لا يُعامَل كفشل
    });

    it("تحسين 2026-08-31: طلب pending سابق لهذه الدراسة ⇒ تنبيه واضح أعلى شبكة الباقات بدل عرض شراء جديد بصمت", async () => {
        listOrdersMock.mockResolvedValue([{ id: 'order-abcdef12', status: 'pending', study_id: 'study-1' }]);
        const modal = new PaywallModal('paywallOverlay', fakeStore({ projectInfo: { id: 'study-1' } }));
        modal.open('تقرير PDF شامل');
        await new Promise(r => setTimeout(r, 0));

        expect(listOrdersMock).toHaveBeenCalledWith('study-1');
        const notice = document.getElementById('paywallPendingOrderNotice');
        expect(notice.textContent).toContain('قيد التأكيد');
        expect(notice.textContent).toContain('order-ab');
    });

    it("لا طلب pending لهذه الدراسة ⇒ لا يظهر أي تنبيه", async () => {
        listOrdersMock.mockResolvedValue([{ id: 'order-1', status: 'paid', study_id: 'study-1' }]);
        const modal = new PaywallModal('paywallOverlay', fakeStore({ projectInfo: { id: 'study-1' } }));
        modal.open('تقرير PDF شامل');
        await new Promise(r => setTimeout(r, 0));

        const notice = document.getElementById('paywallPendingOrderNotice');
        expect(notice.textContent.trim()).toBe('');
    });

    it('اسم الصيغة المطلوبة (formatLabel) يظهر فعلياً في نص الرسالة الرئيسي للنافذة', () => {
        const modal = new PaywallModal('paywallOverlay', fakeStore());
        modal.open('نسخة للممول');
        expect(document.querySelector('.paywall-modal').textContent).toContain('نسخة للممول');
    });

    it('يعرض معاينة قبل الشراء ويشرح الجمهور ومدة التسليم لكل باقة', () => {
        const modal = new PaywallModal('paywallOverlay', fakeStore());
        modal.open('التقرير البنكي');
        expect(document.getElementById('btnPreviewLockedReport')).not.toBeNull();
        const reviewed = document.querySelector('[data-package-card="reviewed"]');
        expect(reviewed.textContent).toContain('للتقديم لممول أو شريك');
        expect(reviewed.textContent).toContain('24–48 ساعة');
        expect(reviewed.textContent).toContain('الأكثر مناسبة للتقديم');
    });

    it('زر الإغلاق (×) يُغلق النافذة (يزيل صنف is-open ويستعيد التمرير)', () => {
        const modal = new PaywallModal('paywallOverlay', fakeStore());
        modal.open('تقرير PDF شامل');
        expect(document.getElementById('paywallOverlay').classList.contains('is-open')).toBe(true);

        document.querySelector('.paywall-close').click();
        expect(document.getElementById('paywallOverlay').classList.contains('is-open')).toBe(false);
        expect(document.body.style.overflow).toBe('');
    });

    it('النقر على الخلفية (لا البطاقة) يُغلق النافذة أيضاً', () => {
        const modal = new PaywallModal('paywallOverlay', fakeStore());
        modal.open('تقرير PDF شامل');
        const overlay = document.getElementById('paywallOverlay');
        overlay.click();
        expect(overlay.classList.contains('is-open')).toBe(false);
    });
});

describe('PaywallModal — ملاحظة شفافية عند توصية NO-GO/REVISE', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        getBankTransferConfigMock.mockReset().mockReturnValue({ beneficiaryName: 'شركة شفق الأعمال التجارية', bankName: 'بنك البلاد', iban: 'SA5815000900142467710006' });
    });

    it('results.decision = NO-GO: تظهر ملاحظة تحذيرية ولا تمنع عرض الباقات', () => {
        const modal = new PaywallModal('paywallOverlay', fakeStore({ results: { decision: 'NO-GO', indicators: { npv: -50000, roi: -0.2 } } }));
        modal.open('تقرير PDF شامل');

        const note = document.querySelector('.alert--danger');
        expect(note?.textContent).toContain('عدم المضي');
        expect(document.querySelectorAll('.paywall-package-card')).toHaveLength(PRICING_PACKAGES.filter(pkg => pkg.price > 0).length);
    });

    it('results.decision = REVISE: تظهر ملاحظة تنبيه', () => {
        const modal = new PaywallModal('paywallOverlay', fakeStore({ results: { decision: 'REVISE', indicators: { irr: 0.08 } } }));
        modal.open('تقرير PDF شامل');

        const note = document.querySelector('.alert--warning');
        expect(note?.textContent).toContain('مراجعة');
    });

    it('results.decision = GO: لا تظهر أي ملاحظة', () => {
        const modal = new PaywallModal('paywallOverlay', fakeStore({ results: { decision: 'GO' } }));
        modal.open('تقرير PDF شامل');

        expect(document.querySelector('.alert--danger')).toBeNull();
        expect(document.querySelector('.alert--warning')).toBeNull();
    });

    it('قرار NO-GO محفوظ مع مؤشرات صفرية لا يُعرض كقرار حقيقي قبل اكتمال النموذج المالي', () => {
        const modal = new PaywallModal('paywallOverlay', fakeStore({
            results: {
                decision: 'NO-GO',
                indicators: { npv: 0, irr: 0, roi: 0, breakEvenPointValue: 0, profitMargin: 0, paybackPeriod: null }
            }
        }));
        modal.open('تقرير PDF شامل');

        expect(document.querySelector('.alert--danger')).toBeNull();
        expect(document.querySelector('.alert--warning')).toBeNull();
    });

    it('بلا results إطلاقاً (لم يزر لوحة القرار بعد): لا ملاحظة ولا انهيار', () => {
        const modal = new PaywallModal('paywallOverlay', fakeStore({}));
        modal.open('تقرير PDF شامل');

        expect(document.querySelector('.alert--danger')).toBeNull();
        expect(document.querySelector('.alert--warning')).toBeNull();
        expect(document.querySelectorAll('.paywall-package-card')).toHaveLength(PRICING_PACKAGES.filter(pkg => pkg.price > 0).length);
    });
});
