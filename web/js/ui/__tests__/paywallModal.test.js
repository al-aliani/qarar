/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-08 (ملاحظة عالية #39، قرار المالك): كان الموقع يسوّق ثلاث باقات
 * (249/990/2900 ريال) بلا أي حاجز فعلي يمنع تصدير التقرير النهائي مجاناً — فجوة
 * ثقة مباشرة. هذا يثبّت أن PaywallModal يعرض الباقات الثلاث بأسعارها الحقيقية
 * (من pricing.js، مصدر الحقيقة الوحيد) وروابط واتساب صحيحة لكل باقة.
 *
 * تدقيق 2026-07-09 (أتمتة الدفع): القرار السابق ("لا بوابة دفع، تواصل يدوي فقط")
 * حُدِّث صراحة — أُضيف دفع فعلي (Moyasar/Stripe) لكل الباقات الثلاث. الباقة
 * "ذاتي" (channel:'app') تُقدِّم الدفع المباشر أولاً؛ الباقتان الأخريان
 * (channel:'whatsapp') تُبقيان واتساب أولاً (تتطلبان تدخلاً بشرياً فعلياً) مع
 * الدفع المباشر كخيار ثانٍ. هذا الملف يثبّت كلا المسارين معاً.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PaywallModal } from '../PaywallModal.js';
import { PRICING_PACKAGES, formatPrice } from '../../core/pricing.js';

const startCheckoutMock = vi.fn(async () => ({ ok: true, checkoutUrl: 'https://pay.example.com/xyz' }));
vi.mock('../../services/PaymentService.js', () => ({
    startCheckout: (...a) => startCheckoutMock(...a),
}));

// تدقيق 2026-07-10: buildWhatsAppLink صار يُعيد null بلا رقم مضبوط (تراجع رشيق) بدل
// رابط مكسور. WHATSAPP_NUMBER يُحسَب مرة واحدة عند تحميل config.js (قبل أي beforeEach)،
// فضبط window.WHATSAPP_NUMBER هنا لا يصل بالوقت المناسب — نُموِّه الدالة مباشرة بدلاً
// من ذلك لاختبار المسار الفعلي (رابط واتساب حقيقي) بمعزل عن توقيت تحميل الوحدات.
vi.mock('../../config.js', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        buildWhatsAppLink: (text) => `https://wa.me/966501234567?text=${encodeURIComponent(text || '')}`,
    };
});

function fakeStore(state = {}) {
    return { getState: () => state };
}

describe('PaywallModal — عرض الباقات الثلاث بأسعار pricing.js الحقيقية', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        startCheckoutMock.mockClear();
        delete window.location;
        window.location = { href: '' };
    });

    it('يعرض بطاقة واحدة لكل باقة من PRICING_PACKAGES بالضبط (لا أكثر ولا أقل)', () => {
        const modal = new PaywallModal('paywallOverlay', fakeStore());
        modal.open('تقرير PDF شامل');

        const cards = document.querySelectorAll('.paywall-package-card');
        expect(cards).toHaveLength(PRICING_PACKAGES.length);
        PRICING_PACKAGES.forEach(pkg => {
            const found = [...cards].some(c => c.textContent.includes(pkg.name) && c.textContent.includes(String(formatPrice(pkg.price))));
            expect(found, `باقة ${pkg.name} (${pkg.price}) غير معروضة بسعرها الصحيح`).toBe(true);
        });
    });

    it('كل باقة تعرض رابط واتساب صحيحاً (يحوي اسم الباقة وسعرها واسم المشروع) بجانب زرَّي الدفع', () => {
        const modal = new PaywallModal('paywallOverlay', fakeStore({ projectInfo: { name: 'مطعم الاختبار', id: 'study-1' } }));
        modal.open('ملف Excel التفصيلي');

        const links = [...document.querySelectorAll('.btn-whatsapp-upgrade')];
        expect(links).toHaveLength(PRICING_PACKAGES.length);
        links.forEach(link => {
            expect(link.getAttribute('href')).toMatch(/^https:\/\/wa\.me\//);
            expect(link.getAttribute('target')).toBe('_blank');
            const decoded = decodeURIComponent(link.getAttribute('href').split('text=')[1]);
            expect(decoded).toContain('مطعم الاختبار');
            expect(decoded).toContain('ملف Excel التفصيلي');
        });
    });

    it('كل باقة تعرض زرَّي دفع فعليين (Moyasar وStripe)', () => {
        const modal = new PaywallModal('paywallOverlay', fakeStore({ projectInfo: { id: 'study-1' } }));
        modal.open('تقرير PDF شامل');

        const moyasarButtons = document.querySelectorAll('.btn-pay-now[data-provider="moyasar"]');
        const stripeButtons = document.querySelectorAll('.btn-pay-now[data-provider="stripe"]');
        expect(moyasarButtons).toHaveLength(PRICING_PACKAGES.length);
        expect(stripeButtons).toHaveLength(PRICING_PACKAGES.length);
    });

    it('باقة "ذاتي" (channel:app) تُقدِّم زرَّي الدفع قبل رابط واتساب في البطاقة نفسها', () => {
        const modal = new PaywallModal('paywallOverlay', fakeStore({ projectInfo: { id: 'study-1' } }));
        modal.open('تقرير PDF شامل');

        const selfPkg = PRICING_PACKAGES.find(p => p.id === 'self');
        const card = [...document.querySelectorAll('.paywall-package-card')].find(c => c.textContent.includes(selfPkg.name));
        const payBtnIndex = card.innerHTML.indexOf('btn-pay-now');
        const waLinkIndex = card.innerHTML.indexOf('btn-whatsapp-upgrade');
        expect(payBtnIndex).toBeGreaterThan(-1);
        expect(waLinkIndex).toBeGreaterThan(-1);
        expect(payBtnIndex).toBeLessThan(waLinkIndex);
    });

    it('باقتا "مراجَع بخبير"/"خدمة كاملة" (channel:whatsapp) تُقدِّمان واتساب قبل زرَّي الدفع', () => {
        const modal = new PaywallModal('paywallOverlay', fakeStore({ projectInfo: { id: 'study-1' } }));
        modal.open('تقرير PDF شامل');

        ['reviewed', 'full'].forEach(id => {
            const pkg = PRICING_PACKAGES.find(p => p.id === id);
            const card = [...document.querySelectorAll('.paywall-package-card')].find(c => c.textContent.includes(pkg.name));
            const payBtnIndex = card.innerHTML.indexOf('btn-pay-now');
            const waLinkIndex = card.innerHTML.indexOf('btn-whatsapp-upgrade');
            expect(waLinkIndex).toBeLessThan(payBtnIndex);
        });
    });

    it('النقر على زر الدفع المباشر يستدعي startCheckout بالمعطيات الصحيحة ويوجّه المتصفح لرابط الدفع', async () => {
        const modal = new PaywallModal('paywallOverlay', fakeStore({ projectInfo: { id: 'study-42' } }));
        modal.open('تقرير PDF شامل');

        const btn = document.querySelector('.btn-pay-now[data-package="self"][data-provider="moyasar"]');
        btn.click();
        await new Promise(r => setTimeout(r, 0));

        expect(startCheckoutMock).toHaveBeenCalledWith({ tier: 'self', studyId: 'study-42', provider: 'moyasar' });
        expect(window.location.href).toBe('https://pay.example.com/xyz');
    });

    it('بلا معرّف دراسة صالح: يعرض خطأً واضحاً ولا يستدعي startCheckout', async () => {
        const modal = new PaywallModal('paywallOverlay', fakeStore({}));
        modal.open('تقرير PDF شامل');

        const btn = document.querySelector('.btn-pay-now[data-package="self"][data-provider="moyasar"]');
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

        const btn = document.querySelector('.btn-pay-now[data-package="self"][data-provider="moyasar"]');
        btn.click();
        await new Promise(r => setTimeout(r, 0));

        expect(document.getElementById('paywallPayError').textContent).toContain('مزوّد الدفع غير متاح حالياً');
        expect(btn.disabled).toBe(false);
    });

    it('اسم الصيغة المطلوبة (formatLabel) يظهر فعلياً في نص الرسالة الرئيسي للنافذة', () => {
        const modal = new PaywallModal('paywallOverlay', fakeStore());
        modal.open('نسخة للممول');
        expect(document.querySelector('.paywall-modal').textContent).toContain('نسخة للممول');
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
